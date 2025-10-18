import { Request, Response, NextFunction } from 'express';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import { logger } from '../utils/logger';

/**
 * HTTPS/TLS enforcement middleware
 */
export const enforceHTTPS = (req: Request, res: Response, next: NextFunction): void => {
  // Skip in development environment
  if (process.env.NODE_ENV === 'development') {
    next();
    return;
  }

  // Check if request is secure
  if (!req.secure && req.get('x-forwarded-proto') !== 'https') {
    // Redirect to HTTPS
    const httpsUrl = `https://${req.get('host')}${req.url}`;
    res.redirect(301, httpsUrl);
    return;
  }

  next();
};

/**
 * Security headers middleware
 */
export const securityHeaders = (req: Request, res: Response, next: NextFunction): void => {
  // Strict Transport Security
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  
  // Content Security Policy
  res.setHeader('Content-Security-Policy', [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https:",
    "connect-src 'self' wss: ws:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'"
  ].join('; '));
  
  // X-Frame-Options
  res.setHeader('X-Frame-Options', 'DENY');
  
  // X-Content-Type-Options
  res.setHeader('X-Content-Type-Options', 'nosniff');
  
  // Referrer Policy
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // Permissions Policy
  res.setHeader('Permissions-Policy', [
    'camera=()',
    'microphone=()',
    'geolocation=()',
    'payment=()',
    'usb=()',
    'magnetometer=()',
    'accelerometer=()',
    'gyroscope=()'
  ].join(', '));
  
  // Remove server information
  res.removeHeader('X-Powered-By');
  res.removeHeader('Server');

  next();
};

/**
 * Rate limiting configuration for different endpoint types
 */
export const createRateLimit = (options: {
  windowMs?: number;
  max?: number;
  message?: string;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
}) => {
  return rateLimit({
    windowMs: options.windowMs || 15 * 60 * 1000, // 15 minutes
    max: options.max || 100, // limit each IP to 100 requests per windowMs
    message: {
      error: 'Too many requests',
      message: options.message || 'Too many requests from this IP, please try again later.',
      retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000)
    },
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    skipSuccessfulRequests: options.skipSuccessfulRequests || false,
    skipFailedRequests: options.skipFailedRequests || false,
    handler: (req: Request, res: Response) => {
      logger.warn('Rate limit exceeded', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      
      res.status(429).json({
        error: 'Too many requests',
        message: options.message || 'Too many requests from this IP, please try again later.',
        retryAfter: Math.ceil((options.windowMs || 15 * 60 * 1000) / 1000)
      });
    }
  });
};

/**
 * Strict rate limiting for authentication endpoints
 */
export const authRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per 15 minutes
  message: 'Too many authentication attempts, please try again later.',
  skipSuccessfulRequests: true
});

/**
 * General API rate limiting
 */
export const apiRateLimit = createRateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // 1000 requests per 15 minutes
  message: 'API rate limit exceeded, please slow down your requests.'
});

/**
 * Strict rate limiting for sensitive operations
 */
export const sensitiveOperationRateLimit = createRateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // 10 operations per hour
  message: 'Too many sensitive operations, please try again later.'
});

/**
 * Speed limiting middleware to slow down requests
 */
export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: 100, // allow 100 requests per 15 minutes at full speed
  delayMs: 500, // slow down subsequent requests by 500ms per request
  maxDelayMs: 20000, // maximum delay of 20 seconds
  skipFailedRequests: false,
  skipSuccessfulRequests: false
});

/**
 * Request size limiting middleware
 */
export const requestSizeLimit = (maxSize: string = '10mb') => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const contentLength = req.get('content-length');
    
    if (contentLength) {
      const sizeInBytes = parseInt(contentLength, 10);
      const maxSizeInBytes = parseSize(maxSize);
      
      if (sizeInBytes > maxSizeInBytes) {
        res.status(413).json({
          error: 'Request too large',
          message: `Request size exceeds maximum allowed size of ${maxSize}`,
          maxSize: maxSize,
          receivedSize: formatBytes(sizeInBytes)
        });
        return;
      }
    }
    
    next();
  };
};

/**
 * IP whitelist middleware
 */
