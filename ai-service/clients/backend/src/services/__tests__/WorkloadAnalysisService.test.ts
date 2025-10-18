import { WorkloadAnalysisService } from '../WorkloadAnalysisService';
import { TimeTrackingService } from '../TimeTrackingService';
import { TicketService } from '../TicketService';
import { RiskLevel, TrendDirection, AlertType, AlertSeverity } from '../../models/WorkloadAnalysis';

// Mock the dependencies
jest.mock('../TimeTrackingService');
jest.mock('../TicketService');
jest.mock('../../database/repositories');

describe('WorkloadAnalysisService', () => {
  let workloadAnalysisService: WorkloadAnalysisService;
  let mockTimeTrackingService: jest.Mocked<TimeTrackingService>;
  let mockTicketService: jest.Mocked<TicketService>;

  beforeEach(() => {
    mockTimeTrackingService = new TimeTrackingService() as jest.Mocked<TimeTrackingService>;
    mockTicketService = new TicketService() as jest.Mocked<TicketService>;
    workloadAnalysisService = new WorkloadAnalysisService(mockTimeTrackingService, mockTicketService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('calculateTechnicianCapacity', () => {
    it('should calculate technician capacity correctly', async () => {
      // Mock technician data
      const mockTechnician = {
        id: 'tech-1',
        name: 'John Doe',
        maxCapacity: 10,
        skills: [
          { category: 'hardware', proficiencyLevel: 8 },
          { category: 'software', proficiencyLevel: 6 }
        ],
        availability: {
          workingHours: {
            monday: { start: '09:00', end: '17:00', isWorkingDay: true }
          }
        }
      };

      // Mock active tickets
      const mockTickets = [
        { id: 'ticket-1', category: 'hardware', status: 'in_progress' },
        { id: 'ticket-2', category: 'software', status: 'open' }
      ];

      // Mock time tracking stats
      const mockTimeStats = {
        productivityScore: 85,
        totalTime: 480,
        activeTime: 400,
        idleTime: 80
      };

      // Setup mocks
      jest.spyOn(workloadAnalysisService as any, 'getTechnicianById')
        .mockResolvedValue(mockTechnician);
      
      mockTicketService.getTicketsByTechnician.mockResolvedValue(mockTickets as any);
      mockTicketService.searchTickets.mockResolvedValue({
        tickets: [],
        totalCount: 0,
        hasMore: false
      } as any);
      mockTimeTrackingService.getTimeTrackingStats.mockResolvedValue(mockTimeStats as any);
      mockTimeTrackingService.getTimeTrackingSummary.mockResolvedValue({
        totalTime: 480,
        activeTime: 400,
        idleTime: 80
      } as any);

      // Execute
      const capacity = await workloadAnalysisService.calculateTechnicianCapacity('tech-1');

      // Assertions
      expect(capacity).toBeDefined();
      expect(capacity.technicianId).toBe('tech-1');
      expect(capacity.maxConcurrentTickets).toBe(10);
      expect(capacity.currentActiveTickets).toBe(2);
      expect(capacity.availableCapacity).toBe(8);
      expect(capacity.utilizationPercentage).toBe(20);
      expect(capacity.skillCapacities).toHaveLength(2);
    });

    it('should handle technician not found', async () => {
      jest.spyOn(workloadAnalysisService as any, 'getTechnicianById')
        .mockResolvedValue(null);

      await expect(workloadAnalysisService.calculateTechnicianCapacity('invalid-id'))
        .rejects.toThrow('Technician not found');
    });
  });

  describe('generateWorkloadPrediction', () => {
    it('should generate workload prediction with risk assessment', async () => {
      // Mock historical data
      const mockHistoricalData = [
        { date: new Date(), ticketCount: 5, utilization: 75, workHours: 8 },
        { date: new Date(), ticketCount: 6, utilization: 80, workHours: 8 },
        { date: new Date(), ticketCount: 7, utilization: 85, workHours: 9 }
      ];

      jest.spyOn(workloadAnalysisService as any, 'getHistoricalWorkloadData')
        .mockResolvedValue(mockHistoricalData);

      // Execute
      const prediction = await workloadAnalysisService.generateWorkloadPrediction('tech-1');

      // Assertions
      expect(prediction).toBeDefined();
      expect(prediction.technicianId).toBe('tech-1');
      expect(prediction.predictedTicketCount).toBeGreaterThan(0);
      expect(prediction.predictedUtilization).toBeGreaterThan(0);
      expect(prediction.overutilizationRisk).toBeOneOf(Object.values(RiskLevel));
      expect(prediction.workloadTrend).toBeOneOf(Object.values(TrendDirection));
      expect(prediction.predictionConfidence).toBeGreaterThanOrEqual(0);
      expect(prediction.predictionConfidence).toBeLessThanOrEqual(100);
    });
  });

  describe('generateWorkloadAlerts', () => {
    it('should generate overutilization alert when threshold exceeded', async () => {
      const mockCapacity = {
        technicianId: 'tech-1',
        utilizationPercentage: 95,
        maxConcurrentTickets: 10,
        currentActiveTickets: 10,
        availableCapacity: 0
      };

      const mockPrediction = {
        technicianId: 'tech-1',
        predictedUtilization: 90,
        burnoutRisk: RiskLevel.MEDIUM,
        slaRisk: RiskLevel.LOW,
        predictedTicketCount: 8
      };

      // Execute
      const alerts = await workloadAnalysisService.generateWorkloadAlerts(
        'tech-1',
        mockCapacity as any,
        mockPrediction as any
      );

      // Assertions
      expect(alerts).toBeDefined();
      expect(alerts.length).toBeGreaterThan(0);
      
      const overutilizationAlert = alerts.find(alert => alert.alertType === AlertType.OVERUTILIZATION);
      expect(overutilizationAlert).toBeDefined();
      expect(overutilizationAlert?.severity).toBe(AlertSeverity.WARNING);
      expect(overutilizationAlert?.isActive).toBe(true);
    });

    it('should generate capacity exceeded alert when at maximum', async () => {
      const mockCapacity = {
        technicianId: 'tech-1',
        utilizationPercentage: 100,
        maxConcurrentTickets: 10,
        currentActiveTickets: 10,
        availableCapacity: 0
      };

      const mockPrediction = {
        technicianId: 'tech-1',
        predictedUtilization: 100,
        burnoutRisk: RiskLevel.LOW,
        slaRisk: RiskLevel.LOW,
        predictedTicketCount: 10
      };

      // Execute
      const alerts = await workloadAnalysisService.generateWorkloadAlerts(
        'tech-1',
        mockCapacity as any,
        mockPrediction as any
      );

      // Assertions
      const capacityAlert = alerts.find(alert => alert.alertType === AlertType.CAPACITY_EXCEEDED);
      expect(capacityAlert).toBeDefined();
      expect(capacityAlert?.severity).toBe(AlertSeverity.CRITICAL);
    });
  });

  describe('generateWorkloadRecommendations', () => {
    it('should generate redistribution recommendation for overutilized technician', async () => {
      const mockCapacity = {
        technicianId: 'tech-1',
        utilizationPercentage: 95,
        maxConcurrentTickets: 10,
        currentActiveTickets: 10,
        availableCapacity: 0,
        skillCapacities: [],
        efficiencyScore: 80
      };

      const mockPrediction = {
        technicianId: 'tech-1',
        predictedUtilization: 90,
        burnoutRisk: RiskLevel.MEDIUM,
        slaRisk: RiskLevel.LOW
      };

      const mockAlerts = [
        {
          alertType: AlertType.OVERUTILIZATION,
          severity: AlertSeverity.WARNING,
          isActive: true
        }
      ];

      // Execute
      const recommendations = await workloadAnalysisService.generateWorkloadRecommendations(
        'tech-1',
        mockCapacity as any,
        mockPrediction as any,
        mockAlerts as any
      );

      // Assertions
      expect(recommendations).toBeDefined();
      expect(recommendations.length).toBeGreaterThan(0);
      
      const redistributionRec = recommendations.find(rec => 
        rec.title.toLowerCase().includes('redistribute')
      );
      expect(redistributionRec).toBeDefined();
      expect(redistributionRec?.expectedImpact).toBeGreaterThan(0);
    });
  });

  describe('detectOverutilization', () => {
    it('should detect overutilized technicians and generate alerts', async () => {
      // Mock technicians
      const mockTechnicians = [
        { id: 'tech-1', name: 'John Doe', isActive: true },
        { id: 'tech-2', name: 'Jane Smith', isActive: true }
      ];

      jest.spyOn(workloadAnalysisService as any, 'getAllTechnicians')
        .mockResolvedValue(mockTechnicians);

      // Mock capacity calculations
      jest.spyOn(workloadAnalysisService, 'calculateTechnicianCapacity')
        .mockResolvedValueOnce({
          technicianId: 'tech-1',
          utilizationPercentage: 95,
          maxConcurrentTickets: 10,
          currentActiveTickets: 10
        } as any)
        .mockResolvedValueOnce({
          technicianId: 'tech-2',
          utilizationPercentage: 60,
          maxConcurrentTickets: 8,
          currentActiveTickets: 5
        } as any);

      // Mock prediction generation
      jest.spyOn(workloadAnalysisService, 'generateWorkloadPrediction')
        .mockResolvedValue({
          technicianId: 'tech-1',
          predictedUtilization: 90,
          burnoutRisk: RiskLevel.MEDIUM,
          slaRisk: RiskLevel.LOW
        } as any);

      // Execute
      const alerts = await workloadAnalysisService.detectOverutilization();

      // Assertions
      expect(alerts).toBeDefined();
      expect(Array.isArray(alerts)).toBe(true);
      // Should have alerts for the overutilized technician
      const tech1Alerts = alerts.filter(alert => alert.technicianId === 'tech-1');
      expect(tech1Alerts.length).toBeGreaterThan(0);
    });
  });
});

// Helper function for Jest custom matchers
expect.extend({
  toBeOneOf(received, validOptions) {
    const pass = validOptions.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${validOptions}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${validOptions}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(validOptions: any[]): R;
    }
  }
}