import { UserRole } from '../types';
import { Permission, RolePermissions } from '../types/auth';

/**
 * Permission definitions and role-based access control utilities
 */

// Define all available permissions
export const PERMISSIONS = {
  // User management
  USER_CREATE: { resource: 'user', action: 'create' },
  USER_READ: { resource: 'user', action: 'read' },
  USER_UPDATE: { resource: 'user', action: 'update' },
  USER_DELETE: { resource: 'user', action: 'delete' },
  USER_ACTIVATE: { resource: 'user', action: 'activate' },
  USER_DEACTIVATE: { resource: 'user', action: 'deactivate' },

  // Ticket management
  TICKET_CREATE: { resource: 'ticket', action: 'create' },
  TICKET_READ: { resource: 'ticket', action: 'read' },
  TICKET_UPDATE: { resource: 'ticket', action: 'update' },
  TICKET_DELETE: { resource: 'ticket', action: 'delete' },
  TICKET_ASSIGN: { resource: 'ticket', action: 'assign' },
  TICKET_CLOSE: { resource: 'ticket', action: 'close' },

  // Technician management
  TECHNICIAN_CREATE: { resource: 'technician', action: 'create' },
  TECHNICIAN_READ: { resource: 'technician', action: 'read' },
  TECHNICIAN_UPDATE: { resource: 'technician', action: 'update' },
  TECHNICIAN_DELETE: { resource: 'technician', action: 'delete' },
  TECHNICIAN_ASSIGN: { resource: 'technician', action: 'assign' },

  // Customer management
  CUSTOMER_CREATE: { resource: 'customer', action: 'create' },
  CUSTOMER_READ: { resource: 'customer', action: 'read' },
  CUSTOMER_UPDATE: { resource: 'customer', action: 'update' },
  CUSTOMER_DELETE: { resource: 'customer', action: 'delete' },

  // Analytics and reporting
  ANALYTICS_READ: { resource: 'analytics', action: 'read' },
  ANALYTICS_EXPORT: { resource: 'analytics', action: 'export' },
  REPORTS_CREATE: { resource: 'reports', action: 'create' },
  REPORTS_READ: { resource: 'reports', action: 'read' },

  // System administration
  SYSTEM_CONFIG: { resource: 'system', action: 'configure' },
  SYSTEM_MONITOR: { resource: 'system', action: 'monitor' },
  AUDIT_LOGS: { resource: 'audit', action: 'read' },

  // AI and automation
  AI_CONFIGURE: { resource: 'ai', action: 'configure' },
  AI_MONITOR: { resource: 'ai', action: 'monitor' },
  AUTOMATION_MANAGE: { resource: 'automation', action: 'manage' },

  // Integration management
  INTEGRATION_CONFIGURE: { resource: 'integration', action: 'configure' },
  INTEGRATION_MONITOR: { resource: 'integration', action: 'monitor' },

  // Notification management
  NOTIFICATION_SEND: { resource: 'notification', action: 'send' },
  NOTIFICATION_CONFIGURE: { resource: 'notification', action: 'configure' },

  // Time tracking
  TIME_TRACK: { resource: 'time', action: 'track' },
  TIME_VIEW: { resource: 'time', action: 'view' },
  TIME_EDIT: { resource: 'time', action: 'edit' },

  // SLA management
  SLA_READ: { resource: 'sla', action: 'read' },
  SLA_CONFIGURE: { resource: 'sla', action: 'configure' },
  SLA_MONITOR: { resource: 'sla', action: 'monitor' }
} as const;