export const ipWhitelist = (allowedIPs: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const clientIP = req.ip || req.connection.remoteAddress || 'unknown';
    
    // Allow localhost in development
    if (process.env.NODE_ENV === 'development' && 
        (clientIP === '127.0.0.1' || clientIP === '::1' || clientIP === '::ffff:127.0.0.1')) {
      next();
      return;
    }
    
    if (!allowedIPs.includes(clientIP)) {
      logger.warn('Unauthorized IP access attempt', {
        ip: clientIP,
        userAgent: req.get('User-Agent'),
        path: req.path,
        method: req.method
      });
      
      res.status(403).json({
        error: 'Access denied',
        message: 'Your IP address is not authorized to access this resource'
      });
      return;
    }
    
    next();
  };
};

/**
 * Request validation middleware
 */
export const validateRequest = (req: Request, res: Response, next: NextFunction): void => {
  // Check for suspicious patterns in URL
  const suspiciousPatterns = [
    /\.\./,  // Path traversal
    /<script/i,  // XSS attempts
    /union.*select/i,  // SQL injection
    /javascript:/i,  // JavaScript injection
    /vbscript:/i,  // VBScript injection
    /onload=/i,  // Event handler injection
    /onerror=/i  // Error handler injection
  ];
  
  const url = req.originalUrl || req.url;
  
  for (const pattern of suspiciousPatterns) {
    if (pattern.test(url)) {
      logger.warn('Suspicious request detected', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        url: url,
        pattern: pattern.toString()
      });
      
      res.status(400).json({
        error: 'Bad request',
        message: 'Request contains suspicious patterns'
      });
      return;
    }
  }
  
  // Validate User-Agent header
  const userAgent = req.get('User-Agent');
  if (!userAgent || userAgent.length < 10) {
    logger.warn('Suspicious User-Agent', {
      ip: req.ip,
      userAgent: userAgent,
      path: req.path
    });
  }
  
  next();
};

/**
 * CORS configuration with security considerations
 */
export const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || [
      'http://localhost:3000',
      'http://localhost:3001',
      'https://localhost:3000',
      'https://localhost:3001'
    ];
    
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) {
      callback(null, true);
      return;
    }
    
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      logger.warn('CORS blocked request', { origin });
      callback(new Error('Not allowed by CORS'), false);
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Origin',
    'X-Requested-With',
    'Content-Type',
    'Accept',
    'Authorization',
    'X-API-Key',
    'X-Request-ID'
  ],
  exposedHeaders: [
    'X-Request-ID',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset'
  ]
};

/**
 * Request ID middleware for tracing
 */
export const requestId = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = req.get('X-Request-ID') || generateRequestId();
  req.headers['x-request-id'] = requestId;
  res.setHeader('X-Request-ID', requestId);
  next();
};

/**
 * Security audit logging middleware
 */
export const securityAuditLog = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  
  // Log security-relevant request information
  const securityInfo = {
    requestId: req.get('X-Request-ID'),
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    method: req.method,
    path: req.path,
    timestamp: new Date().toISOString(),
    headers: {
      authorization: req.get('Authorization') ? 'Bearer [REDACTED]' : undefined,
      apiKey: req.get('X-API-Key') ? '[REDACTED]' : undefined,
      contentType: req.get('Content-Type'),
      contentLength: req.get('Content-Length')
    }
  };
  
  logger.info('Security audit - Request received', securityInfo);
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk?: any, encoding?: any) {
    const duration = Date.now() - startTime;
    
    logger.info('Security audit - Request completed', {
      ...securityInfo,
      statusCode: res.statusCode,
      duration: duration,
      responseSize: res.get('Content-Length')
    });
    
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
};

// Helper functions
function parseSize(size: string): number {
  const units: { [key: string]: number } = {
    b: 1,
    kb: 1024,
    mb: 1024 * 1024,
    gb: 1024 * 1024 * 1024
  };
  
  const match = size.toLowerCase().match(/^(\d+(?:\.\d+)?)\s*(b|kb|mb|gb)?$/);
  if (!match) {
    throw new Error(`Invalid size format: ${size}`);
  }
  
  const value = parseFloat(match[1]);
  const unit = match[2] || 'b';
  
  return Math.floor(value * units[unit]);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function generateRequestId(): string {
  return Math.random().toString(36).substring(2, 15) + 
         Math.random().toString(36).substring(2, 15);
}