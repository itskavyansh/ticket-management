import { Router } from 'express';
import { chatBotController } from '../controllers/ChatBotController';
import { auth } from '../middleware/auth';
import { rbac } from '../middleware/rbac';
import { UserRole } from '../types/auth';
import { 
  verifySlackWebhook, 
  verifyTeamsWebhook, 
  webhookRateLimit 
} from '../middleware/webhookVerification';

const router = Router();

// Apply rate limiting to all webhook endpoints
router.use(webhookRateLimit(200, 60000)); // 200 requests per minute

// Slack webhook endpoints (no auth required for external webhooks)
router.post('/slack/events', verifySlackWebhook, chatBotController.handleSlackEvent);
router.post('/slack/commands', verifySlackWebhook, chatBotController.handleSlackSlashCommand);
router.post('/slack/interactive', verifySlackWebhook, chatBotController.handleSlackInteractive);

// Microsoft Teams webhook endpoints (no auth required for external webhooks)
router.post('/teams/messages', verifyTeamsWebhook, chatBotController.handleTeamsMessage);

// Bot management endpoints (require authentication)
router.get('/status', auth, rbac([UserRole.ADMIN, UserRole.MANAGER]), chatBotController.getBotStatus);

export default router;