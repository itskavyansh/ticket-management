import { readFileSync } from 'fs';
import { join } from 'path';
import { postgresClient } from './client';
import { logger } from '../../utils/logger';

/**
 * Database migration management
 */
export class MigrationManager {
  /**
   * Create migrations table if it doesn't exist
   */
  private static async createMigrationsTable(): Promise<void> {
    const query = `
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    
    await postgresClient.query(query);
    logger.info('Migrations table created or verified');
  }

  /**
   * Check if a migration has been executed
   */
  private static async isMigrationExecuted(name: string): Promise<boolean> {
    const result = await postgresClient.queryOne<{ count: string }>(
      'SELECT COUNT(*) as count FROM migrations WHERE name = $1',
      [name]
    );
    
    return parseInt(result?.count || '0') > 0;
  }

  /**
   * Record a migration as executed
   */
  private static async recordMigration(name: string): Promise<void> {
    await postgresClient.query(
      'INSERT INTO migrations (name) VALUES ($1)',
      [name]
    );
    
    logger.info(`Migration recorded: ${name}`);
  }

  /**
   * Execute the initial schema migration
   */
  static async runInitialMigration(): Promise<void> {
    const migrationName = 'initial_schema';
    
    try {
      await this.createMigrationsTable();
      
      if (await this.isMigrationExecuted(migrationName)) {
        logger.info('Initial schema migration already executed');
        return;
      }
      
      logger.info('Executing initial schema migration');
      
      // Read and execute the schema file
      const schemaPath = join(__dirname, 'schema.sql');
      const schemaSQL = readFileSync(schemaPath, 'utf8');
      
      await postgresClient.transaction(async (client) => {
        // Split the schema into individual statements
        const statements = schemaSQL
          .split(';')
          .map(stmt => stmt.trim())
          .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
          if (statement.trim()) {
            await client.query(statement);
          }
        }
      });
      
      await this.recordMigration(migrationName);
      logger.info('Initial schema migration completed successfully');
      
    } catch (error) {
      logger.error('Initial schema migration failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Add sample data for development/testing
   */
  static async seedSampleData(): Promise<void> {
    const migrationName = 'sample_data_seed';
    
    try {
      if (await this.isMigrationExecuted(migrationName)) {
        logger.info('Sample data already seeded');
        return;
      }
      
      logger.info('Seeding sample data');
      
      await postgresClient.transaction(async (client) => {
        // Insert sample daily KPIs
        const sampleKPIs = [
          {
            date: '2024-01-01',
            total_tickets: 150,
            open_tickets: 45,
            resolved_tickets: 105,
            average_response_time_minutes: 25,
            average_resolution_time_minutes: 180,
            sla_compliance_rate: 92.5,
            customer_satisfaction_score: 4.2,
            technician_utilization_rate: 78.5,
            active_technicians: 12,
            sla_risk_tickets: 8,
            overdue_tickets: 3,
            escalated_tickets: 5,
            first_call_resolution_rate: 68.5
          },
          {
            date: '2024-01-02',
            total_tickets: 142,
            open_tickets: 38,
            resolved_tickets: 104,
            average_response_time_minutes: 22,
            average_resolution_time_minutes: 165,
            sla_compliance_rate: 94.2,
            customer_satisfaction_score: 4.3,
            technician_utilization_rate: 82.1,
            active_technicians: 12,
            sla_risk_tickets: 6,
            overdue_tickets: 2,
            escalated_tickets: 3,
            first_call_resolution_rate: 71.2
          }
        ];
        
        for (const kpi of sampleKPIs) {
          await client.query(`
            INSERT INTO daily_kpis (
              date, total_tickets, open_tickets, resolved_tickets,
              average_response_time_minutes, average_resolution_time_minutes,
              sla_compliance_rate, customer_satisfaction_score,
              technician_utilization_rate, active_technicians,
              sla_risk_tickets, overdue_tickets, escalated_tickets,
              first_call_resolution_rate
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
          `, [
            kpi.date, kpi.total_tickets, kpi.open_tickets, kpi.resolved_tickets,
            kpi.average_response_time_minutes, kpi.average_resolution_time_minutes,
            kpi.sla_compliance_rate, kpi.customer_satisfaction_score,
            kpi.technician_utilization_rate, kpi.active_technicians,
            kpi.sla_risk_tickets, kpi.overdue_tickets, kpi.escalated_tickets,
            kpi.first_call_resolution_rate
          ]);
        }
      });
      
      await this.recordMigration(migrationName);
      logger.info('Sample data seeded successfully');
      
    } catch (error) {
      logger.error('Sample data seeding failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Run all pending migrations
   */
  static async runMigrations(): Promise<void> {
    try {
      logger.info('Starting database migrations');
      
      await this.runInitialMigration();
      
      // Add more migrations here as needed
      // await this.runMigration002();
      // await this.runMigration003();
      
      logger.info('All migrations completed successfully');
      
    } catch (error) {
      logger.error('Migration process failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Get list of executed migrations
   */
  static async getExecutedMigrations(): Promise<Array<{
    id: number;
    name: string;
    executed_at: Date;
  }>> {
    try {
      await this.createMigrationsTable();
      
      const migrations = await postgresClient.queryRows<{
        id: number;
        name: string;
        executed_at: Date;
      }>(`
        SELECT id, name, executed_at 
        FROM migrations 
        ORDER BY executed_at ASC
      `);
      
      return migrations;
    } catch (error) {
      logger.error('Failed to get executed migrations', { error: error.message });
      throw error;
    }
  }

  /**
   * Reset database (drop all tables and recreate)
   */
  static async resetDatabase(): Promise<void> {
    logger.warn('Resetting database - all data will be lost');
    
    try {
      await postgresClient.transaction(async (client) => {
        // Drop all tables in the correct order (considering foreign keys)
        const dropQueries = [
          'DROP TABLE IF EXISTS alert_history CASCADE',
          'DROP TABLE IF EXISTS workload_predictions CASCADE',
          'DROP TABLE IF EXISTS time_tracking_analytics CASCADE',
          'DROP TABLE IF EXISTS daily_kpis CASCADE',
          'DROP TABLE IF EXISTS customer_metrics CASCADE',
          'DROP TABLE IF EXISTS ticket_analytics CASCADE',
          'DROP TABLE IF EXISTS sla_compliance CASCADE',
          'DROP TABLE IF EXISTS performance_metrics CASCADE',
          'DROP TABLE IF EXISTS migrations CASCADE'
        ];
        
        for (const query of dropQueries) {
          await client.query(query);
        }
        
        // Drop functions
        await client.query('DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE');
      });
      
      logger.info('Database reset completed');
      
      // Recreate schema
      await this.runMigrations();
      
    } catch (error) {
      logger.error('Database reset failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Check database health and schema integrity
   */
  static async checkDatabaseHealth(): Promise<{
    healthy: boolean;
    tables: Array<{
      name: string;
      exists: boolean;
      rowCount?: number;
    }>;
    migrations: Array<{
      name: string;
      executed_at: Date;
    }>;
  }> {
    try {
      const expectedTables = [
        'performance_metrics',
        'sla_compliance',
        'ticket_analytics',
        'customer_metrics',
        'daily_kpis',
        'time_tracking_analytics',
        'workload_predictions',
        'alert_history',
        'migrations'
      ];
      
      const tableResults = [];
      let allTablesExist = true;
      
      for (const tableName of expectedTables) {
        try {
          const result = await postgresClient.queryOne<{ count: string }>(`
            SELECT COUNT(*) as count 
            FROM information_schema.tables 
            WHERE table_name = $1
          `, [tableName]);
          
          const exists = parseInt(result?.count || '0') > 0;
          
          let rowCount;
          if (exists) {
            const countResult = await postgresClient.queryOne<{ count: string }>(`
              SELECT COUNT(*) as count FROM ${tableName}
            `);
            rowCount = parseInt(countResult?.count || '0');
          }
          
          tableResults.push({
            name: tableName,
            exists,
            rowCount
          });
          
          if (!exists) {
            allTablesExist = false;
          }
        } catch (error) {
          tableResults.push({
            name: tableName,
            exists: false
          });
          allTablesExist = false;
        }
      }
      
      const migrations = await this.getExecutedMigrations();
      
      return {
        healthy: allTablesExist,
        tables: tableResults,
        migrations
      };
      
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        healthy: false,
        tables: [],
        migrations: []
      };
    }
  }
}