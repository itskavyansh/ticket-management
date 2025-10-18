import { Request, Response } from 'express';
import { ProductivityInsightsService } from '../services/ProductivityInsightsService';
import { TimeTrackingService } from '../services/TimeTrackingService';
import { TicketService } from '../services/TicketService';
import { DateRange } from '../types';
import { logger } from '../utils/logger';

export class ProductivityInsightsController {
  private productivityInsightsService: ProductivityInsightsService;

  constructor() {
    const timeTrackingService = new TimeTrackingService();
    const ticketService = new TicketService();
    this.productivityInsightsService = new ProductivityInsightsService(
      timeTrackingService,
      ticketService
    );
  }

  /**
   * Get throughput metrics for a technician
   */
  public getThroughputMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const metrics = await this.productivityInsightsService.calculateThroughputMetrics(
        technicianId,
        period
      );

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting throughput metrics:', error);
      res.status(500).json({
        error: 'Failed to calculate throughput metrics',
        code: 'THROUGHPUT_CALCULATION_ERROR'
      });
    }
  };

  /**
   * Get resolution time analysis for a technician
   */
  public getResolutionTimeAnalysis = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const analysis = await this.productivityInsightsService.analyzeResolutionTimes(
        technicianId,
        period
      );

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Error getting resolution time analysis:', error);
      res.status(500).json({
        error: 'Failed to analyze resolution times',
        code: 'RESOLUTION_ANALYSIS_ERROR'
      });
    }
  };

  /**
   * Get individual performance metrics with insights
   */
  public getIndividualPerformanceMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const metrics = await this.productivityInsightsService.generateIndividualPerformanceMetrics(
        technicianId,
        period
      );

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Error getting individual performance metrics:', error);
      res.status(500).json({
        error: 'Failed to generate performance metrics',
        code: 'PERFORMANCE_METRICS_ERROR'
      });
    }
  };

  /**
   * Get team productivity report
   */
  public getTeamProductivityReport = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, teamId } = req.query;
      const { technicianIds } = req.body;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE'
        });
        return;
      }

      if (!technicianIds || !Array.isArray(technicianIds) || technicianIds.length === 0) {
        res.status(400).json({
          error: 'Technician IDs array is required',
          code: 'MISSING_TECHNICIAN_IDS'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const report = await this.productivityInsightsService.generateTeamProductivityReport(
        technicianIds,
        period,
        teamId as string
      );

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      logger.error('Error generating team productivity report:', error);
      res.status(500).json({
        error: 'Failed to generate team productivity report',
        code: 'TEAM_REPORT_ERROR'
      });
    }
  };

  /**
   * Get productivity trends for technicians
   */
  public getProductivityTrends = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;
      const { technicianIds } = req.body;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE'
        });
        return;
      }

      if (!technicianIds || !Array.isArray(technicianIds) || technicianIds.length === 0) {
        res.status(400).json({
          error: 'Technician IDs array is required',
          code: 'MISSING_TECHNICIAN_IDS'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const trends = await this.productivityInsightsService.generateProductivityTrends(
        technicianIds,
        period
      );

      res.json({
        success: true,
        data: trends
      });
    } catch (error) {
      logger.error('Error getting productivity trends:', error);
      res.status(500).json({
        error: 'Failed to generate productivity trends',
        code: 'PRODUCTIVITY_TRENDS_ERROR'
      });
    }
  };

  /**
   * Get productivity insights dashboard data
   */
  public getProductivityDashboard = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId, startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      // Get comprehensive dashboard data
      const dashboardData: any = {};

      if (technicianId) {
        // Individual technician dashboard
        const [throughputMetrics, resolutionAnalysis, performanceMetrics] = await Promise.all([
          this.productivityInsightsService.calculateThroughputMetrics(
            technicianId as string,
            period
          ),
          this.productivityInsightsService.analyzeResolutionTimes(
            technicianId as string,
            period
          ),
          this.productivityInsightsService.generateIndividualPerformanceMetrics(
            technicianId as string,
            period
          )
        ]);

        dashboardData.type = 'individual';
        dashboardData.technicianId = technicianId;
        dashboardData.throughputMetrics = throughputMetrics;
        dashboardData.resolutionAnalysis = resolutionAnalysis;
        dashboardData.performanceMetrics = performanceMetrics;
      } else {
        // Team dashboard - would need team member list
        dashboardData.type = 'team';
        dashboardData.message = 'Team dashboard requires technician IDs in request body';
      }

      res.json({
        success: true,
        data: dashboardData,
        generatedAt: new Date()
      });
    } catch (error) {
      logger.error('Error getting productivity dashboard:', error);
      res.status(500).json({
        error: 'Failed to generate productivity dashboard',
        code: 'DASHBOARD_ERROR'
      });
    }
  };

  /**
   * Get performance comparison between technicians
   */
  public getPerformanceComparison = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate } = req.query;
      const { technicianIds } = req.body;

      if (!startDate || !endDate) {
        res.status(400).json({
          error: 'Start date and end date are required',
          code: 'MISSING_DATE_RANGE'
        });
        return;
      }

      if (!technicianIds || !Array.isArray(technicianIds) || technicianIds.length < 2) {
        res.status(400).json({
          error: 'At least 2 technician IDs are required for comparison',
          code: 'INSUFFICIENT_TECHNICIAN_IDS'
        });
        return;
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      // Get performance metrics for all technicians
      const performanceComparison = await Promise.all(
        technicianIds.map(async (technicianId: string) => {
          try {
            return await this.productivityInsightsService.generateIndividualPerformanceMetrics(
              technicianId,
              period
            );
          } catch (error) {
            logger.warn(`Failed to get metrics for technician ${technicianId}:`, error);
            return null;
          }
        })
      );

      // Filter out failed requests
      const validMetrics = performanceComparison.filter(metrics => metrics !== null);

      // Calculate comparison insights
      const comparisonInsights = this.generateComparisonInsights(validMetrics);

      res.json({
        success: true,
        data: {
          period,
          technicians: validMetrics,
          insights: comparisonInsights,
          comparedAt: new Date()
        }
      });
    } catch (error) {
      logger.error('Error getting performance comparison:', error);
      res.status(500).json({
        error: 'Failed to generate performance comparison',
        code: 'COMPARISON_ERROR'
      });
    }
  };

  /**
   * Generate comparison insights between technicians
   */
  private generateComparisonInsights(metrics: any[]): any[] {
    if (metrics.length < 2) return [];

    const insights = [];

    // Find top performer by tickets resolved
    const topByTickets = metrics.reduce((prev, current) => 
      (prev.ticketsResolved > current.ticketsResolved) ? prev : current
    );

    insights.push({
      type: 'top_performer',
      metric: 'ticketsResolved',
      technicianId: topByTickets.technicianId,
      value: topByTickets.ticketsResolved,
      description: `Resolved the most tickets (${topByTickets.ticketsResolved})`
    });

    // Find best resolution time
    const bestResolutionTime = metrics.reduce((prev, current) => 
      (prev.averageResolutionTime < current.averageResolutionTime) ? prev : current
    );

    insights.push({
      type: 'best_resolution_time',
      metric: 'averageResolutionTime',
      technicianId: bestResolutionTime.technicianId,
      value: bestResolutionTime.averageResolutionTime,
      description: `Fastest average resolution time (${Math.round(bestResolutionTime.averageResolutionTime)} minutes)`
    });

    // Find highest SLA compliance
    const bestSLA = metrics.reduce((prev, current) => 
      (prev.slaComplianceRate > current.slaComplianceRate) ? prev : current
    );

    insights.push({
      type: 'best_sla_compliance',
      metric: 'slaComplianceRate',
      technicianId: bestSLA.technicianId,
      value: bestSLA.slaComplianceRate,
      description: `Highest SLA compliance rate (${bestSLA.slaComplianceRate.toFixed(1)}%)`
    });

    return insights;
  }
}