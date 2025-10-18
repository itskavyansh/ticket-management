import { 
  TimeEntry, 
  TimeEntryStatus, 
  CreateTimeEntryRequest, 
  UpdateTimeEntryRequest,
  TimeEntryFilter,
  TimeTrackingSession,
  ActivityEventType,
  IdleDetectionConfig,
  TimeValidationRequest,
  TimeTrackingSummary,
  DailyTimeSummary,
  TimeTrackingStats
} from '../models/TimeTracking';
import { DateRange } from '../types';
import { TimeEntryEntity, TimeTrackingSessionEntity } from '../entities/TimeTrackingEntity';
import { logger } from '../utils/logger';

export class TimeTrackingService {
  private activeSessions: Map<string, TimeTrackingSessionEntity> = new Map();
  private idleDetectionConfig: IdleDetectionConfig = {
    idleThreshold: 5, // 5 minutes
    autoResumeThreshold: 2, // 2 minutes
    enableAutoPause: true,
    enableAutoResume: false,
    activityCheckInterval: 30 // 30 seconds
  };

  constructor() {
    // Start idle detection monitoring
    this.startIdleDetectionMonitoring();
  }

  /**
   * Start time tracking for a technician on a ticket
   */
  public async startTimeTracking(request: CreateTimeEntryRequest): Promise<TimeEntry> {
    try {
      // Check if there's already an active session for this technician
      const existingSession = await this.getActiveSession(request.technicianId);
      if (existingSession) {
        throw new Error('Technician already has an active time tracking session');
      }

      // Create new time entry
      const timeEntry = new TimeEntryEntity({
        technicianId: request.technicianId,
        ticketId: request.ticketId,
        description: request.description,
        isBillable: request.isBillable ?? true,
        isAutomatic: request.isAutomatic ?? false
      });

      timeEntry.start();

      // Create tracking session
      const session = new TimeTrackingSessionEntity({
        technicianId: request.technicianId,
        ticketId: request.ticketId,
        idleThreshold: this.idleDetectionConfig.idleThreshold,
        autoResumeEnabled: this.idleDetectionConfig.enableAutoResume
      });

      session.start();
      this.activeSessions.set(request.technicianId, session);

      // Save to database (implementation would depend on your database layer)
      await this.saveTimeEntry(timeEntry);
      await this.saveSession(session);

      logger.info(`Time tracking started for technician ${request.technicianId} on ticket ${request.ticketId}`);
      
      return timeEntry;
    } catch (error) {
      logger.error('Error starting time tracking:', error);
      throw error;
    }
  }

  /**
   * Stop time tracking for a technician
   */
  public async stopTimeTracking(technicianId: string): Promise<TimeEntry> {
    try {
      const session = this.activeSessions.get(technicianId);
      if (!session) {
        throw new Error('No active time tracking session found for technician');
      }

      // Get the current time entry
      const timeEntry = await this.getCurrentTimeEntry(technicianId);
      if (!timeEntry) {
        throw new Error('No active time entry found');
      }

      // Stop the session and time entry
      session.end();
      timeEntry.stop();

      // Update database
      await this.saveTimeEntry(timeEntry);
      await this.saveSession(session);

      // Remove from active sessions
      this.activeSessions.delete(technicianId);

      logger.info(`Time tracking stopped for technician ${technicianId}`);
      
      return timeEntry;
    } catch (error) {
      logger.error('Error stopping time tracking:', error);
      throw error;
    }
  }

  /**
   * Pause time tracking for a technician
   */
  public async pauseTimeTracking(technicianId: string, reason?: string): Promise<TimeEntry> {
    try {
      const session = this.activeSessions.get(technicianId);
      if (!session) {
        throw new Error('No active time tracking session found for technician');
      }

      const timeEntry = await this.getCurrentTimeEntry(technicianId);
      if (!timeEntry) {
        throw new Error('No active time entry found');
      }

      // Pause the session and time entry
      session.pause(reason);
      timeEntry.pause(reason);

      // Update database
      await this.saveTimeEntry(timeEntry);
      await this.saveSession(session);

      logger.info(`Time tracking paused for technician ${technicianId}`, { reason });
      
      return timeEntry;
    } catch (error) {
      logger.error('Error pausing time tracking:', error);
      throw error;
    }
  }

