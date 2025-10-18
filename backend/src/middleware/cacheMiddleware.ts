import { Request, Response, NextFunction } from 'express';
import { getCacheService, CacheService, CacheTTL } from '../services/CacheService';
import { getCacheInvalidationService } from '../services/CacheInvalidationService';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export interface CacheMiddlewareOptions {
  ttl?: number;
  prefix?: string;
  keyGenerator?: (req: Request) => string;
  condition?: (req: Request, res: Response) => boolean;
  skipCache?: (req: Request) => boolean;
  varyBy?: string[];
  compress?: boolean;
}

export interface CacheHeaders {
  'X-Cache-Status': 'HIT' | 'MISS' | 'BYPASS';
  'X-Cache-TTL'?: string;
  'X-Cache-Key'?: string;
}

/**
 * Generate cache key from request
 */
function generateCacheKey(req: Request, options: CacheMiddlewareOptions): string {
  if (options.keyGenerator) {
    return options.keyGenerator(req);
  }

  // Default key generation
  const baseKey = `${req.method}:${req.path}`;
  
  // Include query parameters
  const queryString = Object.keys(req.query)
    .sort()
    .map(key => `${key}=${req.query[key]}`)
    .join('&');

  // Include vary-by headers
  const varyHeaders = options.varyBy?.map(header => 
    `${header}:${req.get(header) || ''}`
  ).join('|') || '';

  // Include user context if authenticated
  const userContext = req.user ? `user:${req.user.id}` : '';

  const fullKey = [baseKey, queryString, varyHeaders, userContext]
    .filter(Boolean)
    .join('|');

  // Hash long keys to keep them manageable
  if (fullKey.length > 200) {
    return crypto.createHash('md5').update(fullKey).digest('hex');
  }

  return fullKey;
}

/**
 * Check if response should be cached
 */
function shouldCacheResponse(req: Request, res: Response, options: CacheMiddlewareOptions): boolean {
  // Don't cache if condition function returns false
  if (options.condition && !options.condition(req, res)) {
    return false;
  }

  // Don't cache error responses
  if (res.statusCode >= 400) {
    return false;
  }

  // Don't cache if response has no-cache headers
  const cacheControl = res.get('Cache-Control');
  if (cacheControl && cacheControl.includes('no-cache')) {
    return false;
  }

  return true;
}

/**
 * Cache middleware factory
 */
export function cacheMiddleware(options: CacheMiddlewareOptions = {}) {
  const cache = getCacheService();
  const invalidationService = getCacheInvalidationService();
  
  const defaultOptions: Required<CacheMiddlewareOptions> = {
    ttl: options.ttl || CacheTTL.MEDIUM,
    prefix: options.prefix || 'api',
    keyGenerator: options.keyGenerator || ((req) => generateCacheKey(req, options)),
    condition: options.condition || (() => true),
    skipCache: options.skipCache || (() => false),
    varyBy: options.varyBy || [],
    compress: options.compress || false
  };

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Skip caching for non-GET requests by default
      if (req.method !== 'GET') {
        return next();
      }

      // Skip cache if condition is met
      if (defaultOptions.skipCache(req)) {
        res.set('X-Cache-Status', 'BYPASS');
        return next();
      }

      const cacheKey = defaultOptions.keyGenerator(req);
      
      // Try to get cached response
      const cachedResponse = await cache.get<{
        data: any;
        headers: Record<string, string>;
        statusCode: number;
        timestamp: number;
      }>(cacheKey, { prefix: defaultOptions.prefix });

      if (cachedResponse) {
        // Cache hit - return cached response
        res.status(cachedResponse.statusCode);
        
        // Set cached headers
        Object.entries(cachedResponse.headers).forEach(([key, value]) => {
          res.set(key, value);
        });

        // Set cache headers
        res.set('X-Cache-Status', 'HIT');
        res.set('X-Cache-Key', cacheKey);
        
        const age = Math.floor((Date.now() - cachedResponse.timestamp) / 1000);
        res.set('Age', age.toString());

        logger.debug('Cache hit', { cacheKey, age });
        return res.json(cachedResponse.data);
      }

      // Cache miss - intercept response to cache it
      res.set('X-Cache-Status', 'MISS');
      res.set('X-Cache-Key', cacheKey);

      // Store original json method
      const originalJson = res.json.bind(res);
      const originalSend = res.send.bind(res);

      // Override json method to cache response
      res.json = function(data: any) {
        // Cache the response if conditions are met
        if (shouldCacheResponse(req, res, defaultOptions)) {
          const responseToCache = {
            data,
            headers: extractCacheableHeaders(res),
            statusCode: res.statusCode,
            timestamp: Date.now()
          };

          // Cache asynchronously to not block response
          setImmediate(async () => {
            try {
              await cache.set(
                cacheKey,
                responseToCache,
                { 
                  prefix: defaultOptions.prefix, 
                  ttl: defaultOptions.ttl,
                  compress: defaultOptions.compress
                }
              );

              logger.debug('Response cached', { 
                cacheKey, 
                ttl: defaultOptions.ttl,
                size: JSON.stringify(data).length 
              });
            } catch (error) {
              logger.error('Failed to cache response', { cacheKey, error });
            }
          });
        }

        return originalJson(data);
      };

      // Override send method for non-JSON responses
      res.send = function(data: any) {
        if (shouldCacheResponse(req, res, defaultOptions)) {
          const responseToCache = {
            data,
            headers: extractCacheableHeaders(res),
            statusCode: res.statusCode,
            timestamp: Date.now()
          };

          setImmediate(async () => {
            try {
              await cache.set(
                cacheKey,
                responseToCache,
                { 
                  prefix: defaultOptions.prefix, 
                  ttl: defaultOptions.ttl,
                  compress: defaultOptions.compress
                }
              );
            } catch (error) {
              logger.error('Failed to cache response', { cacheKey, error });
            }
          });
        }

        return originalSend(data);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error', { error });
      res.set('X-Cache-Status', 'BYPASS');
      next();
    }
  };
}

