import { TicketRepository } from '../database/repositories/TicketRepository';
import { TicketEntity } from '../entities/TicketEntity';
import { TicketStatus, Priority } from '../types';
import { logger } from '../utils/logger';
import axios from 'axios';

/**
 * SLA alert configuration
 */
export interface SLAAlertConfig {
  enabled: boolean;
  riskThresholds: {
    medium: number;    // 0.6
    high: number;      // 0.8
    critical: number;  // 0.9
  };
  escalationThresholds: {
    level1: number;    // 0.7
    level2: number;    // 0.85
    level3: number;    // 0.95
  };
  suppressionWindow: number; // minutes to suppress duplicate alerts
  maxAlertsPerHour: number;
  channels: {
    slack: boolean;
    teams: boolean;
    email: boolean;
  };
}

/**
 * SLA alert types
 */
export enum SLAAlertType {
  RISK_DETECTED = 'risk_detected',
  ESCALATION_REQUIRED = 'escalation_required',
  BREACH_IMMINENT = 'breach_imminent',
  BREACH_OCCURRED = 'breach_occurred',
  RESOLUTION_OVERDUE = 'resolution_overdue'
}

/**
 * SLA alert severity levels
 */
export enum SLAAlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * SLA alert interface
 */
export interface SLAAlert {
  id: string;
  ticketId: string;
  customerId: string;
  customerName: string;
  type: SLAAlertType;
  severity: SLAAlertSeverity;
  riskScore: number;
  timeRemaining: number; // minutes
  message: string;
  recommendations: string[];
  createdAt: Date;
  sentAt?: Date;
  channels: string[];
  metadata: {
    priority: Priority;
    status: TicketStatus;
    assignedTechnicianId?: string;
    escalationLevel: number;
    slaDeadline: Date;
    estimatedCompletion?: Date;
  };
}

/**
 * Alert suppression tracking
 */
interface AlertSuppression {
  ticketId: string;
  alertType: SLAAlertType;
  lastSentAt: Date;
  count: number;
}

/**
 * Escalation action interface
 */
export interface EscalationAction {
  ticketId: string;
  fromLevel: number;
  toLevel: number;
  reason: string;
  triggeredBy: 'system' | 'user';
  triggeredAt: Date;
  assignedTo?: string;
  notificationsSent: string[];
}

/**
 * SLA Alerting Service for automated monitoring and escalation
 */
export class SLAAlertingService {
  private ticketRepository: TicketRepository;
  private config: SLAAlertConfig;
  private suppressionMap: Map<string, AlertSuppression>;
  private alertHistory: SLAAlert[];
  private aiServiceUrl: string;

  constructor(ticketRepository?: TicketRepository) {
    this.ticketRepository = ticketRepository || new TicketRepository();
    this.suppressionMap = new Map();
    this.alertHistory = [];
    this.aiServiceUrl = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    
    this.config = {
      enabled: true,
      riskThresholds: {
        medium: 0.6,
        high: 0.8,
        critical: 0.9
      },
      escalationThresholds: {
        level1: 0.7,
        level2: 0.85,
        level3: 0.95
      },
      suppressionWindow: 30, // 30 minutes
      maxAlertsPerHour: 10,
      channels: {
        slack: true,
        teams: true,
        email: true
      }
    };
  }

  /**
   * Main monitoring loop - check all active tickets for SLA risks
   */
  public async monitorSLACompliance(): Promise<SLAAlert[]> {
    if (!this.config.enabled) {
      logger.debug('SLA alerting is disabled');
      return [];
    }

    try {
      logger.info('Starting SLA compliance monitoring cycle');
      
      // Get all active tickets
      const activeTickets = await this.getActiveTickets();
      const alerts: SLAAlert[] = [];
      
      for (const ticket of activeTickets) {
        try {
          // Get SLA prediction from AI service
          const prediction = await this.getSLAPrediction(ticket);
          
          if (prediction) {
            // Check for alert conditions
            const ticketAlerts = await this.evaluateTicketAlerts(ticket, prediction);
            alerts.push(...ticketAlerts);
            
            // Check for escalation needs
            const escalationActions = await this.evaluateEscalation(ticket, prediction);
            
            // Execute escalations
            for (const action of escalationActions) {
              await this.executeEscalation(action);
            }
          }
        } catch (error) {
          logger.error(`Failed to process ticket ${ticket.id} for SLA monitoring`, {
            ticketId: ticket.id,
            error: (error as Error).message
          });
        }
      }
      
      // Send alerts
      for (const alert of alerts) {
        await this.sendAlert(alert);
      }
      
      // Clean up old suppressions
      this.cleanupSuppressions();
      
      logger.info(`SLA monitoring completed - ${alerts.length} alerts generated`);
      return alerts;
      
    } catch (error) {
      logger.error('SLA monitoring cycle failed', { error: (error as Error).message });
      throw error;
    }
  }

