import { Request, Response, NextFunction } from 'express';
import { securityMonitor, ThreatLevel } from '../services/SecurityMonitor';
import { AuthenticatedRequest } from '../types/auth';
import { logger } from '../utils/logger';

/**
 * Middleware to detect and block threats in real-time
 */
export const threatDetectionMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

  // Check if IP is already blocked
  if (securityMonitor.isIPBlocked(ipAddress)) {
    logger.warn('Blocked IP attempted access', {
      ipAddress,
      path: req.path,
      userAgent: req.get('User-Agent')
    });

    res.status(403).json({
      error: 'Access denied',
      message: 'Your IP address has been blocked due to suspicious activity',
      code: 'IP_BLOCKED'
    });
    return;
  }

  // Detect suspicious API usage
  const apiUsageEvent = {
    userId: req.user?.userId,
    ipAddress,
    userAgent: req.get('User-Agent') || 'unknown',
    endpoint: req.path,
    requestCount: 1, // This would be tracked per IP in a real implementation
    queryParams: req.query,
    requestBody: req.body,
    timestamp: Date.now()
  };

  const threatAssessment = securityMonitor.detectSuspiciousAPIUsage(apiUsageEvent);

  // Block request if high threat detected
  if (threatAssessment.shouldBlock) {
    logger.warn('Request blocked due to threat detection', {
      ipAddress,
      path: req.path,
      threatLevel: threatAssessment.threatLevel,
      reasons: threatAssessment.reasons,
      confidence: threatAssessment.confidence
    });

    res.status(403).json({
      error: 'Request blocked',
      message: 'Your request has been blocked due to suspicious activity',
      code: 'THREAT_DETECTED',
      threatLevel: threatAssessment.threatLevel
    });
    return;
  }

  // Add threat information to request for logging
  (req as any).threatAssessment = threatAssessment;

  next();
};

/**
 * Middleware specifically for authentication endpoints
 */
export const authThreatDetectionMiddleware = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

  // Check if IP is blocked
  if (securityMonitor.isIPBlocked(ipAddress)) {
    res.status(403).json({
      error: 'Access denied',
      message: 'Authentication blocked due to suspicious activity',
      code: 'IP_BLOCKED'
    });
    return;
  }

  // Override response to capture authentication results
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(body: any) {
    processAuthResult(req, res, body);
    return originalSend.call(this, body);
  };

  res.json = function(body: any) {
    processAuthResult(req, res, body);
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Process authentication result for threat detection
 */
function processAuthResult(req: AuthenticatedRequest, res: Response, responseBody: any): void {
  const success = res.statusCode >= 200 && res.statusCode < 400;
  const ipAddress = req.ip || req.connection.remoteAddress || 'unknown';

  const authEvent = {
    userId: req.body?.email || req.body?.username || 'unknown',
    userEmail: req.body?.email,
    ipAddress,
    userAgent: req.get('User-Agent') || 'unknown',
    success,
    timestamp: Date.now()
  };

  const threatAssessment = securityMonitor.detectSuspiciousAuth(authEvent);

  // Log threat assessment
  if (threatAssessment.threatLevel > ThreatLevel.LOW) {
    logger.warn('Authentication threat detected', {
      ipAddress,
      userId: authEvent.userId,
      threatLevel: threatAssessment.threatLevel,
      reasons: threatAssessment.reasons,
      confidence: threatAssessment.confidence,
      blocked: threatAssessment.shouldBlock
    });
  }
}

/**
 * Middleware to add security headers for DDoS protection
 */
export const ddosProtectionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Add security headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');

  // Rate limiting headers (these would be set by actual rate limiting middleware)
  res.setHeader('X-RateLimit-Limit', '1000');
  res.setHeader('X-RateLimit-Window', '900'); // 15 minutes

  next();
};

/**
 * Middleware to detect and prevent common attacks
 */
export const attackPreventionMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const userAgent = req.get('User-Agent') || '';
  const referer = req.get('Referer') || '';
  const origin = req.get('Origin') || '';

  // Detect bot traffic
  if (isBotTraffic(userAgent)) {
    logger.warn('Bot traffic detected', {
      ip: req.ip,
      userAgent,
      path: req.path
    });

    // Allow legitimate bots but rate limit them
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  }

  // Detect potential CSRF attacks
  if (isCSRFAttempt(req, origin, referer)) {
    logger.warn('Potential CSRF attack detected', {
      ip: req.ip,
      origin,
      referer,
      path: req.path
    });

    res.status(403).json({
      error: 'Forbidden',
      message: 'Cross-site request forgery detected',
      code: 'CSRF_DETECTED'
    });
    return;
  }

  // Detect directory traversal attempts
  if (isDirectoryTraversal(req.path)) {
    logger.warn('Directory traversal attempt detected', {
      ip: req.ip,
      path: req.path,
      userAgent
    });

    res.status(400).json({
      error: 'Bad Request',
      message: 'Invalid path detected',
      code: 'INVALID_PATH'
    });
    return;
  }

  next();
};

