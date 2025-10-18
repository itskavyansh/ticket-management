import { 
  PerformanceMetrics, 
  DateRange, 
  TicketStatus, 
  TicketCategory,
  Priority 
} from '../types';
import { 
  TeamPerformanceMetrics, 
  TrendAnalysis, 
  BottleneckAnalysis,
  DashboardMetrics 
} from '../models/Analytics';
import { TimeTrackingSummary } from '../models/TimeTracking';
import { TimeTrackingService } from './TimeTrackingService';
import { TicketService } from './TicketService';
import { logger } from '../utils/logger';

export interface ProductivityInsight {
  id: string;
  type: 'performance' | 'trend' | 'bottleneck' | 'recommendation';
  title: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  metrics: Record<string, number>;
  recommendations: string[];
  generatedAt: Date;
}

export interface ThroughputMetrics {
  technicianId: string;
  period: DateRange;
  ticketsCompleted: number;
  ticketsPerDay: number;
  ticketsPerHour: number;
  averageTicketsPerWeek: number;
  peakProductivityHours: string[];
  productivityTrend: 'increasing' | 'decreasing' | 'stable';
}

export interface ResolutionTimeAnalysis {
  technicianId: string;
  period: DateRange;
  averageResolutionTime: number; // in minutes
  medianResolutionTime: number;
  resolutionTimeByCategory: Record<TicketCategory, number>;
  resolutionTimeByPriority: Record<Priority, number>;
  improvementOpportunities: string[];
  benchmarkComparison: {
    teamAverage: number;
    industryBenchmark: number;
    performanceRating: 'excellent' | 'good' | 'average' | 'needs_improvement';
  };
}

export interface TeamProductivityReport {
  teamId?: string;
  period: DateRange;
  overallMetrics: {
    totalTicketsResolved: number;
    averageResolutionTime: number;
    teamUtilization: number;
    slaComplianceRate: number;
    customerSatisfactionScore: number;
  };
  individualPerformance: PerformanceMetrics[];
  productivityTrends: TrendAnalysis[];
  bottlenecks: BottleneckAnalysis[];
  insights: ProductivityInsight[];
  recommendations: {
    priority: 'high' | 'medium' | 'low';
    category: 'training' | 'process' | 'workload' | 'tools';
    description: string;
    expectedImpact: string;
  }[];
}

export class ProductivityInsightsService {
  constructor(
    private timeTrackingService: TimeTrackingService,
    private ticketService: TicketService
  ) {}

  /**
   * Calculate comprehensive throughput metrics for a technician
   */
  public async calculateThroughputMetrics(
    technicianId: string, 
    period: DateRange
  ): Promise<ThroughputMetrics> {
    try {
      // Get completed tickets for the period
      const searchResult = await this.ticketService.searchTickets({
        filters: {
          assignedTechnicianId: technicianId,
          status: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
          createdAfter: period.startDate,
          createdBefore: period.endDate
        },
        limit: 1000 // Get all tickets for the period
      });
      
      const tickets = searchResult.tickets;

      const ticketsCompleted = tickets.length;
      const periodDays = Math.ceil(
        (period.endDate.getTime() - period.startDate.getTime()) / (1000 * 60 * 60 * 24)
      );
      
      const ticketsPerDay = ticketsCompleted / periodDays;
      
      // Get time tracking data to calculate hourly throughput
      const timeTrackingSummary = await this.timeTrackingService.getTimeTrackingSummary(
        technicianId, 
        period
      );
      
      const totalHoursWorked = timeTrackingSummary.activeTime / 60; // convert minutes to hours
      const ticketsPerHour = totalHoursWorked > 0 ? ticketsCompleted / totalHoursWorked : 0;
      
      const averageTicketsPerWeek = ticketsPerDay * 7;

      // Analyze peak productivity hours
      const peakProductivityHours = await this.calculatePeakProductivityHours(
        technicianId, 
        period
      );

      // Calculate productivity trend
      const productivityTrend = await this.calculateProductivityTrend(
        technicianId, 
        period
      );

      return {
        technicianId,
        period,
        ticketsCompleted,
        ticketsPerDay,
        ticketsPerHour,
        averageTicketsPerWeek,
        peakProductivityHours,
        productivityTrend
      };
    } catch (error) {
      logger.error('Error calculating throughput metrics:', error);
      throw error;
    }
  }

