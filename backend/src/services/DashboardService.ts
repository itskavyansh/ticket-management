import { postgresClient } from '../database/postgresql/client';
import { logger } from '../utils/logger';
import { DateRange } from '../types';
import { analyticsService } from './AnalyticsService';
import { reportGeneratorService } from './ReportGeneratorService';
import { csvExportService } from './CSVExportService';

/**
 * Dashboard service for handling dashboard-specific data operations
 * Provides widget data, chart data, filtering, and export functionality
 */
export class DashboardService {
  private widgetCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly CACHE_TTL = 2 * 60 * 1000; // 2 minutes for dashboard data

  /**
   * Get widget data for dashboard with filtering
   */
  async getWidgetData(
    widgets: string[],
    period?: DateRange,
    filters?: {
      technicians?: string[];
      customers?: string[];
      categories?: string[];
      priorities?: string[];
    }
  ): Promise<Record<string, any>> {
    try {
      const cacheKey = this.generateCacheKey('widgets', widgets, period, filters);
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      const widgetData: Record<string, any> = {};

      // Process each requested widget
      for (const widget of widgets) {
        switch (widget) {
          case 'kpi-summary':
            widgetData[widget] = await this.getKPISummaryWidget(period, filters);
            break;
          case 'ticket-volume':
            widgetData[widget] = await this.getTicketVolumeWidget(period, filters);
            break;
          case 'response-times':
            widgetData[widget] = await this.getResponseTimesWidget(period, filters);
            break;
          case 'sla-compliance':
            widgetData[widget] = await this.getSLAComplianceWidget(period, filters);
            break;
          case 'technician-workload':
            widgetData[widget] = await this.getTechnicianWorkloadWidget(period, filters);
            break;
          case 'category-breakdown':
            widgetData[widget] = await this.getCategoryBreakdownWidget(period, filters);
            break;
          case 'customer-satisfaction':
            widgetData[widget] = await this.getCustomerSatisfactionWidget(period, filters);
            break;
          case 'recent-activity':
            widgetData[widget] = await this.getRecentActivityWidget(period, filters);
            break;
          default:
            logger.warn('Unknown widget requested', { widget });
        }
      }

      // Cache the results
      this.setCachedData(cacheKey, widgetData, this.CACHE_TTL);

      logger.info('Widget data generated successfully', {
        widgets,
        period,
        filtersApplied: filters ? Object.keys(filters).filter(key => filters[key as keyof typeof filters]).length : 0
      });

      return widgetData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get widget data', { error: errorMessage, widgets });
      throw new Error(`Widget data generation failed: ${errorMessage}`);
    }
  }

  /**
   * Get chart data for specific chart types
   */
  async getChartData(
    chartType: string,
    period: DateRange,
    granularity: 'hourly' | 'daily' | 'weekly' | 'monthly',
    filters?: {
      technicians?: string[];
      customers?: string[];
      categories?: string[];
      priorities?: string[];
    }
  ): Promise<any> {
    try {
      const cacheKey = this.generateCacheKey('chart', [chartType], period, filters, granularity);
      const cached = this.getCachedData(cacheKey);
      if (cached) {
        return cached;
      }

      let chartData: any;

      switch (chartType) {
        case 'ticket-trend':
          chartData = await this.getTicketTrendChart(period, granularity, filters);
          break;
        case 'response-time-trend':
          chartData = await this.getResponseTimeTrendChart(period, granularity, filters);
          break;
        case 'sla-performance':
          chartData = await this.getSLAPerformanceChart(period, granularity, filters);
          break;
        case 'technician-performance':
          chartData = await this.getTechnicianPerformanceChart(period, granularity, filters);
          break;
        case 'category-distribution':
          chartData = await this.getCategoryDistributionChart(period, filters);
          break;
        case 'priority-distribution':
          chartData = await this.getPriorityDistributionChart(period, filters);
          break;
        case 'customer-activity':
          chartData = await this.getCustomerActivityChart(period, granularity, filters);
          break;
        case 'workload-heatmap':
          chartData = await this.getWorkloadHeatmapChart(period, filters);
          break;
        default:
          throw new Error(`Unknown chart type: ${chartType}`);
      }

      // Cache the results
      this.setCachedData(cacheKey, chartData, this.CACHE_TTL);

      logger.info('Chart data generated successfully', {
        chartType,
        period,
        granularity,
        dataPoints: Array.isArray(chartData.data) ? chartData.data.length : 'N/A'
      });

      return chartData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get chart data', { error: errorMessage, chartType });
      throw new Error(`Chart data generation failed: ${errorMessage}`);
    }
  }

