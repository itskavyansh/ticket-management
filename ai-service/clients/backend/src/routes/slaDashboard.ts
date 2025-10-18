import { Router } from 'express';
import { SLADashboardController } from '../controllers/SLADashboardController';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();
const slaDashboardController = new SLADashboardController();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route GET /api/sla-dashboard
 * @desc Get comprehensive SLA dashboard data
 * @access Manager, Admin, Technician (filtered)
 */
router.get('/',
  requirePermission('sla:view'),
  slaDashboardController.getDashboardData.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/overview
 * @desc Get SLA overview statistics
 * @access Manager, Admin, Technician
 */
router.get('/overview',
  requirePermission('sla:view'),
  slaDashboardController.getOverview.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/high-risk-tickets
 * @desc Get high-risk tickets list
 * @access Manager, Admin, Technician (own tickets)
 */
router.get('/high-risk-tickets',
  requirePermission('sla:view'),
  slaDashboardController.getHighRiskTickets.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/trends
 * @desc Get SLA trend data
 * @access Manager, Admin
 */
router.get('/trends',
  requirePermission('sla:view'),
  slaDashboardController.getTrendData.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/performance/technicians
 * @desc Get performance data by technician
 * @access Manager, Admin
 */
router.get('/performance/technicians',
  requirePermission('sla:view'),
  slaDashboardController.getPerformanceByTechnician.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/performance/customers
 * @desc Get performance data by customer
 * @access Manager, Admin
 */
router.get('/performance/customers',
  requirePermission('sla:view'),
  slaDashboardController.getPerformanceByCustomer.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/risk-distribution
 * @desc Get risk distribution data
 * @access Manager, Admin, Technician
 */
router.get('/risk-distribution',
  requirePermission('sla:view'),
  slaDashboardController.getRiskDistribution.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/alerts
 * @desc Get alert summary
 * @access Manager, Admin, Technician
 */
router.get('/alerts',
  requirePermission('sla:view'),
  slaDashboardController.getAlertSummary.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/tickets/:ticketId
 * @desc Get detailed SLA information for a specific ticket
 * @access Manager, Admin, Technician (own tickets)
 */
router.get('/tickets/:ticketId',
  requirePermission('sla:view'),
  slaDashboardController.getTicketSLADetails.bind(slaDashboardController)
);

/**
 * @route GET /api/sla-dashboard/real-time
 * @desc Get real-time SLA status for dashboard widgets
 * @access Manager, Admin, Technician
 */
router.get('/real-time',
  requirePermission('sla:view'),
  slaDashboardController.getRealTimeStatus.bind(slaDashboardController)
);

/**
 * @route POST /api/sla-dashboard/clear-cache
 * @desc Clear dashboard cache to force refresh
 * @access Manager, Admin
 */
router.post('/clear-cache',
  requirePermission('sla:configure'),
  slaDashboardController.clearCache.bind(slaDashboardController)
);

export default router;