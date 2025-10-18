// Core type definitions for the AI Ticket Management Platform

export enum TicketStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  PENDING_CUSTOMER = 'pending_customer',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  CANCELLED = 'cancelled'
}

export enum Priority {
  CRITICAL = 'critical',
  HIGH = 'high',
  MEDIUM = 'medium',
  LOW = 'low'
}

export enum TicketCategory {
  HARDWARE = 'hardware',
  SOFTWARE = 'software',
  NETWORK = 'network',
  SECURITY = 'security',
  GENERAL = 'general'
}

export enum UserRole {
  ADMIN = 'admin',
  MANAGER = 'manager',
  TECHNICIAN = 'technician',
  READ_ONLY = 'read_only'
}

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
  uploadedAt: Date;
}

export interface ResolutionSuggestion {
  id: string;
  title: string;
  description: string;
  confidence: number;
  source: 'historical' | 'knowledge_base' | 'ai_generated';
  relatedTicketIds?: string[];
  steps?: string[];
}

export interface AIInsights {
  triageConfidence: number;
  suggestedCategory: TicketCategory;
  slaRiskScore: number;
  resolutionSuggestions: ResolutionSuggestion[];
  similarTickets: string[];
  processedAt: Date;
}

export interface TechnicianSkill {
  category: string;
  proficiencyLevel: number; // 1-10 scale
  certifications: string[];
  yearsExperience: number;
}

export interface AvailabilitySchedule {
  timezone: string;
  workingHours: {
    [key: string]: { // day of week (monday, tuesday, etc.)
      start: string; // HH:mm format
      end: string;   // HH:mm format
      available: boolean;
    };
  };
  holidays: Date[];
  timeOff: DateRange[];
}

export interface TechnicianPreferences {
  preferredCategories: TicketCategory[];
  maxConcurrentTickets: number;
  notificationChannels: string[];
  workloadThreshold: number; // percentage (0-100)
}

export interface PerformanceMetrics {
  technicianId: string;
  period: DateRange;
  ticketsResolved: number;
  averageResolutionTime: number; // in minutes
  slaComplianceRate: number; // percentage (0-100)
  customerSatisfactionScore: number; // 1-5 scale
  utilizationRate: number; // percentage (0-100)
  firstCallResolutionRate: number; // percentage (0-100)
}

// Re-export auth types
export * from './auth';
export * from './superops';
export * from './notification';