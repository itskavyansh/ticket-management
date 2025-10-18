import jwt from 'jsonwebtoken';
import { AuthTokenPayload } from '../types/auth';

/**
 * JWT token utilities for authentication
 */
export class JWTUtils {
  private static readonly ACCESS_TOKEN_SECRET = process.env.JWT_ACCESS_SECRET || 'your-access-token-secret';
  private static readonly REFRESH_TOKEN_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-token-secret';
  private static readonly ACCESS_TOKEN_EXPIRY = process.env.JWT_ACCESS_EXPIRY || '15m';
  private static readonly REFRESH_TOKEN_EXPIRY = process.env.JWT_REFRESH_EXPIRY || '7d';

  /**
   * Generate an access token
   * @param payload - Token payload
   * @returns string - JWT access token
   */
  static generateAccessToken(payload: AuthTokenPayload): string {
    return jwt.sign(
      payload,
      this.ACCESS_TOKEN_SECRET,
      {
        expiresIn: this.ACCESS_TOKEN_EXPIRY,
        issuer: 'ai-ticket-management',
        audience: 'ai-ticket-management-users'
      }
    );
  }

  /**
   * Generate a refresh token
   * @param payload - Token payload
   * @returns string - JWT refresh token
   */
  static generateRefreshToken(payload: AuthTokenPayload): string {
    return jwt.sign(
      payload,
      this.REFRESH_TOKEN_SECRET,
      {
        expiresIn: this.REFRESH_TOKEN_EXPIRY,
        issuer: 'ai-ticket-management',
        audience: 'ai-ticket-management-users'
      }
    );
  }

  /**
   * Verify and decode an access token
   * @param token - JWT access token
   * @returns AuthTokenPayload - Decoded token payload
   */
  static verifyAccessToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.ACCESS_TOKEN_SECRET, {
        issuer: 'ai-ticket-management',
        audience: 'ai-ticket-management-users'
      }) as AuthTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Access token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid access token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Verify and decode a refresh token
   * @param token - JWT refresh token
   * @returns AuthTokenPayload - Decoded token payload
   */
  static verifyRefreshToken(token: string): AuthTokenPayload {
    try {
      const decoded = jwt.verify(token, this.REFRESH_TOKEN_SECRET, {
        issuer: 'ai-ticket-management',
        audience: 'ai-ticket-management-users'
      }) as AuthTokenPayload;

      return decoded;
    } catch (error) {
      if (error instanceof jwt.TokenExpiredError) {
        throw new Error('Refresh token has expired');
      } else if (error instanceof jwt.JsonWebTokenError) {
        throw new Error('Invalid refresh token');
      } else {
        throw new Error('Token verification failed');
      }
    }
  }

  /**
   * Extract token from Authorization header
   * @param authHeader - Authorization header value
   * @returns string | null - Extracted token or null
   */
  static extractTokenFromHeader(authHeader: string | undefined): string | null {
    if (!authHeader) {
      return null;
    }

    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      return null;
    }

    return parts[1];
  }

  /**
   * Get token expiry time in seconds
   * @param tokenType - 'access' or 'refresh'
   * @returns number - Expiry time in seconds
   */
  static getTokenExpirySeconds(tokenType: 'access' | 'refresh'): number {
    const expiry = tokenType === 'access' ? this.ACCESS_TOKEN_EXPIRY : this.REFRESH_TOKEN_EXPIRY;
    
    // Parse expiry string (e.g., '15m', '7d', '3600s')
    const match = expiry.match(/^(\d+)([smhd])$/);
    if (!match) {
      return tokenType === 'access' ? 900 : 604800; // Default: 15min or 7days
    }

    const [, value, unit] = match;
    const num = parseInt(value, 10);

    switch (unit) {
      case 's': return num;
      case 'm': return num * 60;
      case 'h': return num * 3600;
      case 'd': return num * 86400;
      default: return tokenType === 'access' ? 900 : 604800;
    }
  }

  /**
   * Generate token pair (access + refresh)
   * @param payload - Token payload
   * @returns object with access and refresh tokens
   */
  static generateTokenPair(payload: AuthTokenPayload): {
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  } {
    return {
      accessToken: this.generateAccessToken(payload),
      refreshToken: this.generateRefreshToken(payload),
      expiresIn: this.getTokenExpirySeconds('access')
    };
  }
}