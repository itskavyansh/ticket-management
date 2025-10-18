import { getCacheService, CacheService, CacheTTL } from './CacheService';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export interface SessionData {
  userId: string;
  email: string;
  role: string;
  permissions: string[];
  loginTime: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

export interface SessionOptions {
  ttl?: number;
  extendOnActivity?: boolean;
  maxSessions?: number;
}

export class SessionService {
  private cache: CacheService;
  private readonly SESSION_PREFIX = 'session';
  private readonly USER_SESSIONS_PREFIX = 'user_sessions';
  private readonly defaultTTL = CacheTTL.LONG; // 1 hour default

  constructor() {
    this.cache = getCacheService();
  }

  /**
   * Create a new session
   */
  async createSession(
    sessionData: Omit<SessionData, 'loginTime' | 'lastActivity'>,
    options: SessionOptions = {}
  ): Promise<string> {
    try {
      const sessionId = uuidv4();
      const ttl = options.ttl || this.defaultTTL;
      
      const fullSessionData: SessionData = {
        ...sessionData,
        loginTime: new Date(),
        lastActivity: new Date()
      };

      // Store session data
      await this.cache.set(
        sessionId,
        fullSessionData,
        { prefix: this.SESSION_PREFIX, ttl }
      );

      // Track user sessions for multi-session management
      await this.addUserSession(sessionData.userId, sessionId, options);

      logger.info('Session created', { 
        sessionId, 
        userId: sessionData.userId,
        ttl 
      });

      return sessionId;
    } catch (error) {
      logger.error('Failed to create session:', error);
      throw new Error('Session creation failed');
    }
  }

  /**
   * Get session data
   */
  async getSession(sessionId: string): Promise<SessionData | null> {
    try {
      const sessionData = await this.cache.get<SessionData>(
        sessionId,
        { prefix: this.SESSION_PREFIX }
      );

      if (!sessionData) {
        return null;
      }

      // Convert date strings back to Date objects
      sessionData.loginTime = new Date(sessionData.loginTime);
      sessionData.lastActivity = new Date(sessionData.lastActivity);

      return sessionData;
    } catch (error) {
      logger.error('Failed to get session:', { sessionId, error });
      return null;
    }
  }

  /**
   * Update session activity
   */
  async updateActivity(
    sessionId: string,
    options: SessionOptions = {}
  ): Promise<boolean> {
    try {
      const sessionData = await this.getSession(sessionId);
      
      if (!sessionData) {
        return false;
      }

      sessionData.lastActivity = new Date();

      const ttl = options.ttl || this.defaultTTL;
      
      await this.cache.set(
        sessionId,
        sessionData,
        { prefix: this.SESSION_PREFIX, ttl }
      );

      // Extend session expiration if configured
      if (options.extendOnActivity !== false) {
        await this.cache.expire(
          sessionId,
          ttl,
          { prefix: this.SESSION_PREFIX }
        );
      }

      return true;
    } catch (error) {
      logger.error('Failed to update session activity:', { sessionId, error });
      return false;
    }
  }

  /**
   * Destroy a session
   */
  async destroySession(sessionId: string): Promise<boolean> {
    try {
      const sessionData = await this.getSession(sessionId);
      
      if (sessionData) {
        // Remove from user sessions tracking
        await this.removeUserSession(sessionData.userId, sessionId);
      }

      const result = await this.cache.delete(
        sessionId,
        { prefix: this.SESSION_PREFIX }
      );

      logger.info('Session destroyed', { sessionId });
      return result;
    } catch (error) {
      logger.error('Failed to destroy session:', { sessionId, error });
      return false;
    }
  }

  /**
   * Destroy all sessions for a user
   */
  async destroyUserSessions(userId: string): Promise<number> {
    try {
      const sessionIds = await this.getUserSessions(userId);
      
      if (sessionIds.length === 0) {
        return 0;
      }

      // Delete all session data
      const sessionKeys = sessionIds.map(id => id);
      await this.cache.mdel(sessionKeys, { prefix: this.SESSION_PREFIX });

      // Clear user sessions tracking
      await this.cache.delete(userId, { prefix: this.USER_SESSIONS_PREFIX });

      logger.info('All user sessions destroyed', { userId, count: sessionIds.length });
      return sessionIds.length;
    } catch (error) {
      logger.error('Failed to destroy user sessions:', { userId, error });
      return 0;
    }
  }

  /**
   * Get all active sessions for a user
   */
  async getUserSessions(userId: string): Promise<string[]> {
    try {
      return await this.cache.smembers(
        userId,
        { prefix: this.USER_SESSIONS_PREFIX }
      );
    } catch (error) {
      logger.error('Failed to get user sessions:', { userId, error });
      return [];
    }
  }

  /**
   * Check if session exists and is valid
   */
  async isValidSession(sessionId: string): Promise<boolean> {
    try {
      return await this.cache.exists(
        sessionId,
        { prefix: this.SESSION_PREFIX }
      );
    } catch (error) {
      logger.error('Failed to validate session:', { sessionId, error });
      return false;
    }
  }

  /**
   * Get session count for a user
   */
  async getUserSessionCount(userId: string): Promise<number> {
    try {
      const sessions = await this.getUserSessions(userId);
      return sessions.length;
    } catch (error) {
      logger.error('Failed to get user session count:', { userId, error });
      return 0;
    }
  }

  /**
   * Clean up expired sessions for a user
   */
  async cleanupExpiredSessions(userId: string): Promise<number> {
    try {
      const sessionIds = await this.getUserSessions(userId);
      let cleanedCount = 0;

      for (const sessionId of sessionIds) {
        const exists = await this.cache.exists(
          sessionId,
          { prefix: this.SESSION_PREFIX }
        );
        
        if (!exists) {
          await this.removeUserSession(userId, sessionId);
          cleanedCount++;
        }
      }

      if (cleanedCount > 0) {
        logger.info('Cleaned up expired sessions', { userId, cleanedCount });
      }

      return cleanedCount;
    } catch (error) {
      logger.error('Failed to cleanup expired sessions:', { userId, error });
      return 0;
    }
  }

  /**
   * Add session to user's session tracking
   */
  private async addUserSession(
    userId: string,
    sessionId: string,
    options: SessionOptions = {}
  ): Promise<void> {
    try {
      // Enforce max sessions limit
      if (options.maxSessions) {
        const currentSessions = await this.getUserSessions(userId);
        
        if (currentSessions.length >= options.maxSessions) {
          // Remove oldest sessions
          const sessionsToRemove = currentSessions.slice(0, 
            currentSessions.length - options.maxSessions + 1
          );
          
          for (const oldSessionId of sessionsToRemove) {
            await this.destroySession(oldSessionId);
          }
        }
      }

      await this.cache.sadd(
        userId,
        [sessionId],
        { 
          prefix: this.USER_SESSIONS_PREFIX,
          ttl: options.ttl || this.defaultTTL
        }
      );
    } catch (error) {
      logger.error('Failed to add user session:', { userId, sessionId, error });
    }
  }

  /**
   * Remove session from user's session tracking
   */
  private async removeUserSession(userId: string, sessionId: string): Promise<void> {
    try {
      await this.cache.srem(
        userId,
        [sessionId],
        { prefix: this.USER_SESSIONS_PREFIX }
      );
    } catch (error) {
      logger.error('Failed to remove user session:', { userId, sessionId, error });
    }
  }

  /**
   * Get session statistics
   */
  async getSessionStats(): Promise<{
    totalActiveSessions: number;
    uniqueUsers: number;
    averageSessionsPerUser: number;
  }> {
    try {
      // This is a simplified implementation
      // In production, you might want to maintain these stats separately
      const userSessionKeys = await this.cache.getClient().keys(
        `*${this.USER_SESSIONS_PREFIX}*`
      );
      
      let totalSessions = 0;
      const uniqueUsers = userSessionKeys.length;

      for (const key of userSessionKeys) {
        const sessions = await this.cache.getClient().sCard(key);
        totalSessions += sessions;
      }

      return {
        totalActiveSessions: totalSessions,
        uniqueUsers,
        averageSessionsPerUser: uniqueUsers > 0 ? totalSessions / uniqueUsers : 0
      };
    } catch (error) {
      logger.error('Failed to get session stats:', error);
      return {
        totalActiveSessions: 0,
        uniqueUsers: 0,
        averageSessionsPerUser: 0
      };
    }
  }
}

// Singleton session service instance
let sessionServiceInstance: SessionService | null = null;

export const getSessionService = (): SessionService => {
  if (!sessionServiceInstance) {
    sessionServiceInstance = new SessionService();
  }
  return sessionServiceInstance;
};