  /**
   * Get active tickets that need SLA monitoring
   */
  private async getActiveTickets(): Promise<TicketEntity[]> {
    const activeStatuses = [
      TicketStatus.OPEN,
      TicketStatus.IN_PROGRESS,
      TicketStatus.PENDING_CUSTOMER
    ];

    const allActiveTickets: TicketEntity[] = [];
    
    for (const status of activeStatuses) {
      const result = await this.ticketRepository.search({
        filters: { status: [status] },
        limit: 1000 // Adjust based on your scale
      });
      
      allActiveTickets.push(...result.tickets);
    }

    return allActiveTickets;
  }

  /**
   * Get SLA prediction from AI service
   */
  private async getSLAPrediction(ticket: TicketEntity): Promise<any> {
    try {
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
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        return response.data.result;
      } else {
        logger.warn(`SLA prediction failed for ticket ${ticket.id}`, {
          error: response.data.error
        });
        return null;
      }
    } catch (error) {
      logger.error(`Failed to get SLA prediction for ticket ${ticket.id}`, {
        error: (error as Error).message
      });
      return null;
    }
  }

  /**
   * Evaluate if alerts should be generated for a ticket
   */
  private async evaluateTicketAlerts(ticket: TicketEntity, prediction: any): Promise<SLAAlert[]> {
    const alerts: SLAAlert[] = [];
    const riskScore = prediction.breach_probability;
    const timeRemaining = prediction.time_remaining_minutes;
    
    // Check if we should suppress alerts for this ticket
    if (this.shouldSuppressAlert(ticket.id, SLAAlertType.RISK_DETECTED)) {
      return alerts;
    }

    // Risk level alerts
    if (riskScore >= this.config.riskThresholds.critical) {
      alerts.push(this.createAlert(
        ticket,
        SLAAlertType.BREACH_IMMINENT,
        SLAAlertSeverity.CRITICAL,
        riskScore,
        timeRemaining,
        `CRITICAL: SLA breach imminent for ticket ${ticket.id}`,
        prediction.recommended_actions || []
      ));
    } else if (riskScore >= this.config.riskThresholds.high) {
      alerts.push(this.createAlert(
        ticket,
        SLAAlertType.RISK_DETECTED,
        SLAAlertSeverity.ERROR,
        riskScore,
        timeRemaining,
        `HIGH RISK: SLA breach likely for ticket ${ticket.id}`,
        prediction.recommended_actions || []
      ));
    } else if (riskScore >= this.config.riskThresholds.medium) {
      alerts.push(this.createAlert(
        ticket,
        SLAAlertType.RISK_DETECTED,
        SLAAlertSeverity.WARNING,
        riskScore,
        timeRemaining,
        `MEDIUM RISK: SLA compliance at risk for ticket ${ticket.id}`,
        prediction.recommended_actions || []
      ));
    }

    // Time-based alerts
    if (timeRemaining <= 0) {
      alerts.push(this.createAlert(
        ticket,
        SLAAlertType.BREACH_OCCURRED,
        SLAAlertSeverity.CRITICAL,
        riskScore,
        timeRemaining,
        `SLA BREACH: Ticket ${ticket.id} has exceeded its SLA deadline`,
        ['Immediate escalation required', 'Notify customer of delay']
      ));
    } else if (timeRemaining <= 30 && ticket.priority === Priority.CRITICAL) {
      alerts.push(this.createAlert(
        ticket,
        SLAAlertType.BREACH_IMMINENT,
        SLAAlertSeverity.ERROR,
        riskScore,
        timeRemaining,
        `URGENT: Critical ticket ${ticket.id} has only ${timeRemaining} minutes remaining`,
        ['Focus all resources on this ticket', 'Consider emergency escalation']
      ));
    }

    return alerts;
  }

  /**
   * Evaluate if escalation is needed for a ticket
   */
  private async evaluateEscalation(ticket: TicketEntity, prediction: any): Promise<EscalationAction[]> {
    const actions: EscalationAction[] = [];
    const riskScore = prediction.breach_probability;
    const currentLevel = ticket.escalationLevel;

    // Level 1 escalation
    if (riskScore >= this.config.escalationThresholds.level1 && currentLevel === 0) {
      actions.push({
        ticketId: ticket.id,
        fromLevel: 0,
        toLevel: 1,
        reason: `Risk score ${riskScore.toFixed(2)} exceeds level 1 threshold`,
        triggeredBy: 'system',
        triggeredAt: new Date(),
        notificationsSent: []
      });
    }

    // Level 2 escalation
    if (riskScore >= this.config.escalationThresholds.level2 && currentLevel <= 1) {
      actions.push({
        ticketId: ticket.id,
        fromLevel: currentLevel,
        toLevel: 2,
        reason: `Risk score ${riskScore.toFixed(2)} exceeds level 2 threshold`,
        triggeredBy: 'system',
        triggeredAt: new Date(),
        notificationsSent: []
      });
    }

    // Level 3 escalation (emergency)
    if (riskScore >= this.config.escalationThresholds.level3 && currentLevel <= 2) {
      actions.push({
        ticketId: ticket.id,
        fromLevel: currentLevel,
        toLevel: 3,
        reason: `EMERGENCY: Risk score ${riskScore.toFixed(2)} exceeds level 3 threshold`,
        triggeredBy: 'system',
        triggeredAt: new Date(),
        notificationsSent: []
      });
    }

    return actions;
  }

  /**
   * Execute escalation action
   */
  private async executeEscalation(action: EscalationAction): Promise<void> {
    try {
      logger.info(`Executing escalation for ticket ${action.ticketId}`, {
        fromLevel: action.fromLevel,
        toLevel: action.toLevel,
        reason: action.reason
      });

      // Update ticket escalation level
      await this.ticketRepository.update(
        '', // customerId will be resolved by repository
        action.ticketId,
        {
          escalationLevel: action.toLevel,
          escalationReason: action.reason
        },
        'system'
      );

      // Create escalation alert
      const escalationAlert = this.createEscalationAlert(action);
      await this.sendAlert(escalationAlert);

      logger.info(`Escalation completed for ticket ${action.ticketId}`);

    } catch (error) {
      logger.error(`Failed to execute escalation for ticket ${action.ticketId}`, {
        error: (error as Error).message,
        action
      });
    }
  }

  /**
   * Create an SLA alert
   */
  private createAlert(
    ticket: TicketEntity,
    type: SLAAlertType,
    severity: SLAAlertSeverity,
    riskScore: number,
    timeRemaining: number,
    message: string,
    recommendations: string[]
  ): SLAAlert {
    return {
      id: `alert_${ticket.id}_${Date.now()}`,
      ticketId: ticket.id,
      customerId: ticket.customerId,
      customerName: ticket.customerName,
      type,
      severity,
      riskScore,
      timeRemaining,
      message,
      recommendations,
      createdAt: new Date(),
      channels: this.getAlertChannels(severity),
      metadata: {
        priority: ticket.priority,
        status: ticket.status,
        assignedTechnicianId: ticket.assignedTechnicianId,
        escalationLevel: ticket.escalationLevel,
        slaDeadline: ticket.slaDeadline
      }
    };
  }

  /**
   * Create escalation alert
   */
  private createEscalationAlert(action: EscalationAction): SLAAlert {
    return {
      id: `escalation_${action.ticketId}_${Date.now()}`,
      ticketId: action.ticketId,
      customerId: '', // Will be populated when sending
      customerName: '', // Will be populated when sending
      type: SLAAlertType.ESCALATION_REQUIRED,
      severity: action.toLevel >= 3 ? SLAAlertSeverity.CRITICAL : SLAAlertSeverity.ERROR,
      riskScore: 1.0,
      timeRemaining: 0,
      message: `Ticket ${action.ticketId} escalated to level ${action.toLevel}: ${action.reason}`,
      recommendations: [
        'Review ticket immediately',
        'Assign senior technician if needed',
        'Update customer with status'
      ],
      createdAt: new Date(),
      channels: this.getAlertChannels(action.toLevel >= 3 ? SLAAlertSeverity.CRITICAL : SLAAlertSeverity.ERROR),
      metadata: {
        priority: Priority.CRITICAL, // Escalated tickets are treated as critical
        status: TicketStatus.IN_PROGRESS,
        escalationLevel: action.toLevel,
        slaDeadline: new Date() // Will be updated with actual deadline
      }
    };
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: SLAAlert): Promise<void> {
    try {
      // Check rate limiting
      if (!this.checkRateLimit()) {
        logger.warn('Alert rate limit exceeded, skipping alert', { alertId: alert.id });
        return;
      }

      // Record suppression
      this.recordAlertSent(alert.ticketId, alert.type);

      // Send to each configured channel
      const sendPromises: Promise<void>[] = [];

      if (this.config.channels.slack && alert.channels.includes('slack')) {
        sendPromises.push(this.sendSlackAlert(alert));
      }

      if (this.config.channels.teams && alert.channels.includes('teams')) {
        sendPromises.push(this.sendTeamsAlert(alert));
      }

      if (this.config.channels.email && alert.channels.includes('email')) {
        sendPromises.push(this.sendEmailAlert(alert));
      }

      await Promise.allSettled(sendPromises);

      alert.sentAt = new Date();
      this.alertHistory.push(alert);

      logger.info(`Alert sent successfully`, {
        alertId: alert.id,
        ticketId: alert.ticketId,
        type: alert.type,
        severity: alert.severity,
        channels: alert.channels
      });

    } catch (error) {
      logger.error(`Failed to send alert`, {
        alertId: alert.id,
        error: (error as Error).message
      });
    }
  }

  /**
   * Send Slack alert
   */
  private async sendSlackAlert(alert: SLAAlert): Promise<void> {
    // Implementation would integrate with Slack API
    // For now, just log the alert
    logger.info('Slack alert would be sent', {
      alert: {
        ticketId: alert.ticketId,
        message: alert.message,
        severity: alert.severity
      }
    });
  }

  /**
   * Send Teams alert
   */
  private async sendTeamsAlert(alert: SLAAlert): Promise<void> {
    // Implementation would integrate with Teams API
    // For now, just log the alert
    logger.info('Teams alert would be sent', {
      alert: {
        ticketId: alert.ticketId,
        message: alert.message,
        severity: alert.severity
      }
    });
  }

  /**
   * Send email alert
   */
  private async sendEmailAlert(alert: SLAAlert): Promise<void> {
    // Implementation would integrate with email service
    // For now, just log the alert
    logger.info('Email alert would be sent', {
      alert: {
        ticketId: alert.ticketId,
        message: alert.message,
        severity: alert.severity
      }
    });
  }

  /**
   * Get alert channels based on severity
   */
  private getAlertChannels(severity: SLAAlertSeverity): string[] {
    const channels: string[] = [];

    switch (severity) {
      case SLAAlertSeverity.CRITICAL:
        channels.push('slack', 'teams', 'email');
        break;
      case SLAAlertSeverity.ERROR:
        channels.push('slack', 'teams');
        break;
      case SLAAlertSeverity.WARNING:
        channels.push('slack');
        break;
      case SLAAlertSeverity.INFO:
        channels.push('slack');
        break;
    }

    return channels;
  }

  /**
   * Check if alert should be suppressed
   */
  private shouldSuppressAlert(ticketId: string, alertType: SLAAlertType): boolean {
    const key = `${ticketId}_${alertType}`;
    const suppression = this.suppressionMap.get(key);

    if (!suppression) {
      return false;
    }

    const now = new Date();
    const timeSinceLastAlert = now.getTime() - suppression.lastSentAt.getTime();
    const suppressionWindowMs = this.config.suppressionWindow * 60 * 1000;

    return timeSinceLastAlert < suppressionWindowMs;
  }

  /**
   * Record that an alert was sent
   */
  private recordAlertSent(ticketId: string, alertType: SLAAlertType): void {
    const key = `${ticketId}_${alertType}`;
    const existing = this.suppressionMap.get(key);

    if (existing) {
      existing.lastSentAt = new Date();
      existing.count++;
    } else {
      this.suppressionMap.set(key, {
        ticketId,
        alertType,
        lastSentAt: new Date(),
        count: 1
      });
    }
  }

  /**
   * Check rate limiting
   */
  private checkRateLimit(): boolean {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    
    const recentAlerts = this.alertHistory.filter(
      alert => alert.sentAt && alert.sentAt > oneHourAgo
    );

    return recentAlerts.length < this.config.maxAlertsPerHour;
  }

  /**
   * Clean up old suppressions
   */
  private cleanupSuppressions(): void {
    const now = new Date();
    const cleanupThreshold = 24 * 60 * 60 * 1000; // 24 hours

    for (const [key, suppression] of this.suppressionMap.entries()) {
      const age = now.getTime() - suppression.lastSentAt.getTime();
      if (age > cleanupThreshold) {
        this.suppressionMap.delete(key);
      }
    }
  }

  /**
   * Get alert history
   */
  public getAlertHistory(
    ticketId?: string,
    startDate?: Date,
    endDate?: Date,
    severity?: SLAAlertSeverity
  ): SLAAlert[] {
    let filtered = this.alertHistory;

    if (ticketId) {
      filtered = filtered.filter(alert => alert.ticketId === ticketId);
    }

    if (startDate) {
      filtered = filtered.filter(alert => alert.createdAt >= startDate);
    }

    if (endDate) {
      filtered = filtered.filter(alert => alert.createdAt <= endDate);
    }

    if (severity) {
      filtered = filtered.filter(alert => alert.severity === severity);
    }

    return filtered.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  /**
   * Update alert configuration
   */
  public updateConfig(newConfig: Partial<SLAAlertConfig>): void {
    this.config = { ...this.config, ...newConfig };
    logger.info('SLA alerting configuration updated', { config: this.config });
  }

  /**
   * Get current configuration
   */
  public getConfig(): SLAAlertConfig {
    return { ...this.config };
  }
}