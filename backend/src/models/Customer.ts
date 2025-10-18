export interface Customer {
  id: string;
  externalId?: string; // SuperOps customer ID
  name: string;
  email: string;
  phoneNumber?: string;
  companyName: string;
  tier: 'basic' | 'premium' | 'enterprise';
  
  // Contract and SLA information
  contractStartDate: Date;
  contractEndDate?: Date;
  slaLevel: string;
  responseTimeTarget: number; // in minutes
  resolutionTimeTarget: number; // in minutes
  
  // Contact information
  primaryContact: {
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
  };
  technicalContacts: Array<{
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
  }>;
  
  // Business information
  industry: string;
  employeeCount?: number;
  annualRevenue?: number;
  
  // Support preferences
  preferredContactMethod: 'email' | 'phone' | 'chat' | 'portal';
  businessHours: {
    timezone: string;
    workingDays: string[];
    startTime: string; // HH:mm format
    endTime: string;   // HH:mm format
  };
  
  // Status and metrics
  isActive: boolean;
  satisfactionScore?: number; // 1-5 scale
  totalTickets: number;
  openTickets: number;
  
  // Billing and subscription
  subscriptionPlan: string;
  billingContact?: {
    name: string;
    email: string;
    phoneNumber?: string;
  };
  
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateCustomerRequest {
  name: string;
  email: string;
  companyName: string;
  tier: 'basic' | 'premium' | 'enterprise';
  slaLevel: string;
  responseTimeTarget: number;
  resolutionTimeTarget: number;
  primaryContact: {
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
  };
  phoneNumber?: string;
  industry?: string;
  preferredContactMethod?: 'email' | 'phone' | 'chat' | 'portal';
  businessHours?: {
    timezone: string;
    workingDays: string[];
    startTime: string;
    endTime: string;
  };
  subscriptionPlan?: string;
  externalId?: string;
}

export interface UpdateCustomerRequest {
  name?: string;
  email?: string;
  phoneNumber?: string;
  companyName?: string;
  tier?: 'basic' | 'premium' | 'enterprise';
  slaLevel?: string;
  responseTimeTarget?: number;
  resolutionTimeTarget?: number;
  primaryContact?: {
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
  };
  technicalContacts?: Array<{
    name: string;
    email: string;
    phoneNumber?: string;
    role: string;
  }>;
  industry?: string;
  employeeCount?: number;
  annualRevenue?: number;
  preferredContactMethod?: 'email' | 'phone' | 'chat' | 'portal';
  businessHours?: {
    timezone: string;
    workingDays: string[];
    startTime: string;
    endTime: string;
  };
  subscriptionPlan?: string;
  isActive?: boolean;
}

export interface CustomerSLA {
  customerId: string;
  slaLevel: string;
  responseTimeTarget: number; // in minutes
  resolutionTimeTarget: number; // in minutes
  availabilityTarget: number; // percentage (0-100)
  escalationMatrix: Array<{
    level: number;
    timeThreshold: number; // in minutes
    contacts: string[];
    actions: string[];
  }>;
  penalties?: Array<{
    condition: string;
    penalty: string;
    amount?: number;
  }>;
  effectiveFrom: Date;
  effectiveTo?: Date;
}

export interface CustomerMetrics {
  customerId: string;
  period: {
    startDate: Date;
    endDate: Date;
  };
  totalTickets: number;
  resolvedTickets: number;
  averageResponseTime: number; // in minutes
  averageResolutionTime: number; // in minutes
  slaComplianceRate: number; // percentage (0-100)
  satisfactionScore: number; // 1-5 scale
  escalationRate: number; // percentage (0-100)
  firstCallResolutionRate: number; // percentage (0-100)
  ticketsByCategory: Record<string, number>;
  ticketsByPriority: Record<string, number>;
}