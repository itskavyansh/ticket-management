import { postgresClient } from '../database/postgresql/client';
import { logger } from '../utils/logger';
import {
  TrendAnalysis,
  BottleneckAnalysis,
  CapacityPrediction
} from '../models/Analytics';
import { DateRange } from '../types';

/**
 * Advanced trend analysis and insights service
 * Provides historical trend calculation, bottleneck detection, and predictive analytics
 */
export class TrendAnalysisService {
  
  /**
   * Generate comprehensive trend insights for multiple metrics
   */
  async generateTrendInsights(
    metrics: string[],
    period: DateRange,
    granularity: 'daily' | 'weekly' | 'monthly' = 'daily'
  ): Promise<{
    trends: TrendAnalysis[];
    correlations: Array<{
      metric1: string;
      metric2: string;
      correlation: number;
      significance: 'low' | 'medium' | 'high';
    }>;
    insights: string[];
  }> {
    try {
      // Generate trend analysis for each metric
      const trends = await Promise.all(
        metrics.map(metric => this.generateSingleTrendAnalysis(metric, period, granularity))
      );

      // Calculate correlations between metrics
      const correlations = this.calculateMetricCorrelations(trends);

      // Generate actionable insights
      const insights = this.generateActionableInsights(trends, correlations);

      logger.info('Trend insights generated successfully', {
        metrics,
        period,
        trendsCount: trends.length,
        correlationsCount: correlations.length
      });

      return {
        trends,
        correlations,
        insights
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate trend insights', { error: errorMessage });
      throw new Error(`Trend insights generation failed: ${errorMessage}`);
    }
  }

  /**
   * Detect performance bottlenecks with advanced analytics
   */
  async detectAdvancedBottlenecks(period: DateRange): Promise<{
    bottlenecks: BottleneckAnalysis[];
    riskScore: number;
    prioritizedActions: Array<{
      action: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      estimatedImpact: number;
      timeToImplement: string;
    }>;
  }> {
    try {
      const bottlenecks: BottleneckAnalysis[] = [];

      // Detect different types of bottlenecks
      const [
        technicianBottlenecks,
        categoryBottlenecks,
        customerBottlenecks,
        processBottlenecks,
        timeBasedBottlenecks
      ] = await Promise.all([
        this.detectTechnicianBottlenecks(period),
        this.detectCategoryBottlenecks(period),
        this.detectCustomerBottlenecks(period),
        this.detectProcessBottlenecks(period),
        this.detectTimeBasedBottlenecks(period)
      ]);

      bottlenecks.push(
        ...technicianBottlenecks,
        ...categoryBottlenecks,
        ...customerBottlenecks,
        ...processBottlenecks,
        ...timeBasedBottlenecks
      );

      // Calculate overall risk score
      const riskScore = this.calculateOverallRiskScore(bottlenecks);

      // Generate prioritized action plan
      const prioritizedActions = this.generatePrioritizedActions(bottlenecks);

      logger.info('Advanced bottleneck detection completed', {
        period,
        bottlenecksFound: bottlenecks.length,
        riskScore
      });

      return {
        bottlenecks,
        riskScore,
        prioritizedActions
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to detect advanced bottlenecks', { error: errorMessage });
      throw new Error(`Advanced bottleneck detection failed: ${errorMessage}`);
    }
  }

  /**
   * Generate capacity predictions with scenario analysis
   */
  async generateCapacityPredictionWithScenarios(
    futurePeriod: DateRange
  ): Promise<{
    basePrediction: CapacityPrediction;
    scenarios: Array<{
      name: string;
      description: string;
      prediction: CapacityPrediction;
      probability: number;
    }>;
    recommendations: Array<{
      scenario: string;
      actions: string[];
      timeline: string;
    }>;
  }> {
    try {
      // Generate base prediction
      const basePrediction = await this.generateBasePrediction(futurePeriod);

      // Generate scenario predictions
      const scenarios = await this.generateScenarioPredictions(futurePeriod, basePrediction);

      // Generate scenario-based recommendations
      const recommendations = this.generateScenarioRecommendations(scenarios);

      logger.info('Capacity prediction with scenarios generated', {
        futurePeriod,
        scenariosCount: scenarios.length
      });

      return {
        basePrediction,
        scenarios,
        recommendations
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Failed to generate capacity prediction with scenarios', { error: errorMessage });
      throw new Error(`Capacity prediction with scenarios failed: ${errorMessage}`);
    }
  }

  // Private helper methods

  private async generateSingleTrendAnalysis(
    metric: string,
    period: DateRange,
    granularity: 'daily' | 'weekly' | 'monthly'
  ): Promise<TrendAnalysis> {
    const dataPoints = await this.getMetricDataPoints(metric, period, granularity);
    const trend = this.calculateTrend(dataPoints);
    const seasonality = this.detectSeasonality(dataPoints, granularity);
    const forecast = dataPoints.length >= 7 ? this.generateForecast(dataPoints, 7) : undefined;

    return {
      metric,
      period,
      dataPoints,
      trend: trend.direction,
      trendPercentage: trend.percentage,
      seasonality,
      forecast
    };
  }

  private async getMetricDataPoints(
    metric: string,
    period: DateRange,
    granularity: 'daily' | 'weekly' | 'monthly'
  ) {
    const { startDate, endDate } = period;
    
    let query: string;
    switch (metric) {
      case 'ticket_volume':
        query = `
          SELECT 
            DATE_TRUNC($3, created_at) as date,
            COUNT(*) as value
          FROM ticket_analytics
          WHERE created_at >= $1 AND created_at <= $2
          GROUP BY DATE_TRUNC($3, created_at)
          ORDER BY date
        `;
        break;
      
      case 'response_time':
        query = `
          SELECT 
            DATE_TRUNC($3, created_at) as date,
            AVG(response_time_minutes) as value
          FROM ticket_analytics
          WHERE created_at >= $1 AND created_at <= $2
            AND response_time_minutes IS NOT NULL
          GROUP BY DATE_TRUNC($3, created_at)
          ORDER BY date
        `;
        break;
      
      case 'resolution_time':
        query = `
          SELECT 
            DATE_TRUNC($3, created_at) as date,
            AVG(resolution_time_minutes) as value
          FROM ticket_analytics
          WHERE created_at >= $1 AND created_at <= $2
            AND resolution_time_minutes IS NOT NULL
            AND status = 'resolved'
          GROUP BY DATE_TRUNC($3, created_at)
          ORDER BY date
        `;
        break;
      
      case 'sla_compliance':
        query = `
          SELECT 
            DATE_TRUNC($3, sc.created_at) as date,
            AVG(CASE WHEN sc.resolution_sla_met THEN 100 ELSE 0 END) as value
          FROM sla_compliance sc
          WHERE sc.created_at >= $1 AND sc.created_at <= $2
          GROUP BY DATE_TRUNC($3, sc.created_at)
          ORDER BY date
        `;
        break;
      
      default:
        throw new Error(`Unsupported metric: ${metric}`);
    }

    const results = await postgresClient.queryRows(query, [startDate, endDate, granularity]);
    
    return results.map(row => ({
      date: new Date(row.date),
      value: parseFloat(row.value || '0')
    }));
  }

  private calculateTrend(dataPoints: any[]) {
    if (dataPoints.length < 2) {
      return { direction: 'stable' as const, percentage: 0 };
    }

    // Linear regression for trend calculation
    const n = dataPoints.length;
    const xValues = dataPoints.map((_, index) => index);
    const yValues = dataPoints.map(point => point.value);

    const sumX = xValues.reduce((sum, x) => sum + x, 0);
    const sumY = yValues.reduce((sum, y) => sum + y, 0);
    const sumXY = xValues.reduce((sum, x, i) => sum + x * yValues[i], 0);
    const sumXX = xValues.reduce((sum, x) => sum + x * x, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    
    const firstValue = yValues[0];
    const lastValue = yValues[yValues.length - 1];
    const percentageChange = firstValue !== 0 ? ((lastValue - firstValue) / firstValue) * 100 : 0;

    let direction: 'increasing' | 'decreasing' | 'stable';
    const threshold = 0.05;

    if (Math.abs(percentageChange) < threshold) {
      direction = 'stable';
    } else if (slope > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    return {
      direction,
      percentage: Math.abs(percentageChange)
    };
  }

  private detectSeasonality(dataPoints: any[], granularity: string) {
    if (dataPoints.length < 14) {
      return undefined;
    }

    const values = dataPoints.map(point => point.value);
    
    let cycleLength: number;
    let pattern: 'daily' | 'weekly' | 'monthly';

    switch (granularity) {
      case 'daily':
        pattern = 'weekly';
        cycleLength = 7;
        break;
      case 'weekly':
        pattern = 'monthly';
        cycleLength = 4;
        break;
      case 'monthly':
        pattern = 'monthly';
        cycleLength = 12;
        break;
      default:
        return undefined;
    }

    if (values.length < cycleLength * 2) {
      return undefined;
    }

    const autocorrelation = this.calculateAutocorrelation(values, cycleLength);
    
    if (autocorrelation > 0.3) {
      return {
        pattern,
        strength: Math.min(autocorrelation, 1)
      };
    }

    return undefined;
  }

  private generateForecast(dataPoints: any[], periods: number) {
    if (dataPoints.length < 3) {
      return [];
    }

    const values = dataPoints.map(point => point.value);
    const dates = dataPoints.map(point => point.date);
    
    // Exponential smoothing
    const alpha = 0.3;
    let smoothedValues = [values[0]];
    
    for (let i = 1; i < values.length; i++) {
      const smoothed = alpha * values[i] + (1 - alpha) * smoothedValues[i - 1];
      smoothedValues.push(smoothed);
    }

    const forecast = [];
    const lastDate = dates[dates.length - 1];
    const lastSmoothed = smoothedValues[smoothedValues.length - 1];
    
    const recentValues = smoothedValues.slice(-Math.min(5, smoothedValues.length));
    const trend = recentValues.length > 1 ? 
      (recentValues[recentValues.length - 1] - recentValues[0]) / (recentValues.length - 1) : 0;

    for (let i = 1; i <= periods; i++) {
      const forecastDate = new Date(lastDate.getTime() + i * 24 * 60 * 60 * 1000);
      const forecastValue = lastSmoothed + trend * i;
      
      const variance = this.calculateVariance(values);
      const confidence = Math.max(0.5, 1 - (i * 0.1) - (variance / 100));
      
      forecast.push({
        date: forecastDate,
        predictedValue: Math.max(0, forecastValue),
        confidence: Math.min(confidence, 1)
      });
    }

    return forecast;
  }

  private calculateMetricCorrelations(trends: TrendAnalysis[]) {
    const correlations = [];

    for (let i = 0; i < trends.length; i++) {
      for (let j = i + 1; j < trends.length; j++) {
        const trend1 = trends[i];
        const trend2 = trends[j];

        // Align data points by date
        const alignedData = this.alignDataPoints(trend1.dataPoints, trend2.dataPoints);
        
        if (alignedData.length > 3) {
          const correlation = this.calculateCorrelation(
            alignedData.map(d => d.value1),
            alignedData.map(d => d.value2)
          );

          let significance: 'low' | 'medium' | 'high';
          if (Math.abs(correlation) > 0.7) {
            significance = 'high';
          } else if (Math.abs(correlation) > 0.4) {
            significance = 'medium';
          } else {
            significance = 'low';
          }

          correlations.push({
            metric1: trend1.metric,
            metric2: trend2.metric,
            correlation,
            significance
          });
        }
      }
    }

    return correlations;
  }

  private generateActionableInsights(trends: TrendAnalysis[], correlations: any[]): string[] {
    const insights: string[] = [];

    // Analyze individual trends
    trends.forEach(trend => {
      if (trend.trend === 'increasing' && trend.trendPercentage > 20) {
        if (trend.metric === 'ticket_volume') {
          insights.push(`Ticket volume is increasing by ${trend.trendPercentage.toFixed(1)}% - consider capacity planning`);
        } else if (trend.metric === 'response_time') {
          insights.push(`Response time is deteriorating by ${trend.trendPercentage.toFixed(1)}% - investigate resource constraints`);
        }
      } else if (trend.trend === 'decreasing' && trend.trendPercentage > 15) {
        if (trend.metric === 'sla_compliance') {
          insights.push(`SLA compliance is declining by ${trend.trendPercentage.toFixed(1)}% - immediate action required`);
        }
      }

      if (trend.seasonality && trend.seasonality.strength > 0.5) {
        insights.push(`${trend.metric} shows strong ${trend.seasonality.pattern} seasonality - plan resources accordingly`);
      }
    });

    // Analyze correlations
    correlations.forEach(corr => {
      if (corr.significance === 'high') {
        if (corr.correlation > 0.7) {
          insights.push(`Strong positive correlation between ${corr.metric1} and ${corr.metric2} - improvements in one may benefit the other`);
        } else if (corr.correlation < -0.7) {
          insights.push(`Strong negative correlation between ${corr.metric1} and ${corr.metric2} - trade-offs may exist`);
        }
      }
    });

    return insights;
  }

  // Additional helper methods
  private calculateAutocorrelation(values: number[], lag: number): number {
    if (values.length < lag * 2) return 0;

    const n = values.length - lag;
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    
    let numerator = 0;
    let denominator = 0;

    for (let i = 0; i < n; i++) {
      numerator += (values[i] - mean) * (values[i + lag] - mean);
    }

    for (let i = 0; i < values.length; i++) {
      denominator += Math.pow(values[i] - mean, 2);
    }

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    
    return squaredDiffs.reduce((sum, diff) => sum + diff, 0) / values.length;
  }

  private alignDataPoints(dataPoints1: any[], dataPoints2: any[]) {
    const aligned = [];
    
    for (const point1 of dataPoints1) {
      const matchingPoint = dataPoints2.find(point2 => 
        point2.date.getTime() === point1.date.getTime()
      );
      
      if (matchingPoint) {
        aligned.push({
          date: point1.date,
          value1: point1.value,
          value2: matchingPoint.value
        });
      }
    }
    
    return aligned;
  }

  private calculateCorrelation(values1: number[], values2: number[]): number {
    if (values1.length !== values2.length || values1.length === 0) return 0;

    const n = values1.length;
    const mean1 = values1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = values2.reduce((sum, val) => sum + val, 0) / n;

    let numerator = 0;
    let sum1Sq = 0;
    let sum2Sq = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = values1[i] - mean1;
      const diff2 = values2[i] - mean2;
      
      numerator += diff1 * diff2;
      sum1Sq += diff1 * diff1;
      sum2Sq += diff2 * diff2;
    }

    const denominator = Math.sqrt(sum1Sq * sum2Sq);
    return denominator === 0 ? 0 : numerator / denominator;
  }

  // Placeholder methods for advanced bottleneck detection
  private async detectTechnicianBottlenecks(period: DateRange): Promise<BottleneckAnalysis[]> {
    // Implementation would be similar to AnalyticsService but more advanced
    return [];
  }

  private async detectCategoryBottlenecks(period: DateRange): Promise<BottleneckAnalysis[]> {
    return [];
  }

  private async detectCustomerBottlenecks(period: DateRange): Promise<BottleneckAnalysis[]> {
    return [];
  }

  private async detectProcessBottlenecks(period: DateRange): Promise<BottleneckAnalysis[]> {
    return [];
  }

  private async detectTimeBasedBottlenecks(period: DateRange): Promise<BottleneckAnalysis[]> {
    // Detect bottlenecks based on time patterns (e.g., certain hours, days of week)
    return [];
  }

  private calculateOverallRiskScore(bottlenecks: BottleneckAnalysis[]): number {
    if (bottlenecks.length === 0) return 0;

    const impactWeights = { low: 1, medium: 2, high: 3, critical: 4 };
    const totalWeight = bottlenecks.reduce((sum, b) => sum + impactWeights[b.impact], 0);
    const maxPossibleWeight = bottlenecks.length * 4;

    return (totalWeight / maxPossibleWeight) * 100;
  }

  private generatePrioritizedActions(bottlenecks: BottleneckAnalysis[]): Array<{
    action: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    estimatedImpact: number;
    timeToImplement: string;
  }> {
    const actions: Array<{
      action: string;
      priority: 'critical' | 'high' | 'medium' | 'low';
      estimatedImpact: number;
      timeToImplement: string;
    }> = [];
    
    bottlenecks.forEach(bottleneck => {
      bottleneck.recommendations.forEach(recommendation => {
        actions.push({
          action: recommendation,
          priority: bottleneck.impact,
          estimatedImpact: bottleneck.metrics.affectedTickets,
          timeToImplement: this.estimateImplementationTime(recommendation)
        });
      });
    });

    // Sort by priority and impact
    return actions.sort((a, b) => {
      const priorityOrder: Record<'critical' | 'high' | 'medium' | 'low', number> = { 
        critical: 4, high: 3, medium: 2, low: 1 
      };
      const priorityDiff = priorityOrder[b.priority] - priorityOrder[a.priority];
      
      if (priorityDiff !== 0) return priorityDiff;
      return b.estimatedImpact - a.estimatedImpact;
    });
  }

  private estimateImplementationTime(action: string): string {
    // Simple heuristic based on action type
    if (action.includes('hire') || action.includes('training')) {
      return '2-4 weeks';
    } else if (action.includes('process') || action.includes('implement')) {
      return '1-2 weeks';
    } else if (action.includes('review') || action.includes('analyze')) {
      return '3-5 days';
    } else {
      return '1 week';
    }
  }

  // Placeholder methods for capacity prediction scenarios
  private async generateBasePrediction(futurePeriod: DateRange): Promise<CapacityPrediction> {
    // This would use the existing capacity prediction logic
    return {
      period: futurePeriod,
      predictedTicketVolume: 100,
      requiredTechnicianHours: 800,
      availableTechnicianHours: 1000,
      capacityUtilization: 80,
      staffingGap: -200,
      recommendedActions: [],
      risks: [],
      confidence: 0.8,
      generatedAt: new Date()
    };
  }

  private async generateScenarioPredictions(futurePeriod: DateRange, basePrediction: CapacityPrediction) {
    return [
      {
        name: 'Optimistic',
        description: 'Lower than expected ticket volume',
        prediction: { ...basePrediction, predictedTicketVolume: basePrediction.predictedTicketVolume * 0.8 },
        probability: 0.2
      },
      {
        name: 'Pessimistic',
        description: 'Higher than expected ticket volume',
        prediction: { ...basePrediction, predictedTicketVolume: basePrediction.predictedTicketVolume * 1.3 },
        probability: 0.3
      }
    ];
  }

  private generateScenarioRecommendations(scenarios: any[]) {
    return scenarios.map(scenario => ({
      scenario: scenario.name,
      actions: [`Prepare for ${scenario.description.toLowerCase()}`],
      timeline: 'Next 2 weeks'
    }));
  }
}

// Export singleton instance
export const trendAnalysisService = new TrendAnalysisService();