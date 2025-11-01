import { logger } from '../utils/logger';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupLocalDevelopment(): Promise<void> {
  logger.info('Setting up local development environment...');

  try {
    // Check if AWS credentials are configured
    const hasAWSCredentials = !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
    
    if (hasAWSCredentials) {
      logger.info('✅ AWS credentials found - AWS services will be available');
      
      // Test AWS connection
      const { checkAWSHealth } = await import('../config/aws');
      const health = await checkAWSHealth();
      
      logger.info('AWS Services Status:');
      logger.info(`  - S3: ${health.s3 ? '✅ Available' : '❌ Not available'}`);
      logger.info(`  - DynamoDB: ${health.dynamodb ? '✅ Available' : '❌ Not available'}`);
      
      if (health.s3 && health.dynamodb) {
        logger.info('🎉 All AWS services are ready!');
      } else {
        logger.warn('⚠️  Some AWS services are not available. Check your credentials and permissions.');
      }
    } else {
      logger.info('ℹ️  AWS credentials not configured - running in local-only mode');
      logger.info('   The following features will use local alternatives:');
      logger.info('   - File storage: Local filesystem instead of S3');
      logger.info('   - Analytics: MongoDB only (no DynamoDB backup)');
      logger.info('   - Reports: Local storage instead of S3');
      logger.info('');
      logger.info('   To enable AWS features, set these environment variables:');
      logger.info('   - AWS_ACCESS_KEY_ID');
      logger.info('   - AWS_SECRET_ACCESS_KEY');
      logger.info('   - AWS_SESSION_TOKEN (if using temporary credentials)');
    }

    // Check MongoDB connection
    logger.info('Checking MongoDB connection...');
    const { mongoConnection } = await import('../config/mongodb');
    
    try {
      await mongoConnection.connect();
      const isHealthy = await mongoConnection.healthCheck();
      
      if (isHealthy) {
        logger.info('✅ MongoDB connection successful');
      } else {
        logger.warn('⚠️  MongoDB connection issues detected');
      }
    } catch (error) {
      logger.error('❌ MongoDB connection failed:', error);
      logger.info('   Make sure MongoDB is running on the configured URI');
    }

    // Check Redis connection
    logger.info('Checking Redis connection...');
    try {
      const { getRedisClient } = await import('../config/redis');
      const redisClient = getRedisClient();
      
      await redisClient.connect();
      await redisClient.ping();
      logger.info('✅ Redis connection successful');
      await redisClient.disconnect();
    } catch (error) {
      logger.error('❌ Redis connection failed:', error);
      logger.info('   Make sure Redis is running on the configured host and port');
    }

    logger.info('');
    logger.info('🚀 Local development setup complete!');
    logger.info('   You can now start the development server with: npm run dev');

  } catch (error) {
    logger.error('Failed to setup local development environment:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  setupLocalDevelopment()
    .then(() => {
      logger.info('Local development setup completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('Local development setup failed:', error);
      process.exit(1);
    });
}

export { setupLocalDevelopment };