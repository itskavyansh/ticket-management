import { TrendAnalysisService } from '../TrendAnalysisService';
import { postgresClient } from '../../database/postgresql/client';

// Mock the database client
jest.mock('../../database/postgresql/client');
const mockPostgresClient = postgresClient as jest.Mocked<typeof postgresClient>;

describe('TrendAnalysisService', () => {
  let trendAnalysisService: TrendAnalysisService;

  beforeEach(() => {
    trendAnalysisService = new TrendAnalysisService();
    jest.clearAllMocks();
  });

  describe('generateTrendInsights', () => {
    it('should generate trend insights for multiple metrics', async () => {
      // Mock database responses
      mockPostgresClient.queryRows.mockResolvedValue([
        { date: new Date('2024-01-01'), value: 100 },
        { date: new Date('2024-01-02'), value: 110 },
        { date: new Date('2024-01-03'), value: 120 }
      ]);

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-03')
      };

      const result = await trendAnalysisService.generateTrendInsights(
        ['ticket_volume', 'response_time'],
        period,
        'daily'
      );

      expect(result).toHaveProperty('trends');
      expect(result).toHaveProperty('correlations');
      expect(result).toHaveProperty('insights');
      expect(result.trends).toHaveLength(2);
      expect(Array.isArray(result.insights)).toBe(true);
    });

    it('should handle empty data gracefully', async () => {
      mockPostgresClient.queryRows.mockResolvedValue([]);

      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-03')
      };

      const result = await trendAnalysisService.generateTrendInsights(
        ['ticket_volume'],
        period,
        'daily'
      );

      expect(result.trends).toHaveLength(1);
      expect(result.trends[0].dataPoints).toHaveLength(0);
    });
  });

  describe('detectAdvancedBottlenecks', () => {
    it('should detect bottlenecks and calculate risk score', async () => {
      const period = {
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31')
      };

      const result = await trendAnalysisService.detectAdvancedBottlenecks(period);

      expect(result).toHaveProperty('bottlenecks');
      expect(result).toHaveProperty('riskScore');
      expect(result).toHaveProperty('prioritizedActions');
      expect(typeof result.riskScore).toBe('number');
      expect(Array.isArray(result.bottlenecks)).toBe(true);
      expect(Array.isArray(result.prioritizedActions)).toBe(true);
    });
  });

  describe('generateCapacityPredictionWithScenarios', () => {
    it('should generate capacity predictions with scenarios', async () => {
      const futurePeriod = {
        startDate: new Date('2024-02-01'),
        endDate: new Date('2024-02-28')
      };

      const result = await trendAnalysisService.generateCapacityPredictionWithScenarios(futurePeriod);

      expect(result).toHaveProperty('basePrediction');
      expect(result).toHaveProperty('scenarios');
      expect(result).toHaveProperty('recommendations');
      expect(Array.isArray(result.scenarios)).toBe(true);
      expect(Array.isArray(result.recommendations)).toBe(true);
    });
  });

  describe('private helper methods', () => {
    it('should calculate trend correctly', () => {
      const dataPoints = [
        { date: new Date('2024-01-01'), value: 100 },
        { date: new Date('2024-01-02'), value: 110 },
        { date: new Date('2024-01-03'), value: 120 }
      ];

      // Access private method through any casting for testing
      const trend = (trendAnalysisService as any).calculateTrend(dataPoints);

      expect(trend).toHaveProperty('direction');
      expect(trend).toHaveProperty('percentage');
      expect(['increasing', 'decreasing', 'stable']).toContain(trend.direction);
      expect(typeof trend.percentage).toBe('number');
    });

    it('should calculate correlation correctly', () => {
      const values1 = [1, 2, 3, 4, 5];
      const values2 = [2, 4, 6, 8, 10];

      const correlation = (trendAnalysisService as any).calculateCorrelation(values1, values2);

      expect(typeof correlation).toBe('number');
      expect(correlation).toBeGreaterThan(0.9); // Should be close to 1 for perfect positive correlation
    });

    it('should calculate variance correctly', () => {
      const values = [1, 2, 3, 4, 5];
      const variance = (trendAnalysisService as any).calculateVariance(values);

      expect(typeof variance).toBe('number');
      expect(variance).toBeGreaterThan(0);
    });
  });
});