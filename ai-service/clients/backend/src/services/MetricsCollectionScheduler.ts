import * as cron from 'node-cron';
import { logger } from '../utils/logger';
import { analyticsService } from './AnalyticsService';
import { realTimeAnalyticsService } from './RealTimeAnalyticsService';
import { DateRange } from '../types';

/**
 * Scheduler for automated metrics collection and aggregation
 * Handles periodic collection of performance metrics and KPIs
 */
export class MetricsCollectionScheduler {
  private dailyCollectionJob: cron.ScheduledTask | null = null;
  private hourlyAggregationJob: cron.ScheduledTask | null = null;
  private realTimeUpdateJob: cron.ScheduledTask | null = null;
  private isRunning = false;

  /**
   * Start the metrics collection scheduler
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Metrics collection scheduler is already running');
      return;
    }

    try {
      this.startDailyCollection();
      this.startHourlyAggregation();
      this.startRealTimeUpdates();
      
      this.isRunning = true;
      logger.info('Metrics collection scheduler started successfully');
    } catch (error) {
      logger.error('Failed to start metrics collection scheduler', { error: error.message });
      throw error;
    }
  }

  /**
   * Stop the metrics collection scheduler
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    try {
      if (this.dailyCollectionJob) {
        this.dailyCollectionJob.stop();
        this.dailyCollectionJob = null;
      }

      if (this.hourlyAggregationJob) {
        this.hourlyAggregationJob.stop();
        this.hourlyAggregationJob = null;
      }

      if (this.realTimeUpdateJob) {
        this.realTimeUpdateJob.stop();
        this.realTimeUpdateJob = null;
      }

      this.isRunning = false;
      logger.info('Metrics collection scheduler stopped');
    } catch (error) {
      logger.error('Error stopping metrics collection scheduler', { error: error.message });
    }
  }

  /**
   * Check if scheduler is running
   */
  isSchedulerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Manually trigger metrics collection for a specific period
   */
  async triggerCollection(period: DateRange): Promise<void> {
    try {
      logger.info('Manual metrics collection triggered', { period });
      await analyticsService.collectPerformanceMetrics(period);
      logger.info('Manual metrics collection completed', { period });
    } catch (error) {
      logger.error('Manual metrics collection failed', { 
        error: error.message, 
        period 
      });
      throw error;
    }
  }

  /**
   * Get scheduler status and statistics
   */
  getStatus(): SchedulerStatus {
    return {
      isRunning: this.isRunning,
      jobs: {
        dailyCollection: {
          isRunning: this.dailyCollectionJob?.getStatus() === 'scheduled',
          schedule: '0 1 * * *', // Daily at 1 AM
          lastRun: this.getLastRunTime('dail