/**
 * Middleware to monitor for suspicious file upload attempts
 */
export const fileUploadSecurityMiddleware = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  // Check for file upload endpoints
  if (req.path.includes('/upload') || req.get('Content-Type')?.includes('multipart/form-data')) {
    const contentLength = parseInt(req.get('Content-Length') || '0', 10);
    const maxFileSize = 10 * 1024 * 1024; // 10MB

    // Check file size
    if (contentLength > maxFileSize) {
      logger.warn('Large file upload attempt detected', {
        ip: req.ip,
        contentLength,
        maxAllowed: maxFileSize,
        path: req.path
      });

      res.status(413).json({
        error: 'File too large',
        message: 'File size exceeds maximum allowed limit',
        code: 'FILE_TOO_LARGE'
      });
      return;
    }

    // Add security headers for file uploads
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'self'");
  }

  next();
};

// Helper functions

function isBotTraffic(userAgent: string): boolean {
  const botPatterns = [
    /googlebot/i,
    /bingbot/i,
    /slurp/i,
    /duckduckbot/i,
    /baiduspider/i,
    /yandexbot/i,
    /facebookexternalhit/i,
    /twitterbot/i,
    /linkedinbot/i,
    /whatsapp/i,
    /crawler/i,
    /spider/i,
    /bot/i
  ];

  return botPatterns.some(pattern => pattern.test(userAgent));
}

function isCSRFAttempt(req: Request, origin: string, referer: string): boolean {
  // Skip CSRF check for GET requests and API endpoints with proper authentication
  if (req.method === 'GET' || req.path.startsWith('/api/')) {
    return false;
  }

  // Check if origin/referer matches expected domains
  const allowedDomains = process.env.ALLOWED_ORIGINS?.split(',') || [
    'http://localhost:3000',
    'http://localhost:3001',
    'https://localhost:3000',
    'https://localhost:3001'
  ];

  if (origin) {
    return !allowedDomains.some(domain => origin.startsWith(domain));
  }

  if (referer) {
    return !allowedDomains.some(domain => referer.startsWith(domain));
  }

  // No origin or referer for state-changing request is suspicious
  return ['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method);
}

function isDirectoryTraversal(path: string): boolean {
  const traversalPatterns = [
    /\.\./,
    /\.\.\//, 
    /\.\.\\/, 
    /%2e%2e/i,
    /%252e%252e/i,
    /\.\.\%2f/i,
    /\.\.\%5c/i
  ];

  return traversalPatterns.some(pattern => pattern.test(path));
}

/**
 * Create IP-based rate limiter with threat detection
 */
export const createThreatAwareRateLimit = (options: {
  windowMs: number;
  maxRequests: number;
  blockDuration?: number;
}) => {
  const requestCounts = new Map<string, { count: number; resetTime: number; blocked?: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const ipAddress = req.ip || 'unknown';
    const now = Date.now();
    
    const clientData = requestCounts.get(ipAddress) || { count: 0, resetTime: now + options.windowMs };

    // Check if IP is temporarily blocked
    if (clientData.blocked && now < clientData.blocked) {
      res.status(429).json({
        error: 'Too many requests',
        message: 'IP temporarily blocked due to excessive requests',
        retryAfter: Math.ceil((clientData.blocked - now) / 1000)
      });
      return;
    }

    // Reset counter if window expired
    if (now > clientData.resetTime) {
      clientData.count = 0;
      clientData.resetTime = now + options.windowMs;
      clientData.blocked = undefined;
    }

    clientData.count++;

    // Check if limit exceeded
    if (clientData.count > options.maxRequests) {
      // Block IP temporarily
      clientData.blocked = now + (options.blockDuration || 60000); // Default 1 minute block
      
      // Report to security monitor
      securityMonitor.detectSuspiciousAPIUsage({
        ipAddress,
        userAgent: req.get('User-Agent') || 'unknown',
        endpoint: req.path,
        requestCount: clientData.count,
        timestamp: now
      });

      logger.warn('Rate limit exceeded, IP blocked', {
        ipAddress,
        requestCount: clientData.count,
        maxRequests: options.maxRequests,
        blockDuration: options.blockDuration || 60000
      });

      res.status(429).json({
        error: 'Rate limit exceeded',
        message: 'Too many requests, IP temporarily blocked',
        retryAfter: Math.ceil((clientData.blocked - now) / 1000)
      });
      return;
    }

    requestCounts.set(ipAddress, clientData);

    // Add rate limit headers
    res.setHeader('X-RateLimit-Limit', options.maxRequests);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, options.maxRequests - clientData.count));
    res.setHeader('X-RateLimit-Reset', Math.ceil(clientData.resetTime / 1000));

    next();
  };
};