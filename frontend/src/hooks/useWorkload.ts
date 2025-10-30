import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export interface TechnicianWorkload {
  id: string;
  name: string;
  currentTickets: number;
  maxCapacity: number;
  utilization: number;
  status: 'available' | 'busy' | 'overloaded' | 'offline';
  avgResolutionTime: number;
  ticketsThisWeek: number;
  department: string;
}

export interface WorkloadTrend {
  date: string;
  totalTickets: number;
  assignedTickets: number;
  completedTickets: number;
  utilization: number;
}

export interface WorkloadStats {
  totalTechnicians: number;
  averageUtilization: number;
  overloadedCount: number;
  availableCount: number;
}

export interface WorkloadData {
  technicians: TechnicianWorkload[];
  trends: WorkloadTrend[];
  stats: WorkloadStats;
}

export interface WorkloadFilters {
  period?: string;
  department?: string;
  status?: string;
  utilizationFilter?: string;
}

// Get workload data with filters
export function useWorkloadData(filters: WorkloadFilters = {}) {
  return useQuery<WorkloadData>(
    ['workload-data', filters],
    () => apiService.getWorkloadData(filters),
    {
      staleTime: 60000, // 1 minute
      refetchInterval: 300000, // 5 minutes
      onError: (error) => {
        console.error('Failed to fetch workload data:', error);
        toast.error('Failed to load workload data. Using offline data.');
      }
    }
  );
}

// Get workload trends
export function useWorkloadTrends(period: string = 'week') {
  return useQuery<WorkloadTrend[]>(
    ['workload-trends', period],
    () => apiService.getWorkloadTrends(period),
    {
      staleTime: 300000, // 5 minutes
      refetchInterval: 600000, // 10 minutes
      onError: (error) => {
        console.error('Failed to fetch workload trends:', error);
      }
    }
  );
}

// Get workload recommendations
export function useWorkloadRecommendations() {
  return useQuery(
    'workload-recommendations',
    () => apiService.getWorkloadRecommendations(),
    {
      staleTime: 120000, // 2 minutes
      refetchInterval: 300000, // 5 minutes
      onError: (error) => {
        console.error('Failed to fetch workload recommendations:', error);
      }
    }
  );
}

// Reassign tickets mutation
export function useReassignTickets() {
  const queryClient = useQueryClient();
  
  return useMutation(
    (reassignmentData: {
      fromTechnicianId: string;
      toTechnicianId: string;
      ticketIds: string[];
    }) => apiService.reassignTickets(reassignmentData),
    {
      onSuccess: (data, variables) => {
        // Invalidate workload data to refresh
        queryClient.invalidateQueries(['workload-data']);
        queryClient.invalidateQueries(['technicians']);
        queryClient.invalidateQueries(['tickets']);
        
        toast.success(`Successfully reassigned ${variables.ticketIds.length} tickets`);
      },
      onError: (error) => {
        console.error('Failed to reassign tickets:', error);
        toast.error('Failed to reassign tickets. Please try again.');
      }
    }
  );
}

// Optimize workload mutation
export function useOptimizeWorkload() {
  const queryClient = useQueryClient();
  
  return useMutation(
    (data: { technicians: any[]; pending_tickets: any[] }) => 
      apiService.optimizeWorkload(data),
    {
      onSuccess: (optimizationResult) => {
        // Invalidate workload data to refresh
        queryClient.invalidateQueries(['workload-data']);
        
        toast.success('Workload optimization completed successfully');
        return optimizationResult;
      },
      onError: (error) => {
        console.error('Failed to optimize workload:', error);
        toast.error('Failed to optimize workload. Please try again.');
      }
    }
  );
}

// Export workload data
export function useExportWorkloadData() {
  return useMutation(
    ({ format, filters }: { format: 'csv' | 'pdf'; filters?: any }) =>
      apiService.exportWorkloadData(format, filters),
    {
      onSuccess: (blob, variables) => {
        // Create download link
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `workload-report.${variables.format}`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success(`Workload report exported as ${variables.format.toUpperCase()}`);
      },
      onError: (error) => {
        console.error('Failed to export workload data:', error);
        toast.error('Failed to export workload data. Please try again.');
      }
    }
  );
}

// Get individual technician workload details
export function useTechnicianWorkloadDetail(technicianId: string) {
  return useQuery(
    ['technician-workload', technicianId],
    () => apiService.getTechnicianWorkload(technicianId),
    {
      enabled: !!technicianId,
      staleTime: 60000, // 1 minute
      onError: (error) => {
        console.error('Failed to fetch technician workload:', error);
      }
    }
  );
}

// Custom hook for workload calculations
export function useWorkloadCalculations(technicians: TechnicianWorkload[]) {
  const calculations = {
    totalTechnicians: technicians.length,
    averageUtilization: technicians.length > 0 
      ? Math.round(technicians.reduce((sum, t) => sum + t.utilization, 0) / technicians.length)
      : 0,
    overloadedCount: technicians.filter(t => t.utilization > 100).length,
    availableCount: technicians.filter(t => t.status === 'available').length,
    busyCount: technicians.filter(t => t.status === 'busy').length,
    offlineCount: technicians.filter(t => t.status === 'offline').length,
    totalCurrentTickets: technicians.reduce((sum, t) => sum + t.currentTickets, 0),
    totalCapacity: technicians.reduce((sum, t) => sum + t.maxCapacity, 0),
    utilizationDistribution: {
      underUtilized: technicians.filter(t => t.utilization <= 50).length,
      optimal: technicians.filter(t => t.utilization > 50 && t.utilization <= 85).length,
      high: technicians.filter(t => t.utilization > 85 && t.utilization <= 100).length,
      overloaded: technicians.filter(t => t.utilization > 100).length,
    }
  };

  return calculations;
}