  /**
   * Analyze resolution time patterns and performance
   */
  public async analyzeResolutionTimes(
    technicianId: string, 
    period: DateRange
  ): Promise<ResolutionTimeAnalysis> {
    try {
      // Get resolved tickets with resolution times
      const searchResult = await this.ticketService.searchTickets({
        filters: {
          assignedTechnicianId: technicianId,
          status: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
          createdAfter: period.startDate,
          createdBefore: period.endDate
        },
        limit: 1000 // Get all tickets for the period
      });
      
      const tickets = searchResult.tickets;

      if (tickets.length === 0) {
        throw new Error('No resolved tickets found for the specified period');
      }

      // Calculate basic resolution time metrics
      const resolutionTimes = tickets
        .filter(ticket => ticket.actualResolutionTime)
        .map(ticket => ticket.actualResolutionTime!);

      const averageResolutionTime = resolutionTimes.reduce((sum, time) => sum + time, 0) / resolutionTimes.length;
      
      // Calculate median
      const sortedTimes = [...resolutionTimes].sort((a, b) => a - b);
      const medianResolutionTime = sortedTimes.length % 2 === 0
        ? (sortedTimes[sortedTimes.length / 2 - 1] + sortedTimes[sortedTimes.length / 2]) / 2
        : sortedTimes[Math.floor(sortedTimes.length / 2)];

      // Analyze by category
      const resolutionTimeByCategory = await this.calculateResolutionTimeByCategory(tickets);
      
      // Analyze by priority
      const resolutionTimeByPriority = await this.calculateResolutionTimeByPriority(tickets);

      // Generate improvement opportunities
      const improvementOpportunities = await this.generateImprovementOpportunities(
        technicianId,
        resolutionTimeByCategory,
        resolutionTimeByPriority
      );

      // Get benchmark comparison
      const benchmarkComparison = await this.getBenchmarkComparison(
        technicianId,
        averageResolutionTime
      );

      return {
        technicianId,
        period,
        averageResolutionTime,
        medianResolutionTime,
        resolutionTimeByCategory,
        resolutionTimeByPriority,
        improvementOpportunities,
        benchmarkComparison
      };
    } catch (error) {
      logger.error('Error analyzing resolution times:', error);
      throw error;
    }
  }

  /**
   * Generate individual performance metrics with insights
   */
  public async generateIndividualPerformanceMetrics(
    technicianId: string, 
    period: DateRange
  ): Promise<PerformanceMetrics & { insights: ProductivityInsight[] }> {
    try {
      // Get basic performance metrics
      const throughputMetrics = await this.calculateThroughputMetrics(technicianId, period);
      const resolutionAnalysis = await this.analyzeResolutionTimes(technicianId, period);
      const timeTrackingSummary = await this.timeTrackingService.getTimeTrackingSummary(
        technicianId, 
        period
      );

      // Calculate SLA compliance rate
      const slaComplianceRate = await this.calculateSLAComplianceRate(technicianId, period);
      
      // Calculate customer satisfaction score (placeholder - would integrate with feedback system)
      const customerSatisfactionScore = await this.calculateCustomerSatisfactionScore(
        technicianId, 
        period
      );

      // Calculate first call resolution rate
      const firstCallResolutionRate = await this.calculateFirstCallResolutionRate(
        technicianId, 
        period
      );

      const performanceMetrics: PerformanceMetrics = {
        technicianId,
        period,
        ticketsResolved: throughputMetrics.ticketsCompleted,
        averageResolutionTime: resolutionAnalysis.averageResolutionTime,
        slaComplianceRate,
        customerSatisfactionScore,
        utilizationRate: timeTrackingSummary.utilizationRate,
        firstCallResolutionRate
      };

      // Generate insights based on performance data
      const insights = await this.generatePerformanceInsights(
        performanceMetrics,
        throughputMetrics,
        resolutionAnalysis
      );

      return {
        ...performanceMetrics,
        insights
      };
    } catch (error) {
      logger.error('Error generating individual performance metrics:', error);
      throw error;
    }
  }