// Define role-based permissions
export const ROLE_PERMISSIONS: RolePermissions = {
  [UserRole.ADMIN]: [
    // Full system access
    PERMISSIONS.USER_CREATE,
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE,
    PERMISSIONS.USER_DELETE,
    PERMISSIONS.USER_ACTIVATE,
    PERMISSIONS.USER_DEACTIVATE,
    
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ,
    PERMISSIONS.TICKET_UPDATE,
    PERMISSIONS.TICKET_DELETE,
    PERMISSIONS.TICKET_ASSIGN,
    PERMISSIONS.TICKET_CLOSE,
    
    PERMISSIONS.TECHNICIAN_CREATE,
    PERMISSIONS.TECHNICIAN_READ,
    PERMISSIONS.TECHNICIAN_UPDATE,
    PERMISSIONS.TECHNICIAN_DELETE,
    PERMISSIONS.TECHNICIAN_ASSIGN,
    
    PERMISSIONS.CUSTOMER_CREATE,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_UPDATE,
    PERMISSIONS.CUSTOMER_DELETE,
    
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.REPORTS_READ,
    
    PERMISSIONS.SYSTEM_CONFIG,
    PERMISSIONS.SYSTEM_MONITOR,
    PERMISSIONS.AUDIT_LOGS,
    
    PERMISSIONS.AI_CONFIGURE,
    PERMISSIONS.AI_MONITOR,
    PERMISSIONS.AUTOMATION_MANAGE,
    
    PERMISSIONS.INTEGRATION_CONFIGURE,
    PERMISSIONS.INTEGRATION_MONITOR,
    
    PERMISSIONS.NOTIFICATION_SEND,
    PERMISSIONS.NOTIFICATION_CONFIGURE,
    
    PERMISSIONS.TIME_TRACK,
    PERMISSIONS.TIME_VIEW,
    PERMISSIONS.TIME_EDIT,
    
    PERMISSIONS.SLA_READ,
    PERMISSIONS.SLA_CONFIGURE,
    PERMISSIONS.SLA_MONITOR
  ],

  [UserRole.MANAGER]: [
    // Management and oversight capabilities
    PERMISSIONS.USER_READ,
    PERMISSIONS.USER_UPDATE, // Limited to team members
    
    PERMISSIONS.TICKET_CREATE,
    PERMISSIONS.TICKET_READ,
    PERMISSIONS.TICKET_UPDATE,
    PERMISSIONS.TICKET_ASSIGN,
    PERMISSIONS.TICKET_CLOSE,
    
    PERMISSIONS.TECHNICIAN_READ,
    PERMISSIONS.TECHNICIAN_UPDATE,
    PERMISSIONS.TECHNICIAN_ASSIGN,
    
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.CUSTOMER_UPDATE,
    
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.ANALYTICS_EXPORT,
    PERMISSIONS.REPORTS_CREATE,
    PERMISSIONS.REPORTS_READ,
    
    PERMISSIONS.SYSTEM_MONITOR,
    
    PERMISSIONS.AI_MONITOR,
    
    PERMISSIONS.INTEGRATION_MONITOR,
    
    PERMISSIONS.NOTIFICATION_SEND,
    
    PERMISSIONS.TIME_VIEW,
    PERMISSIONS.TIME_EDIT,
    
    PERMISSIONS.SLA_READ,
    PERMISSIONS.SLA_MONITOR
  ],

  [UserRole.TECHNICIAN]: [
    // Operational capabilities for ticket resolution
    PERMISSIONS.TICKET_READ,
    PERMISSIONS.TICKET_UPDATE, // Only assigned tickets
    
    PERMISSIONS.CUSTOMER_READ,
    
    PERMISSIONS.TIME_TRACK,
    PERMISSIONS.TIME_VIEW, // Own time only
    
    PERMISSIONS.SLA_READ,
    
    PERMISSIONS.NOTIFICATION_SEND // For customer updates
  ],

  [UserRole.READ_ONLY]: [
    // View-only access
    PERMISSIONS.TICKET_READ,
    PERMISSIONS.CUSTOMER_READ,
    PERMISSIONS.ANALYTICS_READ,
    PERMISSIONS.REPORTS_READ,
    PERMISSIONS.TIME_VIEW,
    PERMISSIONS.SLA_READ
  ]
};

/**
 * Permission checking utilities
 */
export class PermissionChecker {
  /**
   * Check if a role has a specific permission
   */
  static hasPermission(role: UserRole, permission: Permission): boolean {
    const rolePermissions = ROLE_PERMISSIONS[role];
    return rolePermissions.some(p => 
      p.resource === permission.resource && p.action === permission.action
    );
  }

  /**
   * Check if a role has permission for a resource and action
   */
  static hasResourcePermission(role: UserRole, resource: string, action: string): boolean {
    return this.hasPermission(role, { resource, action });
  }

  /**
   * Get all permissions for a role
   */
  static getRolePermissions(role: UserRole): Permission[] {
    return ROLE_PERMISSIONS[role] || [];
  }

  /**
   * Check if a role can access a resource (any action)
   */
  static canAccessResource(role: UserRole, resource: string): boolean {
    const rolePermissions = ROLE_PERMISSIONS[role];
    return rolePermissions.some(p => p.resource === resource);
  }

  /**
   * Get all resources a role can access
   */
  static getAccessibleResources(role: UserRole): string[] {
    const rolePermissions = ROLE_PERMISSIONS[role];
    const resources = new Set(rolePermissions.map(p => p.resource));
    return Array.from(resources);
  }

  /**
   * Get all actions a role can perform on a resource
   */
  static getResourceActions(role: UserRole, resource: string): string[] {
    const rolePermissions = ROLE_PERMISSIONS[role];
    return rolePermissions
      .filter(p => p.resource === resource)
      .map(p => p.action);
  }

  /**
   * Check if user can perform action on their own resources
   */
  static canAccessOwnResource(role: UserRole, resource: string, action: string, ownerId: string, userId: string): boolean {
    // Admin can access everything
    if (role === UserRole.ADMIN) {
      return this.hasResourcePermission(role, resource, action);
    }

    // Check if user owns the resource or has general permission
    const hasPermission = this.hasResourcePermission(role, resource, action);
    const isOwner = ownerId === userId;

    // For certain resources, users can only access their own
    const selfOnlyResources = ['time', 'user'];
    if (selfOnlyResources.includes(resource)) {
      return hasPermission && (isOwner || role === UserRole.ADMIN || role === UserRole.MANAGER);
    }

    return hasPermission;
  }

  /**
   * Check hierarchical permissions (managers can manage their team members)
   */
  static canManageUser(managerRole: UserRole, targetRole: UserRole): boolean {
    if (managerRole === UserRole.ADMIN) {
      return true; // Admin can manage everyone
    }

    if (managerRole === UserRole.MANAGER) {
      // Managers can manage technicians and read-only users
      return targetRole === UserRole.TECHNICIAN || targetRole === UserRole.READ_ONLY;
    }

    return false; // Technicians and read-only users cannot manage others
  }

  /**
   * Check if user can assign tickets based on role hierarchy
   */
  static canAssignTicket(assignerRole: UserRole, assigneeRole: UserRole): boolean {
    if (assignerRole === UserRole.ADMIN) {
      return true; // Admin can assign to anyone
    }

    if (assignerRole === UserRole.MANAGER) {
      // Managers can assign to technicians
      return assigneeRole === UserRole.TECHNICIAN;
    }

    return false; // Technicians cannot assign tickets
  }
}