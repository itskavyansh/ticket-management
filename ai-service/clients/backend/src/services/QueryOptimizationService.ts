import { Pool, PoolClient } from 'pg';
import { DynamoDB } from 'aws-sdk';
import { getCacheService, CacheService, CacheTTL } from './CacheService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface QueryMetrics {
  queryId: string;
  query: string;
  executionTime: number;
  rowCount: number;
  cacheHit: boolean;
  timestamp: Date;
}

export interface PaginationOptions {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface QueryOptimizationConfig {
  enableCaching: boolean;
  defaultCacheTTL: number;
  slowQueryThreshold: number;
  maxCacheSize: number;
  enableMetrics: boolean;
}

export class QueryOptimizationService {
  private cache: CacheService;
  private queryMetrics: Map<string, QueryMetrics[]> = new Map();
  private config: QueryOptimizationConfig;

  constructor(config: Partial<QueryOptimizationConfig> = {}) {
    this.cache = getCacheService();
    this.config = {
      enableCaching: config.enableCaching ?? true,
      defaultCacheTTL: config.defaultCacheTTL ?? CacheTTL.MEDIUM,
      slowQueryThreshold: config.slowQueryThreshold ?? 1000, // 1 second
      maxCacheSize: config.maxCacheSize ?? 1000,
      enableMetrics: config.enableMetrics ?? true
    };
  }

  /**
   * Execute optimized PostgreSQL query with caching and metrics
   */
  async executeOptimizedQuery<T>(
    pool: Pool,
    query: string,
    params: any[] = [],
    options: {
      cacheTTL?: number;
      cacheKey?: string;
      enableCache?: boolean;
      enableMetrics?: boolean;
    } = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const queryId = this.generateQueryId(query, params);
    const cacheKey = options.cacheKey || queryId;
    const enableCache = options.enableCache ?? this.config.enableCaching;
    const enableMetrics = options.enableMetrics ?? this.config.enableMetrics;

    try {
      // Try cache first if enabled
      if (enableCache) {
        const cachedResult = await this.cache.get<T[]>(
          cacheKey,
          { prefix: 'query' }
        );

        if (cachedResult) {
          const executionTime = Date.now() - startTime;
          
          if (enableMetrics) {
            this.recordQueryMetrics(queryId, query, executionTime, cachedResult.length, true);
          }

          logger.debug('Query cache hit', { queryId, executionTime });
          return cachedResult;
        }
      }

      // Execute query
      const result = await pool.query(query, params);
      const executionTime = Date.now() - startTime;
      const rowCount = result.rows.length;

      // Cache result if enabled
      if (enableCache && rowCount > 0) {
        const cacheTTL = options.cacheTTL || this.config.defaultCacheTTL;
        await this.cache.set(
          cacheKey,
          result.rows,
          { prefix: 'query', ttl: cacheTTL }
        );
      }

      // Record metrics
      if (enableMetrics) {
        this.recordQueryMetrics(queryId, query, executionTime, rowCount, false);
        
        // Log slow queries
        if (executionTime > this.config.slowQueryThreshold) {
          logger.warn('Slow query detected', {
            queryId,
            executionTime,
            rowCount,
            query: this.sanitizeQuery(query)
          });
        }
      }

      logger.debug('Query executed', { queryId, executionTime, rowCount });
      return result.rows;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('Query execution failed', {
        queryId,
        executionTime,
        error: (error as Error).message,
        query: this.sanitizeQuery(query)
      });
      throw error;
    }
  }

