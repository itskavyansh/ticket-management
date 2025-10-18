import { SecretManager } from '../utils/encryption';
import { logger } from '../utils/logger';

/**
 * Security configuration and validation
 */
export class SecurityConfig {
  private static initialized = false;

  /**
   * Initialize security configuration
   */
  static initialize(): void {
    if (this.initialized) {
      return;
    }

    try {
      // Load secrets from environment
      SecretManager.loadSecretsFromEnv();

      // Validate required secrets
      const missingSecrets = SecretManager.validateRequiredSecrets();
      if (missingSecrets.length > 0) {
        throw new Error(`Missing required secrets: ${missingSecrets.join(', ')}`);
      }

      // Validate encryption key strength
      this.validateEncryptionKey();

      // Validate JWT secrets
      this.validateJWTSecrets();

      // Set security defaults
      this.setSecurityDefaults();

      this.initialized = true;
      logger.info('Security configuration initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize security configuration', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Validate encryption key strength
   */
  private static validateEncryptionKey(): void {
    const encryptionKey = process.env.ENCRYPTION_KEY;
    
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY is required');
    }

    if (encryptionKey.length < 32) {
      throw new Error('ENCRYPTION_KEY must be at least 32 characters long');
    }

    // Check for weak patterns
    if (/^(.)\1+$/.test(encryptionKey)) {
      throw new Error('ENCRYPTION_KEY cannot be all the same character');
    }

    if (/^(012|123|abc|password|secret)/i.test(encryptionKey)) {
      throw new Error('ENCRYPTION_KEY contains weak patterns');
    }
  }

  /**
   * Validate JWT secrets
   */
  private static validateJWTSecrets(): void {
    const accessSecret = process.env.JWT_ACCESS_SECRET;
    const refreshSecret = process.env.JWT_REFRESH_SECRET;

    if (!accessSecret || accessSecret.length < 32) {
      throw new Error('JWT_ACCESS_SECRET must be at least 32 characters long');
    }

    if (!refreshSecret || refreshSecret.length < 32) {
      throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
    }

    if (accessSecret === refreshSecret) {
      throw new Error('JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different');
    }
  }

  /**
   * Set security defaults
   */
  private static setSecurityDefaults(): void {
    // Set default values for security-related environment variables
    if (!process.env.BCRYPT_ROUNDS) {
      process.env.BCRYPT_ROUNDS = '12';
    }

    if (!process.env.SESSION_TIMEOUT) {
      process.env.SESSION_TIMEOUT = '3600'; // 1 hour
    }

    if (!process.env.MAX_LOGIN_ATTEMPTS) {
      process.env.MAX_LOGIN_ATTEMPTS = '5';
    }

    if (!process.env.LOCKOUT_DURATION) {
      process.env.LOCKOUT_DURATION = '900'; // 15 minutes
    }
  }

  /**
   * Get security configuration
   */
  static getConfig(): SecurityConfiguration {
    if (!this.initialized) {
      this.initialize();
    }

    return {
      encryption: {
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16
      },
      jwt: {
        accessTokenExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
        refreshTokenExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',
        issuer: 'ai-ticket-management',
        audience: 'ai-ticket-management-users'
      },
      password: {
        minLength: 8,
        maxLength: 128,
        requireUppercase: true,
        requireLowercase: true,
        requireNumbers: true,
        requireSpecialChars: true,
        bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10)
      },
      session: {
        timeout: parseInt(process.env.SESSION_TIMEOUT || '3600', 10),
        maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
        lockoutDuration: parseInt(process.env.LOCKOUT_DURATION || '900', 10)
      },
      rateLimit: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        maxRequests: 1000,
        authMaxAttempts: 5,
        sensitiveOperationsMax: 10
      },
      cors: {
        allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [
          'http://localhost:3000',
          'http://localhost:3001'
        ],
        credentials: true
      },
      https: {
        enforceInProduction: true,
        hstsMaxAge: 31536000, // 1 year
        includeSubdomains: true,
        preload: true
      }
    };
  }

