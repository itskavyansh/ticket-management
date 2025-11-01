import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { docClient, dynamoConfig } from '../../config/aws';
import { logger } from '../../utils/logger';

/**
 * DynamoDB client wrapper
 */
class DynamoDBClient {
  private documentClient: DocumentClient;

  constructor() {
    // Use the configured AWS client
    this.documentClient = docClient;
    logger.info('DynamoDB client initialized');
  }

  getDocumentClient(): DocumentClient {
    return this.documentClient;
  }
}

export const dynamoDBClient = new DynamoDBClient();