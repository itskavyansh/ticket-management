import { Request, Response } from 'express';
import { SLADashboardService } from '../services/SLADashboardService';
import { logger } from '../utils/logger';

/**
 * Controller for SLA dashboard endpoints
 */
export class SLADashboardController {
  private slaDashboardService: SLADashboardService;

  constructor() {
    this.slaDashboardService = new SLADashboardService();
  }

  /**
   * Get comprehensive SLA dashboard data
   */
  public async getDashboardData(req: Request, res: Response): Promise<void> {
    try {
      const { refresh = 'false' } = req.query;
      const forceRefresh = refresh === 'true';

      logger.info('SLA dashboard data requested', { 
        userId: req.user?.id,
        forceRefresh 
      });

      const dashboardData = await this.slaDashboardService.getDashboardData(forceRefresh);

      res.json({
        success: true,
        data: dashboardData
      });

    } catch (error) {
      logger.error('Failed to get SLA dashboard data', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get SLA dashboard data',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get SLA overview statistics only
   */
  public async getOverview(req: Request, res: Response): Promise<void> {
    try {
      const dashboardData = await this.slaDashboardService.getDashboardData();

      res.json({
        success: true,
        data: {
          overview: dashboardData.overview,
          lastRefresh: dashboardData.lastRefresh
        }
      });

    } catch (error) {
      logger.error('Failed to get SLA overview', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get SLA overview',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get high-risk tickets
   */
  public async getHighRiskTickets(req: Request, res: Response): Promise<void> {
    try {
      const { limit = '20' } = req.query;
      const limitNum = parseInt(limit as string, 10);

      const dashboardData = await this.slaDashboardService.getDashboardData();

      res.json({
        success: true,
        data: {
          highRiskTickets: dashboardData.highRiskTickets.slice(0, limitNum),
          totalCount: dashboardData.highRiskTickets.length,
          lastRefresh: dashboardData.lastRefresh
        }
      });

    } catch (error) {
      logger.error('Failed to get high-risk tickets', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get high-risk tickets',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get SLA trend data
   */
  public async getTrendData(req: Request, res: Response): Promise<void> {
    try {
      const { days = '30' } = req.query;
      const daysNum = parseInt(days as string, 10);

      const dashboardData = await this.slaDashboardService.getDashboardData();

      // Filter trend data based on requested days
      const filteredTrendData = dashboardData.trendData.slice(-daysNum);

      res.json({
        success: true,
        data: {
          trendData: filteredTrendData,
          lastRefresh: dashboardData.lastRefresh
        }
      });

    } catch (error) {
      logger.error('Failed to get SLA trend data', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get SLA trend data',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get performance by technician
   */
  public async getPerformanceByTechnician(req: Request, res: Response): Promise<void> {
    try {
      const dashboardData = await this.slaDashboardService.getDashboardData();

      res.json({
        success: true,
        data: {
          performanceByTechnician: dashboardData.performanceByTechnician,
          lastRefresh: dashboardData.lastRefresh
        }
      });

    } catch (error) {
      logger.error('Failed to get performance by technician', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get performance by technician',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get performance by customer
   */
  public async getPerformanceByCustomer(req: Request, res: Response): Promise<void> {
    try {
      const dashboardData = await this.slaDashboardService.getDashboardData();

      res.json({
        success: true,
        data: {
          performanceByCustomer: dashboardData.performanceByCustomer,
          lastRefresh: dashboardData.lastRefresh
        }
      });

    } catch (error) {
      logger.error('Failed to get performance by customer', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get performance by customer',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get risk distribution
   */
  public async getRiskDistribution(req: Request, res: Response): Promise<void> {
    try {
      const dashboardData = await this.slaDashboardService.getDashboardData();

      res.json({
        success: true,
        data: {
          riskDistribution: dashboardData.riskDistribution,
          lastRefresh: dashboardData.lastRefresh
        }
      });

    } catch (error) {
      logger.error('Failed to get risk distribution', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get risk distribution',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get alert summary
   */
  public async getAlertSummary(req: Request, res: Response): Promise<void> {
    try {
      const dashboardData = await this.slaDashboardService.getDashboardData();

      res.json({
        success: true,
        data: {
          alertSummary: dashboardData.alertSummary,
          lastRefresh: dashboardData.lastRefresh
        }
      });

    } catch (error) {
      logger.error('Failed to get alert summary', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get alert summary',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get detailed SLA information for a specific ticket
   */
  public async getTicketSLADetails(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId } = req.params;

      if (!ticketId) {
        return res.status(400).json({
          success: false,
          message: 'Ticket ID is required'
        });
      }

      const ticketDetails = await this.slaDashboardService.getTicketSLADetails(ticketId);

      if (!ticketDetails) {
        return res.status(404).json({
          success: false,
          message: 'Ticket not found'
        });
      }

      res.json({
        success: true,
        data: ticketDetails
      });

    } catch (error) {
      logger.error('Failed to get ticket SLA details', {
        error: (error as Error).message,
        ticketId: req.params.ticketId,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get ticket SLA details',
        error: (error as Error).message
      });
    }
  }

  /**
   * Clear dashboard cache to force refresh
   */
  public async clearCache(req: Request, res: Response): Promise<void> {
    try {
      this.slaDashboardService.clearCache();

      logger.info('SLA dashboard cache cleared', { userId: req.user?.id });

      res.json({
        success: true,
        message: 'Dashboard cache cleared successfully'
      });

    } catch (error) {
      logger.error('Failed to clear dashboard cache', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to clear dashboard cache',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get real-time SLA status for dashboard widgets
   */
  public async getRealTimeStatus(req: Request, res: Response): Promise<void> {
    try {
      // Force refresh for real-time data
      const dashboardData = await this.slaDashboardService.getDashboardData(true);

      // Return only essential real-time data
      const realTimeData = {
        overview: dashboardData.overview,
        riskDistribution: dashboardData.riskDistribution,
        criticalTickets: dashboardData.highRiskTickets
          .filter(ticket => ticket.riskLevel === 'critical')
          .slice(0, 5),
        recentAlerts: dashboardData.alertSummary.recentAlerts.slice(0, 5),
        lastRefresh: dashboardData.lastRefresh
      };

      res.json({
        success: true,
        data: realTimeData
      });

    } catch (error) {
      logger.error('Failed to get real-time SLA status', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get real-time SLA status',
        error: (error as Error).message
      });
    }
  }
}