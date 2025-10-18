import { createObjectCsvWriter } from 'csv-writer';
import { logger } from '../utils/logger';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

/**
 * CSV export service for generating CSV files from data
 * Handles data formatting, column selection, and file generation
 */
export class CSVExportService {
  private tempDir: string;

  constructor() {
    this.tempDir = path.join(process.cwd(), 'temp');
    this.ensureTempDir();
  }

  /**
   * Generate CSV string from data array
   */
  async generateCSV(
    data: any[],
    options: {
      columns?: string[];
      includeHeaders: boolean;
    }
  ): Promise<string> {
    try {
      if (!data || data.length === 0) {
        return options.includeHeaders ? this.getDefaultHeaders().join(',') + '\n' : '';
      }

      // Determine columns to include
      const columns = options.columns || Object.keys(data[0]);
      
      // Create temporary file
      const tempFileName = `export_${uuidv4()}.csv`;
      const tempFilePath = path.join(this.tempDir, tempFileName);

      // Prepare CSV writer configuration
      const csvWriter = createObjectCsvWriter({
        path: tempFilePath,
        header: columns.map(col => ({
          id: col,
          title: this.formatColumnTitle(col)
        })),
        encoding: 'utf8'
      });

      // Process and clean data
      const processedData = this.processDataForCSV(data, columns);

      // Write CSV file
      await csvWriter.writeRecords(processedData);

      // Read file content
      const csvContent = fs.readFileSync(tempFilePath, 'utf8');

      // Clean up temporary file
      fs.unlinkSync(tempFilePath);

      logger.info('CSV generated successfully', {
        recordCount: data.length,
        columnCount: columns.length,
        sizeBytes: csvContent.length
      });

      return csvContent;
    } catch (error) {
      logger.error('Failed to generate CSV', { error: error.message });
      throw new Error(`CSV generation failed: ${error.message}`);
    }
  }

  /**
   * Generate CSV for ticket data
   */
  async generateTicketCSV(
    tickets: any[],
    options: {
      columns?: string[];
      includeHeaders: boolean;
    }
  ): Promise<string> {
    const defaultColumns = [
      'ticket_id',
      'title',
      'status',
      'priority',
      'category',
      'customer_name',
      'technician_name',
      'created_at',
      'updated_at',
      'response_time_minutes',
      'resolution_time_minutes',
      'sla_deadline',
      'sla_met',
      'customer_satisfaction_score'
    ];

    const processedTickets = tickets.map(ticket => ({
      ...ticket,
      created_at: this.formatDate(ticket.created_at),
      updated_at: this.formatDate(ticket.updated_at),
      sla_deadline: this.formatDate(ticket.sla_deadline),
      sla_met: ticket.sla_met ? 'Yes' : 'No',
      response_time_minutes: this.formatNumber(ticket.response_time_minutes),
      resolution_time_minutes: this.formatNumber(ticket.resolution_time_minutes),
      customer_satisfaction_score: this.formatNumber(ticket.customer_satisfaction_score, 1)
    }));

    return this.generateCSV(processedTickets, {
      columns: options.columns || defaultColumns,
      includeHeaders: options.includeHeaders
    });
  }

  /**
   * Generate CSV for performance metrics
   */
  async generatePerformanceCSV(
    metrics: any[],
    options: {
      columns?: string[];
      includeHeaders: boolean;
    }
  ): Promise<string> {
    const defaultColumns = [
      'technician_id',
      'technician_name',
      'period_start',
      'period_end',
      'tickets_resolved',
      'average_resolution_time',
      'sla_compliance_rate',
      'customer_satisfaction_score',
      'utilization_rate',
      'first_call_resolution_rate'
    ];

    const processedMetrics = metrics.map(metric => ({
      ...metric,
      period_start: this.formatDate(metric.period_start),
      period_end: this.formatDate(metric.period_end),
      average_resolution_time: this.formatNumber(metric.average_resolution_time),
      sla_compliance_rate: this.formatPercentage(metric.sla_compliance_rate),
      customer_satisfaction_score: this.formatNumber(metric.customer_satisfaction_score, 1),
      utilization_rate: this.formatPercentage(metric.utilization_rate),
      first_call_resolution_rate: this.formatPercentage(metric.first_call_resolution_rate)
    }));

    return this.generateCSV(processedMetrics, {
      columns: options.columns || defaultColumns,
      includeHeaders: options.includeHeaders
    });
  }

