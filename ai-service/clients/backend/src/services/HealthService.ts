import { Pool } from 'pg';
import Redis from 'redis';
import axios from 'axios';
import { logger } from '../utils/logger';
import { SuperOpsService } from './SuperOpsService';
import { NotificationService } from './NotificationService';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  services: ServiceHealth[];
}

interface DetailedHealthStatus extends HealthStatus {
  dependencies: DependencyHealth[];
}

interface ServiceHealth {
  name: string;
  status: 'healthy' | 'unhealthy' | 'degraded';
  details?: any;
  lastCheck: Date;
  responseTime?: number;
}

interface DependencyHealth {
  name: string;
  type: 'database' | 'cache' | 'external_api' | 'ai_service';
  status: 'healthy' | 'unhealthy' | 'degraded';
  url?: string;
  responseTime?: number;
  error?: string;
  lastCheck: Date;
}

interface ReadinessStatus {
  ready: boolean;
  checks: ReadinessCheck[];
  failedChecks?: string[];
}

interface ReadinessCheck {
  name: string;
  status: 'pass' | 'fail';
  details?: string;
}

interface LivenessStatus {
  alive: boolean;
  reason?: string;
}

export class HealthService {
  private pgPool: Pool;
  private redisClient: any;
  private superOpsService: SuperOpsService;
  private notificationService: NotificationService;
  private healthChecks: Map<string, () => Promise<ServiceHealth>>;

