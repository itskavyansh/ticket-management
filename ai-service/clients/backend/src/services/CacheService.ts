import { RedisClientType } from 'redis';
import { getRedisClient } from '../config/redis';
import { logger } from '../utils/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  prefix?: string;
  compress?: boolean;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
}

export class CacheService {
  private client: RedisClientType;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  constructor() {
    this.client = getRedisClient().getClient();
  }

  /**
   * Generate cache key with optional prefix
   */
  private generateKey(key: string, prefix?: string): string {
    const basePrefix = process.env.CACHE_PREFIX || 'ai-ticket-mgmt';
    const fullPrefix = prefix ? `${basePrefix}:${prefix}` : basePrefix;
    return `${fullPrefix}:${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string, options: CacheOptions = {}): Promise<T | null> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      const value = await this.client.get(cacheKey);
      
      if (value === null) {
        this.stats.misses++;
        return null;
      }

      this.stats.hits++;
      return JSON.parse(value) as T;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache get error:', { key, error });
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set(key: string, value: any, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      const serializedValue = JSON.stringify(value);
      
      if (options.ttl) {
        await this.client.setEx(cacheKey, options.ttl, serializedValue);
      } else {
        await this.client.set(cacheKey, serializedValue);
      }

      this.stats.sets++;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache set error:', { key, error });
      return false;
    }
  }

  /**
   * Delete value from cache
   */
  async delete(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      const result = await this.client.del(cacheKey);
      
      this.stats.deletes++;
      return result > 0;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache delete error:', { key, error });
      return false;
    }
  }

  /**
   * Check if key exists in cache
   */
  async exists(key: string, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      const result = await this.client.exists(cacheKey);
      return result === 1;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache exists error:', { key, error });
      return false;
    }
  }

  /**
   * Set expiration time for existing key
   */
  async expire(key: string, ttl: number, options: CacheOptions = {}): Promise<boolean> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      const result = await this.client.expire(cacheKey, ttl);
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache expire error:', { key, error });
      return false;
    }
  }

  /**
   * Get multiple values from cache
   */
  async mget<T>(keys: string[], options: CacheOptions = {}): Promise<(T | null)[]> {
    try {
      const cacheKeys = keys.map(key => this.generateKey(key, options.prefix));
      const values = await this.client.mGet(cacheKeys);
      
      return values.map(value => {
        if (value === null) {
          this.stats.misses++;
          return null;
        }
        this.stats.hits++;
        return JSON.parse(value) as T;
      });
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mget error:', { keys, error });
      return keys.map(() => null);
    }
  }

  /**
   * Set multiple values in cache
   */
  async mset(keyValuePairs: Record<string, any>, options: CacheOptions = {}): Promise<boolean> {
    try {
      const pipeline = this.client.multi();
      
      Object.entries(keyValuePairs).forEach(([key, value]) => {
        const cacheKey = this.generateKey(key, options.prefix);
        const serializedValue = JSON.stringify(value);
        
        if (options.ttl) {
          pipeline.setEx(cacheKey, options.ttl, serializedValue);
        } else {
          pipeline.set(cacheKey, serializedValue);
        }
      });

      await pipeline.exec();
      this.stats.sets += Object.keys(keyValuePairs).length;
      return true;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mset error:', { keyValuePairs, error });
      return false;
    }
  }

  /**
   * Delete multiple keys from cache
   */
  async mdel(keys: string[], options: CacheOptions = {}): Promise<number> {
    try {
      const cacheKeys = keys.map(key => this.generateKey(key, options.prefix));
      const result = await this.client.del(cacheKeys);
      
      this.stats.deletes += result;
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache mdel error:', { keys, error });
      return 0;
    }
  }

  /**
   * Increment numeric value in cache
   */
  async increment(key: string, amount: number = 1, options: CacheOptions = {}): Promise<number> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      const result = await this.client.incrBy(cacheKey, amount);
      
      if (options.ttl) {
        await this.client.expire(cacheKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache increment error:', { key, amount, error });
      return 0;
    }
  }

  /**
   * Add item to a set
   */
  async sadd(key: string, members: string[], options: CacheOptions = {}): Promise<number> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      const result = await this.client.sAdd(cacheKey, members);
      
      if (options.ttl) {
        await this.client.expire(cacheKey, options.ttl);
      }
      
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache sadd error:', { key, members, error });
      return 0;
    }
  }

  /**
   * Get all members of a set
   */
  async smembers(key: string, options: CacheOptions = {}): Promise<string[]> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      return await this.client.sMembers(cacheKey);
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache smembers error:', { key, error });
      return [];
    }
  }

  /**
   * Remove items from a set
   */
  async srem(key: string, members: string[], options: CacheOptions = {}): Promise<number> {
    try {
      const cacheKey = this.generateKey(key, options.prefix);
      return await this.client.sRem(cacheKey, members);
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache srem error:', { key, members, error });
      return 0;
    }
  }

  /**
   * Clear all cache entries with optional pattern
   */
  async clear(pattern?: string): Promise<number> {
    try {
      const searchPattern = pattern 
        ? this.generateKey(pattern, '')
        : this.generateKey('*', '');
      
      const keys = await this.client.keys(searchPattern);
      
      if (keys.length === 0) {
        return 0;
      }
      
      const result = await this.client.del(keys);
      this.stats.deletes += result;
      return result;
    } catch (error) {
      this.stats.errors++;
      logger.error('Cache clear error:', { pattern, error });
      return 0;
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0
    };
  }

  /**
   * Get cache hit ratio
   */
  getHitRatio(): number {
    const total = this.stats.hits + this.stats.misses;
    return total > 0 ? this.stats.hits / total : 0;
  }
}

// Singleton cache service instance
let cacheServiceInstance: CacheService | null = null;

export const getCacheService = (): CacheService => {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
};

// Cache TTL constants (in seconds)
export const CacheTTL = {
  SHORT: 300,      // 5 minutes
  MEDIUM: 1800,    // 30 minutes
  LONG: 3600,      // 1 hour
  VERY_LONG: 86400 // 24 hours
} as const;