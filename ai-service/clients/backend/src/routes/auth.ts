import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { AuthService } from '../services/AuthService';
import { UserRepository } from '../database/repositories/UserRepository';
import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { 
  authenticate, 
  requireAdmin, 
  authRateLimit,
  authorizeSelf 
} from '../middleware/auth';
import { 
  validateRequest,
  loginSchema,
  registerSchema,
  refreshTokenSchema,
  changePasswordSchema,
  resetPasswordRequestSchema,
  resetPasswordConfirmSchema,
  updateProfileSchema,
  logoutSchema
} from '../validation/authValidation';

/**
 * Authentication routes
 */
export const createAuthRoutes = (documentClient: DocumentClient): Router => {
  const router = Router();
  
  // Initialize dependencies
  const userRepository = new UserRepository(documentClient);
  const authService = new AuthService(userRepository);
  const authController = new AuthController(authService);

  // Apply rate limiting to auth endpoints
  const loginRateLimit = authRateLimit(5, 15 * 60 * 1000); // 5 attempts per 15 minutes
  const registerRateLimit = authRateLimit(3, 60 * 60 * 1000); // 3 attempts per hour

  // Public routes (no authentication required)
  router.post('/register', 
    registerRateLimit,
    validateRequest(registerSchema), 
    authController.register
  );

  router.post('/login', 
    loginRateLimit,
    validateRequest(loginSchema), 
    authController.login
  );

  router.post('/refresh-token', 
    validateRequest(refreshTokenSchema), 
    authController.refreshToken
  );

  router.post('/forgot-password', 
    authRateLimit(3, 60 * 60 * 1000), // 3 attempts per hour
    validateRequest(resetPasswordRequestSchema), 
    authController.initiatePasswordReset
  );

  router.post('/reset-password', 
    validateRequest(resetPasswordConfirmSchema), 
    authController.confirmPasswordReset
  );

  // Protected routes (authentication required)
  router.post('/logout', 
    authenticate,
    validateRequest(logoutSchema), 
    authController.logout
  );

  router.post('/logout-all', 
    authenticate,
    authController.logoutAll
  );

  router.post('/change-password', 
    authenticate,
    validateRequest(changePasswordSchema), 
    authController.changePassword
  );

  router.get('/profile', 
    authenticate,
    authController.getProfile
  );

  router.put('/profile', 
    authenticate,
    validateRequest(updateProfileSchema), 
    authController.updateProfile
  );

  router.get('/validate-token', 
    authenticate,
    authController.validateToken
  );

  // Admin-only routes
  router.post('/users/:userId/deactivate', 
    authenticate,
    requireAdmin,
    authController.deactivateUser
  );

  router.post('/users/:userId/activate', 
    authenticate,
    requireAdmin,
    authController.activateUser
  );

  return router;
};

export default createAuthRoutes;