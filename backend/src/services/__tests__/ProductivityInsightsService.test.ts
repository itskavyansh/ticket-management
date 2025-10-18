import { ProductivityInsightsService } from '../ProductivityInsightsService';
import { TimeTrackingService } from '../TimeTrackingService';
import { TicketService } from '../TicketService';
import { DateRange, TicketStatus, Priority, TicketCategory } from '../../types';

// Mock the dependencies
jest.mock('../TimeTrackingService');
jest.mock('../TicketService');

describe('ProductivityInsightsService', () => {
  let productivityInsightsService: ProductivityInsightsService;
  let mockTimeTrackingService: jest.Mocked<TimeTrackingService>;
  let mockTicketService: jest.Mocked<TicketService>;

  const mockTechnicianId = 'tech-123';
  const mockPeriod: DateRange = {
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-31')
  };

  beforeEach(() => {
    mockTimeTrackingService = new TimeTrackingService() as jest.Mocked<TimeTrackingService>;
    mockTicketService = new TicketService() as jest.Mocked<TicketService>;
    
    productivityInsightsService = new ProductivityInsightsService(
      mockTimeTrackingService,
      mockTicketService
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateThroughputMetrics', () => {
    it('should calculate throughput metrics correctly', async () => {
      // Mock ticket data
      const mockTickets = [
        { id: '1', assignedTechnicianId: mockTechnicianId, status: TicketStatus.RESOLVED },
        { id: '2', assignedTechnicianId: mockTechnicianId, status: TicketStatus.CLOSED },
        { id: '3', assignedTechnicianId: mockTechnicianId, status: TicketStatus.RESOLVED }
      ];

      // Mock time tracking data
      const mockTimeTrackingSummary = {
        technicianId: mockTechnicianId,
        period: mockPeriod,
        totalTime: 2400, // 40 hours in minutes
        billableTime: 2160, // 36 hours
        activeTime: 2160, // 36 hours active
        idleTime: 240, // 4 hours idle
        ticketsWorked: 3,
        averageSessionDuration: 800,
        utilizationRate: 90,
        dailyBreakdown: []
      };

      mockTicketService.searchTickets.mockResolvedValue({
        tickets: mockTickets as any,
        totalCount: mockTickets.length,
        hasMore: false,
        page: 1,
        limit: 20
      });
      mockTimeTrackingService.getTimeTrackingSummary.mockResolvedValue(mockTimeTrackingSummary);

      const result = await productivityInsightsService.calculateThroughputMetrics(
        mockTechnicianId,
        mockPeriod
      );

      expect(result).toEqual({
        technicianId: mockTechnicianId,
        period: mockPeriod,
        ticketsCompleted: 3,
        ticketsPerDay: expect.any(Number),
        ticketsPerHour: expect.any(Number),
        averageTicketsPerWeek: expect.any(Number),
        peakProductivityHours: expect.any(Array),
        productivityTrend: expect.any(String)
      });

      expect(result.ticketsCompleted).toBe(3);
      expect(result.ticketsPerHour).toBeGreaterThan(0);
    });

    it('should handle empty ticket data', async () => {
      mockTicketService.searchTickets.mockResolvedValue({
        tickets: [],
        totalCount: 0,
        hasMore: false,
        page: 1,
        limit: 20
      });
      mockTimeTrackingService.getTimeTrackingSummary.mockResolvedValue({
        technicianId: mockTechnicianId,
        period: mockPeriod,
        totalTime: 0,
        billableTime: 0,
        activeTime: 0,
        idleTime: 0,
        ticketsWorked: 0,
        averageSessionDuration: 0,
        utilizationRate: 0,
        dailyBreakdown: []
      });

      const result = await productivityInsightsService.calculateThroughputMetrics(
        mockTechnicianId,
        mockPeriod
      );

      expect(result.ticketsCompleted).toBe(0);
      expect(result.ticketsPerDay).toBe(0);
      expect(result.ticketsPerHour).toBe(0);
    });
  });

  describe('analyzeResolutionTimes', () => {
    it('should analyze resolution times correctly', async () => {
      const mockTickets = [
        {
          id: '1',
          assignedTechnicianId: mockTechnicianId,
          status: TicketStatus.RESOLVED,
          actualResolutionTime: 120, // 2 hours
          category: TicketCategory.SOFTWARE,
          priority: Priority.HIGH
        },
        {
          id: '2',
          assignedTechnicianId: mockTechnicianId,
          status: TicketStatus.RESOLVED,
          actualResolutionTime: 180, // 3 hours
          category: TicketCategory.HARDWARE,
          priority: Priority.MEDIUM
        },
        {
          id: '3',
          assignedTechnicianId: mockTechnicianId,
          status: TicketStatus.RESOLVED,
          actualResolutionTime: 60, // 1 hour
          category: TicketCategory.SOFTWARE,
          priority: Priority.LOW
        }
      ];

      mockTicketService.searchTickets.mockResolvedValue({
        tickets: mockTickets as any,
        totalCount: mockTickets.length,
        hasMore: false,
        page: 1,
        limit: 20
      });

      const result = await productivityInsightsService.analyzeResolutionTimes(
        mockTechnicianId,
        mockPeriod
      );

      expect(result).toEqual({
        technicianId: mockTechnicianId,
        period: mockPeriod,
        averageResolutionTime: 120, // (120 + 180 + 60) / 3
        medianResolutionTime: 120,
        resolutionTimeByCategory: expect.any(Object),
        resolutionTimeByPriority: expect.any(Object),
        improvementOpportunities: expect.any(Array),
        benchmarkComparison: expect.any(Object)
      });

      expect(result.averageResolutionTime).toBe(120);
      expect(result.medianResolutionTime).toBe(120);
    });

    it('should throw error when no resolved tickets found', async () => {
      mockTicketService.searchTickets.mockResolvedValue({
        tickets: [],
        totalCount: 0,
        hasMore: false,
        page: 1,
        limit: 20
      });

      await expect(
        productivityInsightsService.analyzeResolutionTimes(mockTechnicianId, mockPeriod)
      ).rejects.toThrow('No resolved tickets found for the specified period');
    });
  });

  describe('generateIndividualPerformanceMetrics', () => {
    it('should generate comprehensive performance metrics', async () => {
      // Mock all the required data
      const mockTickets = [
        {
          id: '1',
          assignedTechnicianId: mockTechnicianId,
          status: TicketStatus.RESOLVED,
          actualResolutionTime: 120,
          category: TicketCategory.SOFTWARE,
          priority: Priority.HIGH
        }
      ];

      const mockTimeTrackingSummary = {
        technicianId: mockTechnicianId,
        period: mockPeriod,
        totalTime: 480, // 8 hours
        billableTime: 432, // 7.2 hours
        activeTime: 432,
        idleTime: 48,
        ticketsWorked: 1,
        averageSessionDuration: 480,
        utilizationRate: 90,
        dailyBreakdown: []
      };

      mockTicketService.searchTickets.mockResolvedValue({
        tickets: mockTickets as any,
        totalCount: mockTickets.length,
        hasMore: false,
        page: 1,
        limit: 20
      });
      mockTimeTrackingService.getTimeTrackingSummary.mockResolvedValue(mockTimeTrackingSummary);

      const result = await productivityInsightsService.generateIndividualPerformanceMetrics(
        mockTechnicianId,
        mockPeriod
      );

      expect(result).toHaveProperty('technicianId', mockTechnicianId);
      expect(result).toHaveProperty('period', mockPeriod);
      expect(result).toHaveProperty('ticketsResolved');
      expect(result).toHaveProperty('averageResolutionTime');
      expect(result).toHaveProperty('slaComplianceRate');
      expect(result).toHaveProperty('customerSatisfactionScore');
      expect(result).toHaveProperty('utilizationRate');
      expect(result).toHaveProperty('firstCallResolutionRate');
      expect(result).toHaveProperty('insights');
      expect(Array.isArray(result.insights)).toBe(true);
    });
  });

  describe('generateTeamProductivityReport', () => {
    it('should generate team productivity report', async () => {
      const technicianIds = ['tech-1', 'tech-2'];
      
      // Mock individual metrics for each technician
      const mockTickets = [
        {
          id: '1',
          assignedTechnicianId: 'tech-1',
          status: TicketStatus.RESOLVED,
          actualResolutionTime: 120,
          category: TicketCategory.SOFTWARE,
          priority: Priority.HIGH
        }
      ];

      const mockTimeTrackingSummary = {
        technicianId: 'tech-1',
        period: mockPeriod,
        totalTime: 480,
        billableTime: 432,
        activeTime: 432,
        idleTime: 48,
        ticketsWorked: 1,
        averageSessionDuration: 480,
        utilizationRate: 90,
        dailyBreakdown: []
      };

      mockTicketService.searchTickets.mockResolvedValue({
        tickets: mockTickets as any,
        totalCount: mockTickets.length,
        hasMore: false,
        page: 1,
        limit: 20
      });
      mockTimeTrackingService.getTimeTrackingSummary.mockResolvedValue(mockTimeTrackingSummary);

      const result = await productivityInsightsService.generateTeamProductivityReport(
        technicianIds,
        mockPeriod,
        'team-1'
      );

      expect(result).toHaveProperty('teamId', 'team-1');
      expect(result).toHaveProperty('period', mockPeriod);
      expect(result).toHaveProperty('overallMetrics');
      expect(result).toHaveProperty('individualPerformance');
      expect(result).toHaveProperty('productivityTrends');
      expect(result).toHaveProperty('bottlenecks');
      expect(result).toHaveProperty('insights');
      expect(result).toHaveProperty('recommendations');
      
      expect(Array.isArray(result.individualPerformance)).toBe(true);
      expect(Array.isArray(result.productivityTrends)).toBe(true);
      expect(Array.isArray(result.bottlenecks)).toBe(true);
      expect(Array.isArray(result.insights)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });

    it('should handle empty technician list', async () => {
      const result = await productivityInsightsService.generateTeamProductivityReport(
        [],
        mockPeriod
      );

      expect(result.individualPerformance).toHaveLength(0);
      expect(result.overallMetrics.totalTicketsResolved).toBe(0);
    });
  });

  describe('generateProductivityTrends', () => {
    it('should generate productivity trends', async () => {
      const technicianIds = ['tech-1', 'tech-2'];

      const result = await productivityInsightsService.generateProductivityTrends(
        technicianIds,
        mockPeriod
      );

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
      
      // Check that each trend has required properties
      result.forEach(trend => {
        expect(trend).toHaveProperty('metric');
        expect(trend).toHaveProperty('period');
        expect(trend).toHaveProperty('dataPoints');
        expect(trend).toHaveProperty('trend');
        expect(trend).toHaveProperty('trendPercentage');
      });
    });
  });
});