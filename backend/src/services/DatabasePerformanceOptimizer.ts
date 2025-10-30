/**
 * Database Performance Optimizer
 * Analyzes query patterns, optimizes indexes, and provides performance recommendations
 */

import { Pool, PoolClient } from 'pg';
import { DynamoDB } from 'aws-sdk';
import { getCacheService, CacheService, CacheTTL } from './CacheService';
import { getQueryOptimizationService, QueryOptimizationService } from './QueryOptimizationService';
import { logger } from '../utils/logger';

export interface QueryAnalysis {
  queryId: string;
  query: string;
  executionCount: number;
  totalExecutionTime: number;
  averageExecutionTime: number;
  slowestExecution: number;
  fastestExecution: number;
  lastExecuted: Date;
  indexSuggestions: string[];
  optimizationRecommendations: string[];
}

export interface IndexRecommendation {
  tableName: string;
  columnNames: string[];
  indexType: 'btree' | 'hash' | 'gin' | 'gist';
  estimatedImpact: 'high' | 'medium' | 'low';
  createStatement: string;
  reasoning: string;
}

export interface PerformanceOptimizationReport {
  timestamp: Date;
  databaseType: 'postgresql' | 'dynamodb';
  overallHealth: 'excellent' | 'good' | 'fair' | 'poor';
  slowQueries: QueryAnalysis[];
  indexRecommendations: IndexRecommendation[];
  cacheOptimizations: string[];
  connectionPoolOptimizations: string[];
  generalRecommendations: string[];
  metrics: {
    averageQueryTime: number;
    slowQueryCount: number;
    cacheHitRate: number;
    connectionPoolUtilization: number;
  };
}

export class DatabasePerformanceOptimizer {
  private cache: CacheService;
  private queryOptimizer: QueryOptimizationService;
  private queryAnalytics: Map<string, QueryAnalysis> = new Map();
  private performanceHistory: PerformanceOptimizationReport[] = [];

  constructor() {
    this.cache = getCacheService();
    this.queryOptimizer = getQueryOptimizationService();
  }

  /**
   * Analyze PostgreSQL performance and provide optimization recommendations
   */
  async analyzePostgreSQLPerformance(pool: Pool): Promise<PerformanceOptimizationReport> {
    logger.info('Starting PostgreSQL performance analysis');

    const report: PerformanceOptimizationReport = {
      timestamp: new Date(),
      databaseType: 'postgresql',
      overallHealth: 'good',
      slowQueries: [],
      indexRecommendations: [],
      cacheOptimizations: [],
      connectionPoolOptimizations: [],
      generalRecommendations: [],
      metrics: {
        averageQueryTime: 0,
        slowQueryCount: 0,
        cacheHitRate: 0,
        connectionPoolUtilization: 0
      }
    };

    try {
      // Analyze slow queries
      const slowQueries = await this.analyzeSlowQueries(pool);
      report.slowQueries = slowQueries;
      report.metrics.slowQueryCount = slowQueries.length;

      // Generate index recommendations
      const indexRecommendations = await this.generateIndexRecommendations(pool, slowQueries);
      report.indexRecommendations = indexRecommendations;

      // Analyze connection pool performance
      const poolMetrics = await this.analyzeConnectionPool(pool);
      report.connectionPoolOptimizations = this.generateConnectionPoolOptimizations(poolMetrics);
      report.metrics.connectionPoolUtilization = poolMetrics.utilizationRate;

      // Analyze cache performance
      const cacheMetrics = await this.analyzeCachePerformance();
      report.cacheOptimizations = this.generateCacheOptimizations(cacheMetrics);
      report.metrics.cacheHitRate = cacheMetrics.hitRate;

      // Calculate overall metrics
      report.metrics.averageQueryTime = this.calculateAverageQueryTime();

      // Determine overall health
      report.overallHealth = this.determineOverallHealth(report.metrics);

      // Generate general recommendations
      report.generalRecommendations = this.generateGeneralRecommendations(report);

      // Store in history
      this.performanceHistory.push(report);
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100);
      }

      logger.info('PostgreSQL performance analysis completed', {
        overallHealth: report.overallHealth,
        slowQueryCount: report.metrics.slowQueryCount,
        indexRecommendations: report.indexRecommendations.length
      });

