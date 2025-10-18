import { Request, Response, NextFunction } from 'express';
import { auditLogger, AuditCategory } from '../services/AuditLogger';
import { AuthenticatedRequest } from '../types/auth';

/**
 * Middleware to automatically capture audit events for API requests
 */
export const auditMiddleware = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const originalSend = res.send;
  const originalJson = res.json;
  
  // Capture request details
  const requestDetails = {
    method: req.method,
    path: req.path,
    query: req.query,
    body: sanitizeRequestBody(req.body),
    headers: sanitizeHeaders(req.headers),
    userAgent: req.get('User-Agent') || 'unknown',
    ipAddress: req.ip || 'unknown'
  };

  // Override response methods to capture response details
  res.send = function(body: any) {
    logAuditEvent(req, res, requestDetails, body, Date.now() - startTime);
    return originalSend.call(this, body);
  };

  res.json = function(body: any) {
    logAuditEvent(req, res, requestDetails, body, Date.now() - startTime);
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Middleware specifically for authentication events
 */
export const auditAuthenticationMiddleware = (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): void => {
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(body: any) {
    logAuthenticationEvent(req, res, body);
    return originalSend.call(this, body);
  };

  res.json = function(body: any) {
    logAuthenticationEvent(req, res, body);
    return originalJson.call(this, body);
  };

  next();
};

/**
 * Middleware for data access events
 */
export const auditDataAccessMiddleware = (resourceType: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    const originalJson = res.json;

    res.send = function(body: any) {
      logDataAccessEvent(req, res, body, resourceType);
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      logDataAccessEvent(req, res, body, resourceType);
      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Middleware for data modification events
 */
export const auditDataModificationMiddleware = (resourceType: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const originalSend = res.send;
    const originalJson = res.json;

    // Store original data for comparison (if available in request)
    const originalData = req.body?.originalData;

    res.send = function(body: any) {
      logDataModificationEvent(req, res, body, resourceType, originalData);
      return originalSend.call(this, body);
    };

    res.json = function(body: any) {
      logDataModificationEvent(req, res, body, resourceType, originalData);
      return originalJson.call(this, body);
    };

    next();
  };
};

/**
 * Middleware for administrative actions
 */
export const auditAdministrativeMiddleware = (
  req: AuthenticatedRequest, 
  res: Response, 
  next: NextFunction
): void => {
  const originalSend = res.send;
  const originalJson = res.json;

  res.send = function(body: any) {
    logAdministrativeEvent(req, res, body);
    return originalSend.call(this, body);
  };

  res.json = function(body: any) {
    logAdministrativeEvent(req, res, body);
    return originalJson.call(this, body);
  };

  next();
};

// Helper functions for logging specific event types

function logAuditEvent(
  req: AuthenticatedRequest,
  res: Response,
  requestDetails: any,
  responseBody: any,
  duration: number
): void {
  const success = res.statusCode >= 200 && res.statusCode < 400;
  const category = determineAuditCategory(req.path, req.method);

  if (category === AuditCategory.AUTHENTICATION) {
    return; // Handled by specific authentication middleware
  }

  auditLogger.logDataAccess({
    action: `${req.method} ${req.path}`,
    userId: req.user?.userId || 'anonymous',
    userEmail: req.user?.email,
    ipAddress: requestDetails.ipAddress,
    userAgent: requestDetails.userAgent,
    success,
    resourceType: extractResourceType(req.path),
    resourceId: req.params.id || 'unknown',
    queryParameters: requestDetails.query,
    recordCount: extractRecordCount(responseBody)
  });
}

function logAuthenticationEvent(
  req: AuthenticatedRequest,
  res: Response,
  responseBody: any
): void {
  const success = res.statusCode >= 200 && res.statusCode < 400;
  const action = determineAuthAction(req.path, req.method);

  auditLogger.logAuthentication({
    action,
    userId: req.body?.email || req.user?.userId || 'unknown',
    userEmail: req.body?.email || req.user?.email,
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    success,
    loginMethod: req.body?.loginMethod || 'password',
    failureReason: success ? undefined : extractFailureReason(responseBody),
    sessionId: req.sessionID,
    mfaUsed: req.body?.mfaToken ? true : false
  });
}

function logDataAccessEvent(
  req: AuthenticatedRequest,
  res: Response,
  responseBody: any,
  resourceType: string
): void {
  const success = res.statusCode >= 200 && res.statusCode < 400;

  auditLogger.logDataAccess({
    action: `${req.method} ${req.path}`,
    userId: req.user?.userId || 'anonymous',
    userEmail: req.user?.email,
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    success,
    resourceType,
    resourceId: req.params.id || req.params.resourceId || 'unknown',
    dataFields: extractDataFields(responseBody),
    queryParameters: req.query,
    recordCount: extractRecordCount(responseBody)
  });
}

function logDataModificationEvent(
  req: AuthenticatedRequest,
  res: Response,
  responseBody: any,
  resourceType: string,
  originalData?: any
): void {
  const success = res.statusCode >= 200 && res.statusCode < 400;

  auditLogger.logDataModification({
    action: `${req.method} ${req.path}`,
    userId: req.user?.userId || 'anonymous',
    userEmail: req.user?.email,
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    success,
    resourceType,
    resourceId: req.params.id || req.params.resourceId || 'unknown',
    oldValues: originalData,
    newValues: req.body,
    changedFields: extractChangedFields(originalData, req.body)
  });
}

function logAdministrativeEvent(
  req: AuthenticatedRequest,
  res: Response,
  responseBody: any
): void {
  const success = res.statusCode >= 200 && res.statusCode < 400;

  auditLogger.logAdministrativeAction({
    action: `${req.method} ${req.path}`,
    userId: req.user?.userId || 'anonymous',
    userEmail: req.user?.email,
    ipAddress: req.ip || 'unknown',
    userAgent: req.get('User-Agent') || 'unknown',
    success,
    targetUserId: req.params.userId || req.body?.userId,
    targetUserEmail: req.body?.email,
    roleChanges: req.body?.roles,
    permissionChanges: req.body?.permissions,
    configurationChanges: extractConfigurationChanges(req.body)
  });
}

// Utility functions

function sanitizeRequestBody(body: any): any {
  if (!body) return null;

  const sanitized = { ...body };
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'creditCard'];

  for (const field of sensitiveFields) {
    if (field in sanitized) {
      sanitized[field] = '[REDACTED]';
    }
  }

  return sanitized;
}

function sanitizeHeaders(headers: any): any {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'x-api-key', 'cookie'];

  for (const header of sensitiveHeaders) {
    if (header in sanitized) {
      sanitized[header] = '[REDACTED]';
    }
  }

  return sanitized;
}

