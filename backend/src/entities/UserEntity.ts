import { BaseEntity } from './BaseEntity';
import { UserRole } from '../types';

/**
 * User entity for DynamoDB storage
 */
export class UserEntity extends BaseEntity {
  public email: string;
  public passwordHash: string;
  public name: string;
  public role: UserRole;
  public isActive: boolean;
  public lastLoginAt?: Date;
  public refreshTokens: string[];
  public passwordResetToken?: string;
  public passwordResetExpires?: Date;
  public emailVerified: boolean;
  public emailVerificationToken?: string;

  constructor(data: {
    id?: string;
    email: string;
    passwordHash: string;
    name: string;
    role: UserRole;
    isActive?: boolean;
    lastLoginAt?: Date;
    refreshTokens?: string[];
    passwordResetToken?: string;
    passwordResetExpires?: Date;
    emailVerified?: boolean;
    emailVerificationToken?: string;
    createdAt?: Date;
    updatedAt?: Date;
  }) {
    super(data.id, data.createdAt, data.updatedAt);
    
    this.email = data.email;
    this.passwordHash = data.passwordHash;
    this.name = data.name;
    this.role = data.role;
    this.isActive = data.isActive ?? true;
    this.lastLoginAt = data.lastLoginAt;
    this.refreshTokens = data.refreshTokens || [];
    this.passwordResetToken = data.passwordResetToken;
    this.passwordResetExpires = data.passwordResetExpires;
    this.emailVerified = data.emailVerified ?? false;
    this.emailVerificationToken = data.emailVerificationToken;
  }

  /**
   * Convert entity to DynamoDB item format
   */
  toDynamoDBItem(): Record<string, any> {
    return {
      PK: `USER#${this.id}`,
      SK: `USER#${this.id}`,
      GSI1PK: `EMAIL#${this.email}`,
      GSI1SK: `USER#${this.id}`,
      EntityType: 'User',
      id: this.id,
      email: this.email,
      passwordHash: this.passwordHash,
      name: this.name,
      role: this.role,
      isActive: this.isActive,
      lastLoginAt: this.lastLoginAt?.toISOString(),
      refreshTokens: this.refreshTokens,
      passwordResetToken: this.passwordResetToken,
      passwordResetExpires: this.passwordResetExpires?.toISOString(),
      emailVerified: this.emailVerified,
      emailVerificationToken: this.emailVerificationToken,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }

  /**
   * Create entity from DynamoDB item
   */
  static fromDynamoDBItem(item: Record<string, any>): UserEntity {
    return new UserEntity({
      id: item.id,
      email: item.email,
      passwordHash: item.passwordHash,
      name: item.name,
      role: item.role as UserRole,
      isActive: item.isActive,
      lastLoginAt: item.lastLoginAt ? new Date(item.lastLoginAt) : undefined,
      refreshTokens: item.refreshTokens || [],
      passwordResetToken: item.passwordResetToken,
      passwordResetExpires: item.passwordResetExpires ? new Date(item.passwordResetExpires) : undefined,
      emailVerified: item.emailVerified,
      emailVerificationToken: item.emailVerificationToken,
      createdAt: new Date(item.createdAt),
      updatedAt: new Date(item.updatedAt)
    });
  }

  /**
   * Convert to public user object (without sensitive data)
   */
  toPublicUser(): {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    isActive: boolean;
    lastLoginAt?: Date;
    emailVerified: boolean;
    createdAt: Date;
    updatedAt: Date;
  } {
    return {
      id: this.id,
      email: this.email,
      name: this.name,
      role: this.role,
      isActive: this.isActive,
      lastLoginAt: this.lastLoginAt,
      emailVerified: this.emailVerified,
      createdAt: this.createdAt,
      updatedAt: this.updatedAt
    };
  }

  /**
   * Add refresh token to user
   */
  addRefreshToken(token: string): void {
    // Keep only the last 5 refresh tokens
    this.refreshTokens = [token, ...this.refreshTokens.slice(0, 4)];
    this.updatedAt = new Date();
  }

  /**
   * Remove refresh token from user
   */
  removeRefreshToken(token: string): void {
    this.refreshTokens = this.refreshTokens.filter(t => t !== token);
    this.updatedAt = new Date();
  }

  /**
   * Clear all refresh tokens
   */
  clearRefreshTokens(): void {
    this.refreshTokens = [];
    this.updatedAt = new Date();
  }

  /**
   * Update last login timestamp
   */
  updateLastLogin(): void {
    this.lastLoginAt = new Date();
    this.updatedAt = new Date();
  }

  /**
   * Set password reset token
   */
  setPasswordResetToken(token: string, expiresIn: number = 3600000): void { // 1 hour default
    this.passwordResetToken = token;
    this.passwordResetExpires = new Date(Date.now() + expiresIn);
    this.updatedAt = new Date();
  }

  /**
   * Clear password reset token
   */
  clearPasswordResetToken(): void {
    this.passwordResetToken = undefined;
    this.passwordResetExpires = undefined;
    this.updatedAt = new Date();
  }

  /**
   * Check if password reset token is valid
   */
  isPasswordResetTokenValid(token: string): boolean {
    return this.passwordResetToken === token && 
           this.passwordResetExpires !== undefined && 
           this.passwordResetExpires > new Date();
  }
}