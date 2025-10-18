import { Request, Response, NextFunction } from 'express';
import { MetricsCollectionService } from '../services/MetricsCollectionService';
import { logger } from '../utils/logger';

interface RequestWithMetrics extends Request {
  startTime?: number;
  traceId?: string;
}

export class MetricsMiddleware {
  private metricsService: MetricsCollectionService;

  constructor() {
    this.metricsService = new MetricsCollectionService();
  }

  /**
   * Middleware to track request metrics
   */
  public trackRequest() {
    return (req: RequestWithMetrics, res: Response, next: NextFunction) => {
      // Record start time
      req.startTime = Date.now();
      
      // Generate trace ID for distributed tracing
      req.traceId = this.generateTraceId();
      
      // Add trace ID to response headers
      res.setHeader('X-Trace-Id', req.traceId);

      // Override res.end to capture metrics when response is sent
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const responseTime = Date.now() - (req.startTime || Date.now());
        const isError = res.statusCode >= 400;
        
        // Record metrics
        try {
          metricsService.recordRequest(responseTime, isError);
          
          // Log request details
          logger.info('Request completed', {
            method: req.method,
            url: req.url,
            statusCode: res.statusCode,
            responseTime,
            traceId: req.traceId,
            userAgent: req.get('User-Agent'),
            ip: req.ip
          });
        } catch (error) {
          logger.error('Failed to record request metrics:', error);
        }
        
        // Call original end method
        originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * Middleware to track API endpoint performance
   */
  public trackEndpoint(endpointName: string) {
    return (req: RequestWithMetrics, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Override res.end to capture endpoint-specific metrics
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        const responseTime = Date.now() - startTime;
        const isError = res.statusCode >= 400;
        
        try {
          // Record endpoint-specific metrics
          metricsService.recordEndpointMetrics(endpointName, {
            responseTime,
            statusCode: res.statusCode,
            isError,
            method: req.method,
            timestamp: new Date()
          });
        } catch (error) {
          logger.error(`Failed to record metrics for endpoint ${endpointName}:`, error);
        }
        
        originalEnd.apply(this, args);
      };

      next();
    };
  }

  /**
   * Middleware to track database query performance
   */
  public trackDatabaseQuery(queryType: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      // This would be used to wrap database queries
      // Implementation would depend on the specific database client
      next();
    };
  }

  /**
   * Middleware to track AI service calls
   */
  public trackAIServiceCall(serviceType: string) {
    return (req: Request, res: Response, next: NextFunction) => {
      const startTime = Date.now();
      
      // Store AI service call start time in request context
      (req as any).aiServiceStartTime = startTime;
      (req as any).aiServiceType = serviceType;
      
      next();
    };
  }

  /**
   * Record AI service call completion
   */
  public recordAIServiceCall(req: Request, success: boolean, confidence?: number): void {
    try {
      const startTime = (req as any).aiServiceStartTime;
      const serviceType = (req as any).aiServiceType;
      
      if (startTime && serviceType) {
        const responseTime = Date.now() - startTime;
        
        this.metricsService.recordAIServiceCall(serviceType, {
          responseTime,
          success,
          confidence,
          timestamp: new Date()
        });
      }
    } catch (error) {
      logger.error('Failed to record AI service call metrics:', error);
    }
  }

  /**
   * Middleware for distributed tracing
   */
  public distributedTracing() {
    return (req: RequestWithMetrics, res: Response, next: NextFunction) => {
      // Extract trace context from headers
      const traceId = req.get('X-Trace-Id') || this.generateTraceId();
      const spanId = this.generateSpanId();
      const parentSpanId = req.get('X-Parent-Span-Id');
      
      // Add tracing information to request
      req.traceId = traceId;
      (req as any).spanId = spanId;
      (req as any).parentSpanId = parentSpanId;
      
      // Add tracing headers to response
      res.setHeader('X-Trace-Id', traceId);
      res.setHeader('X-Span-Id', spanId);
      
      // Log trace information
      logger.info('Request trace', {
        traceId,
        spanId,
        parentSpanId,
        method: req.method,
        url: req.url
      });
      
      next();
    };
  }

