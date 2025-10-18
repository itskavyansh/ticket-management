import * as cdk from 'aws-cdk-lib';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

/**
 * Alert severity levels with escalation rules
 */
export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

/**
 * Alert channel configuration
 */
export interface AlertChannel {
  name: string;
  type: 'email' | 'slack' | 'teams' | 'pagerduty' | 'webhook';
  config: {
    endpoint?: string;
    recipients?: string[];
    webhookUrl?: string;
    apiKey?: string;
  };
  severityLevels: AlertSeverity[];
  enabled: boolean;
}

/**
 * Escalation rule configuration
 */
export interface EscalationRule {
  name: string;
  triggerAfterMinutes: number;
  channels: string[];
  condition: 'any_alarm' | 'multiple_alarms' | 'composite_alarm';
}

/**
 * Alerting configuration class
 */
export class AlertingConfig extends Construct {
  public readonly criticalTopic: sns.Topic;
  public readonly warningTopic: sns.Topic;
  public readonly infoTopic: sns.Topic;
  public readonly alertProcessor: lambda.Function;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // Create SNS topics for different severity levels
    this.criticalTopic = new sns.Topic(this, 'CriticalAlerts', {
      topicName: 'ai-ticket-critical-alerts',
      displayName: 'AI Ticket Management - Critical Alerts',
    });

    this.warningTopic = new sns.Topic(this, 'WarningAlerts', {
      topicName: 'ai-ticket-warning-alerts',
      displayName: 'AI Ticket Management - Warning Alerts',
    });

    this.infoTopic = new sns.Topic(this, 'InfoAlerts', {
      topicName: 'ai-ticket-info-alerts',
      displayName: 'AI Ticket Management - Info Alerts',
    });

    // Create alert processing Lambda function
    this.alertProcessor = this.createAlertProcessor();

