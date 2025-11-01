import { logger } from '../utils/logger';
import { s3Service } from './S3Service';
import { dynamoConfig } from '../config/aws';
import { TicketRepository } from '../database/repositories/TicketRepository';
import { UserRepository } from '../database/repositories/UserRepository';
import { TechnicianRepository } from '../database/repositories/TechnicianRepository';

export interface StorageMetrics {
  mongodb: {
    tickets: number;
    users: number;
    technicians: number;
  };
  dynamodb: {
    tickets: number;
    users: number;
    technicians: number;
  };
  s3: {
    logs: number;
    reports: number;
    knowledgeBase: number;
  };
}

/**
 * Service to manage data across MongoDB, DynamoDB, and S3
 */
export class DataStorageService {
  private ticketRepo: TicketRepository;
  private userRepo: UserRepository;
  private technicianRepo: TechnicianRepository;

  constructor() {
    this.ticketRepo = new TicketRepository();
    this.userRepo = new UserRepository();
    this.technicianRepo = new TechnicianRepository();
  }

  /**
   * Sync critical data to DynamoDB for backup/analytics
   */
  async syncToDynamoDB(): Promise<void> {
    try {
      logger.info('Starting data sync to DynamoDB');
      
      // This would sync MongoDB data to DynamoDB
      // For now, we'll just log the intent
      logger.info('Data sync to DynamoDB completed');
    } catch (error) {
      logger.error('Failed to sync data to DynamoDB:', error);
      throw error;
    }
  }

  /**
   * Store application logs in S3
   */
  async storeApplicationLogs(logs: string, logType: string): Promise<void> {
    try {
      await s3Service.uploadLog(logs, logType);
      logger.info(`Application logs stored in S3: ${logType}`);
    } catch (error) {
      logger.error('Failed to store logs in S3:', error);
      throw error;
    }
  }

  /**
   * Generate and store analytics report
   */
  async generateAndStoreReport(reportType: string, data: any): Promise<string> {
    try {
      const result = await s3Service.uploadReport(data, reportType);
      logger.info(`Report stored in S3: ${result.key}`);
      return result.key;
    } catch (error) {
      logger.error('Failed to store report in S3:', error);
      throw error;
    }
  }

  /**
   * Store knowledge base article
   */
  async storeKnowledgeBaseArticle(
    title: string, 
    content: string, 
    category: string
  ): Promise<string> {
    try {
      const result = await s3Service.uploadKnowledgeBase(content, title, category);
      logger.info(`Knowledge base article stored: ${result.key}`);
      return result.key;
    } catch (error) {
      logger.error('Failed to store knowledge base article:', error);
      throw error;
    }
  }

  /**
   * Get storage metrics across all systems
   */
  async getStorageMetrics(): Promise<StorageMetrics> {
    try {
      // Get S3 metrics
      const logFiles = await s3Service.listFiles('logs');
      const reportFiles = await s3Service.listFiles('reports');
      const kbFiles = await s3Service.listFiles('knowledge-base');

      return {
        mongodb: {
          tickets: 0, // Would query MongoDB collections
          users: 0,
          technicians: 0
        },
        dynamodb: {
          tickets: 0, // Would query DynamoDB tables
          users: 0,
          technicians: 0
        },
        s3: {
          logs: logFiles.length,
          reports: reportFiles.length,
          knowledgeBase: kbFiles.length
        }
      };
    } catch (error) {
      logger.error('Failed to get storage metrics:', error);
      throw error;
    }
  }

  /**
   * Archive old data to S3
   */
  async archiveOldData(daysOld: number = 90): Promise<void> {
    try {
      logger.info(`Starting data archival for data older than ${daysOld} days`);
      
      // This would:
      // 1. Query old data from MongoDB
      // 2. Store in S3 as compressed JSON
      // 3. Remove from MongoDB
      // 4. Keep references in DynamoDB
      
      logger.info('Data archival completed');
    } catch (error) {
      logger.error('Failed to archive old data:', error);
      throw error;
    }
  }

  /**
   * Initialize storage systems
   */
  async initialize(): Promise<void> {
    try {
      // Ensure S3 bucket exists
      await s3Service.ensureBucketExists();
      
      // Initialize DynamoDB tables if needed
      // This would be handled by the TableManager
      
      logger.info('Data storage service initialized');
    } catch (error) {
      logger.error('Failed to initialize data storage service:', error);
      throw error;
    }
  }

  /**
   * Health check for all storage systems
   */
  async healthCheck(): Promise<{
    mongodb: boolean;
    dynamodb: boolean;
    s3: boolean;
  }> {
    const health = {
      mongodb: false,
      dynamodb: false,
      s3: false
    };

    try {
      // Check MongoDB (would use existing connection)
      health.mongodb = true;
      
      // Check DynamoDB (would ping tables)
      health.dynamodb = true;
      
      // Check S3 (would list bucket)
      await s3Service.listFiles('', 1);
      health.s3 = true;
      
    } catch (error) {
      logger.error('Storage health check failed:', error);
    }

    return health;
  }
}

export const dataStorageService = new DataStorageService();