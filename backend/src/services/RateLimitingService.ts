import { Request, Response, NextFunction } from 'express';
import { getCacheService, CacheService } from './CacheService';
import { logger } from '../utils/logger';

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyGenerator?: (req: Request) => string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  onLimitReached?: (req: Request, res: Response) => void;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
}

export interface ThrottleConfig {
  delayMs: number;
  maxDelayMs?: number;
  delayAfter?: number;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}

export interface RateLimitInfo {
  totalHits: number;
  totalHitsInWindow: number;
  remainingPoints: number;
  msBeforeNext: number;
  isFirstInWindow: boolean;
}

export interface BurstProtectionConfig {
  burstLimit: number;
  burstWindowMs: number;
  sustainedLimit: number;
  sustainedWindowMs: number;
}

export class RateLimitingService {
  private cache: CacheService;
  private readonly keyPrefix = 'rate_limit';

  constructor() {
    this.cache = getCacheService();
  }

  /**
   * Create rate limiting middleware
   */
  createRateLimit(config: RateLimitConfig) {
    const {
      windowMs,
      maxRequests,
      keyGenerator = this.defaultKeyGenerator,
      skipSuccessfulRequests = false,
      skipFailedRequests = false,
      onLimitReached,
      message = 'Too many requests, please try again later.',
      standardHeaders = true,
      legacyHeaders = false
    } = config;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = keyGenerator(req);
        const now = Date.now();
        const windowStart = now - windowMs;

        // Get current rate limit info
        const rateLimitInfo = await this.getRateLimitInfo(key, windowStart, windowMs);

        // Set headers
        if (standardHeaders) {
          res.set('RateLimit-Limit', maxRequests.toString());
          res.set('RateLimit-Remaining', Math.max(0, maxRequests - rateLimitInfo.totalHitsInWindow).toString());
          res.set('RateLimit-Reset', new Date(now + rateLimitInfo.msBeforeNext).toISOString());
        }

        if (legacyHeaders) {
          res.set('X-RateLimit-Limit', maxRequests.toString());
          res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - rateLimitInfo.totalHitsInWindow).toString());
          res.set('X-RateLimit-Reset', Math.ceil((now + rateLimitInfo.msBeforeNext) / 1000).toString());
        }

        // Check if limit exceeded
        if (rateLimitInfo.totalHitsInWindow >= maxRequests) {
          res.set('Retry-After', Math.ceil(rateLimitInfo.msBeforeNext / 1000).toString());
          
          if (onLimitReached) {
            onLimitReached(req, res);
          }

          logger.warn('Rate limit exceeded', {
            key,
            totalHits: rateLimitInfo.totalHitsInWindow,
            maxRequests,
            ip: req.ip,
            userAgent: req.get('User-Agent')
          });

          return res.status(429).json({
            error: 'Rate limit exceeded',
            message,
            retryAfter: Math.ceil(rateLimitInfo.msBeforeNext / 1000)
          });
        }

        // Increment counter
        await this.incrementCounter(key, now, windowMs);

        // Store original end method to track response status
        const originalEnd = res.end.bind(res);
        res.end = function(chunk?: any, encoding?: any) {
          const shouldSkip = (skipSuccessfulRequests && res.statusCode < 400) ||
                           (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            // Decrement counter if we should skip this request
            setImmediate(async () => {
              try {
                await this.decrementCounter(key, windowMs);
              } catch (error) {
                logger.error('Failed to decrement rate limit counter', { key, error });
              }
            });
          }

          return originalEnd(chunk, encoding);
        };

        next();
      } catch (error) {
        logger.error('Rate limiting middleware error', { error });
        next(); // Continue on error to avoid blocking requests
      }
    };
  }

  /**
   * Create throttling middleware with progressive delays
   */
  createThrottle(config: ThrottleConfig) {
    const {
      delayMs,
      maxDelayMs = delayMs * 10,
      delayAfter = 1,
      skipSuccessfulRequests = false,
      skipFailedRequests = false
    } = config;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.defaultKeyGenerator(req);
        const hitCount = await this.getHitCount(key, 60000); // 1 minute window

        if (hitCount > delayAfter) {
          const delay = Math.min(delayMs * (hitCount - delayAfter), maxDelayMs);
          
          logger.debug('Throttling request', {
            key,
            hitCount,
            delay,
            ip: req.ip
          });

          await this.delay(delay);
        }

        // Track the request
        await this.incrementCounter(key, Date.now(), 60000);

        // Store original end method to track response status
        const originalEnd = res.end.bind(res);
        res.end = function(chunk?: any, encoding?: any) {
          const shouldSkip = (skipSuccessfulRequests && res.statusCode < 400) ||
                           (skipFailedRequests && res.statusCode >= 400);

          if (shouldSkip) {
            setImmediate(async () => {
              try {
                await this.decrementCounter(key, 60000);
              } catch (error) {
                logger.error('Failed to decrement throttle counter', { key, error });
              }
            });
          }

          return originalEnd(chunk, encoding);
        };

        next();
      } catch (error) {
        logger.error('Throttling middleware error', { error });
        next();
      }
    };
  }

  /**
   * Create burst protection middleware
   */
  createBurstProtection(config: BurstProtectionConfig) {
    const { burstLimit, burstWindowMs, sustainedLimit, sustainedWindowMs } = config;

    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        const key = this.defaultKeyGenerator(req);
        const now = Date.now();

        // Check burst limit (short window)
        const burstHits = await this.getHitCount(key, burstWindowMs);
        if (burstHits >= burstLimit) {
          logger.warn('Burst limit exceeded', {
            key,
            burstHits,
            burstLimit,
            ip: req.ip
          });

          return res.status(429).json({
            error: 'Burst limit exceeded',
            message: 'Too many requests in a short time period',
            retryAfter: Math.ceil(burstWindowMs / 1000)
          });
        }

        // Check sustained limit (long window)
        const sustainedHits = await this.getHitCount(key, sustainedWindowMs);
        if (sustainedHits >= sustainedLimit) {
          logger.warn('Sustained limit exceeded', {
            key,
            sustainedHits,
            sustainedLimit,
            ip: req.ip
          });

          return res.status(429).json({
            error: 'Sustained limit exceeded',
            message: 'Too many requests over time',
            retryAfter: Math.ceil(sustainedWindowMs / 1000)
          });
        }

        // Track the request
        await this.incrementCounter(key, now, Math.max(burstWindowMs, sustainedWindowMs));

        next();
      } catch (error) {
        logger.error('Burst protection middleware error', { error });
        next();
      }
    };
  }

  /**
   * Create adaptive rate limiting based on system load
   */
  createAdaptiveRateLimit(baseConfig: RateLimitConfig, loadThresholds: {
    cpu: number;
    memory: number;
    responseTime: number;
  }) {
    return async (req: Request, res: Response, next: NextFunction) => {
      try {
        // Get system metrics (simplified - in production, use proper monitoring)
        const systemLoad = await this.getSystemLoad();
        
        // Adjust rate limit based on system load
        let adjustedMaxRequests = baseConfig.maxRequests;
        
        if (systemLoad.cpu > loadThresholds.cpu || 
            systemLoad.memory > loadThresholds.memory ||
            systemLoad.responseTime > loadThresholds.responseTime) {
          
          // Reduce rate limit when system is under stress
          adjustedMaxRequests = Math.floor(baseConfig.maxRequests * 0.5);
          
          logger.info('Adaptive rate limiting activated', {
            originalLimit: baseConfig.maxRequests,
            adjustedLimit: adjustedMaxRequests,
            systemLoad
          });
        }

        // Create dynamic config
        const adaptiveConfig = {
          ...baseConfig,
          maxRequests: adjustedMaxRequests
        };

        // Apply rate limiting with adjusted config
        return this.createRateLimit(adaptiveConfig)(req, res, next);
      } catch (error) {
        logger.error('Adaptive rate limiting error', { error });
        // Fall back to base rate limiting
        return this.createRateLimit(baseConfig)(req, res, next);
      }
    };
  }

  /**
   * Get rate limit information for a key
   */
  private async getRateLimitInfo(key: string, windowStart: number, windowMs: number): Promise<RateLimitInfo> {
    try {
      const cacheKey = `${this.keyPrefix}:${key}`;
      const hits = await this.cache.get<number[]>(cacheKey) || [];
      
      // Filter hits within the current window
      const hitsInWindow = hits.filter(hit => hit > windowStart);
      const totalHits = hits.length;
      const totalHitsInWindow = hitsInWindow.length;
      
      // Calculate time until window resets
      const oldestHitInWindow = Math.min(...hitsInWindow);
      const msBeforeNext = oldestHitInWindow ? (oldestHitInWindow + windowMs) - Date.now() : windowMs;
      
      return {
        totalHits,
        totalHitsInWindow,
        remainingPoints: Math.max(0, totalHitsInWindow),
        msBeforeNext: Math.max(0, msBeforeNext),
        isFirstInWindow: totalHitsInWindow === 0
      };
    } catch (error) {
      logger.error('Failed to get rate limit info', { key, error });
      return {
        totalHits: 0,
        totalHitsInWindow: 0,
        remainingPoints: 0,
        msBeforeNext: windowMs,
        isFirstInWindow: true
      };
    }
  }

  /**
   * Increment counter for a key
   */
  private async incrementCounter(key: string, timestamp: number, windowMs: number): Promise<void> {
    try {
      const cacheKey = `${this.keyPrefix}:${key}`;
      const hits = await this.cache.get<number[]>(cacheKey) || [];
      
      // Add new hit
      hits.push(timestamp);
      
      // Remove old hits outside the window
      const windowStart = timestamp - windowMs;
      const filteredHits = hits.filter(hit => hit > windowStart);
      
      // Store updated hits with TTL
      await this.cache.set(cacheKey, filteredHits, { ttl: Math.ceil(windowMs / 1000) });
    } catch (error) {
      logger.error('Failed to increment rate limit counter', { key, error });
    }
  }

  /**
   * Decrement counter for a key
   */
  private async decrementCounter(key: string, windowMs: number): Promise<void> {
    try {
      const cacheKey = `${this.keyPrefix}:${key}`;
      const hits = await this.cache.get<number[]>(cacheKey) || [];
      
      if (hits.length > 0) {
        // Remove the most recent hit
        hits.pop();
        
        if (hits.length === 0) {
          await this.cache.delete(cacheKey);
        } else {
          await this.cache.set(cacheKey, hits, { ttl: Math.ceil(windowMs / 1000) });
        }
      }
    } catch (error) {
      logger.error('Failed to decrement rate limit counter', { key, error });
    }
  }

  /**
   * Get hit count for a key within a window
   */
  private async getHitCount(key: string, windowMs: number): Promise<number> {
    try {
      const cacheKey = `${this.keyPrefix}:${key}`;
      const hits = await this.cache.get<number[]>(cacheKey) || [];
      const windowStart = Date.now() - windowMs;
      
      return hits.filter(hit => hit > windowStart).length;
    } catch (error) {
      logger.error('Failed to get hit count', { key, error });
      return 0;
    }
  }

  /**
   * Default key generator based on IP and user ID
   */
  private defaultKeyGenerator(req: Request): string {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const userId = (req as any).user?.id || 'anonymous';
    return `${ip}:${userId}`;
  }

  /**
   * Get system load metrics (simplified implementation)
   */
  private async getSystemLoad(): Promise<{
    cpu: number;
    memory: number;
    responseTime: number;
  }> {
    // In a real implementation, you would use proper system monitoring
    // This is a simplified version for demonstration
    const memUsage = process.memoryUsage();
    const memoryPercent = (memUsage.heapUsed / memUsage.heapTotal) * 100;
    
    return {
      cpu: 0, // Would use os.loadavg() or similar
      memory: memoryPercent,
      responseTime: 0 // Would track actual response times
    };
  }

  /**
   * Utility delay function
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Clear rate limit data for a key
   */
  async clearRateLimit(key: string): Promise<void> {
    try {
      const cacheKey = `${this.keyPrefix}:${key}`;
      await this.cache.delete(cacheKey);
      logger.info('Rate limit cleared', { key });
    } catch (error) {
      logger.error('Failed to clear rate limit', { key, error });
    }
  }

  /**
   * Get rate limit status for a key
   */
  async getRateLimitStatus(key: string, windowMs: number): Promise<{
    hits: number;
    remaining: number;
    resetTime: Date;
  }> {
    try {
      const rateLimitInfo = await this.getRateLimitInfo(key, Date.now() - windowMs, windowMs);
      
      return {
        hits: rateLimitInfo.totalHitsInWindow,
        remaining: rateLimitInfo.remainingPoints,
        resetTime: new Date(Date.now() + rateLimitInfo.msBeforeNext)
      };
    } catch (error) {
      logger.error('Failed to get rate limit status', { key, error });
      return {
        hits: 0,
        remaining: 0,
        resetTime: new Date()
      };
    }
  }
}

// Singleton rate limiting service
let rateLimitingServiceInstance: RateLimitingService | null = null;

export const getRateLimitingService = (): RateLimitingService => {
  if (!rateLimitingServiceInstance) {
    rateLimitingServiceInstance = new RateLimitingService();
  }
  return rateLimitingServiceInstance;
};

// Pre-configured rate limiting middleware
export const RateLimitPresets = {
  // Strict rate limiting for authentication endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later.',
    standardHeaders: true
  },

  // General API rate limiting
  api: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'API rate limit exceeded, please slow down.',
    standardHeaders: true
  },

  // Lenient rate limiting for dashboard/UI endpoints
  dashboard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 200,
    skipSuccessfulRequests: true,
    standardHeaders: true
  },

  // Strict rate limiting for sensitive operations
  sensitive: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 10,
    message: 'Sensitive operation rate limit exceeded.',
    standardHeaders: true
  },

  // Rate limiting for webhook endpoints
  webhook: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 300,
    keyGenerator: (req: Request) => req.ip || 'unknown',
    standardHeaders: false
  }
} as const;