  /**
   * Generate team performance report with comprehensive analysis
   */
  public async generateTeamProductivityReport(
    technicianIds: string[],
    period: DateRange,
    teamId?: string
  ): Promise<TeamProductivityReport> {
    try {
      // Generate individual performance metrics for all team members
      const individualPerformance: PerformanceMetrics[] = [];
      const allInsights: ProductivityInsight[] = [];

      for (const technicianId of technicianIds) {
        try {
          const metrics = await this.generateIndividualPerformanceMetrics(technicianId, period);
          individualPerformance.push(metrics);
          allInsights.push(...metrics.insights);
        } catch (error) {
          logger.warn(`Failed to generate metrics for technician ${technicianId}:`, error);
        }
      }

      // Calculate overall team metrics
      const overallMetrics = this.calculateTeamOverallMetrics(individualPerformance);

      // Generate productivity trends
      const productivityTrends = await this.generateProductivityTrends(
        technicianIds, 
        period
      );

      // Identify bottlenecks
      const bottlenecks = await this.identifyTeamBottlenecks(
        individualPerformance,
        productivityTrends
      );

      // Generate team-level insights
      const teamInsights = await this.generateTeamInsights(
        individualPerformance,
        overallMetrics,
        bottlenecks
      );

      // Generate recommendations
      const recommendations = await this.generateTeamRecommendations(
        individualPerformance,
        bottlenecks,
        teamInsights
      );

      return {
        teamId,
        period,
        overallMetrics,
        individualPerformance,
        productivityTrends,
        bottlenecks,
        insights: [...allInsights, ...teamInsights],
        recommendations
      };
    } catch (error) {
      logger.error('Error generating team productivity report:', error);
      throw error;
    }
  }

  /**
   * Generate productivity trend analysis
   */
  public async generateProductivityTrends(
    technicianIds: string[],
    period: DateRange
  ): Promise<TrendAnalysis[]> {
    try {
      const trends: TrendAnalysis[] = [];

      // Generate trends for key metrics
      const metrics = [
        'ticketsResolved',
        'averageResolutionTime',
        'utilizationRate',
        'slaComplianceRate'
      ];

      for (const metric of metrics) {
        const trendData = await this.calculateMetricTrend(
          technicianIds,
          metric,
          period
        );
        trends.push(trendData);
      }

      return trends;
    } catch (error) {
      logger.error('Error generating productivity trends:', error);
      throw error;
    }
  }

  // Private helper methods

  private async calculatePeakProductivityHours(
    technicianId: string,
    period: DateRange
  ): Promise<string[]> {
    // Analyze time tracking data to find hours with highest ticket completion rates
    // This is a simplified implementation - would analyze hourly patterns
    return ['09:00-10:00', '14:00-15:00', '16:00-17:00'];
  }

  private async calculateProductivityTrend(
    technicianId: string,
    period: DateRange
  ): Promise<'increasing' | 'decreasing' | 'stable'> {
    // Compare current period with previous period
    // This is a simplified implementation
    return 'stable';
  }

