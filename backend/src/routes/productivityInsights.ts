import { Router } from 'express';
import { ProductivityInsightsController } from '../controllers/ProductivityInsightsController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '../types';
import { 
  validateProductivityInsightsRequest,
  validationSchemas 
} from '../validation/productivityInsightsValidation';

const router = Router();
const productivityInsightsController = new ProductivityInsightsController();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route GET /api/productivity-insights/technician/:technicianId/throughput
 * @desc Get throughput metrics for a specific technician
 * @access Manager, Admin, Technician (own data)
 */
router.get(
  '/technician/:technicianId/throughput',
  validateProductivityInsightsRequest(validationSchemas.throughputMetrics),
  requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  productivityInsightsController.getThroughputMetrics
);

/**
 * @route GET /api/productivity-insights/technician/:technicianId/resolution-analysis
 * @desc Get resolution time analysis for a specific technician
 * @access Manager, Admin, Technician (own data)
 */
router.get(
  '/technician/:technicianId/resolution-analysis',
  validateProductivityInsightsRequest(validationSchemas.resolutionAnalysis),
  requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  productivityInsightsController.getResolutionTimeAnalysis
);

/**
 * @route GET /api/productivity-insights/technician/:technicianId/performance
 * @desc Get comprehensive performance metrics for a specific technician
 * @access Manager, Admin, Technician (own data)
 */
router.get(
  '/technician/:technicianId/performance',
  validateProductivityInsightsRequest(validationSchemas.dateRangeQuery),
  requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  productivityInsightsController.getIndividualPerformanceMetrics
);

/**
 * @route POST /api/productivity-insights/team/report
 * @desc Generate team productivity report
 * @access Manager, Admin
 */
router.post(
  '/team/report',
  validateProductivityInsightsRequest(validationSchemas.teamProductivityReport),
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  productivityInsightsController.getTeamProductivityReport
);

/**
 * @route POST /api/productivity-insights/trends
 * @desc Get productivity trends for multiple technicians
 * @access Manager, Admin
 */
router.post(
  '/trends',
  validateProductivityInsightsRequest(validationSchemas.productivityTrends),
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  productivityInsightsController.getProductivityTrends
);

/**
 * @route GET /api/productivity-insights/dashboard
 * @desc Get productivity dashboard data
 * @access Manager, Admin, Technician (own data)
 */
router.get(
  '/dashboard',
  validateProductivityInsightsRequest(validationSchemas.dashboard),
  requireRole([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  productivityInsightsController.getProductivityDashboard
);

/**
 * @route POST /api/productivity-insights/comparison
 * @desc Compare performance between multiple technicians
 * @access Manager, Admin
 */
router.post(
  '/comparison',
  validateProductivityInsightsRequest(validationSchemas.performanceComparison),
  requireRole([UserRole.ADMIN, UserRole.MANAGER]),
  productivityInsightsController.getPerformanceComparison
);

export default router;