  /**
   * Get filtered dashboard data with advanced options
   */
  async getFilteredData(
    period: DateRange,
    filters: {
      technicians?: string[];
      customers?: string[];
      categories?: string[];
      priorities?: string[];
      departments?: string[];
      slaStatus?: string[];
      ticketStatus?: string[];
    },
    options: {
      groupBy: string;
      sortBy: string;
      sortOrder: 'asc' | 'desc';
      limit: number;
      offset: number;
    }
  ): Promise<{ data: any[]; total: number }> {
    try {
      const { startDate, endDate } = period;
      const { groupBy, sortBy, sortOrder, limit, offset } = options;

      // Build WHERE clause based on filters
      const whereConditions: string[] = ['ta.created_at >= $1', 'ta.created_at <= $2'];
      const queryParams: any[] = [startDate, endDate];
      let paramIndex = 3;

      if (filters.technicians?.length) {
        whereConditions.push(`ta.technician_id = ANY($${paramIndex})`);
        queryParams.push(filters.technicians);
        paramIndex++;
      }

      if (filters.customers?.length) {
        whereConditions.push(`ta.customer_id = ANY($${paramIndex})`);
        queryParams.push(filters.customers);
        paramIndex++;
      }

      if (filters.categories?.length) {
        whereConditions.push(`ta.category = ANY($${paramIndex})`);
        queryParams.push(filters.categories);
        paramIndex++;
      }

      if (filters.priorities?.length) {
        whereConditions.push(`ta.priority = ANY($${paramIndex})`);
        queryParams.push(filters.priorities);
        paramIndex++;
      }

      if (filters.ticketStatus?.length) {
        whereConditions.push(`ta.status = ANY($${paramIndex})`);
        queryParams.push(filters.ticketStatus);
        paramIndex++;
      }

      // Build GROUP BY clause
      let groupByClause = '';
      let selectClause = '';
      
      switch (groupBy) {
        case 'day':
          groupByClause = 'DATE(ta.created_at)';
          selectClause = 'DATE(ta.created_at) as date';
          break;
        case 'week':
          groupByClause = 'DATE_TRUNC(\'week\', ta.created_at)';
          selectClause = 'DATE_TRUNC(\'week\', ta.created_at) as week';
          break;
        case 'month':
          groupByClause = 'DATE_TRUNC(\'month\', ta.created_at)';
          selectClause = 'DATE_TRUNC(\'month\', ta.created_at) as month';
          break;
        case 'technician':
          groupByClause = 'ta.technician_id, ta.technician_name';
          selectClause = 'ta.technician_id, ta.technician_name';
          break;
        case 'category':
          groupByClause = 'ta.category';
          selectClause = 'ta.category';
          break;
        case 'priority':
          groupByClause = 'ta.priority';
          selectClause = 'ta.priority';
          break;
        case 'customer':
          groupByClause = 'ta.customer_id, ta.customer_name';
          selectClause = 'ta.customer_id, ta.customer_name';
          break;
        default:
          groupByClause = 'ta.ticket_id';
          selectClause = 'ta.ticket_id, ta.title, ta.status, ta.priority, ta.category';
      }

      // Build main query
      const mainQuery = `
        SELECT 
          ${selectClause},
          COUNT(*) as ticket_count,
          AVG(ta.response_time_minutes) as avg_response_time,
          AVG(ta.resolution_time_minutes) as avg_resolution_time,
          AVG(CASE WHEN sc.resolution_sla_met THEN 100 ELSE 0 END) as sla_compliance_rate,
          AVG(ta.customer_satisfaction_score) as avg_satisfaction_score
        FROM ticket_analytics ta
        LEFT JOIN sla_compliance sc ON ta.ticket_id = sc.ticket_id
        WHERE ${whereConditions.join(' AND ')}
        GROUP BY ${groupByClause}
        ORDER BY ${this.mapSortField(sortBy)} ${sortOrder.toUpperCase()}
        LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
      `;

      // Count query for pagination
      const countQuery = `
        SELECT COUNT(DISTINCT ${groupByClause}) as total
        FROM ticket_analytics ta
        LEFT JOIN sla_compliance sc ON ta.ticket_id = sc.ticket_id
        WHERE ${whereConditions.join(' AND ')}
      `;

      queryParams.push(limit, offset);

      const [data, countResult] = await Promise.all([
        postgresClient.queryRows(mainQuery, queryParams),
        postgresClient.queryOne(countQuery, queryParams.slice(0, -2))
      ]);

      const total = parseInt(countResult?.total || '0');

      logger.info('Filtered data retrieved successfully', {
        period,
        filtersApplied: Object.keys(filters).filter(key => filters[key as keyof typeof filters]).length,
        groupBy,
        resultCount: data.length,
        total
      });

      return { data, total };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get filtered data', { error: errorMessage });
      throw new Error(`Filtered data retrieval failed: ${errorMessage}`);
    }
  }

