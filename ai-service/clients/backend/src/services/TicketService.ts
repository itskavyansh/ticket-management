import { TicketRepository } from '../database/repositories/TicketRepository';
import { TicketEntity } from '../entities/TicketEntity';
import { 
  CreateTicketRequest, 
  UpdateTicketRequest, 
  TicketSearchQuery,
  TicketTimeline 
} from '../models/Ticket';
import { TicketStatus, Priority, TicketCategory } from '../types';
import { validateCreateTicket, validateUpdateTicket, validateTicketSearch } from '../validation/ticketValidation';
import { logger } from '../utils/logger';
import { SLAService, SLAStatus, SLABreachAlert } from './SLAService';

/**
 * Service class for ticket business logic
 */
export class TicketService {
  private ticketRepository: TicketRepository;
  private slaService: SLAService;

  constructor() {
    this.ticketRepository = new TicketRepository();
    this.slaService = new SLAService(this.ticketRepository);
  }

  /**
   * Create a new ticket
   */
  async createTicket(ticketData: CreateTicketRequest): Promise<TicketEntity> {
    // Validate input data
    const validation = validateCreateTicket(ticketData);
    if (validation.error) {
      const errorMessage = validation.error.details.map(d => d.message).join(', ');
      logger.warn('Ticket creation validation failed', {
        errors: errorMessage,
        ticketData: { ...ticketData, description: '[REDACTED]' }
      });
      throw new Error(`Validation failed: ${errorMessage}`);
    }

    try {
      // Check for duplicate external ID if provided
      if (ticketData.externalId) {
        const existingTicket = await this.ticketRepository.getByExternalId(ticketData.externalId);
        if (existingTicket) {
          throw new Error(`Ticket with external ID ${ticketData.externalId} already exists`);
        }
      }

      const ticket = await this.ticketRepository.create(ticketData);
      
      logger.info('Ticket created successfully', {
        ticketId: ticket.id,
        customerId: ticket.customerId,
        priority: ticket.priority,
        category: ticket.category
      });

      return ticket;
    } catch (error) {
      logger.error('Failed to create ticket', {
        error: (error as Error).message,
        ticketData: { ...ticketData, description: '[REDACTED]' }
      });
      throw error;
    }
  }

