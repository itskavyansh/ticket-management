import { DocumentClient } from 'aws-sdk/clients/dynamodb';

/**
 * DynamoDB client wrapper
 */
class DynamoDBClient {
  private documentClient: DocumentClient;

  constructor() {
    // Initialize with mock configuration for testing
    this.documentClient = new DocumentClient({
      region: process.env.AWS_REGION || 'us-east-1',
      endpoint: process.env.DYNAMODB_ENDPOINT || undefined,
      accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'test',
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'test'
    });
  }

  getDocumentClient(): DocumentClient {
    return this.documentClient;
  }
}

export const dynamoDBClient = new DynamoDBClient();