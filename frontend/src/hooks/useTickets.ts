import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Ticket, TicketFilters, TicketSortOptions, BulkOperation, TicketComment, TicketActivity } from '../types/ticket';
import { apiService, TicketsResponse } from '../services/api';

// TicketsResponse is now imported from apiService

interface UseTicketsOptions {
  page?: number;
  limit?: number;
  filters?: TicketFilters;
  sort?: TicketSortOptions;
  search?: string;
}

export function useTickets(options: UseTicketsOptions = {}) {
  const { page = 1, limit = 20, filters, sort, search } = options;

  return useQuery<TicketsResponse>(
    ['tickets', { page, limit, filters, sort, search }],
    () => apiService.getTickets({ page, limit, filters, sort, search }),
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
    }
  );
}

export function useTicket(ticketId: string) {
  return useQuery<Ticket>(
    ['ticket', ticketId],
    () => apiService.getTicket(ticketId),
    {
      enabled: !!ticketId,
    }
  );
}

export function useTicketComments(ticketId: string) {
  return useQuery<TicketComment[]>(
    ['ticket-comments', ticketId],
    () => apiService.getTicketComments(ticketId),
    {
      enabled: !!ticketId,
    }
  );
}

export function useTicketActivity(ticketId: string) {
  return useQuery<TicketActivity[]>(
    ['ticket-activity', ticketId],
    () => apiService.getTicketActivity(ticketId),
    {
      enabled: !!ticketId,
    }
  );
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ ticketId, updates }: { ticketId: string; updates: Partial<Ticket> }) => 
      apiService.updateTicket(ticketId, updates),
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(['tickets']);
        queryClient.invalidateQueries(['ticket', variables.ticketId]);
      },
    }
  );
}

export function useBulkUpdateTickets() {
  const queryClient = useQueryClient();

  return useMutation(
    (operation: BulkOperation) => apiService.bulkUpdateTickets(operation),
    {
      onSuccess: () => {
        queryClient.invalidateQueries(['tickets']);
      },
    }
  );
}

export function useAddComment() {
  const queryClient = useQueryClient();

  return useMutation(
    ({ ticketId, content, isInternal }: { ticketId: string; content: string; isInternal: boolean }) => 
      apiService.addTicketComment(ticketId, content, isInternal),
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(['ticket-comments', variables.ticketId]);
        queryClient.invalidateQueries(['ticket', variables.ticketId]);
      },
    }
  );
}

