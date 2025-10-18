import { Request, Response } from 'express';
import { SuperOpsSyncService } from '../services/SuperOpsSyncService';
import { logger } from '../utils/logger';
import { SuperOpsWebhookPayload } from '../types/superops';
import crypto from 'crypto';

export class SuperOpsWebhookController {
  private syncService: SuperOpsSyncService;

  constructor() {
    this.syncService = SuperOpsSyncService.getInstance();
  }

  // Handle incoming webhooks from SuperOps
  public handleWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      // Verify webhook signature
      if (!this.verifyWebhookSignature(req)) {
        logger.warn('Invalid webhook signature', {
          headers: req.headers,
          ip: req.ip
        });
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const payload: SuperOpsWebhookPayload = req.body;

      logger.info('Received SuperOps webhook', {
        event: payload.event,
        timestamp: payload.timestamp
      });

      // Process webhook asynchronously
      this.syncService.handleWebhook(payload).catch(error => {
        logger.error('Error processing webhook:', error);
      });

      // Respond immediately to acknowledge receipt
      res.status(200).json({ 
        success: true, 
        message: 'Webhook received and queued for processing' 
      });
    } catch (error) {
      logger.error('Error handling SuperOps webhook:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  };

  // Handle ticket-specific webhooks
  public handleTicketWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.verifyWebhookSignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const payload: SuperOpsWebhookPayload = req.body;

      if (!payload.data.ticket) {
        res.status(400).json({ error: 'Missing ticket data in payload' });
        return;
      }

      logger.info('Received SuperOps ticket webhook', {
        event: payload.event,
        ticketId: payload.data.ticket.id
      });

      // Process ticket webhook
      await this.syncService.handleWebhook(payload);

      res.status(200).json({ 
        success: true, 
        message: 'Ticket webhook processed successfully' 
      });
    } catch (error) {
      logger.error('Error handling SuperOps ticket webhook:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  };

  // Handle customer-specific webhooks
  public handleCustomerWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.verifyWebhookSignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const payload: SuperOpsWebhookPayload = req.body;

      if (!payload.data.customer) {
        res.status(400).json({ error: 'Missing customer data in payload' });
        return;
      }

      logger.info('Received SuperOps customer webhook', {
        event: payload.event,
        customerId: payload.data.customer.id
      });

      // For now, just log customer webhooks
      // Customer sync logic would be implemented here
      logger.info('Customer webhook received but not processed', {
        customerId: payload.data.customer.id,
        event: payload.event
      });

      res.status(200).json({ 
        success: true, 
        message: 'Customer webhook received' 
      });
    } catch (error) {
      logger.error('Error handling SuperOps customer webhook:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  };

  // Handle technician-specific webhooks
  public handleTechnicianWebhook = async (req: Request, res: Response): Promise<void> => {
    try {
      if (!this.verifyWebhookSignature(req)) {
        res.status(401).json({ error: 'Invalid signature' });
        return;
      }

      const payload: SuperOpsWebhookPayload = req.body;

      if (!payload.data.technician) {
        res.status(400).json({ error: 'Missing technician data in payload' });
        return;
      }

      logger.info('Received SuperOps technician webhook', {
        event: payload.event,
        technicianId: payload.data.technician.id
      });

      // For now, just log technician webhooks
      // Technician sync logic would be implemented here
      logger.info('Technician webhook received but not processed', {
        technicianId: payload.data.technician.id,
        event: payload.event
      });

      res.status(200).json({ 
        success: true, 
        message: 'Technician webhook received' 
      });
    } catch (error) {
      logger.error('Error handling SuperOps technician webhook:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  };

  // Get sync status for monitoring
  public getSyncStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { entityType, entityId } = req.params;

      if (entityType && entityId) {
        const status = this.syncService.getSyncStatus(entityType, entityId);
        if (status) {
          res.json({ success: true, data: status });
        } else {
          res.status(404).json({ error: 'Sync status not found' });
        }
      } else {
        const allStatuses = this.syncService.getAllSyncStatuses();
        res.json({ success: true, data: allStatuses });
      }
    } catch (error) {
      logger.error('Error getting sync status:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  };

  // Trigger manual sync
  public triggerSync = async (req: Request, res: Response): Promise<void> => {
    try {
      const { type } = req.body;

      switch (type) {
        case 'full':
          // Trigger full sync asynchronously
          this.syncService.performFullSync().catch(error => {
            logger.error('Error during manual full sync:', error);
          });
          res.json({ 
            success: true, 
            message: 'Full sync initiated' 
          });
          break;

        default:
          res.status(400).json({ error: 'Invalid sync type' });
      }
    } catch (error) {
      logger.error('Error triggering sync:', error);
      res.status(500).json({ 
        error: 'Internal server error',
        message: error.message 
      });
    }
  };

  // Verify webhook signature for security
  private verifyWebhookSignature(req: Request): boolean {
    try {
      const signature = req.headers['x-superops-signature'] as string;
      const webhookSecret = process.env.SUPEROPS_WEBHOOK_SECRET;

      if (!signature || !webhookSecret) {
        logger.warn('Missing signature or webhook secret');
        return false;
      }

      const payload = JSON.stringify(req.body);
      const expectedSignature = crypto
        .createHmac('sha256', webhookSecret)
        .update(payload)
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');

      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Error verifying webhook signature:', error);
      return false;
    }
  }
}