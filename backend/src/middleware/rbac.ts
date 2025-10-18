import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types/auth';
import { PermissionChecker, PERMISSIONS } from '../utils/permissions';
import { UserRole } from '../types';

/**
 * Role-Based Access Control (RBAC) middleware
 */

/**
 * Permission-based authorization middleware
 */
export const requirePermission = (resource: string, action: string) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const hasPermission = PermissionChecker.hasResourcePermission(req.user.role, resource, action);
    
    if (!hasPermission) {
      res.status(403).json({
        error: 'Access denied',
        message: `Insufficient permissions. Required: ${action} on ${resource}`
      });
      return;
    }

    next();
  };
};

/**
 * Resource ownership authorization middleware
 * Allows access if user owns the resource or has admin/manager privileges
 */
export const requireOwnershipOrPermission = (
  resource: string, 
  action: string, 
  ownerIdParam: string = 'userId'
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const ownerId = req.params[ownerIdParam];
    const canAccess = PermissionChecker.canAccessOwnResource(
      req.user.role,
      resource,
      action,
      ownerId,
      req.user.userId
    );

    if (!canAccess) {
      res.status(403).json({
        error: 'Access denied',
        message: 'You can only access your own resources or lack required permissions'
      });
      return;
    }

    next();
  };
};

/**
 * Hierarchical authorization middleware
 * Checks if user can manage another user based on role hierarchy
 */
export const requireManagementPermission = (targetRoleParam: string = 'targetRole') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const targetRole = req.body[targetRoleParam] || req.params[targetRoleParam] as UserRole;
    
    if (!targetRole) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Target user role not specified'
      });
      return;
    }

    const canManage = PermissionChecker.canManageUser(req.user.role, targetRole);
    
    if (!canManage) {
      res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions to manage this user role'
      });
      return;
    }

    next();
  };
};

/**
 * Ticket assignment authorization middleware
 */
export const requireTicketAssignmentPermission = (assigneeRoleParam: string = 'assigneeRole') => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const assigneeRole = req.body[assigneeRoleParam] as UserRole;
    
    if (!assigneeRole) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Assignee role not specified'
      });
      return;
    }

    const canAssign = PermissionChecker.canAssignTicket(req.user.role, assigneeRole);
    
    if (!canAssign) {
      res.status(403).json({
        error: 'Access denied',
        message: 'Insufficient permissions to assign tickets to this user role'
      });
      return;
    }

    next();
  };
};

/**
 * Specific permission middleware factories
 */

// User management permissions
export const requireUserCreate = requirePermission('user', 'create');
export const requireUserRead = requirePermission('user', 'read');
export const requireUserUpdate = requirePermission('user', 'update');
export const requireUserDelete = requirePermission('user', 'delete');

// Ticket management permissions
export const requireTicketCreate = requirePermission('ticket', 'create');
export const requireTicketRead = requirePermission('ticket', 'read');
export const requireTicketUpdate = requirePermission('ticket', 'update');
export const requireTicketDelete = requirePermission('ticket', 'delete');
export const requireTicketAssign = requirePermission('ticket', 'assign');

// Technician management permissions
export const requireTechnicianCreate = requirePermission('technician', 'create');
export const requireTechnicianRead = requirePermission('technician', 'read');
export const requireTechnicianUpdate = requirePermission('technician', 'update');
export const requireTechnicianDelete = requirePermission('technician', 'delete');

// Customer management permissions
export const requireCustomerCreate = requirePermission('customer', 'create');
export const requireCustomerRead = requirePermission('customer', 'read');
export const requireCustomerUpdate = requirePermission('customer', 'update');
export const requireCustomerDelete = requirePermission('customer', 'delete');

// Analytics permissions
export const requireAnalyticsRead = requirePermission('analytics', 'read');
export const requireAnalyticsExport = requirePermission('analytics', 'export');

// System administration permissions
export const requireSystemConfig = requirePermission('system', 'configure');
export const requireSystemMonitor = requirePermission('system', 'monitor');
export const requireAuditLogs = requirePermission('audit', 'read');

// AI and automation permissions
export const requireAIConfig = requirePermission('ai', 'configure');
export const requireAIMonitor = requirePermission('ai', 'monitor');

// Time tracking permissions
export const requireTimeTrack = requirePermission('time', 'track');
export const requireTimeView = requirePermission('time', 'view');
export const requireTimeEdit = requirePermission('time', 'edit');

// SLA permissions
export const requireSLARead = requirePermission('sla', 'read');
export const requireSLAConfig = requirePermission('sla', 'configure');

/**
 * Dynamic permission checker middleware
 * Allows checking permissions based on request parameters
 */
export const checkDynamicPermission = (
  resourceParam: string = 'resource',
  actionParam: string = 'action'
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    const resource = req.params[resourceParam] || req.body[resourceParam];
    const action = req.params[actionParam] || req.body[actionParam];

    if (!resource || !action) {
      res.status(400).json({
        error: 'Bad request',
        message: 'Resource and action must be specified'
      });
      return;
    }

    const hasPermission = PermissionChecker.hasResourcePermission(req.user.role, resource, action);
    
    if (!hasPermission) {
      res.status(403).json({
        error: 'Access denied',
        message: `Insufficient permissions. Required: ${action} on ${resource}`
      });
      return;
    }

    next();
  };
};

/**
 * Middleware to attach user permissions to request
 * Useful for frontend to know what actions are available
 */
export const attachUserPermissions = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (req.user) {
    const permissions = PermissionChecker.getRolePermissions(req.user.role);
    const accessibleResources = PermissionChecker.getAccessibleResources(req.user.role);
    
    // Attach to request for use in controllers
    (req as any).userPermissions = {
      permissions,
      accessibleResources,
      role: req.user.role
    };
  }
  
  next();
};

/**
 * Conditional permission middleware
 * Applies different permission checks based on conditions
 */
export const conditionalPermission = (
  conditions: Array<{
    condition: (req: AuthenticatedRequest) => boolean;
    resource: string;
    action: string;
  }>
) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        error: 'Authentication required',
        message: 'User not authenticated'
      });
      return;
    }

    // Find the first matching condition
    const matchingCondition = conditions.find(cond => cond.condition(req));
    
    if (!matchingCondition) {
      res.status(400).json({
        error: 'Bad request',
        message: 'No matching permission condition found'
      });
      return;
    }

    const hasPermission = PermissionChecker.hasResourcePermission(
      req.user.role,
      matchingCondition.resource,
      matchingCondition.action
    );
    
    if (!hasPermission) {
      res.status(403).json({
        error: 'Access denied',
        message: `Insufficient permissions. Required: ${matchingCondition.action} on ${matchingCondition.resource}`
      });
      return;
    }

    next();
  };
};