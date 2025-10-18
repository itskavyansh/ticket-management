import { BaseEntity } from './BaseEntity';
import { 
  TimeEntry, 
  TimeEntryStatus, 
  TimeTrackingSession, 
  ActivityEvent, 
  ActivityEventType,
  IdleDetectionConfig 
} from '../models/TimeTracking';

export class TimeEntryEntity extends BaseEntity implements TimeEntry {
  public technicianId: string;
  public ticketId: string;
  public startTime: Date;
  public endTime?: Date;
  public duration: number;
  public status: TimeEntryStatus;
  public description?: string;
  public isBillable: boolean;
  public isAutomatic: boolean;
  public pauseReason?: string;
  
  // Idle detection
  public lastActivityTime: Date;
  public idleTime: number;
  
  // Validation and correction
  public isValidated: boolean;
  public validatedBy?: string;
  public validatedAt?: Date;
  public originalDuration?: number;
  public correctionReason?: string;

  constructor(data?: Partial<TimeEntry>) {
    super();
    
    // Initialize with defaults
    this.technicianId = '';
    this.ticketId = '';
    this.startTime = new Date();
    this.duration = 0;
    this.status = TimeEntryStatus.ACTIVE;
    this.isBillable = true;
    this.isAutomatic = false;
    this.lastActivityTime = new Date();
    this.idleTime = 0;
    this.isValidated = false;
    
    // Apply provided data
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Start time tracking
   */
  public start(): void {
    this.startTime = new Date();
    this.lastActivityTime = new Date();
    this.status = TimeEntryStatus.ACTIVE;
    this.duration = 0;
    this.idleTime = 0;
    this.touch();
  }

  /**
   * Pause time tracking
   */
  public pause(reason?: string): void {
    if (this.status === TimeEntryStatus.ACTIVE) {
      this.updateDuration();
      this.status = TimeEntryStatus.PAUSED;
      this.pauseReason = reason;
      this.touch();
    }
  }

  /**
   * Resume time tracking
   */
  public resume(): void {
    if (this.status === TimeEntryStatus.PAUSED) {
      this.status = TimeEntryStatus.ACTIVE;
      this.lastActivityTime = new Date();
      this.pauseReason = undefined;
      this.touch();
    }
  }

  /**
   * Stop time tracking
   */
  public stop(): void {
    if (this.status === TimeEntryStatus.ACTIVE || this.status === TimeEntryStatus.PAUSED) {
      this.updateDuration();
      this.endTime = new Date();
      this.status = TimeEntryStatus.COMPLETED;
      this.touch();
    }
  }

  /**
   * Cancel time tracking
   */
  public cancel(): void {
    this.status = TimeEntryStatus.CANCELLED;
    this.endTime = new Date();
    this.touch();
  }

  /**
   * Update duration based on current time
   */
  private updateDuration(): void {
    if (this.status === TimeEntryStatus.ACTIVE) {
      const now = new Date();
      const elapsed = Math.floor((now.getTime() - this.startTime.getTime()) / (1000 * 60));
      this.duration = Math.max(0, elapsed - this.idleTime);
    }
  }

  /**
   * Check if entry is currently idle
   */
  public isIdle(idleThreshold: number = 5): boolean {
    if (this.status !== TimeEntryStatus.ACTIVE) {
      return false;
    }
    
    const now = new Date();
    const minutesSinceActivity = Math.floor(
      (now.getTime() - this.lastActivityTime.getTime()) / (1000 * 60)
    );
    
    return minutesSinceActivity >= idleThreshold;
  }

  /**
   * Record activity to reset idle timer
   */
  public recordActivity(): void {
    if (this.status === TimeEntryStatus.ACTIVE) {
      this.lastActivityTime = new Date();
      this.touch();
    }
  }

  /**
   * Add idle time when auto-pause occurs
   */
  public addIdleTime(minutes: number): void {
    this.idleTime += minutes;
    this.touch();
  }

  /**
   * Validate entity data
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.technicianId) {
      errors.push('Technician ID is required');
    }
    
    if (!this.ticketId) {
      errors.push('Ticket ID is required');
    }
    
    if (this.duration < 0) {
      errors.push('Duration cannot be negative');
    }
    
    if (this.idleTime < 0) {
      errors.push('Idle time cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Validate and correct time entry
   */
  public validateAndCorrect(
    validatedBy: string, 
    correctedDuration?: number, 
    correctionReason?: string,
    isBillable?: boolean
  ): void {
    this.originalDuration = this.duration;
    
    if (correctedDuration !== undefined) {
      this.duration = correctedDuration;
      this.correctionReason = correctionReason;
    }
    
    if (isBillable !== undefined) {
      this.isBillable = isBillable;
    }
    
    this.isValidated = true;
    this.validatedBy = validatedBy;
    this.validatedAt = new Date();
    this.touch();
  }

  /**
   * Get effective duration (accounting for corrections)
   */
  public getEffectiveDuration(): number {
    return this.duration;
  }

  /**
   * Get billable duration
   */
  public getBillableDuration(): number {
    return this.isBillable ? this.duration : 0;
  }

  /**
   * Check if entry needs validation
   */
  public needsValidation(): boolean {
    // Entries over 8 hours or with significant idle time need validation
    const maxAutoValidationHours = 8;
    const maxIdlePercentage = 20;
    
    const totalMinutes = this.duration + this.idleTime;
    const idlePercentage = totalMinutes > 0 ? (this.idleTime / totalMinutes) * 100 : 0;
    
    return !this.isValidated && (
      this.duration > maxAutoValidationHours * 60 ||
      idlePercentage > maxIdlePercentage
    );
  }

  /**
   * Get time entry summary
   */
  public getSummary(): {
    duration: number;
    billableDuration: number;
    idleTime: number;
    efficiency: number;
    needsValidation: boolean;
  } {
    const totalTime = this.duration + this.idleTime;
    const efficiency = totalTime > 0 ? (this.duration / totalTime) * 100 : 100;
    
    return {
      duration: this.duration,
      billableDuration: this.getBillableDuration(),
      idleTime: this.idleTime,
      efficiency: Math.round(efficiency),
      needsValidation: this.needsValidation()
    };
  }
}

export class TimeTrackingSessionEntity extends BaseEntity implements TimeTrackingSession {
  public technicianId: string;
  public ticketId: string;
  public startTime: Date;
  public endTime?: Date;
  public totalDuration: number;
  public activeDuration: number;
  public idleDuration: number;
  public pauseCount: number;
  public status: TimeEntryStatus;
  
