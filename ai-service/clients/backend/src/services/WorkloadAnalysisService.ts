import {
  WorkloadAnalysis,
  TechnicianCapacity,
  WorkloadPrediction,
  UtilizationMetrics,
  WorkloadAlert,
  WorkloadRecommendation,
  WorkloadAnalysisConfig,
  TeamWorkloadSummary,
  TechnicianWorkloadSummary,
  RebalancingOpportunity,
  CapacityOptimization,
  RiskLevel,
  TrendDirection,
  AlertType,
  AlertSeverity,
  RecommendationType,
  RecommendationPriority,
  ImplementationEffort,
  HistoricalPattern,
  PatternType,
  SkillCapacity
} from '../models/WorkloadAnalysis';
import { DateRange, TicketStatus } from '../types';
import { TimeTrackingService } from './TimeTrackingService';
import { TicketService } from './TicketService';
import { TechnicianRepository, WorkloadAnalysisRepository } from '../database/repositories';
import { logger } from '../utils/logger';

export class WorkloadAnalysisService {
  private timeTrackingService: TimeTrackingService;
  private ticketService: TicketService;
  private technicianRepository: TechnicianRepository;
  private workloadAnalysisRepository: WorkloadAnalysisRepository;
  private config: WorkloadAnalysisConfig;
  private activeAlerts: Map<string, WorkloadAlert[]> = new Map();

  constructor(
    timeTrackingService: TimeTrackingService,
    ticketService: TicketService
  ) {
    this.timeTrackingService = timeTrackingService;
    this.ticketService = ticketService;
    this.technicianRepository = new TechnicianRepository();
    this.workloadAnalysisRepository = new WorkloadAnalysisRepository();
    this.config = this.getDefaultConfig();
    
    // Start periodic analysis
    this.startPeriodicAnalysis();
  }

