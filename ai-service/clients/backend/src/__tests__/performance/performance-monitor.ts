/**
 * Performance Monitoring Utilities
 * Provides real-time performance monitoring and optimization recommendations
 */

import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

export interface PerformanceMetrics {
  timestamp: number;
  endpoint: string;
  method: string;
  responseTime: number;
  statusCode: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  activeConnections: number;
  cacheHitRate?: number;
}

export interface PerformanceThresholds {
  responseTime: {
    warning: number;
    critical: number;
  };
  memoryUsage: {
    warning: number; // Percentage
    critical: number;
  };
  cpuUsage: {
    warning: number; // Percentage
    critical: number;
  };
  errorRate: {
    warning: number; // Percentage
    critical: number;
  };
}

export interface PerformanceAlert {
  type: 'warning' | 'critical';
  metric: string;
  value: number;
  threshold: number;
  timestamp: number;
  endpoint?: string;
  recommendation?: string;
}

export class PerformanceMonitor extends EventEmitter {
  private metrics: PerformanceMetrics[] = [];
  private alerts: PerformanceAlert[] = [];
  private thresholds: PerformanceThresholds;
  private monitoringInterval?: NodeJS.Timeout;
  private startCpuUsage: NodeJS.CpuUsage;

  constructor(thresholds?: Partial<PerformanceThresholds>) {
    super();
    this.startCpuUsage = process.cpuUsage();
    this.thresholds = {
      responseTime: {
        warning: 1000, // 1 second
        critical: 5000, // 5 seconds
      },
      memoryUsage: {
        warning: 70, // 70%
        critical: 85, // 85%
      },
      cpuUsage: {
        warning: 70, // 70%
        critical: 85, // 85%
      },
      errorRate: {
        warning: 5, // 5%
        critical: 10, // 10%
      },
      ...thresholds,
    };
  }

