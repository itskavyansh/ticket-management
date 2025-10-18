import { Request, Response, NextFunction } from 'express';
import { getRateLimitingService, RateLimitPresets } from '../services/RateLimitingService';
import { getQueueManagementService } from '../services/QueueManagementService';
import { logger } from '../utils/logger';

export interface AdvancedRateLimitOptions {
  preset?: keyof typeof RateLimitPresets;
  customConfig?: any;
  enableThrottling?: boolean;
  enableBurstProtection?: boolean;
  enableAdaptive?: boolean;
  queueResourceIntensive?: boolean;
}

/**
 * Advanced rate limiting middleware with multiple protection layers
 */
export function advancedRateLimit(options: AdvancedRateLimitOptions = {}) {
  const rateLimitingService = getRateLimitingService();
  const queueService = getQueueManagementService();

  // Get rate limit configuration
  const config = options.customConfig || 
    (options.preset ? RateLimitPresets[options.preset] : RateLimitPresets.api);

  // Create base rate limiting middleware
  const baseRateLimit = rateLimitingService.createRateLimit(config);

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Apply base rate limiting
      await new Promise<void>((resolve, reject) => {
        baseRateLimit(req, res, (error?: any) => {
          if (error) reject(error);
          else resolve();
        });
      });

      // Apply additional protections if enabled
      if (options.enableBurstProtection) {
        const burstProtection = rateLimitingService.createBurstProtection({
          burstLimit: 20,
          burstWindowMs: 10000, // 10 seconds
          sustainedLimit: 100,
          sustainedWindowMs: 60000 // 1 minute
        });

        await new Promise<void>((resolve, reject) => {
          burstProtection(req, res, (error?: any) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      // Apply throttling if enabled
      if (options.enableThrottling) {
        const throttle = rateLimitingService.createThrottle({
          delayMs: 100,
          maxDelayMs: 2000,
          delayAfter: 10
        });

        await new Promise<void>((resolve, reject) => {
          throttle(req, res, (error?: any) => {
            if (error) reject(error);
            else resolve();
          });
        });
      }

      // Queue resource-intensive operations if enabled
      if (options.queueResourceIntensive && this.isResourceIntensive(req)) {
        return this.queueRequest(req, res, queueService);
      }

      next();
    } catch (error) {
      logger.error('Advanced rate limiting error', { error });
      next();
    }
  };
}

/**
 * Check if request is resource-intensive
 */
function isResourceIntensive(req: Request): boolean {
  // Check for resource-intensive operations
  const resourceIntensivePatterns = [
    '/api/analytics/reports',
    '/api/tickets/export',
    '/api/dashboard/full-data'
  ];

  return resourceIntensivePatterns.some(pattern => 
    req.path.includes(pattern)
  );
}

/**
 * Queue resource-intensive requests
 */
async function queueRequest(
  req: Request, 
  res: Response, 
  queueService: any
): Promise<void> {
  try {
    const jobId = await queueService.addJob(
      'resource-intensive',
      'api-request',
      {
        method: req.method,
        path: req.path,
        query: req.query,
        body: req.body,
        headers: req.headers,
        userId: (req as any).user?.id
      },
      { priority: 1 }
    );

    res.status(202).json({
      message: 'Request queued for processing',
      jobId,
      estimatedProcessingTime: '30-60 seconds'
    });
  } catch (error) {
    logger.error('Failed to queue request', { error });
    res.status(503).json({
      error: 'Service temporarily unavailable',
      message: 'Unable to process request at this time'
    });
  }
}