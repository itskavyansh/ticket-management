import { TicketRepository } from '../database/repositories/TicketRepository';
import { SLAService, SLAStatus, SLAMetrics } from './SLAService';
import { SLAAlertingService } from './SLAAlertingService';
import { TicketEntity } from '../entities/TicketEntity';
import { TicketStatus, Priority } from '../types';
import { logger } from '../utils/logger';
import axios from 'axios';

/**
 * SLA dashboard data interfaces
 */
export interface SLADashboardOverview {
  totalActiveTickets: number;
  slaCompliantTickets: number;
  atRiskTickets: number;
  breachedTickets: number;
  complianceRate: number;
  averageRiskScore: number;
  criticalAlertsCount: number;
  lastUpdated: Date;
}

export interface SLARiskDistribution {
  low: number;
  medium: number;
  high: number;
  critical: number;
}

export interface SLATrendData {
  date: string;
  complianceRate: number;
  breachCount: number;
  averageRiskScore: number;
  totalTickets: number;
}

export interface SLATicketRiskItem {
  ticketId: string;
  customerId: string;
  customerName: string;
  title: string;
  priority: Priority;
  status: TicketStatus;
  riskScore: number;
  riskLevel: string;
  timeRemaining: number;
  slaDeadline: Date;
  assignedTechnicianId?: string;
  estimatedCompletion?: Date;
  recommendations: string[];
}

export interface SLAPerformanceByTechnician {
  technicianId: string;
  technicianName: string;
  activeTickets: number;
  atRiskTickets: number;
  averageRiskScore: number;
  complianceRate: number;
  averageResolutionTime: number;
  workloadStatus: 'low' | 'normal' | 'high' | 'overloaded';
}

export interface SLAPerformanceByCustomer {
  customerId: string;
  customerName: string;
  customerTier: string;
  activeTickets: number;
  atRiskTickets: number;
  complianceRate: number;
  averageRiskScore: number;
  breachCount: number;
}

export interface SLAAlertSummary {
  totalAlerts: number;
  criticalAlerts: number;
  highRiskAlerts: number;
  mediumRiskAlerts: number;
  recentAlerts: Array<{
    id: string;
    ticketId: string;
    type: string;
    severity: string;
    message: string;
    createdAt: Date;
  }>;
}

export interface SLADashboardData {
  overview: SLADashboardOverview;
  riskDistribution: SLARiskDistribution;
  trendData: SLATrendData[];
  highRiskTickets: SLATicketRiskItem[];
  performanceByTechnician: SLAPerformanceByTechnician[];
  performanceByCustomer: SLAPerformanceByCustomer[];
  alertSummary: SLAAlertSummary;
  lastRefresh: Date;
}

/**
 * SLA Dashboard Service for providing comprehensive SLA monitoring data
 */
export class SLADashboardService {
  private ticketRepository: TicketRepository;
  private slaService: SLAService;
  private slaAlertingService: SLAAlertingService;
  private aiServiceUrl: string;
  private cacheTimeout: number = 5 * 60 * 1000; // 5 minutes
  private cachedData: SLADashboardData | null = null;
  private lastCacheTime: Date | null = null;

  constructor(
    ticketRepository?: TicketRepository,
    slaService?: SLAService,
    slaAlertingService?: SLAAlertingService
  ) {
    this.ticketRepository = ticketRepository || new TicketRepository();
    this.slaService = slaService || new SLAService();
    this.slaAlertingService = slaAlertingService || new SLAAlertingService();
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
  }