  /**
   * Generate CSV for SLA compliance data
   */
  async generateSLACSV(
    slaData: any[],
    options: {
      columns?: string[];
      includeHeaders: boolean;
    }
  ): Promise<string> {
    const defaultColumns = [
      'ticket_id',
      'customer_name',
      'priority',
      'category',
      'sla_deadline',
      'resolution_time',
      'sla_met',
      'breach_duration_minutes',
      'risk_score',
      'escalated'
    ];

    const processedSLAData = slaData.map(sla => ({
      ...sla,
      sla_deadline: this.formatDate(sla.sla_deadline),
      resolution_time: this.formatDate(sla.resolution_time),
      sla_met: sla.sla_met ? 'Yes' : 'No',
      breach_duration_minutes: this.formatNumber(sla.breach_duration_minutes),
      risk_score: this.formatNumber(sla.risk_score, 2),
      escalated: sla.escalated ? 'Yes' : 'No'
    }));

    return this.generateCSV(processedSLAData, {
      columns: options.columns || defaultColumns,
      includeHeaders: options.includeHeaders
    });
  }

  /**
   * Generate CSV for analytics data
   */
  async generateAnalyticsCSV(
    analyticsData: any[],
    options: {
      columns?: string[];
      includeHeaders: boolean;
    }
  ): Promise<string> {
    const defaultColumns = [
      'date',
      'metric_name',
      'metric_value',
      'target_value',
      'variance',
      'trend'
    ];

    const processedAnalytics = analyticsData.map(analytics => ({
      ...analytics,
      date: this.formatDate(analytics.date),
      metric_value: this.formatNumber(analytics.metric_value, 2),
      target_value: this.formatNumber(analytics.target_value, 2),
      variance: this.formatNumber(analytics.variance, 2)
    }));

    return this.generateCSV(processedAnalytics, {
      columns: options.columns || defaultColumns,
      includeHeaders: options.includeHeaders
    });
  }

  // Private helper methods

  /**
   * Process data for CSV export
   */
  private processDataForCSV(data: any[], columns: string[]): any[] {
    return data.map(row => {
      const processedRow: any = {};
      
      columns.forEach(col => {
        let value = row[col];
        
        // Handle null/undefined values
        if (value === null || value === undefined) {
          value = '';
        }
        
        // Handle dates
        if (value instanceof Date) {
          value = this.formatDate(value);
        }
        
        // Handle objects (stringify them)
        if (typeof value === 'object' && value !== null) {
          value = JSON.stringify(value);
        }
        
        // Handle strings with commas or quotes
        if (typeof value === 'string') {
          value = this.escapeCSVValue(value);
        }
        
        processedRow[col] = value;
      });
      
      return processedRow;
    });
  }

  /**
   * Format column title for CSV header
   */
  private formatColumnTitle(column: string): string {
    return column
      .replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
  }

  /**
   * Format date for CSV
   */
  private formatDate(date: Date | string | null): string {
    if (!date) return '';
    
    const d = typeof date === 'string' ? new Date(date) : date;
    
    if (isNaN(d.getTime())) return '';
    
    return d.toISOString().split('T')[0] + ' ' + d.toTimeString().split(' ')[0];
  }

  /**
   * Format number for CSV
   */
  private formatNumber(num: number | null | undefined, decimals: number = 0): string {
    if (num === null || num === undefined || isNaN(num)) return '';
    return num.toFixed(decimals);
  }

  /**
   * Format percentage for CSV
   */
  private formatPercentage(num: number | null | undefined): string {
    if (num === null || num === undefined || isNaN(num)) return '';
    return num.toFixed(1) + '%';
  }

  /**
   * Escape CSV value to handle commas, quotes, and newlines
   */
  private escapeCSVValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return '"' + value.replace(/"/g, '""') + '"';
    }
    return value;
  }

  /**
   * Get default headers for empty CSV
   */
  private getDefaultHeaders(): string[] {
    return ['No Data Available'];
  }

  /**
   * Ensure temp directory exists
   */
  private ensureTempDir(): void {
    if (!fs.existsSync(this.tempDir)) {
      fs.mkdirSync(this.tempDir, { recursive: true });
    }
  }

  /**
   * Clean up old temporary files
   */
  async cleanupTempFiles(): Promise<void> {
    try {
      const files = fs.readdirSync(this.tempDir);
      const now = Date.now();
      const maxAge = 60 * 60 * 1000; // 1 hour

      for (const file of files) {
        const filePath = path.join(this.tempDir, file);
        const stats = fs.statSync(filePath);
        
        if (now - stats.mtime.getTime() > maxAge) {
          fs.unlinkSync(filePath);
          logger.debug('Cleaned up old temp file', { file });
        }
      }
    } catch (error) {
      logger.error('Failed to cleanup temp files', { error: error.message });
    }
  }
}

// Export singleton instance
export const csvExportService = new CSVExportService();