  /**
   * Middleware to track business metrics
   */
  public trackBusinessMetrics() {
    return (req: Request, res: Response, next: NextFunction) => {
      // Override res.end to capture business-specific metrics
      const originalEnd = res.end;
      res.end = function(this: Response, ...args: any[]) {
        try {
          // Track business events based on the endpoint
          const path = req.path;
          const method = req.method;
          
          if (method === 'POST' && path.includes('/tickets')) {
            metricsService.recordBusinessEvent('ticket_created');
          } else if (method === 'PUT' && path.includes('/tickets') && path.includes('/resolve')) {
            metricsService.recordBusinessEvent('ticket_resolved');
          } else if (method === 'PUT' && path.includes('/tickets') && path.includes('/assign')) {
            metricsService.recordBusinessEvent('ticket_assigned');
          }
        } catch (error) {
          logger.error('Failed to record business metrics:', error);
        }
        
        originalEnd.apply(this, args);
      };
      
      next();
    };
  }

  /**
   * Error tracking middleware
   */
  public trackErrors() {
    return (error: Error, req: RequestWithMetrics, res: Response, next: NextFunction) => {
      try {
        // Record error metrics
        this.metricsService.recordError({
          message: error.message,
          stack: error.stack,
          endpoint: req.path,
          method: req.method,
          traceId: req.traceId,
          timestamp: new Date()
        });
        
        // Log error with trace information
        logger.error('Request error', {
          error: error.message,
          stack: error.stack,
          traceId: req.traceId,
          method: req.method,
          url: req.url
        });
      } catch (metricsError) {
        logger.error('Failed to record error metrics:', metricsError);
      }
      
      next(error);
    };
  }

  // Private helper methods

  private generateTraceId(): string {
    return Math.random().toString(36).substring(2, 15) + 
           Math.random().toString(36).substring(2, 15);
  }

  private generateSpanId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private metricsService: MetricsCollectionService;
}

// Extend MetricsCollectionService with additional methods
declare module '../services/MetricsCollectionService' {
  interface MetricsCollectionService {
    recordEndpointMetrics(endpoint: string, metrics: any): void;
    recordAIServiceCall(serviceType: string, metrics: any): void;
    recordBusinessEvent(eventType: string): void;
    recordError(error: any): void;
  }
}

// Add the extended methods to MetricsCollectionService prototype
Object.assign(MetricsCollectionService.prototype, {
  recordEndpointMetrics(endpoint: string, metrics: any): void {
    try {
      const key = `endpoint_metrics:${endpoint}`;
      if (!this.metricsHistory.has(key)) {
        this.metricsHistory.set(key, []);
      }
      
      const history = this.metricsHistory.get(key)!;
      history.push(metrics);
      
      // Keep only last 1000 entries
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
    } catch (error) {
      logger.error(`Failed to record endpoint metrics for ${endpoint}:`, error);
    }
  },

  recordAIServiceCall(serviceType: string, metrics: any): void {
    try {
      const key = `ai_service_metrics:${serviceType}`;
      if (!this.metricsHistory.has(key)) {
        this.metricsHistory.set(key, []);
      }
      
      const history = this.metricsHistory.get(key)!;
      history.push(metrics);
      
      // Keep only last 1000 entries
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
    } catch (error) {
      logger.error(`Failed to record AI service metrics for ${serviceType}:`, error);
    }
  },

  recordBusinessEvent(eventType: string): void {
    try {
      const key = `business_events:${eventType}`;
      if (!this.metricsHistory.has(key)) {
        this.metricsHistory.set(key, []);
      }
      
      const history = this.metricsHistory.get(key)!;
      history.push({ timestamp: new Date() });
      
      // Keep only last 10000 entries for business events
      if (history.length > 10000) {
        history.splice(0, history.length - 10000);
      }
    } catch (error) {
      logger.error(`Failed to record business event ${eventType}:`, error);
    }
  },

  recordError(error: any): void {
    try {
      const key = 'error_metrics';
      if (!this.metricsHistory.has(key)) {
        this.metricsHistory.set(key, []);
      }
      
      const history = this.metricsHistory.get(key)!;
      history.push(error);
      
      // Keep only last 1000 errors
      if (history.length > 1000) {
        history.splice(0, history.length - 1000);
      }
    } catch (metricsError) {
      logger.error('Failed to record error metrics:', metricsError);
    }
  }
});

export const metricsMiddleware = new MetricsMiddleware();