  /**
   * Get comprehensive SLA dashboard data
   */
  public async getDashboardData(forceRefresh: boolean = false): Promise<SLADashboardData> {
    try {
      // Check cache
      if (!forceRefresh && this.isCacheValid()) {
        logger.debug('Returning cached SLA dashboard data');
        return this.cachedData!;
      }

      logger.info('Refreshing SLA dashboard data');
      const startTime = Date.now();

      // Fetch all data in parallel
      const [
        overview,
        riskDistribution,
        trendData,
        highRiskTickets,
        performanceByTechnician,
        performanceByCustomer,
        alertSummary
      ] = await Promise.all([
        this.getOverviewData(),
        this.getRiskDistribution(),
        this.getTrendData(),
        this.getHighRiskTickets(),
        this.getPerformanceByTechnician(),
        this.getPerformanceByCustomer(),
        this.getAlertSummary()
      ]);

      const dashboardData: SLADashboardData = {
        overview,
        riskDistribution,
        trendData,
        highRiskTickets,
        performanceByTechnician,
        performanceByCustomer,
        alertSummary,
        lastRefresh: new Date()
      };

      // Cache the data
      this.cachedData = dashboardData;
      this.lastCacheTime = new Date();

      const duration = Date.now() - startTime;
      logger.info(`SLA dashboard data refreshed in ${duration}ms`);

      return dashboardData;

    } catch (error) {
      logger.error('Failed to get SLA dashboard data', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get overview statistics
   */
  private async getOverviewData(): Promise<SLADashboardOverview> {
    const activeTickets = await this.getActiveTickets();
    const totalActiveTickets = activeTickets.length;

    if (totalActiveTickets === 0) {
      return {
        totalActiveTickets: 0,
        slaCompliantTickets: 0,
        atRiskTickets: 0,
        breachedTickets: 0,
        complianceRate: 100,
        averageRiskScore: 0,
        criticalAlertsCount: 0,
        lastUpdated: new Date()
      };
    }

    // Get SLA predictions for all active tickets
    const ticketRisks = await this.getTicketRiskScores(activeTickets);
    
    let slaCompliantTickets = 0;
    let atRiskTickets = 0;
    let breachedTickets = 0;
    let totalRiskScore = 0;

    for (const ticket of activeTickets) {
      const riskScore = ticketRisks.get(ticket.id) || 0;
      totalRiskScore += riskScore;

      const timeRemaining = ticket.slaDeadline.getTime() - Date.now();
      
      if (timeRemaining <= 0) {
        breachedTickets++;
      } else if (riskScore >= 0.6) {
        atRiskTickets++;
      } else {
        slaCompliantTickets++;
      }
    }

    const complianceRate = totalActiveTickets > 0 
      ? ((slaCompliantTickets / totalActiveTickets) * 100) 
      : 100;

    const averageRiskScore = totalActiveTickets > 0 
      ? (totalRiskScore / totalActiveTickets) 
      : 0;

    // Get critical alerts count
    const recentAlerts = this.slaAlertingService.getAlertHistory(
      undefined,
      new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
    );
    const criticalAlertsCount = recentAlerts.filter(a => a.severity === 'critical').length;

    return {
      totalActiveTickets,
      slaCompliantTickets,
      atRiskTickets,
      breachedTickets,
      complianceRate: Math.round(complianceRate * 100) / 100,
      averageRiskScore: Math.round(averageRiskScore * 100) / 100,
      criticalAlertsCount,
      lastUpdated: new Date()
    };
  }

  /**
   * Get risk distribution data
   */
  private async getRiskDistribution(): Promise<SLARiskDistribution> {
    const activeTickets = await this.getActiveTickets();
    const ticketRisks = await this.getTicketRiskScores(activeTickets);

    const distribution = { low: 0, medium: 0, high: 0, critical: 0 };

    for (const ticket of activeTickets) {
      const riskScore = ticketRisks.get(ticket.id) || 0;
      
      if (riskScore >= 0.9) {
        distribution.critical++;
      } else if (riskScore >= 0.7) {
        distribution.high++;
      } else if (riskScore >= 0.4) {
        distribution.medium++;
      } else {
        distribution.low++;
      }
    }

    return distribution;
  }

  /**
   * Get trend data for the last 30 days
   */
  private async getTrendData(): Promise<SLATrendData[]> {
    const trendData: SLATrendData[] = [];
    const now = new Date();

    // Generate data for last 30 days
    for (let i = 29; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      date.setHours(23, 59, 59, 999); // End of day

      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      try {
        // Get SLA metrics for this day
        const metrics = await this.slaService.getSLAMetrics(startOfDay, date);

        trendData.push({
          date: date.toISOString().split('T')[0],
          complianceRate: metrics.complianceRate,
          breachCount: metrics.breachCount,
          averageRiskScore: 0, // Would need historical risk data
          totalTickets: metrics.totalTickets
        });
      } catch (error) {
        // If we can't get data for a day, use defaults
        trendData.push({
          date: date.toISOString().split('T')[0],
          complianceRate: 0,
          breachCount: 0,
          averageRiskScore: 0,
          totalTickets: 0
        });
      }
    }

    return trendData;
  }

  /**
   * Get high-risk tickets with detailed information
   */
  private async getHighRiskTickets(limit: number = 20): Promise<SLATicketRiskItem[]> {
    const activeTickets = await this.getActiveTickets();
    const ticketRisks = await this.getTicketRiskScores(activeTickets);

    // Filter and sort by risk score
    const highRiskTickets = activeTickets
      .filter(ticket => {
        const riskScore = ticketRisks.get(ticket.id) || 0;
        return riskScore >= 0.6; // Medium risk and above
      })
      .sort((a, b) => {
        const riskA = ticketRisks.get(a.id) || 0;
        const riskB = ticketRisks.get(b.id) || 0;
        return riskB - riskA; // Highest risk first
      })
      .slice(0, limit);

    // Get detailed predictions for high-risk tickets
    const detailedTickets: SLATicketRiskItem[] = [];

    for (const ticket of highRiskTickets) {
      try {
        const prediction = await this.getSLAPrediction(ticket);
        const riskScore = ticketRisks.get(ticket.id) || 0;
        const timeRemaining = Math.max(0, Math.floor((ticket.slaDeadline.getTime() - Date.now()) / (1000 * 60)));

        detailedTickets.push({
          ticketId: ticket.id,
          customerId: ticket.customerId,
          customerName: ticket.customerName,
          title: ticket.title,
          priority: ticket.priority,
          status: ticket.status,
          riskScore,
          riskLevel: this.getRiskLevel(riskScore),
          timeRemaining,
          slaDeadline: ticket.slaDeadline,
          assignedTechnicianId: ticket.assignedTechnicianId,
          estimatedCompletion: prediction?.estimated_completion_time 
            ? new Date(prediction.estimated_completion_time) 
            : undefined,
          recommendations: prediction?.recommended_actions || []
        });
      } catch (error) {
        logger.warn(`Failed to get detailed prediction for ticket ${ticket.id}`, {
          error: (error as Error).message
        });
        
        // Add basic info without AI prediction
        const riskScore = ticketRisks.get(ticket.id) || 0;
        const timeRemaining = Math.max(0, Math.floor((ticket.slaDeadline.getTime() - Date.now()) / (1000 * 60)));

        detailedTickets.push({
          ticketId: ticket.id,
          customerId: ticket.customerId,
          customerName: ticket.customerName,
          title: ticket.title,
          priority: ticket.priority,
          status: ticket.status,
          riskScore,
          riskLevel: this.getRiskLevel(riskScore),
          timeRemaining,
          slaDeadline: ticket.slaDeadline,
          assignedTechnicianId: ticket.assignedTechnicianId,
          recommendations: ['Manual review required']
        });
      }
    }

    return detailedTickets;
  }

  /**
   * Get performance data by technician
   */
  private async getPerformanceByTechnician(): Promise<SLAPerformanceByTechnician[]> {
    const activeTickets = await this.getActiveTickets();
    const ticketRisks = await this.getTicketRiskScores(activeTickets);

    // Group tickets by technician
    const technicianMap = new Map<string, TicketEntity[]>();
    
    for (const ticket of activeTickets) {
      if (ticket.assignedTechnicianId) {
        if (!technicianMap.has(ticket.assignedTechnicianId)) {
          technicianMap.set(ticket.assignedTechnicianId, []);
        }
        technicianMap.get(ticket.assignedTechnicianId)!.push(ticket);
      }
    }

    const performance: SLAPerformanceByTechnician[] = [];

    for (const [technicianId, tickets] of technicianMap) {
      const activeTicketsCount = tickets.length;
      const atRiskTickets = tickets.filter(t => (ticketRisks.get(t.id) || 0) >= 0.6).length;
      
      const totalRiskScore = tickets.reduce((sum, t) => sum + (ticketRisks.get(t.id) || 0), 0);
      const averageRiskScore = activeTicketsCount > 0 ? totalRiskScore / activeTicketsCount : 0;

      // Get historical compliance rate (simplified)
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // Last 30 days
      
      try {
        const metrics = await this.slaService.getSLAMetrics(startDate, endDate, undefined, technicianId);
        
        // Determine workload status
        let workloadStatus: 'low' | 'normal' | 'high' | 'overloaded' = 'normal';
        if (activeTicketsCount >= 15) workloadStatus = 'overloaded';
        else if (activeTicketsCount >= 10) workloadStatus = 'high';
        else if (activeTicketsCount <= 3) workloadStatus = 'low';

        performance.push({
          technicianId,
          technicianName: `Technician ${technicianId}`, // Would get from user service
          activeTickets: activeTicketsCount,
          atRiskTickets,
          averageRiskScore: Math.round(averageRiskScore * 100) / 100,
          complianceRate: metrics.complianceRate,
          averageResolutionTime: metrics.averageResolutionTime,
          workloadStatus
        });
      } catch (error) {
        logger.warn(`Failed to get metrics for technician ${technicianId}`, {
          error: (error as Error).message
        });
      }
    }

    return performance.sort((a, b) => b.averageRiskScore - a.averageRiskScore);
  }

  /**
   * Get performance data by customer
   */
  private async getPerformanceByCustomer(): Promise<SLAPerformanceByCustomer[]> {
    const activeTickets = await this.getActiveTickets();
    const ticketRisks = await this.getTicketRiskScores(activeTickets);

    // Group tickets by customer
    const customerMap = new Map<string, TicketEntity[]>();
    
    for (const ticket of activeTickets) {
      if (!customerMap.has(ticket.customerId)) {
        customerMap.set(ticket.customerId, []);
      }
      customerMap.get(ticket.customerId)!.push(ticket);
    }

    const performance: SLAPerformanceByCustomer[] = [];

    for (const [customerId, tickets] of customerMap) {
      const activeTicketsCount = tickets.length;
      const atRiskTickets = tickets.filter(t => (ticketRisks.get(t.id) || 0) >= 0.6).length;
      
      const totalRiskScore = tickets.reduce((sum, t) => sum + (ticketRisks.get(t.id) || 0), 0);
      const averageRiskScore = activeTicketsCount > 0 ? totalRiskScore / activeTicketsCount : 0;

      // Get historical compliance rate
      const endDate = new Date();
      const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
      
      try {
        const metrics = await this.slaService.getSLAMetrics(startDate, endDate, customerId);
        
        performance.push({
          customerId,
          customerName: tickets[0].customerName,
          customerTier: tickets[0].customerTier,
          activeTickets: activeTicketsCount,
          atRiskTickets,
          complianceRate: metrics.complianceRate,
          averageRiskScore: Math.round(averageRiskScore * 100) / 100,
          breachCount: metrics.breachCount
        });
      } catch (error) {
        logger.warn(`Failed to get metrics for customer ${customerId}`, {
          error: (error as Error).message
        });
      }
    }

    return performance.sort((a, b) => b.averageRiskScore - a.averageRiskScore);
  }

  /**
   * Get alert summary
   */
  private async getAlertSummary(): Promise<SLAAlertSummary> {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const alerts = this.slaAlertingService.getAlertHistory(undefined, last24Hours);

    const totalAlerts = alerts.length;
    const criticalAlerts = alerts.filter(a => a.severity === 'critical').length;
    const highRiskAlerts = alerts.filter(a => a.severity === 'error').length;
    const mediumRiskAlerts = alerts.filter(a => a.severity === 'warning').length;

    const recentAlerts = alerts.slice(0, 10).map(alert => ({
      id: alert.id,
      ticketId: alert.ticketId,
      type: alert.type,
      severity: alert.severity,
      message: alert.message,
      createdAt: alert.createdAt
    }));

    return {
      totalAlerts,
      criticalAlerts,
      highRiskAlerts,
      mediumRiskAlerts,
      recentAlerts
    };
  }

  /**
   * Helper methods
   */
  private async getActiveTickets(): Promise<TicketEntity[]> {
    const activeStatuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS, TicketStatus.PENDING_CUSTOMER];
    const allTickets: TicketEntity[] = [];

    for (const status of activeStatuses) {
      const result = await this.ticketRepository.search({
        filters: { status: [status] },
        limit: 1000
      });
      allTickets.push(...result.tickets);
    }

    return allTickets;
  }

  private async getTicketRiskScores(tickets: TicketEntity[]): Promise<Map<string, number>> {
    const riskScores = new Map<string, number>();

    // Get risk scores in batches to avoid overwhelming the AI service
    const batchSize = 10;
    for (let i = 0; i < tickets.length; i += batchSize) {
      const batch = tickets.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (ticket) => {
        try {
          const prediction = await this.getSLAPrediction(ticket);
          return { ticketId: ticket.id, riskScore: prediction?.breach_probability || 0 };
        } catch (error) {
          logger.warn(`Failed to get risk score for ticket ${ticket.id}`);
          return { ticketId: ticket.id, riskScore: 0 };
        }
      });

      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          riskScores.set(result.value.ticketId, result.value.riskScore);
        }
      });
    }

    return riskScores;
  }

  private async getSLAPrediction(ticket: TicketEntity): Promise<any> {
    const requestData = {
      ticket_id: ticket.id,
      customer_id: ticket.customerId,
      customer_tier: ticket.customerTier,
      priority: ticket.priority,
      status: ticket.status,
      created_at: ticket.createdAt.toISOString(),
      sla_deadline: ticket.slaDeadline.toISOString(),
      current_time: new Date().toISOString(),
      category: ticket.category,
      title: ticket.title,
      description: ticket.description,
      assigned_technician_id: ticket.assignedTechnicianId,
      time_spent: ticket.timeSpent,
      escalation_level: ticket.escalationLevel
    };

    const response = await axios.post(`${this.aiServiceUrl}/ai/predict-sla`, requestData, {
      timeout: 5000,
      headers: { 'Content-Type': 'application/json' }
    });

    return response.data.success ? response.data.result : null;
  }

  private getRiskLevel(riskScore: number): string {
    if (riskScore >= 0.9) return 'critical';
    if (riskScore >= 0.7) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  private isCacheValid(): boolean {
    if (!this.cachedData || !this.lastCacheTime) {
      return false;
    }

    const now = Date.now();
    const cacheAge = now - this.lastCacheTime.getTime();
    return cacheAge < this.cacheTimeout;
  }

  /**
   * Clear cache to force refresh
   */
  public clearCache(): void {
    this.cachedData = null;
    this.lastCacheTime = null;
    logger.debug('SLA dashboard cache cleared');
  }

  /**
   * Get specific ticket SLA details
   */
  public async getTicketSLADetails(ticketId: string): Promise<SLATicketRiskItem | null> {
    try {
      const ticket = await this.ticketRepository.findById('', ticketId); // customerId will be resolved
      if (!ticket) {
        return null;
      }

      const prediction = await this.getSLAPrediction(ticket);
      const riskScore = prediction?.breach_probability || 0;
      const timeRemaining = Math.max(0, Math.floor((ticket.slaDeadline.getTime() - Date.now()) / (1000 * 60)));

      return {
        ticketId: ticket.id,
        customerId: ticket.customerId,
        customerName: ticket.customerName,
        title: ticket.title,
        priority: ticket.priority,
        status: ticket.status,
        riskScore,
        riskLevel: this.getRiskLevel(riskScore),
        timeRemaining,
        slaDeadline: ticket.slaDeadline,
        assignedTechnicianId: ticket.assignedTechnicianId,
        estimatedCompletion: prediction?.estimated_completion_time 
          ? new Date(prediction.estimated_completion_time) 
          : undefined,
        recommendations: prediction?.recommended_actions || []
      };

    } catch (error) {
      logger.error(`Failed to get SLA details for ticket ${ticketId}`, {
        error: (error as Error).message
      });
      return null;
    }
  }
}