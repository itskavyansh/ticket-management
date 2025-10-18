import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { dynamoDBClient } from '../client';
import { logger } from '../../../utils/logger';

/**
 * Base repository class with common DynamoDB operations
 */
export abstract class BaseRepository<T> {
  protected client: DocumentClient;
  protected tableName: string;

  constructor(tableName: string) {
    this.client = dynamoDBClient.getDocumentClient();
    this.tableName = tableName;
  }

  /**
   * Get item by primary key
   */
  protected async getItem(key: Record<string, any>): Promise<T | null> {
    try {
      const params: DocumentClient.GetItemInput = {
        TableName: this.tableName,
        Key: key
      };

      const result = await this.client.get(params).promise();
      return result.Item as T || null;
    } catch (error) {
      logger.error(`Failed to get item from ${this.tableName}`, {
        key,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Put item to table
   */
  protected async putItem(item: T, conditionExpression?: string): Promise<void> {
    try {
      const params: DocumentClient.PutItemInput = {
        TableName: this.tableName,
        Item: item as any
      };

      if (conditionExpression) {
        params.ConditionExpression = conditionExpression;
      }

      await this.client.put(params).promise();
    } catch (error) {
      logger.error(`Failed to put item to ${this.tableName}`, {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update item in table
   */
  protected async updateItem(
    key: Record<string, any>,
    updateExpression: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>,
    conditionExpression?: string
  ): Promise<T | null> {
    try {
      const params: DocumentClient.UpdateItemInput = {
        TableName: this.tableName,
        Key: key,
        UpdateExpression: updateExpression,
        ReturnValues: 'ALL_NEW'
      };

      if (expressionAttributeNames) {
        params.ExpressionAttributeNames = expressionAttributeNames;
      }

      if (expressionAttributeValues) {
        params.ExpressionAttributeValues = expressionAttributeValues;
      }

      if (conditionExpression) {
        params.ConditionExpression = conditionExpression;
      }

      const result = await this.client.update(params).promise();
      return result.Attributes as T || null;
    } catch (error) {
      logger.error(`Failed to update item in ${this.tableName}`, {
        key,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Delete item from table
   */
  protected async deleteItem(key: Record<string, any>): Promise<void> {
    try {
      const params: DocumentClient.DeleteItemInput = {
        TableName: this.tableName,
        Key: key
      };

      await this.client.delete(params).promise();
    } catch (error) {
      logger.error(`Failed to delete item from ${this.tableName}`, {
        key,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Query items from table or index
   */
  protected async queryItems(
    keyConditionExpression: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>,
    indexName?: string,
    filterExpression?: string,
    limit?: number,
    scanIndexForward?: boolean,
    exclusiveStartKey?: Record<string, any>
  ): Promise<{
    items: T[];
    lastEvaluatedKey?: Record<string, any>;
    count: number;
  }> {
    try {
      const params: DocumentClient.QueryInput = {
        TableName: this.tableName,
        KeyConditionExpression: keyConditionExpression
      };

      if (expressionAttributeNames) {
        params.ExpressionAttributeNames = expressionAttributeNames;
      }

      if (expressionAttributeValues) {
        params.ExpressionAttributeValues = expressionAttributeValues;
      }

      if (indexName) {
        params.IndexName = indexName;
      }

      if (filterExpression) {
        params.FilterExpression = filterExpression;
      }

      if (limit) {
        params.Limit = limit;
      }

      if (scanIndexForward !== undefined) {
        params.ScanIndexForward = scanIndexForward;
      }

      if (exclusiveStartKey) {
        params.ExclusiveStartKey = exclusiveStartKey;
      }

      const result = await this.client.query(params).promise();
      
      return {
        items: result.Items as T[] || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0
      };
    } catch (error) {
      logger.error(`Failed to query items from ${this.tableName}`, {
        keyConditionExpression,
        indexName,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Scan items from table or index
   */
  protected async scanItems(
    filterExpression?: string,
    expressionAttributeNames?: Record<string, string>,
    expressionAttributeValues?: Record<string, any>,
    indexName?: string,
    limit?: number,
    exclusiveStartKey?: Record<string, any>
  ): Promise<{
    items: T[];
    lastEvaluatedKey?: Record<string, any>;
    count: number;
  }> {
    try {
      const params: DocumentClient.ScanInput = {
        TableName: this.tableName
      };

      if (filterExpression) {
        params.FilterExpression = filterExpression;
      }

      if (expressionAttributeNames) {
        params.ExpressionAttributeNames = expressionAttributeNames;
      }

      if (expressionAttributeValues) {
        params.ExpressionAttributeValues = expressionAttributeValues;
      }

      if (indexName) {
        params.IndexName = indexName;
      }

      if (limit) {
        params.Limit = limit;
      }

      if (exclusiveStartKey) {
        params.ExclusiveStartKey = exclusiveStartKey;
      }

      const result = await this.client.scan(params).promise();
      
      return {
        items: result.Items as T[] || [],
        lastEvaluatedKey: result.LastEvaluatedKey,
        count: result.Count || 0
      };
    } catch (error) {
      logger.error(`Failed to scan items from ${this.tableName}`, {
        filterExpression,
        indexName,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Batch get items
   */
  protected async batchGetItems(keys: Record<string, any>[]): Promise<T[]> {
    if (keys.length === 0) {
      return [];
    }

    try {
      const params: DocumentClient.BatchGetItemInput = {
        RequestItems: {
          [this.tableName]: {
            Keys: keys
          }
        }
      };

      const result = await this.client.batchGet(params).promise();
      return result.Responses?.[this.tableName] as T[] || [];
    } catch (error) {
      logger.error(`Failed to batch get items from ${this.tableName}`, {
        keyCount: keys.length,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Batch write items (put or delete)
   */
  protected async batchWriteItems(
    putItems?: T[],
    deleteKeys?: Record<string, any>[]
  ): Promise<void> {
    if ((!putItems || putItems.length === 0) && (!deleteKeys || deleteKeys.length === 0)) {
      return;
    }

    try {
      const requestItems: DocumentClient.WriteRequest[] = [];

      if (putItems) {
        putItems.forEach(item => {
          requestItems.push({
            PutRequest: {
              Item: item as any
            }
          });
        });
      }

      if (deleteKeys) {
        deleteKeys.forEach(key => {
          requestItems.push({
            DeleteRequest: {
              Key: key
            }
          });
        });
      }

      const params: DocumentClient.BatchWriteItemInput = {
        RequestItems: {
          [this.tableName]: requestItems
        }
      };

      await this.client.batchWrite(params).promise();
    } catch (error) {
      logger.error(`Failed to batch write items to ${this.tableName}`, {
        putCount: putItems?.length || 0,
        deleteCount: deleteKeys?.length || 0,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Build filter expression for common query patterns
   */
  protected buildFilterExpression(
    filters: Record<string, any>
  ): {
    filterExpression?: string;
    expressionAttributeNames?: Record<string, string>;
    expressionAttributeValues?: Record<string, any>;
  } {
    const conditions: string[] = [];
    const attributeNames: Record<string, string> = {};
    const attributeValues: Record<string, any> = {};

    Object.entries(filters).forEach(([key, value], index) => {
      if (value !== undefined && value !== null) {
        const nameKey = `#attr${index}`;
        const valueKey = `:val${index}`;

        attributeNames[nameKey] = key;
        attributeValues[valueKey] = value;

        if (Array.isArray(value)) {
          // Handle array values (IN operator)
          const valueKeys = value.map((_, i) => `:val${index}_${i}`);
          value.forEach((v, i) => {
            attributeValues[`:val${index}_${i}`] = v;
          });
          conditions.push(`${nameKey} IN (${valueKeys.join(', ')})`);
        } else if (typeof value === 'string' && value.includes('*')) {
          // Handle wildcard search (contains)
          const searchValue = value.replace(/\*/g, '');
          attributeValues[valueKey] = searchValue;
          conditions.push(`contains(${nameKey}, ${valueKey})`);
        } else {
          // Handle exact match
          conditions.push(`${nameKey} = ${valueKey}`);
        }
      }
    });

    return {
      filterExpression: conditions.length > 0 ? conditions.join(' AND ') : undefined,
      expressionAttributeNames: Object.keys(attributeNames).length > 0 ? attributeNames : undefined,
      expressionAttributeValues: Object.keys(attributeValues).length > 0 ? attributeValues : undefined
    };
  }

  /**
   * Get table name
   */
  getTableName(): string {
    return this.tableName;
  }
}