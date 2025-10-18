import { Router } from 'express';
import { AIController } from '../controllers/AIController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();
const aiController = new AIController();

// Apply authentication to all AI routes
router.use(authenticate);

/**
 * AI Service Health and Monitoring
 */

// Get AI service health status
// GET /api/ai/health
router.get('/health',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  aiController.getHealthStatus
);

// Get AI service metrics and performance stats
// GET /api/ai/metrics
router.get('/metrics',
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  aiController.getMetrics
);

// Test AI service connectivity
// POST /api/ai/test
router.post('/test',
  authorize([UserRole.ADMIN]),
  aiController.testConnectivity
);

export default router;