  // Activity tracking
  public lastActivityTime: Date;
  public activityEvents: ActivityEvent[];
  
  // Auto-pause settings
  public idleThreshold: number;
  public autoResumeEnabled: boolean;

  constructor(data?: Partial<TimeTrackingSession>) {
    super();
    
    // Initialize with defaults
    this.technicianId = '';
    this.ticketId = '';
    this.startTime = new Date();
    this.totalDuration = 0;
    this.activeDuration = 0;
    this.idleDuration = 0;
    this.pauseCount = 0;
    this.status = TimeEntryStatus.ACTIVE;
    this.lastActivityTime = new Date();
    this.activityEvents = [];
    this.idleThreshold = 5; // 5 minutes default
    this.autoResumeEnabled = false;
    
    // Apply provided data
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Add activity event
   */
  public addActivityEvent(eventType: ActivityEventType, metadata?: Record<string, any>): void {
    const event: ActivityEvent = {
      id: `${this.id}_${Date.now()}`,
      sessionId: this.id,
      eventType,
      timestamp: new Date(),
      metadata
    };
    
    this.activityEvents.push(event);
    this.touch();
  }

  /**
   * Start session
   */
  public start(): void {
    this.startTime = new Date();
    this.lastActivityTime = new Date();
    this.status = TimeEntryStatus.ACTIVE;
    this.addActivityEvent(ActivityEventType.SESSION_START);
  }

  /**
   * Pause session
   */
  public pause(reason?: string): void {
    if (this.status === TimeEntryStatus.ACTIVE) {
      this.updateDurations();
      this.status = TimeEntryStatus.PAUSED;
      this.pauseCount++;
      this.addActivityEvent(ActivityEventType.SESSION_PAUSE, { reason });
    }
  }

  /**
   * Resume session
   */
  public resume(): void {
    if (this.status === TimeEntryStatus.PAUSED) {
      this.status = TimeEntryStatus.ACTIVE;
      this.lastActivityTime = new Date();
      this.addActivityEvent(ActivityEventType.SESSION_RESUME);
    }
  }

  /**
   * End session
   */
  public end(): void {
    this.updateDurations();
    this.endTime = new Date();
    this.status = TimeEntryStatus.COMPLETED;
    this.addActivityEvent(ActivityEventType.SESSION_END);
  }

  /**
   * Update durations based on current time
   */
  private updateDurations(): void {
    if (this.status === TimeEntryStatus.ACTIVE) {
      const now = new Date();
      this.totalDuration = Math.floor((now.getTime() - this.startTime.getTime()) / (1000 * 60));
      
      // Calculate idle time from activity events
      this.calculateIdleTime();
      this.activeDuration = Math.max(0, this.totalDuration - this.idleDuration);
    }
  }

  /**
   * Calculate idle time from activity events
   */
  private calculateIdleTime(): void {
    let idleTime = 0;
    let lastIdleStart: Date | null = null;
    
    for (const event of this.activityEvents) {
      if (event.eventType === ActivityEventType.IDLE_DETECTED) {
        lastIdleStart = event.timestamp;
      } else if (event.eventType === ActivityEventType.ACTIVITY_RESUMED && lastIdleStart) {
        const idleDuration = Math.floor(
          (event.timestamp.getTime() - lastIdleStart.getTime()) / (1000 * 60)
        );
        idleTime += idleDuration;
        lastIdleStart = null;
      }
    }
    
    // If currently idle, add time since last idle detection
    if (lastIdleStart && this.status === TimeEntryStatus.ACTIVE) {
      const now = new Date();
      const currentIdleDuration = Math.floor(
        (now.getTime() - lastIdleStart.getTime()) / (1000 * 60)
      );
      idleTime += currentIdleDuration;
    }
    
    this.idleDuration = idleTime;
  }

  /**
   * Check if session is currently idle
   */
  public isIdle(): boolean {
    if (this.status !== TimeEntryStatus.ACTIVE) {
      return false;
    }
    
    const now = new Date();
    const minutesSinceActivity = Math.floor(
      (now.getTime() - this.lastActivityTime.getTime()) / (1000 * 60)
    );
    
    return minutesSinceActivity >= this.idleThreshold;
  }

  /**
   * Record activity
   */
  public recordActivity(): void {
    const wasIdle = this.isIdle();
    this.lastActivityTime = new Date();
    
    if (wasIdle) {
      this.addActivityEvent(ActivityEventType.ACTIVITY_RESUMED);
    }
    
    this.touch();
  }

  /**
   * Detect and handle idle state
   */
  public handleIdleDetection(): boolean {
    if (this.isIdle() && this.status === TimeEntryStatus.ACTIVE) {
      this.addActivityEvent(ActivityEventType.IDLE_DETECTED);
      return true;
    }
    return false;
  }

  /**
   * Get session efficiency
   */
  public getEfficiency(): number {
    if (this.totalDuration === 0) {
      return 100;
    }
    return Math.round((this.activeDuration / this.totalDuration) * 100);
  }

  /**
   * Get session summary
   */
  public getSummary(): {
    totalDuration: number;
    activeDuration: number;
    idleDuration: number;
    efficiency: number;
    pauseCount: number;
    status: TimeEntryStatus;
  } {
    this.updateDurations();
    
    return {
      totalDuration: this.totalDuration,
      activeDuration: this.activeDuration,
      idleDuration: this.idleDuration,
      efficiency: this.getEfficiency(),
      pauseCount: this.pauseCount,
      status: this.status
    };
  }

  /**
   * Validate entity data
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    if (!this.technicianId) {
      errors.push('Technician ID is required');
    }
    
    if (!this.ticketId) {
      errors.push('Ticket ID is required');
    }
    
    if (!this.startTime) {
      errors.push('Start time is required');
    }
    
    if (this.totalDuration < 0) {
      errors.push('Total duration cannot be negative');
    }
    
    if (this.activeDuration < 0) {
      errors.push('Active duration cannot be negative');
    }
    
    if (this.idleDuration < 0) {
      errors.push('Idle duration cannot be negative');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}