  /**
   * Resume time tracking for a technician
   */
  public async resumeTimeTracking(technicianId: string): Promise<TimeEntry> {
    try {
      const session = this.activeSessions.get(technicianId);
      if (!session) {
        throw new Error('No active time tracking session found for technician');
      }

      const timeEntry = await this.getCurrentTimeEntry(technicianId);
      if (!timeEntry) {
        throw new Error('No active time entry found');
      }

      // Resume the session and time entry
      session.resume();
      timeEntry.resume();

      // Update database
      await this.saveTimeEntry(timeEntry);
      await this.saveSession(session);

      logger.info(`Time tracking resumed for technician ${technicianId}`);
      
      return timeEntry;
    } catch (error) {
      logger.error('Error resuming time tracking:', error);
      throw error;
    }
  }

  /**
   * Record activity for a technician (resets idle timer)
   */
  public async recordActivity(technicianId: string): Promise<void> {
    try {
      const session = this.activeSessions.get(technicianId);
      if (session && session.status === TimeEntryStatus.ACTIVE) {
        session.recordActivity();
        await this.saveSession(session);
      }
    } catch (error) {
      logger.error('Error recording activity:', error);
    }
  }

  /**
   * Get current time entry for a technician
   */
  public async getCurrentTimeEntry(technicianId: string): Promise<TimeEntryEntity | null> {
    try {
      // Implementation would query database for active time entry
      // This is a placeholder - actual implementation depends on your database layer
      return await this.findActiveTimeEntry(technicianId);
    } catch (error) {
      logger.error('Error getting current time entry:', error);
      return null;
    }
  }

  /**
   * Get active session for a technician
   */
  public async getActiveSession(technicianId: string): Promise<TimeTrackingSessionEntity | null> {
    return this.activeSessions.get(technicianId) || null;
  }

  /**
   * Validate and correct a time entry
   */
  public async validateTimeEntry(request: TimeValidationRequest): Promise<TimeEntry> {
    try {
      const timeEntry = await this.getTimeEntryById(request.timeEntryId);
      if (!timeEntry) {
        throw new Error('Time entry not found');
      }

      timeEntry.validateAndCorrect(
        request.validatedBy,
        request.correctedDuration,
        request.correctionReason,
        request.isBillable
      );

      await this.saveTimeEntry(timeEntry);

      logger.info(`Time entry ${request.timeEntryId} validated by ${request.validatedBy}`);
      
      return timeEntry;
    } catch (error) {
      logger.error('Error validating time entry:', error);
      throw error;
    }
  }

  /**
   * Get time entries with filtering
   */
  public async getTimeEntries(filter: TimeEntryFilter): Promise<TimeEntry[]> {
    try {
      // Implementation would query database with filters
      // This is a placeholder - actual implementation depends on your database layer
      return await this.queryTimeEntries(filter);
    } catch (error) {
      logger.error('Error getting time entries:', error);
      throw error;
    }
  }

  /**
   * Get time tracking summary for a technician
   */
  public async getTimeTrackingSummary(
    technicianId: string, 
    period: DateRange
  ): Promise<TimeTrackingSummary> {
    try {
      const timeEntries = await this.getTimeEntries({
        technicianId,
        dateRange: period,
        status: [TimeEntryStatus.COMPLETED]
      });

      const totalTime = timeEntries.reduce((sum, entry) => sum + entry.duration, 0);
      const billableTime = timeEntries.reduce((sum, entry) => 
        sum + (entry.isBillable ? entry.duration : 0), 0
      );
      const activeTime = timeEntries.reduce((sum, entry) => 
        sum + (entry.duration - entry.idleTime), 0
      );
      const idleTime = timeEntries.reduce((sum, entry) => sum + entry.idleTime, 0);

      const ticketsWorked = new Set(timeEntries.map(entry => entry.ticketId)).size;
      const averageSessionDuration = timeEntries.length > 0 ? 
        totalTime / timeEntries.length : 0;
      const utilizationRate = totalTime > 0 ? (activeTime / totalTime) * 100 : 0;

      // Generate daily breakdown
      const dailyBreakdown = this.generateDailyBreakdown(timeEntries, period);

      return {
        technicianId,
        period,
        totalTime,
        billableTime,
        activeTime,
        idleTime,
        ticketsWorked,
        averageSessionDuration,
        utilizationRate,
        dailyBreakdown
      };
    } catch (error) {
      logger.error('Error getting time tracking summary:', error);
      throw error;
    }
  }

