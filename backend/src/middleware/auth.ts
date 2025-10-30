import { Request, Response, NextFunction } from 'express';
import { JWTUtils } from '../utils/jwt';
import { AuthenticatedRequest, AuthTokenPayload } from '../types/auth';
import { UserRole } from '../types';

/**
 * Authentication middleware to verify JWT tokens
 */
export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (!token) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
      return;
    }

    // Verify token
    const payload = JWTUtils.verifyAccessToken(token);
    
    // Attach user info to request
    req.user = payload;
    
    next();
  } catch (error: any) {
    res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
};

/**
 * Optional authentication middleware - doesn't fail if no token provided
 */
export const optionalAuthenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    const token = JWTUtils.extractTokenFromHeader(authHeader);

    if (token) {
      const payload = JWTUtils.verifyAccessToken(token);
      req.user = payload;
    }
    
    next();
  } catch (error) {
    // Continue without authentication if token is invalid
    next();
  }
};

/**
 * Authorization middleware factory to check user roles
 */
export const authorize = (...allowedRoles: UserRole[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: 'Access denied',
        message: `Insufficient permissions. Required roles: ${allowedRoles.join(', ')}`
      });
      return;
    }

    next();
  };
};

/**
 * Check if user has admin role
 */
export const requireAdmin = authorize(UserRole.ADMIN);

/**
 * Check if user has admin or manager role
 */
export const requireManager = authorize(UserRole.ADMIN, UserRole.MANAGER);

/**
 * Check if user has admin, manager, or technician role
 */
export const requireTechnician = authorize(UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN);

/**
 * Allow all authenticated users (any role)
 */
export const requireAuthenticated = authorize(
  UserRole.ADMIN, 
  UserRole.MANAGER, 
  UserRole.TECHNICIAN, 
  UserRole.READ_ONLY
);

/**
 * Resource-based authorization middleware
 * Checks if user can access a specific resource
 */
export const authorizeResource = (
  resourceChecker: (user: AuthTokenPayload, resourceId: string) => Promise<boolean>
) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    try {
      const resourceId = req.params.id || req.params.resourceId;
      if (!resourceId) {
        res.status(400).json({
          error: 'Bad request',
          message: 'Resource ID not provided'
        });
        return;
      }

      const hasAccess = await resourceChecker(req.user, resourceId);
      if (!hasAccess) {
        res.status(403).json({
          error: 'Access denied',
          message: 'Insufficient permissions for this resource'
        });
        return;
      }

      next();
    } catch (error: any) {
      res.status(500).json({
        error: 'Authorization check failed',
        message: error.message
      });
    }
  };
};

/**
 * Self-access authorization - user can only access their own resources
 */
export const authorizeSelf = (userIdParam: string = 'userId') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const targetUserId = req.params[userIdParam];
    
    // Admin can access any user's resources
    if (req.user.role === UserRole.ADMIN) {
      next();
      return;
    }

    // User can only access their own resources
    if (req.user.userId !== targetUserId) {
      res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources'
      });
      return;
    }

    next();
  };
};

/**
 * Rate limiting middleware for authentication endpoints
 */
export const authRateLimit = (maxAttempts: number = 5, windowMs: number = 15 * 60 * 1000) => {
  const attempts = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction): void => {
    const clientId = req.ip || 'unknown';
    const now = Date.now();
    
    const clientAttempts = attempts.get(clientId);
    
    if (!clientAttempts || now > clientAttempts.resetTime) {
      // Reset or initialize attempts
      attempts.set(clientId, { count: 1, resetTime: now + windowMs });
      next();
      return;
    }

    if (clientAttempts.count >= maxAttempts) {
      res.status(429).json({
        error: 'Too many attempts',
        message: 'Too many authentication attempts. Please try again later.',
        retryAfter: Math.ceil((clientAttempts.resetTime - now) / 1000)
      });
      return;
    }

    clientAttempts.count++;
    next();
  };
};

/**
 * Middleware to extract and validate API key for service-to-service communication
 */
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction): void => {
  const apiKey = req.headers['x-api-key'] as string;
  const expectedApiKey = process.env.API_KEY;

  if (!expectedApiKey) {
    res.status(500).json({
      error: 'Server configuration error',
      message: 'API key not configured'
    });
    return;
  }

  if (!apiKey || apiKey !== expectedApiKey) {
    res.status(401).json({
      error: 'Invalid API key',
      message: 'Valid API key required for this endpoint'
    });
    return;
  }

  next();
};

// Simple mock auth for development - bypasses authentication
export const mockAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  // Mock user for development
  req.user = {
    userId: 'dev-user-1',
    email: 'developer@example.com',
    role: UserRole.ADMIN,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  next();
};

// Use mock auth in development, real auth in production
export const auth = process.env.NODE_ENV === 'development' ? mockAuth : authenticate;