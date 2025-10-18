import { Router } from 'express';
import { notificationPreferencesController } from '../controllers/NotificationPreferencesController';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import {
  validateTemplateRegistration,
  validateNotificationPreferences
} from '../validation/notificationValidation';

const router = Router();

// Apply authentication to all routes
router.use(authenticateToken);

// User preferences routes
router.get('/users/:userId/preferences', 
  requirePermission('view_notifications'), 
  notificationPreferencesController.getUserPreferences.bind(notificationPreferencesController)
);

router.put('/users/:userId/preferences', 
  requirePermission('manage_notifications'),
  validateNotificationPreferences,
  notificationPreferencesController.updateUserPreferences.bind(notificationPreferencesController)
);

router.get('/users/:userId/channels/:notificationType', 
  requirePermission('view_notifications'), 
  notificationPreferencesController.getChannelsForNotification.bind(notificationPreferencesController)
);

router.post('/users/:userId/test', 
  requirePermission('manage_notifications'), 
  notificationPreferencesController.testUserPreferences.bind(notificationPreferencesController)
);

// Template management routes
router.post('/templates', 
  requirePermission('manage_notifications'),
  validateTemplateRegistration,
  notificationPreferencesController.createTemplate.bind(notificationPreferencesController)
);

router.get('/templates', 
  requirePermission('view_notifications'), 
  notificationPreferencesController.getAllTemplates.bind(notificationPreferencesController)
);

router.get('/templates/:templateId', 
  requirePermission('view_notifications'), 
  notificationPreferencesController.getTemplate.bind(notificationPreferencesController)
);

router.put('/templates/:templateId', 
  requirePermission('manage_notifications'),
  validateTemplateRegistration,
  notificationPreferencesController.updateTemplate.bind(notificationPreferencesController)
);

router.delete('/templates/:templateId', 
  requirePermission('manage_notifications'), 
  notificationPreferencesController.deleteTemplate.bind(notificationPreferencesController)
);

router.get('/templates/priority/:priority', 
  requirePermission('view_notifications'), 
  notificationPreferencesController.getTemplatesByPriority.bind(notificationPreferencesController)
);

// Default channels management
router.post('/defaults/:notificationType/channels', 
  requirePermission('manage_notifications'), 
  notificationPreferencesController.setDefaultChannels.bind(notificationPreferencesController)
);

router.get('/defaults/:notificationType/channels', 
  requirePermission('view_notifications'), 
  notificationPreferencesController.getDefaultChannels.bind(notificationPreferencesController)
);

// Bulk operations
router.post('/users/bulk-update', 
  requirePermission('manage_notifications'), 
  notificationPreferencesController.bulkUpdatePreferences.bind(notificationPreferencesController)
);

// Statistics and monitoring
router.get('/stats', 
  requirePermission('view_notifications'), 
  notificationPreferencesController.getNotificationStats.bind(notificationPreferencesController)
);

export default router;