import { SuperOpsConfig } from '../types/superops';
import { logger } from '../utils/logger';

export class SuperOpsConfigService {
  private static instance: SuperOpsConfigService;
  private config: SuperOpsConfig;

  private constructor() {
    this.config = this.loadConfig();
  }

  public static getInstance(): SuperOpsConfigService {
    if (!SuperOpsConfigService.instance) {
      SuperOpsConfigService.instance = new SuperOpsConfigService();
    }
    return SuperOpsConfigService.instance;
  }

  private loadConfig(): SuperOpsConfig {
    const requiredEnvVars = [
      'SUPEROPS_BASE_URL',
      'SUPEROPS_CLIENT_ID',
      'SUPEROPS_CLIENT_SECRET',
      'SUPEROPS_API_KEY'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    if (missingVars.length > 0) {
      throw new Error(`Missing required SuperOps environment variables: ${missingVars.join(', ')}`);
    }

    const config: SuperOpsConfig = {
      baseUrl: process.env.SUPEROPS_BASE_URL!,
      apiKey: process.env.SUPEROPS_API_KEY!,
      clientId: process.env.SUPEROPS_CLIENT_ID!,
      clientSecret: process.env.SUPEROPS_CLIENT_SECRET!,
      timeout: parseInt(process.env.SUPEROPS_TIMEOUT || '30000'),
      retryAttempts: parseInt(process.env.SUPEROPS_RETRY_ATTEMPTS || '3'),
      retryDelay: parseInt(process.env.SUPEROPS_RETRY_DELAY || '1000')
    };

    logger.info('SuperOps configuration loaded', {
      baseUrl: config.baseUrl,
      timeout: config.timeout,
      retryAttempts: config.retryAttempts,
      retryDelay: config.retryDelay
    });

    return config;
  }

  public getConfig(): SuperOpsConfig {
    return { ...this.config };
  }

  public updateConfig(updates: Partial<SuperOpsConfig>): void {
    this.config = { ...this.config, ...updates };
    logger.info('SuperOps configuration updated', updates);
  }

  public validateConfig(): boolean {
    try {
      const config = this.config;
      
      if (!config.baseUrl || !config.baseUrl.startsWith('http')) {
        throw new Error('Invalid base URL');
      }

      if (!config.clientId || !config.clientSecret) {
        throw new Error('Missing authentication credentials');
      }

      if (config.timeout < 1000 || config.timeout > 300000) {
        throw new Error('Timeout must be between 1000ms and 300000ms');
      }

      if (config.retryAttempts < 0 || config.retryAttempts > 10) {
        throw new Error('Retry attempts must be between 0 and 10');
      }

      if (config.retryDelay < 100 || config.retryDelay > 60000) {
        throw new Error('Retry delay must be between 100ms and 60000ms');
      }

      return true;
    } catch (error) {
      logger.error('SuperOps configuration validation failed:', error);
      return false;
    }
  }
}