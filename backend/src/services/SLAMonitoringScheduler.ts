import cron from 'node-cron';
import { SLAAlertingService } from './SLAAlertingService';
import { logger } from '../utils/logger';

/**
 * Scheduler for automated SLA monitoring
 */
export class SLAMonitoringScheduler {
  private slaAlertingService: SLAAlertingService;
  private isRunning: boolean = false;
  private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

  constructor() {
    this.slaAlertingService = new SLAAlertingService();
  }

  /**
   * Start the SLA monitoring scheduler
   */
  public start(): void {
    if (this.isRunning) {
      logger.warn('SLA monitoring scheduler is already running');
      return;
    }

    try {
      // Schedule main monitoring every 15 minutes
      const mainMonitoringTask = cron.schedule('*/15 * * * *', async () => {
        await this.runMonitoringCycle('scheduled');
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      // Schedule critical ticket monitoring every 5 minutes
      const criticalMonitoringTask = cron.schedule('*/5 * * * *', async () => {
        await this.runCriticalTicketMonitoring();
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      // Schedule daily cleanup at midnight
      const cleanupTask = cron.schedule('0 0 * * *', async () => {
        await this.runDailyCleanup();
      }, {
        scheduled: false,
        timezone: 'UTC'
      });

      // Store tasks for management
      this.scheduledTasks.set('main_monitoring', mainMonitoringTask);
      this.scheduledTasks.set('critical_monitoring', criticalMonitoringTask);
      this.scheduledTasks.set('daily_cleanup', cleanupTask);

      // Start all tasks
      mainMonitoringTask.start();
      criticalMonitoringTask.start();
      cleanupTask.start();

      this.isRunning = true;
      logger.info('SLA monitoring scheduler started successfully', {
        tasks: Array.from(this.scheduledTasks.keys())
      });

    } catch (error) {
      logger.error('Failed to start SLA monitoring scheduler', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Stop the SLA monitoring scheduler
   */
  public stop(): void {
    if (!this.isRunning) {
      logger.warn('SLA monitoring scheduler is not running');
      return;
    }

    try {
      // Stop all scheduled tasks
      for (const [name, task] of this.scheduledTasks) {
        task.stop();
        logger.debug(`Stopped scheduled task: ${name}`);
      }

      this.scheduledTasks.clear();
      this.isRunning = false;

      logger.info('SLA monitoring scheduler stopped successfully');

    } catch (error) {
      logger.error('Failed to stop SLA monitoring scheduler', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Run a complete monitoring cycle
   */
  private async runMonitoringCycle(trigger: 'scheduled' | 'manual'): Promise<void> {
    const startTime = Date.now();
    
    try {
      logger.info(`Starting SLA monitoring cycle (${trigger})`);

      const alerts = await this.slaAlertingService.monitorSLACompliance();

      const duration = Date.now() - startTime;
      
      logger.info(`SLA monitoring cycle completed (${trigger})`, {
        alertsGenerated: alerts.length,
        durationMs: duration,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        highRiskAlerts: alerts.filter(a => a.severity === 'error').length
      });

      // Log summary of alerts by type
      const alertsByType = alerts.reduce((acc, alert) => {
        acc[alert.type] = (acc[alert.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      if (Object.keys(alertsByType).length > 0) {
        logger.info('Alert summary', { alertsByType });
      }

    } catch (error) {
      logger.error(`SLA monitoring cycle failed (${trigger})`, {
        error: (error as Error).message,
        durationMs: Date.now() - startTime
      });
    }
  }

  /**
   * Run focused monitoring for critical tickets only
   */
  private async runCriticalTicketMonitoring(): Promise<void> {
    try {
      logger.debug('Running critical ticket monitoring');

      // This would be a more focused check for critical/high priority tickets
      // For now, we'll use the same monitoring but could be optimized
      const alerts = await this.slaAlertingService.monitorSLACompliance();
      
      const criticalAlerts = alerts.filter(alert => 
        alert.severity === 'critical' || 
        alert.metadata.priority === 'critical'
      );

      if (criticalAlerts.length > 0) {
        logger.warn(`Critical SLA alerts detected`, {
          count: criticalAlerts.length,
          tickets: criticalAlerts.map(a => a.ticketId)
        });
      }

    } catch (error) {
      logger.error('Critical ticket monitoring failed', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Run daily cleanup tasks
   */
  private async runDailyCleanup(): Promise<void> {
    try {
      logger.info('Running daily SLA monitoring cleanup');

      // Clean up old alert history (keep last 30 days)
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const allAlerts = this.slaAlertingService.getAlertHistory();
      const oldAlerts = allAlerts.filter(alert => alert.createdAt < thirtyDaysAgo);

      if (oldAlerts.length > 0) {
        logger.info(`Cleaning up ${oldAlerts.length} old alerts`);
        // In a real implementation, you'd remove these from persistent storage
      }

      // Log daily statistics
      const last24Hours = new Date();
      last24Hours.setHours(last24Hours.getHours() - 24);

      const recentAlerts = this.slaAlertingService.getAlertHistory(
        undefined,
        last24Hours
      );

      const stats = {
        totalAlerts: recentAlerts.length,
        criticalAlerts: recentAlerts.filter(a => a.severity === 'critical').length,
        errorAlerts: recentAlerts.filter(a => a.severity === 'error').length,
        warningAlerts: recentAlerts.filter(a => a.severity === 'warning').length,
        uniqueTickets: new Set(recentAlerts.map(a => a.ticketId)).size
      };

      logger.info('Daily SLA monitoring statistics', stats);

    } catch (error) {
      logger.error('Daily cleanup failed', {
        error: (error as Error).message
      });
    }
  }

  /**
   * Get scheduler status
   */
  public getStatus(): {
    isRunning: boolean;
    activeTasks: string[];
    nextRuns: Record<string, string>;
  } {
    const nextRuns: Record<string, string> = {};

    for (const [name, task] of this.scheduledTasks) {
      try {
        // Note: node-cron doesn't provide direct access to next run time
        // This is a simplified representation
        nextRuns[name] = 'Next run time not available';
      } catch (error) {
        nextRuns[name] = 'Error getting next run time';
      }
    }

    return {
      isRunning: this.isRunning,
      activeTasks: Array.from(this.scheduledTasks.keys()),
      nextRuns
    };
  }

  /**
   * Manually trigger a monitoring cycle
   */
  public async triggerManualMonitoring(): Promise<void> {
    await this.runMonitoringCycle('manual');
  }

  /**
   * Update monitoring schedule
   */
  public updateSchedule(taskName: string, cronExpression: string): void {
    if (!this.scheduledTasks.has(taskName)) {
      throw new Error(`Task ${taskName} not found`);
    }

    try {
      // Stop existing task
      const existingTask = this.scheduledTasks.get(taskName);
      existingTask?.stop();

      // Create new task with updated schedule
      let newTask: cron.ScheduledTask;

      switch (taskName) {
        case 'main_monitoring':
          newTask = cron.schedule(cronExpression, async () => {
            await this.runMonitoringCycle('scheduled');
          }, { scheduled: true, timezone: 'UTC' });
          break;

        case 'critical_monitoring':
          newTask = cron.schedule(cronExpression, async () => {
            await this.runCriticalTicketMonitoring();
          }, { scheduled: true, timezone: 'UTC' });
          break;

        case 'daily_cleanup':
          newTask = cron.schedule(cronExpression, async () => {
            await this.runDailyCleanup();
          }, { scheduled: true, timezone: 'UTC' });
          break;

        default:
          throw new Error(`Unknown task: ${taskName}`);
      }

      this.scheduledTasks.set(taskName, newTask);

      logger.info(`Updated schedule for task ${taskName}`, {
        cronExpression,
        taskName
      });

    } catch (error) {
      logger.error(`Failed to update schedule for task ${taskName}`, {
        error: (error as Error).message,
        cronExpression
      });
      throw error;
    }
  }
}

// Global scheduler instance
export const slaMonitoringScheduler = new SLAMonitoringScheduler();