import { SLAService } from '../SLAService';
import { TicketEntity } from '../../entities/TicketEntity';
import { Priority, TicketStatus, TicketCategory } from '../../types';

// Mock the TicketRepository to avoid DynamoDB dependencies
jest.mock('../../database/repositories/TicketRepository', () => {
  return {
    TicketRepository: jest.fn().mockImplementation(() => ({
      search: jest.fn().mockResolvedValue({ tickets: [], totalCount: 0, hasMore: false }),
      update: jest.fn().mockResolvedValue(null)
    }))
  };
});

describe('SLAService', () => {
  let slaService: SLAService;

  beforeEach(() => {
    slaService = new SLAService();
  });

  describe('calculateSLADeadline', () => {
    it('should calculate correct deadline for enterprise critical ticket', () => {
      const createdAt = new Date('2024-01-01T09:00:00Z');
      const deadline = slaService.calculateSLADeadline('enterprise', Priority.CRITICAL, createdAt);
      
      // Enterprise critical should be 60 minutes (1 hour)
      const expectedDeadline = new Date('2024-01-01T10:00:00Z');
      expect(deadline).toEqual(expectedDeadline);
    });

    it('should calculate correct deadline for basic low priority ticket', () => {
      const createdAt = new Date('2024-01-01T09:00:00Z'); // Monday 9 AM
      const deadline = slaService.calculateSLADeadline('basic', Priority.LOW, createdAt);
      
      // Basic low should be 4320 minutes (72 hours = 9 business days)
      // Since it's business hours only, it should be 9 business days later
      const expectedDeadline = new Date('2024-01-12T09:00:00Z'); // Friday + weekend + next week
      expect(deadline).toEqual(expectedDeadline);
    });

    it('should handle business hours correctly', () => {
      const businessHours = {
        timezone: 'UTC',
        workingDays: [1, 2, 3, 4, 5], // Monday to Friday
        startHour: 9,
        endHour: 17,
        holidays: []
      };

      // Start on Friday at 4 PM (16:00)
      const createdAt = new Date('2024-01-05T16:00:00Z');
      const deadline = slaService.calculateSLADeadline('premium', Priority.HIGH, createdAt, businessHours);
      
      // Should extend into next business day (Monday)
      expect(deadline.getDay()).toBe(1); // Monday
    });
  });

  describe('calculateRiskScore', () => {
    it('should return 0 for resolved tickets', () => {
      const now = new Date('2024-01-01T15:00:00Z');
      const ticket = new TicketEntity({
        id: 'test-1',
        customerId: 'customer-1',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerTier: 'enterprise',
        title: 'Test Ticket',
        description: 'Test Description',
        category: TicketCategory.GENERAL,
        priority: Priority.HIGH,
        status: TicketStatus.RESOLVED,
        createdAt: new Date('2024-01-01T09:00:00Z'),
        slaDeadline: new Date('2024-01-01T17:00:00Z'),
        tags: [],
        attachments: [],
        timeSpent: 0,
        billableTime: 0,
        escalationLevel: 0
      });

      const riskScore = slaService.calculateRiskScore(ticket, now);
      expect(riskScore).toBe(0);
    });

    it('should return 1.0 for overdue tickets', () => {
      const now = new Date('2024-01-01T18:00:00Z');
      const ticket = new TicketEntity({
        id: 'test-1',
        customerId: 'customer-1',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerTier: 'enterprise',
        title: 'Test Ticket',
        description: 'Test Description',
        category: TicketCategory.GENERAL,
        priority: Priority.HIGH,
        status: TicketStatus.OPEN,
        createdAt: new Date('2024-01-01T09:00:00Z'),
        slaDeadline: new Date('2024-01-01T17:00:00Z'), // Already passed
        tags: [],
        attachments: [],
        timeSpent: 0,
        billableTime: 0,
        escalationLevel: 0
      });

      const riskScore = slaService.calculateRiskScore(ticket, now);
      expect(riskScore).toBe(1.0);
    });

    it('should calculate progressive risk score', () => {
      const now = new Date('2024-01-01T13:00:00Z'); // 4 hours into 8-hour SLA
      const ticket = new TicketEntity({
        id: 'test-1',
        customerId: 'customer-1',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerTier: 'enterprise',
        title: 'Test Ticket',
        description: 'Test Description',
        category: TicketCategory.GENERAL,
        priority: Priority.HIGH,
        status: TicketStatus.IN_PROGRESS,
        createdAt: new Date('2024-01-01T09:00:00Z'),
        slaDeadline: new Date('2024-01-01T17:00:00Z'),
        tags: [],
        attachments: [],
        timeSpent: 0,
        billableTime: 0,
        escalationLevel: 0
      });

      const riskScore = slaService.calculateRiskScore(ticket, now);
      
      // Should be between 0 and 1, increasing as time progresses
      expect(riskScore).toBeGreaterThan(0);
      expect(riskScore).toBeLessThan(1);
    });
  });

  describe('getRiskLevel', () => {
    it('should return correct risk levels', () => {
      expect(slaService.getRiskLevel(0.1)).toBe('low');
      expect(slaService.getRiskLevel(0.5)).toBe('medium');
      expect(slaService.getRiskLevel(0.8)).toBe('high');
      expect(slaService.getRiskLevel(0.95)).toBe('critical');
    });
  });

  describe('getSLAStatus', () => {
    it('should return correct SLA status', () => {
      const now = new Date('2024-01-01T13:00:00Z');
      const ticket = new TicketEntity({
        id: 'test-1',
        customerId: 'customer-1',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerTier: 'enterprise',
        title: 'Test Ticket',
        description: 'Test Description',
        category: TicketCategory.GENERAL,
        priority: Priority.HIGH,
        status: TicketStatus.IN_PROGRESS,
        createdAt: new Date('2024-01-01T09:00:00Z'),
        slaDeadline: new Date('2024-01-01T17:00:00Z'),
        tags: [],
        attachments: [],
        timeSpent: 0,
        billableTime: 0,
        escalationLevel: 0
      });

      const slaStatus = slaService.getSLAStatus(ticket, now);

      expect(slaStatus.ticketId).toBe('test-1');
      expect(slaStatus.customerId).toBe('customer-1');
      expect(slaStatus.timeRemaining).toBe(240); // 4 hours remaining
      expect(slaStatus.timeElapsed).toBe(240); // 4 hours elapsed
      expect(slaStatus.totalSLATime).toBe(480); // 8 hours total
      expect(slaStatus.progressPercentage).toBe(50); // 50% complete
      expect(slaStatus.isOverdue).toBe(false);
      expect(slaStatus.status).toBe(TicketStatus.IN_PROGRESS);
      expect(slaStatus.priority).toBe(Priority.HIGH);
    });

    it('should handle overdue tickets correctly', () => {
      const now = new Date('2024-01-01T18:00:00Z');
      const ticket = new TicketEntity({
        id: 'test-1',
        customerId: 'customer-1',
        customerName: 'Test Customer',
        customerEmail: 'test@example.com',
        customerTier: 'enterprise',
        title: 'Test Ticket',
        description: 'Test Description',
        category: TicketCategory.GENERAL,
        priority: Priority.HIGH,
        status: TicketStatus.OPEN,
        createdAt: new Date('2024-01-01T09:00:00Z'),
        slaDeadline: new Date('2024-01-01T17:00:00Z'),
        tags: [],
        attachments: [],
        timeSpent: 0,
        billableTime: 0,
        escalationLevel: 0
      });

      const slaStatus = slaService.getSLAStatus(ticket, now);

      expect(slaStatus.isOverdue).toBe(true);
      expect(slaStatus.minutesOverdue).toBe(60); // 1 hour overdue
      expect(slaStatus.timeRemaining).toBe(0);
      expect(slaStatus.riskScore).toBe(1.0);
      expect(slaStatus.riskLevel).toBe('critical');
    });
  });

  describe('getSLAConfiguration', () => {
    it('should return correct configuration for enterprise critical', () => {
      const config = slaService.getSLAConfiguration('enterprise', Priority.CRITICAL);
      
      expect(config).toBeDefined();
      expect(config?.customerTier).toBe('enterprise');
      expect(config?.priority).toBe(Priority.CRITICAL);
      expect(config?.responseTimeMinutes).toBe(15);
      expect(config?.resolutionTimeMinutes).toBe(60);
      expect(config?.businessHoursOnly).toBe(false);
    });

    it('should return correct configuration for basic low', () => {
      const config = slaService.getSLAConfiguration('basic', Priority.LOW);
      
      expect(config).toBeDefined();
      expect(config?.customerTier).toBe('basic');
      expect(config?.priority).toBe(Priority.LOW);
      expect(config?.responseTimeMinutes).toBe(480);
      expect(config?.resolutionTimeMinutes).toBe(4320);
      expect(config?.businessHoursOnly).toBe(true);
    });

    it('should return null for invalid configuration', () => {
      const config = slaService.getSLAConfiguration('invalid' as any, Priority.CRITICAL);
      expect(config).toBeNull();
    });
  });
});