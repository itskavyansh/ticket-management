import { Request, Response } from 'express';
import { notificationService } from '../services/NotificationService';
import {
  NotificationChannel,
  NotificationTemplate,
  NotificationRequest,
  NotificationType,
  NotificationPriority
} from '../types/notification';
import { logger } from '../utils/logger';

export class NotificationController {
  /**
   * Register a new notification channel
   */
  async registerChannel(req: Request, res: Response): Promise<void> {
    try {
      const channel: NotificationChannel = req.body;
      
      // Validate required fields
      if (!channel.id || !channel.type || !channel.name || !channel.config) {
        res.status(400).json({
          error: 'Missing required fields: id, type, name, config'
        });
        return;
      }

      await notificationService.registerChannel(channel);
      
      res.status(201).json({
        message: 'Channel registered successfully',
        channelId: channel.id
      });
    } catch (error) {
      logger.error('Error registering notification channel:', error);
      res.status(500).json({
        error: 'Failed to register notification channel',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Register a new notification template
   */
  async registerTemplate(req: Request, res: Response): Promise<void> {
    try {
      const template: NotificationTemplate = req.body;
      
      // Validate required fields
      if (!template.id || !template.name || !template.type || !template.subject || !template.message) {
        res.status(400).json({
          error: 'Missing required fields: id, name, type, subject, message'
        });
        return;
      }

      notificationService.registerTemplate(template);
      
      res.status(201).json({
        message: 'Template registered successfully',
        templateId: template.id
      });
    } catch (error) {
      logger.error('Error registering notification template:', error);
      res.status(500).json({
        error: 'Failed to register notification template',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send a notification
   */
  async sendNotification(req: Request, res: Response): Promise<void> {
    try {
      const request: NotificationRequest = req.body;
      
      // Validate required fields
      if (!request.type || !request.priority || !request.data) {
        res.status(400).json({
          error: 'Missing required fields: type, priority, data'
        });
        return;
      }

      // Validate enum values
      if (!Object.values(NotificationType).includes(request.type)) {
        res.status(400).json({
          error: 'Invalid notification type'
        });
        return;
      }

      if (!Object.values(NotificationPriority).includes(request.priority)) {
        res.status(400).json({
          error: 'Invalid notification priority'
        });
        return;
      }

      const deliveryIds = await notificationService.sendNotification(request);
      
      res.status(200).json({
        message: 'Notification sent successfully',
        deliveryIds,
        channelCount: deliveryIds.length
      });
    } catch (error) {
      logger.error('Error sending notification:', error);
      res.status(500).json({
        error: 'Failed to send notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get delivery status for a notification
   */
  async getDeliveryStatus(req: Request, res: Response): Promise<void> {
    try {
      const { deliveryId } = req.params;
      
      if (!deliveryId) {
        res.status(400).json({
          error: 'Delivery ID is required'
        });
        return;
      }

      const delivery = await notificationService.getDeliveryStatus(deliveryId);
      
      if (!delivery) {
        res.status(404).json({
          error: 'Delivery not found'
        });
        return;
      }

      res.status(200).json(delivery);
    } catch (error) {
      logger.error('Error getting delivery status:', error);
      res.status(500).json({
        error: 'Failed to get delivery status',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all registered channels
   */
  async getChannels(req: Request, res: Response): Promise<void> {
    try {
      const channels = notificationService.getChannels();
      
      // Remove sensitive configuration data
      const sanitizedChannels = channels.map(channel => ({
        id: channel.id,
        type: channel.type,
        name: channel.name,
        enabled: channel.enabled
      }));

      res.status(200).json({
        channels: sanitizedChannels,
        count: sanitizedChannels.length
      });
    } catch (error) {
      logger.error('Error getting channels:', error);
      res.status(500).json({
        error: 'Failed to get channels',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Get all registered templates
   */
  async getTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = notificationService.getTemplates();

      res.status(200).json({
        templates,
        count: templates.length
      });
    } catch (error) {
      logger.error('Error getting templates:', error);
      res.status(500).json({
        error: 'Failed to get templates',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Test notification channel
   */
  async testChannel(req: Request, res: Response): Promise<void> {
    try {
      const { channelId } = req.params;
      
      if (!channelId) {
        res.status(400).json({
          error: 'Channel ID is required'
        });
        return;
      }

      // Send a test notification
      const testRequest: NotificationRequest = {
        type: NotificationType.SYSTEM_ALERT,
        priority: NotificationPriority.LOW,
        channels: [channelId],
        data: {
          message: 'This is a test notification',
          timestamp: new Date().toISOString(),
          source: 'Notification Controller Test'
        }
      };

      const deliveryIds = await notificationService.sendNotification(testRequest);
      
      res.status(200).json({
        message: 'Test notification sent',
        deliveryIds,
        channelId
      });
    } catch (error) {
      logger.error('Error testing notification channel:', error);
      res.status(500).json({
        error: 'Failed to test notification channel',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send SLA breach warning notification
   */
  async sendSLAWarning(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId, riskPercentage, timeRemaining, technician, channels } = req.body;
      
      if (!ticketId || !riskPercentage || !timeRemaining) {
        res.status(400).json({
          error: 'Missing required fields: ticketId, riskPercentage, timeRemaining'
        });
        return;
      }

      const request: NotificationRequest = {
        type: NotificationType.SLA_BREACH_WARNING,
        priority: riskPercentage > 85 ? NotificationPriority.CRITICAL : NotificationPriority.HIGH,
        templateId: riskPercentage > 85 ? 'sla-breach-critical' : 'sla-breach-warning',
        channels,
        data: {
          ticketId,
          riskPercentage,
          timeRemaining,
          technician
        },
        ticketId
      };

      const deliveryIds = await notificationService.sendNotification(request);
      
      res.status(200).json({
        message: 'SLA warning notification sent',
        deliveryIds,
        priority: request.priority
      });
    } catch (error) {
      logger.error('Error sending SLA warning:', error);
      res.status(500).json({
        error: 'Failed to send SLA warning',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }

  /**
   * Send ticket assignment notification
   */
  async sendTicketAssignment(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId, title, priority, technician, customer, dueDate, channels } = req.body;
      
      if (!ticketId || !title || !technician) {
        res.status(400).json({
          error: 'Missing required fields: ticketId, title, technician'
        });
        return;
      }

      const request: NotificationRequest = {
        type: NotificationType.TICKET_ASSIGNED,
        priority: NotificationPriority.MEDIUM,
        templateId: 'ticket-assigned',
        channels,
        data: {
          ticketId,
          title,
          priority,
          technician,
          customer,
          dueDate
        },
        ticketId,
        userId: technician
      };

      const deliveryIds = await notificationService.sendNotification(request);
      
      res.status(200).json({
        message: 'Ticket assignment notification sent',
        deliveryIds,
        technician
      });
    } catch (error) {
      logger.error('Error sending ticket assignment notification:', error);
      res.status(500).json({
        error: 'Failed to send ticket assignment notification',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
}

export const notificationController = new NotificationController();