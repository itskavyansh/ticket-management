/**
 * Basic Performance Test
 * Simple test to verify performance testing infrastructure works
 */

import { PerformanceMonitor } from './performance-monitor';

describe('Basic Performance Testing', () => {
  let performanceMonitor: PerformanceMonitor;

  beforeAll(() => {
    performanceMonitor = new PerformanceMonitor();
  });

  afterAll(() => {
    performanceMonitor.stopMonitoring();
  });

  test('Performance monitoring should work', () => {
    // Record some sample metrics
    performanceMonitor.recordRequest('/api/test', 'GET', 150, 200);
    performanceMonitor.recordRequest('/api/test', 'GET', 200, 200);
    performanceMonitor.recordRequest('/api/test', 'GET', 180, 200);

    const summary = performanceMonitor.getPerformanceSummary(60000);
    
    expect(summary.totalRequests).toBe(3);
    expect(summary.averageResponseTime).toBeGreaterThan(0);
    expect(summary.errorRate).toBe(0);
  });

  test('Performance thresholds should be validated', () => {
    // Test response time threshold
    performanceMonitor.recordRequest('/api/slow', 'GET', 6000, 200); // Slow request
    
    const alerts = performanceMonitor.getAlerts(60000);
    
    // Should have generated an alert for slow response time
    expect(alerts.length).toBeGreaterThan(0);
    
    const responseTimeAlert = alerts.find(alert => alert.metric === 'responseTime');
    expect(responseTimeAlert).toBeDefined();
    expect(responseTimeAlert?.type).toBe('critical');
  });

  test('Performance recommendations should be generated', () => {
    // Record various metrics to trigger recommendations
    for (let i = 0; i < 10; i++) {
      performanceMonitor.recordRequest('/api/endpoint', 'GET', 2500, 200); // Slow responses
    }

    const summary = performanceMonitor.getPerformanceSummary(60000);
    
    expect(summary.recommendations.length).toBeGreaterThan(0);
    expect(summary.recommendations[0]).toContain('caching');
  });

  test('System should handle concurrent performance monitoring', async () => {
    const concurrentRequests = 50;
    const promises: Promise<void>[] = [];

    for (let i = 0; i < concurrentRequests; i++) {
      promises.push(
        new Promise<void>((resolve) => {
          setTimeout(() => {
            performanceMonitor.recordRequest(`/api/concurrent/${i}`, 'GET', Math.random() * 1000 + 100, 200);
            resolve();
          }, Math.random() * 100);
        })
      );
    }

    await Promise.all(promises);

    const summary = performanceMonitor.getPerformanceSummary(60000);
    
    expect(summary.totalRequests).toBeGreaterThanOrEqual(concurrentRequests);
    expect(summary.averageResponseTime).toBeGreaterThan(0);
  });

  test('Performance metrics should be exportable', () => {
    // Record some metrics
    performanceMonitor.recordRequest('/api/export', 'GET', 300, 200);
    performanceMonitor.recordRequest('/api/export', 'POST', 450, 201);

    const exportedMetrics = performanceMonitor.exportMetrics();
    
    expect(Array.isArray(exportedMetrics)).toBe(true);
    expect(exportedMetrics.length).toBeGreaterThan(0);
    
    const lastMetric = exportedMetrics[exportedMetrics.length - 1];
    expect(lastMetric.endpoint).toBe('/api/export');
    expect(lastMetric.responseTime).toBe(450);
    expect(lastMetric.statusCode).toBe(201);
  });
});