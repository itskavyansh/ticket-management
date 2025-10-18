import { TicketRepository } from '../database/repositories/TicketRepository';
import { TicketEntity } from '../entities/TicketEntity';
import { TicketStatus, Priority } from '../types';
import { logger } from '../utils/logger';

/**
 * SLA configuration interface
 */
export interface SLAConfiguration {
  customerTier: 'basic' | 'premium' | 'enterprise';
  priority: Priority;
  responseTimeMinutes: number;
  resolutionTimeMinutes: number;
  businessHoursOnly: boolean;
}

/**
 * SLA breach alert interface
 */
export interface SLABreachAlert {
  ticketId: string;
  customerId: string;
  customerName: string;
  title: string;
  priority: Priority;
  status: TicketStatus;
  slaDeadline: Date;
  currentTime: Date;
  minutesOverdue: number;
  riskScore: number;
  escalationLevel: number;
  assignedTechnicianId?: string;
}

/**
 * SLA status interface
 */
export interface SLAStatus {
  ticketId: string;
  customerId: string;
  slaDeadline: Date;
  timeRemaining: number; // in minutes
  timeElapsed: number; // in minutes
  totalSLATime: number; // in minutes
  progressPercentage: number; // 0-100
  riskScore: number; // 0-1
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  isOverdue: boolean;
  minutesOverdue?: number;
  status: TicketStatus;
  priority: Priority;
}

/**
 * SLA metrics interface
 */
export interface SLAMetrics {
  totalTickets: number;
  onTimeTickets: number;
  overdueTickets: number;
  complianceRate: number; // percentage
  averageResolutionTime: number; // in minutes
  averageResponseTime: number; // in minutes
  breachCount: number;
  riskDistribution: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
}

/**
 * Business hours configuration
 */
export interface BusinessHours {
  timezone: string;
  workingDays: number[]; // 0-6, where 0 is Sunday
  startHour: number; // 0-23
  endHour: number; // 0-23
  holidays: Date[];
}

/**
 * SLA Service for managing Service Level Agreements
 */
export class SLAService {
  private ticketRepository: TicketRepository;
  private defaultSLAConfigurations!: Map<string, SLAConfiguration>;
  private defaultBusinessHours!: BusinessHours;

  constructor(ticketRepository?: TicketRepository) {
    this.ticketRepository = ticketRepository || new TicketRepository();
    this.initializeDefaultConfigurations();
    this.initializeDefaultBusinessHours();
  }

  /**
   * Initialize default SLA configurations
   */
  private initializeDefaultConfigurations(): void {
    this.defaultSLAConfigurations = new Map();

    // Enterprise tier configurations
    this.defaultSLAConfigurations.set('enterprise-critical', {
      customerTier: 'enterprise',
      priority: Priority.CRITICAL,
      responseTimeMinutes: 15,
      resolutionTimeMinutes: 60,
      businessHoursOnly: false
    });

    this.defaultSLAConfigurations.set('enterprise-high', {
      customerTier: 'enterprise',
      priority: Priority.HIGH,
      responseTimeMinutes: 30,
      resolutionTimeMinutes: 240,
      businessHoursOnly: false
    });

    this.defaultSLAConfigurations.set('enterprise-medium', {
      customerTier: 'enterprise',
      priority: Priority.MEDIUM,
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 480,
      businessHoursOnly: true
    });

    this.defaultSLAConfigurations.set('enterprise-low', {
      customerTier: 'enterprise',
      priority: Priority.LOW,
      responseTimeMinutes: 120,
      resolutionTimeMinutes: 1440,
      businessHoursOnly: true
    });

    // Premium tier configurations
    this.defaultSLAConfigurations.set('premium-critical', {
      customerTier: 'premium',
      priority: Priority.CRITICAL,
      responseTimeMinutes: 30,
      resolutionTimeMinutes: 120,
      businessHoursOnly: false
    });

    this.defaultSLAConfigurations.set('premium-high', {
      customerTier: 'premium',
      priority: Priority.HIGH,
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 480,
      businessHoursOnly: false
    });

    this.defaultSLAConfigurations.set('premium-medium', {
      customerTier: 'premium',
      priority: Priority.MEDIUM,
      responseTimeMinutes: 120,
      resolutionTimeMinutes: 960,
      businessHoursOnly: true
    });

    this.defaultSLAConfigurations.set('premium-low', {
      customerTier: 'premium',
      priority: Priority.LOW,
      responseTimeMinutes: 240,
      resolutionTimeMinutes: 2880,
      businessHoursOnly: true
    });

    // Basic tier configurations
    this.defaultSLAConfigurations.set('basic-critical', {
      customerTier: 'basic',
      priority: Priority.CRITICAL,
      responseTimeMinutes: 60,
      resolutionTimeMinutes: 240,
      businessHoursOnly: true
    });

    this.defaultSLAConfigurations.set('basic-high', {
      customerTier: 'basic',
      priority: Priority.HIGH,
      responseTimeMinutes: 120,
      resolutionTimeMinutes: 960,
      businessHoursOnly: true
    });

    this.defaultSLAConfigurations.set('basic-medium', {
      customerTier: 'basic',
      priority: Priority.MEDIUM,
      responseTimeMinutes: 240,
      resolutionTimeMinutes: 1440,
      businessHoursOnly: true
    });

    this.defaultSLAConfigurations.set('basic-low', {
      customerTier: 'basic',
      priority: Priority.LOW,
      responseTimeMinutes: 480,
      resolutionTimeMinutes: 4320,
      businessHoursOnly: true
    });
  }

