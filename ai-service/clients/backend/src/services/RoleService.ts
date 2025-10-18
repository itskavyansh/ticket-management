import { UserRepository } from '../database/repositories/UserRepository';
import { PermissionChecker } from '../utils/permissions';
import { UserRole } from '../types';
import { Permission } from '../types/auth';

/**
 * Service for managing user roles and permissions
 */
export class RoleService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Get all available roles
   */
  getAllRoles(): UserRole[] {
    return Object.values(UserRole);
  }

  /**
   * Get permissions for a specific role
   */
  getRolePermissions(role: UserRole): Permission[] {
    return PermissionChecker.getRolePermissions(role);
  }

  /**
   * Get all resources accessible by a role
   */
  getRoleResources(role: UserRole): string[] {
    return PermissionChecker.getAccessibleResources(role);
  }

  /**
   * Check if a role has a specific permission
   */
  hasPermission(role: UserRole, resource: string, action: string): boolean {
    return PermissionChecker.hasResourcePermission(role, resource, action);
  }

  /**
   * Get users by role
   */
  async getUsersByRole(role: UserRole): Promise<any[]> {
    const users = await this.userRepository.findByRole(role);
    return users.map(user => user.toPublicUser());
  }

  /**
   * Update user role (admin only operation)
   */
  async updateUserRole(userId: string, newRole: UserRole, adminUserId: string): Promise<void> {
    // Verify admin permissions
    const adminUser = await this.userRepository.findById(adminUserId);
    if (!adminUser || adminUser.role !== UserRole.ADMIN) {
      throw new Error('Only administrators can change user roles');
    }

    // Get target user
    const targetUser = await this.userRepository.findById(userId);
    if (!targetUser) {
      throw new Error('User not found');
    }

    // Prevent admin from demoting themselves unless there's another admin
    if (adminUserId === userId && newRole !== UserRole.ADMIN) {
      const adminUsers = await this.userRepository.findByRole(UserRole.ADMIN);
      if (adminUsers.length <= 1) {
        throw new Error('Cannot demote the last administrator');
      }
    }

    // Update role
    targetUser.role = newRole;
    targetUser.clearRefreshTokens(); // Force re-login to get new permissions
    await this.userRepository.update(targetUser);
  }

  /**
   * Get role hierarchy information
   */
  getRoleHierarchy(): { [key in UserRole]: { level: number; canManage: UserRole[] } } {
    return {
      [UserRole.ADMIN]: {
        level: 4,
        canManage: [UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]
      },
      [UserRole.MANAGER]: {
        level: 3,
        canManage: [UserRole.TECHNICIAN, UserRole.READ_ONLY]
      },
      [UserRole.TECHNICIAN]: {
        level: 2,
        canManage: []
      },
      [UserRole.READ_ONLY]: {
        level: 1,
        canManage: []
      }
    };
  }

  /**
   * Check if one role can manage another
   */
  canManageRole(managerRole: UserRole, targetRole: UserRole): boolean {
    return PermissionChecker.canManageUser(managerRole, targetRole);
  }

  /**
   * Get effective permissions for a user (considering role and context)
   */
  async getUserEffectivePermissions(userId: string): Promise<{
    role: UserRole;
    permissions: Permission[];
    resources: string[];
    canManage: UserRole[];
  }> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const permissions = this.getRolePermissions(user.role);
    const resources = this.getRoleResources(user.role);
    const hierarchy = this.getRoleHierarchy();
    const canManage = hierarchy[user.role].canManage;

    return {
      role: user.role,
      permissions,
      resources,
      canManage
    };
  }

  /**
   * Validate role assignment based on business rules
   */
  validateRoleAssignment(assignerRole: UserRole, targetRole: UserRole, currentRole?: UserRole): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Only admins can assign admin role
    if (targetRole === UserRole.ADMIN && assignerRole !== UserRole.ADMIN) {
      errors.push('Only administrators can assign admin role');
    }

    // Managers can only assign technician and read-only roles
    if (assignerRole === UserRole.MANAGER) {
      const allowedRoles = [UserRole.TECHNICIAN, UserRole.READ_ONLY];
      if (!allowedRoles.includes(targetRole)) {
        errors.push('Managers can only assign technician and read-only roles');
      }
    }

    // Technicians and read-only users cannot assign roles
    if ([UserRole.TECHNICIAN, UserRole.READ_ONLY].includes(assignerRole)) {
      errors.push('Insufficient permissions to assign roles');
    }

    // Validate role transition
    if (currentRole) {
      // Prevent demotion of admin by non-admin
      if (currentRole === UserRole.ADMIN && targetRole !== UserRole.ADMIN && assignerRole !== UserRole.ADMIN) {
        errors.push('Only administrators can demote admin users');
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Get role statistics
   */
  async getRoleStatistics(): Promise<{ [key in UserRole]: number }> {
    const stats: { [key in UserRole]: number } = {
      [UserRole.ADMIN]: 0,
      [UserRole.MANAGER]: 0,
      [UserRole.TECHNICIAN]: 0,
      [UserRole.READ_ONLY]: 0
    };

    for (const role of Object.values(UserRole)) {
      const users = await this.userRepository.findByRole(role);
      stats[role] = users.length;
    }

    return stats;
  }

  /**
   * Check if user can perform action on specific resource instance
   */
  async canAccessResourceInstance(
    userId: string,
    resource: string,
    action: string,
    resourceOwnerId?: string
  ): Promise<boolean> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      return false;
    }

    // Check basic permission
    const hasPermission = PermissionChecker.hasResourcePermission(user.role, resource, action);
    if (!hasPermission) {
      return false;
    }

    // If no specific owner, user has access based on role
    if (!resourceOwnerId) {
      return true;
    }

    // Check ownership or management permissions
    return PermissionChecker.canAccessOwnResource(
      user.role,
      resource,
      action,
      resourceOwnerId,
      userId
    );
  }

  /**
   * Get permission matrix for all roles
   */
  getPermissionMatrix(): { [key in UserRole]: { [resource: string]: string[] } } {
    const matrix: { [key in UserRole]: { [resource: string]: string[] } } = {
      [UserRole.ADMIN]: {},
      [UserRole.MANAGER]: {},
      [UserRole.TECHNICIAN]: {},
      [UserRole.READ_ONLY]: {}
    };

    for (const role of Object.values(UserRole)) {
      const permissions = this.getRolePermissions(role);
      const resourceActions: { [resource: string]: string[] } = {};

      permissions.forEach(permission => {
        if (!resourceActions[permission.resource]) {
          resourceActions[permission.resource] = [];
        }
        resourceActions[permission.resource].push(permission.action);
      });

      matrix[role] = resourceActions;
    }

    return matrix;
  }
}