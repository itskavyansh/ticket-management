import request from 'supertest';
import express from 'express';
import { analyticsController } from '../AnalyticsController';
import { trendAnalysisService } from '../../services/TrendAnalysisService';

// Mock the trend analysis service
jest.mock('../../services/TrendAnalysisService');
const mockTrendAnalysisService = trendAnalysisService as jest.Mocked<typeof trendAnalysisService>;

// Mock authentication middleware
const mockAuthMiddleware = (req: any, res: any, next: any) => {
  req.user = { id: 'test-user-id', role: 'manager' };
  next();
};

describe('AnalyticsController - Trend Analysis', () => {
  let app: express.Application;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use(mockAuthMiddleware);
    
    // Set up routes
    app.get('/trend-insights', analyticsController.getTrendInsights);
    app.get('/advanced-bottlenecks', analyticsController.getAdvancedBottleneckAnalysis);
    app.get('/capacity-scenarios', analyticsController.getCapacityPredictionWithScenarios);
    
    jest.clearAllMocks();
  });

  describe('GET /trend-insights', () => {
    it('should return trend insights for multiple metrics', async () => {
      const mockInsights = {
        trends: [
          {
            metric: 'ticket_volume',
            period: { startDate: new Date('2024-01-01'), endDate: new Date('2024-01-31') },
            dataPoints: [
              { date: new Date('2024-01-01'), value: 100 },
              { date: new Date('2024-01-02'), value: 110 }
            ],
            trend: 'increasing' as const,
            trendPercentage: 10,
            seasonality: undefined,
            forecast: undefined
          }
        ],
        correlations: [
          {
            metric1: 'ticket_volume',
            metric2: 'response_time',
            correlation: 0.8,
            significance: 'high' as const
          }
        ],
        insights: [
          'Ticket volume is increasing by 10% - consider capacity planning'
        ]
      };

      mockTrendAnalysisService.generateTrendInsights.mockResolvedValue(mockInsights);

      const response = await request(app)
        .get('/trend-insights')
        .query({
          metrics: ['ticket_volume', 'response_time'],
          startDate: '2024-01-01',
          endDate: '2024-01-31',
          granularity: 'daily'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockInsights);
      expect(mockTrendAnalysisService.generateTrendInsights).toHaveBeenCalledWith(
        ['ticket_volume', 'response_time'],
        { startDate: new Date('2024-01-01'), endDate: new Date('2024-01-31') },
        'daily'
      );
    });

    it('should return 400 for missing required parameters', async () => {
      const response = await request(app)
        .get('/trend-insights')
        .query({
          metrics: ['ticket_volume']
          // Missing startDate and endDate
        });

      expect(response.status).toBe(400);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('required');
    });

    it('should handle service errors gracefully', async () => {
      mockTrendAnalysisService.generateTrendInsights.mockRejectedValue(
        new Error('Database connection failed')
      );

      const response = await request(app)
        .get('/trend-insights')
        .query({
          metrics: ['ticket_volume'],
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(500);
      expect(response.body.success).toBe(false);
      expect(response.body.error).toContain('Failed to generate trend insights');
    });
  });

  describe('GET /advanced-bottlenecks', () => {
    it('should return advanced bottleneck analysis', async () => {
      const mockAnalysis = {
        bottlenecks: [
          {
            type: 'technician' as const,
            identifier: 'tech-123',
            description: 'Technician overloaded',
            impact: 'high' as const,
            metrics: {
              affectedTickets: 25,
              delayImpact: 120,
              slaRisk: 35
            },
            recommendations: ['Redistribute workload'],
            detectedAt: new Date()
          }
        ],
        riskScore: 75,
        prioritizedActions: [
          {
            action: 'Redistribute workload',
            priority: 'high' as const,
            estimatedImpact: 25,
            timeToImplement: '1 week'
          }
        ]
      };

      mockTrendAnalysisService.detectAdvancedBottlenecks.mockResolvedValue(mockAnalysis);

      const response = await request(app)
        .get('/advanced-bottlenecks')
        .query({
          startDate: '2024-01-01',
          endDate: '2024-01-31'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockAnalysis);
    });
  });

  describe('GET /capacity-scenarios', () => {
    it('should return capacity prediction with scenarios', async () => {
      const mockPrediction = {
        basePrediction: {
          period: { startDate: new Date('2024-02-01'), endDate: new Date('2024-02-28') },
          predictedTicketVolume: 150,
          requiredTechnicianHours: 1200,
          availableTechnicianHours: 1000,
          capacityUtilization: 120,
          staffingGap: 200,
          recommendedActions: [],
          risks: [],
          confidence: 0.8,
          generatedAt: new Date()
        },
        scenarios: [
          {
            name: 'Optimistic',
            description: 'Lower than expected ticket volume',
            prediction: {
              period: { startDate: new Date('2024-02-01'), endDate: new Date('2024-02-28') },
              predictedTicketVolume: 120,
              requiredTechnicianHours: 960,
              availableTechnicianHours: 1000,
              capacityUtilization: 96,
              staffingGap: -40,
              recommendedActions: [],
              risks: [],
              confidence: 0.8,
              generatedAt: new Date()
            },
            probability: 0.2
          }
        ],
        recommendations: [
          {
            scenario: 'Optimistic',
            actions: ['Prepare for lower than expected ticket volume'],
            timeline: 'Next 2 weeks'
          }
        ]
      };

      mockTrendAnalysisService.generateCapacityPredictionWithScenarios.mockResolvedValue(mockPrediction);

      const response = await request(app)
        .get('/capacity-scenarios')
        .query({
          startDate: '2024-02-01',
          endDate: '2024-02-28'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toEqual(mockPrediction);
    });
  });
});