  /**
   * Generate report in specified format
   */
  async generateReport(
    reportType: string,
    period: DateRange,
    filters: any,
    options: {
      includeCharts: boolean;
      template: string;
      format: 'pdf';
    }
  ): Promise<Buffer> {
    try {
      // Get report data
      const reportData = await this.getReportData(reportType, period, filters);

      // Generate PDF report
      const pdfBuffer = await reportGeneratorService.generatePDFReport(
        reportType,
        reportData,
        {
          period,
          filters,
          includeCharts: options.includeCharts,
          template: options.template
        }
      );

      logger.info('Report generated successfully', {
        reportType,
        period,
        format: options.format,
        sizeBytes: pdfBuffer.length
      });

      return pdfBuffer;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate report', { error: errorMessage, reportType });
      throw new Error(`Report generation failed: ${errorMessage}`);
    }
  }

  /**
   * Export data in CSV format
   */
  async exportData(
    dataType: string,
    period: DateRange,
    filters: any,
    options: {
      columns?: string[];
      includeHeaders: boolean;
      format: 'csv';
    }
  ): Promise<string> {
    try {
      // Get export data
      const exportData = await this.getExportData(dataType, period, filters);

      // Generate CSV
      const csvData = await csvExportService.generateCSV(
        exportData,
        {
          columns: options.columns,
          includeHeaders: options.includeHeaders
        }
      );

      logger.info('Data export generated successfully', {
        dataType,
        period,
        format: options.format,
        recordCount: exportData.length
      });

      return csvData;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to export data', { error: errorMessage, dataType });
      throw new Error(`Data export failed: ${errorMessage}`);
    }
  }

