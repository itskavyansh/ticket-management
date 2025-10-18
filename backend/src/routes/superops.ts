import { Router } from 'express';
import { SuperOpsWebhookController } from '../controllers/SuperOpsWebhookController';
import { auth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();
const webhookController = new SuperOpsWebhookController();

// Webhook endpoints (no auth required for external webhooks)
router.post('/webhooks/general', webhookController.handleWebhook);
router.post('/webhooks/tickets', webhookController.handleTicketWebhook);
router.post('/webhooks/customers', webhookController.handleCustomerWebhook);
router.post('/webhooks/technicians', webhookController.handleTechnicianWebhook);

// Sync management endpoints (require authentication)
router.get('/sync/status', auth, rbac([UserRole.ADMIN, UserRole.MANAGER]), webhookController.getSyncStatus);
router.get('/sync/status/:entityType/:entityId', auth, rbac([UserRole.ADMIN, UserRole.MANAGER]), webhookController.getSyncStatus);
router.post('/sync/trigger', auth, rbac([UserRole.ADMIN]), webhookController.triggerSync);

export default router;