function determineAuditCategory(path: string, method: string): AuditCategory {
  if (path.includes('/auth/') || path.includes('/login') || path.includes('/logout')) {
    return AuditCategory.AUTHENTICATION;
  }

  if (path.includes('/admin/') || path.includes('/roles/') || path.includes('/permissions/')) {
    return AuditCategory.ADMINISTRATIVE;
  }

  if (method === 'GET') {
    return AuditCategory.DATA_ACCESS;
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return AuditCategory.DATA_MODIFICATION;
  }

  return AuditCategory.SYSTEM;
}

function determineAuthAction(path: string, method: string): string {
  if (path.includes('/login')) return 'login';
  if (path.includes('/logout')) return 'logout';
  if (path.includes('/refresh')) return 'token_refresh';
  if (path.includes('/register')) return 'register';
  if (path.includes('/reset-password')) return 'password_reset';
  if (path.includes('/change-password')) return 'password_change';
  
  return `${method.toLowerCase()}_${path}`;
}

function extractResourceType(path: string): string {
  const segments = path.split('/').filter(segment => segment && segment !== 'api');
  return segments[0] || 'unknown';
}

function extractRecordCount(responseBody: any): number | undefined {
  if (!responseBody) return undefined;

  if (Array.isArray(responseBody)) {
    return responseBody.length;
  }

  if (responseBody.data && Array.isArray(responseBody.data)) {
    return responseBody.data.length;
  }

  if (responseBody.total && typeof responseBody.total === 'number') {
    return responseBody.total;
  }

  return undefined;
}

function extractDataFields(responseBody: any): string[] | undefined {
  if (!responseBody) return undefined;

  if (typeof responseBody === 'object' && !Array.isArray(responseBody)) {
    return Object.keys(responseBody);
  }

  if (Array.isArray(responseBody) && responseBody.length > 0) {
    return Object.keys(responseBody[0]);
  }

  return undefined;
}

function extractFailureReason(responseBody: any): string | undefined {
  if (!responseBody) return undefined;

  if (responseBody.error) {
    return responseBody.error;
  }

  if (responseBody.message) {
    return responseBody.message;
  }

  return 'Unknown failure reason';
}

function extractChangedFields(oldData: any, newData: any): string[] | undefined {
  if (!oldData || !newData) return undefined;

  const changedFields: string[] = [];

  for (const key in newData) {
    if (oldData[key] !== newData[key]) {
      changedFields.push(key);
    }
  }

  return changedFields.length > 0 ? changedFields : undefined;
}

function extractConfigurationChanges(body: any): any {
  if (!body) return undefined;

  const configFields = ['settings', 'config', 'configuration', 'preferences'];
  const changes: any = {};

  for (const field of configFields) {
    if (body[field]) {
      changes[field] = body[field];
    }
  }

  return Object.keys(changes).length > 0 ? changes : undefined;
}