import { s3Service } from '../services/S3Service';
import { dataStorageService } from '../services/DataStorageService';
import { checkAWSHealth } from '../config/aws';
import { logger } from '../utils/logger';

async function testAWSServices(): Promise<void> {
  logger.info('Testing AWS services...');

  try {
    // Test AWS health
    logger.info('1. Checking AWS service health...');
    const awsHealth = await checkAWSHealth();
    logger.info('AWS Health:', awsHealth);

    // Test S3 bucket creation
    logger.info('2. Testing S3 bucket...');
    await s3Service.ensureBucketExists();
    logger.info('✅ S3 bucket ready');

    // Test file upload to S3
    logger.info('3. Testing S3 file upload...');
    const testContent = JSON.stringify({
      message: 'Test file from AI Ticket Management Platform',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    }, null, 2);
    
    const uploadResult = await s3Service.uploadFile(
      Buffer.from(testContent, 'utf8'),
      'test-file.json',
      'application/json',
      'tests'
    );
    logger.info('✅ File uploaded:', uploadResult.key);

    // Test signed URL generation
    logger.info('4. Testing signed URL generation...');
    const signedUrl = await s3Service.getSignedUrl(uploadResult.key);
    logger.info('✅ Signed URL generated');

    // Test file listing
    logger.info('5. Testing file listing...');
    const files = await s3Service.listFiles('tests');
    logger.info(`✅ Found ${files.length} test files`);

    // Test knowledge base upload
    logger.info('6. Testing knowledge base upload...');
    const kbKey = await dataStorageService.storeKnowledgeBaseArticle(
      'Test Article',
      '# Test Knowledge Base Article\n\nThis is a test article for the AI Ticket Management Platform.',
      'testing'
    );
    logger.info('✅ Knowledge base article stored:', kbKey);

    // Test report generation
    logger.info('7. Testing report generation...');
    const reportData = {
      reportType: 'test-report',
      generatedAt: new Date().toISOString(),
      data: {
        totalTickets: 42,
        resolvedTickets: 38,
        averageResolutionTime: '2.5 hours'
      }
    };
    
    const reportKey = await dataStorageService.generateAndStoreReport('test-report', reportData);
    logger.info('✅ Report generated:', reportKey);

    // Test storage metrics
    logger.info('8. Testing storage metrics...');
    const metrics = await dataStorageService.getStorageMetrics();
    logger.info('✅ Storage metrics:', metrics);

    // Clean up test files
    logger.info('9. Cleaning up test files...');
    await s3Service.deleteFile(uploadResult.key);
    logger.info('✅ Test file cleaned up');

    logger.info('🎉 All AWS services tests passed!');

  } catch (error) {
    logger.error('❌ AWS services test failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  testAWSServices()
    .then(() => {
      logger.info('AWS services test completed successfully');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('AWS services test failed:', error);
      process.exit(1);
    });
}

export { testAWSServices };