  private async calculateResolutionTimeByCategory(
    tickets: any[]
  ): Promise<Record<TicketCategory, number>> {
    const categoryTimes: Record<TicketCategory, number[]> = {
      [TicketCategory.HARDWARE]: [],
      [TicketCategory.SOFTWARE]: [],
      [TicketCategory.NETWORK]: [],
      [TicketCategory.SECURITY]: [],
      [TicketCategory.GENERAL]: []
    };

    tickets.forEach(ticket => {
      if (ticket.actualResolutionTime && ticket.category && ticket.category in categoryTimes) {
        categoryTimes[ticket.category as TicketCategory].push(ticket.actualResolutionTime);
      }
    });

    const result: Record<TicketCategory, number> = {} as Record<TicketCategory, number>;
    
    Object.entries(categoryTimes).forEach(([category, times]) => {
      result[category as TicketCategory] = times.length > 0
        ? times.reduce((sum, time) => sum + time, 0) / times.length
        : 0;
    });

    return result;
  }

  private async calculateResolutionTimeByPriority(
    tickets: any[]
  ): Promise<Record<Priority, number>> {
    const priorityTimes: Record<Priority, number[]> = {
      [Priority.CRITICAL]: [],
      [Priority.HIGH]: [],
      [Priority.MEDIUM]: [],
      [Priority.LOW]: []
    };

    tickets.forEach(ticket => {
      if (ticket.actualResolutionTime && ticket.priority && ticket.priority in priorityTimes) {
        priorityTimes[ticket.priority as Priority].push(ticket.actualResolutionTime);
      }
    });

    const result: Record<Priority, number> = {} as Record<Priority, number>;
    
    Object.entries(priorityTimes).forEach(([priority, times]) => {
      result[priority as Priority] = times.length > 0
        ? times.reduce((sum, time) => sum + time, 0) / times.length
        : 0;
    });

    return result;
  }

  private async generateImprovementOpportunities(
    technicianId: string,
    categoryTimes: Record<TicketCategory, number>,
    priorityTimes: Record<Priority, number>
  ): Promise<string[]> {
    const opportunities: string[] = [];

    // Analyze category performance
    const slowestCategory = Object.entries(categoryTimes)
      .sort(([,a], [,b]) => b - a)[0];
    
    if (slowestCategory && slowestCategory[1] > 0) {
      opportunities.push(
        `Focus on improving ${slowestCategory[0]} ticket resolution times (currently ${Math.round(slowestCategory[1])} minutes average)`
      );
    }

    // Analyze priority performance
    const criticalTime = priorityTimes[Priority.CRITICAL];
    const highTime = priorityTimes[Priority.HIGH];
    
    if (criticalTime > highTime && criticalTime > 0) {
      opportunities.push(
        'Critical tickets are taking longer than high priority tickets - review escalation procedures'
      );
    }

    return opportunities;
  }

  private async getBenchmarkComparison(
    technicianId: string,
    averageResolutionTime: number
  ): Promise<ResolutionTimeAnalysis['benchmarkComparison']> {
    // This would typically compare against team and industry benchmarks
    // Simplified implementation
    const teamAverage = 120; // minutes
    const industryBenchmark = 90; // minutes

    let performanceRating: 'excellent' | 'good' | 'average' | 'needs_improvement';
    
    if (averageResolutionTime <= industryBenchmark) {
      performanceRating = 'excellent';
    } else if (averageResolutionTime <= teamAverage) {
      performanceRating = 'good';
    } else if (averageResolutionTime <= teamAverage * 1.2) {
      performanceRating = 'average';
    } else {
      performanceRating = 'needs_improvement';
    }

    return {
      teamAverage,
      industryBenchmark,
      performanceRating
    };
  }

  private async calculateSLAComplianceRate(
    technicianId: string,
    period: DateRange
  ): Promise<number> {
    // Get tickets and calculate SLA compliance
    // This is a simplified implementation
    return 85.5; // percentage
  }

  private async calculateCustomerSatisfactionScore(
    technicianId: string,
    period: DateRange
  ): Promise<number> {
    // This would integrate with customer feedback system
    // Simplified implementation
    return 4.2; // 1-5 scale
  }

