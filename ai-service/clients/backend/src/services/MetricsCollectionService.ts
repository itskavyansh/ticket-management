import { logger } from '../utils/logger';
import { Pool } from 'pg';
import Redis from 'redis';
import os from 'os';

interface ApplicationMetrics {
  system: SystemMetrics;
  application: AppMetrics;
  business: BusinessMetrics;
  performance: PerformanceMetrics;
}

interface SystemMetrics {
  uptime: number;
  memory: NodeJS.MemoryUsage;
  cpu: NodeJS.CpuUsage;
  loadAverage: number[];
  platform: string;
  nodeVersion: string;
  timestamp: Date;
}

interface AppMetrics {
  activeConnections: number;
  totalRequests: number;
  errorRate: number;
  averageResponseTime: number;
  databaseConnections: number;
  cacheHitRate: number;
  timestamp: Date;
}

interface BusinessMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  averageResolutionTime: number;
  slaComplianceRate: number;
  aiProcessingRate: number;
  timestamp: Date;
}

interface PerformanceMetrics {
  requestsPerSecond: number;
  errorCount: number;
  slowQueries: number;
  cachePerformance: CacheMetrics;
  aiServiceLatency: number;
  timestamp: Date;
}

interface CacheMetrics {
  hits: number;
  misses: number;
  hitRate: number;
  evictions: number;
}

export class MetricsCollectionService {
  private pgPool: Pool;
  private redisClient: any;
  private metricsHistory: Map<string, any[]>;
  private collectionInterval: number = 60000; // 1 minute
  private intervalId: NodeJS.Timeout | null = null;
  private requestCounter: number = 0;
  private errorCounter: number = 0;
  private responseTimeSum: number = 0;
  private responseTimeCount: number = 0;