  /**
   * Initialize default business hours
   */
  private initializeDefaultBusinessHours(): void {
    this.defaultBusinessHours = {
      timezone: 'UTC',
      workingDays: [1, 2, 3, 4, 5], // Monday to Friday
      startHour: 9,
      endHour: 17,
      holidays: []
    };
  }

  /**
   * Calculate SLA deadline for a ticket
   */
  public calculateSLADeadline(
    customerTier: 'basic' | 'premium' | 'enterprise',
    priority: Priority,
    createdAt: Date,
    businessHours?: BusinessHours
  ): Date {
    const configKey = `${customerTier}-${priority}`;
    const slaConfig = this.defaultSLAConfigurations.get(configKey);
    
    if (!slaConfig) {
      logger.warn('No SLA configuration found, using default', { customerTier, priority });
      // Fallback to basic-medium configuration
      const fallbackConfig = this.defaultSLAConfigurations.get('basic-medium')!;
      return this.addBusinessTime(createdAt, fallbackConfig.resolutionTimeMinutes, businessHours);
    }

    return this.addBusinessTime(createdAt, slaConfig.resolutionTimeMinutes, businessHours);
  }

  /**
   * Get SLA status for a ticket
   */
  public getSLAStatus(ticket: TicketEntity, currentTime?: Date): SLAStatus {
    const now = currentTime || new Date();
    const timeElapsed = now.getTime() - ticket.createdAt.getTime();
    const timeRemaining = ticket.slaDeadline.getTime() - now.getTime();
    const totalSLATime = ticket.slaDeadline.getTime() - ticket.createdAt.getTime();
    
    const progressPercentage = Math.min(100, Math.max(0, (timeElapsed / totalSLATime) * 100));
    const riskScore = this.calculateRiskScore(ticket, now);
    const isOverdue = timeRemaining <= 0;
    
    return {
      ticketId: ticket.id,
      customerId: ticket.customerId,
      slaDeadline: ticket.slaDeadline,
      timeRemaining: Math.max(0, Math.floor(timeRemaining / (1000 * 60))),
      timeElapsed: Math.floor(timeElapsed / (1000 * 60)),
      totalSLATime: Math.floor(totalSLATime / (1000 * 60)),
      progressPercentage: Math.round(progressPercentage),
      riskScore,
      riskLevel: this.getRiskLevel(riskScore),
      isOverdue,
      minutesOverdue: isOverdue ? Math.floor(Math.abs(timeRemaining) / (1000 * 60)) : undefined,
      status: ticket.status,
      priority: ticket.priority
    };
  }