/**
 * Extract headers that should be cached
 */
function extractCacheableHeaders(res: Response): Record<string, string> {
  const cacheableHeaders = [
    'content-type',
    'content-encoding',
    'content-language',
    'etag',
    'last-modified'
  ];

  const headers: Record<string, string> = {};
  
  cacheableHeaders.forEach(header => {
    const value = res.get(header);
    if (value) {
      headers[header] = value;
    }
  });

  return headers;
}

/**
 * Cache invalidation middleware for write operations
 */
export function cacheInvalidationMiddleware(patterns: string[] | string) {
  const invalidationService = getCacheInvalidationService();
  const patternsArray = Array.isArray(patterns) ? patterns : [patterns];

  return (req: Request, res: Response, next: NextFunction) => {
    // Store original json method
    const originalJson = res.json.bind(res);

    res.json = function(data: any) {
      // Invalidate cache patterns after successful response
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setImmediate(async () => {
          for (const pattern of patternsArray) {
            try {
              await invalidationService.invalidatePattern(pattern);
              logger.debug('Cache invalidated', { pattern, method: req.method, path: req.path });
            } catch (error) {
              logger.error('Cache invalidation failed', { pattern, error });
            }
          }
        });
      }

      return originalJson(data);
    };

    next();
  };
}

/**
 * Conditional cache middleware based on user role
 */
export function roleBased CacheMiddleware(roleConfig: Record<string, CacheMiddlewareOptions>) {
  return (req: Request, res: Response, next: NextFunction) => {
    const userRole = req.user?.role || 'anonymous';
    const config = roleConfig[userRole] || roleConfig['default'];

    if (!config) {
      return next();
    }

    return cacheMiddleware(config)(req, res, next);
  };
}

/**
 * Cache warming middleware for frequently accessed endpoints
 */
export function cacheWarmingMiddleware(warmingConfig: {
  key: string;
  dataLoader: (req: Request) => Promise<any>;
  ttl: number;
  threshold?: number;
}) {
  const cache = getCacheService();
  let accessCount = 0;

  return async (req: Request, res: Response, next: NextFunction) => {
    accessCount++;

    // Warm cache if threshold is reached
    if (warmingConfig.threshold && accessCount >= warmingConfig.threshold) {
      setImmediate(async () => {
        try {
          const data = await warmingConfig.dataLoader(req);
          await cache.set(
            warmingConfig.key,
            data,
            { ttl: warmingConfig.ttl }
          );
          logger.debug('Cache warmed via middleware', { key: warmingConfig.key });
        } catch (error) {
          logger.error('Cache warming failed', { key: warmingConfig.key, error });
        }
      });
    }

    next();
  };
}

// Pre-configured cache middleware for common use cases
export const CacheMiddlewares = {
  // Short-term caching for real-time data
  shortTerm: cacheMiddleware({
    ttl: CacheTTL.SHORT,
    prefix: 'short'
  }),

  // Medium-term caching for semi-static data
  mediumTerm: cacheMiddleware({
    ttl: CacheTTL.MEDIUM,
    prefix: 'medium'
  }),

  // Long-term caching for static data
  longTerm: cacheMiddleware({
    ttl: CacheTTL.LONG,
    prefix: 'long'
  }),

  // User-specific caching
  userSpecific: cacheMiddleware({
    ttl: CacheTTL.MEDIUM,
    prefix: 'user',
    varyBy: ['authorization']
  }),

  // Analytics caching with compression
  analytics: cacheMiddleware({
    ttl: CacheTTL.LONG,
    prefix: 'analytics',
    compress: true,
    condition: (req, res) => req.query.export !== 'true'
  })
} as const;