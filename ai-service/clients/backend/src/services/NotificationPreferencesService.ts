import { v4 as uuidv4 } from 'uuid';
import {
  NotificationPreferences,
  NotificationTemplate,
  NotificationType,
  NotificationPriority,
  NotificationChannel
} from '../types/notification';
import { logger } from '../utils/logger';

export class NotificationPreferencesService {
  private userPreferences: Map<string, NotificationPreferences> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private defaultChannels: Map<NotificationType, string[]> = new Map();

  constructor() {
    this.initializeDefaultPreferences();
  }

  /**
   * Get user notification preferences
   */
  async getUserPreferences(userId: string): Promise<NotificationPreferences | null> {
    try {
      const preferences = this.userPreferences.get(userId);
      if (!preferences) {
        // Return default preferences if none exist
        return this.createDefaultPreferences(userId);
      }
      return preferences;
    } catch (error) {
      logger.error(`Error getting user preferences for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(
    userId: string, 
    preferences: Partial<NotificationPreferences>
  ): Promise<NotificationPreferences> {
    try {
      const existingPreferences = await this.getUserPreferences(userId);
      const updatedPreferences: NotificationPreferences = {
        ...existingPreferences,
        ...preferences,
        userId // Ensure userId is always set correctly
      };

      this.userPreferences.set(userId, updatedPreferences);
      
      logger.info(`Updated notification preferences for user ${userId}`);
      return updatedPreferences;
    } catch (error) {
      logger.error(`Error updating user preferences for ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Get channels for a specific notification type and user
   */
  async getChannelsForNotification(
    userId: string, 
    notificationType: NotificationType
  ): Promise<string[]> {
    try {
      const preferences = await this.getUserPreferences(userId);
      
      if (!preferences || !preferences.enabled) {
        return [];
      }

      // Check if user is in quiet hours
      if (this.isInQuietHours(preferences)) {
        // Only send critical notifications during quiet hours
        const template = this.getTemplateByType(notificationType);
        if (!template || template.priority !== NotificationPriority.CRITICAL) {
          return [];
        }
      }

      // Get user-specific channels for this notification type
      const userChannels = preferences.channels[notificationType];
      if (userChannels && userChannels.length > 0) {
        return userChannels;
      }

      // Fall back to default channels for this notification type
      return this.defaultChannels.get(notificationType) || [];
    } catch (error) {
      logger.error(`Error getting channels for notification ${notificationType} and user ${userId}:`, error);
      return [];
    }
  }

  /**
   * Create notification template
   */
  async createTemplate(template: NotificationTemplate): Promise<NotificationTemplate> {
    try {
      // Validate template
      this.validateTemplate(template);
      
      this.templates.set(template.id, template);
      
      logger.info(`Created notification template: ${template.id}`);
      return template;
    } catch (error) {
      logger.error(`Error creating template ${template.id}:`, error);
      throw error;
    }
  }

  /**
   * Update notification template
   */
  async updateTemplate(
    templateId: string, 
    updates: Partial<NotificationTemplate>
  ): Promise<NotificationTemplate> {
    try {
      const existingTemplate = this.templates.get(templateId);
      if (!existingTemplate) {
        throw new Error(`Template not found: ${templateId}`);
      }

      const updatedTemplate: NotificationTemplate = {
        ...existingTemplate,
        ...updates,
        id: templateId // Ensure ID doesn't change
      };

      // Validate updated template
      this.validateTemplate(updatedTemplate);
      
      this.templates.set(templateId, updatedTemplate);
      
      logger.info(`Updated notification template: ${templateId}`);
      return updatedTemplate;
    } catch (error) {
      logger.error(`Error updating template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Delete notification template
   */
  async deleteTemplate(templateId: string): Promise<boolean> {
    try {
      const deleted = this.templates.delete(templateId);
      if (deleted) {
        logger.info(`Deleted notification template: ${templateId}`);
      }
      return deleted;
    } catch (error) {
      logger.error(`Error deleting template ${templateId}:`, error);
      throw error;
    }
  }

  /**
   * Get template by ID
   */
  getTemplate(templateId: string): NotificationTemplate | null {
    return this.templates.get(templateId) || null;
  }

  /**
   * Get template by notification type
   */
  getTemplateByType(notificationType: NotificationType): NotificationTemplate | null {
    for (const template of this.templates.values()) {
      if (template.type === notificationType) {
        return template;
      }
    }
    return null;
  }

  /**
   * Get all templates
   */
  getAllTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }

  /**
   * Get templates by priority
   */
  getTemplatesByPriority(priority: NotificationPriority): NotificationTemplate[] {
    return Array.from(this.templates.values()).filter(
      template => template.priority === priority
    );
  }

  /**
   * Set default channels for a notification type
   */
  setDefaultChannels(notificationType: NotificationType, channelIds: string[]): void {
    this.defaultChannels.set(notificationType, channelIds);
    logger.info(`Set default channels for ${notificationType}: ${channelIds.join(', ')}`);
  }

  /**
   * Get default channels for a notification type
   */
  getDefaultChannels(notificationType: NotificationType): string[] {
    return this.defaultChannels.get(notificationType) || [];
  }

  /**
   * Check if user is currently in quiet hours
   */
  private isInQuietHours(preferences: NotificationPreferences): boolean {
    if (!preferences.quietHours) {
      return false;
    }

    try {
      const now = new Date();
      const userTimezone = preferences.quietHours.timezone;
      
      // Convert current time to user's timezone
      const userTime = new Date(now.toLocaleString("en-US", { timeZone: userTimezone }));
      const currentHour = userTime.getHours();
      const currentMinute = userTime.getMinutes();
      const currentTimeInMinutes = currentHour * 60 + currentMinute;

      // Parse quiet hours
      const [startHour, startMinute] = preferences.quietHours.start.split(':').map(Number);
      const [endHour, endMinute] = preferences.quietHours.end.split(':').map(Number);
      const startTimeInMinutes = startHour * 60 + startMinute;
      const endTimeInMinutes = endHour * 60 + endMinute;

      // Handle overnight quiet hours (e.g., 22:00 to 06:00)
      if (startTimeInMinutes > endTimeInMinutes) {
        return currentTimeInMinutes >= startTimeInMinutes || currentTimeInMinutes <= endTimeInMinutes;
      } else {
        return currentTimeInMinutes >= startTimeInMinutes && currentTimeInMinutes <= endTimeInMinutes;
      }
    } catch (error) {
      logger.error('Error checking quiet hours:', error);
      return false;
    }
  }

  /**
   * Create default preferences for a user
   */
  private createDefaultPreferences(userId: string): NotificationPreferences {
    const defaultPreferences: NotificationPreferences = {
      userId,
      channels: {
        [NotificationType.SLA_BREACH_WARNING]: this.getDefaultChannels(NotificationType.SLA_BREACH_WARNING),
        [NotificationType.SLA_BREACH_CRITICAL]: this.getDefaultChannels(NotificationType.SLA_BREACH_CRITICAL),
        [NotificationType.TICKET_ASSIGNED]: this.getDefaultChannels(NotificationType.TICKET_ASSIGNED),
        [NotificationType.TICKET_ESCALATED]: this.getDefaultChannels(NotificationType.TICKET_ESCALATED),
        [NotificationType.TICKET_RESOLVED]: this.getDefaultChannels(NotificationType.TICKET_RESOLVED),
        [NotificationType.WORKLOAD_ALERT]: this.getDefaultChannels(NotificationType.WORKLOAD_ALERT),
        [NotificationType.SYSTEM_ALERT]: this.getDefaultChannels(NotificationType.SYSTEM_ALERT)
      },
      enabled: true
    };

    this.userPreferences.set(userId, defaultPreferences);
    return defaultPreferences;
  }

  /**
   * Validate notification template
   */
  private validateTemplate(template: NotificationTemplate): void {
    if (!template.id || !template.name || !template.type) {
      throw new Error('Template must have id, name, and type');
    }

    if (!template.subject || !template.message) {
      throw new Error('Template must have subject and message');
    }

    if (!Object.values(NotificationType).includes(template.type)) {
      throw new Error(`Invalid notification type: ${template.type}`);
    }

    if (!Object.values(NotificationPriority).includes(template.priority)) {
      throw new Error(`Invalid notification priority: ${template.priority}`);
    }

    // Validate template variables
    const subjectVariables = this.extractVariables(template.subject);
    const messageVariables = this.extractVariables(template.message);
    const allVariables = [...new Set([...subjectVariables, ...messageVariables])];
    
    // Check if declared variables match used variables
    const declaredVariables = new Set(template.variables);
    const usedVariables = new Set(allVariables);
    
    for (const variable of usedVariables) {
      if (!declaredVariables.has(variable)) {
        logger.warn(`Template ${template.id} uses undeclared variable: ${variable}`);
      }
    }
  }

  /**
   * Extract variables from template string
   */
  private extractVariables(template: string): string[] {
    const matches = template.match(/\{\{(\w+)\}\}/g);
    if (!matches) return [];
    
    return matches.map(match => match.replace(/\{\{|\}\}/g, ''));
  }

  /**
   * Initialize default preferences and templates
   */
  private initializeDefaultPreferences(): void {
    // Set default channels for each notification type
    // These would typically be loaded from configuration or database
    this.setDefaultChannels(NotificationType.SLA_BREACH_WARNING, ['default-slack', 'default-email']);
    this.setDefaultChannels(NotificationType.SLA_BREACH_CRITICAL, ['default-slack', 'default-teams', 'default-email']);
    this.setDefaultChannels(NotificationType.TICKET_ASSIGNED, ['default-slack']);
    this.setDefaultChannels(NotificationType.TICKET_ESCALATED, ['default-slack', 'default-email']);
    this.setDefaultChannels(NotificationType.TICKET_RESOLVED, ['default-slack']);
    this.setDefaultChannels(NotificationType.WORKLOAD_ALERT, ['default-slack']);
    this.setDefaultChannels(NotificationType.SYSTEM_ALERT, ['default-slack', 'default-email']);

    logger.info('Initialized default notification preferences');
  }

  /**
   * Bulk update user preferences
   */
  async bulkUpdatePreferences(
    updates: Array<{ userId: string; preferences: Partial<NotificationPreferences> }>
  ): Promise<NotificationPreferences[]> {
    const results: NotificationPreferences[] = [];
    
    for (const update of updates) {
      try {
        const updatedPreferences = await this.updateUserPreferences(
          update.userId, 
          update.preferences
        );
        results.push(updatedPreferences);
      } catch (error) {
        logger.error(`Failed to update preferences for user ${update.userId}:`, error);
        // Continue with other updates
      }
    }
    
    return results;
  }

  /**
   * Get notification statistics
   */
  getNotificationStats(): {
    totalUsers: number;
    enabledUsers: number;
    totalTemplates: number;
    templatesByType: Record<NotificationType, number>;
    templatesByPriority: Record<NotificationPriority, number>;
  } {
    const totalUsers = this.userPreferences.size;
    const enabledUsers = Array.from(this.userPreferences.values())
      .filter(pref => pref.enabled).length;
    
    const totalTemplates = this.templates.size;
    
    const templatesByType: Record<NotificationType, number> = {} as any;
    const templatesByPriority: Record<NotificationPriority, number> = {} as any;
    
    // Initialize counters
    Object.values(NotificationType).forEach(type => {
      templatesByType[type] = 0;
    });
    Object.values(NotificationPriority).forEach(priority => {
      templatesByPriority[priority] = 0;
    });
    
    // Count templates
    Array.from(this.templates.values()).forEach(template => {
      templatesByType[template.type]++;
      templatesByPriority[template.priority]++;
    });
    
    return {
      totalUsers,
      enabledUsers,
      totalTemplates,
      templatesByType,
      templatesByPriority
    };
  }
}

export const notificationPreferencesService = new NotificationPreferencesService();