  private async calculateFirstCallResolutionRate(
    technicianId: string,
    period: DateRange
  ): Promise<number> {
    // Calculate percentage of tickets resolved on first contact
    // This is a simplified implementation
    return 72.3; // percentage
  }

  private async generatePerformanceInsights(
    metrics: PerformanceMetrics,
    throughput: ThroughputMetrics,
    resolution: ResolutionTimeAnalysis
  ): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = [];

    // Throughput insight
    if (throughput.ticketsPerDay > 8) {
      insights.push({
        id: `throughput-${metrics.technicianId}-${Date.now()}`,
        type: 'performance',
        title: 'High Throughput Performance',
        description: `Excellent ticket throughput of ${throughput.ticketsPerDay.toFixed(1)} tickets per day`,
        impact: 'high',
        metrics: { ticketsPerDay: throughput.ticketsPerDay },
        recommendations: ['Consider mentoring other team members', 'Take on more complex tickets'],
        generatedAt: new Date()
      });
    }

    // Resolution time insight
    if (resolution.benchmarkComparison.performanceRating === 'needs_improvement') {
      insights.push({
        id: `resolution-${metrics.technicianId}-${Date.now()}`,
        type: 'recommendation',
        title: 'Resolution Time Improvement Needed',
        description: `Average resolution time of ${Math.round(resolution.averageResolutionTime)} minutes exceeds benchmarks`,
        impact: 'medium',
        metrics: { averageResolutionTime: resolution.averageResolutionTime },
        recommendations: resolution.improvementOpportunities,
        generatedAt: new Date()
      });
    }

    // Utilization insight
    if (metrics.utilizationRate < 70) {
      insights.push({
        id: `utilization-${metrics.technicianId}-${Date.now()}`,
        type: 'recommendation',
        title: 'Low Utilization Rate',
        description: `Utilization rate of ${metrics.utilizationRate.toFixed(1)}% is below optimal range`,
        impact: 'medium',
        metrics: { utilizationRate: metrics.utilizationRate },
        recommendations: [
          'Review workload distribution',
          'Consider additional training opportunities',
          'Analyze idle time patterns'
        ],
        generatedAt: new Date()
      });
    }

