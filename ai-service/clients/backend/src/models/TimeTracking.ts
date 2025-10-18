import { DateRange } from '../types';

export interface TimeEntry {
  id: string;
  technicianId: string;
  ticketId: string;
  startTime: Date;
  endTime?: Date;
  duration: number; // in minutes
  status: TimeEntryStatus;
  description?: string;
  isBillable: boolean;
  isAutomatic: boolean;
  pauseReason?: string;
  
  // Idle detection
  lastActivityTime: Date;
  idleTime: number; // in minutes
  
  // Validation and correction
  isValidated: boolean;
  validatedBy?: string;
  validatedAt?: Date;
  originalDuration?: number;
  correctionReason?: string;
  
  createdAt: Date;
  updatedAt: Date;
}

export enum TimeEntryStatus {
  ACTIVE = 'active',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled'
}

export interface CreateTimeEntryRequest {
  technicianId: string;
  ticketId: string;
  description?: string;
  isBillable?: boolean;
  isAutomatic?: boolean;
}

export interface UpdateTimeEntryRequest {
  endTime?: Date;
  status?: TimeEntryStatus;
  description?: string;
  isBillable?: boolean;
  pauseReason?: string;
  correctionReason?: string;
}

export interface TimeEntryFilter {
  technicianId?: string;
  ticketId?: string;
  status?: TimeEntryStatus[];
  isBillable?: boolean;
  isAutomatic?: boolean;
  isValidated?: boolean;
  dateRange?: DateRange;
  minDuration?: number;
  maxDuration?: number;
}

export interface TimeTrackingSession {
  id: string;
  technicianId: string;
  ticketId: string;
  startTime: Date;
  endTime?: Date;
  totalDuration: number; // in minutes
  activeDuration: number; // excluding idle time
  idleDuration: number; // total idle time
  pauseCount: number;
  status: TimeEntryStatus;
  
  // Activity tracking
  lastActivityTime: Date;
  activityEvents: ActivityEvent[];
  
  // Auto-pause settings
  idleThreshold: number; // minutes before auto-pause
  autoResumeEnabled: boolean;
  
  createdAt: Date;
  updatedAt: Date;
}

export interface ActivityEvent {
  id: string;
  sessionId: string;
  eventType: ActivityEventType;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export enum ActivityEventType {
  SESSION_START = 'session_start',
  SESSION_END = 'session_end',
  SESSION_PAUSE = 'session_pause',
  SESSION_RESUME = 'session_resume',
  IDLE_DETECTED = 'idle_detected',
  ACTIVITY_RESUMED = 'activity_resumed',
  MANUAL_CORRECTION = 'manual_correction',
  VALIDATION = 'validation'
}

export interface IdleDetectionConfig {
  idleThreshold: number; // minutes
  autoResumeThreshold: number; // minutes
  enableAutoPause: boolean;
  enableAutoResume: boolean;
  activityCheckInterval: number; // seconds
}

export interface TimeValidationRequest {
  timeEntryId: string;
  validatedBy: string;
  correctedDuration?: number;
  correctionReason?: string;
  isBillable?: boolean;
}

export interface TimeTrackingSummary {
  technicianId: string;
  period: DateRange;
  totalTime: number; // in minutes
  billableTime: number; // in minutes
  activeTime: number; // excluding idle
  idleTime: number; // total idle time
  ticketsWorked: number;
  averageSessionDuration: number;
  utilizationRate: number; // percentage
  
  // Daily breakdown
  dailyBreakdown: DailyTimeSummary[];
}

export interface DailyTimeSummary {
  date: Date;
  totalTime: number;
  billableTime: number;
  activeTime: number;
  idleTime: number;
  ticketsWorked: number;
  sessionCount: number;
}

export interface TimeTrackingStats {
  technicianId: string;
  currentWeek: TimeTrackingSummary;
  currentMonth: TimeTrackingSummary;
  averageDaily: number;
  productivityScore: number; // 0-100
  trends: {
    weekOverWeek: number; // percentage change
    monthOverMonth: number; // percentage change
  };
}