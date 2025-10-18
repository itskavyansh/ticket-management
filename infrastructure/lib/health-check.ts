import { CloudWatch } from 'aws-sdk';
import { MonitoringUtils } from './monitoring-utils';

/**
 * Health check status enum
 */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
}

/**
 * Health check result interface
 */
export interface HealthCheckResult {
  status: HealthStatus;
  timestamp: Date;
  checks: {
    [componentName: string]: {
      status: HealthStatus;
      responseTime?: number;
      error?: string;
      details?: any;
    };
  };
  overallResponseTime: number;
}

/**
 * Individual health check interface
 */
export interface HealthCheck {
  name: string;
  check: () => Promise<{ status: HealthStatus; responseTime?: number; error?: string; details?: any }>;
  timeout?: number;
  critical?: boolean;
}

/**
 * Health check service for monitoring system components
 */
export class HealthCheckService {
  private checks: HealthCheck[] = [];
  private monitoring: MonitoringUtils;

  constructor() {
    this.monitoring = new MonitoringUtils();
  }

  /**
   * Register a health check
   */
  registerCheck(check: HealthCheck): void {
    this.checks.push(check);
  }

  /**
   * Run all health checks and return aggregated result
   */
  async runHealthChecks(): Promise<HealthCheckResult> {
    const startTime = Date.now();
    const result: HealthCheckResult = {
      status: HealthStatus.HEALTHY,
      timestamp: new Date(),
      checks: {},
      overallResponseTime: 0,
    };

    // Run all checks in parallel
    const checkPromises = this.checks.map(async (check) => {
      const checkStartTime = Date.now();
      try {
        const timeout = check.timeout || 5000;
        const checkResult = await Promise.race([
          check.check(),
          new Promise<{ status: HealthStatus; error: string }>((_, reject) =>
            setTimeout(() => reject(new Error('Health check timeout')), timeout)
          ),
        ]);

        const responseTime = Date.now() - checkStartTime;
        
        result.checks[check.name] = {
          ...checkResult,
          responseTime,
        };

        // Publish individual check metrics
        await this.monitoring.publishMetric(
          'HealthCheckStatus',
          checkResult.status === HealthStatus.HEALTHY ? 1 : 0,
          'Count',
          { Component: check.name }
        );

        await this.monitoring.publishMetric(
          'HealthCheckResponseTime',
          responseTime,
          'Milliseconds',
          { Component: check.name }
        );

      } catch (error) {
        const responseTime = Date.now() - checkStartTime;
        result.checks[check.name] = {
          status: HealthStatus.UNHEALTHY,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        };

        // Publish error metrics
        await this.monitoring.publishMetric(
          'HealthCheckStatus',
          0,
          'Count',
          { Component: check.name }
        );
      }
    });

    await Promise.all(checkPromises);

    // Determine overall status
    const checkStatuses = Object.values(result.checks).map(check => check.status);
    const criticalChecks = this.checks.filter(check => check.critical);
    
    if (checkStatuses.includes(HealthStatus.UNHEALTHY)) {
      // Check if any critical checks failed
      const criticalFailures = criticalChecks.some(check => 
        result.checks[check.name]?.status === HealthStatus.UNHEALTHY
      );
      result.status = criticalFailures ? HealthStatus.UNHEALTHY : HealthStatus.DEGRADED;
    } else if (checkStatuses.includes(HealthStatus.DEGRADED)) {
      result.status = HealthStatus.DEGRADED;
    }

    result.overallResponseTime = Date.now() - startTime;

    // Publish overall health metrics
    await this.monitoring.publishMetric(
      'SystemHealthStatus',
      result.status === HealthStatus.HEALTHY ? 1 : 0,
      'Count'
    );

    await this.monitoring.publishMetric(
      'SystemHealthCheckTime',
      result.overallResponseTime,
      'Milliseconds'
    );

    return result;
  }

  /**
   * Create a Lambda handler for health checks
   */
  createLambdaHandler() {
    return async (event: any) => {
      try {
        const healthResult = await this.runHealthChecks();
        
        return {
          statusCode: healthResult.status === HealthStatus.HEALTHY ? 200 : 503,
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'no-cache',
          },
          body: JSON.stringify(healthResult, null, 2),
        };
      } catch (error) {
        return {
          statusCode: 500,
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            status: HealthStatus.UNHEALTHY,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString(),
          }),
        };
      }
    };
  }
}

