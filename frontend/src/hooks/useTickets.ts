import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import axios from 'axios';
import { Ticket, TicketFilters, TicketSortOptions, BulkOperation, TicketComment, TicketActivity } from '../types/ticket';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

interface TicketsResponse {
  tickets: Ticket[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

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
    async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (search) {
        params.append('search', search);
      }

      if (filters) {
        Object.entries(filters).forEach(([key, value]) => {
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              value.forEach(v => params.append(`${key}[]`, v.toString()));
            } else if (typeof value === 'object' && 'start' in value) {
              params.append(`${key}[start]`, value.start);
              params.append(`${key}[end]`, value.end);
            } else {
              params.append(key, value.toString());
            }
          }
        });
      }

      if (sort) {
        params.append('sortBy', sort.field);
        params.append('sortOrder', sort.direction);
      }

      const response = await axios.get(`${API_BASE_URL}/tickets?${params}`);
      return response.data;
    },
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
    }
  );
}

export function useTicket(ticketId: string) {
  return useQuery<Ticket>(
    ['ticket', ticketId],
    async () => {
      const response = await axios.get(`${API_BASE_URL}/tickets/${ticketId}`);
      return response.data;
    },
    {
      enabled: !!ticketId,
    }
  );
}

export function useTicketComments(ticketId: string) {
  return useQuery<TicketComment[]>(
    ['ticket-comments', ticketId],
    async () => {
      const response = await axios.get(`${API_BASE_URL}/tickets/${ticketId}/comments`);
      return response.data;
    },
    {
      enabled: !!ticketId,
    }
  );
}

export function useTicketActivity(ticketId: string) {
  return useQuery<TicketActivity[]>(
    ['ticket-activity', ticketId],
    async () => {
      const response = await axios.get(`${API_BASE_URL}/tickets/${ticketId}/activity`);
      return response.data;
    },
    {
      enabled: !!ticketId,
    }
  );
}

export function useUpdateTicket() {
  const queryClient = useQueryClient();

  return useMutation(
    async ({ ticketId, updates }: { ticketId: string; updates: Partial<Ticket> }) => {
      const response = await axios.put(`${API_BASE_URL}/tickets/${ticketId}`, updates);
      return response.data;
    },
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
    async (operation: BulkOperation) => {
      const response = await axios.post(`${API_BASE_URL}/tickets/bulk`, operation);
      return response.data;
    },
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
    async ({ ticketId, content, isInternal }: { ticketId: string; content: string; isInternal: boolean }) => {
      const response = await axios.post(`${API_BASE_URL}/tickets/${ticketId}/comments`, {
        content,
        isInternal,
      });
      return response.data;
    },
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(['ticket-comments', variables.ticketId]);
        queryClient.invalidateQueries(['ticket', variables.ticketId]);
      },
    }
  );
}

