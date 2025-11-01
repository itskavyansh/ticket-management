import AWS from 'aws-sdk';
import { logger } from '../utils/logger';

// Load environment variables first
import dotenv from 'dotenv';
dotenv.config();

// AWS Configuration
const awsConfig = {
  region: process.env.AWS_REGION || 'us-east-1',
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  sessionToken: process.env.AWS_SESSION_TOKEN
};

// Validate AWS credentials
if (!awsConfig.accessKeyId || !awsConfig.secretAccessKey) {
  logger.warn('AWS credentials not found in environment variables. Some features may not work.');
  logger.info('To use AWS features, set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY');
}

// Configure AWS SDK
AWS.config.update(awsConfig);

// For development, allow using local DynamoDB
const isDevelopment = process.env.NODE_ENV === 'development';
const useLocalDynamoDB = process.env.USE_LOCAL_DYNAMODB === 'true' || (!awsConfig.accessKeyId && isDevelopment);

// S3 Configuration
export const s3Config = {
  bucketName: process.env.S3_BUCKET_NAME || 'ai-ticket-management-storage',
  region: awsConfig.region,
  signedUrlExpiry: 3600 // 1 hour
};

// DynamoDB Configuration
export const dynamoConfig = {
  region: awsConfig.region,
  endpoint: process.env.DYNAMODB_ENDPOINT, // For local development
  tables: {
    tickets: process.env.DYNAMODB_TICKETS_TABLE || 'tickets',
    technicians: process.env.DYNAMODB_TECHNICIANS_TABLE || 'technicians',
    timeTracking: process.env.DYNAMODB_TIME_TRACKING_TABLE || 'time_tracking',
    users: process.env.DYNAMODB_USERS_TABLE || 'users',
    analytics: process.env.DYNAMODB_ANALYTICS_TABLE || 'analytics'
  }
};

// Initialize AWS services with proper configuration
export const s3 = new AWS.S3({
  region: awsConfig.region,
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey,
  sessionToken: awsConfig.sessionToken
});

export const dynamodb = new AWS.DynamoDB({
  region: awsConfig.region,
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey,
  sessionToken: awsConfig.sessionToken,
  endpoint: useLocalDynamoDB ? 'http://localhost:8000' : undefined
});

export const docClient = new AWS.DynamoDB.DocumentClient({
  region: awsConfig.region,
  accessKeyId: awsConfig.accessKeyId,
  secretAccessKey: awsConfig.secretAccessKey,
  sessionToken: awsConfig.sessionToken,
  endpoint: useLocalDynamoDB ? 'http://localhost:8000' : undefined
});

// Health check for AWS services
export const checkAWSHealth = async (): Promise<{
  s3: boolean;
  dynamodb: boolean;
  credentialsConfigured: boolean;
}> => {
  const health = {
    s3: false,
    dynamodb: false,
    credentialsConfigured: !!(awsConfig.accessKeyId && awsConfig.secretAccessKey)
  };

  if (!health.credentialsConfigured) {
    logger.warn('AWS credentials not configured, skipping health checks');
    return health;
  }

  try {
    // Check S3
    await s3.headBucket({ Bucket: s3Config.bucketName }).promise();
    health.s3 = true;
    logger.info('S3 health check passed');
  } catch (error: any) {
    if (error.code === 'NoSuchBucket') {
      logger.info('S3 bucket does not exist, but credentials are valid');
      health.s3 = true; // Credentials work, bucket just needs to be created
    } else {
      logger.warn('S3 health check failed:', error.message);
    }
  }

  try {
    // Check DynamoDB
    await dynamodb.listTables().promise();
    health.dynamodb = true;
    logger.info('DynamoDB health check passed');
  } catch (error: any) {
    logger.warn('DynamoDB health check failed:', error.message);
  }

  return health;
};

export default {
  s3,
  dynamodb,
  docClient,
  s3Config,
  dynamoConfig,
  checkAWSHealth
};