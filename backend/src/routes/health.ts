import { Router } from 'express';
import { HealthController } from '../controllers/HealthController';

const router = Router();
const healthController = new HealthController();

/**
 * @route GET /health
 * @desc Basic health check endpoint
 * @access Public
 */
router.get('/', healthController.getHealth.bind(healthController));

/**
 * @route GET /health/detailed
 * @desc Detailed health check with dependencies
 * @access Public
 */
router.get('/detailed', healthController.getDetailedHealth.bind(healthController));

/**
 * @route GET /health/ready
 * @desc Kubernetes readiness probe
 * @access Public
 */
router.get('/ready', healthController.getReadiness.bind(healthController));

/**
 * @route GET /health/live
 * @desc Kubernetes liveness probe
 * @access Public
 */
router.get('/live', healthController.getLiveness.bind(healthController));

/**
 * @route GET /health/metrics
 * @desc Application metrics endpoint
 * @access Public
 */
router.get('/metrics', healthController.getMetrics.bind(healthController));

/**
 * @route GET /health/metrics/prometheus
 * @desc Prometheus-compatible metrics endpoint
 * @access Public
 */
router.get('/metrics/prometheus', healthController.getPrometheusMetrics.bind(healthController));

/**
 * @route GET /health/service/:serviceName
 * @desc Service-specific health check
 * @access Public
 */
router.get('/service/:serviceName', healthController.getServiceHealth.bind(healthController));

/**
 * @route GET /health/database
 * @desc Database health check
 * @access Public
 */
router.get('/database', healthController.getDatabaseHealth.bind(healthController));

/**
 * @route GET /health/external
 * @desc External dependencies health check
 * @access Public
 */
router.get('/external', healthController.getExternalDependenciesHealth.bind(healthController));

/**
 * @route GET /health/ai
 * @desc AI services health check
 * @access Public
 */
router.get('/ai', healthController.getAIServicesHealth.bind(healthController));

export default router;