import { Request, Response } from 'express';
import { HealthService } from '../services/HealthService';
import { MetricsCollectionService } from '../services/MetricsCollectionService';
import { logger } from '../utils/logger';

export class HealthController {
  private healthService: HealthService;
  private metricsService: MetricsCollectionService;

  constructor() {
    this.healthService = new HealthService();
    this.metricsService = new MetricsCollectionService();
  }

  /**
   * Basic health check endpoint
   */
  public async getHealth(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await this.healthService.getOverallHealth();
      
      const statusCode = healthStatus.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        status: healthStatus.status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: healthStatus.services
      });
    } catch (error) {
      logger.error('Health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Health check service unavailable'
      });
    }
  }

  /**
   * Detailed health check with dependency status
   */
  public async getDetailedHealth(req: Request, res: Response): Promise<void> {
    try {
      const detailedHealth = await this.healthService.getDetailedHealth();
      
      const statusCode = detailedHealth.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        status: detailedHealth.status,
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        environment: process.env.NODE_ENV || 'development',
        services: detailedHealth.services,
        dependencies: detailedHealth.dependencies,
        systemInfo: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          memory: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        }
      });
    } catch (error) {
      logger.error('Detailed health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Detailed health check service unavailable'
      });
    }
  }

  /**
   * Readiness probe for Kubernetes/container orchestration
   */
  public async getReadiness(req: Request, res: Response): Promise<void> {
    try {
      const readinessStatus = await this.healthService.getReadinessStatus();
      
      if (readinessStatus.ready) {
        res.status(200).json({
          status: 'ready',
          timestamp: new Date().toISOString(),
          checks: readinessStatus.checks
        });
      } else {
        res.status(503).json({
          status: 'not_ready',
          timestamp: new Date().toISOString(),
          checks: readinessStatus.checks,
          failedChecks: readinessStatus.failedChecks
        });
      }
    } catch (error) {
      logger.error('Readiness check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Readiness check service unavailable'
      });
    }
  }

  /**
   * Liveness probe for Kubernetes/container orchestration
   */
  public async getLiveness(req: Request, res: Response): Promise<void> {
    try {
      const livenessStatus = await this.healthService.getLivenessStatus();
      
      if (livenessStatus.alive) {
        res.status(200).json({
          status: 'alive',
          timestamp: new Date().toISOString(),
          uptime: process.uptime()
        });
      } else {
        res.status(503).json({
          status: 'not_alive',
          timestamp: new Date().toISOString(),
          reason: livenessStatus.reason
        });
      }
    } catch (error) {
      logger.error('Liveness check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Liveness check service unavailable'
      });
    }
  }

  /**
   * Application metrics endpoint
   */
  public async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      const metrics = await this.metricsService.getAllMetrics();
      
      res.status(200).json({
        timestamp: new Date().toISOString(),
        metrics: metrics,
        collection_interval: this.metricsService.getCollectionInterval()
      });
    } catch (error) {
      logger.error('Metrics collection failed:', error);
      res.status(500).json({
        error: 'Metrics collection service unavailable',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Prometheus-compatible metrics endpoint
   */
  public async getPrometheusMetrics(req: Request, res: Response): Promise<void> {
    try {
      const prometheusMetrics = await this.metricsService.getPrometheusMetrics();
      
      res.set('Content-Type', 'text/plain; version=0.0.4; charset=utf-8');
      res.status(200).send(prometheusMetrics);
    } catch (error) {
      logger.error('Prometheus metrics collection failed:', error);
      res.status(500).send('# Metrics collection service unavailable\n');
    }
  }

  /**
   * Service-specific health checks
   */
  public async getServiceHealth(req: Request, res: Response): Promise<void> {
    try {
      const { serviceName } = req.params;
      
      if (!serviceName) {
        res.status(400).json({
          error: 'Service name is required',
          timestamp: new Date().toISOString()
        });
        return;
      }

      const serviceHealth = await this.healthService.getServiceHealth(serviceName);
      
      if (!serviceHealth) {
        res.status(404).json({
          error: `Service '${serviceName}' not found`,
          timestamp: new Date().toISOString()
        });
        return;
      }

      const statusCode = serviceHealth.status === 'healthy' ? 200 : 503;
      
      res.status(statusCode).json({
        service: serviceName,
        status: serviceHealth.status,
        timestamp: new Date().toISOString(),
        details: serviceHealth.details,
        lastCheck: serviceHealth.lastCheck,
        responseTime: serviceHealth.responseTime
      });
    } catch (error) {
      logger.error(`Service health check failed for ${req.params.serviceName}:`, error);
      res.status(500).json({
        error: 'Service health check failed',
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Database connection health
   */
  public async getDatabaseHealth(req: Request, res: Response): Promise<void> {
    try {
      const dbHealth = await this.healthService.getDatabaseHealth();
      
      const statusCode = dbHealth.allHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        status: dbHealth.allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        databases: dbHealth.databases
      });
    } catch (error) {
      logger.error('Database health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'Database health check service unavailable'
      });
    }
  }

  /**
   * External dependencies health
   */
  public async getExternalDependenciesHealth(req: Request, res: Response): Promise<void> {
    try {
      const externalHealth = await this.healthService.getExternalDependenciesHealth();
      
      const statusCode = externalHealth.allHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        status: externalHealth.allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        dependencies: externalHealth.dependencies
      });
    } catch (error) {
      logger.error('External dependencies health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'External dependencies health check service unavailable'
      });
    }
  }

  /**
   * AI services health check
   */
  public async getAIServicesHealth(req: Request, res: Response): Promise<void> {
    try {
      const aiHealth = await this.healthService.getAIServicesHealth();
      
      const statusCode = aiHealth.allHealthy ? 200 : 503;
      
      res.status(statusCode).json({
        status: aiHealth.allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services: aiHealth.services,
        fallbackStatus: aiHealth.fallbackStatus
      });
    } catch (error) {
      logger.error('AI services health check failed:', error);
      res.status(503).json({
        status: 'error',
        timestamp: new Date().toISOString(),
        error: 'AI services health check unavailable'
      });
    }
  }
}