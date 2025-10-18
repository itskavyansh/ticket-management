/**
 * Cache Performance Testing
 * Tests Redis caching effectiveness and performance under load
 */

import Redis from 'redis';
import { performance } from 'perf_hooks';

describe('Cache Performance Testing', () => {
  let redisClient: any;
  let testData: Map<string, any>;

  beforeAll(async () => {
    redisClient = Redis.createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
      password: process.env.REDIS_PASSWORD,
    });

    await redisClient.connect();
    
    // Generate test data
    testData = generateTestData(1000);
  });

  afterAll(async () => {
    await redisClient.flushAll(); // Clean up test data
    await redisClient.disconnect();
  });

  describe('Basic Cache Operations Performance', () => {
    test('SET operations should be fast and consistent', async () => {
      const iterations = 100;
      const times: number[] = [];

      for (let i = 0; i < iterations; i++) {
        const key = `test:set:${i}`;
        const value = JSON.stringify({ id: i, data: `test data ${i}` });
        
        const start = performance.now();
        await redisClient.set(key, value, { EX: 300 }); // 5 minute expiry
        const time = performance.now() - start;
        
        times.push(time);
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`SET operations: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
      
      expect(avgTime).toBeLessThan(10); // Average should be under 10ms
      expect(maxTime).toBeLessThan(50); // Max should be under 50ms
    });

    test('GET operations should be extremely fast', async () => {
      // Pre-populate cache
      const keys: string[] = [];
      for (let i = 0; i < 100; i++) {
        const key = `test:get:${i}`;
        keys.push(key);
        await redisClient.set(key, JSON.stringify({ id: i, data: `cached data ${i}` }));
      }

      const times: number[] = [];

      for (const key of keys) {
        const start = performance.now();
        const result = await redisClient.get(key);
        const time = performance.now() - start;
        
        times.push(time);
        expect(result).toBeTruthy();
      }

      const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
      const maxTime = Math.max(...times);
      
      console.log(`GET operations: avg=${avgTime.toFixed(2)}ms, max=${maxTime.toFixed(2)}ms`);
      
      expect(avgTime).toBeLessThan(5); // Average should be under 5ms
      expect(maxTime).toBeLessThan(20); // Max should be under 20ms
    });

    test('MGET operations should be efficient for bulk retrieval', async () => {
      // Pre-populate cache
      const keys: string[] = [];
      for (let i = 0; i < 50; i++) {
        const key = `test:mget:${i}`;
        keys.push(key);
        await redisClient.set(key, JSON.stringify({ id: i, bulk: true }));
      }

      const start = performance.now();
      const results = await redisClient.mGet(keys);
      const time = performance.now() - start;
      
      console.log(`MGET operation (50 keys): ${time.toFixed(2)}ms`);
      
      expect(results).toHaveLength(50);
      expect(time).toBeLessThan(20); // Should be faster than individual GETs
    });
  });

  describe('Concurrent Access Performance', () => {
    test('Cache should handle concurrent reads efficiently', async () => {
      const key = 'test:concurrent:read';
      const testValue = JSON.stringify({ data: 'concurrent test data', timestamp: Date.now() });
      
      await redisClient.set(key, testValue);

      const concurrentReads = 100;
      const promises: Promise<any>[] = [];

      const start = performance.now();

      for (let i = 0; i < concurrentReads; i++) {
        promises.push(redisClient.get(key));
      }

      const results = await Promise.all(promises);
      const totalTime = performance.now() - start;

      expect(results).toHaveLength(concurrentReads);
      expect(results.every(r => r === testValue)).toBe(true);
      expect(totalTime).toBeLessThan(1000); // Should complete within 1 second
      
      console.log(`${concurrentReads} concurrent reads: ${totalTime.toFixed(2)}ms`);
    });

    test('Cache should handle mixed read/write operations', async () => {
      const operations = 200;
      const promises: Promise<any>[] = [];

      const start = performance.now();

      for (let i = 0; i < operations; i++) {
        if (i % 3 === 0) {
          // Write operation
          promises.push(
            redisClient.set(`test:mixed:${i}`, JSON.stringify({ id: i, type: 'write' }))
          );
        } else {
          // Read operation
          promises.push(
            redisClient.get(`test:mixed:${Math.floor(i / 3)}`)
          );
        }
      }

      const results = await Promise.all(promises);
      const totalTime = performance.now() - start;

      expect(results).toHaveLength(operations);
      expect(totalTime).toBeLessThan(2000); // Should complete within 2 seconds
      
      console.log(`${operations} mixed operations: ${totalTime.toFixed(2)}ms`);
    });
  });

  describe('Cache Hit Rate Analysis', () => {
    test('Simulated application cache patterns should show good hit rates', async () => {
      const cacheStats = {
        hits: 0,
        misses: 0,
        sets: 0,
      };

      // Simulate typical application access patterns
      const accessPatterns = [
        { key: 'dashboard:metrics', frequency: 0.3 }, // 30% of requests
        { key: 'user:profile:123', frequency: 0.2 }, // 20% of requests
        { key: 'tickets:recent', frequency: 0.25 }, // 25% of requests
        { key: 'analytics:summary', frequency: 0.15 }, // 15% of requests
        { key: 'notifications:count', frequency: 0.1 }, // 10% of requests
      ];

      // Pre-populate some cache entries
      for (const pattern of accessPatterns.slice(0, 3)) {
        await redisClient.set(pattern.key, JSON.stringify({ cached: true, timestamp: Date.now() }));
        cacheStats.sets++;
      }

      // Simulate 1000 cache requests
      for (let i = 0; i < 1000; i++) {
        const random = Math.random();
        let cumulativeFreq = 0;
        
        for (const pattern of accessPatterns) {
          cumulativeFreq += pattern.frequency;
          if (random <= cumulativeFreq) {
            const result = await redisClient.get(pattern.key);
            
            if (result) {
              cacheStats.hits++;
            } else {
              cacheStats.misses++;
              // Cache miss - set the value
              await redisClient.set(pattern.key, JSON.stringify({ 
                cached: true, 
                timestamp: Date.now(),
                missCount: cacheStats.misses 
              }), { EX: 300 });
              cacheStats.sets++;
            }
            break;
          }
        }
      }

      const hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);
      
      console.log('Cache Statistics:', {
        hits: cacheStats.hits,
        misses: cacheStats.misses,
        sets: cacheStats.sets,
        hitRate: `${(hitRate * 100).toFixed(2)}%`
      });

      expect(hitRate).toBeGreaterThan(0.6); // Should have at least 60% hit rate
    });
  });

  describe('Cache Expiration and Memory Management', () => {
    test('TTL-based expiration should work correctly', async () => {
      const key = 'test:ttl:expiration';
      const value = JSON.stringify({ expires: true });

      // Set with 2 second expiration
      await redisClient.set(key, value, { EX: 2 });
      
      // Should exist immediately
      let result = await redisClient.get(key);
      expect(result).toBe(value);

      // Should still exist after 1 second
      await new Promise(resolve => setTimeout(resolve, 1000));
      result = await redisClient.get(key);
      expect(result).toBe(value);

      // Should be expired after 3 seconds
      await new Promise(resolve => setTimeout(resolve, 2500));
      result = await redisClient.get(key);
      expect(result).toBeNull();
    });

    test('Cache should handle large data sets efficiently', async () => {
      const largeDataSets = [
        { size: '1KB', data: 'x'.repeat(1024) },
        { size: '10KB', data: 'x'.repeat(10240) },
        { size: '100KB', data: 'x'.repeat(102400) },
        { size: '1MB', data: 'x'.repeat(1048576) },
      ];

      for (const dataset of largeDataSets) {
        const key = `test:large:${dataset.size}`;
        
        const setStart = performance.now();
        await redisClient.set(key, dataset.data);
        const setTime = performance.now() - setStart;

        const getStart = performance.now();
        const result = await redisClient.get(key);
        const getTime = performance.now() - getStart;

        expect(result).toBe(dataset.data);
        
        console.log(`${dataset.size}: SET=${setTime.toFixed(2)}ms, GET=${getTime.toFixed(2)}ms`);
        
        // Performance expectations based on data size
        if (dataset.size === '1KB') {
          expect(setTime).toBeLessThan(10);
          expect(getTime).toBeLessThan(10);
        } else if (dataset.size === '1MB') {
          expect(setTime).toBeLessThan(100);
          expect(getTime).toBeLessThan(50);
        }
      }
    });
  });

  describe('Cache Invalidation Patterns', () => {
    test('Pattern-based cache invalidation should be efficient', async () => {
      // Set up cache entries with patterns
      const patterns = [
        'user:123:*',
        'tickets:status:*',
        'analytics:daily:*',
      ];

      // Populate cache with pattern-based keys
      for (let i = 0; i < 50; i++) {
        await redisClient.set(`user:123:profile:${i}`, JSON.stringify({ userId: 123, profileId: i }));
        await redisClient.set(`tickets:status:open:${i}`, JSON.stringify({ status: 'open', ticketId: i }));
        await redisClient.set(`analytics:daily:${i}`, JSON.stringify({ day: i, metrics: {} }));
      }

      // Test pattern-based deletion
      for (const pattern of patterns) {
        const start = performance.now();
        
        // Get keys matching pattern
        const keys = await redisClient.keys(pattern);
        
        if (keys.length > 0) {
          // Delete matching keys
          await redisClient.del(keys);
        }
        
        const time = performance.now() - start;
        
        console.log(`Pattern ${pattern}: found ${keys.length} keys, deleted in ${time.toFixed(2)}ms`);
        
        expect(time).toBeLessThan(100); // Should be fast even for many keys
        
        // Verify deletion
        const remainingKeys = await redisClient.keys(pattern);
        expect(remainingKeys).toHaveLength(0);
      }
    });
  });

  describe('Cache Performance Under Load', () => {
    test('Cache should maintain performance under sustained load', async () => {
      const loadTestDuration = 10000; // 10 seconds
      const requestsPerSecond = 100;
      const interval = 1000 / requestsPerSecond;

      const stats = {
        requests: 0,
        errors: 0,
        totalTime: 0,
        maxTime: 0,
        minTime: Infinity,
      };

      const startTime = Date.now();
      const promises: Promise<void>[] = [];

      while (Date.now() - startTime < loadTestDuration) {
        const promise = (async () => {
          const requestStart = performance.now();
          
          try {
            const operation = Math.random();
            
            if (operation < 0.7) {
              // 70% reads
              await redisClient.get(`load:test:${Math.floor(Math.random() * 100)}`);
            } else if (operation < 0.9) {
              // 20% writes
              await redisClient.set(
                `load:test:${Math.floor(Math.random() * 100)}`,
                JSON.stringify({ timestamp: Date.now(), random: Math.random() }),
                { EX: 60 }
              );
            } else {
              // 10% deletes
              await redisClient.del(`load:test:${Math.floor(Math.random() * 100)}`);
            }
            
            const requestTime = performance.now() - requestStart;
            stats.totalTime += requestTime;
            stats.maxTime = Math.max(stats.maxTime, requestTime);
            stats.minTime = Math.min(stats.minTime, requestTime);
            stats.requests++;
            
          } catch (error) {
            stats.errors++;
          }
        })();

        promises.push(promise);
        
        // Control request rate
        await new Promise(resolve => setTimeout(resolve, interval));
      }

      await Promise.all(promises);

      const avgTime = stats.totalTime / stats.requests;
      const errorRate = (stats.errors / (stats.requests + stats.errors)) * 100;

      console.log('Load Test Results:', {
        requests: stats.requests,
        errors: stats.errors,
        errorRate: `${errorRate.toFixed(2)}%`,
        avgTime: `${avgTime.toFixed(2)}ms`,
        maxTime: `${stats.maxTime.toFixed(2)}ms`,
        minTime: `${stats.minTime.toFixed(2)}ms`,
      });

      expect(errorRate).toBeLessThan(1); // Less than 1% error rate
      expect(avgTime).toBeLessThan(20); // Average response time under 20ms
      expect(stats.maxTime).toBeLessThan(100); // Max response time under 100ms
    });
  });

  // Helper function to generate test data
  function generateTestData(count: number): Map<string, any> {
    const data = new Map();
    
    for (let i = 0; i < count; i++) {
      data.set(`test:data:${i}`, {
        id: i,
        name: `Test Item ${i}`,
        description: `This is test data item number ${i}`,
        timestamp: Date.now(),
        metadata: {
          category: ['A', 'B', 'C'][i % 3],
          priority: Math.floor(Math.random() * 5) + 1,
          tags: [`tag${i % 10}`, `category${i % 5}`],
        },
      });
    }
    
    return data;
  }
});