  /**
   * Analyze workload for a specific technician
   */
  public async analyzeWorkload(technicianId: string): Promise<WorkloadAnalysis> {
    try {
      logger.info(`Starting workload analysis for technician ${technicianId}`);

      // Calculate current capacity
      const currentCapacity = await this.calculateTechnicianCapacity(technicianId);
      
      // Generate workload prediction
      const workloadPrediction = await this.generateWorkloadPrediction(technicianId);
      
      // Calculate utilization metrics
      const utilizationMetrics = await this.calculateUtilizationMetrics(technicianId);
      
      // Generate alerts
      const alerts = await this.generateWorkloadAlerts(technicianId, currentCapacity, workloadPrediction);
      
      // Generate recommendations
      const recommendations = await this.generateWorkloadRecommendations(
        technicianId, 
        currentCapacity, 
        workloadPrediction, 
        alerts
      );

      const analysis: WorkloadAnalysis = {
        technicianId,
        analysisDate: new Date(),
        currentCapacity,
        workloadPrediction,
        utilizationMetrics,
        alerts,
        recommendations,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Store alerts for tracking
      this.activeAlerts.set(technicianId, alerts.filter(alert => alert.isActive));

      // Save analysis to database
      await this.saveWorkloadAnalysis(analysis);

      logger.info(`Workload analysis completed for technician ${technicianId}`);
      return analysis;
    } catch (error) {
      logger.error(`Error analyzing workload for technician ${technicianId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate technician capacity
   */
  public async calculateTechnicianCapacity(technicianId: string): Promise<TechnicianCapacity> {
    try {
      // Get technician data
      const technician = await this.getTechnicianById(technicianId);
      if (!technician) {
        throw new Error('Technician not found');
      }

      // Get current active tickets
      const activeTickets = await this.ticketService.getTicketsByTechnician(
        technicianId,
        [TicketStatus.OPEN, TicketStatus.IN_PROGRESS]
      );

      // Calculate skill-based capacities
      const skillCapacities = await this.calculateSkillCapacities(technicianId, activeTickets);

      // Get time tracking data for efficiency calculation
      const now = new Date();
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() - now.getDay());
      weekStart.setHours(0, 0, 0, 0);

      const timeStats = await this.timeTrackingService.getTimeTrackingStats(technicianId);
      
      // Calculate capacity metrics
      const maxConcurrentTickets = technician.maxCapacity;
      const currentActiveTickets = activeTickets.length;
      const availableCapacity = Math.max(0, maxConcurrentTickets - currentActiveTickets);
      const utilizationPercentage = maxConcurrentTickets > 0 ? 
        (currentActiveTickets / maxConcurrentTickets) * 100 : 0;

      // Calculate time-based capacity
      const dailyHours = 8; // Standard work day
      const weeklyHours = 40; // Standard work week
      const availableHoursToday = this.calculateAvailableHoursToday(technician);
      const availableHoursThisWeek = this.calculateAvailableHoursThisWeek(technician);

      // Calculate efficiency metrics
      const averageResolutionTime = await this.calculateAverageResolutionTime(technicianId);
      const ticketThroughput = await this.calculateTicketThroughput(technicianId);
      const efficiencyScore = this.calculateEfficiencyScore(
        timeStats.productivityScore,
        averageResolutionTime,
        ticketThroughput
      );

      return {
        technicianId,
        maxConcurrentTickets,
        currentActiveTickets,
        availableCapacity,
        utilizationPercentage,
        skillCapacities,
        dailyHours,
        weeklyHours,
        availableHoursToday,
        availableHoursThisWeek,
        averageResolutionTime,
        ticketThroughput,
        efficiencyScore,
        lastUpdated: new Date()
      };
    } catch (error) {
      logger.error(`Error calculating capacity for technician ${technicianId}:`, error);
      throw error;
    }
  }

  /**
   * Generate workload prediction using historical patterns
   */
  public async generateWorkloadPrediction(technicianId: string): Promise<WorkloadPrediction> {
    try {
      const predictionPeriod: DateRange = {
        startDate: new Date(),
        endDate: new Date(Date.now() + this.config.predictionHorizon * 24 * 60 * 60 * 1000)
      };

      // Get historical data
      const historicalData = await this.getHistoricalWorkloadData(
        technicianId, 
        this.config.historicalDataPeriod
      );

      // Identify patterns
      const historicalPatterns = this.identifyHistoricalPatterns(historicalData);

      // Predict workload based on patterns
      const predictedTicketCount = this.predictTicketCount(historicalData, historicalPatterns);
      const predictedWorkHours = this.predictWorkHours(historicalData, historicalPatterns);
      const predictedUtilization = this.predictUtilization(predictedTicketCount, predictedWorkHours);

      // Assess risks
      const overutilizationRisk = this.assessOverutilizationRisk(predictedUtilization);
      const burnoutRisk = this.assessBurnoutRisk(technicianId, predictedUtilization);
      const slaRisk = this.assessSLARisk(technicianId, predictedTicketCount);

      // Analyze trends
      const workloadTrend = this.analyzeTrend(historicalData.map(d => d.ticketCount));
      const capacityTrend = this.analyzeTrend(historicalData.map(d => d.utilization));

      // Calculate confidence
      const predictionConfidence = this.calculatePredictionConfidence(historicalData);
      const dataQuality = this.assessDataQuality(historicalData);

      return {
        technicianId,
        predictionPeriod,
        predictedTicketCount,
        predictedWorkHours,
        predictedUtilization,
        overutilizationRisk,
        burnoutRisk,
        slaRisk,
        workloadTrend,
        capacityTrend,
        predictionConfidence,
        dataQuality,
        historicalPatterns,
        createdAt: new Date()
      };
    } catch (error) {
      logger.error(`Error generating workload prediction for technician ${technicianId}:`, error);
      throw error;
    }
  }

  /**
   * Calculate utilization metrics
   */
  public async calculateUtilizationMetrics(technicianId: string): Promise<UtilizationMetrics> {
    try {
      const period: DateRange = {
        startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // Last 30 days
        endDate: new Date()
      };

      // Get time tracking summary
      const timeSummary = await this.timeTrackingService.getTimeTrackingSummary(technicianId, period);
      
      // Get ticket data - using search with filters
      const searchResult = await this.ticketService.searchTickets({
        filters: {
          assignedTechnicianId: technicianId,
          createdAfter: period.startDate,
          createdBefore: period.endDate
        }
      });
      const tickets = searchResult.tickets;

      const completedTickets = tickets.filter(t => 
        t.status === TicketStatus.RESOLVED || t.status === TicketStatus.CLOSED
      );

      // Calculate metrics
      const totalWorkTime = timeSummary.totalTime;
      const activeWorkTime = timeSummary.activeTime;
      const idleTime = timeSummary.idleTime;
      const timeUtilization = totalWorkTime > 0 ? (activeWorkTime / totalWorkTime) * 100 : 0;

      const ticketsAssigned = tickets.length;
      const ticketsCompleted = completedTickets.length;
      const ticketsInProgress = tickets.filter(t => t.status === TicketStatus.IN_PROGRESS).length;
      const ticketUtilization = ticketsAssigned > 0 ? (ticketsCompleted / ticketsAssigned) * 100 : 0;

      // Get capacity data
      const capacity = await this.calculateTechnicianCapacity(technicianId);
      const averageCapacityUsed = capacity.utilizationPercentage;
      const peakCapacityUsed = await this.calculatePeakCapacityUsed(technicianId, period);
      const capacityVariance = await this.calculateCapacityVariance(technicianId, period);

      // Calculate efficiency metrics
      const averageTicketResolutionTime = completedTickets.length > 0 ?
        completedTickets.reduce((sum, ticket) => sum + (ticket.actualResolutionTime || 0), 0) / completedTickets.length : 0;
      
      const firstCallResolutionRate = await this.calculateFirstCallResolutionRate(technicianId, period);
      const customerSatisfactionScore = await this.calculateCustomerSatisfactionScore(technicianId, period);

      // Get comparison metrics
      const teamAverageUtilization = await this.calculateTeamAverageUtilization(technicianId);
      const industryBenchmark = 75; // Industry standard utilization
      const performanceRanking = await this.calculatePerformanceRanking(technicianId);

      return {
        technicianId,
        period,
        totalWorkTime,
        activeWorkTime,
        idleTime,
        timeUtilization,
        ticketsAssigned,
        ticketsCompleted,
        ticketsInProgress,
        ticketUtilization,
        averageCapacityUsed,
        peakCapacityUsed,
        capacityVariance,
        averageTicketResolutionTime,
        firstCallResolutionRate,
        customerSatisfactionScore,
        teamAverageUtilization,
        industryBenchmark,
        performanceRanking
      };
    } catch (error) {
      logger.error(`Error calculating utilization metrics for technician ${technicianId}:`, error);
      throw error;
    }
  }

  /**
   * Generate workload alerts
   */
  public async generateWorkloadAlerts(
    technicianId: string,
    capacity: TechnicianCapacity,
    prediction: WorkloadPrediction
  ): Promise<WorkloadAlert[]> {
    const alerts: WorkloadAlert[] = [];

    // Check overutilization
    if (capacity.utilizationPercentage > this.config.overutilizationThreshold) {
      alerts.push(this.createAlert(
        technicianId,
        AlertType.OVERUTILIZATION,
        AlertSeverity.WARNING,
        'Technician Overutilized',
        `Current utilization (${capacity.utilizationPercentage.toFixed(1)}%) exceeds threshold (${this.config.overutilizationThreshold}%)`,
        capacity.utilizationPercentage,
        this.config.overutilizationThreshold,
        'Consider redistributing tickets or adjusting capacity'
      ));
    }

    // Check burnout risk
    if (prediction.burnoutRisk === RiskLevel.HIGH || prediction.burnoutRisk === RiskLevel.CRITICAL) {
      alerts.push(this.createAlert(
        technicianId,
        AlertType.BURNOUT_RISK,
        prediction.burnoutRisk === RiskLevel.CRITICAL ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        'Burnout Risk Detected',
        `High burnout risk detected based on workload patterns`,
        prediction.predictedUtilization,
        this.config.burnoutRiskThreshold,
        'Schedule time off or reduce workload'
      ));
    }

    // Check SLA risk
    if (prediction.slaRisk === RiskLevel.HIGH || prediction.slaRisk === RiskLevel.CRITICAL) {
      alerts.push(this.createAlert(
        technicianId,
        AlertType.SLA_RISK,
        prediction.slaRisk === RiskLevel.CRITICAL ? AlertSeverity.CRITICAL : AlertSeverity.WARNING,
        'SLA Risk Detected',
        `High SLA breach risk due to predicted workload`,
        prediction.predictedTicketCount,
        capacity.maxConcurrentTickets,
        'Reassign tickets or provide additional support'
      ));
    }

    // Check capacity exceeded
    if (capacity.currentActiveTickets >= capacity.maxConcurrentTickets) {
      alerts.push(this.createAlert(
        technicianId,
        AlertType.CAPACITY_EXCEEDED,
        AlertSeverity.CRITICAL,
        'Capacity Exceeded',
        `Current ticket count (${capacity.currentActiveTickets}) meets or exceeds maximum capacity (${capacity.maxConcurrentTickets})`,
        capacity.currentActiveTickets,
        capacity.maxConcurrentTickets,
        'Immediately reassign tickets or increase capacity'
      ));
    }

    return alerts;
  }

  /**
   * Generate workload recommendations
   */
  public async generateWorkloadRecommendations(
    technicianId: string,
    capacity: TechnicianCapacity,
    prediction: WorkloadPrediction,
    alerts: WorkloadAlert[]
  ): Promise<WorkloadRecommendation[]> {
    const recommendations: WorkloadRecommendation[] = [];

    // Recommendation based on overutilization
    if (capacity.utilizationPercentage > this.config.overutilizationThreshold) {
      recommendations.push(this.createRecommendation(
        technicianId,
        RecommendationType.REDISTRIBUTE_TICKETS,
        RecommendationPriority.HIGH,
        'Redistribute Tickets',
        'Current workload exceeds optimal capacity. Consider redistributing some tickets to other team members.',
        25, // Expected 25% improvement
        ImplementationEffort.LOW,
        2, // 2 hours to implement
        [
          'Identify tickets that can be reassigned',
          'Find available team members with matching skills',
          'Reassign 2-3 tickets to reduce utilization below 80%'
        ],
        ['Manager approval', 'Available team members']
      ));
    }

    // Recommendation based on skill mismatch
    const skillMismatchCapacities = capacity.skillCapacities.filter(sc => sc.utilizationForSkill > 90);
    if (skillMismatchCapacities.length > 0) {
      recommendations.push(this.createRecommendation(
        technicianId,
        RecommendationType.SKILL_TRAINING,
        RecommendationPriority.MEDIUM,
        'Skill Development',
        'Some skill areas are overutilized. Consider cross-training to balance workload.',
        15, // Expected 15% improvement
        ImplementationEffort.MEDIUM,
        20, // 20 hours for training
        [
          'Identify skill gaps in underutilized areas',
          'Enroll in relevant training programs',
          'Practice with mentorship from experienced team members'
        ],
        ['Training budget', 'Time allocation', 'Mentor availability']
      ));
    }

    // Recommendation based on efficiency
    if (capacity.efficiencyScore < 70) {
      recommendations.push(this.createRecommendation(
        technicianId,
        RecommendationType.PROCESS_IMPROVEMENT,
        RecommendationPriority.MEDIUM,
        'Process Optimization',
        'Efficiency score is below optimal. Consider process improvements and automation.',
        20, // Expected 20% improvement
        ImplementationEffort.MEDIUM,
        10, // 10 hours to implement
        [
          'Analyze current workflow for bottlenecks',
          'Implement automation tools where possible',
          'Standardize common procedures'
        ],
        ['Process analysis tools', 'Automation software']
      ));
    }

    return recommendations;
  }

  /**
   * Analyze team workload
   */
  public async analyzeTeamWorkload(teamId: string): Promise<TeamWorkloadSummary> {
    try {
      // Get team members
      const teamMembers = await this.getTeamMembers(teamId);
      
      // Analyze each member
      const workloadSummaries: TechnicianWorkloadSummary[] = [];
      let totalCapacity = 0;
      let usedCapacity = 0;
      let overutilizedCount = 0;
      let underutilizedCount = 0;
      let atRiskCount = 0;

      for (const member of teamMembers) {
        const analysis = await this.analyzeWorkload(member.id);
        
        totalCapacity += analysis.currentCapacity.maxConcurrentTickets;
        usedCapacity += analysis.currentCapacity.currentActiveTickets;
        
        const riskLevel = this.assessTechnicianRiskLevel(analysis);
        const activeAlerts = analysis.alerts.filter(a => a.isActive).length;
        
        if (analysis.currentCapacity.utilizationPercentage > this.config.overutilizationThreshold) {
          overutilizedCount++;
        } else if (analysis.currentCapacity.utilizationPercentage < this.config.underutilizationThreshold) {
          underutilizedCount++;
        }
        
        if (riskLevel === RiskLevel.HIGH || riskLevel === RiskLevel.CRITICAL) {
          atRiskCount++;
        }

        workloadSummaries.push({
          technicianId: member.id,
          name: member.name,
          currentUtilization: analysis.currentCapacity.utilizationPercentage,
          capacity: analysis.currentCapacity.maxConcurrentTickets,
          availableCapacity: analysis.currentCapacity.availableCapacity,
          riskLevel,
          activeAlerts,
          recommendations: analysis.recommendations.length
        });
      }

      const availableCapacity = totalCapacity - usedCapacity;
      const teamUtilization = totalCapacity > 0 ? (usedCapacity / totalCapacity) * 100 : 0;

      // Calculate workload distribution metrics
      const utilizationValues = workloadSummaries.map(ws => ws.currentUtilization);
      const utilizationVariance = this.calculateVariance(utilizationValues);
      const balanceScore = Math.max(0, 100 - utilizationVariance);

      // Generate rebalancing opportunities
      const rebalancingOpportunities = await this.identifyRebalancingOpportunities(workloadSummaries);
      
      // Generate capacity optimizations
      const capacityOptimizations = await this.identifyCapacityOptimizations(workloadSummaries);

      return {
        teamId,
        analysisDate: new Date(),
        totalCapacity,
        usedCapacity,
        availableCapacity,
        teamUtilization,
        workloadDistribution: workloadSummaries,
        utilizationVariance,
        balanceScore,
        overutilizedTechnicians: overutilizedCount,
        underutilizedTechnicians: underutilizedCount,
        atRiskTechnicians: atRiskCount,
        rebalancingOpportunities,
        capacityOptimizations
      };
    } catch (error) {
      logger.error(`Error analyzing team workload for team ${teamId}:`, error);
      throw error;
    }
  }

  /**
   * Start periodic workload analysis
   */
  private startPeriodicAnalysis(): void {
    setInterval(async () => {
      try {
        await this.runPeriodicAnalysis();
      } catch (error) {
        logger.error('Error in periodic workload analysis:', error);
      }
    }, this.config.analysisInterval * 60 * 1000);

    logger.info('Periodic workload analysis started');
  }

  /**
   * Run periodic analysis for all technicians
   */
  private async runPeriodicAnalysis(): Promise<void> {
    try {
      const technicians = await this.getAllTechnicians();
      
      for (const technician of technicians) {
        await this.analyzeWorkload(technician.id);
      }
      
      logger.info(`Periodic workload analysis completed for ${technicians.length} technicians`);
    } catch (error) {
      logger.error('Error in periodic analysis:', error);
    }
  }

  // Helper methods (implementation details)
  private getDefaultConfig(): WorkloadAnalysisConfig {
    return {
      overutilizationThreshold: 85,
      underutilizationThreshold: 40,
      burnoutRiskThreshold: 90,
      predictionHorizon: 7,
      historicalDataPeriod: 30,
      minimumDataPoints: 10,
      alertCooldownPeriod: 60,
      escalationThreshold: 240,
      autoResolveThreshold: 1440,
      analysisInterval: 30,
      predictionInterval: 4,
      timeWeight: 0.3,
      qualityWeight: 0.3,
      capacityWeight: 0.2,
      satisfactionWeight: 0.2
    };
  }

  private createAlert(
    technicianId: string,
    alertType: AlertType,
    severity: AlertSeverity,
    title: string,
    description: string,
    currentValue: number,
    thresholdValue: number,
    recommendedAction: string
  ): WorkloadAlert {
    return {
      id: `${technicianId}_${alertType}_${Date.now()}`,
      technicianId,
      alertType,
      severity,
      title,
      description,
      currentValue,
      thresholdValue,
      recommendedAction,
      triggeredAt: new Date(),
      isActive: true,
      escalationLevel: 0,
      metadata: {}
    };
  }

  private createRecommendation(
    technicianId: string,
    recommendationType: RecommendationType,
    priority: RecommendationPriority,
    title: string,
    description: string,
    expectedImpact: number,
    implementationEffort: ImplementationEffort,
    timeToImplement: number,
    suggestedActions: string[],
    requiredResources: string[]
  ): WorkloadRecommendation {
    return {
      id: `${technicianId}_${recommendationType}_${Date.now()}`,
      technicianId,
      recommendationType,
      priority,
      title,
      description,
      expectedImpact,
      implementationEffort,
      timeToImplement,
      suggestedActions,
      requiredResources,
      isImplemented: false,
      createdAt: new Date()
    };
  }

  // Database operations and calculations
  private async getTechnicianById(id: string): Promise<any> {
    return await this.technicianRepository.getById(id);
  }

  private async getAllTechnicians(): Promise<any[]> {
    return await this.technicianRepository.getAll({ isActive: true });
  }

  private async getTeamMembers(teamId: string): Promise<any[]> {
    // For now, get all technicians in the same department
    // In a real implementation, you'd have team management
    return await this.technicianRepository.getByDepartment(teamId);
  }

  private async saveWorkloadAnalysis(analysis: WorkloadAnalysis): Promise<void> {
    await this.workloadAnalysisRepository.saveAnalysis(analysis);
  }

  private async calculateSkillCapacities(technicianId: string, tickets: any[]): Promise<SkillCapacity[]> {
    try {
      const technician = await this.getTechnicianById(technicianId);
      if (!technician || !technician.skills) {
        return [];
      }

      const skillCapacities: SkillCapacity[] = [];

      for (const skill of technician.skills) {
        // Count tickets that require this skill
        const skillTickets = tickets.filter(ticket => 
          ticket.category && ticket.category.toLowerCase().includes(skill.category.toLowerCase())
        );

        // Calculate capacity based on proficiency level
        const maxTicketsForSkill = Math.floor(technician.maxCapacity * (skill.proficiencyLevel / 10));
        const currentTicketsForSkill = skillTickets.length;
        const utilizationForSkill = maxTicketsForSkill > 0 ? 
          (currentTicketsForSkill / maxTicketsForSkill) * 100 : 0;

        skillCapacities.push({
          skillCategory: skill.category,
          proficiencyLevel: skill.proficiencyLevel,
          maxTicketsForSkill,
          currentTicketsForSkill,
          utilizationForSkill
        });
      }

      return skillCapacities;
    } catch (error) {
      logger.error('Error calculating skill capacities:', error);
      return [];
    }
  }

  private calculateAvailableHoursToday(technician: any): number {
    try {
      const now = new Date();
      const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
      const workingHours = technician.availability?.workingHours?.[dayOfWeek];
      
      if (!workingHours || !workingHours.available) {
        return 0;
      }

      const startTime = new Date(`${now.toDateString()} ${workingHours.start}`);
      const endTime = new Date(`${now.toDateString()} ${workingHours.end}`);
      
      if (now > endTime) {
        return 0; // Work day is over
      }
      
      const availableStart = now > startTime ? now : startTime;
      const availableHours = (endTime.getTime() - availableStart.getTime()) / (1000 * 60 * 60);
      
      return Math.max(0, availableHours);
    } catch (error) {
      logger.error('Error calculating available hours today:', error);
      return 8;
    }
  }

  private calculateAvailableHoursThisWeek(technician: any): number {
    try {
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay()); // Sunday
      
      let totalHours = 0;
      
      for (let i = 0; i < 7; i++) {
        const day = new Date(startOfWeek);
        day.setDate(startOfWeek.getDate() + i);
        
        const dayName = day.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
        const workingHours = technician.availability?.workingHours?.[dayName];
        
        if (workingHours && workingHours.available) {
          const startTime = new Date(`${day.toDateString()} ${workingHours.start}`);
          const endTime = new Date(`${day.toDateString()} ${workingHours.end}`);
          
          if (day.toDateString() === now.toDateString()) {
            // Today - calculate remaining hours
            const availableStart = now > startTime ? now : startTime;
            if (availableStart < endTime) {
              totalHours += (endTime.getTime() - availableStart.getTime()) / (1000 * 60 * 60);
            }
          } else if (day > now) {
            // Future days - full working hours
            totalHours += (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
          }
        }
      }
      
      return Math.max(0, totalHours);
    } catch (error) {
      logger.error('Error calculating available hours this week:', error);
      return 40;
    }
  }

  private async calculateAverageResolutionTime(technicianId: string): Promise<number> {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      
      const searchResult = await this.ticketService.searchTickets({
        filters: {
          assignedTechnicianId: technicianId,
          status: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
          createdAfter: thirtyDaysAgo
        }
      });
      const completedTickets = searchResult.tickets;

      if (completedTickets.length === 0) {
        return 120; // Default 2 hours
      }

      const totalResolutionTime = completedTickets.reduce((sum, ticket) => {
        return sum + (ticket.actualResolutionTime || 0);
      }, 0);

      return Math.round(totalResolutionTime / completedTickets.length);
    } catch (error) {
      logger.error('Error calculating average resolution time:', error);
      return 120;
    }
  }

  private async calculateTicketThroughput(technicianId: string): Promise<number> {
    try {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      
      const searchResult = await this.ticketService.searchTickets({
        filters: {
          assignedTechnicianId: technicianId,
          status: [TicketStatus.RESOLVED, TicketStatus.CLOSED],
          createdAfter: sevenDaysAgo
        }
      });
      const completedTickets = searchResult.tickets;

      // Calculate tickets per day over the last 7 days
      const throughput = completedTickets.length / 7;
      return Math.round(throughput * 10) / 10; // Round to 1 decimal place
    } catch (error) {
      logger.error('Error calculating ticket throughput:', error);
      return 5;
    }
  }

  private calculateEfficiencyScore(productivityScore: number, resolutionTime: number, throughput: number): number {
    // Implementation for calculating efficiency score
    return Math.min(100, productivityScore);
  }

  private async getHistoricalWorkloadData(technicianId: string, days: number): Promise<any[]> {
    try {
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000);

      // Get historical workload analyses
      const analyses = await this.workloadAnalysisRepository.getAnalysisHistory(
        technicianId, 
        startDate, 
        endDate
      );

      // Get historical tickets for the period
      const searchResult = await this.ticketService.searchTickets({
        filters: {
          assignedTechnicianId: technicianId,
          createdAfter: startDate,
          createdBefore: endDate
        }
      });
      const tickets = searchResult.tickets;

      // Group tickets by day and calculate daily metrics
      const dailyData: any[] = [];
      for (let i = 0; i < days; i++) {
        const dayStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
        const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

        const dayTickets = tickets.filter(ticket => 
          ticket.createdAt >= dayStart && ticket.createdAt < dayEnd
        );

        const dayAnalysis = analyses.find(analysis => 
          analysis.analysisDate >= dayStart && analysis.analysisDate < dayEnd
        );

        dailyData.push({
          date: dayStart,
          ticketCount: dayTickets.length,
          utilization: dayAnalysis?.currentCapacity.utilizationPercentage || 0,
          workHours: dayAnalysis?.utilizationMetrics.activeWorkTime || 0,
          completedTickets: dayTickets.filter(t => 
            t.status === 'resolved' || t.status === 'closed'
          ).length
        });
      }

      return dailyData;
    } catch (error) {
      logger.error('Error getting historical workload data:', error);
      return [];
    }
  }

  private identifyHistoricalPatterns(data: any[]): HistoricalPattern[] {
    // Implementation for pattern identification
    return [];
  }

  private predictTicketCount(data: any[], patterns: HistoricalPattern[]): number {
    // Implementation for ticket count prediction
    return 10;
  }

  private predictWorkHours(data: any[], patterns: HistoricalPattern[]): number {
    // Implementation for work hours prediction
    return 40;
  }

  private predictUtilization(ticketCount: number, workHours: number): number {
    // Implementation for utilization prediction
    return 75;
  }

  private assessOverutilizationRisk(utilization: number): RiskLevel {
    if (utilization > 95) return RiskLevel.CRITICAL;
    if (utilization > 85) return RiskLevel.HIGH;
    if (utilization > 75) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private assessBurnoutRisk(technicianId: string, utilization: number): RiskLevel {
    // Implementation for burnout risk assessment
    return this.assessOverutilizationRisk(utilization);
  }

  private assessSLARisk(technicianId: string, ticketCount: number): RiskLevel {
    // Implementation for SLA risk assessment
    return RiskLevel.LOW;
  }

  private analyzeTrend(values: number[]): TrendDirection {
    if (values.length < 2) return TrendDirection.STABLE;
    
    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));
    
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    
    const change = ((secondAvg - firstAvg) / firstAvg) * 100;
    
    if (change > 10) return TrendDirection.INCREASING;
    if (change < -10) return TrendDirection.DECREASING;
    return TrendDirection.STABLE;
  }

  private calculatePredictionConfidence(data: any[]): number {
    // Implementation for prediction confidence calculation
    return Math.min(100, data.length * 10);
  }

  private assessDataQuality(data: any[]): number {
    // Implementation for data quality assessment
    return 85;
  }

  private async calculatePeakCapacityUsed(technicianId: string, period: DateRange): Promise<number> {
    // Implementation for peak capacity calculation
    return 95;
  }

  private async calculateCapacityVariance(technicianId: string, period: DateRange): Promise<number> {
    // Implementation for capacity variance calculation
    return 15;
  }

  private async calculateFirstCallResolutionRate(technicianId: string, period: DateRange): Promise<number> {
    // Implementation for first call resolution rate
    return 75;
  }

  private async calculateCustomerSatisfactionScore(technicianId: string, period: DateRange): Promise<number> {
    // Implementation for customer satisfaction score
    return 4.2;
  }

  private async calculateTeamAverageUtilization(technicianId: string): Promise<number> {
    // Implementation for team average utilization
    return 70;
  }

  private async calculatePerformanceRanking(technicianId: string): Promise<number> {
    // Implementation for performance ranking
    return 75;
  }

  private assessTechnicianRiskLevel(analysis: WorkloadAnalysis): RiskLevel {
    const alerts = analysis.alerts.filter(a => a.isActive);
    const criticalAlerts = alerts.filter(a => a.severity === AlertSeverity.CRITICAL);
    const warningAlerts = alerts.filter(a => a.severity === AlertSeverity.WARNING);
    
    if (criticalAlerts.length > 0) return RiskLevel.CRITICAL;
    if (warningAlerts.length > 2) return RiskLevel.HIGH;
    if (warningAlerts.length > 0) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private calculateVariance(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map(value => Math.pow(value - mean, 2));
    return Math.sqrt(squaredDiffs.reduce((a, b) => a + b, 0) / values.length);
  }

  private async identifyRebalancingOpportunities(summaries: TechnicianWorkloadSummary[]): Promise<RebalancingOpportunity[]> {
    const opportunities: RebalancingOpportunity[] = [];

    // Find overutilized and underutilized technicians
    const overutilized = summaries.filter(s => s.currentUtilization > this.config.overutilizationThreshold);
    const underutilized = summaries.filter(s => 
      s.currentUtilization < this.config.underutilizationThreshold && s.availableCapacity > 0
    );

    for (const overTech of overutilized) {
      // Get tickets for overutilized technician
      const tickets = await this.ticketService.getTicketsByTechnician(
        overTech.technicianId,
        [TicketStatus.OPEN, TicketStatus.IN_PROGRESS]
      );

      for (const underTech of underutilized) {
        if (overTech.technicianId === underTech.technicianId) continue;

        // Get technician details for skill matching
        const overTechnician = await this.getTechnicianById(overTech.technicianId);
        const underTechnician = await this.getTechnicianById(underTech.technicianId);

        if (!overTechnician || !underTechnician) continue;

        // Find tickets that could be reassigned based on skill match
        const reassignableTickets = tickets.filter(ticket => {
          return this.canTechnicianHandleTicket(underTechnician, ticket);
        }).slice(0, Math.min(3, underTech.availableCapacity)); // Limit to 3 tickets or available capacity

        if (reassignableTickets.length > 0) {
          const skillMatchScore = this.calculateSkillMatchScore(underTechnician, reassignableTickets);
          const expectedImprovementFrom = (reassignableTickets.length / overTech.capacity) * 100;
          const expectedImprovementTo = Math.min(20, expectedImprovementFrom);

          opportunities.push({
            fromTechnicianId: overTech.technicianId,
            toTechnicianId: underTech.technicianId,
            ticketIds: reassignableTickets.map(t => t.id),
            expectedImprovementFrom,
            expectedImprovementTo,
            skillMatchScore,
            effort: reassignableTickets.length <= 2 ? ImplementationEffort.LOW : ImplementationEffort.MEDIUM
          });
        }
      }
    }

    // Sort by expected improvement (highest first)
    return opportunities.sort((a, b) => b.expectedImprovementFrom - a.expectedImprovementFrom);
  }

  /**
   * Check if a technician can handle a specific ticket based on skills
   */
  private canTechnicianHandleTicket(technician: any, ticket: any): boolean {
    if (!technician.skills || technician.skills.length === 0) {
      return true; // If no skills defined, assume they can handle any ticket
    }

    // Check if technician has skills matching the ticket category
    const hasMatchingSkill = technician.skills.some((skill: any) => 
      ticket.category && ticket.category.toLowerCase().includes(skill.category.toLowerCase())
    );

    return hasMatchingSkill;
  }

  /**
   * Calculate skill match score between technician and tickets
   */
  private calculateSkillMatchScore(technician: any, tickets: any[]): number {
    if (!technician.skills || technician.skills.length === 0) {
      return 70; // Default score if no skills defined
    }

    let totalScore = 0;
    let matchedTickets = 0;

    for (const ticket of tickets) {
      const matchingSkill = technician.skills.find((skill: any) => 
        ticket.category && ticket.category.toLowerCase().includes(skill.category.toLowerCase())
      );

      if (matchingSkill) {
        totalScore += matchingSkill.proficiencyLevel * 10; // Convert 1-10 scale to percentage
        matchedTickets++;
      } else {
        totalScore += 50; // Default score for non-matching skills
        matchedTickets++;
      }
    }

    return matchedTickets > 0 ? Math.round(totalScore / matchedTickets) : 70;
  }

  private async identifyCapacityOptimizations(summaries: TechnicianWorkloadSummary[]): Promise<CapacityOptimization[]> {
    const optimizations: CapacityOptimization[] = [];

    for (const summary of summaries) {
      const technician = await this.getTechnicianById(summary.technicianId);
      if (!technician) continue;

      let recommendedCapacity = summary.capacity;
      let reasoning = '';
      let expectedImpact = 0;
      const implementationSteps: string[] = [];

      // Check for consistent overutilization
      if (summary.currentUtilization > 90) {
        recommendedCapacity = Math.ceil(summary.capacity * 1.2);
        reasoning = 'Consistently overutilized - increase capacity by 20%';
        expectedImpact = 15;
        implementationSteps.push(
          'Review current ticket assignment patterns',
          'Increase maximum concurrent ticket limit',
          'Monitor performance for 2 weeks'
        );
      }
      // Check for consistent underutilization
      else if (summary.currentUtilization < 40 && summary.capacity > 5) {
        recommendedCapacity = Math.max(5, Math.floor(summary.capacity * 0.8));
        reasoning = 'Consistently underutilized - optimize capacity allocation';
        expectedImpact = 10;
        implementationSteps.push(
          'Analyze skill utilization patterns',
          'Reduce maximum concurrent ticket limit',
          'Reassign excess capacity to other team members'
        );
      }

      if (recommendedCapacity !== summary.capacity) {
        optimizations.push({
          technicianId: summary.technicianId,
          currentCapacity: summary.capacity,
          recommendedCapacity,
          reasoning,
          expectedImpact,
          implementationSteps
        });
      }
    }

    return optimizations;
  }

  /**
   * Get overutilization detection and alert generation
   */
  public async detectOverutilization(): Promise<WorkloadAlert[]> {
    try {
      const technicians = await this.getAllTechnicians();
      const alerts: WorkloadAlert[] = [];

      for (const technician of technicians) {
        const capacity = await this.calculateTechnicianCapacity(technician.id);
        const prediction = await this.generateWorkloadPrediction(technician.id);

        // Generate alerts for this technician
        const technicianAlerts = await this.generateWorkloadAlerts(
          technician.id,
          capacity,
          prediction
        );

        alerts.push(...technicianAlerts);
      }

      // Store alerts for tracking
      for (const alert of alerts) {
        const existingAlerts = this.activeAlerts.get(alert.technicianId) || [];
        existingAlerts.push(alert);
        this.activeAlerts.set(alert.technicianId, existingAlerts);
      }

      logger.info(`Overutilization detection completed. Found ${alerts.length} alerts.`);
      return alerts;
    } catch (error) {
      logger.error('Error in overutilization detection:', error);
      throw error;
    }
  }

  /**
   * Get capacity optimization recommendations for all technicians
   */
  public async getCapacityOptimizations(): Promise<CapacityOptimization[]> {
    try {
      const technicians = await this.getAllTechnicians();
      const summaries: TechnicianWorkloadSummary[] = [];

      for (const technician of technicians) {
        const analysis = await this.analyzeWorkload(technician.id);
        const riskLevel = this.assessTechnicianRiskLevel(analysis);
        const activeAlerts = analysis.alerts.filter(a => a.isActive).length;

        summaries.push({
          technicianId: technician.id,
          name: technician.name,
          currentUtilization: analysis.currentCapacity.utilizationPercentage,
          capacity: analysis.currentCapacity.maxConcurrentTickets,
          availableCapacity: analysis.currentCapacity.availableCapacity,
          riskLevel,
          activeAlerts,
          recommendations: analysis.recommendations.length
        });
      }

      return await this.identifyCapacityOptimizations(summaries);
    } catch (error) {
      logger.error('Error getting capacity optimizations:', error);
      throw error;
    }
  }
}