    // Set up default subscriptions
    this.setupDefaultSubscriptions();
  }

  /**
   * Create the alert processing Lambda function
   */
  private createAlertProcessor(): lambda.Function {
    const alertProcessorRole = new iam.Role(this, 'AlertProcessorRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
      inlinePolicies: {
        AlertProcessorPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                'sns:Publish',
                'ssm:GetParameter',
                'ssm:GetParameters',
                'secretsmanager:GetSecretValue',
              ],
              resources: ['*'],
            }),
          ],
        }),
      },
    });

    return new lambda.Function(this, 'AlertProcessor', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      role: alertProcessorRole,
      timeout: cdk.Duration.minutes(5),
      environment: {
        CRITICAL_TOPIC_ARN: this.criticalTopic.topicArn,
        WARNING_TOPIC_ARN: this.warningTopic.topicArn,
        INFO_TOPIC_ARN: this.infoTopic.topicArn,
      },
      code: lambda.Code.fromInline(`
        const AWS = require('aws-sdk');
        const sns = new AWS.SNS();
        const ssm = new AWS.SSM();

        exports.handler = async (event) => {
          console.log('Processing alert:', JSON.stringify(event, null, 2));
          
          try {
            // Parse CloudWatch alarm from SNS message
            const message = JSON.parse(event.Records[0].Sns.Message);
            const alarmName = message.AlarmName;
            const newState = message.NewStateValue;
            const reason = message.NewStateReason;
            const timestamp = message.StateChangeTime;
            
            // Determine severity based on alarm name patterns
            let severity = 'INFO';
            let topicArn = process.env.INFO_TOPIC_ARN;
            
            if (alarmName.includes('Critical') || alarmName.includes('System-Health')) {
              severity = 'CRITICAL';
              topicArn = process.env.CRITICAL_TOPIC_ARN;
            } else if (alarmName.includes('High') || alarmName.includes('Error')) {
              severity = 'HIGH';
              topicArn = process.env.WARNING_TOPIC_ARN;
            }
            
            // Create enhanced alert message
            const alertMessage = {
              severity,
              alarmName,
              state: newState,
              reason,
              timestamp,
              service: 'AI Ticket Management',
              environment: process.env.ENVIRONMENT || 'production',
              runbook: getRunbookUrl(alarmName),
              dashboardUrl: getDashboardUrl(),
            };
            
            // Send to appropriate channels based on severity
            if (newState === 'ALARM') {
              await sendToSlack(alertMessage);
              await sendToTeams(alertMessage);
              
              if (severity === 'CRITICAL') {
                await sendToPagerDuty(alertMessage);
              }
            }
            
            // Publish to SNS topic for further processing
            await sns.publish({
              TopicArn: topicArn,
              Message: JSON.stringify(alertMessage, null, 2),
              Subject: \`[\${severity}] \${alarmName} - \${newState}\`,
            }).promise();
            
            return { statusCode: 200, body: 'Alert processed successfully' };
            
          } catch (error) {
            console.error('Error processing alert:', error);
            throw error;
          }
        };
        
        async function sendToSlack(alert) {
          try {
            const webhookUrl = await getParameter('/ai-ticket/alerts/slack-webhook');
            if (!webhookUrl) return;
            
            const color = alert.severity === 'CRITICAL' ? 'danger' : 
                         alert.severity === 'HIGH' ? 'warning' : 'good';
            
            const payload = {
              channel: '#alerts-production',
              username: 'AI Ticket Alerts',
              icon_emoji: ':rotating_light:',
              attachments: [{
                color,
                title: \`[\${alert.severity}] \${alert.alarmName}\`,
                text: alert.reason,
                fields: [
                  { title: 'State', value: alert.state, short: true },
                  { title: 'Service', value: alert.service, short: true },
                  { title: 'Environment', value: alert.environment, short: true },
                  { title: 'Time', value: alert.timestamp, short: true },
                ],
                actions: [
                  {
                    type: 'button',
                    text: 'View Dashboard',
                    url: alert.dashboardUrl,
                  },
                  {
                    type: 'button',
                    text: 'Runbook',
                    url: alert.runbook,
                  },
                ],
              }],
            };
            
            const https = require('https');
            const { URL } = require('url');
            const url = new URL(webhookUrl);
            
            return new Promise((resolve, reject) => {
              const req = https.request({
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              }, (res) => {
                resolve(res.statusCode);
              });
              
              req.on('error', reject);
              req.write(JSON.stringify(payload));
              req.end();
            });
            
          } catch (error) {
            console.error('Failed to send Slack notification:', error);
          }
        }
        
        async function sendToTeams(alert) {
          try {
            const webhookUrl = await getParameter('/ai-ticket/alerts/teams-webhook');
            if (!webhookUrl) return;
            
            const color = alert.severity === 'CRITICAL' ? 'FF0000' : 
                         alert.severity === 'HIGH' ? 'FFA500' : '00FF00';
            
            const payload = {
              '@type': 'MessageCard',
              '@context': 'https://schema.org/extensions',
              summary: \`[\${alert.severity}] \${alert.alarmName}\`,
              themeColor: color,
              sections: [{
                activityTitle: \`[\${alert.severity}] \${alert.alarmName}\`,
                activitySubtitle: alert.reason,
                facts: [
                  { name: 'State', value: alert.state },
                  { name: 'Service', value: alert.service },
                  { name: 'Environment', value: alert.environment },
                  { name: 'Time', value: alert.timestamp },
                ],
              }],
              potentialAction: [{
                '@type': 'OpenUri',
                name: 'View Dashboard',
                targets: [{ os: 'default', uri: alert.dashboardUrl }],
              }],
            };
            
            const https = require('https');
            const { URL } = require('url');
            const url = new URL(webhookUrl);
            
            return new Promise((resolve, reject) => {
              const req = https.request({
                hostname: url.hostname,
                path: url.pathname,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              }, (res) => {
                resolve(res.statusCode);
              });
              
              req.on('error', reject);
              req.write(JSON.stringify(payload));
              req.end();
            });
            
          } catch (error) {
            console.error('Failed to send Teams notification:', error);
          }
        }
        
        async function sendToPagerDuty(alert) {
          try {
            const integrationKey = await getParameter('/ai-ticket/alerts/pagerduty-key');
            if (!integrationKey) return;
            
            const payload = {
              routing_key: integrationKey,
              event_action: 'trigger',
              payload: {
                summary: \`[\${alert.severity}] \${alert.alarmName}\`,
                source: alert.service,
                severity: alert.severity.toLowerCase(),
                timestamp: alert.timestamp,
                custom_details: {
                  alarm_name: alert.alarmName,
                  reason: alert.reason,
                  environment: alert.environment,
                  dashboard_url: alert.dashboardUrl,
                  runbook_url: alert.runbook,
                },
              },
            };
            
            const https = require('https');
            
            return new Promise((resolve, reject) => {
              const req = https.request({
                hostname: 'events.pagerduty.com',
                path: '/v2/enqueue',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
              }, (res) => {
                resolve(res.statusCode);
              });
              
              req.on('error', reject);
              req.write(JSON.stringify(payload));
              req.end();
            });
            
          } catch (error) {
            console.error('Failed to send PagerDuty notification:', error);
          }
        }
        
        async function getParameter(name) {
          try {
            const result = await ssm.getParameter({ Name: name }).promise();
            return result.Parameter.Value;
          } catch (error) {
            console.log(\`Parameter \${name} not found\`);
            return null;
          }
        }
        
        function getRunbookUrl(alarmName) {
          const baseUrl = 'https://wiki.company.com/runbooks/ai-ticket-management';
          const runbookMap = {
            'API-High-Error-Rate': \`\${baseUrl}/api-errors\`,
            'Lambda-High-Error-Rate': \`\${baseUrl}/lambda-errors\`,
            'RDS-High-CPU': \`\${baseUrl}/database-performance\`,
            'DynamoDB-Read-Throttles': \`\${baseUrl}/dynamodb-throttling\`,
            'System-Health-Critical': \`\${baseUrl}/system-health\`,
          };
          
          for (const [pattern, url] of Object.entries(runbookMap)) {
            if (alarmName.includes(pattern)) {
              return url;
            }
          }
          
          return \`\${baseUrl}/general\`;
        }
        
        function getDashboardUrl() {
          const region = process.env.AWS_REGION || 'us-east-1';
          return \`https://\${region}.console.aws.amazon.com/cloudwatch/home?region=\${region}#dashboards:name=AI-Ticket-Management-Production\`;
        }
      `),
    });
  }

  /**
   * Set up default email subscriptions
   */
  private setupDefaultSubscriptions(): void {
    // Critical alerts - immediate notification
    this.criticalTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('admin@company.com')
    );
    this.criticalTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('devops@company.com')
    );

    // Warning alerts - standard notification
    this.warningTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('devops@company.com')
    );

    // Info alerts - low priority notification
    this.infoTopic.addSubscription(
      new snsSubscriptions.EmailSubscription('monitoring@company.com')
    );

    // Subscribe alert processor to all topics
    this.criticalTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(this.alertProcessor)
    );
    this.warningTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(this.alertProcessor)
    );
    this.infoTopic.addSubscription(
      new snsSubscriptions.LambdaSubscription(this.alertProcessor)
    );
  }

  /**
   * Add custom email subscription
   */
  public addEmailSubscription(email: string, severity: AlertSeverity): void {
    const topic = this.getTopicBySeverity(severity);
    topic.addSubscription(new snsSubscriptions.EmailSubscription(email));
  }

  /**
   * Add SMS subscription
   */
  public addSmsSubscription(phoneNumber: string, severity: AlertSeverity): void {
    const topic = this.getTopicBySeverity(severity);
    topic.addSubscription(new snsSubscriptions.SmsSubscription(phoneNumber));
  }

  /**
   * Get SNS topic by severity level
   */
  private getTopicBySeverity(severity: AlertSeverity): sns.Topic {
    switch (severity) {
      case AlertSeverity.CRITICAL:
        return this.criticalTopic;
      case AlertSeverity.HIGH:
      case AlertSeverity.MEDIUM:
        return this.warningTopic;
      case AlertSeverity.LOW:
      default:
        return this.infoTopic;
    }
  }
}