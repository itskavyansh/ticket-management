import { Response } from 'express';
import { RoleService } from '../services/RoleService';
import { AuthenticatedRequest } from '../types/auth';
import { UserRole } from '../types';

/**
 * Controller for role and permission management
 */
export class RoleController {
  private roleService: RoleService;

  constructor(roleService: RoleService) {
    this.roleService = roleService;
  }

  /**
   * Get all available roles
   */
  getRoles = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const roles = this.roleService.getAllRoles();
      
      res.status(200).json({
        success: true,
        message: 'Roles retrieved successfully',
        data: roles
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve roles',
        message: error.message
      });
    }
  };

  /**
   * Get permissions for a specific role
   */
  getRolePermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { role } = req.params;
      
      if (!Object.values(UserRole).includes(role as UserRole)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role',
          message: 'Specified role does not exist'
        });
        return;
      }

      const permissions = this.roleService.getRolePermissions(role as UserRole);
      const resources = this.roleService.getRoleResources(role as UserRole);
      
      res.status(200).json({
        success: true,
        message: 'Role permissions retrieved successfully',
        data: {
          role,
          permissions,
          resources
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve role permissions',
        message: error.message
      });
    }
  };

  /**
   * Get users by role
   */
  getUsersByRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { role } = req.params;
      
      if (!Object.values(UserRole).includes(role as UserRole)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role',
          message: 'Specified role does not exist'
        });
        return;
      }

      const users = await this.roleService.getUsersByRole(role as UserRole);
      
      res.status(200).json({
        success: true,
        message: 'Users retrieved successfully',
        data: {
          role,
          users,
          count: users.length
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve users by role',
        message: error.message
      });
    }
  };

  /**
   * Update user role (admin only)
   */
  updateUserRole = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;
      const { role: newRole } = req.body;
      const adminUserId = req.user?.userId;

      if (!adminUserId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      if (!Object.values(UserRole).includes(newRole)) {
        res.status(400).json({
          success: false,
          error: 'Invalid role',
          message: 'Specified role does not exist'
        });
        return;
      }

      // Validate role assignment
      const validation = this.roleService.validateRoleAssignment(
        req.user!.role,
        newRole
      );

      if (!validation.isValid) {
        res.status(403).json({
          success: false,
          error: 'Role assignment validation failed',
          message: validation.errors.join(', ')
        });
        return;
      }

      await this.roleService.updateUserRole(userId, newRole, adminUserId);
      
      res.status(200).json({
        success: true,
        message: 'User role updated successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Failed to update user role',
        message: error.message
      });
    }
  };

  /**
   * Get role hierarchy
   */
  getRoleHierarchy = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const hierarchy = this.roleService.getRoleHierarchy();
      
      res.status(200).json({
        success: true,
        message: 'Role hierarchy retrieved successfully',
        data: hierarchy
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve role hierarchy',
        message: error.message
      });
    }
  };

  /**
   * Get current user's effective permissions
   */
  getUserPermissions = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      const effectivePermissions = await this.roleService.getUserEffectivePermissions(userId);
      
      res.status(200).json({
        success: true,
        message: 'User permissions retrieved successfully',
        data: effectivePermissions
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve user permissions',
        message: error.message
      });
    }
  };

  /**
   * Check if user has specific permission
   */
  checkPermission = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { resource, action } = req.body;
      const userRole = req.user?.role;

      if (!userRole) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      if (!resource || !action) {
        res.status(400).json({
          success: false,
          error: 'Missing parameters',
          message: 'Resource and action are required'
        });
        return;
      }

      const hasPermission = this.roleService.hasPermission(userRole, resource, action);
      
      res.status(200).json({
        success: true,
        message: 'Permission check completed',
        data: {
          resource,
          action,
          hasPermission,
          role: userRole
        }
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to check permission',
        message: error.message
      });
    }
  };

  /**
   * Get role statistics
   */
  getRoleStatistics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const statistics = await this.roleService.getRoleStatistics();
      
      res.status(200).json({
        success: true,
        message: 'Role statistics retrieved successfully',
        data: statistics
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve role statistics',
        message: error.message
      });
    }
  };

  /**
   * Get permission matrix for all roles
   */
  getPermissionMatrix = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const matrix = this.roleService.getPermissionMatrix();
      
      res.status(200).json({
        success: true,
        message: 'Permission matrix retrieved successfully',
        data: matrix
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve permission matrix',
        message: error.message
      });
    }
  };

  /**
   * Validate role assignment
   */
  validateRoleAssignment = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { targetRole, currentRole } = req.body;
      const assignerRole = req.user?.role;

      if (!assignerRole) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      if (!targetRole) {
        res.status(400).json({
          success: false,
          error: 'Missing parameter',
          message: 'Target role is required'
        });
        return;
      }

      const validation = this.roleService.validateRoleAssignment(
        assignerRole,
        targetRole,
        currentRole
      );
      
      res.status(200).json({
        success: true,
        message: 'Role assignment validation completed',
        data: validation
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Failed to validate role assignment',
        message: error.message
      });
    }
  };
}