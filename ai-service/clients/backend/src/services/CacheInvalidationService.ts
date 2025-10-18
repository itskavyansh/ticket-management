import { getCacheService, CacheService, CacheTTL } from './CacheService';
import { logger } from '../utils/logger';
import { EventEmitter } from 'events';

export interface InvalidationRule {
  pattern: string;
  triggers: string[];
  dependencies?: string[];
  ttl?: number;
}

export interface CacheWarmingConfig {
  key: string;
  dataLoader: () => Promise<any>;
  ttl: number;
  warmOnStart?: boolean;
  refreshInterval?: number;
}

export class CacheInvalidationService extends EventEmitter {
  private cache: CacheService;
  private invalidationRules: Map<string, InvalidationRule> = new Map();
  private warmingConfigs: Map<string, CacheWarmingConfig> = new Map();
  private warmingIntervals: Map<string, NodeJS.Timeout> = new Map();

  constructor() {
    super();
    this.cache = getCacheService();
    this.setupDefaultRules();
  }

  /**
   * Setup default invalidation rules for common patterns
   */
  private setupDefaultRules(): void {
    // Ticket-related cache invalidation
    this.addInvalidationRule('tickets', {
      pattern: 'tickets:*',
      triggers: ['ticket:created', 'ticket:updated', 'ticket:deleted', 'ticket:assigned'],
      dependencies: ['dashboard:*', 'analytics:*', 'sla:*']
    });

    // Technician workload cache invalidation
    this.addInvalidationRule('workload', {
      pattern: 'workload:*',
      triggers: ['ticket:assigned', 'ticket:completed', 'time:tracked'],
      dependencies: ['dashboard:technician:*', 'analytics:workload:*']
    });

    // SLA monitoring cache invalidation
    this.addInvalidationRule('sla', {
      pattern: 'sla:*',
      triggers: ['ticket:created', 'ticket:updated', 'sla:calculated'],
      dependencies: ['dashboard:sla:*', 'alerts:sla:*']
    });

    // Analytics cache invalidation
    this.addInvalidationRule('analytics', {
      pattern: 'analytics:*',
      triggers: ['ticket:completed', 'metrics:calculated', 'report:generated'],
      ttl: CacheTTL.MEDIUM
    });

    // Dashboard cache invalidation
    this.addInvalidationRule('dashboard', {
      pattern: 'dashboard:*',
      triggers: ['ticket:updated', 'metrics:updated', 'alert:triggered'],
      ttl: CacheTTL.SHORT
    });

    // User session cache invalidation
    this.addInvalidationRule('user', {
      pattern: 'user:*',
      triggers: ['user:updated', 'role:changed', 'permissions:updated']
    });
  }

  /**
   * Add a new invalidation rule
   */
  addInvalidationRule(name: string, rule: InvalidationRule): void {
    this.invalidationRules.set(name, rule);
    
    // Listen for trigger events
    rule.triggers.forEach(trigger => {
      this.on(trigger, () => this.handleInvalidation(name, rule));
    });

    logger.info('Cache invalidation rule added', { name, rule });
  }

  /**
   * Remove an invalidation rule
   */
  removeInvalidationRule(name: string): boolean {
    const rule = this.invalidationRules.get(name);
    if (!rule) {
      return false;
    }

    // Remove event listeners
    rule.triggers.forEach(trigger => {
      this.removeAllListeners(trigger);
    });

    this.invalidationRules.delete(name);
    logger.info('Cache invalidation rule removed', { name });
    return true;
  }

  /**
   * Handle cache invalidation for a specific rule
   */
  private async handleInvalidation(ruleName: string, rule: InvalidationRule): Promise<void> {
    try {
      logger.info('Handling cache invalidation', { ruleName, pattern: rule.pattern });

      // Invalidate primary pattern
      await this.invalidatePattern(rule.pattern);

      // Invalidate dependencies
      if (rule.dependencies) {
        for (const dependency of rule.dependencies) {
          await this.invalidatePattern(dependency);
        }
      }

      // Emit invalidation event for other services
      this.emit('cache:invalidated', { ruleName, pattern: rule.pattern });

    } catch (error) {
      logger.error('Cache invalidation failed', { ruleName, error });
    }
  }

  /**
   * Invalidate cache entries matching a pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    try {
      const deletedCount = await this.cache.clear(pattern);
      logger.info('Cache pattern invalidated', { pattern, deletedCount });
      return deletedCount;
    } catch (error) {
      logger.error('Failed to invalidate cache pattern', { pattern, error });
      return 0;
    }
  }

  /**
   * Invalidate specific cache key
   */
  async invalidateKey(key: string, prefix?: string): Promise<boolean> {
    try {
      const result = await this.cache.delete(key, { prefix });
      logger.info('Cache key invalidated', { key, prefix });
      return result;
    } catch (error) {
      logger.error('Failed to invalidate cache key', { key, prefix, error });
      return false;
    }
  }

  /**
   * Trigger invalidation by event
   */
  triggerInvalidation(event: string, data?: any): void {
    logger.info('Cache invalidation triggered', { event, data });
    this.emit(event, data);
  }

