import { Request, Response } from 'express';
import { notificationPreferencesService } from '../services/NotificationPreferencesService';
import {
  NotificationPreferences,
  NotificationTemplate,
  NotificationType,
  NotificationPriority
} from '../types/notification';
import { logger } from '../utils/logger';

export class NotificationPreferencesController {
  /**
   * Get user notification preferences
   */
  async getUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      
      if (!userId) {
        res.status(400).json({
          error: 'User ID is required'
        });
        return;
      }

      const preferences = await notificationPreferencesService.getUserPreferences(userId);
      
      if (!preferences) {
        res.status(404).json({
          error: 'User preferences not found'
        });
        return;
      }

      res.status(200).json(preferences);
    } catch (error) {
      logger.error('Error getting user preferences:', error);
      res.status(500).json({
        error: 'Failed to get user preferences',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update user notification preferences
   */
  async updateUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const preferences: Partial<NotificationPreferences> = req.body;
      
      if (!userId) {
        res.status(400).json({
          error: 'User ID is required'
        });
        return;
      }

      const updatedPreferences = await notificationPreferencesService.updateUserPreferences(
        userId, 
        preferences
      );
      
      res.status(200).json({
        message: 'Preferences updated successfully',
        preferences: updatedPreferences
      });
    } catch (error) {
      logger.error('Error updating user preferences:', error);
      res.status(500).json({
        error: 'Failed to update user preferences',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get channels for a specific notification type and user
   */
  async getChannelsForNotification(req: Request, res: Response): Promise<void> {
    try {
      const { userId, notificationType } = req.params;
      
      if (!userId || !notificationType) {
        res.status(400).json({
          error: 'User ID and notification type are required'
        });
        return;
      }

      if (!Object.values(NotificationType).includes(notificationType as NotificationType)) {
        res.status(400).json({
          error: 'Invalid notification type'
        });
        return;
      }

      const channels = await notificationPreferencesService.getChannelsForNotification(
        userId, 
        notificationType as NotificationType
      );
      
      res.status(200).json({
        userId,
        notificationType,
        channels
      });
    } catch (error) {
      logger.error('Error getting channels for notification:', error);
      res.status(500).json({
        error: 'Failed to get channels for notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Create notification template
   */
  async createTemplate(req: Request, res: Response): Promise<void> {
    try {
      const template: NotificationTemplate = req.body;
      
      const createdTemplate = await notificationPreferencesService.createTemplate(template);
      
      res.status(201).json({
        message: 'Template created successfully',
        template: createdTemplate
      });
    } catch (error) {
      logger.error('Error creating template:', error);
      res.status(500).json({
        error: 'Failed to create template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Update notification template
   */
  async updateTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      const updates: Partial<NotificationTemplate> = req.body;
      
      if (!templateId) {
        res.status(400).json({
          error: 'Template ID is required'
        });
        return;
      }

      const updatedTemplate = await notificationPreferencesService.updateTemplate(
        templateId, 
        updates
      );
      
      res.status(200).json({
        message: 'Template updated successfully',
        template: updatedTemplate
      });
    } catch (error) {
      logger.error('Error updating template:', error);
      res.status(500).json({
        error: 'Failed to update template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Delete notification template
   */
  async deleteTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      
      if (!templateId) {
        res.status(400).json({
          error: 'Template ID is required'
        });
        return;
      }

      const deleted = await notificationPreferencesService.deleteTemplate(templateId);
      
      if (!deleted) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.status(200).json({
        message: 'Template deleted successfully',
        templateId
      });
    } catch (error) {
      logger.error('Error deleting template:', error);
      res.status(500).json({
        error: 'Failed to delete template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get template by ID
   */
  async getTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { templateId } = req.params;
      
      if (!templateId) {
        res.status(400).json({
          error: 'Template ID is required'
        });
        return;
      }

      const template = notificationPreferencesService.getTemplate(templateId);
      
      if (!template) {
        res.status(404).json({
          error: 'Template not found'
        });
        return;
      }

      res.status(200).json(template);
    } catch (error) {
      logger.error('Error getting template:', error);
      res.status(500).json({
        error: 'Failed to get template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all templates
   */
  async getAllTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = notificationPreferencesService.getAllTemplates();
      
      res.status(200).json({
        templates,
        count: templates.length
      });
    } catch (error) {
      logger.error('Error getting all templates:', error);
      res.status(500).json({
        error: 'Failed to get templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get templates by priority
   */
  async getTemplatesByPriority(req: Request, res: Response): Promise<void> {
    try {
      const { priority } = req.params;
      
      if (!priority || !Object.values(NotificationPriority).includes(priority as NotificationPriority)) {
        res.status(400).json({
          error: 'Valid priority is required'
        });
        return;
      }

      const templates = notificationPreferencesService.getTemplatesByPriority(
        priority as NotificationPriority
      );
      
      res.status(200).json({
        priority,
        templates,
        count: templates.length
      });
    } catch (error) {
      logger.error('Error getting templates by priority:', error);
      res.status(500).json({
        error: 'Failed to get templates by priority',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Set default channels for a notification type
   */
  async setDefaultChannels(req: Request, res: Response): Promise<void> {
    try {
      const { notificationType } = req.params;
      const { channelIds } = req.body;
      
      if (!notificationType || !Object.values(NotificationType).includes(notificationType as NotificationType)) {
        res.status(400).json({
          error: 'Valid notification type is required'
        });
        return;
      }

      if (!Array.isArray(channelIds)) {
        res.status(400).json({
          error: 'Channel IDs must be an array'
        });
        return;
      }

      notificationPreferencesService.setDefaultChannels(
        notificationType as NotificationType, 
        channelIds
      );
      
      res.status(200).json({
        message: 'Default channels set successfully',
        notificationType,
        channelIds
      });
    } catch (error) {
      logger.error('Error setting default channels:', error);
      res.status(500).json({
        error: 'Failed to set default channels',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get default channels for a notification type
   */
  async getDefaultChannels(req: Request, res: Response): Promise<void> {
    try {
      const { notificationType } = req.params;
      
      if (!notificationType || !Object.values(NotificationType).includes(notificationType as NotificationType)) {
        res.status(400).json({
          error: 'Valid notification type is required'
        });
        return;
      }

      const channels = notificationPreferencesService.getDefaultChannels(
        notificationType as NotificationType
      );
      
      res.status(200).json({
        notificationType,
        channels
      });
    } catch (error) {
      logger.error('Error getting default channels:', error);
      res.status(500).json({
        error: 'Failed to get default channels',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Bulk update user preferences
   */
  async bulkUpdatePreferences(req: Request, res: Response): Promise<void> {
    try {
      const { updates } = req.body;
      
      if (!Array.isArray(updates)) {
        res.status(400).json({
          error: 'Updates must be an array'
        });
        return;
      }

      const results = await notificationPreferencesService.bulkUpdatePreferences(updates);
      
      res.status(200).json({
        message: 'Bulk update completed',
        updated: results.length,
        total: updates.length,
        results
      });
    } catch (error) {
      logger.error('Error bulk updating preferences:', error);
      res.status(500).json({
        error: 'Failed to bulk update preferences',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get notification statistics
   */
  async getNotificationStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = notificationPreferencesService.getNotificationStats();
      
      res.status(200).json(stats);
    } catch (error) {
      logger.error('Error getting notification stats:', error);
      res.status(500).json({
        error: 'Failed to get notification stats',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test notification preferences for a user
   */
  async testUserPreferences(req: Request, res: Response): Promise<void> {
    try {
      const { userId } = req.params;
      const { notificationType } = req.body;
      
      if (!userId) {
        res.status(400).json({
          error: 'User ID is required'
        });
        return;
      }

      if (!notificationType || !Object.values(NotificationType).includes(notificationType)) {
        res.status(400).json({
          error: 'Valid notification type is required'
        });
        return;
      }

      const preferences = await notificationPreferencesService.getUserPreferences(userId);
      const channels = await notificationPreferencesService.getChannelsForNotification(
        userId, 
        notificationType
      );
      
      res.status(200).json({
        userId,
        notificationType,
        preferences,
        channels,
        wouldReceive: channels.length > 0 && preferences?.enabled
      });
    } catch (error) {
      logger.error('Error testing user preferences:', error);
      res.status(500).json({
        error: 'Failed to test user preferences',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const notificationPreferencesController = new NotificationPreferencesController();