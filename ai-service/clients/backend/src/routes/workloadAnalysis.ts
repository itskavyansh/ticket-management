import { Router } from 'express';
import { WorkloadAnalysisController } from '../controllers/WorkloadAnalysisController';
import { authenticate } from '../middleware/auth';
import { UserRole } from '../types';

const router = Router();
const workloadAnalysisController = new WorkloadAnalysisController();

// Apply authentication to all routes
router.use(authenticate);

/**
 * @route GET /api/workload-analysis/technician/:technicianId
 * @desc Analyze workload for a specific technician
 * @access Manager, Admin
 */
router.get(
  '/technician/:technicianId',
  workloadAnalysisController.analyzeWorkload
);

/**
 * @route GET /api/workload-analysis/capacity/:technicianId
 * @desc Get technician capacity information
 * @access Manager, Admin, Technician (own data)
 */
router.get(
  '/capacity/:technicianId',
  workloadAnalysisController.getTechnicianCapacity
);

/**
 * @route GET /api/workload-analysis/prediction/:technicianId
 * @desc Get workload prediction for technician
 * @access Manager, Admin
 */
router.get(
  '/prediction/:technicianId',
  workloadAnalysisController.getWorkloadPrediction
);

/**
 * @route GET /api/workload-analysis/utilization/:technicianId
 * @desc Get utilization metrics for technician
 * @access Manager, Admin, Technician (own data)
 */
router.get(
  '/utilization/:technicianId',
  workloadAnalysisController.getUtilizationMetrics
);

/**
 * @route GET /api/workload-analysis/alerts/:technicianId
 * @desc Get active workload alerts for technician
 * @access Manager, Admin, Technician (own data)
 */
router.get(
  '/alerts/:technicianId',
  workloadAnalysisController.getWorkloadAlerts
);

/**
 * @route GET /api/workload-analysis/recommendations/:technicianId
 * @desc Get workload recommendations for technician
 * @access Manager, Admin
 */
router.get(
  '/recommendations/:technicianId',
  workloadAnalysisController.getWorkloadRecommendations
);

/**
 * @route GET /api/workload-analysis/team/:teamId
 * @desc Analyze workload for entire team
 * @access Manager, Admin
 */
router.get(
  '/team/:teamId',
  workloadAnalysisController.analyzeTeamWorkload
);

/**
 * @route GET /api/workload-analysis/overutilized
 * @desc Get list of overutilized technicians
 * @access Manager, Admin
 */
router.get(
  '/overutilized',
  workloadAnalysisController.getOverutilizedTechnicians
);

/**
 * @route POST /api/workload-analysis/rebalance
 * @desc Get rebalancing recommendations
 * @access Manager, Admin
 */
router.post(
  '/rebalance',
  workloadAnalysisController.getRebalancingRecommendations
);

/**
 * @route GET /api/workload-analysis/history/:technicianId
 * @desc Get workload analysis history for technician
 * @access Manager, Admin, Technician (own data)
 */
router.get(
  '/history/:technicianId',
  workloadAnalysisController.getWorkloadHistory
);

export default router;