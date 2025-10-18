import { DateRange, PerformanceMetrics } from '../types';

export interface DashboardMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  averageResponseTime: number; // in minutes
  averageResolutionTime: number; // in minutes
  slaComplianceRate: number; // percentage (0-100)
  customerSatisfactionScore: number; // 1-5 scale
  technicianUtilization: number; // percentage (0-100)
  
  // Trend data (compared to previous period)
  trends: {
    ticketVolume: number; // percentage change
    responseTime: number; // percentage change
    resolutionTime: number; // percentage change
    slaCompliance: number; // percentage change
    satisfaction: number; // percentage change
  };
  
  // Real-time data
  activeTickets: number;
  availableTechnicians: number;
  slaRiskTickets: number;
  overdueTickets: number;
  
  lastUpdated: Date;
}

export interface TeamPerformanceMetrics {
  teamId?: string;
  teamName?: string;
  period: DateRange;
  
  // Team-level metrics
  totalTicketsHandled: number;
  averageResolutionTime: number;
  slaComplianceRate: number;
  customerSatisfactionScore: number;
  firstCallResolutionRate: number;
  
  // Individual technician performance
  technicianMetrics: PerformanceMetrics[];
  
  // Workload distribution
  workloadDistribution: {
    technicianId: string;
    technicianName: string;
    ticketsAssigned: number;
    utilizationRate: number;
    performanceScore: number;
  }[];
  
  // Category performance
  categoryPerformance: {
    category: string;
    ticketCount: number;
    averageResolutionTime: number;
    slaComplianceRate: number;
  }[];
}

export interface TrendAnalysis {
  metric: string;
  period: DateRange;
  dataPoints: Array<{
    date: Date;
    value: number;
    target?: number;
  }>;
  trend: 'increasing' | 'decreasing' | 'stable';
  trendPercentage: number;
  seasonality?: {
    pattern: 'daily' | 'weekly' | 'monthly';
    strength: number; // 0-1 scale
  };
  forecast?: Array<{
    date: Date;
    predictedValue: number;
    confidence: number; // 0-1 scale
  }>;
}

export interface BottleneckAnalysis {
  type: 'technician' | 'category' | 'customer' | 'process';
  identifier: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  metrics: {
    affectedTickets: number;
    delayImpact: number; // in minutes
    slaRisk: number; // percentage (0-100)
  };
  recommendations: string[];
  detectedAt: Date;
}

export interface KPITarget {
  metric: string;
  target: number;
  unit: string;
  period: 'daily' | 'weekly' | 'monthly' | 'quarterly';
  threshold: {
    warning: number;
    critical: number;
  };
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ReportConfiguration {
  id: string;
  name: string;
  description?: string;
  type: 'dashboard' | 'performance' | 'sla' | 'customer' | 'custom';
  
  // Report parameters
  metrics: string[];
  filters: {
    dateRange?: DateRange;
    technicians?: string[];
    customers?: string[];
    categories?: string[];
    priorities?: string[];
  };
  
  // Scheduling
  schedule?: {
    frequency: 'daily' | 'weekly' | 'monthly';
    time: string; // HH:mm format
    timezone: string;
    recipients: string[];
  };
  
  // Format options
  format: 'pdf' | 'csv' | 'excel' | 'json';
  includeCharts: boolean;
  
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
}

export interface CapacityPrediction {
  period: DateRange;
  predictedTicketVolume: number;
  requiredTechnicianHours: number;
  availableTechnicianHours: number;
  capacityUtilization: number; // percentage (0-100)
  
  // Staffing recommendations
  staffingGap: number; // positive = understaffed, negative = overstaffed
  recommendedActions: Array<{
    action: 'hire' | 'reassign' | 'overtime' | 'training';
    priority: 'low' | 'medium' | 'high';
    description: string;
    estimatedImpact: number;
  }>;
  
  // Risk assessment
  risks: Array<{
    type: 'sla_breach' | 'overload' | 'skill_gap';
    probability: number; // 0-1 scale
    impact: 'low' | 'medium' | 'high';
    mitigation: string[];
  }>;
  
  confidence: number; // 0-1 scale
  generatedAt: Date;
}

export interface AlertConfiguration {
  id: string;
  name: string;
  description?: string;
  
  // Trigger conditions
  metric: string;
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number;
  duration: number; // in minutes - how long condition must persist
  
  // Alert settings
  severity: 'info' | 'warning' | 'error' | 'critical';
  channels: Array<{
    type: 'email' | 'slack' | 'teams' | 'webhook';
    target: string;
    template?: string;
  }>;
  
  // Suppression rules
  suppressionRules?: {
    cooldownPeriod: number; // in minutes
    maxAlertsPerHour: number;
    businessHoursOnly: boolean;
  };
  
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
}