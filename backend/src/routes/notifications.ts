import { Router } from 'express';
import { notificationController } from '../controllers/NotificationController';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import {
  validateChannelRegistration,
  validateTemplateRegistration,
  validateNotificationRequest,
  validateSLAWarning,
  validateTicketAssignment
} from '../validation/notificationValidation';

const router = Router();

// Apply authentication to all notification routes
router.use(authenticateToken);

// Channel management routes
router.post('/channels', 
  requirePermission('manage_notifications'),
  validateChannelRegistration,
  notificationController.registerChannel.bind(notificationController)
);

router.get('/channels', 
  requirePermission('view_notifications'), 
  notificationController.getChannels.bind(notificationController)
);

router.post('/channels/:channelId/test', 
  requirePermission('manage_notifications'), 
  notificationController.testChannel.bind(notificationController)
);

// Template management routes
router.post('/templates', 
  requirePermission('manage_notifications'),
  validateTemplateRegistration,
  notificationController.registerTemplate.bind(notificationController)
);

router.get('/templates', 
  requirePermission('view_notifications'), 
  notificationController.getTemplates.bind(notificationController)
);

// Notification sending routes
router.post('/send', 
  requirePermission('send_notifications'),
  validateNotificationRequest,
  notificationController.sendNotification.bind(notificationController)
);

router.post('/sla-warning', 
  requirePermission('send_notifications'),
  validateSLAWarning,
  notificationController.sendSLAWarning.bind(notificationController)
);

router.post('/ticket-assignment', 
  requirePermission('send_notifications'),
  validateTicketAssignment,
  notificationController.sendTicketAssignment.bind(notificationController)
);

// Delivery tracking routes
router.get('/delivery/:deliveryId', 
  requirePermission('view_notifications'), 
  notificationController.getDeliveryStatus.bind(notificationController)
);

export default router;