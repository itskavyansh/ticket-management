import { Router } from 'express';
import { RoleController } from '../controllers/RoleController';
import { RoleService } from '../services/RoleService';
import { UserRepository } from '../database/repositories/UserRepository';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { 
  authenticate, 
  requireAdmin, 
  requireManager 
} from '../middleware/auth';
import {
  requireUserRead,
  requireUserUpdate,
  requireSystemMonitor
} from '../middleware/rbac';
import { 
  validateRequest,
  updateUserRoleSchema,
  checkPermissionSchema,
  validateRoleAssignmentSchema,
  validateRoleParam,
  validateUserIdParam
} from '../validation/roleValidation';

/**
 * Role management routes
 */
export const createRoleRoutes = (documentClient: DocumentClient): Router => {
  const router = Router();
  
  // Initialize dependencies
  const userRepository = new UserRepository(documentClient);
  const roleService = new RoleService(userRepository);
  const roleController = new RoleController(roleService);

  // Public role information (for authenticated users)
  router.get('/roles', 
    authenticate,
    roleController.getRoles
  );

  router.get('/roles/:role/permissions', 
    authenticate,
    validateRoleParam,
    roleController.getRolePermissions
  );

  router.get('/roles/hierarchy', 
    authenticate,
    roleController.getRoleHierarchy
  );

  // User permission management
  router.get('/permissions/me', 
    authenticate,
    roleController.getUserPermissions
  );

  router.post('/permissions/check', 
    authenticate,
    validateRequest(checkPermissionSchema),
    roleController.checkPermission
  );

  router.post('/roles/validate-assignment', 
    authenticate,
    requireManager, // Managers and above can validate role assignments
    validateRequest(validateRoleAssignmentSchema),
    roleController.validateRoleAssignment
  );

  // User role management (requires appropriate permissions)
  router.get('/roles/:role/users', 
    authenticate,
    requireUserRead,
    validateRoleParam,
    roleController.getUsersByRole
  );

  router.put('/users/:userId/role', 
    authenticate,
    requireUserUpdate,
    validateUserIdParam,
    validateRequest(updateUserRoleSchema),
    roleController.updateUserRole
  );

  // Administrative endpoints
  router.get('/roles/statistics', 
    authenticate,
    requireSystemMonitor,
    roleController.getRoleStatistics
  );

  router.get('/permissions/matrix', 
    authenticate,
    requireAdmin, // Only admins can see full permission matrix
    roleController.getPermissionMatrix
  );

  return router;
};

export default createRoleRoutes;