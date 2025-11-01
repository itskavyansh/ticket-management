import { dynamodb, dynamoConfig } from '../config/aws';
import { logger } from '../utils/logger';

const tableDefinitions = [
  {
    TableName: dynamoConfig.tables.tickets,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' },
      { AttributeName: 'GSI1PK', AttributeType: 'S' },
      { AttributeName: 'GSI1SK', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'GSI1',
        KeySchema: [
          { AttributeName: 'GSI1PK', KeyType: 'HASH' },
          { AttributeName: 'GSI1SK', KeyType: 'RANGE' }
        ],
        Projection: { ProjectionType: 'ALL' },
        BillingMode: 'PAY_PER_REQUEST'
      }
    ],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [
      { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
      { Key: 'Application', Value: 'ai-ticket-management' }
    ]
  },
  {
    TableName: dynamoConfig.tables.users,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'email', AttributeType: 'S' }
    ],
    GlobalSecondaryIndexes: [
      {
        IndexName: 'EmailIndex',
        KeySchema: [
          { AttributeName: 'email', KeyType: 'HASH' }
        ],
        Projection: { ProjectionType: 'ALL' },
        BillingMode: 'PAY_PER_REQUEST'
      }
    ],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [
      { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
      { Key: 'Application', Value: 'ai-ticket-management' }
    ]
  },
  {
    TableName: dynamoConfig.tables.technicians,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [
      { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
      { Key: 'Application', Value: 'ai-ticket-management' }
    ]
  },
  {
    TableName: dynamoConfig.tables.analytics,
    KeySchema: [
      { AttributeName: 'PK', KeyType: 'HASH' },
      { AttributeName: 'SK', KeyType: 'RANGE' }
    ],
    AttributeDefinitions: [
      { AttributeName: 'PK', AttributeType: 'S' },
      { AttributeName: 'SK', AttributeType: 'S' }
    ],
    BillingMode: 'PAY_PER_REQUEST',
    Tags: [
      { Key: 'Environment', Value: process.env.NODE_ENV || 'development' },
      { Key: 'Application', Value: 'ai-ticket-management' }
    ]
  }
];

async function createTable(tableDefinition: any): Promise<void> {
  try {
    // Check if table exists
    await dynamodb.describeTable({ TableName: tableDefinition.TableName }).promise();
    logger.info(`Table ${tableDefinition.TableName} already exists`);
  } catch (error: any) {
    if (error.code === 'ResourceNotFoundException') {
      // Table doesn't exist, create it
      logger.info(`Creating table: ${tableDefinition.TableName}`);
      await dynamodb.createTable(tableDefinition).promise();
      
      // Wait for table to become active
      await dynamodb.waitFor('tableExists', { TableName: tableDefinition.TableName }).promise();
      logger.info(`Table ${tableDefinition.TableName} created successfully`);
    } else {
      throw error;
    }
  }
}

export async function initializeDynamoDBTables(): Promise<void> {
  logger.info('Initializing DynamoDB tables...');
  
  // Check if AWS credentials are configured
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    logger.warn('AWS credentials not configured. Skipping DynamoDB table initialization.');
    logger.info('To initialize DynamoDB tables, set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.');
    return;
  }
  
  try {
    for (const tableDefinition of tableDefinitions) {
      await createTable(tableDefinition);
    }
    
    logger.info('All DynamoDB tables initialized successfully');
  } catch (error) {
    logger.error('Failed to initialize DynamoDB tables:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDynamoDBTables()
    .then(() => {
      logger.info('DynamoDB initialization completed');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('DynamoDB initialization failed:', error);
      process.exit(1);
    });
}