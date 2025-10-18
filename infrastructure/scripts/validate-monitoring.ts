#!/usr/bin/env node

/**
 * Monitoring validation script
 * Validates that all monitoring components are properly configured and working
 */

import { CloudWatch, SNS, CloudWatchLogs } from 'aws-sdk';
import { HealthCheckService, AWSHealthChecks } from '../lib/health-check';

interface ValidationResult {
  component: string;
  status: 'PASS' | 'FAIL' | 'WARNING';
  message: string;
  details?: any;
}

class MonitoringValidator {
  private cloudWatch: CloudWatch;
  private sns: SNS;
  private logs: CloudWatchLogs;
  private region: string;

  constructor(region: string = 'us-east-1') {
    this.region = region;
    this.cloudWatch = new CloudWatch({ region });
    this.sns = new SNS({ region });
    this.logs = new CloudWatchLogs({ region });
  }

  /**
   * Run all validation checks
   */
  async validateAll(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    console.log('🔍 Starting monitoring validation...\n');

    // Validate CloudWatch Dashboard
    results.push(await this.validateDashboard());

    // Validate SNS Topics
    results.push(...await this.validateSNSTopics());

    // Validate CloudWatch Alarms
    results.push(...await this.validateAlarms());

    // Validate Log Groups
    results.push(...await this.validateLogGroups());

    // Validate Log Insights Queries
    results.push(...await this.validateLogInsights());

    // Validate Health Checks
    results.push(...await this.validateHealthChecks());

    // Validate Metrics Publishing
    results.push(await this.validateMetricsPublishing());

    return results;
  }