  /**
   * Get ticket by ID
   */
  async getTicketById(customerId: string, ticketId: string): Promise<TicketEntity | null> {
    try {
      const ticket = await this.ticketRepository.getById(customerId, ticketId);
      
      if (ticket) {
        logger.debug('Ticket retrieved successfully', {
          ticketId,
          customerId,
          status: ticket.status
        });
      }

      return ticket;
    } catch (error) {
      logger.error('Failed to get ticket by ID', {
        customerId,
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get ticket by external ID
   */
  async getTicketByExternalId(externalId: string): Promise<TicketEntity | null> {
    try {
      const ticket = await this.ticketRepository.getByExternalId(externalId);
      
      if (ticket) {
        logger.debug('Ticket retrieved by external ID', {
          ticketId: ticket.id,
          externalId,
          status: ticket.status
        });
      }

      return ticket;
    } catch (error) {
      logger.error('Failed to get ticket by external ID', {
        externalId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update ticket
   */
  async updateTicket(
    customerId: string,
    ticketId: string,
    updates: UpdateTicketRequest,
    updatedBy: string
  ): Promise<TicketEntity | null> {
    // Validate input data
    const validation = validateUpdateTicket(updates);
    if (validation.error) {
      const errorMessage = validation.error.details.map(d => d.message).join(', ');
      logger.warn('Ticket update validation failed', {
        errors: errorMessage,
        ticketId,
        customerId
      });
      throw new Error(`Validation failed: ${errorMessage}`);
    }

    try {
      // Get current ticket to validate state transitions
      const currentTicket = await this.ticketRepository.getById(customerId, ticketId);
      if (!currentTicket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      // Validate status transitions
      if (updates.status && !this.isValidStatusTransition(currentTicket.status, updates.status)) {
        throw new Error(`Invalid status transition from ${currentTicket.status} to ${updates.status}`);
      }

      // Handle special status changes
      if (updates.status === TicketStatus.RESOLVED) {
        if (!updates.resolutionNotes) {
          throw new Error('Resolution notes are required when resolving a ticket');
        }
        // Set resolved timestamp
        updates = {
          ...updates,
          resolvedBy: updatedBy
        };
      }

      const updatedTicket = await this.ticketRepository.update(customerId, ticketId, updates, updatedBy);
      
      if (updatedTicket) {
        logger.info('Ticket updated successfully', {
          ticketId,
          customerId,
          updatedFields: Object.keys(updates),
          updatedBy
        });
      }

      return updatedTicket;
    } catch (error) {
      logger.error('Failed to update ticket', {
        customerId,
        ticketId,
        updates,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Delete ticket
   */
  async deleteTicket(customerId: string, ticketId: string): Promise<void> {
    try {
      // Check if ticket exists
      const ticket = await this.ticketRepository.getById(customerId, ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      // Only allow deletion of tickets in certain states
      const deletableStatuses = [TicketStatus.OPEN, TicketStatus.CANCELLED];
      if (!deletableStatuses.includes(ticket.status)) {
        throw new Error(`Cannot delete ticket in status: ${ticket.status}`);
      }

      await this.ticketRepository.delete(customerId, ticketId);
      
      logger.info('Ticket deleted successfully', {
        ticketId,
        customerId,
        previousStatus: ticket.status
      });
    } catch (error) {
      logger.error('Failed to delete ticket', {
        customerId,
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Search tickets with filters and pagination
   */
  async searchTickets(searchQuery: TicketSearchQuery): Promise<{
    tickets: TicketEntity[];
    totalCount: number;
    hasMore: boolean;
    page: number;
    limit: number;
  }> {
    // Validate search query
    const validation = validateTicketSearch(searchQuery);
    if (validation.error) {
      const errorMessage = validation.error.details.map(d => d.message).join(', ');
      logger.warn('Ticket search validation failed', {
        errors: errorMessage,
        searchQuery
      });
      throw new Error(`Validation failed: ${errorMessage}`);
    }

    try {
      const result = await this.ticketRepository.search(searchQuery);
      
      logger.debug('Ticket search completed', {
        query: searchQuery.query,
        filtersApplied: !!searchQuery.filters,
        resultCount: result.tickets.length,
        hasMore: result.hasMore
      });

      return {
        tickets: result.tickets,
        totalCount: result.totalCount,
        hasMore: result.hasMore,
        page: searchQuery.page || 1,
        limit: searchQuery.limit || 20
      };
    } catch (error) {
      logger.error('Failed to search tickets', {
        searchQuery,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get tickets assigned to a technician
   */
  async getTicketsByTechnician(
    technicianId: string,
    status?: TicketStatus[],
    limit: number = 50
  ): Promise<TicketEntity[]> {
    try {
      const tickets = await this.ticketRepository.getByTechnician(technicianId, status, limit);
      
      logger.debug('Retrieved tickets by technician', {
        technicianId,
        status,
        count: tickets.length
      });

      return tickets;
    } catch (error) {
      logger.error('Failed to get tickets by technician', {
        technicianId,
        status,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get tickets for a customer
   */
  async getTicketsByCustomer(
    customerId: string,
    status?: TicketStatus[],
    limit: number = 50
  ): Promise<TicketEntity[]> {
    try {
      const tickets = await this.ticketRepository.getByCustomer(customerId, status, limit);
      
      logger.debug('Retrieved tickets by customer', {
        customerId,
        status,
        count: tickets.length
      });

      return tickets;
    } catch (error) {
      logger.error('Failed to get tickets by customer', {
        customerId,
        status,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Assign ticket to technician
   */
  async assignTicket(
    customerId: string,
    ticketId: string,
    technicianId: string,
    assignedBy: string
  ): Promise<TicketEntity | null> {
    try {
      // Validate ticket exists and is in assignable state
      const ticket = await this.ticketRepository.getById(customerId, ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      const assignableStatuses = [TicketStatus.OPEN, TicketStatus.IN_PROGRESS];
      if (!assignableStatuses.includes(ticket.status)) {
        throw new Error(`Cannot assign ticket in status: ${ticket.status}`);
      }

      const updatedTicket = await this.ticketRepository.assignTicket(
        customerId,
        ticketId,
        technicianId,
        assignedBy
      );

      if (updatedTicket) {
        logger.info('Ticket assigned successfully', {
          ticketId,
          customerId,
          technicianId,
          assignedBy,
          previousTechnician: ticket.assignedTechnicianId
        });
      }

      return updatedTicket;
    } catch (error) {
      logger.error('Failed to assign ticket', {
        customerId,
        ticketId,
        technicianId,
        assignedBy,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Escalate ticket
   */
  async escalateTicket(
    customerId: string,
    ticketId: string,
    reason: string,
    escalatedBy: string
  ): Promise<TicketEntity | null> {
    try {
      const ticket = await this.ticketRepository.getById(customerId, ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      // Cannot escalate closed or cancelled tickets
      const nonEscalatableStatuses = [TicketStatus.CLOSED, TicketStatus.CANCELLED];
      if (nonEscalatableStatuses.includes(ticket.status)) {
        throw new Error(`Cannot escalate ticket in status: ${ticket.status}`);
      }

      const updatedTicket = await this.ticketRepository.update(
        customerId,
        ticketId,
        {
          escalationLevel: ticket.escalationLevel + 1,
          escalationReason: reason,
          priority: this.getEscalatedPriority(ticket.priority)
        },
        escalatedBy
      );

      if (updatedTicket) {
        logger.info('Ticket escalated successfully', {
          ticketId,
          customerId,
          newEscalationLevel: updatedTicket.escalationLevel,
          reason,
          escalatedBy
        });
      }

      return updatedTicket;
    } catch (error) {
      logger.error('Failed to escalate ticket', {
        customerId,
        ticketId,
        reason,
        escalatedBy,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get ticket timeline
   */
  async getTicketTimeline(ticketId: string): Promise<TicketTimeline[]> {
    try {
      const timeline = await this.ticketRepository.getTimeline(ticketId);
      
      logger.debug('Retrieved ticket timeline', {
        ticketId,
        entryCount: timeline.length
      });

      return timeline;
    } catch (error) {
      logger.error('Failed to get ticket timeline', {
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get tickets that need attention (overdue or high risk)
   */
  async getTicketsNeedingAttention(): Promise<TicketEntity[]> {
    try {
      // Search for open and in-progress tickets
      const searchQuery: TicketSearchQuery = {
        filters: {
          status: [TicketStatus.OPEN, TicketStatus.IN_PROGRESS]
        },
        limit: 100
      };

      const result = await this.ticketRepository.search(searchQuery);
      
      // Filter for tickets that need attention
      const ticketsNeedingAttention = result.tickets.filter(ticket => ticket.needsAttention());

      logger.info('Retrieved tickets needing attention', {
        totalTickets: result.tickets.length,
        needingAttention: ticketsNeedingAttention.length
      });

      return ticketsNeedingAttention;
    } catch (error) {
      logger.error('Failed to get tickets needing attention', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Validate status transition
   */
  private isValidStatusTransition(currentStatus: TicketStatus, newStatus: TicketStatus): boolean {
    const validTransitions: Record<TicketStatus, TicketStatus[]> = {
      [TicketStatus.OPEN]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.PENDING_CUSTOMER,
        TicketStatus.CANCELLED
      ],
      [TicketStatus.IN_PROGRESS]: [
        TicketStatus.OPEN,
        TicketStatus.PENDING_CUSTOMER,
        TicketStatus.RESOLVED,
        TicketStatus.CANCELLED
      ],
      [TicketStatus.PENDING_CUSTOMER]: [
        TicketStatus.IN_PROGRESS,
        TicketStatus.RESOLVED,
        TicketStatus.CANCELLED
      ],
      [TicketStatus.RESOLVED]: [
        TicketStatus.CLOSED,
        TicketStatus.IN_PROGRESS // Reopen if needed
      ],
      [TicketStatus.CLOSED]: [
        TicketStatus.IN_PROGRESS // Reopen if needed
      ],
      [TicketStatus.CANCELLED]: [] // Cannot transition from cancelled
    };

    return validTransitions[currentStatus]?.includes(newStatus) || false;
  }

  /**
   * Get SLA status for a ticket
   */
  async getTicketSLAStatus(customerId: string, ticketId: string): Promise<SLAStatus | null> {
    try {
      const ticket = await this.ticketRepository.getById(customerId, ticketId);
      if (!ticket) {
        return null;
      }

      const slaStatus = this.slaService.getSLAStatus(ticket);
      
      logger.debug('Retrieved ticket SLA status', {
        ticketId,
        customerId,
        riskScore: slaStatus.riskScore,
        riskLevel: slaStatus.riskLevel,
        isOverdue: slaStatus.isOverdue
      });

      return slaStatus;
    } catch (error) {
      logger.error('Failed to get ticket SLA status', {
        customerId,
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Check for SLA breaches across all active tickets
   */
  async checkSLABreaches(
    riskThreshold: number = 0.7,
    criticalThreshold: number = 0.85
  ): Promise<SLABreachAlert[]> {
    try {
      const alerts = await this.slaService.checkSLABreaches(riskThreshold, criticalThreshold);
      
      logger.info('SLA breach check completed', {
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.riskScore >= criticalThreshold).length,
        overdueAlerts: alerts.filter(a => a.minutesOverdue > 0).length,
        riskThreshold,
        criticalThreshold
      });

      return alerts;
    } catch (error) {
      logger.error('Failed to check SLA breaches', {
        riskThreshold,
        criticalThreshold,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get tickets at risk of SLA breach
   */
  async getTicketsAtRisk(riskThreshold: number = 0.7): Promise<{
    ticket: TicketEntity;
    slaStatus: SLAStatus;
  }[]> {
    try {
      const atRiskTickets = await this.slaService.getTicketsAtRisk(riskThreshold);
      
      logger.info('Retrieved tickets at SLA risk', {
        count: atRiskTickets.length,
        riskThreshold
      });

      return atRiskTickets;
    } catch (error) {
      logger.error('Failed to get tickets at risk', {
        riskThreshold,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update ticket SLA deadline
   */
  async updateTicketSLA(
    customerId: string,
    ticketId: string,
    newDeadline: Date,
    reason: string,
    updatedBy: string
  ): Promise<TicketEntity | null> {
    try {
      const updatedTicket = await this.slaService.updateTicketSLA(
        customerId,
        ticketId,
        newDeadline,
        reason,
        updatedBy
      );

      if (updatedTicket) {
        logger.info('Ticket SLA updated successfully', {
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
        newDeadline,
        reason,
        updatedBy,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get SLA metrics for a given period
   */
  async getSLAMetrics(
    startDate: Date,
    endDate: Date,
    customerId?: string,
    technicianId?: string
  ) {
    try {
      const metrics = await this.slaService.getSLAMetrics(
        startDate,
        endDate,
        customerId,
        technicianId
      );

      logger.info('Retrieved SLA metrics', {
        startDate,
        endDate,
        customerId,
        technicianId,
        totalTickets: metrics.totalTickets,
        complianceRate: metrics.complianceRate
      });

      return metrics;
    } catch (error) {
      logger.error('Failed to get SLA metrics', {
        startDate,
        endDate,
        customerId,
        technicianId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Recalculate SLA deadline for a ticket based on current priority and customer tier
   */
  async recalculateTicketSLA(
    customerId: string,
    ticketId: string,
    updatedBy: string,
    reason: string = 'Priority or customer tier changed'
  ): Promise<TicketEntity | null> {
    try {
      const ticket = await this.ticketRepository.getById(customerId, ticketId);
      if (!ticket) {
        throw new Error(`Ticket not found: ${ticketId}`);
      }

      // Calculate new SLA deadline
      const newDeadline = this.slaService.calculateSLADeadline(
        ticket.customerTier,
        ticket.priority,
        ticket.createdAt
      );

      const updatedTicket = await this.slaService.updateTicketSLA(
        customerId,
        ticketId,
        newDeadline,
        reason,
        updatedBy
      );

      if (updatedTicket) {
        logger.info('Ticket SLA recalculated successfully', {
          ticketId,
          customerId,
          oldDeadline: ticket.slaDeadline,
          newDeadline,
          reason,
          updatedBy
        });
      }

      return updatedTicket;
    } catch (error) {
      logger.error('Failed to recalculate ticket SLA', {
        customerId,
        ticketId,
        updatedBy,
        reason,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Generate search facets for advanced filtering UI
   */
  async generateSearchFacets(searchQuery: TicketSearchQuery): Promise<{
    status: Array<{ value: string; count: number }>;
    priority: Array<{ value: string; count: number }>;
    category: Array<{ value: string; count: number }>;
    customerTier: Array<{ value: string; count: number }>;
    escalationLevel: Array<{ value: number; count: number }>;
    tags: Array<{ value: string; count: number }>;
  }> {
    try {
      // Get all tickets matching the base query (without specific filters)
      const baseQuery: TicketSearchQuery = {
        query: searchQuery.query,
        limit: 1000 // Get more results for facet calculation
      };

      const result = await this.ticketRepository.search(baseQuery);
      const tickets = result.tickets;

      // Calculate facets
      const statusCounts = new Map<string, number>();
      const priorityCounts = new Map<string, number>();
      const categoryCounts = new Map<string, number>();
      const tierCounts = new Map<string, number>();
      const escalationCounts = new Map<number, number>();
      const tagCounts = new Map<string, number>();

      tickets.forEach(ticket => {
        // Status facets
        statusCounts.set(ticket.status, (statusCounts.get(ticket.status) || 0) + 1);

        // Priority facets
        priorityCounts.set(ticket.priority, (priorityCounts.get(ticket.priority) || 0) + 1);

        // Category facets
        categoryCounts.set(ticket.category, (categoryCounts.get(ticket.category) || 0) + 1);

        // Customer tier facets
        tierCounts.set(ticket.customerTier, (tierCounts.get(ticket.customerTier) || 0) + 1);

        // Escalation level facets
        escalationCounts.set(ticket.escalationLevel, (escalationCounts.get(ticket.escalationLevel) || 0) + 1);

        // Tag facets
        ticket.tags.forEach(tag => {
          tagCounts.set(tag, (tagCounts.get(tag) || 0) + 1);
        });
      });

      return {
        status: Array.from(statusCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
        priority: Array.from(priorityCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
        category: Array.from(categoryCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
        customerTier: Array.from(tierCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count),
        escalationLevel: Array.from(escalationCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => a.value - b.value),
        tags: Array.from(tagCounts.entries())
          .map(([value, count]) => ({ value, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 20) // Limit to top 20 tags
      };
    } catch (error) {
      logger.error('Failed to generate search facets', {
        searchQuery,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get escalated priority level
   */
  private getEscalatedPriority(currentPriority: Priority): Priority {
    const priorityEscalation: Record<Priority, Priority> = {
      [Priority.LOW]: Priority.MEDIUM,
      [Priority.MEDIUM]: Priority.HIGH,
      [Priority.HIGH]: Priority.CRITICAL,
      [Priority.CRITICAL]: Priority.CRITICAL // Already at highest
    };

    return priorityEscalation[currentPriority] || currentPriority;
  }
}