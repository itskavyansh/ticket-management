import { Response } from 'express';
import { analyticsService } from '../services/AnalyticsService';
import { dashboardService } from '../services/DashboardService';
import { logger } from '../utils/logger';
import { DateRange } from '../types';
import { AuthenticatedRequest } from '../types/auth';

/**
 * Dashboard controller for handling dashboard-specific data APIs
 * Focuses on widget data, charts, filtering, and export functionality
 */
export class DashboardController {
  /**
   * Get dashboard widget data with filtering and time range selection
   */
  async getDashboardWidgets(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { 
        startDate, 
        endDate, 
        widgets, 
        technicians, 
        customers, 
        categories, 
        priorities 
      } = req.query;

      // Parse date range
      let period: DateRange | undefined;
      if (startDate && endDate) {
        period = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      // Parse filters
      const filters = {
        technicians: technicians ? (technicians as string).split(',') : undefined,
        customers: customers ? (customers as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        priorities: priorities ? (priorities as string).split(',') : undefined
      };

      // Parse requested widgets
      const requestedWidgets = widgets ? (widgets as string).split(',') : [
        'kpi-summary',
        'ticket-volume',
        'response-times',
        'sla-compliance',
        'technician-workload',
        'category-breakdown'
      ];

      const widgetData = await dashboardService.getWidgetData(
        requestedWidgets,
        period,
        filters
      );

      logger.info('Dashboard widgets data retrieved successfully', {
        userId: req.user?.userId,
        period,
        widgets: requestedWidgets,
        filtersApplied: Object.keys(filters).filter(key => filters[key as keyof typeof filters])
      });

      res.json({
        success: true,
        data: widgetData,
        metadata: {
          period,
          filters,
          widgets: requestedWidgets,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get dashboard widgets', {
        error: errorMessage,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard widgets',
        message: errorMessage
      });
    }
  }

  /**
   * Get chart data for specific dashboard charts
   */
  async getChartData(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const { chartType } = req.params;
      const { 
        startDate, 
        endDate, 
        granularity = 'daily',
        technicians, 
        customers, 
        categories, 
        priorities 
      } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const filters = {
        technicians: technicians ? (technicians as string).split(',') : undefined,
        customers: customers ? (customers as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        priorities: priorities ? (priorities as string).split(',') : undefined
      };

      const chartData = await dashboardService.getChartData(
        chartType,
        period,
        granularity as 'hourly' | 'daily' | 'weekly' | 'monthly',
        filters
      );

      logger.info('Chart data retrieved successfully', {
        userId: req.user?.userId,
        chartType,
        period,
        granularity
      });

      res.json({
        success: true,
        data: chartData,
        metadata: {
          chartType,
          period,
          granularity,
          filters,
          generatedAt: new Date()
        }
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to get chart data', {
        error: errorMessage,
        userId: req.user?.userId,
        chartType: req.params.chartType
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve chart data',
        message: errorMessage
      });
    }
  }

  /**
   * Export dashboard report as PDF
   */
  async exportPDF(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        reportType = 'dashboard',
        startDate,
        endDate,
        technicians,
        customers,
        categories,
        priorities,
        includeCharts = 'true',
        template = 'standard'
      } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required for report generation'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const filters = {
        technicians: technicians ? (technicians as string).split(',') : undefined,
        customers: customers ? (customers as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        priorities: priorities ? (priorities as string).split(',') : undefined
      };

      const options = {
        includeCharts: includeCharts === 'true',
        template: template as string,
        format: 'pdf' as const
      };

      const pdfBuffer = await dashboardService.generateReport(
        reportType as string,
        period,
        filters,
        options
      );

      const filename = `${reportType}-report-${period.startDate.toISOString().split('T')[0]}-to-${period.endDate.toISOString().split('T')[0]}.pdf`;

      logger.info('PDF report generated successfully', {
        userId: req.user?.userId,
        reportType,
        period,
        filename,
        sizeBytes: pdfBuffer.length
      });

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', pdfBuffer.length);
      res.send(pdfBuffer);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate PDF report', {
        error: errorMessage,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate PDF report',
        message: errorMessage
      });
    }
  }

  /**
   * Export dashboard data as CSV
   */
  async exportCSV(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const {
        dataType = 'tickets',
        startDate,
        endDate,
        technicians,
        customers,
        categories,
        priorities,
        columns,
        includeHeaders = 'true'
      } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Start date and end date are required for data export'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const filters = {
        technicians: technicians ? (technicians as string).split(',') : undefined,
        customers: customers ? (customers as string).split(',') : undefined,
        categories: categories ? (categories as string).split(',') : undefined,
        priorities: priorities ? (priorities as string).split(',') : undefined
      };

      const options = {
        columns: columns ? (columns as string).split(',') : undefined,
        includeHeaders: includeHeaders === 'true',
        format: 'csv' as const
      };

      const csvData = await dashboardService.exportData(
        dataType as string,
        period,
        filters,
        options
      );

      const filename = `${dataType}-export-${period.startDate.toISOString().split('T')[0]}-to-${period.endDate.toISOString().split('T')[0]}.csv`;

      logger.info('CSV export generated successfully', {
        userId: req.user?.userId,
        dataType,
        period,
        filename,
        recordCount: csvData.split('\n').length - 1
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.send(csvData);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate CSV export', {
        error: errorMessage,
        userId: req.user?.userId
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate CSV export',
        message: errorMessage
      });
    }
  }

  /**
   * Health check for dashboard services
   */
  async healthCheck(req: AuthenticatedRequest, res: Response): Promise<void> {
    try {
      const health = await dashboardService.getHealthStatus();

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Dashboard health check failed', {
        error: errorMessage
      });

      res.status(500).json({
        success: false,
        error: 'Dashboard health check failed',
        message: errorMessage
      });
    }
  }
}

// Export singleton instance
export const dashboardController = new DashboardController();