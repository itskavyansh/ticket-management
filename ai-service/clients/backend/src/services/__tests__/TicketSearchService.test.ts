import { TicketService } from '../TicketService';
import { TicketRepository } from '../../database/repositories/TicketRepository';
import { TicketEntity } from '../../entities/TicketEntity';
import { TicketSearchQuery, TicketFilter } from '../../models/Ticket';
import { TicketStatus, Priority, TicketCategory } from '../../types';

// Mock the repository
jest.mock('../../database/repositories/TicketRepository');
jest.mock('../../utils/logger');

describe('TicketService - Search and Filtering', () => {
  let ticketService: TicketService;
  let mockTicketRepository: jest.Mocked<TicketRepository>;

  const mockTickets = [
    new TicketEntity({
      id: 'ticket-1',
      title: 'Network connectivity issue',
      description: 'Unable to connect to the internet',
      customerId: 'customer-1',
      customerName: 'Acme Corp',
      customerEmail: 'admin@acme.com',
      customerTier: 'enterprise',
      priority: Priority.HIGH,
      category: TicketCategory.NETWORK,
      status: TicketStatus.OPEN,
      tags: ['network', 'connectivity'],
      attachments: [],
      timeSpent: 120,
      billableTime: 120,
      escalationLevel: 0,
      createdAt: new Date('2024-01-15T10:00:00Z'),
      updatedAt: new Date('2024-01-15T10:30:00Z'),
      slaDeadline: new Date('2024-01-15T14:00:00Z')
    }),
    new TicketEntity({
      id: 'ticket-2',
      title: 'Software installation problem',
      description: 'Cannot install required software',
      customerId: 'customer-2',
      customerName: 'Beta Inc',
      customerEmail: 'support@beta.com',
      customerTier: 'premium',
      priority: Priority.MEDIUM,
      category: TicketCategory.SOFTWARE,
      status: TicketStatus.IN_PROGRESS,
      assignedTechnicianId: 'tech-1',
      tags: ['software', 'installation'],
      attachments: [{ id: 'att-1', filename: 'error.log', url: 'https://example.com/error.log', size: 1024, mimeType: 'text/plain', uploadedAt: new Date() }],
      timeSpent: 60,
      billableTime: 60,
      escalationLevel: 1,
      createdAt: new Date('2024-01-14T09:00:00Z'),
      updatedAt: new Date('2024-01-14T11:00:00Z'),
      slaDeadline: new Date('2024-01-14T17:00:00Z')
    }),
    new TicketEntity({
      id: 'ticket-3',
      title: 'Hardware failure',
      description: 'Server hardware malfunction',
      customerId: 'customer-1',
      customerName: 'Acme Corp',
      customerEmail: 'admin@acme.com',
      customerTier: 'enterprise',
      priority: Priority.CRITICAL,
      category: TicketCategory.HARDWARE,
      status: TicketStatus.RESOLVED,
      assignedTechnicianId: 'tech-2',
      tags: ['hardware', 'server'],
      attachments: [],
      timeSpent: 240,
      billableTime: 200,
      escalationLevel: 0,
      resolvedAt: new Date('2024-01-13T16:00:00Z'),
      createdAt: new Date('2024-01-13T08:00:00Z'),
      updatedAt: new Date('2024-01-13T16:00:00Z'),
      slaDeadline: new Date('2024-01-13T12:00:00Z')
    })
  ];

  beforeEach(() => {
    mockTicketRepository = new TicketRepository() as jest.Mocked<TicketRepository>;
    ticketService = new TicketService();
    (ticketService as any).ticketRepository = mockTicketRepository;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('searchTickets', () => {
    it('should search tickets with basic query', async () => {
      const searchQuery: TicketSearchQuery = {
        query: 'network',
        page: 1,
        limit: 20
      };

      mockTicketRepository.search.mockResolvedValue({
        tickets: [mockTickets[0]],
        totalCount: 1,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].title).toContain('Network');
      expect(result.totalCount).toBe(1);
      expect(result.hasMore).toBe(false);
    });

    it('should filter tickets by status', async () => {
      const searchQuery: TicketSearchQuery = {
        filters: {
          status: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS]
        },
        page: 1,
        limit: 20
      };

      const filteredTickets = mockTickets.filter(t => 
        [TicketStatus.OPEN, TicketStatus.IN_PROGRESS].includes(t.status)
      );

      mockTicketRepository.search.mockResolvedValue({
        tickets: filteredTickets,
        totalCount: filteredTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(2);
      expect(result.tickets.every(t => 
        [TicketStatus.OPEN, TicketStatus.IN_PROGRESS].includes(t.status)
      )).toBe(true);
    });

    it('should filter tickets by priority', async () => {
      const searchQuery: TicketSearchQuery = {
        filters: {
          priority: [Priority.HIGH, Priority.CRITICAL]
        },
        page: 1,
        limit: 20
      };

      const filteredTickets = mockTickets.filter(t => 
        [Priority.HIGH, Priority.CRITICAL].includes(t.priority)
      );

      mockTicketRepository.search.mockResolvedValue({
        tickets: filteredTickets,
        totalCount: filteredTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(2);
      expect(result.tickets.every(t => 
        [Priority.HIGH, Priority.CRITICAL].includes(t.priority)
      )).toBe(true);
    });

    it('should filter tickets by customer tier', async () => {
      const searchQuery: TicketSearchQuery = {
        filters: {
          customerTier: ['enterprise']
        },
        page: 1,
        limit: 20
      };

      const filteredTickets = mockTickets.filter(t => t.customerTier === 'enterprise');

      mockTicketRepository.search.mockResolvedValue({
        tickets: filteredTickets,
        totalCount: filteredTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(2);
      expect(result.tickets.every(t => t.customerTier === 'enterprise')).toBe(true);
    });

    it('should filter tickets by date range', async () => {
      const searchQuery: TicketSearchQuery = {
        filters: {
          createdAfter: new Date('2024-01-14T00:00:00Z'),
          createdBefore: new Date('2024-01-16T00:00:00Z')
        },
        page: 1,
        limit: 20
      };

      const filteredTickets = mockTickets.filter(t => 
        t.createdAt >= new Date('2024-01-14T00:00:00Z') &&
        t.createdAt <= new Date('2024-01-16T00:00:00Z')
      );

      mockTicketRepository.search.mockResolvedValue({
        tickets: filteredTickets,
        totalCount: filteredTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(2);
    });

    it('should filter tickets by tags', async () => {
      const searchQuery: TicketSearchQuery = {
        filters: {
          tags: ['network']
        },
        page: 1,
        limit: 20
      };

      const filteredTickets = mockTickets.filter(t => 
        t.tags.includes('network')
      );

      mockTicketRepository.search.mockResolvedValue({
        tickets: filteredTickets,
        totalCount: filteredTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].tags).toContain('network');
    });

    it('should filter tickets by escalation level', async () => {
      const searchQuery: TicketSearchQuery = {
        filters: {
          escalationLevel: [1]
        },
        page: 1,
        limit: 20
      };

      const filteredTickets = mockTickets.filter(t => t.escalationLevel === 1);

      mockTicketRepository.search.mockResolvedValue({
        tickets: filteredTickets,
        totalCount: filteredTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].escalationLevel).toBe(1);
    });

    it('should handle pagination correctly', async () => {
      const searchQuery: TicketSearchQuery = {
        page: 2,
        limit: 1
      };

      mockTicketRepository.search.mockResolvedValue({
        tickets: [mockTickets[1]],
        totalCount: 3,
        hasMore: true
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.page).toBe(2);
      expect(result.limit).toBe(1);
      expect(result.totalCount).toBe(3);
      expect(result.hasMore).toBe(true);
    });

    it('should sort tickets by different criteria', async () => {
      const searchQuery: TicketSearchQuery = {
        sortBy: 'priority',
        sortOrder: 'desc',
        page: 1,
        limit: 20
      };

      const sortedTickets = [...mockTickets].sort((a, b) => {
        const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder];
        const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder];
        return bPriority - aPriority;
      });

      mockTicketRepository.search.mockResolvedValue({
        tickets: sortedTickets,
        totalCount: sortedTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets[0].priority).toBe(Priority.CRITICAL);
      expect(result.tickets[1].priority).toBe(Priority.HIGH);
      expect(result.tickets[2].priority).toBe(Priority.MEDIUM);
    });

    it('should exclude resolved tickets by default', async () => {
      const searchQuery: TicketSearchQuery = {
        includeResolved: false,
        page: 1,
        limit: 20
      };

      const filteredTickets = mockTickets.filter(t => t.status !== TicketStatus.RESOLVED);

      mockTicketRepository.search.mockResolvedValue({
        tickets: filteredTickets,
        totalCount: filteredTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(2);
      expect(result.tickets.every(t => t.status !== TicketStatus.RESOLVED)).toBe(true);
    });

    it('should handle complex filter combinations', async () => {
      const searchQuery: TicketSearchQuery = {
        query: 'network',
        filters: {
          status: [TicketStatus.OPEN],
          priority: [Priority.HIGH],
          customerTier: ['enterprise'],
          tags: ['network']
        },
        sortBy: 'createdAt',
        sortOrder: 'desc',
        page: 1,
        limit: 20
      };

      const filteredTickets = mockTickets.filter(t => 
        t.title.toLowerCase().includes('network') &&
        t.status === TicketStatus.OPEN &&
        t.priority === Priority.HIGH &&
        t.customerTier === 'enterprise' &&
        t.tags.includes('network')
      );

      mockTicketRepository.search.mockResolvedValue({
        tickets: filteredTickets,
        totalCount: filteredTickets.length,
        hasMore: false
      });

      const result = await ticketService.searchTickets(searchQuery);

      expect(result.tickets).toHaveLength(1);
      expect(result.tickets[0].id).toBe('ticket-1');
    });
  });

  describe('generateSearchFacets', () => {
    it('should generate facets for search results', async () => {
      const searchQuery: TicketSearchQuery = {
        query: 'issue'
      };

      mockTicketRepository.search.mockResolvedValue({
        tickets: mockTickets,
        totalCount: mockTickets.length,
        hasMore: false
      });

      const facets = await ticketService.generateSearchFacets(searchQuery);

      expect(facets.status).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: TicketStatus.OPEN, count: 1 }),
          expect.objectContaining({ value: TicketStatus.IN_PROGRESS, count: 1 }),
          expect.objectContaining({ value: TicketStatus.RESOLVED, count: 1 })
        ])
      );

      expect(facets.priority).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: Priority.CRITICAL, count: 1 }),
          expect.objectContaining({ value: Priority.HIGH, count: 1 }),
          expect.objectContaining({ value: Priority.MEDIUM, count: 1 })
        ])
      );

      expect(facets.customerTier).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ value: 'enterprise', count: 2 }),
          expect.objectContaining({ value: 'premium', count: 1 })
        ])
      );
    });
  });

  describe('validation', () => {
    it('should validate search query parameters', async () => {
      const invalidSearchQuery: TicketSearchQuery = {
        page: 0, // Invalid page number
        limit: 150 // Exceeds maximum limit
      };

      await expect(ticketService.searchTickets(invalidSearchQuery))
        .rejects.toThrow('Validation failed');
    });

    it('should validate date ranges in filters', async () => {
      const invalidSearchQuery: TicketSearchQuery = {
        filters: {
          createdAfter: new Date('2024-01-15T00:00:00Z'),
          createdBefore: new Date('2024-01-14T00:00:00Z') // Before start date
        }
      };

      await expect(ticketService.searchTickets(invalidSearchQuery))
        .rejects.toThrow('Validation failed');
    });
  });
});