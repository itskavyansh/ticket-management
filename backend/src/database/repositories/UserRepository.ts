import { DocumentClient } from 'aws-sdk/clients/dynamodb';
import { UserEntity } from '../../entities/UserEntity';
import { UserRole } from '../../types';

/**
 * Repository for User entity operations in DynamoDB
 */
export class UserRepository {
  private documentClient: DocumentClient;
  private tableName: string;

  constructor(documentClient: DocumentClient, tableName: string = 'ai-ticket-management') {
    this.documentClient = documentClient;
    this.tableName = tableName;
  }

  /**
   * Create a new user
   */
  async create(user: UserEntity): Promise<UserEntity> {
    const params: DocumentClient.PutItemInput = {
      TableName: this.tableName,
      Item: user.toDynamoDBItem(),
      ConditionExpression: 'attribute_not_exists(PK)'
    };

    try {
      await this.documentClient.put(params).promise();
      return user;
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('User already exists');
      }
      throw new Error(`Failed to create user: ${error.message}`);
    }
  }

  /**
   * Find user by ID
   */
  async findById(id: string): Promise<UserEntity | null> {
    const params: DocumentClient.GetItemInput = {
      TableName: this.tableName,
      Key: {
        PK: `USER#${id}`,
        SK: `USER#${id}`
      }
    };

    try {
      const result = await this.documentClient.get(params).promise();
      
      if (!result.Item) {
        return null;
      }

      return UserEntity.fromDynamoDBItem(result.Item);
    } catch (error: any) {
      throw new Error(`Failed to find user by ID: ${error.message}`);
    }
  }

  /**
   * Find user by email
   */
  async findByEmail(email: string): Promise<UserEntity | null> {
    const params: DocumentClient.QueryInput = {
      TableName: this.tableName,
      IndexName: 'GSI1',
      KeyConditionExpression: 'GSI1PK = :email',
      ExpressionAttributeValues: {
        ':email': `EMAIL#${email}`
      }
    };

    try {
      const result = await this.documentClient.query(params).promise();
      
      if (!result.Items || result.Items.length === 0) {
        return null;
      }

      return UserEntity.fromDynamoDBItem(result.Items[0]);
    } catch (error: any) {
      throw new Error(`Failed to find user by email: ${error.message}`);
    }
  }

  /**
   * Update user
   */
  async update(user: UserEntity): Promise<UserEntity> {
    user.updatedAt = new Date();
    const item = user.toDynamoDBItem();

    const updateExpression: string[] = [];
    const expressionAttributeNames: Record<string, string> = {};
    const expressionAttributeValues: Record<string, any> = {};

    // Build update expression dynamically
    Object.keys(item).forEach((key) => {
      if (key !== 'PK' && key !== 'SK') {
        updateExpression.push(`#${key} = :${key}`);
        expressionAttributeNames[`#${key}`] = key;
        expressionAttributeValues[`:${key}`] = item[key];
      }
    });

    const params: DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: {
        PK: `USER#${user.id}`,
        SK: `USER#${user.id}`
      },
      UpdateExpression: `SET ${updateExpression.join(', ')}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ConditionExpression: 'attribute_exists(PK)',
      ReturnValues: 'ALL_NEW'
    };

    try {
      const result = await this.documentClient.update(params).promise();
      
      if (!result.Attributes) {
        throw new Error('Update failed - no attributes returned');
      }

      return UserEntity.fromDynamoDBItem(result.Attributes);
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('User not found');
      }
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  /**
   * Delete user (soft delete by setting isActive to false)
   */
  async delete(id: string): Promise<void> {
    const params: DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: {
        PK: `USER#${id}`,
        SK: `USER#${id}`
      },
      UpdateExpression: 'SET isActive = :isActive, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':isActive': false,
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(PK)'
    };

    try {
      await this.documentClient.update(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('User not found');
      }
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * Find users by role
   */
  async findByRole(role: UserRole): Promise<UserEntity[]> {
    const params: DocumentClient.QueryInput = {
      TableName: this.tableName,
      IndexName: 'GSI2', // Assuming GSI2 is set up for role queries
      KeyConditionExpression: 'GSI2PK = :role',
      ExpressionAttributeValues: {
        ':role': `ROLE#${role}`
      }
    };

    try {
      const result = await this.documentClient.query(params).promise();
      
      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => UserEntity.fromDynamoDBItem(item));
    } catch (error: any) {
      throw new Error(`Failed to find users by role: ${error.message}`);
    }
  }

  /**
   * Find active users
   */
  async findActiveUsers(): Promise<UserEntity[]> {
    const params: DocumentClient.QueryInput = {
      TableName: this.tableName,
      IndexName: 'GSI3', // Assuming GSI3 is set up for active status queries
      KeyConditionExpression: 'GSI3PK = :status',
      ExpressionAttributeValues: {
        ':status': 'ACTIVE#true'
      }
    };

    try {
      const result = await this.documentClient.query(params).promise();
      
      if (!result.Items) {
        return [];
      }

      return result.Items.map(item => UserEntity.fromDynamoDBItem(item));
    } catch (error: any) {
      throw new Error(`Failed to find active users: ${error.message}`);
    }
  }

  /**
   * Update user's last login timestamp
   */
  async updateLastLogin(id: string): Promise<void> {
    const params: DocumentClient.UpdateItemInput = {
      TableName: this.tableName,
      Key: {
        PK: `USER#${id}`,
        SK: `USER#${id}`
      },
      UpdateExpression: 'SET lastLoginAt = :lastLoginAt, updatedAt = :updatedAt',
      ExpressionAttributeValues: {
        ':lastLoginAt': new Date().toISOString(),
        ':updatedAt': new Date().toISOString()
      },
      ConditionExpression: 'attribute_exists(PK)'
    };

    try {
      await this.documentClient.update(params).promise();
    } catch (error: any) {
      if (error.code === 'ConditionalCheckFailedException') {
        throw new Error('User not found');
      }
      throw new Error(`Failed to update last login: ${error.message}`);
    }
  }

  /**
   * Add refresh token to user
   */
  async addRefreshToken(id: string, token: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    user.addRefreshToken(token);
    await this.update(user);
  }

  /**
   * Remove refresh token from user
   */
  async removeRefreshToken(id: string, token: string): Promise<void> {
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found');
    }

    user.removeRefreshToken(token);
    await this.update(user);
  }

  /**
   * Validate refresh token for user
   */
  async validateRefreshToken(id: string, token: string): Promise<boolean> {
    const user = await this.findById(id);
    if (!user) {
      return false;
    }

    return user.refreshTokens.includes(token);
  }
}