  /**
   * Validate runtime security requirements
   */
  static validateRuntimeSecurity(): SecurityValidationResult {
    const issues: string[] = [];
    const warnings: string[] = [];

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0], 10);
    if (majorVersion < 18) {
      issues.push(`Node.js version ${nodeVersion} is outdated. Please use Node.js 18 or higher.`);
    }

    // Check environment
    if (process.env.NODE_ENV === 'production') {
      // Production-specific checks
      if (!process.env.HTTPS_ENABLED || process.env.HTTPS_ENABLED !== 'true') {
        issues.push('HTTPS must be enabled in production');
      }

      if (process.env.JWT_ACCESS_SECRET === 'your-access-token-secret') {
        issues.push('Default JWT secrets detected in production');
      }

      if (!process.env.ALLOWED_ORIGINS) {
        warnings.push('ALLOWED_ORIGINS not configured, using defaults');
      }
    }

    // Check for debug modes
    if (process.env.DEBUG === 'true' && process.env.NODE_ENV === 'production') {
      warnings.push('Debug mode is enabled in production');
    }

    // Check memory limits
    const memoryUsage = process.memoryUsage();
    if (memoryUsage.heapUsed > 500 * 1024 * 1024) { // 500MB
      warnings.push('High memory usage detected');
    }

    return {
      isValid: issues.length === 0,
      issues,
      warnings
    };
  }

  /**
   * Generate secure configuration for new deployment
   */
  static generateSecureConfig(): SecureConfigTemplate {
    const crypto = require('crypto');

    return {
      JWT_ACCESS_SECRET: crypto.randomBytes(64).toString('hex'),
      JWT_REFRESH_SECRET: crypto.randomBytes(64).toString('hex'),
      ENCRYPTION_KEY: crypto.randomBytes(32).toString('hex'),
      ENCRYPTION_SALT: crypto.randomBytes(32).toString('hex'),
      API_KEY: crypto.randomBytes(32).toString('hex'),
      SESSION_SECRET: crypto.randomBytes(64).toString('hex'),
      WEBHOOK_SECRET: crypto.randomBytes(32).toString('hex')
    };
  }

  /**
   * Check if security configuration is properly initialized
   */
  static isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Reset security configuration (for testing)
   */
  static reset(): void {
    this.initialized = false;
    SecretManager.clearAllSecrets();
  }
}

/**
 * Security configuration interface
 */
export interface SecurityConfiguration {
  encryption: {
    algorithm: string;
    keyLength: number;
    ivLength: number;
  };
  jwt: {
    accessTokenExpiry: string;
    refreshTokenExpiry: string;
    issuer: string;
    audience: string;
  };
  password: {
    minLength: number;
    maxLength: number;
    requireUppercase: boolean;
    requireLowercase: boolean;
    requireNumbers: boolean;
    requireSpecialChars: boolean;
    bcryptRounds: number;
  };
  session: {
    timeout: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };
  rateLimit: {
    windowMs: number;
    maxRequests: number;
    authMaxAttempts: number;
    sensitiveOperationsMax: number;
  };
  cors: {
    allowedOrigins: string[];
    credentials: boolean;
  };
  https: {
    enforceInProduction: boolean;
    hstsMaxAge: number;
    includeSubdomains: boolean;
    preload: boolean;
  };
}

/**
 * Security validation result interface
 */
export interface SecurityValidationResult {
  isValid: boolean;
  issues: string[];
  warnings: string[];
}

/**
 * Secure configuration template for new deployments
 */
export interface SecureConfigTemplate {
  JWT_ACCESS_SECRET: string;
  JWT_REFRESH_SECRET: string;
  ENCRYPTION_KEY: string;
  ENCRYPTION_SALT: string;
  API_KEY: string;
  SESSION_SECRET: string;
  WEBHOOK_SECRET: string;
}

/**
 * Initialize security configuration on module load
 */
if (process.env.NODE_ENV !== 'test') {
  try {
    SecurityConfig.initialize();
  } catch (error) {
    logger.error('Failed to initialize security configuration on startup', { 
      error: (error as Error).message 
    });
    process.exit(1);
  }
}