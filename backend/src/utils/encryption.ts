import crypto from 'crypto';
import CryptoJS from 'crypto-js';

/**
 * AES-256 encryption utilities for sensitive data at rest
 */
export class EncryptionUtils {
  private static readonly ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_LENGTH = 32; // 256 bits
  private static readonly IV_LENGTH = 16; // 128 bits
  private static readonly TAG_LENGTH = 16; // 128 bits
  private static readonly SALT_LENGTH = 32; // 256 bits

  /**
   * Get encryption key from environment or generate one
   */
  private static getEncryptionKey(): Buffer {
    const keyString = process.env.ENCRYPTION_KEY;
    
    if (!keyString) {
      throw new Error('ENCRYPTION_KEY environment variable is required');
    }

    // Derive key from the provided string using PBKDF2
    const salt = Buffer.from(process.env.ENCRYPTION_SALT || 'ai-ticket-management-salt', 'utf8');
    return crypto.pbkdf2Sync(keyString, salt, 100000, this.KEY_LENGTH, 'sha256');
  }

  /**
   * Encrypt sensitive data using AES-256-GCM
   * @param plaintext - Data to encrypt
   * @returns Encrypted data with IV and auth tag
   */
  static encrypt(plaintext: string): string {
    try {
      const key = this.getEncryptionKey();
      const iv = crypto.randomBytes(this.IV_LENGTH);
      
      const cipher = crypto.createCipher(this.ALGORITHM, key);
      cipher.setAAD(Buffer.from('ai-ticket-management', 'utf8'));
      
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      
      const authTag = cipher.getAuthTag();
      
      // Combine IV, auth tag, and encrypted data
      const result = {
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        encrypted: encrypted
      };
      
      return Buffer.from(JSON.stringify(result)).toString('base64');
    } catch (error) {
      throw new Error(`Encryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Decrypt data encrypted with AES-256-GCM
   * @param encryptedData - Base64 encoded encrypted data
   * @returns Decrypted plaintext
   */
  static decrypt(encryptedData: string): string {
    try {
      const key = this.getEncryptionKey();
      const data = JSON.parse(Buffer.from(encryptedData, 'base64').toString('utf8'));
      
      const iv = Buffer.from(data.iv, 'hex');
      const authTag = Buffer.from(data.authTag, 'hex');
      const encrypted = data.encrypted;
      
      const decipher = crypto.createDecipher(this.ALGORITHM, key);
      decipher.setAAD(Buffer.from('ai-ticket-management', 'utf8'));
      decipher.setAuthTag(authTag);
      
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      
      return decrypted;
    } catch (error) {
      throw new Error(`Decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Hash sensitive data using SHA-256 (one-way)
   * @param data - Data to hash
   * @param salt - Optional salt (will generate if not provided)
   * @returns Hashed data with salt
   */
  static hash(data: string, salt?: string): { hash: string; salt: string } {
    const saltBuffer = salt ? Buffer.from(salt, 'hex') : crypto.randomBytes(this.SALT_LENGTH);
    const hash = crypto.pbkdf2Sync(data, saltBuffer, 100000, 64, 'sha256');
    
    return {
      hash: hash.toString('hex'),
      salt: saltBuffer.toString('hex')
    };
  }

  /**
   * Verify hashed data
   * @param data - Original data
   * @param hash - Stored hash
   * @param salt - Salt used for hashing
   * @returns True if data matches hash
   */
  static verifyHash(data: string, hash: string, salt: string): boolean {
    try {
      const computed = this.hash(data, salt);
      return computed.hash === hash;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate a secure random key for encryption
   * @param length - Key length in bytes (default: 32 for AES-256)
   * @returns Hex-encoded random key
   */
  static generateKey(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }

  /**
   * Encrypt database field values
   * @param value - Value to encrypt
   * @returns Encrypted value or null if input is null/undefined
   */
  static encryptField(value: string | null | undefined): string | null {
    if (value === null || value === undefined || value === '') {
      return null;
    }
    return this.encrypt(value);
  }

  /**
   * Decrypt database field values
   * @param encryptedValue - Encrypted value from database
   * @returns Decrypted value or null if input is null/undefined
   */
  static decryptField(encryptedValue: string | null | undefined): string | null {
    if (encryptedValue === null || encryptedValue === undefined || encryptedValue === '') {
      return null;
    }
    try {
      return this.decrypt(encryptedValue);
    } catch (error) {
      // Log error but don't throw to prevent application crashes
      console.error('Failed to decrypt field:', error);
      return null;
    }
  }

  /**
   * Encrypt object properties that contain sensitive data
   * @param obj - Object with sensitive properties
   * @param sensitiveFields - Array of field names to encrypt
   * @returns Object with encrypted sensitive fields
   */
  static encryptSensitiveFields<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: (keyof T)[]
  ): T {
    const result = { ...obj };
    
    for (const field of sensitiveFields) {
      if (result[field] !== null && result[field] !== undefined) {
        result[field] = this.encryptField(String(result[field]));
      }
    }
    
    return result;
  }

  /**
   * Decrypt object properties that contain encrypted data
   * @param obj - Object with encrypted properties
   * @param sensitiveFields - Array of field names to decrypt
   * @returns Object with decrypted sensitive fields
   */
  static decryptSensitiveFields<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: (keyof T)[]
  ): T {
    const result = { ...obj };
    
    for (const field of sensitiveFields) {
      if (result[field] !== null && result[field] !== undefined) {
        result[field] = this.decryptField(String(result[field]));
      }
    }
    
    return result;
  }
}

/**
 * Secure configuration management for secrets
 */
export class SecretManager {
  private static secrets = new Map<string, string>();

  /**
   * Store a secret securely in memory
   * @param key - Secret key
   * @param value - Secret value
   */
  static setSecret(key: string, value: string): void {
    this.secrets.set(key, value);
  }

  /**
   * Retrieve a secret from secure storage
   * @param key - Secret key
   * @returns Secret value or undefined if not found
   */
  static getSecret(key: string): string | undefined {
    return this.secrets.get(key);
  }

  /**
   * Remove a secret from memory
   * @param key - Secret key
   */
  static removeSecret(key: string): void {
    this.secrets.delete(key);
  }

  /**
   * Clear all secrets from memory
   */
  static clearAllSecrets(): void {
    this.secrets.clear();
  }

  /**
   * Load secrets from environment variables
   */
  static loadSecretsFromEnv(): void {
    const secretKeys = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY',
      'DATABASE_PASSWORD',
      'REDIS_PASSWORD',
      'OPENAI_API_KEY',
      'SUPEROPS_API_KEY',
      'SLACK_BOT_TOKEN',
      'TEAMS_WEBHOOK_SECRET'
    ];

    for (const key of secretKeys) {
      const value = process.env[key];
      if (value) {
        this.setSecret(key, value);
      }
    }
  }

  /**
   * Get database connection string with encrypted password
   * @returns Secure database connection configuration
   */
  static getDatabaseConfig(): {
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  } {
    return {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432', 10),
      database: process.env.DB_NAME || 'ai_ticket_management',
      username: process.env.DB_USER || 'postgres',
      password: this.getSecret('DATABASE_PASSWORD') || process.env.DB_PASSWORD || ''
    };
  }

  /**
   * Validate that all required secrets are present
   * @returns Array of missing secret keys
   */
  static validateRequiredSecrets(): string[] {
    const requiredSecrets = [
      'JWT_ACCESS_SECRET',
      'JWT_REFRESH_SECRET',
      'ENCRYPTION_KEY'
    ];

    const missing: string[] = [];
    
    for (const key of requiredSecrets) {
      if (!this.getSecret(key) && !process.env[key]) {
        missing.push(key);
      }
    }

    return missing;
  }
}

/**
 * Data masking utilities for logging and display
 */
export class DataMaskingUtils {
  /**
   * Mask sensitive data for logging
   * @param data - Data to mask
   * @param visibleChars - Number of characters to show (default: 4)
   * @returns Masked string
   */
  static maskSensitiveData(data: string, visibleChars: number = 4): string {
    if (!data || data.length <= visibleChars) {
      return '*'.repeat(data?.length || 0);
    }

    const visible = data.substring(0, visibleChars);
    const masked = '*'.repeat(data.length - visibleChars);
    return visible + masked;
  }

  /**
   * Mask email addresses
   * @param email - Email to mask
   * @returns Masked email
   */
  static maskEmail(email: string): string {
    if (!email || !email.includes('@')) {
      return email;
    }

    const [username, domain] = email.split('@');
    const maskedUsername = username.length > 2 
      ? username.substring(0, 2) + '*'.repeat(username.length - 2)
      : '*'.repeat(username.length);
    
    return `${maskedUsername}@${domain}`;
  }

  /**
   * Mask phone numbers
   * @param phone - Phone number to mask
   * @returns Masked phone number
   */
  static maskPhone(phone: string): string {
    if (!phone) return phone;
    
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 4) {
      return '*'.repeat(phone.length);
    }

    const lastFour = digits.slice(-4);
    const masked = '*'.repeat(digits.length - 4);
    return phone.replace(digits, masked + lastFour);
  }

  /**
   * Mask credit card numbers
   * @param cardNumber - Card number to mask
   * @returns Masked card number
   */
  static maskCardNumber(cardNumber: string): string {
    if (!cardNumber) return cardNumber;
    
    const digits = cardNumber.replace(/\D/g, '');
    if (digits.length < 4) {
      return '*'.repeat(cardNumber.length);
    }

    const lastFour = digits.slice(-4);
    const masked = '*'.repeat(digits.length - 4);
    return cardNumber.replace(digits, masked + lastFour);
  }

  /**
   * Remove sensitive fields from objects for logging
   * @param obj - Object to sanitize
   * @param sensitiveFields - Fields to remove or mask
   * @returns Sanitized object
   */
  static sanitizeForLogging<T extends Record<string, any>>(
    obj: T,
    sensitiveFields: string[] = ['password', 'token', 'secret', 'key', 'apiKey']
  ): Partial<T> {
    const sanitized = { ...obj };
    
    for (const field of sensitiveFields) {
      if (field in sanitized) {
        if (typeof sanitized[field] === 'string') {
          sanitized[field] = this.maskSensitiveData(sanitized[field]);
        } else {
          delete sanitized[field];
        }
      }
    }
    
    return sanitized;
  }
}