  startMonitoring(intervalMs: number = 5000): void {
    this.monitoringInterval = setInterval(() => {
      this.collectSystemMetrics();
    }, intervalMs);
  }

  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }
  }

  recordRequest(endpoint: string, method: string, responseTime: number, statusCode: number, cacheHitRate?: number): void {
    const metric: PerformanceMetrics = {
      timestamp: Date.now(),
      endpoint,
      method,
      responseTime,
      statusCode,
      memoryUsage: process.memoryUsage(),
      cpuUsage: process.cpuUsage(this.startCpuUsage),
      activeConnections: this.getActiveConnections(),
      cacheHitRate,
    };

    this.metrics.push(metric);
    this.checkThresholds(metric);

    // Keep only last 1000 metrics to prevent memory leaks
    if (this.metrics.length > 1000) {
      this.metrics = this.metrics.slice(-1000);
    }
  }

  private collectSystemMetrics(): void {
    const memoryUsage = process.memoryUsage();
    const cpuUsage = process.cpuUsage(this.startCpuUsage);
    
    // Check memory usage
    const memoryUsagePercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    this.checkMemoryThreshold(memoryUsagePercent);

    // Check CPU usage (approximate)
    const cpuPercent = ((cpuUsage.user + cpuUsage.system) / 1000000) * 100; // Convert to percentage
    this.checkCpuThreshold(cpuPercent);

    // Check error rate
    const recentMetrics = this.getRecentMetrics(60000); // Last minute
    if (recentMetrics.length > 0) {
      const errorRate = (recentMetrics.filter(m => m.statusCode >= 400).length / recentMetrics.length) * 100;
      this.checkErrorRateThreshold(errorRate);
    }
  }

  private checkThresholds(metric: PerformanceMetrics): void {
    // Response time threshold
    if (metric.responseTime > this.thresholds.responseTime.critical) {
      this.createAlert('critical', 'responseTime', metric.responseTime, this.thresholds.responseTime.critical, metric.endpoint);
    } else if (metric.responseTime > this.thresholds.responseTime.warning) {
      this.createAlert('warning', 'responseTime', metric.responseTime, this.thresholds.responseTime.warning, metric.endpoint);
    }
  }

  private checkMemoryThreshold(memoryPercent: number): void {
    if (memoryPercent > this.thresholds.memoryUsage.critical) {
      this.createAlert('critical', 'memoryUsage', memoryPercent, this.thresholds.memoryUsage.critical);
    } else if (memoryPercent > this.thresholds.memoryUsage.warning) {
      this.createAlert('warning', 'memoryUsage', memoryPercent, this.thresholds.memoryUsage.warning);
    }
  }

  private checkCpuThreshold(cpuPercent: number): void {
    if (cpuPercent > this.thresholds.cpuUsage.critical) {
      this.createAlert('critical', 'cpuUsage', cpuPercent, this.thresholds.cpuUsage.critical);
    } else if (cpuPercent > this.thresholds.cpuUsage.warning) {
      this.createAlert('warning', 'cpuUsage', cpuPercent, this.thresholds.cpuUsage.warning);
    }
  }

  private checkErrorRateThreshold(errorRate: number): void {
    if (errorRate > this.thresholds.errorRate.critical) {
      this.createAlert('critical', 'errorRate', errorRate, this.thresholds.errorRate.critical);
    } else if (errorRate > this.thresholds.errorRate.warning) {
      this.createAlert('warning', 'errorRate', errorRate, this.thresholds.errorRate.warning);
    }
  }

  private createAlert(type: 'warning' | 'critical', metric: string, value: number, threshold: number, endpoint?: string): void {
    const alert: PerformanceAlert = {
      type,
      metric,
      value,
      threshold,
      timestamp: Date.now(),
      endpoint,
      recommendation: this.getRecommendation(metric, type),
    };

    this.alerts.push(alert);
    this.emit('alert', alert);

    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }
  }

  private getRecommendation(metric: string, type: 'warning' | 'critical'): string {
    const recommendations = {
      responseTime: {
        warning: 'Consider optimizing database queries or adding caching',
        critical: 'Immediate action required: Check for slow queries, increase server resources, or implement load balancing',
      },
      memoryUsage: {
        warning: 'Monitor memory usage trends and consider garbage collection optimization',
        critical: 'Critical memory usage: Restart application or increase memory allocation',
      },
      cpuUsage: {
        warning: 'High CPU usage detected: Consider optimizing algorithms or scaling horizontally',
        critical: 'Critical CPU usage: Immediate scaling required or process optimization needed',
      },
      errorRate: {
        warning: 'Elevated error rate: Check logs for common error patterns',
        critical: 'Critical error rate: Investigate immediately and consider circuit breaker activation',
      },
    };

    return recommendations[metric as keyof typeof recommendations]?.[type] || 'Monitor the situation closely';
  }

  private getActiveConnections(): number {
    // This would typically integrate with your connection pool
    // For now, return a simulated value
    return Math.floor(Math.random() * 20) + 5;
  }

  getRecentMetrics(timeWindowMs: number): PerformanceMetrics[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.metrics.filter(m => m.timestamp > cutoff);
  }

  getPerformanceSummary(timeWindowMs: number = 300000): PerformanceSummary {
    const recentMetrics = this.getRecentMetrics(timeWindowMs);
    
    if (recentMetrics.length === 0) {
      return {
        totalRequests: 0,
        averageResponseTime: 0,
        p95ResponseTime: 0,
        p99ResponseTime: 0,
        errorRate: 0,
        throughput: 0,
        cacheHitRate: 0,
        recommendations: [],
      };
    }

    const responseTimes = recentMetrics.map(m => m.responseTime).sort((a, b) => a - b);
    const errorCount = recentMetrics.filter(m => m.statusCode >= 400).length;
    const cacheMetrics = recentMetrics.filter(m => m.cacheHitRate !== undefined);
    
    return {
      totalRequests: recentMetrics.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)],
      errorRate: (errorCount / recentMetrics.length) * 100,
      throughput: recentMetrics.length / (timeWindowMs / 1000),
      cacheHitRate: cacheMetrics.length > 0 
        ? cacheMetrics.reduce((sum, m) => sum + (m.cacheHitRate || 0), 0) / cacheMetrics.length 
        : 0,
      recommendations: this.generateRecommendations(recentMetrics),
    };
  }

  private generateRecommendations(metrics: PerformanceMetrics[]): string[] {
    const recommendations: string[] = [];
    
    if (metrics.length === 0) return recommendations;

    const avgResponseTime = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
    const errorRate = (metrics.filter(m => m.statusCode >= 400).length / metrics.length) * 100;
    
    if (avgResponseTime > 2000) {
      recommendations.push('Consider implementing response caching for frequently accessed endpoints');
    }
    
    if (errorRate > 5) {
      recommendations.push('High error rate detected - review error logs and implement better error handling');
    }

    const slowEndpoints = this.getSlowEndpoints(metrics);
    if (slowEndpoints.length > 0) {
      recommendations.push(`Optimize slow endpoints: ${slowEndpoints.join(', ')}`);
    }

    return recommendations;
  }

  private getSlowEndpoints(metrics: PerformanceMetrics[]): string[] {
    const endpointStats = new Map<string, { total: number; count: number }>();
    
    metrics.forEach(m => {
      const key = `${m.method} ${m.endpoint}`;
      const current = endpointStats.get(key) || { total: 0, count: 0 };
      endpointStats.set(key, {
        total: current.total + m.responseTime,
        count: current.count + 1,
      });
    });

    return Array.from(endpointStats.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        avgTime: stats.total / stats.count,
      }))
      .filter(item => item.avgTime > 1000)
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 5)
      .map(item => item.endpoint);
  }

  getAlerts(timeWindowMs: number = 3600000): PerformanceAlert[] {
    const cutoff = Date.now() - timeWindowMs;
    return this.alerts.filter(a => a.timestamp > cutoff);
  }

  clearAlerts(): void {
    this.alerts = [];
  }

  exportMetrics(): PerformanceMetrics[] {
    return [...this.metrics];
  }
}

export interface PerformanceSummary {
  totalRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  errorRate: number;
  throughput: number;
  cacheHitRate: number;
  recommendations: string[];
}

// Middleware for Express to automatically track performance
export function performanceMiddleware(monitor: PerformanceMonitor) {
  return (req: any, res: any, next: any) => {
    const startTime = performance.now();
    
    res.on('finish', () => {
      const responseTime = performance.now() - startTime;
      monitor.recordRequest(
        req.route?.path || req.path,
        req.method,
        responseTime,
        res.statusCode,
        res.locals.cacheHit ? 1 : 0
      );
    });
    
    next();
  };
}