    return insights;
  }

  private calculateTeamOverallMetrics(
    individualMetrics: PerformanceMetrics[]
  ): TeamProductivityReport['overallMetrics'] {
    if (individualMetrics.length === 0) {
      return {
        totalTicketsResolved: 0,
        averageResolutionTime: 0,
        teamUtilization: 0,
        slaComplianceRate: 0,
        customerSatisfactionScore: 0
      };
    }

    return {
      totalTicketsResolved: individualMetrics.reduce((sum, m) => sum + m.ticketsResolved, 0),
      averageResolutionTime: individualMetrics.reduce((sum, m) => sum + m.averageResolutionTime, 0) / individualMetrics.length,
      teamUtilization: individualMetrics.reduce((sum, m) => sum + m.utilizationRate, 0) / individualMetrics.length,
      slaComplianceRate: individualMetrics.reduce((sum, m) => sum + m.slaComplianceRate, 0) / individualMetrics.length,
      customerSatisfactionScore: individualMetrics.reduce((sum, m) => sum + m.customerSatisfactionScore, 0) / individualMetrics.length
    };
  }

  private async identifyTeamBottlenecks(
    individualMetrics: PerformanceMetrics[],
    trends: TrendAnalysis[]
  ): Promise<BottleneckAnalysis[]> {
    const bottlenecks: BottleneckAnalysis[] = [];

    // Identify performance outliers
    const avgResolutionTime = individualMetrics.reduce((sum, m) => sum + m.averageResolutionTime, 0) / individualMetrics.length;
    
    individualMetrics.forEach(metrics => {
      if (metrics.averageResolutionTime > avgResolutionTime * 1.5) {
        bottlenecks.push({
          type: 'technician',
          identifier: metrics.technicianId,
          description: `Technician has resolution time 50% above team average`,
          impact: 'high',
          metrics: {
            affectedTickets: metrics.ticketsResolved,
            delayImpact: metrics.averageResolutionTime - avgResolutionTime,
            slaRisk: 100 - metrics.slaComplianceRate
          },
          recommendations: [
            'Provide additional training',
            'Review workload complexity',
            'Consider peer mentoring'
          ],
          detectedAt: new Date()
        });
      }
    });

    return bottlenecks;
  }

  private async generateTeamInsights(
    individualMetrics: PerformanceMetrics[],
    overallMetrics: TeamProductivityReport['overallMetrics'],
    bottlenecks: BottleneckAnalysis[]
  ): Promise<ProductivityInsight[]> {
    const insights: ProductivityInsight[] = [];

    // Team performance insight
    if (overallMetrics.slaComplianceRate > 90) {
      insights.push({
        id: `team-sla-${Date.now()}`,
        type: 'performance',
        title: 'Excellent Team SLA Performance',
        description: `Team maintains ${overallMetrics.slaComplianceRate.toFixed(1)}% SLA compliance rate`,
        impact: 'high',
        metrics: { slaComplianceRate: overallMetrics.slaComplianceRate },
        recommendations: ['Share best practices with other teams', 'Document successful processes'],
        generatedAt: new Date()
      });
    }

    // Bottleneck insight
    if (bottlenecks.length > 0) {
      insights.push({
        id: `team-bottlenecks-${Date.now()}`,
        type: 'bottleneck',
        title: 'Performance Bottlenecks Identified',
        description: `${bottlenecks.length} performance bottlenecks detected requiring attention`,
        impact: 'medium',
        metrics: { bottleneckCount: bottlenecks.length },
        recommendations: ['Address individual performance gaps', 'Review workload distribution'],
        generatedAt: new Date()
      });
    }

    return insights;
  }

  private async generateTeamRecommendations(
    individualMetrics: PerformanceMetrics[],
    bottlenecks: BottleneckAnalysis[],
    insights: ProductivityInsight[]
  ): Promise<TeamProductivityReport['recommendations']> {
    const recommendations: TeamProductivityReport['recommendations'] = [];

    // Performance-based recommendations
    const lowPerformers = individualMetrics.filter(m => m.slaComplianceRate < 80);
    if (lowPerformers.length > 0) {
      recommendations.push({
        priority: 'high',
        category: 'training',
        description: `${lowPerformers.length} team members need performance improvement support`,
        expectedImpact: 'Improve overall team SLA compliance by 10-15%'
      });
    }

    // Workload distribution recommendations
    const utilizationVariance = this.calculateUtilizationVariance(individualMetrics);
    if (utilizationVariance > 20) {
      recommendations.push({
        priority: 'medium',
        category: 'workload',
        description: 'High variance in team utilization rates detected',
        expectedImpact: 'Better workload balance could improve team efficiency by 8-12%'
      });
    }

    return recommendations;
  }

  private calculateUtilizationVariance(metrics: PerformanceMetrics[]): number {
    if (metrics.length === 0) return 0;
    
    const avgUtilization = metrics.reduce((sum, m) => sum + m.utilizationRate, 0) / metrics.length;
    const variance = metrics.reduce((sum, m) => sum + Math.pow(m.utilizationRate - avgUtilization, 2), 0) / metrics.length;
    
    return Math.sqrt(variance);
  }

  private async calculateMetricTrend(
    technicianIds: string[],
    metric: string,
    period: DateRange
  ): Promise<TrendAnalysis> {
    // This would calculate actual trends from historical data
    // Simplified implementation for now
    return {
      metric,
      period,
      dataPoints: [],
      trend: 'stable',
      trendPercentage: 0,
      generatedAt: new Date()
    } as TrendAnalysis;
  }
}