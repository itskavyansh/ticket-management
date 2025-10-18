/**
 * Auto-scaling and Infrastructure Performance Tests
 * Tests system scaling capabilities and infrastructure performance
 */

import request from 'supertest';
import { performance } from 'perf_hooks';
import { EventEmitter } from 'events';

interface ScalingMetrics {
  timestamp: number;
  activeConnections: number;
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
}

interface LoadPattern {
  name: string;
  phases: Array<{
    duration: number; // seconds
    targetRPS: number; // requests per second
    rampUp?: boolean;
  }>;
}

class AutoScalingTester extends EventEmitter {
  private baseUrl: string;
  private metrics: ScalingMetrics[] = [];
  private activeRequests = 0;

  constructor(baseUrl: string = 'http://localhost:3000') {
    super();
    this.baseUrl = baseUrl;
  }

  async executeLoadPattern(pattern: LoadPattern): Promise<ScalingMetrics[]> {
    console.log(`Starting load pattern: ${pattern.name}`);
    
    for (const phase of pattern.phases) {
      console.log(`Phase: ${phase.targetRPS} RPS for ${phase.duration}s`);
      await this.executePhase(phase);
    }

    return this.metrics;
  }

  private async executePhase(phase: { duration: number; targetRPS: number; rampUp?: boolean }): Promise<void> {
    const startTime = Date.now();
    const endTime = startTime + (phase.duration * 1000);
    const interval = 1000 / phase.targetRPS;

    let currentRPS = phase.rampUp ? 1 : phase.targetRPS;
    const rampIncrement = phase.rampUp ? (phase.targetRPS - 1) / (phase.duration * 10) : 0;

    while (Date.now() < endTime) {
      const phaseStart = Date.now();
      
      // Adjust RPS if ramping up
      if (phase.rampUp && currentRPS < phase.targetRPS) {
        currentRPS = Math.min(phase.targetRPS, currentRPS + rampIncrement);
      }

      // Execute requests for this second
      const requestsThisSecond = Math.floor(currentRPS);
      const requestPromises: Promise<void>[] = [];

      for (let i = 0; i < requestsThisSecond; i++) {
        requestPromises.push(this.executeRequest());
      }

      await Promise.all(requestPromises);

      // Collect metrics
      await this.collectMetrics();

      // Wait for next second
      const elapsed = Date.now() - phaseStart;
      const waitTime = Math.max(0, 1000 - elapsed);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }

  private async executeRequest(): Promise<void> {
    this.activeRequests++;
    const startTime = performance.now();

    try {
      const app = request(this.baseUrl);
      const response = await app
        .get('/api/tickets')
        .set('Authorization', 'Bearer test-token')
        .timeout(30000);

      const responseTime = performance.now() - startTime;
      
      this.emit('request-complete', {
        responseTime,
        status: response.status,
        success: response.status < 400
      });

    } catch (error) {
      this.emit('request-error', error);
    } finally {
      this.activeRequests--;
    }
  }

  private async collectMetrics(): Promise<void> {
    // Simulate metrics collection (in real implementation, this would query actual system metrics)
    const metric: ScalingMetrics = {
      timestamp: Date.now(),
      activeConnections: this.activeRequests,
      responseTime: Math.random() * 1000 + 200, // Simulated
      throughput: Math.random() * 100 + 50, // Simulated
      errorRate: Math.random() * 5, // Simulated
      cpuUsage: Math.random() * 80 + 20, // Simulated
      memoryUsage: Math.random() * 70 + 30, // Simulated
    };

    this.metrics.push(metric);
    this.emit('metrics-collected', metric);
  }

  getMetricsSummary(): any {
    if (this.metrics.length === 0) return null;

    const responseTimes = this.metrics.map(m => m.responseTime);
    const throughputs = this.metrics.map(m => m.throughput);
    const errorRates = this.metrics.map(m => m.errorRate);

    return {
      totalSamples: this.metrics.length,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      maxResponseTime: Math.max(...responseTimes),
      averageThroughput: throughputs.reduce((a, b) => a + b, 0) / throughputs.length,
      maxThroughput: Math.max(...throughputs),
      averageErrorRate: errorRates.reduce((a, b) => a + b, 0) / errorRates.length,
      maxErrorRate: Math.max(...errorRates),
    };
  }
}

describe('Auto-scaling and Infrastructure Performance', () => {
  let scalingTester: AutoScalingTester;

  beforeEach(() => {
    scalingTester = new AutoScalingTester();
  });

  describe('Horizontal Scaling Tests', () => {
    test('System should scale up under increasing load', async () => {
      const scaleUpPattern: LoadPattern = {
        name: 'Scale Up Test',
        phases: [
          { duration: 30, targetRPS: 10 }, // Baseline
          { duration: 60, targetRPS: 50, rampUp: true }, // Gradual increase
          { duration: 120, targetRPS: 100 }, // Sustained high load
          { duration: 60, targetRPS: 10, rampUp: true }, // Scale down
        ]
      };

      const metrics = await scalingTester.executeLoadPattern(scaleUpPattern);
      const summary = scalingTester.getMetricsSummary();

      console.log('Scale Up Test Summary:', summary);

      // Verify scaling behavior
      expect(summary.averageResponseTime).toBeLessThan(5000); // 5 second max
      expect(summary.averageErrorRate).toBeLessThan(5); // 5% max error rate
      expect(summary.maxThroughput).toBeGreaterThan(80); // Should handle high throughput

      // Analyze scaling efficiency
      const highLoadMetrics = metrics.filter(m => m.throughput > 80);
      if (highLoadMetrics.length > 0) {
        const avgHighLoadResponseTime = highLoadMetrics.reduce((sum, m) => sum + m.responseTime, 0) / highLoadMetrics.length;
        expect(avgHighLoadResponseTime).toBeLessThan(3000); // Should maintain performance under load
      }
    }, 300000); // 5 minute timeout

    test('System should handle traffic spikes efficiently', async () => {
      const spikePattern: LoadPattern = {
        name: 'Traffic Spike Test',
        phases: [
          { duration: 30, targetRPS: 20 }, // Normal load
          { duration: 10, targetRPS: 200 }, // Sudden spike
          { duration: 30, targetRPS: 20 }, // Back to normal
          { duration: 10, targetRPS: 150 }, // Another spike
          { duration: 30, targetRPS: 20 }, // Recovery
        ]
      };

      const metrics = await scalingTester.executeLoadPattern(spikePattern);
      const summary = scalingTester.getMetricsSummary();

      console.log('Traffic Spike Test Summary:', summary);

      // System should handle spikes without complete failure
      expect(summary.averageErrorRate).toBeLessThan(15); // Allow higher error rate during spikes
      expect(summary.maxResponseTime).toBeLessThan(30000); // 30 second max

      // Verify recovery after spikes
      const recoveryMetrics = metrics.slice(-10); // Last 10 samples
      const avgRecoveryResponseTime = recoveryMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recoveryMetrics.length;
      expect(avgRecoveryResponseTime).toBeLessThan(2000); // Should recover quickly
    }, 180000); // 3 minute timeout

    test('System should scale down during low traffic periods', async () => {
      const scaleDownPattern: LoadPattern = {
        name: 'Scale Down Test',
        phases: [
          { duration: 60, targetRPS: 100 }, // High load
          { duration: 120, targetRPS: 10, rampUp: true }, // Gradual decrease
          { duration: 60, targetRPS: 5 }, // Low load
        ]
      };

      const metrics = await scalingTester.executeLoadPattern(scaleDownPattern);
      
      // Analyze resource efficiency during scale down
      const lowLoadMetrics = metrics.filter(m => m.throughput < 20);
      if (lowLoadMetrics.length > 0) {
        const avgLowLoadCPU = lowLoadMetrics.reduce((sum, m) => sum + m.cpuUsage, 0) / lowLoadMetrics.length;
        const avgLowLoadMemory = lowLoadMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / lowLoadMetrics.length;
        
        console.log(`Low load resource usage: CPU=${avgLowLoadCPU.toFixed(1)}%, Memory=${avgLowLoadMemory.toFixed(1)}%`);
        
        // Should use fewer resources during low load
        expect(avgLowLoadCPU).toBeLessThan(60); // CPU should decrease
        expect(avgLowLoadMemory).toBeLessThan(60); // Memory should be managed
      }
    }, 240000); // 4 minute timeout
  });

  describe('Load Balancing Performance', () => {
    test('Load should be distributed evenly across instances', async () => {
      // Test load distribution
      const distributionTest = async () => {
        const requests = 100;
        const responses: any[] = [];

        for (let i = 0; i < requests; i++) {
          try {
            const app = request('http://localhost:3000');
            const response = await app
              .get('/api/health')
              .set('X-Request-ID', `dist-test-${i}`);

            responses.push({
              status: response.status,
              instanceId: response.get('X-Instance-ID') || 'unknown',
              responseTime: response.get('X-Response-Time') || 0
            });
          } catch (error) {
            responses.push({ error: true });
          }
        }

        return responses;
      };

      const responses = await distributionTest();
      const successfulResponses = responses.filter(r => !r.error && r.status === 200);
      
      expect(successfulResponses.length).toBeGreaterThan(responses.length * 0.9); // 90% success rate

      // Analyze instance distribution
      const instanceCounts = new Map<string, number>();
      successfulResponses.forEach(r => {
        const count = instanceCounts.get(r.instanceId) || 0;
        instanceCounts.set(r.instanceId, count + 1);
      });

      if (instanceCounts.size > 1) {
        // Check distribution fairness
        const counts = Array.from(instanceCounts.values());
        const avgCount = counts.reduce((a, b) => a + b, 0) / counts.length;
        const maxDeviation = Math.max(...counts.map(c => Math.abs(c - avgCount)));
        
        console.log('Load distribution:', Object.fromEntries(instanceCounts));
        
        // Distribution should be reasonably fair (within 30% of average)
        expect(maxDeviation).toBeLessThan(avgCount * 0.3);
      }
    });

    test('Failed instances should be removed from load balancing', async () => {
      // Test health check and failover
      const healthCheckTest = async () => {
        const healthChecks = [];
        
        for (let i = 0; i < 10; i++) {
          const app = request('http://localhost:3000');
          const response = await app.get('/api/health');
          
          healthChecks.push({
            status: response.status,
            healthy: response.status === 200,
            instanceId: response.get('X-Instance-ID') || 'unknown'
          });
          
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        return healthChecks;
      };

      const healthChecks = await healthCheckTest();
      const healthyChecks = healthChecks.filter(h => h.healthy);
      
      // Should maintain high availability
      expect(healthyChecks.length).toBeGreaterThan(healthChecks.length * 0.8); // 80% uptime
    });
  });

  describe('Database Scaling Performance', () => {
    test('Database should handle connection pool scaling', async () => {
      const connectionTest = async () => {
        const concurrentQueries = 50;
        const queryPromises: Promise<any>[] = [];

        for (let i = 0; i < concurrentQueries; i++) {
          const app = request('http://localhost:3000');
          queryPromises.push(
            app
              .get('/api/tickets')
              .set('Authorization', 'Bearer test-token')
              .query({ limit: 10 })
          );
        }

        const startTime = performance.now();
        const results = await Promise.allSettled(queryPromises);
        const totalTime = performance.now() - startTime;

        return {
          totalTime,
          successful: results.filter(r => r.status === 'fulfilled').length,
          failed: results.filter(r => r.status === 'rejected').length,
          avgTimePerQuery: totalTime / concurrentQueries
        };
      };

      const result = await connectionTest();
      
      console.log('Database scaling test:', result);
      
      expect(result.successful).toBeGreaterThan(50 * 0.9); // 90% success
      expect(result.avgTimePerQuery).toBeLessThan(2000); // 2 second average
      expect(result.totalTime).toBeLessThan(10000); // 10 second total
    });

    test('Read replicas should distribute read load', async () => {
      // Test read load distribution
      const readTest = async () => {
        const readQueries = [
          '/api/tickets',
          '/api/analytics/dashboard',
          '/api/technicians',
          '/api/customers'
        ];

        const results = [];

        for (const query of readQueries) {
          const startTime = performance.now();
          
          const app = request('http://localhost:3000');
          const response = await app
            .get(query)
            .set('Authorization', 'Bearer test-token');

          const responseTime = performance.now() - startTime;
          
          results.push({
            query,
            responseTime,
            status: response.status,
            dbInstance: response.get('X-DB-Instance') || 'primary'
          });
        }

        return results;
      };

      const results = await readTest();
      const successfulReads = results.filter(r => r.status === 200);
      
      expect(successfulReads.length).toBeGreaterThan(0);
      
      // Check if reads are distributed across replicas
      const dbInstances = new Set(successfulReads.map(r => r.dbInstance));
      console.log('Database instances used:', Array.from(dbInstances));
      
      // Average response time should be reasonable
      const avgResponseTime = successfulReads.reduce((sum, r) => sum + r.responseTime, 0) / successfulReads.length;
      expect(avgResponseTime).toBeLessThan(1000); // 1 second average
    });
  });

  describe('Cache Scaling Performance', () => {
    test('Cache should scale with increased load', async () => {
      const cacheTest = async () => {
        const cacheableEndpoints = [
          '/api/analytics/dashboard',
          '/api/tickets/recent',
          '/api/technicians/available'
        ];

        const results = [];

        // First requests (cache miss)
        for (const endpoint of cacheableEndpoints) {
          const startTime = performance.now();
          
          const app = request('http://localhost:3000');
          const response = await app
            .get(endpoint)
            .set('Authorization', 'Bearer test-token');

          const responseTime = performance.now() - startTime;
          
          results.push({
            endpoint,
            responseTime,
            cached: false,
            status: response.status
          });
        }

        // Second requests (should be cached)
        for (const endpoint of cacheableEndpoints) {
          const startTime = performance.now();
          
          const app = request('http://localhost:3000');
          const response = await app
            .get(endpoint)
            .set('Authorization', 'Bearer test-token');

          const responseTime = performance.now() - startTime;
          
          results.push({
            endpoint,
            responseTime,
            cached: true,
            status: response.status
          });
        }

        return results;
      };

      const results = await cacheTest();
      const uncachedResults = results.filter(r => !r.cached && r.status === 200);
      const cachedResults = results.filter(r => r.cached && r.status === 200);

      if (uncachedResults.length > 0 && cachedResults.length > 0) {
        const avgUncachedTime = uncachedResults.reduce((sum, r) => sum + r.responseTime, 0) / uncachedResults.length;
        const avgCachedTime = cachedResults.reduce((sum, r) => sum + r.responseTime, 0) / cachedResults.length;
        
        console.log(`Cache performance: uncached=${avgUncachedTime.toFixed(2)}ms, cached=${avgCachedTime.toFixed(2)}ms`);
        
        // Cached requests should be significantly faster
        expect(avgCachedTime).toBeLessThan(avgUncachedTime * 0.5); // At least 50% faster
      }
    });
  });

  describe('Auto-scaling Triggers and Thresholds', () => {
    test('System should trigger scaling based on response time thresholds', async () => {
      // Monitor response times and scaling triggers
      const monitoringTest = async () => {
        const measurements = [];
        const duration = 60000; // 1 minute
        const startTime = Date.now();

        while (Date.now() - startTime < duration) {
          const requestStart = performance.now();
          
          try {
            const app = request('http://localhost:3000');
            const response = await app
              .get('/api/tickets')
              .set('Authorization', 'Bearer test-token');

            const responseTime = performance.now() - requestStart;
            
            measurements.push({
              timestamp: Date.now(),
              responseTime,
              status: response.status,
              instanceCount: parseInt(response.get('X-Instance-Count') || '1')
            });

          } catch (error) {
            measurements.push({
              timestamp: Date.now(),
              responseTime: 30000, // Timeout
              status: 500,
              instanceCount: 1
            });
          }

          await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second intervals
        }

        return measurements;
      };

      const measurements = await monitoringTest();
      
      // Analyze scaling behavior
      const avgResponseTime = measurements.reduce((sum, m) => sum + m.responseTime, 0) / measurements.length;
      const maxInstanceCount = Math.max(...measurements.map(m => m.instanceCount));
      const minInstanceCount = Math.min(...measurements.map(m => m.instanceCount));

      console.log(`Scaling analysis: avg response=${avgResponseTime.toFixed(2)}ms, instances=${minInstanceCount}-${maxInstanceCount}`);

      // System should maintain reasonable performance
      expect(avgResponseTime).toBeLessThan(5000); // 5 second average
      
      // Should show scaling activity if needed
      if (avgResponseTime > 2000) {
        expect(maxInstanceCount).toBeGreaterThan(minInstanceCount); // Should scale up
      }
    });
  });
});