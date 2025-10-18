import { Router } from 'express';
import { TimeTrackingController } from '../controllers/TimeTrackingController';
import { authenticateToken } from '../middleware/auth';
import { requireRole } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();
const timeTrackingController = new TimeTrackingController();

// Apply authentication to all routes
router.use(authenticateToken);

// Time tracking operations
router.post('/start', timeTrackingController.startTimeTracking);
router.post('/stop/:technicianId', timeTrackingController.stopTimeTracking);
router.post('/pause/:technicianId', timeTrackingController.pauseTimeTracking);
router.post('/resume/:technicianId', timeTrackingController.resumeTimeTracking);

// Activity tracking (heartbeat)
router.post('/activity/:technicianId', timeTrackingController.recordActivity);

// Current status
router.get('/current/:technicianId', timeTrackingController.getCurrentTimeEntry);
router.get('/session/:technicianId', timeTrackingController.getActiveSession);

// Time entry management
router.post('/validate', requireRole([UserRole.MANAGER, UserRole.ADMIN]), timeTrackingController.validateTimeEntry);
router.get('/entries', timeTrackingController.getTimeEntries);
router.get('/validation-required', requireRole([UserRole.MANAGER, UserRole.ADMIN]), timeTrackingController.getEntriesNeedingValidation);

// Analytics and reporting
router.get('/summary/:technicianId', timeTrackingController.getTimeTrackingSummary);
router.get('/stats/:technicianId', timeTrackingController.getTimeTrackingStats);

export default router;