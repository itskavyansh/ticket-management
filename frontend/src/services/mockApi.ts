import { PerformanceMetrics, SLAAlert, TicketTrendData } from '../types/analytics';

// Mock data generators for development
export const mockDashboardMetrics: PerformanceMetrics = {
  totalTickets: 1247,
  openTickets: 342,
  resolvedTickets: 89,
  slaCompliance: 94.2,
  averageResolutionTime: 2.4,
  criticalTickets: 5,
  overdueTickets: 12,
  technicianUtilization: 78.5,
};

export const mockSLAAlerts: SLAAlert[] = [
  {
    id: '1',
    ticketId: 'TKT-001',
    ticketTitle: 'Email server down affecting Bangalore and Mumbai offices',
    riskLevel: 'critical',
    timeRemaining: -30,
    assignedTechnician: 'Rajesh Kumar',
    customer: 'Tata Consultancy Services',
    createdAt: '2024-01-15T10:30:00Z',
  },
  {
    id: '2',
    ticketId: 'TKT-002',
    ticketTitle: 'Printer not working in accounts department',
    riskLevel: 'high',
    timeRemaining: 45,
    assignedTechnician: 'Priya Sharma',
    customer: 'Infosys Limited',
    createdAt: '2024-01-15T11:15:00Z',
  },
  {
    id: '3',
    ticketId: 'TKT-003',
    ticketTitle: 'VPN connection issues for remote employees',
    riskLevel: 'medium',
    timeRemaining: 120,
    assignedTechnician: 'Amit Patel',
    customer: 'Wipro Technologies',
    createdAt: '2024-01-15T09:45:00Z',
  },
  {
    id: '4',
    ticketId: 'TKT-004',
    ticketTitle: 'SAP system performance issues',
    riskLevel: 'high',
    timeRemaining: 180,
    assignedTechnician: 'Sneha Reddy',
    customer: 'Reliance Industries',
    createdAt: '2024-01-15T08:20:00Z',
  },
  {
    id: '5',
    ticketId: 'TKT-005',
    ticketTitle: 'Internet connectivity issues in Pune office',
    riskLevel: 'critical',
    timeRemaining: 15,
    assignedTechnician: 'Vikram Singh',
    customer: 'Tech Mahindra',
    createdAt: '2024-01-15T14:15:00Z',
  },
];

export const mockTicketTrends: TicketTrendData[] = [
  { date: '2024-01-08', created: 45, resolved: 38, open: 342 },
  { date: '2024-01-09', created: 52, resolved: 41, open: 353 },
  { date: '2024-01-10', created: 38, resolved: 47, open: 344 },
  { date: '2024-01-11', created: 61, resolved: 39, open: 366 },
  { date: '2024-01-12', created: 43, resolved: 55, open: 354 },
  { date: '2024-01-13', created: 29, resolved: 31, open: 352 },
  { date: '2024-01-14', created: 48, resolved: 42, open: 358 },
];

// Simulate API delay
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export const mockApiService = {
  async getDashboardMetrics(): Promise<PerformanceMetrics> {
    await delay(500);
    return mockDashboardMetrics;
  },

  async getSLAAlerts(): Promise<SLAAlert[]> {
    await delay(300);
    return mockSLAAlerts;
  },

  async getTicketTrends(_range: string): Promise<TicketTrendData[]> {
    await delay(400);
    return mockTicketTrends;
  },
};