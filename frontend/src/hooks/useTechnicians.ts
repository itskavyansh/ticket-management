import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiService } from '../services/api';
import toast from 'react-hot-toast';

export interface Technician {
  id: string;
  name: string;
  email: string;
  phone: string;
  department: string;
  location: string;
  status: 'available' | 'busy' | 'offline';
  currentTickets: number;
  maxCapacity: number;
  specialties: string[];
  averageResolutionTime: number;
  slaCompliance: number;
  totalResolved: number;
  joinedDate: string;
  avatar?: string;
}

export interface CreateTechnicianData {
  name: string;
  email: string;
  phone: string;
  department: string;
  location: string;
  specialties: string[];
  maxCapacity: number;
}

export interface UpdateTechnicianData extends Partial<CreateTechnicianData> {
  status?: 'available' | 'busy' | 'offline';
}

// Get all technicians
export function useTechnicians() {
  return useQuery<Technician[]>(
    'technicians',
    () => apiService.getTechnicians(),
    {
      staleTime: 60000, // 1 minute
      refetchInterval: 300000, // 5 minutes
      onError: (error) => {
        console.error('Failed to fetch technicians:', error);
        toast.error('Failed to load technicians');
      }
    }
  );
}

// Get single technician
export function useTechnician(id: string) {
  return useQuery<Technician>(
    ['technician', id],
    () => apiService.getTechnician(id),
    {
      enabled: !!id,
      staleTime: 60000,
      onError: (error) => {
        console.error('Failed to fetch technician:', error);
        toast.error('Failed to load technician details');
      }
    }
  );
}

// Get technician workload
export function useTechnicianWorkload(id: string) {
  return useQuery(
    ['technician-workload', id],
    () => apiService.getTechnicianWorkload(id),
    {
      enabled: !!id,
      staleTime: 30000, // 30 seconds
      refetchInterval: 60000, // 1 minute
      onError: (error) => {
        console.error('Failed to fetch technician workload:', error);
      }
    }
  );
}

// Create technician mutation
export function useCreateTechnician() {
  const queryClient = useQueryClient();
  
  return useMutation(
    (data: CreateTechnicianData) => apiService.createTechnician(data),
    {
      onSuccess: (newTechnician) => {
        // Update the technicians list
        queryClient.setQueryData<Technician[]>('technicians', (old) => {
          if (!old) return [newTechnician];
          return [...old, newTechnician];
        });
        
        // Invalidate and refetch
        queryClient.invalidateQueries('technicians');
        
        toast.success('Technician added successfully!');
      },
      onError: (error) => {
        console.error('Failed to create technician:', error);
        toast.error('Failed to add technician');
      }
    }
  );
}

// Update technician mutation
export function useUpdateTechnician() {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, data }: { id: string; data: UpdateTechnicianData }) => 
      apiService.updateTechnician(id, data),
    {
      onSuccess: (updatedTechnician, { id }) => {
        // Update the technicians list
        queryClient.setQueryData<Technician[]>('technicians', (old) => {
          if (!old) return [updatedTechnician];
          return old.map(tech => tech.id === id ? updatedTechnician : tech);
        });
        
        // Update individual technician cache
        queryClient.setQueryData(['technician', id], updatedTechnician);
        
        // Invalidate related queries
        queryClient.invalidateQueries('technicians');
        queryClient.invalidateQueries(['technician', id]);
        
        toast.success('Technician updated successfully!');
      },
      onError: (error) => {
        console.error('Failed to update technician:', error);
        toast.error('Failed to update technician');
      }
    }
  );
}

// Delete technician mutation
export function useDeleteTechnician() {
  const queryClient = useQueryClient();
  
  return useMutation(
    (id: string) => apiService.deleteTechnician(id),
    {
      onSuccess: (_, id) => {
        // Remove from technicians list
        queryClient.setQueryData<Technician[]>('technicians', (old) => {
          if (!old) return [];
          return old.filter(tech => tech.id !== id);
        });
        
        // Remove individual technician cache
        queryClient.removeQueries(['technician', id]);
        
        // Invalidate queries
        queryClient.invalidateQueries('technicians');
        
        toast.success('Technician removed successfully!');
      },
      onError: (error) => {
        console.error('Failed to delete technician:', error);
        toast.error('Failed to remove technician');
      }
    }
  );
}

// Update technician status mutation
export function useUpdateTechnicianStatus() {
  const queryClient = useQueryClient();
  
  return useMutation(
    ({ id, status }: { id: string; status: 'available' | 'busy' | 'offline' }) => 
      apiService.updateTechnicianStatus(id, status),
    {
      onMutate: async ({ id, status }) => {
        // Cancel outgoing refetches
        await queryClient.cancelQueries('technicians');
        await queryClient.cancelQueries(['technician', id]);
        
        // Snapshot previous values
        const previousTechnicians = queryClient.getQueryData<Technician[]>('technicians');
        const previousTechnician = queryClient.getQueryData<Technician>(['technician', id]);
        
        // Optimistically update
        if (previousTechnicians) {
          queryClient.setQueryData<Technician[]>('technicians', 
            previousTechnicians.map(tech => 
              tech.id === id ? { ...tech, status } : tech
            )
          );
        }
        
        if (previousTechnician) {
          queryClient.setQueryData(['technician', id], { ...previousTechnician, status });
        }
        
        return { previousTechnicians, previousTechnician };
      },
      onError: (error, { id }, context) => {
        // Rollback on error
        if (context?.previousTechnicians) {
          queryClient.setQueryData('technicians', context.previousTechnicians);
        }
        if (context?.previousTechnician) {
          queryClient.setQueryData(['technician', id], context.previousTechnician);
        }
        
        console.error('Failed to update technician status:', error);
        toast.error('Failed to update technician status');
      },
      onSuccess: (_, { status }) => {
        toast.success(`Technician status updated to ${status}`);
      },
      onSettled: () => {
        // Always refetch after error or success
        queryClient.invalidateQueries('technicians');
      }
    }
  );
}