  /**
   * Get available filter options
   */
  async getFilterOptions(period?: DateRange): Promise<any> {
    try {
      const endDate = period?.endDate || new Date();
      const startDate = period?.startDate || new Date(Date.now() - 90 * 24 * 60 * 60 * 1000); // 90 days ago

      const [
        technicians,
        customers,
        categories,
        priorities,
        departments,
        statuses
      ] = await Promise.all([
        this.getAvailableTechnicians(startDate, endDate),
        this.getAvailableCustomers(startDate, endDate),
        this.getAvailableCategories(startDate, endDate),
        this.getAvailablePriorities(startDate, endDate),
        this.getAvailableDepartments(startDate, endDate),
        this.getAvailableStatuses(startDate, endDate)
      ]);

      return {
        technicians,
        customers,
        categories,
        priorities,
        departments,
        statuses,
        dateRanges: this.getPresetDateRanges()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get filter options', { error: errorMessage });
      throw new Error(`Filter options retrieval failed: ${errorMessage}`);
    }
  }

  /**
   * Get real-time updates since specified timestamp
   */
  async getRealTimeUpdates(since: Date): Promise<any[]> {
    try {
      const query = `
        SELECT 
          'ticket' as type,
          ticket_id as id,
          title,
          status,
          priority,
          updated_at,
          technician_name
        FROM ticket_analytics
        WHERE updated_at > $1
        ORDER BY updated_at DESC
        LIMIT 50
      `;

      const updates = await postgresClient.queryRows(query, [since]);

      return updates;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get real-time updates', { error: errorMessage });
      throw new Error(`Real-time updates retrieval failed: ${errorMessage}`);
    }
  }

  /**
   * Get health status of dashboard services
   */
  async getHealthStatus(): Promise<any> {
    try {
      const cacheStats = {
        totalEntries: this.widgetCache.size,
        memoryUsage: process.memoryUsage().heapUsed
      };

      // Test database connectivity
      const dbTest = await postgresClient.queryOne('SELECT 1 as test');
      const dbHealthy = dbTest?.test === 1;

      return {
        dashboard: 'healthy',
        database: dbHealthy ? 'healthy' : 'unhealthy',
        cache: cacheStats,
        timestamp: new Date()
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Dashboard health check failed', { error: errorMessage });
      return {
        dashboard: 'unhealthy',
        database: 'unknown',
        error: errorMessage,
        timestamp: new Date()
      };
    }
  }

  // Private helper methods

  private async getKPISummaryWidget(period?: DateRange, filters?: any): Promise<any> {
    const dashboardMetrics = await analyticsService.getDashboardMetrics(period);
    
    return {
      totalTickets: dashboardMetrics.totalTickets,
      openTickets: dashboardMetrics.openTickets,
      resolvedTickets: dashboardMetrics.resolvedTickets,
      avgResponseTime: dashboardMetrics.averageResponseTime,
      avgResolutionTime: dashboardMetrics.averageResolutionTime,
      slaCompliance: dashboardMetrics.slaComplianceRate,
      satisfaction: dashboardMetrics.customerSatisfactionScore,
      utilization: dashboardMetrics.technicianUtilization,
      trends: dashboardMetrics.trends
    };
  }

  private async getTicketVolumeWidget(period?: DateRange, filters?: any): Promise<any> {
    // Implementation for ticket volume widget
    return { data: [], trend: 'stable' };
  }

  private async getResponseTimesWidget(period?: DateRange, filters?: any): Promise<any> {
    // Implementation for response times widget
    return { avgResponseTime: 0, trend: 'stable' };
  }

  private async getSLAComplianceWidget(period?: DateRange, filters?: any): Promise<any> {
    // Implementation for SLA compliance widget
    return { complianceRate: 0, trend: 'stable' };
  }

  private async getTechnicianWorkloadWidget(period?: DateRange, filters?: any): Promise<any> {
    // Implementation for technician workload widget
    return { workload: [], avgUtilization: 0 };
  }

  private async getCategoryBreakdownWidget(period?: DateRange, filters?: any): Promise<any> {
    // Implementation for category breakdown widget
    return { categories: [] };
  }

  private async getCustomerSatisfactionWidget(period?: DateRange, filters?: any): Promise<any> {
    // Implementation for customer satisfaction widget
    return { avgScore: 0, trend: 'stable' };
  }

  private async getRecentActivityWidget(period?: DateRange, filters?: any): Promise<any> {
    // Implementation for recent activity widget
    return { activities: [] };
  }

  private async getTicketTrendChart(period: DateRange, granularity: string, filters?: any): Promise<any> {
    // Implementation for ticket trend chart
    return { data: [], labels: [] };
  }

  private async getResponseTimeTrendChart(period: DateRange, granularity: string, filters?: any): Promise<any> {
    // Implementation for response time trend chart
    return { data: [], labels: [] };
  }

  private async getSLAPerformanceChart(period: DateRange, granularity: string, filters?: any): Promise<any> {
    // Implementation for SLA performance chart
    return { data: [], labels: [] };
  }

  private async getTechnicianPerformanceChart(period: DateRange, granularity: string, filters?: any): Promise<any> {
    // Implementation for technician performance chart
    return { data: [], labels: [] };
  }

  private async getCategoryDistributionChart(period: DateRange, filters?: any): Promise<any> {
    // Implementation for category distribution chart
    return { data: [], labels: [] };
  }

  private async getPriorityDistributionChart(period: DateRange, filters?: any): Promise<any> {
    // Implementation for priority distribution chart
    return { data: [], labels: [] };
  }

  private async getCustomerActivityChart(period: DateRange, granularity: string, filters?: any): Promise<any> {
    // Implementation for customer activity chart
    return { data: [], labels: [] };
  }

  private async getWorkloadHeatmapChart(period: DateRange, filters?: any): Promise<any> {
    // Implementation for workload heatmap chart
    return { data: [], labels: [] };
  }

  private async getReportData(reportType: string, period: DateRange, filters: any): Promise<any> {
    // Implementation for getting report data
    return {};
  }

  private async getExportData(dataType: string, period: DateRange, filters: any): Promise<any[]> {
    // Implementation for getting export data
    return [];
  }

  private async getAvailableTechnicians(startDate: Date, endDate: Date): Promise<any[]> {
    const query = `
      SELECT DISTINCT technician_id, technician_name
      FROM ticket_analytics
      WHERE created_at >= $1 AND created_at <= $2
        AND technician_id IS NOT NULL
      ORDER BY technician_name
    `;
    return postgresClient.queryRows(query, [startDate, endDate]);
  }

  private async getAvailableCustomers(startDate: Date, endDate: Date): Promise<any[]> {
    const query = `
      SELECT DISTINCT customer_id, customer_name
      FROM ticket_analytics
      WHERE created_at >= $1 AND created_at <= $2
      ORDER BY customer_name
    `;
    return postgresClient.queryRows(query, [startDate, endDate]);
  }

  private async getAvailableCategories(startDate: Date, endDate: Date): Promise<string[]> {
    const query = `
      SELECT DISTINCT category
      FROM ticket_analytics
      WHERE created_at >= $1 AND created_at <= $2
        AND category IS NOT NULL
      ORDER BY category
    `;
    const result = await postgresClient.queryRows(query, [startDate, endDate]);
    return result.map(row => row.category);
  }

  private async getAvailablePriorities(startDate: Date, endDate: Date): Promise<string[]> {
    const query = `
      SELECT DISTINCT priority
      FROM ticket_analytics
      WHERE created_at >= $1 AND created_at <= $2
        AND priority IS NOT NULL
      ORDER BY priority
    `;
    const result = await postgresClient.queryRows(query, [startDate, endDate]);
    return result.map(row => row.priority);
  }

  private async getAvailableDepartments(startDate: Date, endDate: Date): Promise<string[]> {
    const query = `
      SELECT DISTINCT department
      FROM ticket_analytics
      WHERE created_at >= $1 AND created_at <= $2
        AND department IS NOT NULL
      ORDER BY department
    `;
    const result = await postgresClient.queryRows(query, [startDate, endDate]);
    return result.map(row => row.department);
  }

  private async getAvailableStatuses(startDate: Date, endDate: Date): Promise<string[]> {
    const query = `
      SELECT DISTINCT status
      FROM ticket_analytics
      WHERE created_at >= $1 AND created_at <= $2
        AND status IS NOT NULL
      ORDER BY status
    `;
    const result = await postgresClient.queryRows(query, [startDate, endDate]);
    return result.map(row => row.status);
  }

  private getPresetDateRanges(): any[] {
    const now = new Date();
    return [
      {
        label: 'Last 7 days',
        startDate: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 30 days',
        startDate: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'Last 90 days',
        startDate: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000),
        endDate: now
      },
      {
        label: 'This month',
        startDate: new Date(now.getFullYear(), now.getMonth(), 1),
        endDate: now
      },
      {
        label: 'Last month',
        startDate: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        endDate: new Date(now.getFullYear(), now.getMonth(), 0)
      }
    ];
  }

  private mapSortField(sortBy: string): string {
    const fieldMap: Record<string, string> = {
      'date': 'ta.created_at',
      'tickets': 'ticket_count',
      'response_time': 'avg_response_time',
      'resolution_time': 'avg_resolution_time',
      'sla_compliance': 'sla_compliance_rate',
      'satisfaction': 'avg_satisfaction_score'
    };
    return fieldMap[sortBy] || 'ta.created_at';
  }

  private generateCacheKey(type: string, widgets: string[], period?: DateRange, filters?: any, granularity?: string): string {
    const parts = [
      type,
      widgets.join(','),
      period ? `${period.startDate.getTime()}-${period.endDate.getTime()}` : 'no-period',
      filters ? JSON.stringify(filters) : 'no-filters',
      granularity || 'no-granularity'
    ];
    return parts.join('|');
  }

  private getCachedData(key: string): any | null {
    const cached = this.widgetCache.get(key);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }
    this.widgetCache.delete(key);
    return null;
  }

  private setCachedData(key: string, data: any, ttl: number): void {
    this.widgetCache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }
}

// Export singleton instance
export const dashboardService = new DashboardService();