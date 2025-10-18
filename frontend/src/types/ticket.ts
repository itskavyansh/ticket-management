export interface Ticket {
  id: string;
  externalId: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: Priority;
  status: TicketStatus;
  customerId: string;
  customerName: string;
  assignedTechnicianId?: string;
  assignedTechnicianName?: string;
  createdAt: string;
  updatedAt: string;
  slaDeadline: string;
  estimatedResolutionTime?: number;
  actualResolutionTime?: number;
  tags: string[];
  attachments: Attachment[];
  aiInsights: AIInsights;
}

export interface AIInsights {
  triageConfidence: number;
  suggestedCategory: string;
  slaRiskScore: number;
  resolutionSuggestions: ResolutionSuggestion[];
  similarTickets: string[];
}

export interface ResolutionSuggestion {
  id: string;
  title: string;
  description: string;
  confidence: number;
  source: string;
}

export interface Attachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  mimeType: string;
}

export interface TicketComment {
  id: string;
  ticketId: string;
  authorId: string;
  authorName: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  attachments?: Attachment[];
}

export interface TicketActivity {
  id: string;
  ticketId: string;
  type: ActivityType;
  description: string;
  performedBy: string;
  performedAt: string;
  metadata?: Record<string, any>;
}

export type TicketCategory = 
  | 'hardware'
  | 'software'
  | 'network'
  | 'security'
  | 'access'
  | 'email'
  | 'printer'
  | 'phone'
  | 'other';

export type Priority = 'critical' | 'high' | 'medium' | 'low';

export type TicketStatus = 
  | 'open'
  | 'in_progress'
  | 'pending_customer'
  | 'pending_vendor'
  | 'resolved'
  | 'closed'
  | 'cancelled';

export type ActivityType = 
  | 'created'
  | 'assigned'
  | 'status_changed'
  | 'priority_changed'
  | 'comment_added'
  | 'attachment_added'
  | 'sla_breach'
  | 'escalated';

export interface TicketFilters {
  status?: TicketStatus[];
  priority?: Priority[];
  category?: TicketCategory[];
  assignedTechnicianId?: string[];
  customerId?: string[];
  tags?: string[];
  dateRange?: {
    start: string;
    end: string;
  };
  slaRisk?: 'low' | 'medium' | 'high';
}

export interface TicketSortOptions {
  field: 'createdAt' | 'updatedAt' | 'priority' | 'slaDeadline' | 'status';
  direction: 'asc' | 'desc';
}

export interface BulkOperation {
  type: 'assign' | 'status_change' | 'priority_change' | 'add_tags' | 'remove_tags';
  ticketIds: string[];
  payload: any;
}