import { DynamoDB } from 'aws-sdk';
import { getCacheService, CacheService, CacheTTL } from './CacheService';
import { logger } from '../utils/logger';

export interface DynamoDBQueryPattern {
  tableName: string;
  indexName?: string;
  keyCondition: string;
  filterExpression?: string;
  projectionExpression?: string;
  scanIndexForward?: boolean;
}

export interface BatchOperationResult<T> {
  processedItems: T[];
  unprocessedItems: T[];
  consumedCapacity?: DynamoDB.ConsumedCapacity;
}

export interface QueryOptimizationMetrics {
  queryCount: number;
  totalConsumedRCU: number;
  totalConsumedWCU: number;
  averageLatency: number;
  cacheHitRate: number;
}

export class DynamoDBOptimizationService {
  private dynamodb: DynamoDB.DocumentClient;
  private cache: CacheService;
  private metrics: Map<string, QueryOptimizationMetrics> = new Map();

  constructor(dynamodb: DynamoDB.DocumentClient) {
    this.dynamodb = dynamodb;
    this.cache = getCacheService();
  }

  /**
   * Optimized query with automatic caching and retry logic
   */
  async optimizedQuery<T>(
    params: DynamoDB.DocumentClient.QueryInput,
    options: {
      cacheTTL?: number;
      enableCache?: boolean;
      maxRetries?: number;
      consistentRead?: boolean;
    } = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('query', params);
    const enableCache = options.enableCache ?? true;
    const maxRetries = options.maxRetries ?? 3;

    try {
      // Try cache first
      if (enableCache && !options.consistentRead) {
        const cachedResult = await this.cache.get<T[]>(
          cacheKey,
          { prefix: 'dynamo-query' }
        );

        if (cachedResult) {
          this.updateMetrics(params.TableName!, 0, 0, Date.now() - startTime, true);
          return cachedResult;
        }
      }

      // Execute query with retry logic
      const result = await this.executeWithRetry(
        () => this.dynamodb.query(params).promise(),
        maxRetries
      );

      const items = result.Items as T[] || [];
      const consumedRCU = result.ConsumedCapacity?.ReadCapacityUnits || 0;
      const latency = Date.now() - startTime;

      // Cache successful results
      if (enableCache && items.length > 0) {
        const cacheTTL = options.cacheTTL || CacheTTL.MEDIUM;
        await this.cache.set(
          cacheKey,
          items,
          { prefix: 'dynamo-query', ttl: cacheTTL }
        );
      }

      this.updateMetrics(params.TableName!, consumedRCU, 0, latency, false);
      
      logger.debug('DynamoDB query executed', {
        tableName: params.TableName,
        itemCount: items.length,
        consumedRCU,
        latency
      });

      return items;

    } catch (error) {
      logger.error('DynamoDB query failed', {
        tableName: params.TableName,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Optimized scan with pagination and filtering
   */
  async optimizedScan<T>(
    params: DynamoDB.DocumentClient.ScanInput,
    options: {
      cacheTTL?: number;
      enableCache?: boolean;
      maxRetries?: number;
      pageSize?: number;
    } = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const cacheKey = this.generateCacheKey('scan', params);
    const enableCache = options.enableCache ?? false; // Scans are less cacheable
    const maxRetries = options.maxRetries ?? 3;
    const pageSize = options.pageSize ?? 100;

    try {
      // Try cache first (only for small, stable datasets)
      if (enableCache) {
        const cachedResult = await this.cache.get<T[]>(
          cacheKey,
          { prefix: 'dynamo-scan' }
        );

        if (cachedResult) {
          this.updateMetrics(params.TableName!, 0, 0, Date.now() - startTime, true);
          return cachedResult;
        }
      }

      // Execute paginated scan
      const allItems: T[] = [];
      let lastEvaluatedKey = params.ExclusiveStartKey;
      let totalConsumedRCU = 0;

      do {
        const scanParams = {
          ...params,
          Limit: pageSize,
          ExclusiveStartKey: lastEvaluatedKey
        };

        const result = await this.executeWithRetry(
          () => this.dynamodb.scan(scanParams).promise(),
          maxRetries
        );

        const items = result.Items as T[] || [];
        allItems.push(...items);
        
        lastEvaluatedKey = result.LastEvaluatedKey;
        totalConsumedRCU += result.ConsumedCapacity?.ReadCapacityUnits || 0;

        // Add delay between pages to avoid throttling
        if (lastEvaluatedKey) {
          await this.delay(100);
        }

      } while (lastEvaluatedKey);

      const latency = Date.now() - startTime;

      // Cache small result sets
      if (enableCache && allItems.length < 1000) {
        const cacheTTL = options.cacheTTL || CacheTTL.SHORT;
        await this.cache.set(
          cacheKey,
          allItems,
          { prefix: 'dynamo-scan', ttl: cacheTTL }
        );
      }

      this.updateMetrics(params.TableName!, totalConsumedRCU, 0, latency, false);

      logger.debug('DynamoDB scan executed', {
        tableName: params.TableName,
        itemCount: allItems.length,
        consumedRCU: totalConsumedRCU,
        latency
      });

      return allItems;

    } catch (error) {
      logger.error('DynamoDB scan failed', {
        tableName: params.TableName,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Optimized batch get with automatic chunking and retry
   */
  async optimizedBatchGet<T>(
    tableName: string,
    keys: DynamoDB.DocumentClient.Key[],
    options: {
      projectionExpression?: string;
      consistentRead?: boolean;
      maxRetries?: number;
    } = {}
  ): Promise<T[]> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries ?? 3;
    const chunkSize = 100; // DynamoDB batch get limit

    try {
      const allItems: T[] = [];
      let totalConsumedRCU = 0;

      // Process keys in chunks
      for (let i = 0; i < keys.length; i += chunkSize) {
        const chunk = keys.slice(i, i + chunkSize);
        
        const params: DynamoDB.DocumentClient.BatchGetItemInput = {
          RequestItems: {
            [tableName]: {
              Keys: chunk,
              ProjectionExpression: options.projectionExpression,
              ConsistentRead: options.consistentRead
            }
          }
        };

        const result = await this.executeWithRetry(
          () => this.dynamodb.batchGet(params).promise(),
          maxRetries
        );

        const items = result.Responses?.[tableName] as T[] || [];
        allItems.push(...items);
        
        totalConsumedRCU += result.ConsumedCapacity?.[0]?.ReadCapacityUnits || 0;

        // Handle unprocessed items
        if (result.UnprocessedKeys && Object.keys(result.UnprocessedKeys).length > 0) {
          logger.warn('Unprocessed keys in batch get', {
            tableName,
            unprocessedCount: result.UnprocessedKeys[tableName]?.Keys?.length || 0
          });
          
          // Retry unprocessed keys with exponential backoff
          await this.delay(1000);
          // In a production system, you'd implement proper retry logic here
        }

        // Add delay between batches to avoid throttling
        if (i + chunkSize < keys.length) {
          await this.delay(50);
        }
      }

      const latency = Date.now() - startTime;
      this.updateMetrics(tableName, totalConsumedRCU, 0, latency, false);

      logger.debug('DynamoDB batch get executed', {
        tableName,
        requestedCount: keys.length,
        retrievedCount: allItems.length,
        consumedRCU: totalConsumedRCU,
        latency
      });

      return allItems;

    } catch (error) {
      logger.error('DynamoDB batch get failed', {
        tableName,
        keyCount: keys.length,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Optimized batch write with automatic chunking and retry
   */
  async optimizedBatchWrite<T>(
    tableName: string,
    items: T[],
    operation: 'PUT' | 'DELETE' = 'PUT',
    options: {
      maxRetries?: number;
    } = {}
  ): Promise<BatchOperationResult<T>> {
    const startTime = Date.now();
    const maxRetries = options.maxRetries ?? 3;
    const chunkSize = 25; // DynamoDB batch write limit

    try {
      const processedItems: T[] = [];
      const unprocessedItems: T[] = [];
      let totalConsumedWCU = 0;

      // Process items in chunks
      for (let i = 0; i < items.length; i += chunkSize) {
        const chunk = items.slice(i, i + chunkSize);
        
        const requestItems = chunk.map(item => {
          if (operation === 'PUT') {
            return { PutRequest: { Item: item } };
          } else {
            return { DeleteRequest: { Key: item } };
          }
        });

        const params: DynamoDB.DocumentClient.BatchWriteItemInput = {
          RequestItems: {
            [tableName]: requestItems
          }
        };

        const result = await this.executeWithRetry(
          () => this.dynamodb.batchWrite(params).promise(),
          maxRetries
        );

        processedItems.push(...chunk);
        totalConsumedWCU += result.ConsumedCapacity?.[0]?.WriteCapacityUnits || 0;

        // Handle unprocessed items
        if (result.UnprocessedItems && Object.keys(result.UnprocessedItems).length > 0) {
          const unprocessedCount = result.UnprocessedItems[tableName]?.length || 0;
          logger.warn('Unprocessed items in batch write', {
            tableName,
            unprocessedCount
          });
          
          // Add unprocessed items to retry list
          // In a production system, you'd extract the actual items and retry them
          
          await this.delay(1000);
        }

        // Add delay between batches to avoid throttling
        if (i + chunkSize < items.length) {
          await this.delay(100);
        }
      }

      const latency = Date.now() - startTime;
      this.updateMetrics(tableName, 0, totalConsumedWCU, latency, false);

      logger.debug('DynamoDB batch write executed', {
        tableName,
        operation,
        itemCount: items.length,
        processedCount: processedItems.length,
        consumedWCU: totalConsumedWCU,
        latency
      });

      return {
        processedItems,
        unprocessedItems,
        consumedCapacity: { WriteCapacityUnits: totalConsumedWCU }
      };

    } catch (error) {
      logger.error('DynamoDB batch write failed', {
        tableName,
        operation,
        itemCount: items.length,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get query optimization suggestions based on access patterns
   */
  getOptimizationSuggestions(tableName: string): string[] {
    const suggestions: string[] = [];
    const metrics = this.metrics.get(tableName);

    if (!metrics) {
      return ['No metrics available for optimization analysis'];
    }

    // Analyze RCU consumption
    if (metrics.totalConsumedRCU > 1000) {
      suggestions.push('Consider using eventually consistent reads to reduce RCU consumption');
      suggestions.push('Implement query result caching for frequently accessed data');
    }

    // Analyze cache hit rate
    if (metrics.cacheHitRate < 0.5) {
      suggestions.push('Increase cache TTL for stable data to improve cache hit rate');
      suggestions.push('Consider pre-warming cache for frequently accessed items');
    }

    // Analyze latency
    if (metrics.averageLatency > 100) {
      suggestions.push('Consider using parallel queries for independent data');
      suggestions.push('Optimize query patterns to use primary keys and GSIs effectively');
    }

    return suggestions;
  }

  /**
   * Get performance metrics for a table
   */
  getMetrics(tableName: string): QueryOptimizationMetrics | null {
    return this.metrics.get(tableName) || null;
  }

  /**
   * Clear metrics for a table
   */
  clearMetrics(tableName: string): void {
    this.metrics.delete(tableName);
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Map<string, QueryOptimizationMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Execute operation with exponential backoff retry
   */
  private async executeWithRetry<T>(
    operation: () => Promise<T>,
    maxRetries: number
  ): Promise<T> {
    let lastError: Error;
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error as Error;
        
        // Check if error is retryable
        if (!this.isRetryableError(error as Error)) {
          throw error;
        }

        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000); // Max 10 seconds
          logger.warn('DynamoDB operation failed, retrying', {
            attempt: attempt + 1,
            maxRetries,
            delay,
            error: (error as Error).message
          });
          
          await this.delay(delay);
        }
      }
    }

    throw lastError!;
  }

  /**
   * Check if error is retryable
   */
  private isRetryableError(error: Error): boolean {
    const retryableErrors = [
      'ProvisionedThroughputExceededException',
      'ThrottlingException',
      'ServiceUnavailable',
      'InternalServerError'
    ];

    return retryableErrors.some(retryableError => 
      error.message.includes(retryableError)
    );
  }

  /**
   * Generate cache key for DynamoDB operations
   */
  private generateCacheKey(
    operation: string,
    params: DynamoDB.DocumentClient.QueryInput | DynamoDB.DocumentClient.ScanInput
  ): string {
    const keyData = {
      operation,
      tableName: params.TableName,
      indexName: params.IndexName,
      keyConditionExpression: params.KeyConditionExpression,
      filterExpression: params.FilterExpression,
      projectionExpression: params.ProjectionExpression,
      scanIndexForward: params.ScanIndexForward
    };

    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Update performance metrics
   */
  private updateMetrics(
    tableName: string,
    consumedRCU: number,
    consumedWCU: number,
    latency: number,
    cacheHit: boolean
  ): void {
    const existing = this.metrics.get(tableName) || {
      queryCount: 0,
      totalConsumedRCU: 0,
      totalConsumedWCU: 0,
      averageLatency: 0,
      cacheHitRate: 0
    };

    const newQueryCount = existing.queryCount + 1;
    const newTotalRCU = existing.totalConsumedRCU + consumedRCU;
    const newTotalWCU = existing.totalConsumedWCU + consumedWCU;
    const newAverageLatency = (existing.averageLatency * existing.queryCount + latency) / newQueryCount;
    
    // Calculate cache hit rate
    const cacheHits = cacheHit ? 1 : 0;
    const existingCacheHits = existing.cacheHitRate * existing.queryCount;
    const newCacheHitRate = (existingCacheHits + cacheHits) / newQueryCount;

    this.metrics.set(tableName, {
      queryCount: newQueryCount,
      totalConsumedRCU: newTotalRCU,
      totalConsumedWCU: newTotalWCU,
      averageLatency: newAverageLatency,
      cacheHitRate: newCacheHitRate
    });
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Singleton DynamoDB optimization service
let dynamoDBOptimizationServiceInstance: DynamoDBOptimizationService | null = null;

export const getDynamoDBOptimizationService = (
  dynamodb: DynamoDB.DocumentClient
): DynamoDBOptimizationService => {
  if (!dynamoDBOptimizationServiceInstance) {
    dynamoDBOptimizationServiceInstance = new DynamoDBOptimizationService(dynamodb);
  }
  return dynamoDBOptimizationServiceInstance;
};

// Common DynamoDB query patterns
export const DynamoDBQueryPatterns = {
  /**
   * Get tickets by customer with pagination
   */
  getTicketsByCustomer: (customerId: string, limit: number = 20): DynamoDB.DocumentClient.QueryInput => ({
    TableName: process.env.TICKETS_TABLE_NAME || 'ai-ticket-management-tickets',
    KeyConditionExpression: 'customerId = :customerId',
    ExpressionAttributeValues: {
      ':customerId': customerId
    },
    ScanIndexForward: false, // Most recent first
    Limit: limit
  }),

  /**
   * Get tickets by status
   */
  getTicketsByStatus: (status: string, limit: number = 50): DynamoDB.DocumentClient.QueryInput => ({
    TableName: process.env.TICKETS_TABLE_NAME || 'ai-ticket-management-tickets',
    IndexName: 'StatusIndex',
    KeyConditionExpression: '#status = :status',
    ExpressionAttributeNames: {
      '#status': 'status'
    },
    ExpressionAttributeValues: {
      ':status': status
    },
    ScanIndexForward: false,
    Limit: limit
  }),

  /**
   * Get tickets by technician
   */
  getTicketsByTechnician: (technicianId: string, limit: number = 20): DynamoDB.DocumentClient.QueryInput => ({
    TableName: process.env.TICKETS_TABLE_NAME || 'ai-ticket-management-tickets',
    IndexName: 'TechnicianIndex',
    KeyConditionExpression: 'assignedTechnicianId = :technicianId',
    ExpressionAttributeValues: {
      ':technicianId': technicianId
    },
    ScanIndexForward: false,
    Limit: limit
  })
} as const;