  /**
   * Calculate risk score for SLA breach (0-1, where 1 is highest risk)
   */
  public calculateRiskScore(ticket: TicketEntity, currentTime?: Date): number {
    const now = currentTime || new Date();
    const timeRemaining = ticket.slaDeadline.getTime() - now.getTime();
    const totalSLATime = ticket.slaDeadline.getTime() - ticket.createdAt.getTime();
    
    if (timeRemaining <= 0) {
      return 1.0; // Already breached
    }
    
    const timeElapsed = totalSLATime - timeRemaining;
    const progressRatio = timeElapsed / totalSLATime;
    
    // Base risk calculation - exponential curve
    let riskScore = Math.pow(progressRatio, 1.5);
    
    // Adjust based on ticket status
    switch (ticket.status) {
      case TicketStatus.OPEN:
        riskScore *= 1.2; // Higher risk if not yet assigned
        break;
      case TicketStatus.PENDING_CUSTOMER:
        riskScore *= 0.7; // Lower risk if waiting for customer
        break;
      case TicketStatus.IN_PROGRESS:
        riskScore *= 1.0; // Normal risk
        break;
      case TicketStatus.RESOLVED:
      case TicketStatus.CLOSED:
        riskScore = 0.0; // No risk if resolved/closed
        break;
    }
    
    // Adjust based on priority
    switch (ticket.priority) {
      case Priority.CRITICAL:
        riskScore *= 1.3;
        break;
      case Priority.HIGH:
        riskScore *= 1.1;
        break;
      case Priority.MEDIUM:
        riskScore *= 1.0;
        break;
      case Priority.LOW:
        riskScore *= 0.8;
        break;
    }
    
    // Adjust based on escalation level
    if (ticket.escalationLevel > 0) {
      riskScore *= (1 + ticket.escalationLevel * 0.2);
    }
    
    return Math.min(1.0, Math.max(0.0, riskScore));
  }

  /**
   * Get risk level based on risk score
   */
  public getRiskLevel(riskScore: number): 'low' | 'medium' | 'high' | 'critical' {
    if (riskScore >= 0.9) return 'critical';
    if (riskScore >= 0.7) return 'high';
    if (riskScore >= 0.4) return 'medium';
    return 'low';
  }

