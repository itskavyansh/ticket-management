import { dynamoDBClient } from './client';
import { allTableDefinitions } from './tableDefinitions';
import { logger } from '../../utils/logger';

/**
 * DynamoDB table management utilities
 */
export class TableManager {
  /**
   * Create all tables defined in tableDefinitions
   */
  static async createAllTables(): Promise<void> {
    logger.info('Starting table creation process');
    
    for (const tableDefinition of allTableDefinitions) {
      try {
        await this.createTableIfNotExists(tableDefinition);
      } catch (error) {
        logger.error(`Failed to create table ${tableDefinition.TableName}`, {
          error: error.message
        });
        throw error;
      }
    }
    
    logger.info('All tables created successfully');
  }

  /**
   * Create a table if it doesn't exist
   */
  static async createTableIfNotExists(tableDefinition: any): Promise<void> {
    const tableName = tableDefinition.TableName;
    
    try {
      // Check if table exists
      await dynamoDBClient.describeTable(tableName);
      logger.info(`Table ${tableName} already exists`);
      return;
    } catch (error) {
      if (error.message.includes('ResourceNotFoundException')) {
        // Table doesn't exist, create it
        logger.info(`Creating table ${tableName}`);
        
        await dynamoDBClient.createTable(tableDefinition);
        
        // Wait for table to become active
        await dynamoDBClient.waitForTableActive(tableName);
        
        logger.info(`Table ${tableName} created and is now active`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Delete all tables
   */
  static async deleteAllTables(): Promise<void> {
    logger.info('Starting table deletion process');
    
    for (const tableDefinition of allTableDefinitions) {
      try {
        await this.deleteTableIfExists(tableDefinition.TableName);
      } catch (error) {
        logger.error(`Failed to delete table ${tableDefinition.TableName}`, {
          error: error.message
        });
        // Continue with other tables even if one fails
      }
    }
    
    logger.info('Table deletion process completed');
  }

  /**
   * Delete a table if it exists
   */
  static async deleteTableIfExists(tableName: string): Promise<void> {
    try {
      // Check if table exists
      await dynamoDBClient.describeTable(tableName);
      
      // Table exists, delete it
      logger.info(`Deleting table ${tableName}`);
      await dynamoDBClient.deleteTable(tableName);
      
      logger.info(`Table ${tableName} deletion initiated`);
    } catch (error) {
      if (error.message.includes('ResourceNotFoundException')) {
        logger.info(`Table ${tableName} does not exist`);
      } else {
        throw error;
      }
    }
  }

  /**
   * Check health of all tables
   */
  static async checkTablesHealth(): Promise<{
    healthy: boolean;
    tables: Array<{
      name: string;
      status: string;
      healthy: boolean;
    }>;
  }> {
    const results = [];
    let allHealthy = true;
    
    for (const tableDefinition of allTableDefinitions) {
      const tableName = tableDefinition.TableName;
      
      try {
        const description = await dynamoDBClient.describeTable(tableName);
        const status = description.Table?.TableStatus || 'UNKNOWN';
        const healthy = status === 'ACTIVE';
        
        results.push({
          name: tableName,
          status,
          healthy
        });
        
        if (!healthy) {
          allHealthy = false;
        }
      } catch (error) {
        results.push({
          name: tableName,
          status: 'NOT_FOUND',
          healthy: false
        });
        allHealthy = false;
      }
    }
    
    return {
      healthy: allHealthy,
      tables: results
    };
  }

  /**
   * Get table statistics
   */
  static async getTableStatistics(): Promise<Array<{
    name: string;
    itemCount?: number;
    sizeBytes?: number;
    readCapacity?: number;
    writeCapacity?: number;
    status: string;
  }>> {
    const statistics = [];
    
    for (const tableDefinition of allTableDefinitions) {
      const tableName = tableDefinition.TableName;
      
      try {
        const description = await dynamoDBClient.describeTable(tableName);
        const table = description.Table;
        
        statistics.push({
          name: tableName,
          itemCount: table?.ItemCount,
          sizeBytes: table?.TableSizeBytes,
          readCapacity: table?.ProvisionedThroughput?.ReadCapacityUnits,
          writeCapacity: table?.ProvisionedThroughput?.WriteCapacityUnits,
          status: table?.TableStatus || 'UNKNOWN'
        });
      } catch (error) {
        statistics.push({
          name: tableName,
          status: 'ERROR'
        });
      }
    }
    
    return statistics;
  }

  /**
   * Initialize database (create tables if they don't exist)
   */
  static async initializeDatabase(): Promise<void> {
    logger.info('Initializing DynamoDB database');
    
    try {
      await this.createAllTables();
      
      // Verify all tables are healthy
      const health = await this.checkTablesHealth();
      
      if (!health.healthy) {
        const unhealthyTables = health.tables
          .filter(t => !t.healthy)
          .map(t => `${t.name} (${t.status})`)
          .join(', ');
        
        throw new Error(`Some tables are not healthy: ${unhealthyTables}`);
      }
      
      logger.info('Database initialization completed successfully');
    } catch (error) {
      logger.error('Database initialization failed', {
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Reset database (delete and recreate all tables)
   */
  static async resetDatabase(): Promise<void> {
    logger.warn('Resetting database - all data will be lost');
    
    try {
      await this.deleteAllTables();
      
      // Wait a bit for deletions to complete
      await new Promise(resolve => setTimeout(resolve, 10000));
      
      await this.createAllTables();
      
      logger.info('Database reset completed successfully');
    } catch (error) {
      logger.error('Database reset failed', {
        error: error.message
      });
      throw error;
    }
  }
}