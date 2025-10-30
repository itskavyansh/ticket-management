import { useQuery, useMutation } from 'react-query';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export interface AnalyticsData {
  date: string;
  ticketsCreated: number;
  ticketsResolved: number;
  avgResolutionTime: number;
  slaCompliance: number;
  customerSatisfaction: number;
}

export interface CategoryAnalytics {
  category: string;
  count: number;
  avgResolutionTime: number;
  slaCompliance: number;
  color: string;
}

export interface TechnicianPerformance {
  name: string;
  ticketsResolved: number;
  avgResolutionTime: number;
  slaCompliance: number;
  customerRating: number;
}

export interface AnalyticsFilters {
  period?: string;
  startDate?: string;
  endDate?: string;
  metric?: string;
}

export interface PerformanceInsights {
  trends: {
    ticketVolume: { value: number; isPositive: boolean; description: string };
    resolutionTime: { value: number; isPositive: boolean; description: string };
    slaCompliance: { value: number; isPositive: boolean; description: string };
    customerSatisfaction: { value: number; isPositive: boolean; description: string };
  };
  recommendations: Array<{
    type: string;
    priority: string;
    title: string;
    description: string;
    impact: string;
  }>;
  alerts: Array<{
    type: string;
    message: string;
    action: string;
  }>;
}

// Get comprehensive analytics data
export function useAnalyticsData(filters: AnalyticsFilters = {}) {
  return useQuery(
    ['analytics-data', filters],
    () => apiService.getAnalyticsData(filters),
    {
      staleTime: 300000, // 5 minutes
      refetchInterval: 600000, // 10 minutes
      onError: (error) => {
        console.error('Failed to fetch analytics data:', error);
        toast.error('Failed to load analytics data. Using offline data.');
      }
    }
  );
}

// Get category analytics
export function useCategoryAnalytics(period: string = '30d') {
  return useQuery<CategoryAnalytics[]>(
    ['category-analytics', period],
    () => apiService.getCategoryAnalytics(period),
    {
      staleTime: 300000, // 5 minutes
      refetchInterval: 600000, // 10 minutes
      onError: (error) => {
        console.error('Failed to fetch category analytics:', error);
      }
    }
  );
}

// Get technician performance data
export function useTechnicianPerformance(period: string = '30d') {
  return useQuery<TechnicianPerformance[]>(
    ['technician-performance', period],
    () => apiService.getTechnicianPerformance(period),
    {
      staleTime: 300000, // 5 minutes
      refetchInterval: 600000, // 10 minutes
      onError: (error) => {
        console.error('Failed to fetch technician performance:', error);
      }
    }
  );
}

// Get performance insights and recommendations
export function usePerformanceInsights(period: string = '30d') {
  return useQuery<PerformanceInsights>(
    ['performance-insights', period],
    () => apiService.getPerformanceInsights(period),
    {
      staleTime: 600000, // 10 minutes
      refetchInterval: 1800000, // 30 minutes
      onError: (error) => {
        console.error('Failed to fetch performance insights:', error);
      }
    }
  );
}

// Export analytics report
export function useExportAnalyticsReport() {
  return useMutation(
    (params: {
      format: 'csv' | 'pdf' | 'excel';
      period: string;
      includeCharts?: boolean;
    }) => apiService.exportAnalyticsReport(params),
    {
      onSuccess: (blob, variables) => {
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `analytics-report-${variables.period}.${variables.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success(`Analytics report exported as ${variables.format.toUpperCase()}`);
      },
      onError: (error) => {
        console.error('Failed to export analytics report:', error);
        toast.error('Failed to export analytics report. Please try again.');
      }
    }
  );
}

// Dashboard metrics (reusing existing hook)
export function useDashboardMetrics() {
  return useQuery(
    'dashboard-metrics',
    () => apiService.getDashboardMetrics(),
    {
      staleTime: 60000, // 1 minute
      refetchInterval: 300000, // 5 minutes
      onError: (error) => {
        console.error('Failed to fetch dashboard metrics:', error);
      }
    }
  );
}

// SLA alerts (reusing existing hook)
export function useSLAAlerts() {
  return useQuery(
    'sla-alerts',
    () => apiService.getSLAAlerts(),
    {
      staleTime: 30000, // 30 seconds
      refetchInterval: 60000, // 1 minute
      onError: (error) => {
        console.error('Failed to fetch SLA alerts:', error);
      }
    }
  );
}

// Ticket trends (reusing existing hook)
export function useTicketTrends(range: string = '7d') {
  return useQuery(
    ['ticket-trends', range],
    () => apiService.getTicketTrends(range),
    {
      staleTime: 300000, // 5 minutes
      refetchInterval: 600000, // 10 minutes
      onError: (error) => {
        console.error('Failed to fetch ticket trends:', error);
      }
    }
  );
}

// Custom hook for calculating trends
export function useAnalyticsTrends(data: AnalyticsData[]) {
  const calculateTrend = (values: number[]) => {
    if (values.length < 2) return { value: 0, isPositive: true };
    const recent = values.slice(-7).reduce((a, b) => a + b, 0) / 7;
    const previous = values.slice(-14, -7).reduce((a, b) => a + b, 0) / 7;
    const change = ((recent - previous) / previous) * 100;
    return { value: Math.abs(change), isPositive: change >= 0 };
  };

  const trends = {
    tickets: calculateTrend(data.map(d => d.ticketsResolved)),
    sla: calculateTrend(data.map(d => d.slaCompliance)),
    resolutionTime: calculateTrend(data.map(d => d.avgResolutionTime)),
    satisfaction: calculateTrend(data.map(d => d.customerSatisfaction))
  };

  const summary = {
    totalTicketsResolved: data.reduce((sum, d) => sum + d.ticketsResolved, 0),
    avgSlaCompliance: data.length > 0 ? data.reduce((sum, d) => sum + d.slaCompliance, 0) / data.length : 0,
    avgResolutionTime: data.length > 0 ? data.reduce((sum, d) => sum + d.avgResolutionTime, 0) / data.length : 0,
    avgCustomerSatisfaction: data.length > 0 ? data.reduce((sum, d) => sum + d.customerSatisfaction, 0) / data.length : 0
  };

  return { trends, summary };
}