  /**
   * Get time tracking statistics for a technician
   */
  public async getTimeTrackingStats(technicianId: string): Promise<TimeTrackingStats> {
    try {
      const now = new Date();
      
      // Current week
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 6);
      weekEnd.setHours(23, 59, 59, 999);

      // Current month
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      monthEnd.setHours(23, 59, 59, 999);

      const currentWeek = await this.getTimeTrackingSummary(technicianId, {
        startDate: weekStart,
        endDate: weekEnd
      });

      const currentMonth = await this.getTimeTrackingSummary(technicianId, {
        startDate: monthStart,
        endDate: monthEnd
      });

      // Calculate averages and trends
      const averageDaily = currentWeek.totalTime / 7;
      const productivityScore = Math.min(100, currentWeek.utilizationRate);

      // Calculate trends (simplified - would need historical data)
      const trends = {
        weekOverWeek: 0, // Would calculate from previous week data
        monthOverMonth: 0 // Would calculate from previous month data
      };

      return {
        technicianId,
        currentWeek,
        currentMonth,
        averageDaily,
        productivityScore,
        trends
      };
    } catch (error) {
      logger.error('Error getting time tracking stats:', error);
      throw error;
    }
  }

  /**
   * Start idle detection monitoring
   */
  private startIdleDetectionMonitoring(): void {
    if (!this.idleDetectionConfig.enableAutoPause) {
      return;
    }

    setInterval(() => {
      this.checkForIdleSessions();
    }, this.idleDetectionConfig.activityCheckInterval * 1000);

    logger.info('Idle detection monitoring started');
  }

  /**
   * Check for idle sessions and auto-pause if needed
   */
  private async checkForIdleSessions(): Promise<void> {
    try {
      for (const [technicianId, session] of this.activeSessions) {
        if (session.status === TimeEntryStatus.ACTIVE && session.isIdle()) {
          // Auto-pause the session
          await this.pauseTimeTracking(technicianId, 'Auto-paused due to inactivity');
          
          logger.info(`Auto-paused session for technician ${technicianId} due to inactivity`);
        }
      }
    } catch (error) {
      logger.error('Error checking for idle sessions:', error);
    }
  }

  /**
   * Generate daily breakdown from time entries
   */
  private generateDailyBreakdown(
    timeEntries: TimeEntry[], 
    period: DateRange
  ): DailyTimeSummary[] {
    const dailyMap = new Map<string, DailyTimeSummary>();
    
    // Initialize all days in the period
    const currentDate = new Date(period.startDate);
    while (currentDate <= period.endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dailyMap.set(dateKey, {
        date: new Date(currentDate),
        totalTime: 0,
        billableTime: 0,
        activeTime: 0,
        idleTime: 0,
        ticketsWorked: 0,
        sessionCount: 0
      });
      currentDate.setDate(currentDate.getDate() + 1);
    }

    // Aggregate time entries by date
    for (const entry of timeEntries) {
      const dateKey = entry.createdAt.toISOString().split('T')[0];
      const daily = dailyMap.get(dateKey);
      
      if (daily) {
        daily.totalTime += entry.duration;
        daily.billableTime += entry.isBillable ? entry.duration : 0;
        daily.activeTime += entry.duration - entry.idleTime;
        daily.idleTime += entry.idleTime;
        daily.sessionCount++;
        
        // Count unique tickets per day
        const ticketsForDay = timeEntries
          .filter(e => e.createdAt.toISOString().split('T')[0] === dateKey)
          .map(e => e.ticketId);
        daily.ticketsWorked = new Set(ticketsForDay).size;
      }
    }

    return Array.from(dailyMap.values()).sort((a, b) => 
      a.date.getTime() - b.date.getTime()
    );
  }

  /**
   * Update idle detection configuration
   */
  public updateIdleDetectionConfig(config: Partial<IdleDetectionConfig>): void {
    this.idleDetectionConfig = { ...this.idleDetectionConfig, ...config };
    logger.info('Idle detection configuration updated', this.idleDetectionConfig);
  }

  // Database interaction methods (placeholders - implement based on your database layer)
  private async saveTimeEntry(timeEntry: TimeEntryEntity): Promise<void> {
    // Implementation depends on your database layer
    // Could be DynamoDB, PostgreSQL, etc.
  }

  private async saveSession(session: TimeTrackingSessionEntity): Promise<void> {
    // Implementation depends on your database layer
  }

  private async findActiveTimeEntry(technicianId: string): Promise<TimeEntryEntity | null> {
    // Implementation depends on your database layer
    return null;
  }

  private async getTimeEntryById(id: string): Promise<TimeEntryEntity | null> {
    // Implementation depends on your database layer
    return null;
  }

  private async queryTimeEntries(filter: TimeEntryFilter): Promise<TimeEntry[]> {
    // Implementation depends on your database layer
    return [];
  }
}