  constructor() {
    this.pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 1 // Minimal pool for health checks
    });

    this.redisClient = Redis.createClient({
      url: process.env.REDIS_URL
    });

    this.superOpsService = new SuperOpsService();
    this.notificationService = new NotificationService();

    this.initializeHealthChecks();
  }

  private initializeHealthChecks(): void {
    this.healthChecks = new Map([
      ['database', this.checkDatabaseHealth.bind(this)],
      ['redis', this.checkRedisHealth.bind(this)],
      ['ai_service', this.checkAIServiceHealth.bind(this)],
      ['superops', this.checkSuperOpsHealth.bind(this)],
      ['notification', this.checkNotificationHealth.bind(this)],
      ['openai', this.checkOpenAIHealth.bind(this)]
    ]);
  }

  /**
   * Get overall system health status
   */
  public async getOverallHealth(): Promise<HealthStatus> {
    const services: ServiceHealth[] = [];
    
    for (const [serviceName, healthCheck] of this.healthChecks) {
      try {
        const serviceHealth = await healthCheck();
        services.push(serviceHealth);
      } catch (error) {
        logger.error(`Health check failed for ${serviceName}:`, error);
        services.push({
          name: serviceName,
          status: 'unhealthy',
          details: { error: error instanceof Error ? error.message : 'Unknown error' },
          lastCheck: new Date()
        });
      }
    }

    const overallStatus = this.determineOverallStatus(services);

    return {
      status: overallStatus,
      services
    };
  }

  /**
   * Get detailed health status including dependencies
   */
  public async getDetailedHealth(): Promise<DetailedHealthStatus> {
    const basicHealth = await this.getOverallHealth();
    const dependencies = await this.checkAllDependencies();

    return {
      ...basicHealth,
      dependencies
    };
  }

  /**
   * Check if the application is ready to serve traffic
   */
  public async getReadinessStatus(): Promise<ReadinessStatus> {
    const checks: ReadinessCheck[] = [];
    const failedChecks: string[] = [];

    // Database connectivity
    try {
      await this.pgPool.query('SELECT 1');
      checks.push({ name: 'database', status: 'pass' });
    } catch (error) {
      checks.push({ 
        name: 'database', 
        status: 'fail', 
        details: error instanceof Error ? error.message : 'Database connection failed' 
      });
      failedChecks.push('database');
    }

    // Redis connectivity
    try {
      await this.redisClient.ping();
      checks.push({ name: 'redis', status: 'pass' });
    } catch (error) {
      checks.push({ 
        name: 'redis', 
        status: 'fail', 
        details: error instanceof Error ? error.message : 'Redis connection failed' 
      });
      failedChecks.push('redis');
    }

    // Essential configuration
    const requiredEnvVars = ['DATABASE_URL', 'REDIS_URL', 'JWT_SECRET'];
    for (const envVar of requiredEnvVars) {
      if (process.env[envVar]) {
        checks.push({ name: `config_${envVar.toLowerCase()}`, status: 'pass' });
      } else {
        checks.push({ 
          name: `config_${envVar.toLowerCase()}`, 
          status: 'fail', 
          details: `Missing required environment variable: ${envVar}` 
        });
        failedChecks.push(`config_${envVar.toLowerCase()}`);
      }
    }

    return {
      ready: failedChecks.length === 0,
      checks,
      failedChecks: failedChecks.length > 0 ? failedChecks : undefined
    };
  }

  /**
   * Check if the application is alive (basic liveness probe)
   */
  public async getLivenessStatus(): Promise<LivenessStatus> {
    try {
      // Basic memory check
      const memUsage = process.memoryUsage();
      const maxMemory = 1024 * 1024 * 1024; // 1GB threshold
      
      if (memUsage.heapUsed > maxMemory) {
        return {
          alive: false,
          reason: 'Memory usage exceeds threshold'
        };
      }

      // Check if event loop is responsive
      const start = Date.now();
      await new Promise(resolve => setImmediate(resolve));
      const eventLoopDelay = Date.now() - start;
      
      if (eventLoopDelay > 1000) { // 1 second threshold
        return {
          alive: false,
          reason: 'Event loop delay exceeds threshold'
        };
      }

      return { alive: true };
    } catch (error) {
      return {
        alive: false,
        reason: error instanceof Error ? error.message : 'Liveness check failed'
      };
    }
  }

  /**
   * Get health status for a specific service
   */
  public async getServiceHealth(serviceName: string): Promise<ServiceHealth | null> {
    const healthCheck = this.healthChecks.get(serviceName);
    
    if (!healthCheck) {
      return null;
    }

    try {
      return await healthCheck();
    } catch (error) {
      logger.error(`Health check failed for ${serviceName}:`, error);
      return {
        name: serviceName,
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        lastCheck: new Date()
      };
    }
  }

  /**
   * Get database health status
   */
  public async getDatabaseHealth(): Promise<{ allHealthy: boolean; databases: DependencyHealth[] }> {
    const databases: DependencyHealth[] = [];

    // PostgreSQL health check
    const pgStart = Date.now();
    try {
      await this.pgPool.query('SELECT version()');
      databases.push({
        name: 'PostgreSQL',
        type: 'database',
        status: 'healthy',
        responseTime: Date.now() - pgStart,
        lastCheck: new Date()
      });
    } catch (error) {
      databases.push({
        name: 'PostgreSQL',
        type: 'database',
        status: 'unhealthy',
        error: error instanceof Error ? error.message : 'Connection failed',
        lastCheck: new Date()
      });
    }

    // DynamoDB health check (if configured)
    if (process.env.AWS_REGION) {
      const dynamoStart = Date.now();
      try {
        // Simple DynamoDB health check would go here
        databases.push({
          name: 'DynamoDB',
          type: 'database',
          status: 'healthy',
          responseTime: Date.now() - dynamoStart,
          lastCheck: new Date()
        });
      } catch (error) {
        databases.push({
          name: 'DynamoDB',
          type: 'database',
          status: 'unhealthy',
          error: error instanceof Error ? error.message : 'Connection failed',
          lastCheck: new Date()
        });
      }
    }

    return {
      allHealthy: databases.every(db => db.status === 'healthy'),
      databases
    };
  }

  /**
   * Get external dependencies health status
   */
  public async getExternalDependenciesHealth(): Promise<{ allHealthy: boolean; dependencies: DependencyHealth[] }> {
    const dependencies: DependencyHealth[] = [];

    // SuperOps API health
    const superOpsStart = Date.now();
    try {
      const isAuthenticated = await this.superOpsService.authenticate();
      dependencies.push({
        name: 'SuperOps API',
        type: 'external_api',
        status: isAuthenticated ? 'healthy' : 'unhealthy',
        url: process.env.SUPEROPS_API_URL,
        responseTime: Date.now() - superOpsStart,
        lastCheck: new Date()
      });
    } catch (error) {
      dependencies.push({
        name: 'SuperOps API',
        type: 'external_api',
        status: 'unhealthy',
        url: process.env.SUPEROPS_API_URL,
        error: error instanceof Error ? error.message : 'Connection failed',
        lastCheck: new Date()
      });
    }

    // Slack API health
    if (process.env.SLACK_BOT_TOKEN) {
      const slackStart = Date.now();
      try {
        const response = await axios.get('https://slack.com/api/auth.test', {
          headers: { Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}` },
          timeout: 5000
        });
        
        dependencies.push({
          name: 'Slack API',
          type: 'external_api',
          status: response.data.ok ? 'healthy' : 'unhealthy',
          url: 'https://slack.com/api',
          responseTime: Date.now() - slackStart,
          lastCheck: new Date()
        });
      } catch (error) {
        dependencies.push({
          name: 'Slack API',
          type: 'external_api',
          status: 'unhealthy',
          url: 'https://slack.com/api',
          error: error instanceof Error ? error.message : 'Connection failed',
          lastCheck: new Date()
        });
      }
    }

    return {
      allHealthy: dependencies.every(dep => dep.status === 'healthy'),
      dependencies
    };
  }

  /**
   * Get AI services health status
   */
  public async getAIServicesHealth(): Promise<{ allHealthy: boolean; services: DependencyHealth[]; fallbackStatus: string }> {
    const services: DependencyHealth[] = [];

    // AI Service health
    const aiServiceStart = Date.now();
    try {
      const response = await axios.get(`${process.env.AI_SERVICE_URL}/health`, {
        timeout: 5000
      });
      
      services.push({
        name: 'AI Processing Service',
        type: 'ai_service',
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        url: process.env.AI_SERVICE_URL,
        responseTime: Date.now() - aiServiceStart,
        lastCheck: new Date()
      });
    } catch (error) {
      services.push({
        name: 'AI Processing Service',
        type: 'ai_service',
        status: 'unhealthy',
        url: process.env.AI_SERVICE_URL,
        error: error instanceof Error ? error.message : 'Connection failed',
        lastCheck: new Date()
      });
    }

    // OpenAI API health
    if (process.env.OPENAI_API_KEY) {
      const openaiStart = Date.now();
      try {
        const response = await axios.get('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
          timeout: 10000
        });
        
        services.push({
          name: 'OpenAI API',
          type: 'ai_service',
          status: response.status === 200 ? 'healthy' : 'unhealthy',
          url: 'https://api.openai.com',
          responseTime: Date.now() - openaiStart,
          lastCheck: new Date()
        });
      } catch (error) {
        services.push({
          name: 'OpenAI API',
          type: 'ai_service',
          status: 'unhealthy',
          url: 'https://api.openai.com',
          error: error instanceof Error ? error.message : 'Connection failed',
          lastCheck: new Date()
        });
      }
    }

    const allHealthy = services.every(service => service.status === 'healthy');
    const fallbackStatus = allHealthy ? 'not_needed' : 'active';

    return {
      allHealthy,
      services,
      fallbackStatus
    };
  }

  // Private helper methods

  private async checkDatabaseHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const result = await this.pgPool.query('SELECT NOW() as current_time');
      return {
        name: 'database',
        status: 'healthy',
        details: { 
          currentTime: result.rows[0].current_time,
          connectionCount: this.pgPool.totalCount
        },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'database',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    }
  }

  private async checkRedisHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const pong = await this.redisClient.ping();
      return {
        name: 'redis',
        status: pong === 'PONG' ? 'healthy' : 'unhealthy',
        details: { response: pong },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'redis',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    }
  }

  private async checkAIServiceHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const response = await axios.get(`${process.env.AI_SERVICE_URL}/health`, {
        timeout: 5000
      });
      
      return {
        name: 'ai_service',
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        details: response.data,
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'ai_service',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    }
  }

  private async checkSuperOpsHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      const isAuthenticated = await this.superOpsService.authenticate();
      return {
        name: 'superops',
        status: isAuthenticated ? 'healthy' : 'degraded',
        details: { authenticated: isAuthenticated },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'superops',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    }
  }

  private async checkNotificationHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      // Test notification service connectivity
      const testResult = await this.notificationService.testConnectivity();
      return {
        name: 'notification',
        status: testResult.allChannelsHealthy ? 'healthy' : 'degraded',
        details: testResult,
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'notification',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    }
  }

  private async checkOpenAIHealth(): Promise<ServiceHealth> {
    const start = Date.now();
    try {
      if (!process.env.OPENAI_API_KEY) {
        return {
          name: 'openai',
          status: 'degraded',
          details: { error: 'API key not configured' },
          lastCheck: new Date(),
          responseTime: Date.now() - start
        };
      }

      const response = await axios.get('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        timeout: 10000
      });
      
      return {
        name: 'openai',
        status: response.status === 200 ? 'healthy' : 'unhealthy',
        details: { modelsCount: response.data.data?.length || 0 },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    } catch (error) {
      return {
        name: 'openai',
        status: 'unhealthy',
        details: { error: error instanceof Error ? error.message : 'Unknown error' },
        lastCheck: new Date(),
        responseTime: Date.now() - start
      };
    }
  }

  private async checkAllDependencies(): Promise<DependencyHealth[]> {
    const dependencies: DependencyHealth[] = [];
    
    // Add database dependencies
    const dbHealth = await this.getDatabaseHealth();
    dependencies.push(...dbHealth.databases);
    
    // Add external dependencies
    const externalHealth = await this.getExternalDependenciesHealth();
    dependencies.push(...externalHealth.dependencies);
    
    // Add AI service dependencies
    const aiHealth = await this.getAIServicesHealth();
    dependencies.push(...aiHealth.services);
    
    return dependencies;
  }

  private determineOverallStatus(services: ServiceHealth[]): 'healthy' | 'unhealthy' | 'degraded' {
    const unhealthyServices = services.filter(s => s.status === 'unhealthy');
    const degradedServices = services.filter(s => s.status === 'degraded');
    
    if (unhealthyServices.length > 0) {
      // If critical services are unhealthy, system is unhealthy
      const criticalServices = ['database', 'redis'];
      const criticalUnhealthy = unhealthyServices.some(s => criticalServices.includes(s.name));
      
      if (criticalUnhealthy) {
        return 'unhealthy';
      }
      
      // If only non-critical services are unhealthy, system is degraded
      return 'degraded';
    }
    
    if (degradedServices.length > 0) {
      return 'degraded';
    }
    
    return 'healthy';
  }
}