      return report;

    } catch (error) {
      logger.error('PostgreSQL performance analysis failed', { error });
      throw error;
    }
  }

  /**
   * Analyze DynamoDB performance and provide optimization recommendations
   */
  async analyzeDynamoDBPerformance(dynamodb: DynamoDB.DocumentClient): Promise<PerformanceOptimizationReport> {
    logger.info('Starting DynamoDB performance analysis');

    const report: PerformanceOptimizationReport = {
      timestamp: new Date(),
      databaseType: 'dynamodb',
      overallHealth: 'good',
      slowQueries: [],
      indexRecommendations: [],
      cacheOptimizations: [],
      connectionPoolOptimizations: [],
      generalRecommendations: [],
      metrics: {
        averageQueryTime: 0,
        slowQueryCount: 0,
        cacheHitRate: 0,
        connectionPoolUtilization: 0
      }
    };

    try {
      // Analyze DynamoDB access patterns
      const accessPatterns = await this.analyzeDynamoDBAccessPatterns();
      
      // Generate GSI recommendations
      const gsiRecommendations = this.generateGSIRecommendations(accessPatterns);
      report.indexRecommendations = gsiRecommendations;

      // Analyze capacity utilization
      const capacityMetrics = await this.analyzeDynamoDBCapacity();
      report.generalRecommendations.push(...this.generateCapacityRecommendations(capacityMetrics));

      // Analyze cache performance
      const cacheMetrics = await this.analyzeCachePerformance();
      report.cacheOptimizations = this.generateCacheOptimizations(cacheMetrics);
      report.metrics.cacheHitRate = cacheMetrics.hitRate;

      // Calculate metrics
      report.metrics.averageQueryTime = this.calculateAverageQueryTime();
      report.overallHealth = this.determineOverallHealth(report.metrics);

      this.performanceHistory.push(report);
      if (this.performanceHistory.length > 100) {
        this.performanceHistory = this.performanceHistory.slice(-100);
      }

      logger.info('DynamoDB performance analysis completed', {
        overallHealth: report.overallHealth,
        gsiRecommendations: report.indexRecommendations.length
      });

      return report;

    } catch (error) {
      logger.error('DynamoDB performance analysis failed', { error });
      throw error;
    }
  }

  /**
   * Automatically optimize database performance
   */
  async autoOptimizePerformance(
    pool?: Pool,
    dynamodb?: DynamoDB.DocumentClient,
    options: {
      createIndexes?: boolean;
      optimizeCache?: boolean;
      adjustConnectionPool?: boolean;
    } = {}
  ): Promise<{
    optimizationsApplied: string[];
    errors: string[];
  }> {
    const optimizationsApplied: string[] = [];
    const errors: string[] = [];

    try {
      // PostgreSQL optimizations
      if (pool) {
        const pgReport = await this.analyzePostgreSQLPerformance(pool);
        
        if (options.createIndexes && pgReport.indexRecommendations.length > 0) {
          for (const recommendation of pgReport.indexRecommendations) {
            if (recommendation.estimatedImpact === 'high') {
              try {
                await pool.query(recommendation.createStatement);
                optimizationsApplied.push(`Created index: ${recommendation.createStatement}`);
                logger.info('Auto-created database index', { statement: recommendation.createStatement });
              } catch (error) {
                const errorMsg = `Failed to create index: ${(error as Error).message}`;
                errors.push(errorMsg);
                logger.error('Failed to auto-create index', { error, statement: recommendation.createStatement });
              }
            }
          }
        }
      }

      // Cache optimizations
      if (options.optimizeCache) {
        const cacheOptimizations = await this.applyCacheOptimizations();
        optimizationsApplied.push(...cacheOptimizations);
      }

      // Connection pool optimizations
      if (options.adjustConnectionPool && pool) {
        const poolOptimizations = await this.applyConnectionPoolOptimizations(pool);
        optimizationsApplied.push(...poolOptimizations);
      }

      logger.info('Auto-optimization completed', {
        optimizationsApplied: optimizationsApplied.length,
        errors: errors.length
      });

      return { optimizationsApplied, errors };

    } catch (error) {
      logger.error('Auto-optimization failed', { error });
      errors.push(`Auto-optimization failed: ${(error as Error).message}`);
      return { optimizationsApplied, errors };
    }
  }

  /**
   * Get performance trends over time
   */
  getPerformanceTrends(hours: number = 24): {
    queryTimesTrend: Array<{ timestamp: Date; avgTime: number }>;
    cacheHitRateTrend: Array<{ timestamp: Date; hitRate: number }>;
    slowQueryTrend: Array<{ timestamp: Date; count: number }>;
    recommendations: string[];
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const recentReports = this.performanceHistory.filter(r => r.timestamp > cutoff);

    const queryTimesTrend = recentReports.map(r => ({
      timestamp: r.timestamp,
      avgTime: r.metrics.averageQueryTime
    }));

    const cacheHitRateTrend = recentReports.map(r => ({
      timestamp: r.timestamp,
      hitRate: r.metrics.cacheHitRate
    }));

    const slowQueryTrend = recentReports.map(r => ({
      timestamp: r.timestamp,
      count: r.metrics.slowQueryCount
    }));

    const recommendations = this.generateTrendBasedRecommendations(recentReports);

    return {
      queryTimesTrend,
      cacheHitRateTrend,
      slowQueryTrend,
      recommendations
    };
  }

  /**
   * Record query execution for analysis
   */
  recordQueryExecution(queryId: string, query: string, executionTime: number): void {
    const existing = this.queryAnalytics.get(queryId);
    
    if (existing) {
      existing.executionCount++;
      existing.totalExecutionTime += executionTime;
      existing.averageExecutionTime = existing.totalExecutionTime / existing.executionCount;
      existing.slowestExecution = Math.max(existing.slowestExecution, executionTime);
      existing.fastestExecution = Math.min(existing.fastestExecution, executionTime);
      existing.lastExecuted = new Date();
    } else {
      this.queryAnalytics.set(queryId, {
        queryId,
        query,
        executionCount: 1,
        totalExecutionTime: executionTime,
        averageExecutionTime: executionTime,
        slowestExecution: executionTime,
        fastestExecution: executionTime,
        lastExecuted: new Date(),
        indexSuggestions: [],
        optimizationRecommendations: []
      });
    }
  }

  /**
   * Get query performance statistics
   */
  getQueryStatistics(): {
    totalQueries: number;
    uniqueQueries: number;
    averageExecutionTime: number;
    slowestQueries: QueryAnalysis[];
    mostFrequentQueries: QueryAnalysis[];
  } {
    const allQueries = Array.from(this.queryAnalytics.values());
    
    const totalExecutionTime = allQueries.reduce((sum, q) => sum + q.totalExecutionTime, 0);
    const totalExecutions = allQueries.reduce((sum, q) => sum + q.executionCount, 0);

    return {
      totalQueries: totalExecutions,
      uniqueQueries: allQueries.length,
      averageExecutionTime: totalExecutions > 0 ? totalExecutionTime / totalExecutions : 0,
      slowestQueries: allQueries
        .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
        .slice(0, 10),
      mostFrequentQueries: allQueries
        .sort((a, b) => b.executionCount - a.executionCount)
        .slice(0, 10)
    };
  }

  // Private helper methods

  private async analyzeSlowQueries(pool: Pool): Promise<QueryAnalysis[]> {
    try {
      // Get slow queries from pg_stat_statements if available
      const slowQueriesQuery = `
        SELECT 
          query,
          calls,
          total_time,
          mean_time,
          max_time,
          min_time
        FROM pg_stat_statements 
        WHERE mean_time > 100 
        ORDER BY mean_time DESC 
        LIMIT 20
      `;

      const result = await pool.query(slowQueriesQuery);
      
      return result.rows.map(row => ({
        queryId: this.generateQueryId(row.query),
        query: row.query,
        executionCount: row.calls,
        totalExecutionTime: row.total_time,
        averageExecutionTime: row.mean_time,
        slowestExecution: row.max_time,
        fastestExecution: row.min_time,
        lastExecuted: new Date(),
        indexSuggestions: this.generateIndexSuggestionsForQuery(row.query),
        optimizationRecommendations: this.generateQueryOptimizationRecommendations(row.query, row.mean_time)
      }));

    } catch (error) {
      // Fallback to internal analytics if pg_stat_statements is not available
      logger.warn('pg_stat_statements not available, using internal analytics');
      
      return Array.from(this.queryAnalytics.values())
        .filter(q => q.averageExecutionTime > 100)
        .sort((a, b) => b.averageExecutionTime - a.averageExecutionTime)
        .slice(0, 20);
    }
  }

  private async generateIndexRecommendations(pool: Pool, slowQueries: QueryAnalysis[]): Promise<IndexRecommendation[]> {
    const recommendations: IndexRecommendation[] = [];

    // Analyze table usage patterns
    const tableUsageQuery = `
      SELECT 
        schemaname,
        tablename,
        seq_scan,
        seq_tup_read,
        idx_scan,
        idx_tup_fetch
      FROM pg_stat_user_tables
      WHERE seq_scan > idx_scan * 2
      ORDER BY seq_tup_read DESC
      LIMIT 10
    `;

    try {
      const result = await pool.query(tableUsageQuery);
      
      for (const row of result.rows) {
        if (row.seq_tup_read > 10000) { // High sequential scan volume
          recommendations.push({
            tableName: row.tablename,
            columnNames: ['id'], // Default recommendation
            indexType: 'btree',
            estimatedImpact: 'high',
            createStatement: `CREATE INDEX CONCURRENTLY idx_${row.tablename}_id ON ${row.tablename}(id);`,
            reasoning: `Table ${row.tablename} has high sequential scan volume (${row.seq_tup_read} tuples)`
          });
        }
      }

      // Analyze slow queries for specific index opportunities
      for (const query of slowQueries) {
        const queryRecommendations = this.analyzeQueryForIndexes(query);
        recommendations.push(...queryRecommendations);
      }

    } catch (error) {
      logger.error('Failed to generate index recommendations', { error });
    }

    return recommendations;
  }

  private analyzeQueryForIndexes(query: QueryAnalysis): IndexRecommendation[] {
    const recommendations: IndexRecommendation[] = [];
    const queryText = query.query.toLowerCase();

    // Look for common patterns that benefit from indexes
    const wherePatterns = [
      { pattern: /where\s+(\w+)\s*=/, column: 1, type: 'btree' as const },
      { pattern: /where\s+(\w+)\s+in\s*\(/, column: 1, type: 'btree' as const },
      { pattern: /order\s+by\s+(\w+)/, column: 1, type: 'btree' as const },
      { pattern: /group\s+by\s+(\w+)/, column: 1, type: 'btree' as const }
    ];

    for (const pattern of wherePatterns) {
      const match = queryText.match(pattern.pattern);
      if (match && match[pattern.column]) {
        const columnName = match[pattern.column];
        
        // Extract table name (simplified)
        const tableMatch = queryText.match(/from\s+(\w+)/);
        const tableName = tableMatch ? tableMatch[1] : 'unknown_table';

        if (tableName !== 'unknown_table') {
          recommendations.push({
            tableName,
            columnNames: [columnName],
            indexType: pattern.type,
            estimatedImpact: query.averageExecutionTime > 500 ? 'high' : 'medium',
            createStatement: `CREATE INDEX CONCURRENTLY idx_${tableName}_${columnName} ON ${tableName}(${columnName});`,
            reasoning: `Query uses ${columnName} in WHERE/ORDER BY clause with ${query.averageExecutionTime.toFixed(2)}ms average execution time`
          });
        }
      }
    }

    return recommendations;
  }

  private async analyzeConnectionPool(pool: Pool): Promise<{
    totalConnections: number;
    activeConnections: number;
    idleConnections: number;
    utilizationRate: number;
    waitingClients: number;
  }> {
    try {
      const statsQuery = `
        SELECT 
          count(*) as total_connections,
          count(*) FILTER (WHERE state = 'active') as active_connections,
          count(*) FILTER (WHERE state = 'idle') as idle_connections
        FROM pg_stat_activity 
        WHERE datname = current_database()
      `;

      const result = await pool.query(statsQuery);
      const stats = result.rows[0];

      return {
        totalConnections: parseInt(stats.total_connections),
        activeConnections: parseInt(stats.active_connections),
        idleConnections: parseInt(stats.idle_connections),
        utilizationRate: stats.total_connections > 0 ? 
          (stats.active_connections / stats.total_connections) * 100 : 0,
        waitingClients: 0 // Would need to be tracked separately
      };

    } catch (error) {
      logger.error('Failed to analyze connection pool', { error });
      return {
        totalConnections: 0,
        activeConnections: 0,
        idleConnections: 0,
        utilizationRate: 0,
        waitingClients: 0
      };
    }
  }

  private async analyzeCachePerformance(): Promise<{
    hitRate: number;
    missRate: number;
    totalRequests: number;
    averageResponseTime: number;
  }> {
    const cacheStats = this.cache.getStats();
    const totalRequests = cacheStats.hits + cacheStats.misses;

    return {
      hitRate: totalRequests > 0 ? cacheStats.hits / totalRequests : 0,
      missRate: totalRequests > 0 ? cacheStats.misses / totalRequests : 0,
      totalRequests,
      averageResponseTime: 5 // Estimated cache response time
    };
  }

  private generateConnectionPoolOptimizations(poolMetrics: any): string[] {
    const optimizations: string[] = [];

    if (poolMetrics.utilizationRate > 80) {
      optimizations.push('Consider increasing connection pool size - current utilization is high');
    }

    if (poolMetrics.utilizationRate < 20) {
      optimizations.push('Consider reducing connection pool size - current utilization is low');
    }

    if (poolMetrics.waitingClients > 0) {
      optimizations.push('Clients are waiting for connections - increase pool size or optimize query performance');
    }

    return optimizations;
  }

  private generateCacheOptimizations(cacheMetrics: any): string[] {
    const optimizations: string[] = [];

    if (cacheMetrics.hitRate < 0.6) {
      optimizations.push('Cache hit rate is low - consider increasing TTL for stable data');
      optimizations.push('Review caching strategy for frequently accessed endpoints');
    }

    if (cacheMetrics.hitRate > 0.95) {
      optimizations.push('Excellent cache performance - consider caching additional endpoints');
    }

    return optimizations;
  }

  private calculateAverageQueryTime(): number {
    const allQueries = Array.from(this.queryAnalytics.values());
    if (allQueries.length === 0) return 0;

    const totalTime = allQueries.reduce((sum, q) => sum + q.totalExecutionTime, 0);
    const totalExecutions = allQueries.reduce((sum, q) => sum + q.executionCount, 0);

    return totalExecutions > 0 ? totalTime / totalExecutions : 0;
  }

  private determineOverallHealth(metrics: any): 'excellent' | 'good' | 'fair' | 'poor' {
    let score = 0;

    // Query performance (40% weight)
    if (metrics.averageQueryTime < 100) score += 40;
    else if (metrics.averageQueryTime < 300) score += 30;
    else if (metrics.averageQueryTime < 500) score += 20;
    else score += 10;

    // Cache performance (30% weight)
    if (metrics.cacheHitRate > 0.8) score += 30;
    else if (metrics.cacheHitRate > 0.6) score += 20;
    else if (metrics.cacheHitRate > 0.4) score += 10;
    else score += 5;

    // Slow query count (30% weight)
    if (metrics.slowQueryCount === 0) score += 30;
    else if (metrics.slowQueryCount < 5) score += 20;
    else if (metrics.slowQueryCount < 10) score += 10;
    else score += 5;

    if (score >= 85) return 'excellent';
    if (score >= 70) return 'good';
    if (score >= 50) return 'fair';
    return 'poor';
  }

  private generateGeneralRecommendations(report: PerformanceOptimizationReport): string[] {
    const recommendations: string[] = [];

    if (report.metrics.averageQueryTime > 200) {
      recommendations.push('Average query time is high - review slow queries and consider indexing');
    }

    if (report.metrics.slowQueryCount > 5) {
      recommendations.push('Multiple slow queries detected - prioritize optimization of most frequent queries');
    }

    if (report.metrics.cacheHitRate < 0.5) {
      recommendations.push('Low cache hit rate - review caching strategy and TTL settings');
    }

    if (report.indexRecommendations.length > 0) {
      recommendations.push(`${report.indexRecommendations.length} index recommendations available - review and implement high-impact indexes`);
    }

    return recommendations;
  }

  private async analyzeDynamoDBAccessPatterns(): Promise<any[]> {
    // This would analyze DynamoDB CloudWatch metrics and access patterns
    // For now, return mock data
    return [
      { tableName: 'tickets', accessPattern: 'query_by_customer', frequency: 1000 },
      { tableName: 'tickets', accessPattern: 'query_by_status', frequency: 800 },
      { tableName: 'technicians', accessPattern: 'query_by_skill', frequency: 200 }
    ];
  }

  private generateGSIRecommendations(accessPatterns: any[]): IndexRecommendation[] {
    return accessPatterns
      .filter(pattern => pattern.frequency > 500)
      .map(pattern => ({
        tableName: pattern.tableName,
        columnNames: [pattern.accessPattern.split('_by_')[1]],
        indexType: 'btree' as const,
        estimatedImpact: pattern.frequency > 1000 ? 'high' as const : 'medium' as const,
        createStatement: `Create GSI for ${pattern.tableName} on ${pattern.accessPattern}`,
        reasoning: `High frequency access pattern: ${pattern.frequency} requests`
      }));
  }

  private async analyzeDynamoDBCapacity(): Promise<any> {
    // Mock capacity analysis
    return {
      readCapacityUtilization: 65,
      writeCapacityUtilization: 45,
      throttledRequests: 0
    };
  }

  private generateCapacityRecommendations(capacityMetrics: any): string[] {
    const recommendations: string[] = [];

    if (capacityMetrics.readCapacityUtilization > 80) {
      recommendations.push('Read capacity utilization is high - consider increasing provisioned capacity or using auto-scaling');
    }

    if (capacityMetrics.writeCapacityUtilization > 80) {
      recommendations.push('Write capacity utilization is high - consider increasing provisioned capacity');
    }

    if (capacityMetrics.throttledRequests > 0) {
      recommendations.push('Throttled requests detected - increase capacity or implement exponential backoff');
    }

    return recommendations;
  }

  private async applyCacheOptimizations(): Promise<string[]> {
    const optimizations: string[] = [];
    
    // Clear old cache entries
    const cleared = await this.cache.clear('old:*');
    if (cleared > 0) {
      optimizations.push(`Cleared ${cleared} old cache entries`);
    }

    return optimizations;
  }

  private async applyConnectionPoolOptimizations(pool: Pool): Promise<string[]> {
    const optimizations: string[] = [];
    
    // This would adjust pool settings dynamically
    // For now, just return recommendations
    optimizations.push('Connection pool settings reviewed');
    
    return optimizations;
  }

  private generateTrendBasedRecommendations(reports: PerformanceOptimizationReport[]): string[] {
    const recommendations: string[] = [];

    if (reports.length < 2) return recommendations;

    const latest = reports[reports.length - 1];
    const previous = reports[reports.length - 2];

    // Trend analysis
    if (latest.metrics.averageQueryTime > previous.metrics.averageQueryTime * 1.2) {
      recommendations.push('Query performance is degrading - investigate recent changes');
    }

    if (latest.metrics.cacheHitRate < previous.metrics.cacheHitRate * 0.8) {
      recommendations.push('Cache hit rate is declining - review cache invalidation strategy');
    }

    return recommendations;
  }

  private generateQueryId(query: string): string {
    return Buffer.from(query).toString('base64').substring(0, 16);
  }

  private generateIndexSuggestionsForQuery(query: string): string[] {
    // Simplified index suggestion logic
    const suggestions: string[] = [];
    const lowerQuery = query.toLowerCase();

    if (lowerQuery.includes('where') && lowerQuery.includes('=')) {
      suggestions.push('Consider adding B-tree index on WHERE clause columns');
    }

    if (lowerQuery.includes('order by')) {
      suggestions.push('Consider adding index on ORDER BY columns');
    }

    return suggestions;
  }

  private generateQueryOptimizationRecommendations(query: string, executionTime: number): string[] {
    const recommendations: string[] = [];

    if (executionTime > 1000) {
      recommendations.push('Query execution time is very high - consider query rewrite');
    }

    if (query.toLowerCase().includes('select *')) {
      recommendations.push('Avoid SELECT * - specify only needed columns');
    }

    if (query.toLowerCase().includes('like %')) {
      recommendations.push('Leading wildcard LIKE queries are slow - consider full-text search');
    }

    return recommendations;
  }
}

// Singleton instance
let databasePerformanceOptimizerInstance: DatabasePerformanceOptimizer | null = null;

export const getDatabasePerformanceOptimizer = (): DatabasePerformanceOptimizer => {
  if (!databasePerformanceOptimizerInstance) {
    databasePerformanceOptimizerInstance = new DatabasePerformanceOptimizer();
  }
  return databasePerformanceOptimizerInstance;
};