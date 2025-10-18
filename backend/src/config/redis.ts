import { createClient, RedisClientType } from 'redis';
import { logger } from '../utils/logger';

export interface RedisConfig {
  host: string;
  port: number;
  password?: string;
  db: number;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  connectTimeout: number;
  lazyConnect: boolean;
}

export class RedisClient {
  private client: RedisClientType;
  private isConnected: boolean = false;

  constructor(config: RedisConfig) {
    this.client = createClient({
      socket: {
        host: config.host,
        port: config.port,
        connectTimeout: config.connectTimeout,
        reconnectStrategy: (retries) => {
          if (retries > config.maxRetriesPerRequest) {
            return new Error('Max retries exceeded');
          }
          return Math.min(retries * config.retryDelayOnFailover, 3000);
        }
      },
      password: config.password,
      database: config.db
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on('connect', () => {
      logger.info('Redis client connected');
      this.isConnected = true;
    });

    this.client.on('error', (error) => {
      logger.error('Redis client error:', error);
      this.isConnected = false;
    });

    this.client.on('end', () => {
      logger.info('Redis client disconnected');
      this.isConnected = false;
    });

    this.client.on('reconnecting', () => {
      logger.info('Redis client reconnecting...');
    });
  }

  async connect(): Promise<void> {
    try {
      await this.client.connect();
      logger.info('Redis connection established');
    } catch (error) {
      logger.error('Failed to connect to Redis:', error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    try {
      await this.client.disconnect();
      logger.info('Redis connection closed');
    } catch (error) {
      logger.error('Error disconnecting from Redis:', error);
      throw error;
    }
  }

  getClient(): RedisClientType {
    return this.client;
  }

  isClientConnected(): boolean {
    return this.isConnected && this.client.isReady;
  }

  async ping(): Promise<string> {
    return await this.client.ping();
  }
}

// Redis configuration from environment variables
export const redisConfig: RedisConfig = {
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0'),
  retryDelayOnFailover: parseInt(process.env.REDIS_RETRY_DELAY || '100'),
  maxRetriesPerRequest: parseInt(process.env.REDIS_MAX_RETRIES || '3'),
  connectTimeout: parseInt(process.env.REDIS_CONNECT_TIMEOUT || '10000'),
  lazyConnect: process.env.REDIS_LAZY_CONNECT === 'true'
};

// Singleton Redis client instance
let redisClientInstance: RedisClient | null = null;

export const getRedisClient = (): RedisClient => {
  if (!redisClientInstance) {
    redisClientInstance = new RedisClient(redisConfig);
  }
  return redisClientInstance;
};

export const initializeRedis = async (): Promise<void> => {
  const client = getRedisClient();
  await client.connect();
};

export const closeRedis = async (): Promise<void> => {
  if (redisClientInstance) {
    await redisClientInstance.disconnect();
    redisClientInstance = null;
  }
};