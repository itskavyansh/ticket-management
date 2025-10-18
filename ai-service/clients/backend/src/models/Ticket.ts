import { 
  TicketStatus, 
  Priority, 
  TicketCategory, 
  Attachment, 
  AIInsights 
} from '../types';

export interface Ticket {
  id: string;
  externalId?: string; // SuperOps ticket ID
  title: string;
  description: string;
  category: TicketCategory;
  priority: Priority;
  status: TicketStatus;
  customerId: string;
  assignedTechnicianId?: string;
  createdAt: Date;
  updatedAt: Date;
  slaDeadline: Date;
  estimatedResolutionTime?: number; // in minutes
  actualResolutionTime?: number; // in minutes
  tags: string[];
  attachments: Attachment[];
  aiInsights?: AIInsights;
  
  // Customer information
  customerName: string;
  customerEmail: string;
  customerTier: 'basic' | 'premium' | 'enterprise';
  
  // Resolution tracking
  resolutionNotes?: string;
  resolutionSteps?: string[];
  resolvedAt?: Date;
  resolvedBy?: string;
  
  // Time tracking
  timeSpent: number; // total time in minutes
  billableTime: number; // billable time in minutes
  
  // Communication
  lastCustomerResponse?: Date;
  lastTechnicianResponse?: Date;
  
  // Escalation
  escalationLevel: number; // 0 = not escalated, 1+ = escalation levels
  escalatedAt?: Date;
  escalatedBy?: string;
  escalationReason?: string;
}

export interface CreateTicketRequest {
  title: string;
  description: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  customerTier: 'basic' | 'premium' | 'enterprise';
  priority?: Priority;
  category?: TicketCategory;
  tags?: string[];
  attachments?: Omit<Attachment, 'id' | 'uploadedAt'>[];
  externalId?: string;
}

export interface UpdateTicketRequest {
  title?: string;
  description?: string;
  category?: TicketCategory;
  priority?: Priority;
  status?: TicketStatus;
  assignedTechnicianId?: string;
  tags?: string[];
  resolutionNotes?: string;
  resolutionSteps?: string[];
  escalationLevel?: number;
  escalationReason?: string;
  slaDeadline?: Date;
  resolvedBy?: string;
}

export interface TicketFilter {
  status?: TicketStatus[];
  priority?: Priority[];
  category?: TicketCategory[];
  assignedTechnicianId?: string;
  customerId?: string;
  customerTier?: string[];
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
  slaRisk?: 'low' | 'medium' | 'high';
  tags?: string[];
  escalationLevel?: number[];
  hasAttachments?: boolean;
  isOverdue?: boolean;
  timeSpentMin?: number;
  timeSpentMax?: number;
  resolutionTimeMin?: number;
  resolutionTimeMax?: number;
}

export interface TicketSearchQuery {
  query?: string;
  filters?: TicketFilter;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'slaDeadline' | 'status' | 'customerName' | 'escalationLevel' | 'timeSpent' | 'relevance';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
  includeResolved?: boolean;
  includeClosed?: boolean;
}

export interface TicketTimeline {
  id: string;
  ticketId: string;
  action: 'created' | 'updated' | 'assigned' | 'status_changed' | 'escalated' | 'resolved' | 'closed';
  description: string;
  performedBy: string;
  performedAt: Date;
  oldValue?: any;
  newValue?: any;
  metadata?: Record<string, any>;
}