  /**
   * Check for SLA breaches and generate alerts
   */
  public async checkSLABreaches(
    riskThreshold: number = 0.7,
    criticalThreshold: number = 0.85
  ): Promise<SLABreachAlert[]> {
    try {
      // Get all active tickets (not resolved or closed)
      const activeStatuses = [
        TicketStatus.OPEN,
        TicketStatus.IN_PROGRESS,
        TicketStatus.PENDING_CUSTOMER
      ];

      const alerts: SLABreachAlert[] = [];
      
      // This is a simplified implementation - in production, you'd want to use
      // more efficient querying strategies, possibly with indexes
      for (const status of activeStatuses) {
        const tickets = await this.ticketRepository.search({
          filters: { status: [status] },
          limit: 1000 // Adjust based on your needs
        });

        for (const ticket of tickets.tickets) {
          const riskScore = this.calculateRiskScore(ticket);
          const now = new Date();
          const timeRemaining = ticket.slaDeadline.getTime() - now.getTime();
          
          // Generate alert if risk score exceeds threshold or ticket is overdue
          if (riskScore >= riskThreshold || timeRemaining <= 0) {
            const alert: SLABreachAlert = {
              ticketId: ticket.id,
              customerId: ticket.customerId,
              customerName: ticket.customerName,
              title: ticket.title,
              priority: ticket.priority,
              status: ticket.status,
              slaDeadline: ticket.slaDeadline,
              currentTime: now,
              minutesOverdue: timeRemaining <= 0 ? Math.floor(Math.abs(timeRemaining) / (1000 * 60)) : 0,
              riskScore,
              escalationLevel: ticket.escalationLevel,
              assignedTechnicianId: ticket.assignedTechnicianId
            };
            
            alerts.push(alert);
          }
        }
      }

      // Sort alerts by risk score (highest first)
      alerts.sort((a, b) => b.riskScore - a.riskScore);

      logger.info('SLA breach check completed', {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.riskScore >= criticalThreshold).length,
        overdueAlerts: alerts.filter(a => a.minutesOverdue > 0).length
      });

      return alerts;
    } catch (error) {
      logger.error('Failed to check SLA breaches', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get SLA metrics for a given period
   */
  public async getSLAMetrics(
    startDate: Date,
    endDate: Date,
    customerId?: string,
    technicianId?: string
  ): Promise<SLAMetrics> {
    try {
      const filters: any = {
        createdAfter: startDate,
        createdBefore: endDate
      };

      if (customerId) {
        filters.customerId = customerId;
      }

      if (technicianId) {
        filters.assignedTechnicianId = technicianId;
      }

      const result = await this.ticketRepository.search({
        filters,
        limit: 10000 // Adjust based on your needs
      });

      const tickets = result.tickets;
      const totalTickets = tickets.length;
      
      if (totalTickets === 0) {
        return {
          totalTickets: 0,
          onTimeTickets: 0,
          overdueTickets: 0,
          complianceRate: 0,
          averageResolutionTime: 0,
          averageResponseTime: 0,
          breachCount: 0,
          riskDistribution: { low: 0, medium: 0, high: 0, critical: 0 }
        };
      }

      let onTimeTickets = 0;
      let overdueTickets = 0;
      let totalResolutionTime = 0;
      let totalResponseTime = 0;
      let resolvedTickets = 0;
      let breachCount = 0;
      
      const riskDistribution = { low: 0, medium: 0, high: 0, critical: 0 };

      for (const ticket of tickets) {
        const slaStatus = this.getSLAStatus(ticket);
        
        // Count risk distribution for active tickets
        if (ticket.status !== TicketStatus.RESOLVED && ticket.status !== TicketStatus.CLOSED) {
          riskDistribution[slaStatus.riskLevel]++;
        }
        
        // Check if ticket was resolved on time
        if (ticket.resolvedAt) {
          resolvedTickets++;
          const resolvedOnTime = ticket.resolvedAt <= ticket.slaDeadline;
          
          if (resolvedOnTime) {
            onTimeTickets++;
          } else {
            overdueTickets++;
            breachCount++;
          }
          
          // Calculate resolution time
          if (ticket.actualResolutionTime) {
            totalResolutionTime += ticket.actualResolutionTime;
          }
          
          // Calculate response time (time to first technician assignment)
          if (ticket.assignedTechnicianId) {
            // This would ideally come from timeline data
            // For now, use a simplified calculation
            const responseTime = Math.min(60, ticket.actualResolutionTime || 60); // Assume max 1 hour response
            totalResponseTime += responseTime;
          }
        } else if (slaStatus.isOverdue) {
          // Active ticket that's already overdue
          overdueTickets++;
          breachCount++;
        }
      }

      const complianceRate = resolvedTickets > 0 ? (onTimeTickets / resolvedTickets) * 100 : 0;
      const averageResolutionTime = resolvedTickets > 0 ? totalResolutionTime / resolvedTickets : 0;
      const averageResponseTime = resolvedTickets > 0 ? totalResponseTime / resolvedTickets : 0;

      return {
        totalTickets,
        onTimeTickets,
        overdueTickets,
        complianceRate: Math.round(complianceRate * 100) / 100,
        averageResolutionTime: Math.round(averageResolutionTime),
        averageResponseTime: Math.round(averageResponseTime),
        breachCount,
        riskDistribution
      };
    } catch (error) {
      logger.error('Failed to get SLA metrics', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Update ticket SLA deadline
   */
  public async updateTicketSLA(
    customerId: string,
    ticketId: string,
    newDeadline: Date,
    reason: string,
    updatedBy: string
  ): Promise<TicketEntity | null> {
    try {
      const updatedTicket = await this.ticketRepository.update(
        customerId,
        ticketId,
        { slaDeadline: newDeadline },
        updatedBy
      );

      if (updatedTicket) {
        logger.info('SLA deadline updated', {
          ticketId,
          customerId,
          newDeadline,
          reason,
          updatedBy
        });
      }

      return updatedTicket;
    } catch (error) {
      logger.error('Failed to update ticket SLA', {
        customerId,
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Add business time to a date (excluding weekends and holidays)
   */
  private addBusinessTime(
    startDate: Date,
    minutes: number,
    businessHours?: BusinessHours
  ): Date {
    const config = businessHours || this.defaultBusinessHours;
    const result = new Date(startDate);
    let remainingMinutes = minutes;

    while (remainingMinutes > 0) {
      const dayOfWeek = result.getDay();
      const hour = result.getHours();
      
      // Check if current day is a working day
      if (!config.workingDays.includes(dayOfWeek)) {
        // Skip to next working day
        result.setDate(result.getDate() + 1);
        result.setHours(config.startHour, 0, 0, 0);
        continue;
      }
      
      // Check if current time is within business hours
      if (hour < config.startHour) {
        // Before business hours - jump to start of business day
        result.setHours(config.startHour, 0, 0, 0);
        continue;
      }
      
      if (hour >= config.endHour) {
        // After business hours - jump to next working day
        result.setDate(result.getDate() + 1);
        result.setHours(config.startHour, 0, 0, 0);
        continue;
      }
      
      // Check if it's a holiday
      const isHoliday = config.holidays.some(holiday => 
        holiday.toDateString() === result.toDateString()
      );
      
      if (isHoliday) {
        // Skip to next day
        result.setDate(result.getDate() + 1);
        result.setHours(config.startHour, 0, 0, 0);
        continue;
      }
      
      // Calculate remaining business minutes in current day
      const endOfDay = new Date(result);
      endOfDay.setHours(config.endHour, 0, 0, 0);
      
      const minutesUntilEndOfDay = Math.floor(
        (endOfDay.getTime() - result.getTime()) / (1000 * 60)
      );
      
      if (remainingMinutes <= minutesUntilEndOfDay) {
        // Can fit remaining time in current day
        result.setTime(result.getTime() + remainingMinutes * 60 * 1000);
        remainingMinutes = 0;
      } else {
        // Use up rest of current day and continue tomorrow
        remainingMinutes -= minutesUntilEndOfDay;
        result.setDate(result.getDate() + 1);
        result.setHours(config.startHour, 0, 0, 0);
      }
    }

    return result;
  }

  /**
   * Get SLA configuration for customer tier and priority
   */
  public getSLAConfiguration(
    customerTier: 'basic' | 'premium' | 'enterprise',
    priority: Priority
  ): SLAConfiguration | null {
    const configKey = `${customerTier}-${priority}`;
    return this.defaultSLAConfigurations.get(configKey) || null;
  }

  /**
   * Get all tickets at risk of SLA breach
   */
  public async getTicketsAtRisk(
    riskThreshold: number = 0.7
  ): Promise<{ ticket: TicketEntity; slaStatus: SLAStatus }[]> {
    try {
      const activeStatuses = [
        TicketStatus.OPEN,
        TicketStatus.IN_PROGRESS,
        TicketStatus.PENDING_CUSTOMER
      ];

      const atRiskTickets: { ticket: TicketEntity; slaStatus: SLAStatus }[] = [];
      
      for (const status of activeStatuses) {
        const tickets = await this.ticketRepository.search({
          filters: { status: [status] },
          limit: 1000
        });

        for (const ticket of tickets.tickets) {
          const slaStatus = this.getSLAStatus(ticket);
          
          if (slaStatus.riskScore >= riskThreshold) {
            atRiskTickets.push({ ticket, slaStatus });
          }
        }
      }

      // Sort by risk score (highest first)
      atRiskTickets.sort((a, b) => b.slaStatus.riskScore - a.slaStatus.riskScore);

      return atRiskTickets;
    } catch (error) {
      logger.error('Failed to get tickets at risk', { error: (error as Error).message });
      throw error;
    }
  }
}