// Mock data for development
export function useMockTickets(options: UseTicketsOptions = {}) {
  const [mockData, setMockData] = useState<TicketsResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate API delay
    const timer = setTimeout(() => {
      const mockTickets: Ticket[] = [
        {
          id: '1',
          externalId: 'TKT-001',
          title: 'Email server not responding',
          description: 'Users are unable to send or receive emails. The exchange server appears to be down since morning.',
          category: 'email',
          priority: 'critical',
          status: 'in_progress',
          customerId: 'cust-1',
          customerName: 'Tata Consultancy Services',
          assignedTechnicianId: 'tech-1',
          assignedTechnicianName: 'Rajesh Kumar',
          createdAt: '2024-01-15T09:00:00Z',
          updatedAt: '2024-01-15T10:30:00Z',
          slaDeadline: '2024-01-15T13:00:00Z',
          tags: ['email', 'server', 'critical'],
          attachments: [],
          aiInsights: {
            triageConfidence: 0.95,
            suggestedCategory: 'email',
            slaRiskScore: 0.8,
            resolutionSuggestions: [
              {
                id: '1',
                title: 'Restart Exchange Services',
                description: 'Try restarting the Microsoft Exchange services on the server',
                confidence: 0.85,
                source: 'knowledge_base'
              }
            ],
            similarTickets: ['2', '5']
          }
        },
        {
          id: '2',
          externalId: 'TKT-002',
          title: 'Printer not working in accounts department',
          description: 'HP LaserJet Pro in accounts department is showing offline status and not printing invoices.',
          category: 'printer',
          priority: 'medium',
          status: 'open',
          customerId: 'cust-2',
          customerName: 'Infosys Limited',
          createdAt: '2024-01-15T08:30:00Z',
          updatedAt: '2024-01-15T08:30:00Z',
          slaDeadline: '2024-01-16T08:30:00Z',
          tags: ['printer', 'hardware', 'accounts'],
          attachments: [],
          aiInsights: {
            triageConfidence: 0.88,
            suggestedCategory: 'printer',
            slaRiskScore: 0.3,
            resolutionSuggestions: [
              {
                id: '2',
                title: 'Check Network Connection',
                description: 'Verify the printer network connection and IP configuration',
                confidence: 0.75,
                source: 'historical_tickets'
              }
            ],
            similarTickets: ['4']
          }
        },
        {
          id: '3',
          externalId: 'TKT-003',
          title: 'VPN connection issues for remote employees',
          description: 'Multiple remote employees from Bangalore and Mumbai offices reporting inability to connect to company VPN.',
          category: 'network',
          priority: 'high',
          status: 'pending_vendor',
          customerId: 'cust-3',
          customerName: 'Wipro Technologies',
          assignedTechnicianId: 'tech-2',
          assignedTechnicianName: 'Priya Sharma',
          createdAt: '2024-01-15T07:45:00Z',
          updatedAt: '2024-01-15T09:15:00Z',
          slaDeadline: '2024-01-15T15:45:00Z',
          tags: ['vpn', 'network', 'remote', 'bangalore', 'mumbai'],
          attachments: [],
          aiInsights: {
            triageConfidence: 0.92,
            suggestedCategory: 'network',
            slaRiskScore: 0.6,
            resolutionSuggestions: [
              {
                id: '3',
                title: 'Check VPN Server Status',
                description: 'Verify VPN server is running and check connection limits',
                confidence: 0.80,
                source: 'ai_generated'
              }
            ],
            similarTickets: ['6']
          }
        },
        {
          id: '4',
          externalId: 'TKT-004',
          title: 'SAP system running slow',
          description: 'SAP ERP system is running extremely slow affecting all departments. Response time is over 30 seconds.',
          category: 'software',
          priority: 'high',
          status: 'open',
          customerId: 'cust-4',
          customerName: 'Reliance Industries',
          createdAt: '2024-01-15T11:20:00Z',
          updatedAt: '2024-01-15T11:20:00Z',
          slaDeadline: '2024-01-15T17:20:00Z',
          tags: ['sap', 'performance', 'erp'],
          attachments: [],
          aiInsights: {
            triageConfidence: 0.91,
            suggestedCategory: 'software',
            slaRiskScore: 0.4,
            resolutionSuggestions: [
              {
                id: '4',
                title: 'Check Database Performance',
                description: 'Monitor database queries and check for blocking processes',
                confidence: 0.78,
                source: 'knowledge_base'
              }
            ],
            similarTickets: ['7']
          }
        },
        {
          id: '5',
          externalId: 'TKT-005',
          title: 'Internet connectivity issues in Pune office',
          description: 'Entire Pune office is experiencing intermittent internet connectivity issues since 2 PM.',
          category: 'network',
          priority: 'critical',
          status: 'in_progress',
          customerId: 'cust-5',
          customerName: 'Tech Mahindra',
          assignedTechnicianId: 'tech-3',
          assignedTechnicianName: 'Amit Patel',
          createdAt: '2024-01-15T14:15:00Z',
          updatedAt: '2024-01-15T14:45:00Z',
          slaDeadline: '2024-01-15T16:15:00Z',
          tags: ['internet', 'connectivity', 'pune', 'office'],
          attachments: [],
          aiInsights: {
            triageConfidence: 0.89,
            suggestedCategory: 'network',
            slaRiskScore: 0.7,
            resolutionSuggestions: [
              {
                id: '5',
                title: 'Check ISP Connection',
                description: 'Contact ISP to check for any outages in the area',
                confidence: 0.82,
                source: 'ai_generated'
              }
            ],
            similarTickets: ['3']
          }
        }
      ];

      const { page = 1, limit = 20, search, filters } = options;
      
      let filteredTickets = mockTickets;
      
      // Apply search filter
      if (search) {
        filteredTickets = filteredTickets.filter(ticket => 
          ticket.title.toLowerCase().includes(search.toLowerCase()) ||
          ticket.description.toLowerCase().includes(search.toLowerCase()) ||
          ticket.externalId.toLowerCase().includes(search.toLowerCase())
        );
      }
      
      // Apply filters
      if (filters) {
        if (filters.status?.length) {
          filteredTickets = filteredTickets.filter(ticket => 
            filters.status!.includes(ticket.status)
          );
        }
        if (filters.priority?.length) {
          filteredTickets = filteredTickets.filter(ticket => 
            filters.priority!.includes(ticket.priority)
          );
        }
        if (filters.category?.length) {
          filteredTickets = filteredTickets.filter(ticket => 
            filters.category!.includes(ticket.category)
          );
        }
      }

      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedTickets = filteredTickets.slice(startIndex, endIndex);

      setMockData({
        tickets: paginatedTickets,
        total: filteredTickets.length,
        page,
        limit,
        totalPages: Math.ceil(filteredTickets.length / limit)
      });
      setIsLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, [options.page, options.limit, options.search, options.filters]);

  return {
    data: mockData,
    isLoading,
    error: null,
    refetch: () => {
      setIsLoading(true);
      // Trigger re-fetch
    }
  };
}