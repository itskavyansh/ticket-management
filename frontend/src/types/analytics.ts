export interface DashboardKPI {
  id: string;
  title: string;
  value: number | string;
  previousValue?: number | string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
  format?: 'number' | 'percentage' | 'duration' | 'currency';
  icon?: string;
  color?: 'green' | 'red' | 'blue' | 'yellow' | 'gray';
}

export interface ChartDataPoint {
  timestamp: string;
  value: number;
  label?: string;
}

export interface PerformanceMetrics {
  totalTickets: number;
  openTickets: number;
  resolvedTickets: number;
  slaCompliance: number;
  averageResolutionTime: number;
  criticalTickets: number;
  overdueTickets: number;
  technicianUtilization: number;
}

export interface SLAAlert {
  id: string;
  ticketId: string;
  ticketTitle: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  severity: 'low' | 'medium' | 'high' | 'critical';
  timeRemaining: number;
  assignedTechnician?: string;
  customer: string;
  createdAt: string;
}

export interface TicketTrendData {
  date: string;
  created: number;
  resolved: number;
  open: number;
}

export interface CategoryDistribution {
  category: string;
  count: number;
  percentage: number;
  color: string;
}

export interface TechnicianPerformance {
  technicianId: string;
  name: string;
  ticketsResolved: number;
  averageResolutionTime: number;
  slaCompliance: number;
  utilization: number;
  status: 'available' | 'busy' | 'offline';
}

export interface RealTimeUpdate {
  type: 'kpi_update' | 'new_ticket' | 'ticket_resolved' | 'sla_alert' | 'technician_status';
  data: any;
  timestamp: string;
}