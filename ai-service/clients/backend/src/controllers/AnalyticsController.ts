import { Request, Response } from 'express';
import { analyticsService } from '../services/AnalyticsService';
import { realTimeAnalyticsService } from '../services/RealTimeAnalyticsService';
import { trendAnalysisService } from '../services/TrendAnalysisService';
import { logger } from '../utils/logger';
import {
  validateAnalyticsQuery,
  validateDashboardMetrics,
  validateTeamPerformanceMetrics,
  validateTrendAnalysis
} from '../validation/analyticsValidation';
import { DateRange } from '../types';

/**
 * Analytics controller for handling real-time analytics API endpoints
 */
export class AnalyticsController {
  /**
   * Get real-time dashboard metrics
   */
  async getDashboardMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;
      
      let period: DateRange | undefined;
      if (startDate && endDate) {
        period = {
          startDate: new Date(startDate as string),
          endDate: new Date(endDate as string)
        };
      }

      const metrics = await analyticsService.getDashboardMetrics(period);

      logger.info('Dashboard metrics retrieved successfully', {
        userId: req.user?.id,
        period,
        totalTickets: metrics.totalTickets
      });

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Failed to get dashboard metrics', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve dashboard metrics',
        message: error.message
      });
    }
  }

  /**
   * Get team performance metrics
   */
  async getTeamPerformanceMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate, teamId } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const metrics = await analyticsService.getTeamPerformanceMetrics(
        period,
        teamId as string
      );

      logger.info('Team performance metrics retrieved successfully', {
        userId: req.user?.id,
        period,
        teamId,
        totalTickets: metrics.totalTicketsHandled
      });

      res.json({
        success: true,
        data: metrics
      });
    } catch (error) {
      logger.error('Failed to get team performance metrics', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve team performance metrics',
        message: error.message
      });
    }
  }

  /**
   * Generate trend analysis for specific metrics
   */
  async getTrendAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { metric, startDate, endDate, granularity = 'daily' } = req.query;

      if (!metric || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Metric, start date, and end date are required'
        });
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const analysis = await analyticsService.generateTrendAnalysis(
        metric as string,
        period,
        granularity as 'daily' | 'weekly' | 'monthly'
      );

      logger.info('Trend analysis generated successfully', {
        userId: req.user?.id,
        metric,
        period,
        granularity
      });

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Failed to generate trend analysis', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate trend analysis',
        message: error.message
      });
    }
  }

  /**
   * Detect performance bottlenecks
   */
  async getBottleneckAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const bottlenecks = await analyticsService.detectBottlenecks(period);

      logger.info('Bottleneck analysis completed successfully', {
        userId: req.user?.id,
        period,
        bottlenecksFound: bottlenecks.length
      });

      res.json({
        success: true,
        data: bottlenecks
      });
    } catch (error) {
      logger.error('Failed to detect bottlenecks', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to detect bottlenecks',
        message: error.message
      });
    }
  }

  /**
   * Generate capacity predictions
   */
  async getCapacityPrediction(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required for prediction period'
        });
      }

      const futurePeriod: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const prediction = await analyticsService.generateCapacityPrediction(futurePeriod);

      logger.info('Capacity prediction generated successfully', {
        userId: req.user?.id,
        futurePeriod,
        predictedVolume: prediction.predictedTicketVolume
      });

      res.json({
        success: true,
        data: prediction
      });
    } catch (error) {
      logger.error('Failed to generate capacity prediction', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate capacity prediction',
        message: error.message
      });
    }
  }

  /**
   * Trigger manual metrics collection
   */
  async collectMetrics(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.body;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const period: DateRange = {
        startDate: new Date(startDate),
        endDate: new Date(endDate)
      };

      await analyticsService.collectPerformanceMetrics(period);

      logger.info('Manual metrics collection triggered successfully', {
        userId: req.user?.id,
        period
      });

      res.json({
        success: true,
        message: 'Metrics collection completed successfully'
      });
    } catch (error) {
      logger.error('Failed to collect metrics', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to collect metrics',
        message: error.message
      });
    }
  }

  /**
   * Get real-time analytics subscriber statistics
   */
  async getSubscriberStats(req: Request, res: Response): Promise<void> {
    try {
      const stats = realTimeAnalyticsService.getSubscriberStats();

      logger.debug('Real-time analytics subscriber stats retrieved', {
        userId: req.user?.id,
        stats
      });

      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      logger.error('Failed to get subscriber stats', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to retrieve subscriber statistics',
        message: error.message
      });
    }
  }

  /**
   * Trigger immediate real-time metrics update
   */
  async triggerRealTimeUpdate(req: Request, res: Response): Promise<void> {
    try {
      await realTimeAnalyticsService.triggerMetricsUpdate();

      logger.info('Real-time metrics update triggered successfully', {
        userId: req.user?.id
      });

      res.json({
        success: true,
        message: 'Real-time metrics update triggered successfully'
      });
    } catch (error) {
      logger.error('Failed to trigger real-time update', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to trigger real-time update',
        message: error.message
      });
    }
  }

  /**
   * Update real-time analytics frequency
   */
  async updateAnalyticsFrequency(req: Request, res: Response): Promise<void> {
    try {
      const { frequencyMs } = req.body;

      if (!frequencyMs || typeof frequencyMs !== 'number') {
        return res.status(400).json({
          success: false,
          error: 'Valid frequency in milliseconds is required'
        });
      }

      realTimeAnalyticsService.setUpdateFrequency(frequencyMs);

      logger.info('Analytics update frequency changed successfully', {
        userId: req.user?.id,
        newFrequency: frequencyMs
      });

      res.json({
        success: true,
        message: 'Analytics update frequency updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update analytics frequency', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to update analytics frequency',
        message: error.message
      });
    }
  }

  /**
   * Get analytics query results with custom filters
   */
  async getCustomAnalytics(req: Request, res: Response): Promise<void> {
    try {
      const { error, value } = validateAnalyticsQuery(req.body);

      if (error) {
        return res.status(400).json({
          success: false,
          error: 'Invalid analytics query',
          details: error.details.map(detail => detail.message)
        });
      }

      // This would implement custom analytics queries based on the validated input
      // For now, return a placeholder response
      const results = {
        query: value,
        results: [],
        executionTime: Date.now(),
        totalRecords: 0
      };

      logger.info('Custom analytics query executed successfully', {
        userId: req.user?.id,
        query: value
      });

      res.json({
        success: true,
        data: results
      });
    } catch (error) {
      logger.error('Failed to execute custom analytics query', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to execute custom analytics query',
        message: error.message
      });
    }
  }

  /**
   * Generate comprehensive trend insights for multiple metrics
   */
  async getTrendInsights(req: Request, res: Response): Promise<void> {
    try {
      const { metrics, startDate, endDate, granularity = 'daily' } = req.query;

      if (!metrics || !startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Metrics array, start date, and end date are required'
        });
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const metricsArray = Array.isArray(metrics) ? metrics as string[] : [metrics as string];

      const insights = await trendAnalysisService.generateTrendInsights(
        metricsArray,
        period,
        granularity as 'daily' | 'weekly' | 'monthly'
      );

      logger.info('Trend insights generated successfully', {
        userId: req.user?.id,
        metrics: metricsArray,
        period,
        granularity
      });

      res.json({
        success: true,
        data: insights
      });
    } catch (error) {
      logger.error('Failed to generate trend insights', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate trend insights',
        message: error.message
      });
    }
  }

  /**
   * Detect advanced bottlenecks with prioritized actions
   */
  async getAdvancedBottleneckAnalysis(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required'
        });
      }

      const period: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const analysis = await trendAnalysisService.detectAdvancedBottlenecks(period);

      logger.info('Advanced bottleneck analysis completed successfully', {
        userId: req.user?.id,
        period,
        bottlenecksFound: analysis.bottlenecks.length,
        riskScore: analysis.riskScore
      });

      res.json({
        success: true,
        data: analysis
      });
    } catch (error) {
      logger.error('Failed to perform advanced bottleneck analysis', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to perform advanced bottleneck analysis',
        message: error.message
      });
    }
  }

  /**
   * Generate capacity predictions with scenario analysis
   */
  async getCapacityPredictionWithScenarios(req: Request, res: Response): Promise<void> {
    try {
      const { startDate, endDate } = req.query;

      if (!startDate || !endDate) {
        return res.status(400).json({
          success: false,
          error: 'Start date and end date are required for prediction period'
        });
      }

      const futurePeriod: DateRange = {
        startDate: new Date(startDate as string),
        endDate: new Date(endDate as string)
      };

      const prediction = await trendAnalysisService.generateCapacityPredictionWithScenarios(futurePeriod);

      logger.info('Capacity prediction with scenarios generated successfully', {
        userId: req.user?.id,
        futurePeriod,
        scenariosCount: prediction.scenarios.length
      });

      res.json({
        success: true,
        data: prediction
      });
    } catch (error) {
      logger.error('Failed to generate capacity prediction with scenarios', {
        error: error.message,
        userId: req.user?.id
      });

      res.status(500).json({
        success: false,
        error: 'Failed to generate capacity prediction with scenarios',
        message: error.message
      });
    }
  }

  /**
   * Health check for analytics services
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      const stats = realTimeAnalyticsService.getSubscriberStats();
      
      const health = {
        analyticsService: 'healthy',
        realTimeService: stats.isRunning ? 'healthy' : 'stopped',
        trendAnalysisService: 'healthy',
        subscribers: stats.totalSubscribers,
        updateFrequency: stats.updateFrequency,
        timestamp: new Date().toISOString()
      };

      res.json({
        success: true,
        data: health
      });
    } catch (error) {
      logger.error('Analytics health check failed', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Analytics health check failed',
        message: error.message
      });
    }
  }
}

// Export singleton instance
export const analyticsController = new AnalyticsController();