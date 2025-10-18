import { Pool, PoolClient, QueryResult } from 'pg';
import { logger } from '../../utils/logger';

/**
 * PostgreSQL client wrapper with connection pooling and error handling
 */
export class PostgreSQLClient {
  private pool: Pool;
  private isConnected: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: process.env.POSTGRES_HOST || 'localhost',
      port: parseInt(process.env.POSTGRES_PORT || '5432'),
      database: process.env.POSTGRES_DATABASE || 'ai_ticket_management',
      user: process.env.POSTGRES_USER || 'postgres',
      password: process.env.POSTGRES_PASSWORD || 'password',
      max: parseInt(process.env.POSTGRES_MAX_CONNECTIONS || '20'),
      idleTimeoutMillis: parseInt(process.env.POSTGRES_IDLE_TIMEOUT || '30000'),
      connectionTimeoutMillis: parseInt(process.env.POSTGRES_CONNECTION_TIMEOUT || '10000'),
      ssl: process.env.POSTGRES_SSL === 'true' ? { rejectUnauthorized: false } : false
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      logger.error('PostgreSQL pool error', { error: err.message });
    });

    // Handle client connection
    this.pool.on('connect', () => {
      logger.debug('New PostgreSQL client connected');
    });

    // Handle client removal
    this.pool.on('remove', () => {
      logger.debug('PostgreSQL client removed from pool');
    });
  }

  /**
   * Initialize connection and test connectivity
   */
  async connect(): Promise<void> {
    try {
      const client = await this.pool.connect();
      await client.query('SELECT NOW()');
      client.release();
      
      this.isConnected = true;
      logger.info('PostgreSQL connection established successfully');
    } catch (error) {
      logger.error('Failed to connect to PostgreSQL', { error: error.message });
      throw new Error(`PostgreSQL connection failed: ${error.message}`);
    }
  }

  /**
   * Execute a query with parameters
   */
  async query<T = any>(
    text: string, 
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    
    try {
      logger.debug('Executing PostgreSQL query', { 
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        paramCount: params?.length || 0
      });

      const result = await this.pool.query<T>(text, params);
      
      const duration = Date.now() - start;
      logger.debug('PostgreSQL query completed', { 
        duration,
        rowCount: result.rowCount
      });

      return result;
    } catch (error) {
      const duration = Date.now() - start;
      logger.error('PostgreSQL query failed', {
        query: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
        duration,
        error: error.message
      });
      throw this.handlePostgreSQLError(error);
    }
  }

  /**
   * Execute a query and return only the rows
   */
  async queryRows<T = any>(
    text: string, 
    params?: any[]
  ): Promise<T[]> {
    const result = await this.query<T>(text, params);
    return result.rows;
  }

  /**
   * Execute a query and return only the first row
   */
  async queryOne<T = any>(
    text: string, 
    params?: any[]
  ): Promise<T | null> {
    const result = await this.query<T>(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      logger.debug('PostgreSQL transaction started');
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      logger.debug('PostgreSQL transaction committed');
      
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('PostgreSQL transaction rolled back', { error: error.message });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a batch of queries
   */
  async batch(queries: Array<{ text: string; params?: any[] }>): Promise<QueryResult[]> {
    return this.transaction(async (client) => {
      const results: QueryResult[] = [];
      
      for (const query of queries) {
        const result = await client.query(query.text, query.params);
        results.push(result);
      }
      
      return results;
    });
  }

  /**
   * Insert a single record and return the inserted row
   */
  async insert<T = any>(
    table: string,
    data: Record<string, any>,
    returning: string = '*'
  ): Promise<T> {
    const columns = Object.keys(data);
    const values = Object.values(data);
    const placeholders = values.map((_, index) => `$${index + 1}`);

    const query = `
      INSERT INTO ${table} (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      RETURNING ${returning}
    `;

    const result = await this.query<T>(query, values);
    return result.rows[0];
  }

  /**
   * Update records and return updated rows
   */
  async update<T = any>(
    table: string,
    data: Record<string, any>,
    where: Record<string, any>,
    returning: string = '*'
  ): Promise<T[]> {
    const setColumns = Object.keys(data);
    const setValues = Object.values(data);
    const whereColumns = Object.keys(where);
    const whereValues = Object.values(where);

    const setClause = setColumns
      .map((col, index) => `${col} = $${index + 1}`)
      .join(', ');

    const whereClause = whereColumns
      .map((col, index) => `${col} = $${setValues.length + index + 1}`)
      .join(' AND ');

    const query = `
      UPDATE ${table}
      SET ${setClause}
      WHERE ${whereClause}
      RETURNING ${returning}
    `;

    const result = await this.query<T>(query, [...setValues, ...whereValues]);
    return result.rows;
  }

  /**
   * Delete records and return deleted rows
   */
  async delete<T = any>(
    table: string,
    where: Record<string, any>,
    returning: string = '*'
  ): Promise<T[]> {
    const whereColumns = Object.keys(where);
    const whereValues = Object.values(where);

    const whereClause = whereColumns
      .map((col, index) => `${col} = $${index + 1}`)
      .join(' AND ');

    const query = `
      DELETE FROM ${table}
      WHERE ${whereClause}
      RETURNING ${returning}
    `;

    const result = await this.query<T>(query, whereValues);
    return result.rows;
  }

  /**
   * Check if connection is healthy
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.query('SELECT 1');
      return true;
    } catch (error) {
      logger.error('PostgreSQL health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get connection pool statistics
   */
  getPoolStats(): {
    totalCount: number;
    idleCount: number;
    waitingCount: number;
  } {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Close all connections in the pool
   */
  async close(): Promise<void> {
    try {
      await this.pool.end();
      this.isConnected = false;
      logger.info('PostgreSQL connection pool closed');
    } catch (error) {
      logger.error('Error closing PostgreSQL connection pool', { error: error.message });
      throw error;
    }
  }

  /**
   * Handle PostgreSQL errors and convert to application errors
   */
  private handlePostgreSQLError(error: any): Error {
    const errorCode = error.code;
    const errorMessage = error.message || 'Unknown PostgreSQL error';

    switch (errorCode) {
      case '23505': // unique_violation
        return new Error(`Duplicate entry: ${errorMessage}`);
      
      case '23503': // foreign_key_violation
        return new Error(`Foreign key constraint violation: ${errorMessage}`);
      
      case '23502': // not_null_violation
        return new Error(`Required field missing: ${errorMessage}`);
      
      case '23514': // check_violation
        return new Error(`Check constraint violation: ${errorMessage}`);
      
      case '42P01': // undefined_table
        return new Error(`Table does not exist: ${errorMessage}`);
      
      case '42703': // undefined_column
        return new Error(`Column does not exist: ${errorMessage}`);
      
      case '42883': // undefined_function
        return new Error(`Function does not exist: ${errorMessage}`);
      
      case '08003': // connection_does_not_exist
        return new Error(`Database connection lost: ${errorMessage}`);
      
      case '08006': // connection_failure
        return new Error(`Database connection failed: ${errorMessage}`);
      
      case '53300': // too_many_connections
        return new Error(`Too many database connections: ${errorMessage}`);
      
      default:
        return new Error(`PostgreSQL error (${errorCode}): ${errorMessage}`);
    }
  }

  /**
   * Check if client is connected
   */
  isConnectionActive(): boolean {
    return this.isConnected;
  }

  /**
   * Get the underlying pool for advanced operations
   */
  getPool(): Pool {
    return this.pool;
  }
}

// Export singleton instance
export const postgresClient = new PostgreSQLClient();