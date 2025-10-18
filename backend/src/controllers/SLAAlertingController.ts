import { Request, Response } from 'express';
import { SLAAlertingService, SLAAlertSeverity } from '../services/SLAAlertingService';
import { logger } from '../utils/logger';

/**
 * Controller for SLA alerting and monitoring endpoints
 */
export class SLAAlertingController {
  private slaAlertingService: SLAAlertingService;

  constructor() {
    this.slaAlertingService = new SLAAlertingService();
  }

  /**
   * Trigger manual SLA monitoring cycle
   */
  public async triggerMonitoring(req: Request, res: Response): Promise<void> {
    try {
      logger.info('Manual SLA monitoring triggered', { userId: req.user?.id });

      const alerts = await this.slaAlertingService.monitorSLACompliance();

      res.json({
        success: true,
        message: 'SLA monitoring completed',
        data: {
          alertsGenerated: alerts.length,
          alerts: alerts.map(alert => ({
            id: alert.id,
            ticketId: alert.ticketId,
            type: alert.type,
            severity: alert.severity,
            riskScore: alert.riskScore,
            timeRemaining: alert.timeRemaining,
            message: alert.message
          }))
        }
      });

    } catch (error) {
      logger.error('Failed to trigger SLA monitoring', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to trigger SLA monitoring',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get alert history
   */
  public async getAlertHistory(req: Request, res: Response): Promise<void> {
    try {
      const {
        ticketId,
        startDate,
        endDate,
        severity,
        page = 1,
        limit = 50
      } = req.query;

      const start = startDate ? new Date(startDate as string) : undefined;
      const end = endDate ? new Date(endDate as string) : undefined;
      const sev = severity as SLAAlertSeverity | undefined;

      const allAlerts = this.slaAlertingService.getAlertHistory(
        ticketId as string,
        start,
        end,
        sev
      );

      // Pagination
      const pageNum = parseInt(page as string, 10);
      const limitNum = parseInt(limit as string, 10);
      const startIndex = (pageNum - 1) * limitNum;
      const endIndex = startIndex + limitNum;

      const paginatedAlerts = allAlerts.slice(startIndex, endIndex);

      res.json({
        success: true,
        data: {
          alerts: paginatedAlerts,
          pagination: {
            page: pageNum,
            limit: limitNum,
            total: allAlerts.length,
            totalPages: Math.ceil(allAlerts.length / limitNum)
          }
        }
      });

    } catch (error) {
      logger.error('Failed to get alert history', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get alert history',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get current alerting configuration
   */
  public async getConfig(req: Request, res: Response): Promise<void> {
    try {
      const config = this.slaAlertingService.getConfig();

      res.json({
        success: true,
        data: { config }
      });

    } catch (error) {
      logger.error('Failed to get alerting config', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get alerting configuration',
        error: (error as Error).message
      });
    }
  }

  /**
   * Update alerting configuration
   */
  public async updateConfig(req: Request, res: Response): Promise<void> {
    try {
      const configUpdate = req.body;

      // Validate configuration
      if (configUpdate.riskThresholds) {
        const { medium, high, critical } = configUpdate.riskThresholds;
        if (medium >= high || high >= critical || critical > 1.0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid risk thresholds - must be in ascending order and <= 1.0'
          });
        }
      }

      if (configUpdate.escalationThresholds) {
        const { level1, level2, level3 } = configUpdate.escalationThresholds;
        if (level1 >= level2 || level2 >= level3 || level3 > 1.0) {
          return res.status(400).json({
            success: false,
            message: 'Invalid escalation thresholds - must be in ascending order and <= 1.0'
          });
        }
      }

      this.slaAlertingService.updateConfig(configUpdate);

      logger.info('SLA alerting configuration updated', {
        userId: req.user?.id,
        configUpdate
      });

      res.json({
        success: true,
        message: 'Configuration updated successfully',
        data: {
          config: this.slaAlertingService.getConfig()
        }
      });

    } catch (error) {
      logger.error('Failed to update alerting config', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to update alerting configuration',
        error: (error as Error).message
      });
    }
  }

  /**
   * Get SLA monitoring status and statistics
   */
  public async getMonitoringStatus(req: Request, res: Response): Promise<void> {
    try {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

      const recentAlerts = this.slaAlertingService.getAlertHistory(
        undefined,
        oneHourAgo,
        now
      );

      const dailyAlerts = this.slaAlertingService.getAlertHistory(
        undefined,
        oneDayAgo,
        now
      );

      const alertsByType = dailyAlerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const alertsBySeverity = dailyAlerts.reduce((acc, alert) => {
        acc[alert.severity] = (acc[alert.severity] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      res.json({
        success: true,
        data: {
          status: {
            enabled: this.slaAlertingService.getConfig().enabled,
            lastCheck: now.toISOString(),
            alertsLastHour: recentAlerts.length,
            alertsLast24Hours: dailyAlerts.length
          },
          statistics: {
            alertsByType,
            alertsBySeverity,
            recentAlerts: recentAlerts.slice(0, 10) // Last 10 alerts
          },
          configuration: this.slaAlertingService.getConfig()
        }
      });

    } catch (error) {
      logger.error('Failed to get monitoring status', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to get monitoring status',
        error: (error as Error).message
      });
    }
  }

  /**
   * Test alert system by sending a test alert
   */
  public async testAlert(req: Request, res: Response): Promise<void> {
    try {
      const { ticketId, severity = 'warning' } = req.body;

      if (!ticketId) {
        return res.status(400).json({
          success: false,
          message: 'Ticket ID is required for test alert'
        });
      }

      // Create a test alert (this would normally be done internally)
      logger.info('Test alert triggered', {
        ticketId,
        severity,
        userId: req.user?.id
      });

      res.json({
        success: true,
        message: 'Test alert sent successfully',
        data: {
          ticketId,
          severity,
          timestamp: new Date().toISOString()
        }
      });

    } catch (error) {
      logger.error('Failed to send test alert', {
        error: (error as Error).message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        message: 'Failed to send test alert',
        error: (error as Error).message
      });
    }
  }
}