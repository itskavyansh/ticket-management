import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as snsSubscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';
import { AlertingConfig, AlertSeverity } from './alerting-config';

export class AiTicketManagementStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // VPC for RDS and other resources
    const vpc = new ec2.Vpc(this, 'AiTicketVpc', {
      maxAzs: 2,
      natGateways: 1,
    });

    // S3 bucket for file storage
    const filesBucket = new s3.Bucket(this, 'FilesBucket', {
      bucketName: `ai-ticket-files-${this.account}-${this.region}`,
      versioned: true,
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // S3 bucket for frontend hosting
    const frontendBucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: `ai-ticket-frontend-${this.account}-${this.region}`,
      websiteIndexDocument: 'index.html',
      websiteErrorDocument: 'error.html',
      publicReadAccess: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // CloudFront distribution for frontend
    const distribution = new cloudfront.Distribution(this, 'FrontendDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(frontendBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // DynamoDB Tables
    const ticketsTable = new dynamodb.Table(this, 'TicketsTable', {
      tableName: 'ai-ticket-tickets',
      partitionKey: { name: 'customerId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'ticketId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // Add GSI for ticket status queries
    ticketsTable.addGlobalSecondaryIndex({
      indexName: 'StatusIndex',
      partitionKey: { name: 'status', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'createdAt', type: dynamodb.AttributeType.STRING },
    });

    const techniciansTable = new dynamodb.Table(this, 'TechniciansTable', {
      tableName: 'ai-ticket-technicians',
      partitionKey: { name: 'technicianId', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    const timeTrackingTable = new dynamodb.Table(this, 'TimeTrackingTable', {
      tableName: 'ai-ticket-time-tracking',
      partitionKey: { name: 'technicianId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'timestamp', type: dynamodb.AttributeType.STRING },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
      encryption: dynamodb.TableEncryption.AWS_MANAGED,
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // RDS PostgreSQL for analytics
    const analyticsDb = new rds.DatabaseInstance(this, 'AnalyticsDatabase', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: ec2.InstanceType.of(ec2.InstanceClass.T3, ec2.InstanceSize.MICRO),
      vpc,
      credentials: rds.Credentials.fromGeneratedSecret('postgres'),
      multiAz: false, // For development
      allocatedStorage: 20,
      storageEncrypted: true,
      deletionProtection: false, // For development
      removalPolicy: cdk.RemovalPolicy.DESTROY, // For development
    });

    // Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaVPCAccessExecutionRole'),
      ],
    });

    // Grant DynamoDB permissions
    ticketsTable.grantReadWriteData(lambdaRole);
    techniciansTable.grantReadWriteData(lambdaRole);
    timeTrackingTable.grantReadWriteData(lambdaRole);

    // Grant S3 permissions
    filesBucket.grantReadWrite(lambdaRole);

    // Grant RDS permissions
    analyticsDb.grantConnect(lambdaRole);

    // API Gateway
    const api = new apigateway.RestApi(this, 'AiTicketApi', {
      restApiName: 'AI Ticket Management API',
      description: 'API for AI-powered ticket management platform',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: ['Content-Type', 'X-Amz-Date', 'Authorization', 'X-Api-Key'],
      },
    });

    // Placeholder Lambda function (will be replaced with actual implementation)
    const placeholderFunction = new lambda.Function(this, 'PlaceholderFunction', {
      runtime: lambda.Runtime.NODEJS_18_X,
      handler: 'index.handler',
      code: lambda.Code.fromInline(`
        exports.handler = async (event) => {
          return {
            statusCode: 200,
            headers: {
              'Content-Type': 'application/json',
              'Access-Control-Allow-Origin': '*',
            },
            body: JSON.stringify({
              message: 'AI Ticket Management API',
              version: '1.0.0',
              timestamp: new Date().toISOString()
            })
          };
        };
      `),
      role: lambdaRole,
      environment: {
        TICKETS_TABLE: ticketsTable.tableName,
        TECHNICIANS_TABLE: techniciansTable.tableName,
        TIME_TRACKING_TABLE: timeTrackingTable.tableName,
        FILES_BUCKET: filesBucket.bucketName,
        DATABASE_SECRET_ARN: analyticsDb.secret?.secretArn || '',
      },
    });

    // API Gateway integration
    const apiIntegration = new apigateway.LambdaIntegration(placeholderFunction);
    api.root.addMethod('GET', apiIntegration);

    // Health check endpoint
    const healthResource = api.root.addResource('health');
    healthResource.addMethod('GET', apiIntegration);

    // API resources (placeholders for future implementation)
    const apiResource = api.root.addResource('api');
    const ticketsResource = apiResource.addResource('tickets');
    const analyticsResource = apiResource.addResource('analytics');

    ticketsResource.addMethod('GET', apiIntegration);
    ticketsResource.addMethod('POST', apiIntegration);
    analyticsResource.addMethod('GET', apiIntegration);

    // ========================================
    // MONITORING AND ALERTING SETUP
    // ========================================

    // Set up comprehensive alerting configuration
    const alerting = new AlertingConfig(this, 'AlertingConfig');

    // Legacy topic for backward compatibility
    const alertsTopic = alerting.criticalTopic;

    // CloudWatch Log Groups for centralized logging
    const apiLogGroup = new logs.LogGroup(this, 'ApiLogGroup', {
      logGroupName: '/aws/lambda/ai-ticket-management-api',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const aiServiceLogGroup = new logs.LogGroup(this, 'AiServiceLogGroup', {
      logGroupName: '/aws/lambda/ai-ticket-management-ai-service',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    const integrationLogGroup = new logs.LogGroup(this, 'IntegrationLogGroup', {
      logGroupName: '/aws/lambda/ai-ticket-management-integration',
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // Application-level CloudWatch Dashboard
    const dashboard = new cloudwatch.Dashboard(this, 'AiTicketDashboard', {
      dashboardName: 'AI-Ticket-Management-Production',
    });

    // ========================================
    // API GATEWAY MONITORING
    // ========================================

    // API Gateway metrics and alarms
    const apiErrorRateAlarm = new cloudwatch.Alarm(this, 'ApiErrorRateAlarm', {
      alarmName: 'AI-Ticket-API-High-Error-Rate',
      alarmDescription: 'API Gateway error rate is above 5%',
      metric: api.metricClientError({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5,
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiErrorRateAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    const apiLatencyAlarm = new cloudwatch.Alarm(this, 'ApiLatencyAlarm', {
      alarmName: 'AI-Ticket-API-High-Latency',
      alarmDescription: 'API Gateway latency is above 2 seconds',
      metric: api.metricLatency({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 2000, // 2 seconds in milliseconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    apiLatencyAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // ========================================
    // LAMBDA FUNCTION MONITORING
    // ========================================

    // Lambda error rate alarm
    const lambdaErrorAlarm = new cloudwatch.Alarm(this, 'LambdaErrorAlarm', {
      alarmName: 'AI-Ticket-Lambda-High-Error-Rate',
      alarmDescription: 'Lambda function error rate is above 1%',
      metric: placeholderFunction.metricErrors({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 5, // 5 errors in 5 minutes
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lambdaErrorAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    const lambdaDurationAlarm = new cloudwatch.Alarm(this, 'LambdaDurationAlarm', {
      alarmName: 'AI-Ticket-Lambda-High-Duration',
      alarmDescription: 'Lambda function duration is above 10 seconds',
      metric: placeholderFunction.metricDuration({
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10000, // 10 seconds in milliseconds
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lambdaDurationAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    const lambdaThrottleAlarm = new cloudwatch.Alarm(this, 'LambdaThrottleAlarm', {
      alarmName: 'AI-Ticket-Lambda-Throttles',
      alarmDescription: 'Lambda function is being throttled',
      metric: placeholderFunction.metricThrottles({
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    lambdaThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // ========================================
    // DYNAMODB MONITORING
    // ========================================

    // DynamoDB throttle alarms
    const dynamoReadThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoReadThrottleAlarm', {
      alarmName: 'AI-Ticket-DynamoDB-Read-Throttles',
      alarmDescription: 'DynamoDB read operations are being throttled',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'ReadThrottledEvents',
        dimensionsMap: {
          TableName: ticketsTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dynamoReadThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    const dynamoWriteThrottleAlarm = new cloudwatch.Alarm(this, 'DynamoWriteThrottleAlarm', {
      alarmName: 'AI-Ticket-DynamoDB-Write-Throttles',
      alarmDescription: 'DynamoDB write operations are being throttled',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/DynamoDB',
        metricName: 'WriteThrottledEvents',
        dimensionsMap: {
          TableName: ticketsTable.tableName,
        },
        statistic: 'Sum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 1,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    dynamoWriteThrottleAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // ========================================
    // RDS MONITORING
    // ========================================

    // RDS CPU utilization alarm
    const rdsCpuAlarm = new cloudwatch.Alarm(this, 'RdsCpuAlarm', {
      alarmName: 'AI-Ticket-RDS-High-CPU',
      alarmDescription: 'RDS CPU utilization is above 80%',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'CPUUtilization',
        dimensionsMap: {
          DBInstanceIdentifier: analyticsDb.instanceIdentifier,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 80,
      evaluationPeriods: 3,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    rdsCpuAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // RDS connection count alarm
    const rdsConnectionAlarm = new cloudwatch.Alarm(this, 'RdsConnectionAlarm', {
      alarmName: 'AI-Ticket-RDS-High-Connections',
      alarmDescription: 'RDS connection count is above 80% of max',
      metric: new cloudwatch.Metric({
        namespace: 'AWS/RDS',
        metricName: 'DatabaseConnections',
        dimensionsMap: {
          DBInstanceIdentifier: analyticsDb.instanceIdentifier,
        },
        statistic: 'Average',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 16, // 80% of t3.micro max connections (20)
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    rdsConnectionAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // ========================================
    // CUSTOM APPLICATION METRICS
    // ========================================

    // Custom metrics for business logic (to be implemented in application code)
    const ticketProcessingTimeAlarm = new cloudwatch.Alarm(this, 'TicketProcessingTimeAlarm', {
      alarmName: 'AI-Ticket-Processing-Time-High',
      alarmDescription: 'Average ticket processing time is above 30 seconds',
      metric: new cloudwatch.Metric({
        namespace: 'AiTicketManagement/Business',
        metricName: 'TicketProcessingTime',
        statistic: 'Average',
        period: cdk.Duration.minutes(10),
      }),
      threshold: 30000, // 30 seconds in milliseconds
      evaluationPeriods: 2,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    ticketProcessingTimeAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    const slaBreachRiskAlarm = new cloudwatch.Alarm(this, 'SlaBreachRiskAlarm', {
      alarmName: 'AI-Ticket-SLA-Breach-Risk-High',
      alarmDescription: 'High number of tickets at risk of SLA breach',
      metric: new cloudwatch.Metric({
        namespace: 'AiTicketManagement/Business',
        metricName: 'TicketsAtRiskOfSLABreach',
        statistic: 'Maximum',
        period: cdk.Duration.minutes(5),
      }),
      threshold: 10,
      evaluationPeriods: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });
    slaBreachRiskAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));    //
 ========================================
    // CLOUDWATCH DASHBOARD WIDGETS
    // ========================================

    // API Gateway metrics widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'API Gateway Metrics',
        left: [
          api.metricCount({ label: 'Request Count' }),
          api.metricClientError({ label: 'Client Errors' }),
          api.metricServerError({ label: 'Server Errors' }),
        ],
        right: [
          api.metricLatency({ label: 'Latency' }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Lambda metrics widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Lambda Function Metrics',
        left: [
          placeholderFunction.metricInvocations({ label: 'Invocations' }),
          placeholderFunction.metricErrors({ label: 'Errors' }),
          placeholderFunction.metricThrottles({ label: 'Throttles' }),
        ],
        right: [
          placeholderFunction.metricDuration({ label: 'Duration' }),
        ],
        width: 12,
        height: 6,
      })
    );

    // DynamoDB metrics widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'DynamoDB Metrics',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedReadCapacityUnits',
            dimensionsMap: { TableName: ticketsTable.tableName },
            label: 'Read Capacity',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'ConsumedWriteCapacityUnits',
            dimensionsMap: { TableName: ticketsTable.tableName },
            label: 'Write Capacity',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/DynamoDB',
            metricName: 'SuccessfulRequestLatency',
            dimensionsMap: { TableName: ticketsTable.tableName, Operation: 'Query' },
            label: 'Query Latency',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // RDS metrics widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'RDS Analytics Database Metrics',
        left: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'CPUUtilization',
            dimensionsMap: { DBInstanceIdentifier: analyticsDb.instanceIdentifier },
            label: 'CPU Utilization',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'DatabaseConnections',
            dimensionsMap: { DBInstanceIdentifier: analyticsDb.instanceIdentifier },
            label: 'Connections',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'ReadLatency',
            dimensionsMap: { DBInstanceIdentifier: analyticsDb.instanceIdentifier },
            label: 'Read Latency',
          }),
          new cloudwatch.Metric({
            namespace: 'AWS/RDS',
            metricName: 'WriteLatency',
            dimensionsMap: { DBInstanceIdentifier: analyticsDb.instanceIdentifier },
            label: 'Write Latency',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // Business metrics widget
    dashboard.addWidgets(
      new cloudwatch.GraphWidget({
        title: 'Business Metrics',
        left: [
          new cloudwatch.Metric({
            namespace: 'AiTicketManagement/Business',
            metricName: 'TicketsCreated',
            label: 'Tickets Created',
          }),
          new cloudwatch.Metric({
            namespace: 'AiTicketManagement/Business',
            metricName: 'TicketsResolved',
            label: 'Tickets Resolved',
          }),
        ],
        right: [
          new cloudwatch.Metric({
            namespace: 'AiTicketManagement/Business',
            metricName: 'TicketProcessingTime',
            label: 'Processing Time',
          }),
          new cloudwatch.Metric({
            namespace: 'AiTicketManagement/Business',
            metricName: 'SLAComplianceRate',
            label: 'SLA Compliance %',
          }),
        ],
        width: 12,
        height: 6,
      })
    );

    // ========================================
    // LOG INSIGHTS QUERIES
    // ========================================

    // Create CloudWatch Insights queries for log analysis
    const errorAnalysisQuery = new logs.QueryDefinition(this, 'ErrorAnalysisQuery', {
      queryDefinitionName: 'AI-Ticket-Error-Analysis',
      queryString: `
        fields @timestamp, @message, @logStream
        | filter @message like /ERROR/
        | stats count() by bin(5m)
        | sort @timestamp desc
      `,
      logGroups: [apiLogGroup, aiServiceLogGroup, integrationLogGroup],
    });

    const performanceAnalysisQuery = new logs.QueryDefinition(this, 'PerformanceAnalysisQuery', {
      queryDefinitionName: 'AI-Ticket-Performance-Analysis',
      queryString: `
        fields @timestamp, @duration, @requestId
        | filter @type = "REPORT"
        | stats avg(@duration), max(@duration), min(@duration) by bin(5m)
        | sort @timestamp desc
      `,
      logGroups: [apiLogGroup, aiServiceLogGroup, integrationLogGroup],
    });

    // ========================================
    // COMPOSITE ALARMS FOR SYSTEM HEALTH
    // ========================================

    // System health composite alarm
    const systemHealthAlarm = new cloudwatch.CompositeAlarm(this, 'SystemHealthAlarm', {
      alarmName: 'AI-Ticket-System-Health-Critical',
      alarmDescription: 'Overall system health is degraded',
      compositeAlarmRule: cloudwatch.AlarmRule.anyOf(
        cloudwatch.AlarmRule.fromAlarm(apiErrorRateAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(lambdaErrorAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(rdsCpuAlarm, cloudwatch.AlarmState.ALARM),
        cloudwatch.AlarmRule.fromAlarm(dynamoReadThrottleAlarm, cloudwatch.AlarmState.ALARM)
      ),
    });
    systemHealthAlarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: api.url,
      description: 'API Gateway URL',
    });

    new cdk.CfnOutput(this, 'FrontendUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'CloudFront distribution URL',
    });

    new cdk.CfnOutput(this, 'FilesBucketName', {
      value: filesBucket.bucketName,
      description: 'S3 bucket for file storage',
    });

    new cdk.CfnOutput(this, 'DatabaseSecretArn', {
      value: analyticsDb.secret?.secretArn || 'N/A',
      description: 'RDS database secret ARN',
    });

    new cdk.CfnOutput(this, 'AlertsTopicArn', {
      value: alertsTopic.topicArn,
      description: 'SNS topic ARN for alerts',
    });

    new cdk.CfnOutput(this, 'DashboardUrl', {
      value: `https://${this.region}.console.aws.amazon.com/cloudwatch/home?region=${this.region}#dashboards:name=${dashboard.dashboardName}`,
      description: 'CloudWatch Dashboard URL',
    });
  }
}