  constructor() {
    this.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 2
    });

    this.redisClient = Redis.createClient({
      url: process.env.REDIS_URL
    });

    this.metricsHistory = new Map();
    this.startMetricsCollection();
  }

  /**
   * Start automatic metrics collection
   */
  public startMetricsCollection(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    this.intervalId = setInterval(async () => {
      try {
        await this.collectAndStoreMetrics();
      } catch (error) {
        logger.error('Metrics collection failed:', error);
      }
    }, this.collectionInterval);

    logger.info('Metrics collection started');
  }

  /**
   * Stop automatic metrics collection
   */
  public stopMetricsCollection(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Metrics collection stopped');
  }

  /**
   * Get all current metrics
   */
  public async getAllMetrics(): Promise<ApplicationMetrics> {
    const [systemMetrics, appMetrics, businessMetrics, performanceMetrics] = await Promise.all([
      this.getSystemMetrics(),
      this.getApplicationMetrics(),
      this.getBusinessMetrics(),
      this.getPerformanceMetrics()
    ]);

    return {
      system: systemMetrics,
      application: appMetrics,
      business: businessMetrics,
      performance: performanceMetrics
    };
  }

  /**
   * Get system-level metrics
   */
  public async getSystemMetrics(): Promise<SystemMetrics> {
    return {
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      cpu: process.cpuUsage(),
      loadAverage: os.loadavg(),
      platform: os.platform(),
      nodeVersion: process.version,
      timestamp: new Date()
    };
  }

  /**
   * Get application-level metrics
   */
  public async getApplicationMetrics(): Promise<AppMetrics> {
    const databaseConnections = await this.getDatabaseConnectionCount();
    const cacheHitRate = await this.getCacheHitRate();

    return {
      activeConnections: this.getActiveConnectionCount(),
      totalRequests: this.requestCounter,
      errorRate: this.calculateErrorRate(),
      averageResponseTime: this.calculateAverageResponseTime(),
      databaseConnections,
      cacheHitRate,
      timestamp: new Date()
    };
  }

  /**
   * Get business-level metrics
   */
  public async getBusinessMetrics(): Promise<BusinessMetrics> {
    try {
      const ticketMetrics = await this.getTicketMetrics();
      const slaMetrics = await this.getSLAMetrics();
      const aiMetrics = await this.getAIProcessingMetrics();

      return {
        totalTickets: ticketMetrics.total,
        openTickets: ticketMetrics.open,
        resolvedTickets: ticketMetrics.resolved,
        averageResolutionTime: ticketMetrics.averageResolutionTime,
        slaComplianceRate: slaMetrics.complianceRate,
        aiProcessingRate: aiMetrics.processingRate,
        timestamp: new Date()
      };
    } catch (error) {
      logger.error('Failed to collect business metrics:', error);
      return {
        totalTickets: 0,
        openTickets: 0,
        resolvedTickets: 0,
        averageResolutionTime: 0,
        slaComplianceRate: 0,
        aiProcessingRate: 0,
        timestamp: new Date()
      };
    }
  }

  /**
   * Get performance metrics
   */
  public async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const cachePerformance = await this.getCachePerformanceMetrics();
    const aiServiceLatency = await this.getAIServiceLatency();

    return {
      requestsPerSecond: this.calculateRequestsPerSecond(),
      errorCount: this.errorCounter,
      slowQueries: await this.getSlowQueryCount(),
      cachePerformance,
      aiServiceLatency,
      timestamp: new Date()
    };
  }

  /**
   * Get Prometheus-formatted metrics
   */
  public async getPrometheusMetrics(): Promise<string> {
    const metrics = await this.getAllMetrics();
    
    let prometheusOutput = '';

    // System metrics
    prometheusOutput += `# HELP nodejs_process_uptime_seconds Process uptime in seconds\n`;
    prometheusOutput += `# TYPE nodejs_process_uptime_seconds gauge\n`;
    prometheusOutput += `nodejs_process_uptime_seconds ${metrics.system.uptime}\n\n`;

    prometheusOutput += `# HELP nodejs_memory_heap_used_bytes Heap memory used in bytes\n`;
    prometheusOutput += `# TYPE nodejs_memory_heap_used_bytes gauge\n`;
    prometheusOutput += `nodejs_memory_heap_used_bytes ${metrics.system.memory.heapUsed}\n\n`;

    prometheusOutput += `# HELP nodejs_memory_heap_total_bytes Total heap memory in bytes\n`;
    prometheusOutput += `# TYPE nodejs_memory_heap_total_bytes gauge\n`;
    prometheusOutput += `nodejs_memory_heap_total_bytes ${metrics.system.memory.heapTotal}\n\n`;

    // Application metrics
    prometheusOutput += `# HELP app_requests_total Total number of requests\n`;
    prometheusOutput += `# TYPE app_requests_total counter\n`;
    prometheusOutput += `app_requests_total ${metrics.application.totalRequests}\n\n`;

    prometheusOutput += `# HELP app_error_rate Error rate percentage\n`;
    prometheusOutput += `# TYPE app_error_rate gauge\n`;
    prometheusOutput += `app_error_rate ${metrics.application.errorRate}\n\n`;

    prometheusOutput += `# HELP app_response_time_avg Average response time in milliseconds\n`;
    prometheusOutput += `# TYPE app_response_time_avg gauge\n`;
    prometheusOutput += `app_response_time_avg ${metrics.application.averageResponseTime}\n\n`;

    // Business metrics
    prometheusOutput += `# HELP tickets_total Total number of tickets\n`;
    prometheusOutput += `# TYPE tickets_total gauge\n`;
    prometheusOutput += `tickets_total ${metrics.business.totalTickets}\n\n`;

    prometheusOutput += `# HELP tickets_open Number of open tickets\n`;
    prometheusOutput += `# TYPE tickets_open gauge\n`;
    prometheusOutput += `tickets_open ${metrics.business.openTickets}\n\n`;

    prometheusOutput += `# HELP sla_compliance_rate SLA compliance rate percentage\n`;
    prometheusOutput += `# TYPE sla_compliance_rate gauge\n`;
    prometheusOutput += `sla_compliance_rate ${metrics.business.slaComplianceRate}\n\n`;

    prometheusOutput += `# HELP ai_processing_rate AI processing success rate percentage\n`;
    prometheusOutput += `# TYPE ai_processing_rate gauge\n`;
    prometheusOutput += `ai_processing_rate ${metrics.business.aiProcessingRate}\n\n`;

    // Performance metrics
    prometheusOutput += `# HELP requests_per_second Current requests per second\n`;
    prometheusOutput += `# TYPE requests_per_second gauge\n`;
    prometheusOutput += `requests_per_second ${metrics.performance.requestsPerSecond}\n\n`;

    prometheusOutput += `# HELP cache_hit_rate Cache hit rate percentage\n`;
    prometheusOutput += `# TYPE cache_hit_rate gauge\n`;
    prometheusOutput += `cache_hit_rate ${metrics.performance.cachePerformance.hitRate}\n\n`;

    return prometheusOutput;
  }

  /**
   * Record a request for metrics
   */
  public recordRequest(responseTime: number, isError: boolean = false): void {
    this.requestCounter++;
    this.responseTimeSum += responseTime;
    this.responseTimeCount++;
    
    if (isError) {
      this.errorCounter++;
    }
  }

  /**
   * Get metrics collection interval
   */
  public getCollectionInterval(): number {
    return this.collectionInterval;
  }

  /**
   * Set metrics collection interval
   */
  public setCollectionInterval(interval: number): void {
    this.collectionInterval = interval;
    
    if (this.intervalId) {
      this.stopMetricsCollection();
      this.startMetricsCollection();
    }
  }

  /**
   * Get historical metrics
   */
  public getHistoricalMetrics(metricType: string, timeRange: number = 3600000): any[] {
    const history = this.metricsHistory.get(metricType) || [];
    const cutoffTime = Date.now() - timeRange;
    
    return history.filter(metric => metric.timestamp >= cutoffTime);
  }

  // Private helper methods

  private async collectAndStoreMetrics(): Promise<void> {
    const metrics = await this.getAllMetrics();
    
    // Store metrics in history
    this.storeMetricInHistory('system', metrics.system);
    this.storeMetricInHistory('application', metrics.application);
    this.storeMetricInHistory('business', metrics.business);
    this.storeMetricInHistory('performance', metrics.performance);

    // Store in Redis for real-time access
    try {
      await this.redisClient.setex('metrics:current', 300, JSON.stringify(metrics));
    } catch (error) {
      logger.error('Failed to store metrics in Redis:', error);
    }

    // Store in database for long-term analysis
    try {
      await this.storeMetricsInDatabase(metrics);
    } catch (error) {
      logger.error('Failed to store metrics in database:', error);
    }
  }

  private storeMetricInHistory(type: string, metric: any): void {
    if (!this.metricsHistory.has(type)) {
      this.metricsHistory.set(type, []);
    }
    
    const history = this.metricsHistory.get(type)!;
    history.push({ ...metric, timestamp: Date.now() });
    
    // Keep only last 1000 entries
    if (history.length > 1000) {
      history.splice(0, history.length - 1000);
    }
  }

  private async storeMetricsInDatabase(metrics: ApplicationMetrics): Promise<void> {
    const query = `
      INSERT INTO metrics_snapshots (
        timestamp, system_metrics, application_metrics, 
        business_metrics, performance_metrics
      ) VALUES ($1, $2, $3, $4, $5)
    `;
    
    await this.pgPool.query(query, [
      new Date(),
      JSON.stringify(metrics.system),
      JSON.stringify(metrics.application),
      JSON.stringify(metrics.business),
      JSON.stringify(metrics.performance)
    ]);
  }

  private async getDatabaseConnectionCount(): Promise<number> {
    try {
      const result = await this.pgPool.query('SELECT count(*) FROM pg_stat_activity WHERE state = $1', ['active']);
      return parseInt(result.rows[0].count);
    } catch (error) {
      logger.error('Failed to get database connection count:', error);
      return 0;
    }
  }

  private async getCacheHitRate(): Promise<number> {
    try {
      const info = await this.redisClient.info('stats');
      const lines = info.split('\r\n');
      
      let hits = 0;
      let misses = 0;
      
      for (const line of lines) {
        if (line.startsWith('keyspace_hits:')) {
          hits = parseInt(line.split(':')[1]);
        } else if (line.startsWith('keyspace_misses:')) {
          misses = parseInt(line.split(':')[1]);
        }
      }
      
      const total = hits + misses;
      return total > 0 ? (hits / total) * 100 : 0;
    } catch (error) {
      logger.error('Failed to get cache hit rate:', error);
      return 0;
    }
  }

  private getActiveConnectionCount(): number {
    // This would typically be tracked by the HTTP server
    // For now, return a placeholder
    return this.pgPool.totalCount || 0;
  }

  private calculateErrorRate(): number {
    if (this.requestCounter === 0) return 0;
    return (this.errorCounter / this.requestCounter) * 100;
  }

  private calculateAverageResponseTime(): number {
    if (this.responseTimeCount === 0) return 0;
    return this.responseTimeSum / this.responseTimeCount;
  }

  private calculateRequestsPerSecond(): number {
    // Calculate based on recent request history
    const recentRequests = this.getHistoricalMetrics('application', 60000); // Last minute
    return recentRequests.length / 60;
  }

  private async getTicketMetrics(): Promise<{
    total: number;
    open: number;
    resolved: number;
    averageResolutionTime: number;
  }> {
    try {
      const totalResult = await this.pgPool.query('SELECT COUNT(*) FROM tickets');
      const openResult = await this.pgPool.query('SELECT COUNT(*) FROM tickets WHERE status IN ($1, $2)', ['Open', 'In Progress']);
      const resolvedResult = await this.pgPool.query('SELECT COUNT(*) FROM tickets WHERE status = $1', ['Resolved']);
      const avgTimeResult = await this.pgPool.query(`
        SELECT AVG(EXTRACT(EPOCH FROM (resolved_at - created_at))/60) as avg_minutes 
        FROM tickets 
        WHERE resolved_at IS NOT NULL AND created_at IS NOT NULL
      `);

      return {
        total: parseInt(totalResult.rows[0].count),
        open: parseInt(openResult.rows[0].count),
        resolved: parseInt(resolvedResult.rows[0].count),
        averageResolutionTime: parseFloat(avgTimeResult.rows[0].avg_minutes) || 0
      };
    } catch (error) {
      logger.error('Failed to get ticket metrics:', error);
      return { total: 0, open: 0, resolved: 0, averageResolutionTime: 0 };
    }
  }

  private async getSLAMetrics(): Promise<{ complianceRate: number }> {
    try {
      const result = await this.pgPool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN resolved_at <= sla_deadline THEN 1 END) as compliant
        FROM tickets 
        WHERE resolved_at IS NOT NULL AND sla_deadline IS NOT NULL
      `);

      const total = parseInt(result.rows[0].total);
      const compliant = parseInt(result.rows[0].compliant);
      
      return {
        complianceRate: total > 0 ? (compliant / total) * 100 : 0
      };
    } catch (error) {
      logger.error('Failed to get SLA metrics:', error);
      return { complianceRate: 0 };
    }
  }

  private async getAIProcessingMetrics(): Promise<{ processingRate: number }> {
    try {
      const result = await this.pgPool.query(`
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN ai_insights IS NOT NULL THEN 1 END) as processed
        FROM tickets 
        WHERE created_at >= NOW() - INTERVAL '24 hours'
      `);

      const total = parseInt(result.rows[0].total);
      const processed = parseInt(result.rows[0].processed);
      
      return {
        processingRate: total > 0 ? (processed / total) * 100 : 0
      };
    } catch (error) {
      logger.error('Failed to get AI processing metrics:', error);
      return { processingRate: 0 };
    }
  }

  private async getSlowQueryCount(): Promise<number> {
    try {
      const result = await this.pgPool.query(`
        SELECT COUNT(*) 
        FROM pg_stat_statements 
        WHERE mean_time > 1000
      `);
      return parseInt(result.rows[0].count);
    } catch (error) {
      // pg_stat_statements might not be enabled
      return 0;
    }
  }

  private async getCachePerformanceMetrics(): Promise<CacheMetrics> {
    try {
      const info = await this.redisClient.info('stats');
      const lines = info.split('\r\n');
      
      let hits = 0;
      let misses = 0;
      let evictions = 0;
      
      for (const line of lines) {
        if (line.startsWith('keyspace_hits:')) {
          hits = parseInt(line.split(':')[1]);
        } else if (line.startsWith('keyspace_misses:')) {
          misses = parseInt(line.split(':')[1]);
        } else if (line.startsWith('evicted_keys:')) {
          evictions = parseInt(line.split(':')[1]);
        }
      }
      
      const total = hits + misses;
      const hitRate = total > 0 ? (hits / total) * 100 : 0;
      
      return { hits, misses, hitRate, evictions };
    } catch (error) {
      logger.error('Failed to get cache performance metrics:', error);
      return { hits: 0, misses: 0, hitRate: 0, evictions: 0 };
    }
  }

  private async getAIServiceLatency(): Promise<number> {
    try {
      // This would typically be tracked by timing AI service calls
      // For now, return a placeholder based on recent history
      const recentMetrics = this.getHistoricalMetrics('performance', 300000); // Last 5 minutes
      if (recentMetrics.length === 0) return 0;
      
      const avgLatency = recentMetrics.reduce((sum, metric) => sum + (metric.aiServiceLatency || 0), 0) / recentMetrics.length;
      return avgLatency;
    } catch (error) {
      logger.error('Failed to get AI service latency:', error);
      return 0;
    }
  }
}