import { BaseEntity } from './BaseEntity';
import { 
  Ticket, 
  TicketStatus, 
  Priority, 
  TicketCategory, 
  Attachment, 
  AIInsights 
} from '../models';
import { validateCreateTicket, validateUpdateTicket } from '../validation';

export class TicketEntity extends BaseEntity implements Ticket {
  public externalId?: string;
  public title: string;
  public description: string;
  public category: TicketCategory;
  public priority: Priority;
  public status: TicketStatus;
  public customerId: string;
  public assignedTechnicianId?: string;
  public slaDeadline: Date;
  public estimatedResolutionTime?: number;
  public actualResolutionTime?: number;
  public tags: string[];
  public attachments: Attachment[];
  public aiInsights?: AIInsights;
  
  // Customer information
  public customerName: string;
  public customerEmail: string;
  public customerTier: 'basic' | 'premium' | 'enterprise';
  
  // Resolution tracking
  public resolutionNotes?: string;
  public resolutionSteps?: string[];
  public resolvedAt?: Date;
  public resolvedBy?: string;
  
  // Time tracking
  public timeSpent: number;
  public billableTime: number;
  
  // Communication
  public lastCustomerResponse?: Date;
  public lastTechnicianResponse?: Date;
  
  // Escalation
  public escalationLevel: number;
  public escalatedAt?: Date;
  public escalatedBy?: string;
  public escalationReason?: string;

  constructor(data?: Partial<Ticket>) {
    super();
    
    // Initialize with defaults
    this.title = '';
    this.description = '';
    this.category = TicketCategory.GENERAL;
    this.priority = Priority.MEDIUM;
    this.status = TicketStatus.OPEN;
    this.customerId = '';
    this.customerName = '';
    this.customerEmail = '';
    this.customerTier = 'basic';
    this.slaDeadline = new Date();
    this.tags = [];
    this.attachments = [];
    this.timeSpent = 0;
    this.billableTime = 0;
    this.escalationLevel = 0;
    
    // Apply provided data
    if (data) {
      Object.assign(this, data);
    }
  }

  /**
   * Calculate SLA deadline based on customer tier and priority
   */
  public calculateSLADeadline(
    responseTimeTarget: number, 
    resolutionTimeTarget: number
  ): void {
    const now = new Date();
    let deadlineMinutes = resolutionTimeTarget;
    
    // Adjust based on priority
    switch (this.priority) {
      case Priority.CRITICAL:
        deadlineMinutes = Math.min(deadlineMinutes, 240); // 4 hours max
        break;
      case Priority.HIGH:
        deadlineMinutes = Math.min(deadlineMinutes, 480); // 8 hours max
        break;
      case Priority.MEDIUM:
        deadlineMinutes = Math.min(deadlineMinutes, 1440); // 24 hours max
        break;
      case Priority.LOW:
        deadlineMinutes = Math.min(deadlineMinutes, 2880); // 48 hours max
        break;
    }
    
    this.slaDeadline = new Date(now.getTime() + deadlineMinutes * 60 * 1000);
  }

  /**
   * Calculate SLA risk score (0-1, where 1 is highest risk)
   */
  public getSLARiskScore(): number {
    const now = new Date();
    const timeRemaining = this.slaDeadline.getTime() - now.getTime();
    const totalSLATime = this.slaDeadline.getTime() - this.createdAt.getTime();
    
    if (timeRemaining <= 0) {
      return 1.0; // Already breached
    }
    
    const timeElapsed = totalSLATime - timeRemaining;
    const progressRatio = timeElapsed / totalSLATime;
    
    // Risk increases exponentially as deadline approaches
    return Math.min(1.0, Math.pow(progressRatio, 2));
  }

  /**
   * Check if ticket is overdue
   */
  public isOverdue(): boolean {
    return new Date() > this.slaDeadline;
  }

  /**
   * Assign ticket to technician
   */
  public assignTo(technicianId: string, assignedBy: string): void {
    this.assignedTechnicianId = technicianId;
    this.status = TicketStatus.IN_PROGRESS;
    this.touch();
    
    // Add to timeline (would be handled by service layer)
  }

  /**
   * Escalate ticket
   */
  public escalate(reason: string, escalatedBy: string): void {
    this.escalationLevel += 1;
    this.escalationReason = reason;
    this.escalatedBy = escalatedBy;
    this.escalatedAt = new Date();
    this.touch();
  }

  /**
   * Resolve ticket
   */
  public resolve(
    resolutionNotes: string, 
    resolutionSteps: string[], 
    resolvedBy: string
  ): void {
    this.status = TicketStatus.RESOLVED;
    this.resolutionNotes = resolutionNotes;
    this.resolutionSteps = resolutionSteps;
    this.resolvedBy = resolvedBy;
    this.resolvedAt = new Date();
    
    // Calculate actual resolution time
    this.actualResolutionTime = Math.floor(
      (this.resolvedAt.getTime() - this.createdAt.getTime()) / (1000 * 60)
    );
    
    this.touch();
  }

  /**
   * Close ticket
   */
  public close(): void {
    this.status = TicketStatus.CLOSED;
    this.touch();
  }

  /**
   * Add time entry
   */
  public addTimeEntry(minutes: number, billable: boolean = true): void {
    this.timeSpent += minutes;
    if (billable) {
      this.billableTime += minutes;
    }
    this.touch();
  }

  /**
   * Update AI insights
   */
  public updateAIInsights(insights: AIInsights): void {
    this.aiInsights = insights;
    this.touch();
  }

  /**
   * Validate ticket data
   */
  public validate(): { isValid: boolean; errors: string[] } {
    const validation = validateCreateTicket({
      title: this.title,
      description: this.description,
      customerId: this.customerId,
      customerName: this.customerName,
      customerEmail: this.customerEmail,
      customerTier: this.customerTier,
      priority: this.priority,
      category: this.category,
      tags: this.tags,
      attachments: this.attachments
    });

    return {
      isValid: !validation.error,
      errors: validation.error ? validation.error.details.map(d => d.message) : []
    };
  }

  /**
   * Get ticket age in hours
   */
  public getAgeInHours(): number {
    const now = new Date();
    return Math.floor((now.getTime() - this.createdAt.getTime()) / (1000 * 60 * 60));
  }

  /**
   * Get time until SLA deadline in hours
   */
  public getTimeToSLAInHours(): number {
    const now = new Date();
    return Math.floor((this.slaDeadline.getTime() - now.getTime()) / (1000 * 60 * 60));
  }

  /**
   * Check if ticket needs attention (high risk or overdue)
   */
  public needsAttention(): boolean {
    return this.isOverdue() || this.getSLARiskScore() > 0.7;
  }
}