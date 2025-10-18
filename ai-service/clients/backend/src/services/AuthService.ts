import { UserEntity } from '../entities/UserEntity';
import { UserRepository } from '../database/repositories/UserRepository';
import { PasswordUtils } from '../utils/password';
import { JWTUtils } from '../utils/jwt';
import { 
  LoginRequest, 
  LoginResponse, 
  RefreshTokenRequest, 
  RefreshTokenResponse,
  RegisterRequest,
  ChangePasswordRequest,
  ResetPasswordRequest,
  ResetPasswordConfirmRequest,
  AuthTokenPayload 
} from '../types/auth';
import { UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

/**
 * Authentication service handling user authentication and authorization
 */
export class AuthService {
  private userRepository: UserRepository;

  constructor(userRepository: UserRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Register a new user
   */
  async register(request: RegisterRequest): Promise<LoginResponse> {
    // Validate password strength
    const passwordValidation = PasswordUtils.validatePasswordStrength(request.password);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(request.email);
    if (existingUser) {
      throw new Error('User with this email already exists');
    }

    // Hash password
    const passwordHash = await PasswordUtils.hashPassword(request.password);

    // Create user entity
    const user = new UserEntity({
      email: request.email.toLowerCase(),
      passwordHash,
      name: request.name,
      role: request.role,
      isActive: true,
      emailVerified: false // In production, this would require email verification
    });

    // Save user
    const createdUser = await this.userRepository.create(user);

    // Generate tokens
    const tokenPayload: AuthTokenPayload = {
      userId: createdUser.id,
      email: createdUser.email,
      role: createdUser.role
    };

    const { accessToken, refreshToken, expiresIn } = JWTUtils.generateTokenPair(tokenPayload);

    // Store refresh token
    await this.userRepository.addRefreshToken(createdUser.id, refreshToken);

    return {
      user: createdUser.toPublicUser(),
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Authenticate user login
   */
  async login(request: LoginRequest): Promise<LoginResponse> {
    // Find user by email
    const user = await this.userRepository.findByEmail(request.email.toLowerCase());
    if (!user) {
      throw new Error('Invalid email or password');
    }

    // Check if user is active
    if (!user.isActive) {
      throw new Error('Account is deactivated');
    }

    // Verify password
    const isPasswordValid = await PasswordUtils.verifyPassword(request.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Update last login
    await this.userRepository.updateLastLogin(user.id);

    // Generate tokens
    const tokenPayload: AuthTokenPayload = {
      userId: user.id,
      email: user.email,
      role: user.role
    };

    const { accessToken, refreshToken, expiresIn } = JWTUtils.generateTokenPair(tokenPayload);

    // Store refresh token
    await this.userRepository.addRefreshToken(user.id, refreshToken);

    return {
      user: user.toPublicUser(),
      accessToken,
      refreshToken,
      expiresIn
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(request: RefreshTokenRequest): Promise<RefreshTokenResponse> {
    try {
      // Verify refresh token
      const payload = JWTUtils.verifyRefreshToken(request.refreshToken);

      // Validate refresh token in database
      const isValidToken = await this.userRepository.validateRefreshToken(payload.userId, request.refreshToken);
      if (!isValidToken) {
        throw new Error('Invalid refresh token');
      }

      // Get user to ensure they're still active
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      // Generate new access token
      const newTokenPayload: AuthTokenPayload = {
        userId: user.id,
        email: user.email,
        role: user.role
      };

      const accessToken = JWTUtils.generateAccessToken(newTokenPayload);
      const expiresIn = JWTUtils.getTokenExpirySeconds('access');

      return {
        accessToken,
        expiresIn
      };
    } catch (error: any) {
      throw new Error(`Token refresh failed: ${error.message}`);
    }
  }

  /**
   * Logout user (invalidate refresh token)
   */
  async logout(userId: string, refreshToken: string): Promise<void> {
    await this.userRepository.removeRefreshToken(userId, refreshToken);
  }

  /**
   * Logout from all devices (clear all refresh tokens)
   */
  async logoutAll(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (user) {
      user.clearRefreshTokens();
      await this.userRepository.update(user);
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, request: ChangePasswordRequest): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Verify current password
    const isCurrentPasswordValid = await PasswordUtils.verifyPassword(
      request.currentPassword, 
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      throw new Error('Current password is incorrect');
    }

    // Validate new password strength
    const passwordValidation = PasswordUtils.validatePasswordStrength(request.newPassword);
    if (!passwordValidation.isValid) {
      throw new Error(`Password validation failed: ${passwordValidation.errors.join(', ')}`);
    }

    // Hash new password
    const newPasswordHash = await PasswordUtils.hashPassword(request.newPassword);

    // Update user
    user.passwordHash = newPasswordHash;
    user.clearRefreshTokens(); // Force re-login on all devices
    await this.userRepository.update(user);
  }

  /**
   * Initiate password reset
   */
  async initiatePasswordReset(request: ResetPasswordRequest): Promise<void> {
    const user = await this.userRepository.findByEmail(request.email.toLowerCase());
    if (!user) {
      // Don't reveal if email exists or not for security
      return;
    }

    // Generate reset token
    const resetToken = uuidv4();
    user.setPasswordResetToken(resetToken);
    await this.userRepository.update(user);

    // In production, send email with reset link containing the token
    // For now, we'll just log it (remove in production)
    console.log(`Password reset token for ${user.email}: ${resetToken}`);
  }

  /**
   * Confirm password reset
   */
  async confirmPasswordReset(request: ResetPasswordConfirmRequest): Promise<void> {
    // Find user by reset token (this would require a GSI in production)
    // For now, we'll need to implement a different approach
    throw new Error('Password reset confirmation not implemented - requires additional GSI setup');
  }

  /**
   * Validate access token and return user payload
   */
  async validateAccessToken(token: string): Promise<AuthTokenPayload> {
    try {
      const payload = JWTUtils.verifyAccessToken(token);

      // Optionally verify user still exists and is active
      const user = await this.userRepository.findById(payload.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      return payload;
    } catch (error: any) {
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }

  /**
   * Get user by ID
   */
  async getUserById(id: string): Promise<UserEntity | null> {
    return this.userRepository.findById(id);
  }

  /**
   * Get user by email
   */
  async getUserByEmail(email: string): Promise<UserEntity | null> {
    return this.userRepository.findByEmail(email.toLowerCase());
  }

  /**
   * Update user profile
   */
  async updateUserProfile(userId: string, updates: {
    name?: string;
    email?: string;
  }): Promise<UserEntity> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    // Check if email is being changed and if it's already taken
    if (updates.email && updates.email !== user.email) {
      const existingUser = await this.userRepository.findByEmail(updates.email.toLowerCase());
      if (existingUser) {
        throw new Error('Email already in use');
      }
      user.email = updates.email.toLowerCase();
    }

    if (updates.name) {
      user.name = updates.name;
    }

    return this.userRepository.update(user);
  }

  /**
   * Deactivate user account
   */
  async deactivateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = false;
    user.clearRefreshTokens();
    await this.userRepository.update(user);
  }

  /**
   * Activate user account
   */
  async activateUser(userId: string): Promise<void> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new Error('User not found');
    }

    user.isActive = true;
    await this.userRepository.update(user);
  }
}