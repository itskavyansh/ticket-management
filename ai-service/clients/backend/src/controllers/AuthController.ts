import { Request, Response } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthenticatedRequest } from '../types/auth';
import { 
  LoginRequest, 
  RefreshTokenRequest, 
  RegisterRequest, 
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirmRequest 
} from '../types/auth';

/**
 * Authentication controller handling auth-related HTTP requests
 */
export class AuthController {
  private authService: AuthService;

  constructor(authService: AuthService) {
    this.authService = authService;
  }

  /**
   * Register a new user
   */
  register = async (req: Request, res: Response): Promise<void> => {
    try {
      const registerData: RegisterRequest = req.body;
      const result = await this.authService.register(registerData);

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Registration failed',
        message: error.message
      });
    }
  };

  /**
   * User login
   */
  login = async (req: Request, res: Response): Promise<void> => {
    try {
      const loginData: LoginRequest = req.body;
      const result = await this.authService.login(loginData);

      res.status(200).json({
        success: true,
        message: 'Login successful',
        data: result
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: 'Login failed',
        message: error.message
      });
    }
  };

  /**
   * Refresh access token
   */
  refreshToken = async (req: Request, res: Response): Promise<void> => {
    try {
      const refreshData: RefreshTokenRequest = req.body;
      const result = await this.authService.refreshToken(refreshData);

      res.status(200).json({
        success: true,
        message: 'Token refreshed successfully',
        data: result
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: 'Token refresh failed',
        message: error.message
      });
    }
  };

  /**
   * User logout
   */
  logout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { refreshToken } = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      await this.authService.logout(userId, refreshToken);

      res.status(200).json({
        success: true,
        message: 'Logout successful'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Logout failed',
        message: error.message
      });
    }
  };

  /**
   * Logout from all devices
   */
  logoutAll = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      await this.authService.logoutAll(userId);

      res.status(200).json({
        success: true,
        message: 'Logged out from all devices successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Logout failed',
        message: error.message
      });
    }
  };

  /**
   * Change password
   */
  changePassword = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const changePasswordData: ChangePasswordRequest = req.body;
      const userId = req.user?.userId;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      await this.authService.changePassword(userId, changePasswordData);

      res.status(200).json({
        success: true,
        message: 'Password changed successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Password change failed',
        message: error.message
      });
    }
  };

  /**
   * Initiate password reset
   */
  initiatePasswordReset = async (req: Request, res: Response): Promise<void> => {
    try {
      const resetData: ResetPasswordRequest = req.body;
      await this.authService.initiatePasswordReset(resetData);

      // Always return success for security (don't reveal if email exists)
      res.status(200).json({
        success: true,
        message: 'If the email exists, a password reset link has been sent'
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Password reset failed',
        message: 'An error occurred while processing your request'
      });
    }
  };

  /**
   * Confirm password reset
   */
  confirmPasswordReset = async (req: Request, res: Response): Promise<void> => {
    try {
      const confirmData: ResetPasswordConfirmRequest = req.body;
      await this.authService.confirmPasswordReset(confirmData);

      res.status(200).json({
        success: true,
        message: 'Password reset successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Password reset failed',
        message: error.message
      });
    }
  };

  /**
   * Get current user profile
   */
  getProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
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

      const user = await this.authService.getUserById(userId);
      if (!user) {
        res.status(404).json({
          success: false,
          error: 'User not found',
          message: 'User profile not found'
        });
        return;
      }

      res.status(200).json({
        success: true,
        message: 'Profile retrieved successfully',
        data: user.toPublicUser()
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        error: 'Profile retrieval failed',
        message: error.message
      });
    }
  };

  /**
   * Update user profile
   */
  updateProfile = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId;
      const updates = req.body;

      if (!userId) {
        res.status(401).json({
          success: false,
          error: 'Authentication required',
          message: 'User not authenticated'
        });
        return;
      }

      const updatedUser = await this.authService.updateUserProfile(userId, updates);

      res.status(200).json({
        success: true,
        message: 'Profile updated successfully',
        data: updatedUser.toPublicUser()
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'Profile update failed',
        message: error.message
      });
    }
  };

  /**
   * Validate token (for client-side token validation)
   */
  validateToken = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // If we reach here, the token is valid (middleware already validated it)
      res.status(200).json({
        success: true,
        message: 'Token is valid',
        data: {
          user: req.user,
          valid: true
        }
      });
    } catch (error: any) {
      res.status(401).json({
        success: false,
        error: 'Token validation failed',
        message: error.message
      });
    }
  };

  /**
   * Deactivate user account (admin only)
   */
  deactivateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      await this.authService.deactivateUser(userId);

      res.status(200).json({
        success: true,
        message: 'User account deactivated successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'User deactivation failed',
        message: error.message
      });
    }
  };

  /**
   * Activate user account (admin only)
   */
  activateUser = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { userId } = req.params;

      await this.authService.activateUser(userId);

      res.status(200).json({
        success: true,
        message: 'User account activated successfully'
      });
    } catch (error: any) {
      res.status(400).json({
        success: false,
        error: 'User activation failed',
        message: error.message
      });
    }
  };
}