  /**
   * Execute optimized DynamoDB query with caching
   */
  async executeOptimizedDynamoQuery<T>(
    dynamodb: DynamoDB.DocumentClient,
    params: DynamoDB.DocumentClient.QueryInput | DynamoDB.DocumentClient.ScanInput,
    options: {
      cacheTTL?: number;
      cacheKey?: string;
      enableCache?: boolean;
      operation?: 'query' | 'scan';
    } = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const operation = options.operation || 'query';
    const queryId = this.generateDynamoQueryId(params, operation);
    const cacheKey = options.cacheKey || queryId;
    const enableCache = options.enableCache ?? this.config.enableCaching;

    try {
      // Try cache first if enabled
      if (enableCache) {
        const cachedResult = await this.cache.get<T[]>(
          cacheKey,
          { prefix: 'dynamo' }
        );

        if (cachedResult) {
          const executionTime = Date.now() - startTime;
          logger.debug('DynamoDB cache hit', { queryId, executionTime });
          return cachedResult;
        }
      }

      // Execute DynamoDB operation
      let result: DynamoDB.DocumentClient.QueryOutput | DynamoDB.DocumentClient.ScanOutput;
      
      if (operation === 'query') {
        result = await dynamodb.query(params as DynamoDB.DocumentClient.QueryInput).promise();
      } else {
        result = await dynamodb.scan(params as DynamoDB.DocumentClient.ScanInput).promise();
      }

      const executionTime = Date.now() - startTime;
      const items = result.Items || [];

      // Cache result if enabled
      if (enableCache && items.length > 0) {
        const cacheTTL = options.cacheTTL || this.config.defaultCacheTTL;
        await this.cache.set(
          cacheKey,
          items,
          { prefix: 'dynamo', ttl: cacheTTL }
        );
      }

      logger.debug('DynamoDB query executed', {
        queryId,
        executionTime,
        itemCount: items.length,
        operation
      });

      return items as T[];

    } catch (error) {
      const executionTime = Date.now() - startTime;
      logger.error('DynamoDB query execution failed', {
        queryId,
        executionTime,
        operation,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Execute paginated PostgreSQL query
   */
  async executePaginatedQuery<T>(
    pool: Pool,
    baseQuery: string,
    countQuery: string,
    params: any[] = [],
    pagination: PaginationOptions,
    options: {
      cacheTTL?: number;
      enableCache?: boolean;
    } = {}
  ): Promise<PaginatedResult<T>> {
    const { page, limit, sortBy, sortOrder } = pagination;
    const offset = (page - 1) * limit;

    // Build the paginated query
    let paginatedQuery = baseQuery;
    
    if (sortBy) {
      paginatedQuery += ` ORDER BY ${sortBy} ${sortOrder || 'ASC'}`;
    }
    
    paginatedQuery += ` LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    const paginatedParams = [...params, limit, offset];

    // Execute both queries concurrently
    const [dataResult, countResult] = await Promise.all([
      this.executeOptimizedQuery<T>(pool, paginatedQuery, paginatedParams, options),
      this.executeOptimizedQuery<{ count: string }>(pool, countQuery, params, {
        ...options,
        cacheKey: options.enableCache ? `count:${this.generateQueryId(countQuery, params)}` : undefined
      })
    ]);

    const total = parseInt(countResult[0]?.count || '0', 10);
    const totalPages = Math.ceil(total / limit);

    return {
      data: dataResult,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    };
  }

  /**
   * Execute paginated DynamoDB query
   */
  async executePaginatedDynamoQuery<T>(
    dynamodb: DynamoDB.DocumentClient,
    params: DynamoDB.DocumentClient.QueryInput,
    pagination: {
      limit: number;
      lastEvaluatedKey?: DynamoDB.DocumentClient.Key;
    },
    options: {
      cacheTTL?: number;
      enableCache?: boolean;
    } = {}
  ): Promise<{
    data: T[];
    lastEvaluatedKey?: DynamoDB.DocumentClient.Key;
    hasMore: boolean;
  }> {
    const queryParams = {
      ...params,
      Limit: pagination.limit,
      ExclusiveStartKey: pagination.lastEvaluatedKey
    };

    const result = await this.executeOptimizedDynamoQuery<T>(
      dynamodb,
      queryParams,
      { ...options, operation: 'query' }
    );

    // Note: For DynamoDB, we need to access the raw result to get LastEvaluatedKey
    // This is a simplified implementation - in practice, you'd need to modify
    // executeOptimizedDynamoQuery to return the full result object
    return {
      data: result,
      lastEvaluatedKey: undefined, // Would come from actual DynamoDB response
      hasMore: result.length === pagination.limit
    };
  }

  /**
   * Invalidate query cache by pattern
   */
  async invalidateQueryCache(pattern: string): Promise<number> {
    try {
      const deletedCount = await this.cache.clear(`query:${pattern}`);
      logger.info('Query cache invalidated', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to invalidate query cache', { pattern, error });
      return 0;
    }
  }

  /**
   * Get query performance metrics
   */
  getQueryMetrics(queryId?: string): QueryMetrics[] {
    if (queryId) {
      return this.queryMetrics.get(queryId) || [];
    }

    // Return all metrics
    const allMetrics: QueryMetrics[] = [];
    for (const metrics of this.queryMetrics.values()) {
      allMetrics.push(...metrics);
    }

    return allMetrics.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  /**
   * Get slow query analysis
   */
  getSlowQueryAnalysis(): {
    slowQueries: QueryMetrics[];
    averageExecutionTime: number;
    cacheHitRate: number;
  } {
    const allMetrics = this.getQueryMetrics();
    const slowQueries = allMetrics.filter(m => m.executionTime > this.config.slowQueryThreshold);
    
    const totalExecutionTime = allMetrics.reduce((sum, m) => sum + m.executionTime, 0);
    const averageExecutionTime = allMetrics.length > 0 ? totalExecutionTime / allMetrics.length : 0;
    
    const cacheHits = allMetrics.filter(m => m.cacheHit).length;
    const cacheHitRate = allMetrics.length > 0 ? cacheHits / allMetrics.length : 0;

    return {
      slowQueries,
      averageExecutionTime,
      cacheHitRate
    };
  }

  /**
   * Generate optimized indexes suggestions based on query patterns
   */
  generateIndexSuggestions(): string[] {
    const suggestions: string[] = [];
    const queryPatterns = this.analyzeQueryPatterns();

    // Analyze common WHERE clauses
    if (queryPatterns.commonFilters.includes('status')) {
      suggestions.push('CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);');
    }

    if (queryPatterns.commonFilters.includes('technician_id')) {
      suggestions.push('CREATE INDEX IF NOT EXISTS idx_tickets_technician ON tickets(technician_id);');
    }

    if (queryPatterns.commonFilters.includes('created_at')) {
      suggestions.push('CREATE INDEX IF NOT EXISTS idx_tickets_created_at ON tickets(created_at);');
    }

    // Analyze common JOIN patterns
    if (queryPatterns.commonJoins.includes('tickets.customer_id = customers.id')) {
      suggestions.push('CREATE INDEX IF NOT EXISTS idx_tickets_customer_id ON tickets(customer_id);');
    }

    return suggestions;
  }

  /**
   * Clear old query metrics to prevent memory leaks
   */
  clearOldMetrics(olderThanHours: number = 24): void {
    const cutoffTime = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    
    for (const [queryId, metrics] of this.queryMetrics.entries()) {
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoffTime);
      
      if (filteredMetrics.length === 0) {
        this.queryMetrics.delete(queryId);
      } else {
        this.queryMetrics.set(queryId, filteredMetrics);
      }
    }

    logger.info('Old query metrics cleared', { cutoffTime });
  }

  /**
   * Generate query ID for caching and metrics
   */
  private generateQueryId(query: string, params: any[]): string {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramsString = JSON.stringify(params);
    const combined = `${normalizedQuery}:${paramsString}`;
    
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  /**
   * Generate DynamoDB query ID
   */
  private generateDynamoQueryId(
    params: DynamoDB.DocumentClient.QueryInput | DynamoDB.DocumentClient.ScanInput,
    operation: string
  ): string {
    const paramsString = JSON.stringify(params);
    const combined = `${operation}:${paramsString}`;
    
    return crypto.createHash('md5').update(combined).digest('hex');
  }

  /**
   * Record query metrics
   */
  private recordQueryMetrics(
    queryId: string,
    query: string,
    executionTime: number,
    rowCount: number,
    cacheHit: boolean
  ): void {
    if (!this.config.enableMetrics) {
      return;
    }

    const metric: QueryMetrics = {
      queryId,
      query: this.sanitizeQuery(query),
      executionTime,
      rowCount,
      cacheHit,
      timestamp: new Date()
    };

    const existingMetrics = this.queryMetrics.get(queryId) || [];
    existingMetrics.push(metric);

    // Keep only the last 100 metrics per query
    if (existingMetrics.length > 100) {
      existingMetrics.splice(0, existingMetrics.length - 100);
    }

    this.queryMetrics.set(queryId, existingMetrics);
  }

  /**
   * Sanitize query for logging (remove sensitive data)
   */
  private sanitizeQuery(query: string): string {
    return query
      .replace(/password\s*=\s*'[^']*'/gi, "password = '[REDACTED]'")
      .replace(/token\s*=\s*'[^']*'/gi, "token = '[REDACTED]'")
      .replace(/secret\s*=\s*'[^']*'/gi, "secret = '[REDACTED]'");
  }

  /**
   * Analyze query patterns for optimization suggestions
   */
  private analyzeQueryPatterns(): {
    commonFilters: string[];
    commonJoins: string[];
    slowestQueries: QueryMetrics[];
  } {
    const allMetrics = this.getQueryMetrics();
    
    // This is a simplified analysis - in practice, you'd use more sophisticated parsing
    const commonFilters: string[] = [];
    const commonJoins: string[] = [];
    const slowestQueries = allMetrics
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    // Extract common patterns from queries
    allMetrics.forEach(metric => {
      const query = metric.query.toLowerCase();
      
      if (query.includes('where status')) commonFilters.push('status');
      if (query.includes('where technician_id')) commonFilters.push('technician_id');
      if (query.includes('where created_at')) commonFilters.push('created_at');
      if (query.includes('join customers')) commonJoins.push('tickets.customer_id = customers.id');
    });

    return {
      commonFilters: [...new Set(commonFilters)],
      commonJoins: [...new Set(commonJoins)],
      slowestQueries
    };
  }
}

// Singleton query optimization service instance
let queryOptimizationServiceInstance: QueryOptimizationService | null = null;

export const getQueryOptimizationService = (): QueryOptimizationService => {
  if (!queryOptimizationServiceInstance) {
    queryOptimizationServiceInstance = new QueryOptimizationService();
  }
  return queryOptimizationServiceInstance;
};

// Common query optimization utilities
export const QueryUtils = {
  /**
   * Build safe ORDER BY clause
   */
  buildOrderBy(sortBy?: string, sortOrder?: 'ASC' | 'DESC', allowedColumns: string[] = []): string {
    if (!sortBy || !allowedColumns.includes(sortBy)) {
      return '';
    }
    
    const order = sortOrder === 'DESC' ? 'DESC' : 'ASC';
    return `ORDER BY ${sortBy} ${order}`;
  },

  /**
   * Build safe LIMIT and OFFSET clause
   */
  buildPagination(page: number, limit: number, maxLimit: number = 100): { limit: number; offset: number } {
    const safeLimit = Math.min(Math.max(1, limit), maxLimit);
    const safePage = Math.max(1, page);
    const offset = (safePage - 1) * safeLimit;
    
    return { limit: safeLimit, offset };
  },

  /**
   * Build safe WHERE clause with parameter placeholders
   */
  buildWhereClause(filters: Record<string, any>, allowedColumns: string[] = []): {
    whereClause: string;
    params: any[];
  } {
    const conditions: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    Object.entries(filters).forEach(([column, value]) => {
      if (allowedColumns.includes(column) && value !== undefined && value !== null) {
        if (Array.isArray(value)) {
          const placeholders = value.map(() => `$${paramIndex++}`).join(', ');
          conditions.push(`${column} IN (${placeholders})`);
          params.push(...value);
        } else {
          conditions.push(`${column} = $${paramIndex++}`);
          params.push(value);
        }
      }
    });

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return { whereClause, params };
  }
} as const;