  /**
   * Validate CloudWatch Dashboard exists and is accessible
   */
  private async validateDashboard(): Promise<ValidationResult> {
    try {
      const dashboards = await this.cloudWatch.listDashboards().promise();
      const aiTicketDashboard = dashboards.DashboardEntries?.find(
        d => d.DashboardName === 'AI-Ticket-Management-Production'
      );

      if (aiTicketDashboard) {
        return {
          component: 'CloudWatch Dashboard',
          status: 'PASS',
          message: 'Dashboard exists and is accessible',
          details: { dashboardName: aiTicketDashboard.DashboardName },
        };
      } else {
        return {
          component: 'CloudWatch Dashboard',
          status: 'FAIL',
          message: 'AI Ticket Management dashboard not found',
        };
      }
    } catch (error) {
      return {
        component: 'CloudWatch Dashboard',
        status: 'FAIL',
        message: `Failed to validate dashboard: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Validate SNS topics for alerting
   */
  private async validateSNSTopics(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const expectedTopics = [
      'ai-ticket-management-alerts',
      'ai-ticket-critical-alerts',
      'ai-ticket-warning-alerts',
      'ai-ticket-info-alerts',
    ];

    try {
      const topics = await this.sns.listTopics().promise();
      const topicArns = topics.Topics?.map(t => t.TopicArn) || [];

      for (const expectedTopic of expectedTopics) {
        const found = topicArns.some(arn => arn?.includes(expectedTopic));
        
        if (found) {
          // Validate subscriptions
          const topicArn = topicArns.find(arn => arn?.includes(expectedTopic));
          const subscriptions = await this.sns.listSubscriptionsByTopic({
            TopicArn: topicArn!,
          }).promise();

          results.push({
            component: `SNS Topic: ${expectedTopic}`,
            status: 'PASS',
            message: `Topic exists with ${subscriptions.Subscriptions?.length || 0} subscriptions`,
            details: {
              topicArn,
              subscriptionCount: subscriptions.Subscriptions?.length || 0,
            },
          });
        } else {
          results.push({
            component: `SNS Topic: ${expectedTopic}`,
            status: 'FAIL',
            message: 'Topic not found',
          });
        }
      }
    } catch (error) {
      results.push({
        component: 'SNS Topics',
        status: 'FAIL',
        message: `Failed to validate SNS topics: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  /**
   * Validate CloudWatch Alarms
   */
  private async validateAlarms(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const expectedAlarms = [
      'AI-Ticket-API-High-Error-Rate',
      'AI-Ticket-API-High-Latency',
      'AI-Ticket-Lambda-High-Error-Rate',
      'AI-Ticket-Lambda-High-Duration',
      'AI-Ticket-DynamoDB-Read-Throttles',
      'AI-Ticket-DynamoDB-Write-Throttles',
      'AI-Ticket-RDS-High-CPU',
      'AI-Ticket-System-Health-Critical',
    ];

    try {
      const alarms = await this.cloudWatch.describeAlarms().promise();
      const alarmNames = alarms.MetricAlarms?.map(a => a.AlarmName) || [];

      for (const expectedAlarm of expectedAlarms) {
        const alarm = alarms.MetricAlarms?.find(a => a.AlarmName === expectedAlarm);
        
        if (alarm) {
          const hasActions = (alarm.AlarmActions?.length || 0) > 0;
          results.push({
            component: `Alarm: ${expectedAlarm}`,
            status: hasActions ? 'PASS' : 'WARNING',
            message: hasActions 
              ? `Alarm configured with ${alarm.AlarmActions?.length} actions`
              : 'Alarm exists but has no actions configured',
            details: {
              state: alarm.StateValue,
              actionsEnabled: alarm.ActionsEnabled,
              actionCount: alarm.AlarmActions?.length || 0,
            },
          });
        } else {
          results.push({
            component: `Alarm: ${expectedAlarm}`,
            status: 'FAIL',
            message: 'Alarm not found',
          });
        }
      }
    } catch (error) {
      results.push({
        component: 'CloudWatch Alarms',
        status: 'FAIL',
        message: `Failed to validate alarms: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  /**
   * Validate Log Groups
   */
  private async validateLogGroups(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const expectedLogGroups = [
      '/aws/lambda/ai-ticket-management-api',
      '/aws/lambda/ai-ticket-management-ai-service',
      '/aws/lambda/ai-ticket-management-integration',
    ];

    try {
      for (const expectedLogGroup of expectedLogGroups) {
        try {
          const logGroup = await this.logs.describeLogGroups({
            logGroupNamePrefix: expectedLogGroup,
          }).promise();

          if (logGroup.logGroups && logGroup.logGroups.length > 0) {
            const group = logGroup.logGroups[0];
            results.push({
              component: `Log Group: ${expectedLogGroup}`,
              status: 'PASS',
              message: 'Log group exists and is accessible',
              details: {
                retentionInDays: group.retentionInDays,
                storedBytes: group.storedBytes,
              },
            });
          } else {
            results.push({
              component: `Log Group: ${expectedLogGroup}`,
              status: 'WARNING',
              message: 'Log group not found (may be created when Lambda functions are deployed)',
            });
          }
        } catch (error) {
          results.push({
            component: `Log Group: ${expectedLogGroup}`,
            status: 'WARNING',
            message: 'Log group not accessible (may not exist yet)',
          });
        }
      }
    } catch (error) {
      results.push({
        component: 'Log Groups',
        status: 'FAIL',
        message: `Failed to validate log groups: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  /**
   * Validate Log Insights Queries
   */
  private async validateLogInsights(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];
    const expectedQueries = [
      'AI-Ticket-Error-Analysis',
      'AI-Ticket-Performance-Analysis',
    ];

    try {
      const queries = await this.logs.describeQueryDefinitions().promise();
      const queryNames = queries.queryDefinitions?.map(q => q.name) || [];

      for (const expectedQuery of expectedQueries) {
        const found = queryNames.includes(expectedQuery);
        
        results.push({
          component: `Log Insights Query: ${expectedQuery}`,
          status: found ? 'PASS' : 'FAIL',
          message: found ? 'Query definition exists' : 'Query definition not found',
        });
      }
    } catch (error) {
      results.push({
        component: 'Log Insights Queries',
        status: 'FAIL',
        message: `Failed to validate queries: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  /**
   * Validate Health Checks
   */
  private async validateHealthChecks(): Promise<ValidationResult[]> {
    const results: ValidationResult[] = [];

    try {
      const healthService = new HealthCheckService();
      
      // Register sample health checks
      healthService.registerCheck(AWSHealthChecks.dynamoDBCheck('ai-ticket-tickets', this.region));
      healthService.registerCheck(AWSHealthChecks.s3Check(`ai-ticket-files-123456789012-${this.region}`, this.region));

      const healthResult = await healthService.runHealthChecks();

      results.push({
        component: 'Health Check Service',
        status: healthResult.status === 'HEALTHY' ? 'PASS' : 'WARNING',
        message: `Health check completed with status: ${healthResult.status}`,
        details: {
          overallStatus: healthResult.status,
          responseTime: healthResult.overallResponseTime,
          checkCount: Object.keys(healthResult.checks).length,
        },
      });

      // Validate individual checks
      for (const [checkName, checkResult] of Object.entries(healthResult.checks)) {
        results.push({
          component: `Health Check: ${checkName}`,
          status: checkResult.status === 'HEALTHY' ? 'PASS' : 'WARNING',
          message: checkResult.error || `Check completed in ${checkResult.responseTime}ms`,
          details: checkResult,
        });
      }
    } catch (error) {
      results.push({
        component: 'Health Check Service',
        status: 'FAIL',
        message: `Failed to validate health checks: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    return results;
  }

  /**
   * Validate Metrics Publishing
   */
  private async validateMetricsPublishing(): Promise<ValidationResult> {
    try {
      // Try to publish a test metric
      await this.cloudWatch.putMetricData({
        Namespace: 'AiTicketManagement/Test',
        MetricData: [{
          MetricName: 'ValidationTest',
          Value: 1,
          Unit: 'Count',
          Timestamp: new Date(),
        }],
      }).promise();

      return {
        component: 'Metrics Publishing',
        status: 'PASS',
        message: 'Successfully published test metric to CloudWatch',
      };
    } catch (error) {
      return {
        component: 'Metrics Publishing',
        status: 'FAIL',
        message: `Failed to publish test metric: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Print validation results
   */
  printResults(results: ValidationResult[]): void {
    console.log('\n📊 Monitoring Validation Results\n');
    console.log('='.repeat(80));

    const passed = results.filter(r => r.status === 'PASS').length;
    const warnings = results.filter(r => r.status === 'WARNING').length;
    const failed = results.filter(r => r.status === 'FAIL').length;

    for (const result of results) {
      const icon = result.status === 'PASS' ? '✅' : 
                   result.status === 'WARNING' ? '⚠️' : '❌';
      
      console.log(`${icon} ${result.component}`);
      console.log(`   ${result.message}`);
      
      if (result.details) {
        console.log(`   Details: ${JSON.stringify(result.details, null, 2)}`);
      }
      console.log();
    }

    console.log('='.repeat(80));
    console.log(`Summary: ${passed} passed, ${warnings} warnings, ${failed} failed`);
    
    if (failed > 0) {
      console.log('\n❌ Monitoring validation failed. Please fix the issues above.');
      process.exit(1);
    } else if (warnings > 0) {
      console.log('\n⚠️  Monitoring validation completed with warnings.');
    } else {
      console.log('\n✅ All monitoring components validated successfully!');
    }
  }
}

// Run validation if called directly
if (require.main === module) {
  const validator = new MonitoringValidator();
  
  validator.validateAll()
    .then(results => {
      validator.printResults(results);
    })
    .catch(error => {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    });
}

export { MonitoringValidator };