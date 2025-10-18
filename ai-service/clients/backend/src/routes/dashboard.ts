import { Router } from 'express';
import { dashboardController } from '../controllers/DashboardController';
import { authenticateToken } from '../middleware/auth';
import { 
  requireAnalyticsRead, 
  requireAnalyticsExport,
  requireRole 
} from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();

// Apply authentication to all dashboard routes
router.use(authenticateToken);

// Dashboard widget endpoints
router.get('/widgets', requireAnalyticsRead, dashboardController.getDashboardWidgets);
router.get('/charts/:chartType', requireAnalyticsRead, dashboardController.getChartData);
router.get('/filtered-data', requireAnalyticsRead, dashboardController.getFilteredData);

// Filter options
router.get('/filter-options', requireAnalyticsRead, dashboardController.getFilterOptions);

// Real-time updates
router.get('/real-time-updates', requireAnalyticsRead, dashboardController.getRealTimeUpdates);

// Export endpoints
router.get('/export/pdf', requireAnalyticsExport, dashboardController.exportPDF);
router.get('/export/csv', requireAnalyticsExport, dashboardController.exportCSV);

// Health check
router.get('/health', dashboardController.healthCheck);

export default router;