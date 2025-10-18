import { Router } from 'express';
import { analyticsController } from '../controllers/AnalyticsController';
import { authenticateToken } from '../middleware/auth';
import { 
  requireAnalyticsRead, 
  requireAnalyticsExport,
  requireRole 
} from '../middleware/rbac';
import { UserRole } from '../types';
import { advancedRateLimit } from '../middleware/advancedRateLimiting';

const router = Router();

// Apply authentication to all analytics routes
router.use(authenticateToken);

// Apply advanced rate limiting for analytics endpoints
router.use(advancedRateLimit({ 
  preset: 'dashboard',
  enableThrottling: true,
  enableBurstProtection: true
}));

// Dashboard metrics endpoints
router.get('/dashboard', requireAnalyticsRead, analyticsController.getDashboardMetrics);
router.get('/team-performance', requireAnalyticsRead, analyticsController.getTeamPerformanceMetrics);

// Trend analysis and insights
router.get('/trends', requireAnalyticsRead, analyticsController.getTrendAnalysis);
router.get('/trend-insights', requireAnalyticsRead, analyticsController.getTrendInsights);
router.get('/bottlenecks', requireAnalyticsRead, analyticsController.getBottleneckAnalysis);
router.get('/advanced-bottlenecks', requireAnalyticsRead, analyticsController.getAdvancedBottleneckAnalysis);
router.get('/capacity-prediction', requireAnalyticsRead, analyticsController.getCapacityPrediction);
router.get('/capacity-scenarios', requireAnalyticsRead, analyticsController.getCapacityPredictionWithScenarios);

// Custom analytics queries
router.post('/query', requireAnalyticsRead, analyticsController.getCustomAnalytics);

// Metrics collection (admin/manager only)
router.post('/collect', requireRole([UserRole.ADMIN, UserRole.MANAGER]), analyticsController.collectMetrics);

// Real-time analytics management
router.get('/realtime/stats', requireAnalyticsRead, analyticsController.getSubscriberStats);
router.post('/realtime/trigger-update', requireRole([UserRole.ADMIN, UserRole.MANAGER]), analyticsController.triggerRealTimeUpdate);
router.put('/realtime/frequency', requireRole([UserRole.ADMIN]), analyticsController.updateAnalyticsFrequency);

// Health check
router.get('/health', analyticsController.healthCheck);

export default router;