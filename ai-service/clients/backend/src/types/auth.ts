// Authentication and authorization type definitions

import { Request } from 'express';
import { UserRole } from './index';

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  lastLoginAt?: Date;
}

export interface AuthTokenPayload {
  userId: string;
  email: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  user: Omit<User, 'password'>;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  accessToken: string;
  expiresIn: number;
}

export interface RegisterRequest {
  email: string;
  password: string;
  name: string;
  role: UserRole;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
}

export interface ResetPasswordRequest {
  email: string;
}

export interface ResetPasswordConfirmRequest {
  token: string;
  newPassword: string;
}

import { Request } from 'express';

export interface AuthenticatedRequest extends Request {
  user?: AuthTokenPayload;
}

export interface Permission {
  resource: string;
  action: string;
}

export interface RolePermissions {
  [UserRole.ADMIN]: Permission[];
  [UserRole.MANAGER]: Permission[];
  [UserRole.TECHNICIAN]: Permission[];
  [UserRole.READ_ONLY]: Permission[];
}