  /**
   * Add cache warming configuration
   */
  addCacheWarming(config: CacheWarmingConfig): void {
    this.warmingConfigs.set(config.key, config);

    // Warm cache immediately if configured
    if (config.warmOnStart) {
      this.warmCache(config.key);
    }

    // Set up refresh interval if configured
    if (config.refreshInterval) {
      const interval = setInterval(() => {
        this.warmCache(config.key);
      }, config.refreshInterval * 1000);
      
      this.warmingIntervals.set(config.key, interval);
    }

    logger.info('Cache warming configuration added', { 
      key: config.key, 
      ttl: config.ttl,
      refreshInterval: config.refreshInterval 
    });
  }

  /**
   * Remove cache warming configuration
   */
  removeCacheWarming(key: string): boolean {
    const config = this.warmingConfigs.get(key);
    if (!config) {
      return false;
    }

    // Clear refresh interval
    const interval = this.warmingIntervals.get(key);
    if (interval) {
      clearInterval(interval);
      this.warmingIntervals.delete(key);
    }

    this.warmingConfigs.delete(key);
    logger.info('Cache warming configuration removed', { key });
    return true;
  }

  /**
   * Warm specific cache entry
   */
  async warmCache(key: string): Promise<boolean> {
    try {
      const config = this.warmingConfigs.get(key);
      if (!config) {
        logger.warn('No warming configuration found for key', { key });
        return false;
      }

      logger.info('Warming cache', { key });
      const data = await config.dataLoader();
      
      await this.cache.set(key, data, { ttl: config.ttl });
      
      logger.info('Cache warmed successfully', { key });
      return true;
    } catch (error) {
      logger.error('Failed to warm cache', { key, error });
      return false;
    }
  }

  /**
   * Warm all configured cache entries
   */
  async warmAllCaches(): Promise<{ success: number; failed: number }> {
    const results = { success: 0, failed: 0 };

    for (const key of this.warmingConfigs.keys()) {
      const success = await this.warmCache(key);
      if (success) {
        results.success++;
      } else {
        results.failed++;
      }
    }

    logger.info('Cache warming completed', results);
    return results;
  }

  /**
   * Get cache warming status
   */
  getCacheWarmingStatus(): Array<{
    key: string;
    config: CacheWarmingConfig;
    hasInterval: boolean;
  }> {
    return Array.from(this.warmingConfigs.entries()).map(([key, config]) => ({
      key,
      config,
      hasInterval: this.warmingIntervals.has(key)
    }));
  }

  /**
   * Smart cache refresh based on usage patterns
   */
  async smartRefresh(key: string, accessCount: number, threshold: number = 10): Promise<boolean> {
    try {
      // Only refresh if the cache is accessed frequently
      if (accessCount < threshold) {
        return false;
      }

      const config = this.warmingConfigs.get(key);
      if (!config) {
        return false;
      }

      // Check if cache is about to expire (within 10% of TTL)
      const ttlRemaining = await this.cache.getClient().ttl(key);
      const refreshThreshold = config.ttl * 0.1;

      if (ttlRemaining > refreshThreshold) {
        return false;
      }

      // Refresh cache in background
      setImmediate(async () => {
        await this.warmCache(key);
      });

      return true;
    } catch (error) {
      logger.error('Smart cache refresh failed', { key, error });
      return false;
    }
  }

  /**
   * Cleanup all intervals and listeners
   */
  cleanup(): void {
    // Clear all warming intervals
    for (const interval of this.warmingIntervals.values()) {
      clearInterval(interval);
    }
    this.warmingIntervals.clear();

    // Remove all event listeners
    this.removeAllListeners();

    logger.info('Cache invalidation service cleaned up');
  }
}

// Singleton cache invalidation service instance
let cacheInvalidationServiceInstance: CacheInvalidationService | null = null;

export const getCacheInvalidationService = (): CacheInvalidationService => {
  if (!cacheInvalidationServiceInstance) {
    cacheInvalidationServiceInstance = new CacheInvalidationService();
  }
  return cacheInvalidationServiceInstance;
};

// Common cache warming configurations
export const CommonCacheWarmingConfigs = {
  DASHBOARD_METRICS: {
    key: 'dashboard:metrics',
    ttl: CacheTTL.SHORT,
    warmOnStart: true,
    refreshInterval: 300 // 5 minutes
  },
  
  TECHNICIAN_WORKLOAD: {
    key: 'workload:summary',
    ttl: CacheTTL.MEDIUM,
    warmOnStart: true,
    refreshInterval: 600 // 10 minutes
  },
  
  SLA_COMPLIANCE: {
    key: 'sla:compliance',
    ttl: CacheTTL.MEDIUM,
    warmOnStart: true,
    refreshInterval: 900 // 15 minutes
  },
  
  ANALYTICS_SUMMARY: {
    key: 'analytics:summary',
    ttl: CacheTTL.LONG,
    warmOnStart: false,
    refreshInterval: 1800 // 30 minutes
  }
} as const;