/**
 * Comprehensive Load Testing Suite
 * Tests realistic traffic patterns, auto-scaling, and system performance under various conditions
 */

import request from 'supertest';
import { performance } from 'perf_hooks';
import { PerformanceMonitor } from './performance-monitor';
import { TestDataGenerator } from '../load-tests/test-data-generator';
import { logger } from '../../utils/logger';

interface LoadTestScenario {
  name: string;
  description: string;
  duration: number; // seconds
  phases: LoadTestPhase[];
  expectedMetrics: {
    maxResponseTime: number;
    maxErrorRate: number;
    minThroughput: number;
  };
}

interface LoadTestPhase {
  name: string;
  duration: number; // seconds
  targetRPS: number;
  rampUpTime?: number; // seconds
}

interface LoadTestResult {
  scenario: string;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  p99ResponseTime: number;
  maxResponseTime: number;
  errorRate: number;
  throughput: number;
  memoryUsage: {
    initial: number;
    peak: number;
    final: number;
  };
  cpuUsage: {
    average: number;
    peak: number;
  };
}

describe('Comprehensive Load Testing Suite', () => {
  let performanceMonitor: PerformanceMonitor;
  let baseUrl: string;
  let authTokens: Map<string, string>;
  let testData: any;

  beforeAll(async () => {
    baseUrl = process.env.TEST_BASE_URL || 'http://localhost:3000';
    
    // Initialize performance monitoring
    performanceMonitor = new PerformanceMonitor({
      responseTime: { warning: 2000, critical: 5000 },
      memoryUsage: { warning: 70, critical: 85 },
      cpuUsage: { warning: 70, critical: 85 },
      errorRate: { warning: 5, critical: 15 }
    });

    performanceMonitor.startMonitoring(1000); // 1 second intervals

    // Generate test data
    testData = {
      users: TestDataGenerator.generateUsers(500),
      customers: TestDataGenerator.generateCustomers(100),
      technicians: TestDataGenerator.generateTechnicians(50),
      tickets: TestDataGenerator.generateTickets(1000, [], [])
    };

    // Pre-authenticate users
    authTokens = await authenticateTestUsers(testData.users.slice(0, 100));
    
    console.log(`🚀 Load testing initialized with ${authTokens.size} authenticated users`);
  }, 120000);

  afterAll(async () => {
    performanceMonitor.stopMonitoring();
    console.log('🏁 Load testing completed');
  });

  describe('Realistic Traffic Pattern Testing', () => {
    test('Daily Traffic Pattern Simulation', async () => {
      const scenario: LoadTestScenario = {
        name: 'daily_traffic_pattern',
        description: 'Simulates realistic daily traffic with morning rush, business hours, lunch peak, and evening wind-down',
        duration: 300, // 5 minutes (accelerated)
        phases: [
          { name: 'morning_rush', duration: 60, targetRPS: 50, rampUpTime: 10 },
          { name: 'business_hours', duration: 120, targetRPS: 30 },
          { name: 'lunch_peak', duration: 40, targetRPS: 80, rampUpTime: 5 },
          { name: 'afternoon_steady', duration: 60, targetRPS: 35 },
          { name: 'evening_wind_down', duration: 20, targetRPS: 15 }
        ],
        expectedMetrics: {
          maxResponseTime: 3000,
          maxErrorRate: 10,
          minThroughput: 20
        }
      };

      const result = await executeLoadTestScenario(scenario);
      
      // Validate performance requirements
      expect(result.averageResponseTime).toBeLessThan(2000);
      expect(result.p95ResponseTime).toBeLessThan(scenario.expectedMetrics.maxResponseTime);
      expect(result.errorRate).toBeLessThan(scenario.expectedMetrics.maxErrorRate);
      expect(result.throughput).toBeGreaterThan(scenario.expectedMetrics.minThroughput);

      console.log('📊 Daily Traffic Pattern Results:', {
        avgResponseTime: `${result.averageResponseTime.toFixed(2)}ms`,
        p95ResponseTime: `${result.p95ResponseTime.toFixed(2)}ms`,
        errorRate: `${result.errorRate.toFixed(2)}%`,
        throughput: `${result.throughput.toFixed(2)} req/s`
      });
    }, 400000); // 6+ minute timeout

    test('Spike Traffic Handling', async () => {
      const scenario: LoadTestScenario = {
        name: 'spike_traffic',
        description: 'Tests system response to sudden traffic spikes',
        duration: 180, // 3 minutes
        phases: [
          { name: 'baseline', duration: 30, targetRPS: 20 },
          { name: 'spike_1', duration: 20, targetRPS: 200, rampUpTime: 2 },
          { name: 'recovery_1', duration: 30, targetRPS: 25 },
          { name: 'spike_2', duration: 15, targetRPS: 300, rampUpTime: 1 },
          { name: 'recovery_2', duration: 45, targetRPS: 20 },
          { name: 'final_spike', duration: 10, targetRPS: 400, rampUpTime: 1 },
          { name: 'final_recovery', duration: 30, targetRPS: 15 }
        ],
        expectedMetrics: {
          maxResponseTime: 8000, // More lenient during spikes
          maxErrorRate: 25,
          minThroughput: 15
        }
      };

      const result = await executeLoadTestScenario(scenario);
      
      // Validate spike handling
      expect(result.errorRate).toBeLessThan(scenario.expectedMetrics.maxErrorRate);
      expect(result.throughput).toBeGreaterThan(scenario.expectedMetrics.minThroughput);
      
      // Verify system recovery
      const recoveryMetrics = performanceMonitor.getPerformanceSummary(30000); // Last 30 seconds
      expect(recoveryMetrics.errorRate).toBeLessThan(10); // Should recover to normal error rates

      console.log('⚡ Spike Traffic Results:', {
        maxResponseTime: `${result.maxResponseTime.toFixed(2)}ms`,
        errorRate: `${result.errorRate.toFixed(2)}%`,
        recoveryErrorRate: `${recoveryMetrics.errorRate.toFixed(2)}%`
      });
    }, 300000); // 5 minute timeout

    test('Sustained High Load Test', async () => {
      const scenario: LoadTestScenario = {
        name: 'sustained_high_load',
        description: 'Tests system stability under sustained high load',
        duration: 240, // 4 minutes
        phases: [
          { name: 'ramp_up', duration: 30, targetRPS: 100, rampUpTime: 30 },
          { name: 'sustained_load', duration: 180, targetRPS: 100 },
          { name: 'ramp_down', duration: 30, targetRPS: 20, rampUpTime: 30 }
        ],
        expectedMetrics: {
          maxResponseTime: 4000,
          maxErrorRate: 15,
          minThroughput: 80
        }
      };

      const result = await executeLoadTestScenario(scenario);
      
      // Validate sustained performance
      expect(result.averageResponseTime).toBeLessThan(3000);
      expect(result.errorRate).toBeLessThan(scenario.expectedMetrics.maxErrorRate);
      expect(result.throughput).toBeGreaterThan(scenario.expectedMetrics.minThroughput);

      // Check for memory leaks
      expect(result.memoryUsage.final).toBeLessThan(result.memoryUsage.peak * 1.2);

      console.log('🔥 Sustained Load Results:', {
        avgResponseTime: `${result.averageResponseTime.toFixed(2)}ms`,
        memoryGrowth: `${((result.memoryUsage.final / result.memoryUsage.initial - 1) * 100).toFixed(1)}%`,
        throughput: `${result.throughput.toFixed(2)} req/s`
      });
    }, 360000); // 6 minute timeout
  });

  describe('Database Performance Under Load', () => {
    test('Database Query Optimization Under Load', async () => {
      const queryTypes = [
        'ticket_list_queries',
        'analytics_queries', 
        'search_queries',
        'complex_join_queries'
      ];

      const results = new Map<string, any>();

      for (const queryType of queryTypes) {
        const startTime = performance.now();
        
        // Execute concurrent queries of this type
        const promises = Array.from({ length: 50 }, () => 
          executeQueryTypeLoad(queryType, 100) // 100 requests per type
        );

        const queryResults = await Promise.all(promises);
        const endTime = performance.now();

        const avgResponseTime = queryResults.reduce((sum, r) => sum + r.avgTime, 0) / queryResults.length;
        const totalQueries = queryResults.reduce((sum, r) => sum + r.count, 0);
        const errorCount = queryResults.reduce((sum, r) => sum + r.errors, 0);

        results.set(queryType, {
          avgResponseTime,
          totalQueries,
          errorCount,
          errorRate: (errorCount / totalQueries) * 100,
          duration: endTime - startTime
        });

        // Validate query performance
        expect(avgResponseTime).toBeLessThan(getQueryTypeThreshold(queryType));
        expect(errorCount / totalQueries).toBeLessThan(0.05); // 5% error rate max
      }

      console.log('🗄️ Database Load Test Results:');
      results.forEach((result, queryType) => {
        console.log(`  ${queryType}: ${result.avgResponseTime.toFixed(2)}ms avg, ${result.errorRate.toFixed(2)}% errors`);
      });
    }, 300000);

    test('Connection Pool Performance Under Load', async () => {
      const connectionPoolTest = async () => {
        const startTime = performance.now();
        const promises = [];

        // Create 200 concurrent database operations
        for (let i = 0; i < 200; i++) {
          promises.push(
            request(baseUrl)
              .get('/api/tickets')
              .set('Authorization', `Bearer ${getRandomAuthToken()}`)
              .timeout(10000)
          );
        }

        const results = await Promise.allSettled(promises);
        const endTime = performance.now();

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const failed = results.filter(r => r.status === 'rejected').length;

        return {
          totalRequests: results.length,
          successful,
          failed,
          duration: endTime - startTime,
          successRate: (successful / results.length) * 100
        };
      };

      const result = await connectionPoolTest();

      // Validate connection pool performance
      expect(result.successRate).toBeGreaterThan(95); // 95% success rate minimum
      expect(result.duration).toBeLessThan(30000); // Should complete within 30 seconds

      console.log('🔗 Connection Pool Results:', {
        successRate: `${result.successRate.toFixed(2)}%`,
        duration: `${result.duration.toFixed(2)}ms`,
        avgTimePerRequest: `${(result.duration / result.totalRequests).toFixed(2)}ms`
      });
    }, 60000);
  });

  describe('Caching Performance Validation', () => {
    test('Redis Cache Performance Under Load', async () => {
      const cacheTest = async () => {
        const operations = [];
        
        // Mix of cache operations
        for (let i = 0; i < 1000; i++) {
          if (i % 3 === 0) {
            // Cache miss - new data
            operations.push(
              request(baseUrl)
                .get(`/api/tickets/${generateRandomId()}`)
                .set('Authorization', `Bearer ${getRandomAuthToken()}`)
            );
          } else {
            // Cache hit - repeated data
            operations.push(
              request(baseUrl)
                .get('/api/analytics/dashboard')
                .set('Authorization', `Bearer ${getRandomAuthToken()}`)
            );
          }
        }

        const startTime = performance.now();
        const results = await Promise.allSettled(operations);
        const endTime = performance.now();

        const successful = results.filter(r => r.status === 'fulfilled').length;
        const avgResponseTime = (endTime - startTime) / results.length;

        return {
          totalOperations: results.length,
          successful,
          avgResponseTime,
          duration: endTime - startTime
        };
      };

      const result = await cacheTest();

      // Validate cache performance
      expect(result.avgResponseTime).toBeLessThan(100); // Should be fast with caching
      expect(result.successful / result.totalOperations).toBeGreaterThan(0.95);

      // Check cache hit rate from monitoring
      const cacheMetrics = performanceMonitor.getPerformanceSummary(60000);
      expect(cacheMetrics.cacheHitRate).toBeGreaterThan(0.6); // 60% hit rate minimum

      console.log('💾 Cache Performance Results:', {
        avgResponseTime: `${result.avgResponseTime.toFixed(2)}ms`,
        cacheHitRate: `${(cacheMetrics.cacheHitRate * 100).toFixed(1)}%`,
        successRate: `${((result.successful / result.totalOperations) * 100).toFixed(1)}%`
      });
    }, 180000);

    test('API Response Caching Effectiveness', async () => {
      const endpoints = [
        '/api/analytics/dashboard',
        '/api/tickets?status=open',
        '/api/analytics/performance',
        '/api/sla/dashboard'
      ];

      const cacheEffectivenessResults = new Map();

      for (const endpoint of endpoints) {
        // First request (cache miss)
        const firstRequestTime = performance.now();
        await request(baseUrl)
          .get(endpoint)
          .set('Authorization', `Bearer ${getRandomAuthToken()}`);
        const firstRequestDuration = performance.now() - firstRequestTime;

        // Second request (should be cache hit)
        const secondRequestTime = performance.now();
        await request(baseUrl)
          .get(endpoint)
          .set('Authorization', `Bearer ${getRandomAuthToken()}`);
        const secondRequestDuration = performance.now() - secondRequestTime;

        const cacheSpeedup = firstRequestDuration / secondRequestDuration;
        
        cacheEffectivenessResults.set(endpoint, {
          firstRequest: firstRequestDuration,
          secondRequest: secondRequestDuration,
          speedup: cacheSpeedup
        });

        // Validate cache effectiveness
        expect(cacheSpeedup).toBeGreaterThan(1.5); // At least 50% improvement
      }

      console.log('🚀 API Cache Effectiveness:');
      cacheEffectivenessResults.forEach((result, endpoint) => {
        console.log(`  ${endpoint}: ${result.speedup.toFixed(2)}x speedup`);
      });
    }, 120000);
  });

  describe('Auto-scaling and Resource Utilization', () => {
    test('Auto-scaling Response to Load Changes', async () => {
      const scalingScenario: LoadTestScenario = {
        name: 'auto_scaling_test',
        description: 'Tests auto-scaling response to varying load',
        duration: 300, // 5 minutes
        phases: [
          { name: 'baseline', duration: 30, targetRPS: 10 },
          { name: 'gradual_increase', duration: 60, targetRPS: 50, rampUpTime: 60 },
          { name: 'high_load', duration: 90, targetRPS: 100 },
          { name: 'spike', duration: 30, targetRPS: 200, rampUpTime: 5 },
          { name: 'recovery', duration: 90, targetRPS: 20, rampUpTime: 30 }
        ],
        expectedMetrics: {
          maxResponseTime: 5000,
          maxErrorRate: 20,
          minThroughput: 15
        }
      };

      const result = await executeLoadTestScenario(scalingScenario);
      
      // Validate auto-scaling effectiveness
      expect(result.errorRate).toBeLessThan(scalingScenario.expectedMetrics.maxErrorRate);
      
      // Check that system maintained reasonable performance during scaling
      const scalingMetrics = performanceMonitor.getPerformanceSummary(300000);
      expect(scalingMetrics.p95ResponseTime).toBeLessThan(scalingScenario.expectedMetrics.maxResponseTime);

      console.log('📈 Auto-scaling Results:', {
        errorRate: `${result.errorRate.toFixed(2)}%`,
        p95ResponseTime: `${scalingMetrics.p95ResponseTime.toFixed(2)}ms`,
        throughputVariation: `${(result.throughput / 10).toFixed(2)}x baseline`
      });
    }, 420000); // 7 minute timeout

    test('Resource Utilization Under Different Loads', async () => {
      const loadLevels = [
        { name: 'low', targetRPS: 20, duration: 60 },
        { name: 'medium', targetRPS: 60, duration: 60 },
        { name: 'high', targetRPS: 120, duration: 60 }
      ];

      const resourceMetrics = new Map();

      for (const level of loadLevels) {
        console.log(`Testing ${level.name} load: ${level.targetRPS} RPS`);
        
        const startTime = performance.now();
        await executeConstantLoad(level.targetRPS, level.duration);
        
        const metrics = performanceMonitor.getPerformanceSummary(level.duration * 1000);
        resourceMetrics.set(level.name, {
          responseTime: metrics.averageResponseTime,
          throughput: metrics.throughput,
          errorRate: metrics.errorRate,
          memoryUsage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
        });

        // Allow system to stabilize between tests
        await new Promise(resolve => setTimeout(resolve, 10000));
      }

      // Validate resource scaling
      const lowLoad = resourceMetrics.get('low');
      const mediumLoad = resourceMetrics.get('medium');
      const highLoad = resourceMetrics.get('high');

      // Response time should scale reasonably
      expect(mediumLoad.responseTime / lowLoad.responseTime).toBeLessThan(3);
      expect(highLoad.responseTime / lowLoad.responseTime).toBeLessThan(5);

      // Throughput should increase with load (up to capacity)
      expect(mediumLoad.throughput).toBeGreaterThan(lowLoad.throughput * 1.5);

      console.log('📊 Resource Utilization Results:');
      resourceMetrics.forEach((metrics, level) => {
        console.log(`  ${level}: ${metrics.responseTime.toFixed(2)}ms, ${metrics.throughput.toFixed(2)} req/s, ${metrics.memoryUsage.toFixed(2)}MB`);
      });
    }, 300000);
  });

  // Helper functions
  async function executeLoadTestScenario(scenario: LoadTestScenario): Promise<LoadTestResult> {
    console.log(`🎯 Starting scenario: ${scenario.name}`);
    
    const allRequests: Array<{ responseTime: number; success: boolean }> = [];
    const memorySnapshots: number[] = [];
    const cpuSnapshots: number[] = [];

    memorySnapshots.push(process.memoryUsage().heapUsed);

    for (const phase of scenario.phases) {
      console.log(`  Phase: ${phase.name} - ${phase.targetRPS} RPS for ${phase.duration}s`);
      
      const phaseRequests = await executeLoadPhase(phase);
      allRequests.push(...phaseRequests);
      
      memorySnapshots.push(process.memoryUsage().heapUsed);
      cpuSnapshots.push(process.cpuUsage().user + process.cpuUsage().system);
    }

    // Calculate results
    const responseTimes = allRequests.map(r => r.responseTime).sort((a, b) => a - b);
    const successfulRequests = allRequests.filter(r => r.success).length;
    const failedRequests = allRequests.length - successfulRequests;

    return {
      scenario: scenario.name,
      totalRequests: allRequests.length,
      successfulRequests,
      failedRequests,
      averageResponseTime: responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length,
      p95ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.95)],
      p99ResponseTime: responseTimes[Math.floor(responseTimes.length * 0.99)],
      maxResponseTime: Math.max(...responseTimes),
      errorRate: (failedRequests / allRequests.length) * 100,
      throughput: allRequests.length / scenario.duration,
      memoryUsage: {
        initial: memorySnapshots[0],
        peak: Math.max(...memorySnapshots),
        final: memorySnapshots[memorySnapshots.length - 1]
      },
      cpuUsage: {
        average: cpuSnapshots.reduce((a, b) => a + b, 0) / cpuSnapshots.length,
        peak: Math.max(...cpuSnapshots)
      }
    };
  }

  async function executeLoadPhase(phase: LoadTestPhase): Promise<Array<{ responseTime: number; success: boolean }>> {
    const requests: Array<{ responseTime: number; success: boolean }> = [];
    const startTime = Date.now();
    const endTime = startTime + (phase.duration * 1000);
    
    const rampUpTime = phase.rampUpTime || 0;
    const baseInterval = 1000 / phase.targetRPS;

    while (Date.now() < endTime) {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / (rampUpTime * 1000), 1);
      const currentRPS = phase.targetRPS * progress;
      const currentInterval = currentRPS > 0 ? 1000 / currentRPS : baseInterval;

      const requestStart = performance.now();
      
      try {
        const response = await executeRandomRequest();
        const responseTime = performance.now() - requestStart;
        
        requests.push({
          responseTime,
          success: response.status < 400
        });
      } catch (error) {
        requests.push({
          responseTime: performance.now() - requestStart,
          success: false
        });
      }

      // Wait for next request
      const waitTime = Math.max(0, currentInterval - (performance.now() - requestStart));
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }

    return requests;
  }

  async function executeConstantLoad(targetRPS: number, durationSeconds: number): Promise<void> {
    const interval = 1000 / targetRPS;
    const endTime = Date.now() + (durationSeconds * 1000);

    while (Date.now() < endTime) {
      const requestStart = performance.now();
      
      try {
        await executeRandomRequest();
      } catch (error) {
        // Continue with load test even if individual requests fail
      }

      const waitTime = Math.max(0, interval - (performance.now() - requestStart));
      if (waitTime > 0) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
    }
  }

  async function executeRandomRequest() {
    const requestTypes = [
      'getTickets',
      'createTicket', 
      'updateTicket',
      'getAnalytics',
      'searchTickets',
      'aiTriage',
      'slaPredict',
      'getHealth'
    ];

    const requestType = requestTypes[Math.floor(Math.random() * requestTypes.length)];
    const token = getRandomAuthToken();

    switch (requestType) {
      case 'getTickets':
        return request(baseUrl).get('/api/tickets').set('Authorization', `Bearer ${token}`);
      case 'createTicket':
        return request(baseUrl).post('/api/tickets').set('Authorization', `Bearer ${token}`).send({
          title: 'Load test ticket',
          description: 'Generated for load testing',
          category: 'software',
          priority: 'medium',
          customerId: generateRandomId()
        });
      case 'updateTicket':
        return request(baseUrl).put(`/api/tickets/${generateRandomId()}`).set('Authorization', `Bearer ${token}`).send({
          status: 'in_progress'
        });
      case 'getAnalytics':
        return request(baseUrl).get('/api/analytics/dashboard').set('Authorization', `Bearer ${token}`);
      case 'searchTickets':
        return request(baseUrl).get('/api/tickets/search?q=test').set('Authorization', `Bearer ${token}`);
      case 'aiTriage':
        return request(baseUrl).post('/api/ai/triage').set('Authorization', `Bearer ${token}`).send({
          title: 'Test ticket for AI processing',
          description: 'This is a test ticket for load testing AI triage'
        });
      case 'slaPredict':
        return request(baseUrl).post('/api/ai/predict-sla').set('Authorization', `Bearer ${token}`).send({
          ticketId: generateRandomId()
        });
      default:
        return request(baseUrl).get('/api/health');
    }
  }

  async function executeQueryTypeLoad(queryType: string, requestCount: number) {
    const startTime = performance.now();
    let totalTime = 0;
    let errors = 0;

    for (let i = 0; i < requestCount; i++) {
      const requestStart = performance.now();
      
      try {
        await executeQueryTypeRequest(queryType);
        totalTime += performance.now() - requestStart;
      } catch (error) {
        errors++;
        totalTime += performance.now() - requestStart;
      }
    }

    return {
      avgTime: totalTime / requestCount,
      count: requestCount,
      errors
    };
  }

  async function executeQueryTypeRequest(queryType: string) {
    const token = getRandomAuthToken();
    
    switch (queryType) {
      case 'ticket_list_queries':
        return request(baseUrl).get('/api/tickets?limit=50').set('Authorization', `Bearer ${token}`);
      case 'analytics_queries':
        return request(baseUrl).get('/api/analytics/performance').set('Authorization', `Bearer ${token}`);
      case 'search_queries':
        return request(baseUrl).get('/api/tickets/search?q=urgent').set('Authorization', `Bearer ${token}`);
      case 'complex_join_queries':
        return request(baseUrl).get('/api/analytics/technician-performance').set('Authorization', `Bearer ${token}`);
      default:
        return request(baseUrl).get('/api/tickets').set('Authorization', `Bearer ${token}`);
    }
  }

  function getQueryTypeThreshold(queryType: string): number {
    const thresholds = {
      'ticket_list_queries': 200,
      'analytics_queries': 800,
      'search_queries': 500,
      'complex_join_queries': 1200
    };
    return thresholds[queryType as keyof typeof thresholds] || 500;
  }

  async function authenticateTestUsers(users: any[]): Promise<Map<string, string>> {
    const tokens = new Map<string, string>();
    
    for (const user of users.slice(0, 50)) { // Limit to 50 for performance
      try {
        const response = await request(baseUrl)
          .post('/api/auth/login')
          .send({
            email: user.email,
            password: 'testpassword123'
          })
          .timeout(10000);

        if (response.status === 200 && response.body.token) {
          tokens.set(user.id, response.body.token);
        }
      } catch (error) {
        // Continue with other users
      }
    }

    return tokens;
  }

  function getRandomAuthToken(): string {
    const tokens = Array.from(authTokens.values());
    return tokens[Math.floor(Math.random() * tokens.length)] || 'fallback-token';
  }

  function generateRandomId(): string {
    return Math.random().toString(36).substring(2, 15);
  }
});