/**
 * Pre-built health checks for common AWS services
 */
export class AWSHealthChecks {
  /**
   * DynamoDB table health check
   */
  static dynamoDBCheck(tableName: string, region: string = 'us-east-1'): HealthCheck {
    return {
      name: `DynamoDB-${tableName}`,
      critical: true,
      timeout: 3000,
      check: async () => {
        const AWS = require('aws-sdk');
        const dynamodb = new AWS.DynamoDB({ region });
        
        const startTime = Date.now();
        try {
          await dynamodb.describeTable({ TableName: tableName }).promise();
          return {
            status: HealthStatus.HEALTHY,
            responseTime: Date.now() - startTime,
          };
        } catch (error) {
          return {
            status: HealthStatus.UNHEALTHY,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'DynamoDB check failed',
          };
        }
      },
    };
  }

  /**
   * RDS database health check
   */
  static rdsCheck(secretArn: string, region: string = 'us-east-1'): HealthCheck {
    return {
      name: 'RDS-Analytics',
      critical: true,
      timeout: 5000,
      check: async () => {
        const startTime = Date.now();
        try {
          // This would typically use the RDS Data API or a connection pool
          // For now, we'll just check if the secret exists
          const AWS = require('aws-sdk');
          const secretsManager = new AWS.SecretsManager({ region });
          
          await secretsManager.getSecretValue({ SecretId: secretArn }).promise();
          
          return {
            status: HealthStatus.HEALTHY,
            responseTime: Date.now() - startTime,
          };
        } catch (error) {
          return {
            status: HealthStatus.UNHEALTHY,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'RDS check failed',
          };
        }
      },
    };
  }

  /**
   * S3 bucket health check
   */
  static s3Check(bucketName: string, region: string = 'us-east-1'): HealthCheck {
    return {
      name: `S3-${bucketName}`,
      critical: false,
      timeout: 3000,
      check: async () => {
        const AWS = require('aws-sdk');
        const s3 = new AWS.S3({ region });
        
        const startTime = Date.now();
        try {
          await s3.headBucket({ Bucket: bucketName }).promise();
          return {
            status: HealthStatus.HEALTHY,
            responseTime: Date.now() - startTime,
          };
        } catch (error) {
          return {
            status: HealthStatus.UNHEALTHY,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'S3 check failed',
          };
        }
      },
    };
  }

  /**
   * External API health check (e.g., SuperOps, OpenAI)
   */
  static externalApiCheck(
    name: string,
    url: string,
    headers?: { [key: string]: string }
  ): HealthCheck {
    return {
      name: `External-${name}`,
      critical: false,
      timeout: 10000,
      check: async () => {
        const startTime = Date.now();
        try {
          const https = require('https');
          const { URL } = require('url');
          
          return new Promise((resolve) => {
            const parsedUrl = new URL(url);
            const options = {
              hostname: parsedUrl.hostname,
              port: parsedUrl.port || 443,
              path: parsedUrl.pathname,
              method: 'GET',
              headers: headers || {},
            };

            const req = https.request(options, (res: any) => {
              const responseTime = Date.now() - startTime;
              if (res.statusCode >= 200 && res.statusCode < 300) {
                resolve({
                  status: HealthStatus.HEALTHY,
                  responseTime,
                  details: { statusCode: res.statusCode },
                });
              } else {
                resolve({
                  status: HealthStatus.DEGRADED,
                  responseTime,
                  error: `HTTP ${res.statusCode}`,
                  details: { statusCode: res.statusCode },
                });
              }
            });

            req.on('error', (error: Error) => {
              resolve({
                status: HealthStatus.UNHEALTHY,
                responseTime: Date.now() - startTime,
                error: error.message,
              });
            });

            req.setTimeout(8000, () => {
              resolve({
                status: HealthStatus.UNHEALTHY,
                responseTime: Date.now() - startTime,
                error: 'Request timeout',
              });
            });

            req.end();
          });
        } catch (error) {
          return {
            status: HealthStatus.UNHEALTHY,
            responseTime: Date.now() - startTime,
            error: error instanceof Error ? error.message : 'External API check failed',
          };
        }
      },
    };
  }
}