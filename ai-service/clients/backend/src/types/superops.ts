// SuperOps API integration types and interfaces

export interface SuperOpsConfig {
  baseUrl: string;
  apiKey: string;
  clientId: string;
  clientSecret: string;
  timeout: number;
  retryAttempts: number;
  retryDelay: number;
}

export interface SuperOpsAuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token?: string;
}

// SuperOps ticket structure (external format)
export interface SuperOpsTicket {
  id: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  category: string;
  customer_id: string;
  assigned_to?: string;
  created_at: string;
  updated_at: string;
  due_date?: string;
  resolved_at?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
  attachments?: SuperOpsAttachment[];
  time_entries?: SuperOpsTimeEntry[];
}

export interface SuperOpsCustomer {
  id: string;
  name: string;
  email: string;
  company_name: string;
  phone?: string;
  address?: string;
  tier: string;
  contract_start_date?: string;
  contract_end_date?: string;
  sla_level?: string;
  created_at: string;
  updated_at: string;
  custom_fields?: Record<string, any>;
}

export interface SuperOpsTechnician {
  id: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  skills?: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
  custom_fields?: Record<string, any>;
}

export interface SuperOpsAttachment {
  id: string;
  filename: string;
  url: string;
  size: number;
  content_type: string;
  uploaded_at: string;
}

export interface SuperOpsTimeEntry {
  id: string;
  ticket_id: string;
  technician_id: string;
  start_time: string;
  end_time?: string;
  duration: number; // in minutes
  description?: string;
  billable: boolean;
  created_at: string;
}

// API request/response interfaces
export interface SuperOpsApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  errors?: string[];
  pagination?: {
    page: number;
    per_page: number;
    total: number;
    total_pages: number;
  };
}

export interface SuperOpsListParams {
  page?: number;
  per_page?: number;
  sort_by?: string;
  sort_order?: 'asc' | 'desc';
  filters?: Record<string, any>;
}

export interface SuperOpsTicketCreateRequest {
  subject: string;
  description: string;
  customer_id: string;
  priority?: string;
  category?: string;
  assigned_to?: string;
  due_date?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

export interface SuperOpsTicketUpdateRequest {
  subject?: string;
  description?: string;
  status?: string;
  priority?: string;
  category?: string;
  assigned_to?: string;
  due_date?: string;
  tags?: string[];
  custom_fields?: Record<string, any>;
}

// Webhook payload interfaces
export interface SuperOpsWebhookPayload {
  event: string;
  timestamp: string;
  data: {
    ticket?: SuperOpsTicket;
    customer?: SuperOpsCustomer;
    technician?: SuperOpsTechnician;
    changes?: Record<string, { old_value: any; new_value: any }>;
  };
}

// Sync status tracking
export interface SyncStatus {
  entityType: 'ticket' | 'customer' | 'technician';
  entityId: string;
  externalId: string;
  lastSyncAt: Date;
  syncDirection: 'inbound' | 'outbound' | 'bidirectional';
  status: 'success' | 'failed' | 'pending';
  errorMessage?: string;
  conflictResolution?: 'local_wins' | 'remote_wins' | 'manual_review';
}

// Data mapping configuration
export interface FieldMapping {
  internalField: string;
  externalField: string;
  transform?: (value: any) => any;
  required?: boolean;
  defaultValue?: any;
}

export interface EntityMapping {
  ticket: FieldMapping[];
  customer: FieldMapping[];
  technician: FieldMapping[];
}

// Error types
export class SuperOpsApiError extends Error {
  constructor(
    message: string,
    public statusCode?: number,
    public response?: any
  ) {
    super(message);
    this.name = 'SuperOpsApiError';
  }
}

export class SuperOpsSyncError extends Error {
  constructor(
    message: string,
    public entityType: string,
    public entityId: string,
    public originalError?: Error
  ) {
    super(message);
    this.name = 'SuperOpsSyncError';
  }
}