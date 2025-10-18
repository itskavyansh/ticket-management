import { Router } from 'express';
import { SLAAlertingController } from '../controllers/SLAAlertingController';
import { authenticateToken } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';

const router = Router();
const slaAlertingController = new SLAAlertingController();

// Apply authentication to all routes
router.use(authenticateToken);

/**
 * @route POST /api/sla-alerts/monitor
 * @desc Trigger manual SLA monitoring cycle
 * @access Manager, Admin
 */
router.post('/monitor', 
  requirePermission('sla:monitor'),
  slaAlertingController.triggerMonitoring.bind(slaAlertingController)
);

/**
 * @route GET /api/sla-alerts/history
 * @desc Get alert history with filtering and pagination
 * @access Manager, Admin, Technician (own tickets)
 */
router.get('/history',
  requirePermission('sla:view'),
  slaAlertingController.getAlertHistory.bind(slaAlertingController)
);

/**
 * @route GET /api/sla-alerts/config
 * @desc Get current alerting configuration
 * @access Manager, Admin
 */
router.get('/config',
  requirePermission('sla:configure'),
  slaAlertingController.getConfig.bind(slaAlertingController)
);

/**
 * @route PUT /api/sla-alerts/config
 * @desc Update alerting configuration
 * @access Admin
 */
router.put('/config',
  requirePermission('sla:configure'),
  slaAlertingController.updateConfig.bind(slaAlertingController)
);

/**
 * @route GET /api/sla-alerts/status
 * @desc Get monitoring status and statistics
 * @access Manager, Admin
 */
router.get('/status',
  requirePermission('sla:view'),
  slaAlertingController.getMonitoringStatus.bind(slaAlertingController)
);

/**
 * @route POST /api/sla-alerts/test
 * @desc Send test alert
 * @access Admin
 */
router.post('/test',
  requirePermission('sla:configure'),
  slaAlertingController.testAlert.bind(slaAlertingController)
);

export default router;