import { Request, Response } from 'express';
import { TicketService } from '../services/TicketService';
import { 
  CreateTicketRequest, 
  UpdateTicketRequest, 
  TicketSearchQuery 
} from '../models/Ticket';
import { TicketStatus } from '../types';
import { logger } from '../utils/logger';

/**
 * Controller for ticket-related HTTP endpoints
 */
export class TicketController {
  private ticketService: TicketService;

  constructor() {
    this.ticketService = new TicketService();
  }

  /**
   * Create a new ticket
   * POST /api/tickets
   */
  createTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const ticketData: CreateTicketRequest = req.body;
      
      // Add user context if available
      const userId = (req as any).user?.id;
      if (userId) {
        logger.debug('Creating ticket', { userId, customerId: ticketData.customerId });
      }

      const ticket = await this.ticketService.createTicket(ticketData);

      res.status(201).json({
        success: true,
        data: ticket,
        message: 'Ticket created successfully'
      });
    } catch (error) {
      logger.error('Failed to create ticket', {
        error: error.message,
        body: req.body
      });

      if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message
        });
      } else if (error.message.includes('already exists')) {
        res.status(409).json({
          success: false,
          error: 'Conflict',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to create ticket'
        });
      }
    }
  };

  /**
   * Get ticket by ID
   * GET /api/tickets/:customerId/:ticketId
   */
  getTicketById = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      const ticket = await this.ticketService.getTicketById(customerId, ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket
      });
    } catch (error) {
      logger.error('Failed to get ticket by ID', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve ticket'
      });
    }
  };

  /**
   * Get ticket by external ID
   * GET /api/tickets/external/:externalId
   */
  getTicketByExternalId = async (req: Request, res: Response): Promise<void> => {
    try {
      const { externalId } = req.params;

      if (!externalId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'External ID is required'
        });
        return;
      }

      const ticket = await this.ticketService.getTicketByExternalId(externalId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket
      });
    } catch (error) {
      logger.error('Failed to get ticket by external ID', {
        externalId: req.params.externalId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve ticket'
      });
    }
  };

  /**
   * Update ticket
   * PUT /api/tickets/:customerId/:ticketId
   */
  updateTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;
      const updates: UpdateTicketRequest = req.body;
      const updatedBy = (req as any).user?.id || 'system';
      const useAIMonitoring = req.query.aiMonitoring === 'true';

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      let ticket;
      if (useAIMonitoring) {
        ticket = await this.ticketService.updateTicketWithAIMonitoring(customerId, ticketId, updates, updatedBy);
      } else {
        ticket = await this.ticketService.updateTicket(customerId, ticketId, updates, updatedBy);
      }

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket,
        message: 'Ticket updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update ticket', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        error: error.message
      });

      if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message
        });
      } else if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message
        });
      } else if (error.message.includes('Invalid status transition') || error.message.includes('Cannot')) {
        res.status(422).json({
          success: false,
          error: 'Unprocessable Entity',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to update ticket'
        });
      }
    }
  };

  /**
   * Delete ticket
   * DELETE /api/tickets/:customerId/:ticketId
   */
  deleteTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      await this.ticketService.deleteTicket(customerId, ticketId);

      res.json({
        success: true,
        message: 'Ticket deleted successfully'
      });
    } catch (error) {
      logger.error('Failed to delete ticket', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        error: error.message
      });

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message
        });
      } else if (error.message.includes('Cannot delete')) {
        res.status(422).json({
          success: false,
          error: 'Unprocessable Entity',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to delete ticket'
        });
      }
    }
  };

  /**
   * Search tickets with enhanced filters and pagination
   * GET /api/tickets/search
   */
  searchTickets = async (req: Request, res: Response): Promise<void> => {
    try {
      const searchQuery: TicketSearchQuery = {
        query: req.query.q as string,
        filters: this.parseFilters(req.query),
        sortBy: req.query.sortBy as any || 'createdAt',
        sortOrder: req.query.sortOrder as any || 'desc',
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        includeResolved: req.query.includeResolved === 'true',
        includeClosed: req.query.includeClosed === 'true'
      };

      const result = await this.ticketService.searchTickets(searchQuery);

      // Calculate additional metadata for the response
      const metadata = {
        searchQuery: searchQuery.query || null,
        filtersApplied: searchQuery.filters ? Object.keys(searchQuery.filters).length : 0,
        sortBy: searchQuery.sortBy,
        sortOrder: searchQuery.sortOrder,
        includeResolved: searchQuery.includeResolved,
        includeClosed: searchQuery.includeClosed
      };

      res.json({
        success: true,
        data: result.tickets,
        pagination: {
          page: result.page,
          limit: result.limit,
          totalCount: result.totalCount,
          hasMore: result.hasMore,
          totalPages: Math.ceil(result.totalCount / result.limit)
        },
        metadata
      });
    } catch (error) {
      logger.error('Failed to search tickets', {
        query: req.query,
        error: error.message
      });

      if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message,
          details: error.message.includes('Maximum results exceeded') ? 
            'Please use more specific filters or reduce page/limit values' : undefined
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to search tickets'
        });
      }
    }
  };

  /**
   * Get tickets by technician
   * GET /api/tickets/technician/:technicianId
   */
  getTicketsByTechnician = async (req: Request, res: Response): Promise<void> => {
    try {
      const { technicianId } = req.params;
      const status = req.query.status ? (req.query.status as string).split(',') as TicketStatus[] : undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!technicianId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Technician ID is required'
        });
        return;
      }

      const tickets = await this.ticketService.getTicketsByTechnician(technicianId, status, limit);

      res.json({
        success: true,
        data: tickets,
        count: tickets.length
      });
    } catch (error) {
      logger.error('Failed to get tickets by technician', {
        technicianId: req.params.technicianId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve tickets'
      });
    }
  };

  /**
   * Get tickets by customer
   * GET /api/tickets/customer/:customerId
   */
  getTicketsByCustomer = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId } = req.params;
      const status = req.query.status ? (req.query.status as string).split(',') as TicketStatus[] : undefined;
      const limit = parseInt(req.query.limit as string) || 50;

      if (!customerId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID is required'
        });
        return;
      }

      const tickets = await this.ticketService.getTicketsByCustomer(customerId, status, limit);

      res.json({
        success: true,
        data: tickets,
        count: tickets.length
      });
    } catch (error) {
      logger.error('Failed to get tickets by customer', {
        customerId: req.params.customerId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve tickets'
      });
    }
  };

  /**
   * Assign ticket to technician
   * POST /api/tickets/:customerId/:ticketId/assign
   */
  assignTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;
      const { technicianId } = req.body;
      const assignedBy = (req as any).user?.id || 'system';

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      if (!technicianId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Technician ID is required'
        });
        return;
      }

      const ticket = await this.ticketService.assignTicket(customerId, ticketId, technicianId, assignedBy);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket,
        message: 'Ticket assigned successfully'
      });
    } catch (error) {
      logger.error('Failed to assign ticket', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        technicianId: req.body.technicianId,
        error: error.message
      });

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message
        });
      } else if (error.message.includes('Cannot assign')) {
        res.status(422).json({
          success: false,
          error: 'Unprocessable Entity',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to assign ticket'
        });
      }
    }
  };

  /**
   * Escalate ticket
   * POST /api/tickets/:customerId/:ticketId/escalate
   */
  escalateTicket = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;
      const { reason } = req.body;
      const escalatedBy = (req as any).user?.id || 'system';

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      if (!reason) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Escalation reason is required'
        });
        return;
      }

      const ticket = await this.ticketService.escalateTicket(customerId, ticketId, reason, escalatedBy);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket,
        message: 'Ticket escalated successfully'
      });
    } catch (error) {
      logger.error('Failed to escalate ticket', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        reason: req.body.reason,
        error: error.message
      });

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message
        });
      } else if (error.message.includes('Cannot escalate')) {
        res.status(422).json({
          success: false,
          error: 'Unprocessable Entity',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to escalate ticket'
        });
      }
    }
  };

  /**
   * Get ticket timeline
   * GET /api/tickets/:customerId/:ticketId/timeline
   */
  getTicketTimeline = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ticketId } = req.params;

      if (!ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Ticket ID is required'
        });
        return;
      }

      const timeline = await this.ticketService.getTicketTimeline(ticketId);

      res.json({
        success: true,
        data: timeline
      });
    } catch (error) {
      logger.error('Failed to get ticket timeline', {
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve ticket timeline'
      });
    }
  };

  /**
   * Get tickets needing attention
   * GET /api/tickets/attention
   */
  getTicketsNeedingAttention = async (req: Request, res: Response): Promise<void> => {
    try {
      const tickets = await this.ticketService.getTicketsNeedingAttention();

      res.json({
        success: true,
        data: tickets,
        count: tickets.length
      });
    } catch (error) {
      logger.error('Failed to get tickets needing attention', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve tickets needing attention'
      });
    }
  };

  /**
   * Get SLA status for a ticket
   * GET /api/tickets/:customerId/:ticketId/sla
   */
  getTicketSLAStatus = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      const slaStatus = await this.ticketService.getTicketSLAStatus(customerId, ticketId);

      if (!slaStatus) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: slaStatus
      });
    } catch (error) {
      logger.error('Failed to get ticket SLA status', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve SLA status'
      });
    }
  };

  /**
   * Check for SLA breaches
   * GET /api/tickets/sla/breaches?riskThreshold=0.7&criticalThreshold=0.85
   */
  checkSLABreaches = async (req: Request, res: Response): Promise<void> => {
    try {
      const riskThreshold = parseFloat(req.query.riskThreshold as string) || 0.7;
      const criticalThreshold = parseFloat(req.query.criticalThreshold as string) || 0.85;

      if (riskThreshold < 0 || riskThreshold > 1 || criticalThreshold < 0 || criticalThreshold > 1) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Risk thresholds must be between 0 and 1'
        });
        return;
      }

      const alerts = await this.ticketService.checkSLABreaches(riskThreshold, criticalThreshold);

      res.json({
        success: true,
        data: alerts,
        count: alerts.length,
        summary: {
          totalAlerts: alerts.length,
          criticalAlerts: alerts.filter(a => a.riskScore >= criticalThreshold).length,
          overdueAlerts: alerts.filter(a => a.minutesOverdue > 0).length
        }
      });
    } catch (error) {
      logger.error('Failed to check SLA breaches', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to check SLA breaches'
      });
    }
  };

  /**
   * Get tickets at risk of SLA breach
   * GET /api/tickets/sla/at-risk?riskThreshold=0.7
   */
  getTicketsAtRisk = async (req: Request, res: Response): Promise<void> => {
    try {
      const riskThreshold = parseFloat(req.query.riskThreshold as string) || 0.7;

      if (riskThreshold < 0 || riskThreshold > 1) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Risk threshold must be between 0 and 1'
        });
        return;
      }

      const atRiskTickets = await this.ticketService.getTicketsAtRisk(riskThreshold);

      res.json({
        success: true,
        data: atRiskTickets,
        count: atRiskTickets.length
      });
    } catch (error) {
      logger.error('Failed to get tickets at risk', {
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve tickets at risk'
      });
    }
  };

  /**
   * Update ticket SLA deadline
   * PUT /api/tickets/:customerId/:ticketId/sla
   */
  updateTicketSLA = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;
      const { newDeadline, reason } = req.body;
      const updatedBy = (req as any).user?.id || 'system';

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      if (!newDeadline || !reason) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'New deadline and reason are required'
        });
        return;
      }

      const deadline = new Date(newDeadline);
      if (isNaN(deadline.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid deadline format'
        });
        return;
      }

      const ticket = await this.ticketService.updateTicketSLA(
        customerId,
        ticketId,
        deadline,
        reason,
        updatedBy
      );

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket,
        message: 'SLA deadline updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update ticket SLA', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to update SLA deadline'
      });
    }
  };

  /**
   * Advanced search with faceted results and aggregations
   * GET /api/tickets/search/advanced
   */
  advancedSearchTickets = async (req: Request, res: Response): Promise<void> => {
    try {
      const searchQuery: TicketSearchQuery = {
        query: req.query.q as string,
        filters: this.parseFilters(req.query),
        sortBy: req.query.sortBy as any || 'createdAt',
        sortOrder: req.query.sortOrder as any || 'desc',
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
        includeResolved: req.query.includeResolved === 'true',
        includeClosed: req.query.includeClosed === 'true'
      };

      const result = await this.ticketService.searchTickets(searchQuery);
      
      // Generate faceted results for filtering UI
      const facets = await this.ticketService.generateSearchFacets(searchQuery);

      res.json({
        success: true,
        data: result.tickets,
        pagination: {
          page: result.page,
          limit: result.limit,
          totalCount: result.totalCount,
          hasMore: result.hasMore,
          totalPages: Math.ceil(result.totalCount / result.limit)
        },
        facets,
        metadata: {
          searchQuery: searchQuery.query || null,
          filtersApplied: searchQuery.filters ? Object.keys(searchQuery.filters).length : 0,
          sortBy: searchQuery.sortBy,
          sortOrder: searchQuery.sortOrder
        }
      });
    } catch (error) {
      logger.error('Failed to perform advanced search', {
        query: req.query,
        error: error.message
      });

      if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          error: 'Validation Error',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to perform advanced search'
        });
      }
    }
  };

  /**
   * Get SLA metrics
   * GET /api/tickets/sla/metrics?startDate=2024-01-01&endDate=2024-01-31&customerId=123&technicianId=456
   */
  getSLAMetrics = async (req: Request, res: Response): Promise<void> => {
    try {
      const { startDate, endDate, customerId, technicianId } = req.query;

      if (!startDate || !endDate) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Start date and end date are required'
        });
        return;
      }

      const start = new Date(startDate as string);
      const end = new Date(endDate as string);

      if (isNaN(start.getTime()) || isNaN(end.getTime())) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Invalid date format'
        });
        return;
      }

      if (start >= end) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Start date must be before end date'
        });
        return;
      }

      const metrics = await this.ticketService.getSLAMetrics(
        start,
        end,
        customerId as string,
        technicianId as string
      );

      res.json({
        success: true,
        data: metrics,
        period: {
          startDate: start,
          endDate: end
        }
      });
    } catch (error) {
      logger.error('Failed to get SLA metrics', {
        query: req.query,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve SLA metrics'
      });
    }
  };

  /**
   * Recalculate ticket SLA deadline
   * POST /api/tickets/:customerId/:ticketId/sla/recalculate
   */
  recalculateTicketSLA = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;
      const { reason } = req.body;
      const updatedBy = (req as any).user?.id || 'system';

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      const ticket = await this.ticketService.recalculateTicketSLA(
        customerId,
        ticketId,
        updatedBy,
        reason || 'Manual SLA recalculation'
      );

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket,
        message: 'SLA deadline recalculated successfully'
      });
    } catch (error) {
      logger.error('Failed to recalculate ticket SLA', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to recalculate SLA deadline'
      });
    }
  };

  /**
   * Get AI-powered resolution suggestions for a ticket
   * GET /api/tickets/:customerId/:ticketId/resolution-suggestions
   */
  getResolutionSuggestions = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      const suggestions = await this.ticketService.getResolutionSuggestions(customerId, ticketId);

      if (!suggestions.success) {
        if (suggestions.error === 'Ticket not found') {
          res.status(404).json({
            success: false,
            error: 'Not Found',
            message: 'Ticket not found'
          });
          return;
        }

        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: suggestions.error || 'Failed to get resolution suggestions'
        });
        return;
      }

      res.json({
        success: true,
        data: {
          suggestions: suggestions.suggestions || [],
          similar_tickets: suggestions.similar_tickets || []
        },
        metadata: {
          suggestions_count: suggestions.suggestions?.length || 0,
          similar_tickets_count: suggestions.similar_tickets?.length || 0
        }
      });
    } catch (error) {
      logger.error('Failed to get resolution suggestions', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Internal Server Error',
        message: 'Failed to retrieve resolution suggestions'
      });
    }
  };

  /**
   * Get AI-powered assignment recommendations for a ticket
   * GET /api/tickets/:customerId/:ticketId/assignment-recommendations?technicians=id1,id2,id3
   */
  getAssignmentRecommendations = async (req: Request, res: Response): Promise<void> => {
    try {
      const { customerId, ticketId } = req.params;
      const technicianIds = req.query.technicians as string;

      if (!customerId || !ticketId) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Customer ID and Ticket ID are required'
        });
        return;
      }

      if (!technicianIds) {
        res.status(400).json({
          success: false,
          error: 'Bad Request',
          message: 'Available technician IDs are required'
        });
        return;
      }

      const availableTechnicianIds = technicianIds.split(',').map(id => id.trim());

      const recommendations = await this.ticketService.getAssignmentRecommendations(
        customerId,
        ticketId,
        availableTechnicianIds
      );

      res.json({
        success: true,
        data: recommendations,
        metadata: {
          available_technicians: availableTechnicianIds.length,
          primary_confidence: recommendations.primary_recommendation.confidence_score,
          alternatives_count: recommendations.alternative_recommendations.length
        }
      });
    } catch (error) {
      logger.error('Failed to get assignment recommendations', {
        customerId: req.params.customerId,
        ticketId: req.params.ticketId,
        error: error.message
      });

      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          error: 'Not Found',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Internal Server Error',
          message: 'Failed to retrieve assignment recommendations'
        });
      }
    }
  };

  /**
   * Parse query filters from request with enhanced parameter support
   */
  private parseFilters(query: any): any {
    const filters: any = {};

    // Array-based filters
    if (query.status) {
      filters.status = Array.isArray(query.status) ? query.status : [query.status];
    }

    if (query.priority) {
      filters.priority = Array.isArray(query.priority) ? query.priority : [query.priority];
    }

    if (query.category) {
      filters.category = Array.isArray(query.category) ? query.category : [query.category];
    }

    if (query.customerTier) {
      filters.customerTier = Array.isArray(query.customerTier) ? query.customerTier : [query.customerTier];
    }

    if (query.tags) {
      filters.tags = Array.isArray(query.tags) ? query.tags : [query.tags];
    }

    if (query.escalationLevel) {
      filters.escalationLevel = Array.isArray(query.escalationLevel) 
        ? query.escalationLevel.map(Number) 
        : [Number(query.escalationLevel)];
    }

    // Single value filters
    if (query.assignedTechnicianId) {
      filters.assignedTechnicianId = query.assignedTechnicianId;
    }

    if (query.customerId) {
      filters.customerId = query.customerId;
    }

    if (query.slaRisk) {
      filters.slaRisk = query.slaRisk;
    }

    // Date range filters
    if (query.createdAfter) {
      const date = new Date(query.createdAfter);
      if (!isNaN(date.getTime())) {
        filters.createdAfter = date;
      }
    }

    if (query.createdBefore) {
      const date = new Date(query.createdBefore);
      if (!isNaN(date.getTime())) {
        filters.createdBefore = date;
      }
    }

    if (query.updatedAfter) {
      const date = new Date(query.updatedAfter);
      if (!isNaN(date.getTime())) {
        filters.updatedAfter = date;
      }
    }

    if (query.updatedBefore) {
      const date = new Date(query.updatedBefore);
      if (!isNaN(date.getTime())) {
        filters.updatedBefore = date;
      }
    }

    // Boolean filters
    if (query.hasAttachments !== undefined) {
      filters.hasAttachments = query.hasAttachments === 'true' || query.hasAttachments === true;
    }

    if (query.isOverdue !== undefined) {
      filters.isOverdue = query.isOverdue === 'true' || query.isOverdue === true;
    }

    // Numeric range filters
    if (query.timeSpentMin !== undefined) {
      const value = parseInt(query.timeSpentMin);
      if (!isNaN(value) && value >= 0) {
        filters.timeSpentMin = value;
      }
    }

    if (query.timeSpentMax !== undefined) {
      const value = parseInt(query.timeSpentMax);
      if (!isNaN(value) && value >= 0) {
        filters.timeSpentMax = value;
      }
    }

    if (query.resolutionTimeMin !== undefined) {
      const value = parseInt(query.resolutionTimeMin);
      if (!isNaN(value) && value >= 0) {
        filters.resolutionTimeMin = value;
      }
    }

    if (query.resolutionTimeMax !== undefined) {
      const value = parseInt(query.resolutionTimeMax);
      if (!isNaN(value) && value >= 0) {
        filters.resolutionTimeMax = value;
      }
    }

    return Object.keys(filters).length > 0 ? filters : undefined;
  }
}  /*
*
   * Get SLA prediction for a ticket (simplified route)
   * GET /api/tickets/:ticketId/sla-prediction
   */
  getSLAPrediction = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ticketId } = req.params;

      if (!ticketId) {
        res.status(400).json({
          success: false,
          error: 'Ticket ID is required'
        });
        return;
      }

      // Get ticket first to extract customer ID
      const ticket = await this.ticketService.getTicketByExternalId(ticketId) || 
                    await this.ticketService.getTicketById('default', ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
        return;
      }

      // Get SLA prediction from AI service
      const prediction = await this.ticketService.getSLAPrediction(ticket);

      res.json(prediction);
    } catch (error) {
      logger.error('Failed to get SLA prediction', {
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get SLA prediction',
        message: error.message
      });
    }
  };

  /**
   * Assign ticket to technician (simplified route)
   * PUT /api/tickets/:ticketId/assign
   */
  assignTicketSimple = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ticketId } = req.params;
      const { technicianId, assignedBy } = req.body;

      if (!ticketId || !technicianId || !assignedBy) {
        res.status(400).json({
          success: false,
          error: 'Ticket ID, technician ID, and assignedBy are required'
        });
        return;
      }

      // Get ticket first to extract customer ID
      const ticket = await this.ticketService.getTicketByExternalId(ticketId) || 
                    await this.ticketService.getTicketById('default', ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
        return;
      }

      const updatedTicket = await this.ticketService.assignTicket(
        ticket.customerId,
        ticketId,
        technicianId,
        assignedBy
      );

      if (!updatedTicket) {
        res.status(404).json({
          success: false,
          error: 'Failed to assign ticket'
        });
        return;
      }

      res.json({
        success: true,
        data: updatedTicket,
        message: 'Ticket assigned successfully'
      });
    } catch (error) {
      logger.error('Failed to assign ticket', {
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to assign ticket',
        message: error.message
      });
    }
  };

  /**
   * Get ticket by ID (simplified route)
   * GET /api/tickets/:ticketId
   */
  getTicketByIdSimple = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ticketId } = req.params;

      if (!ticketId) {
        res.status(400).json({
          success: false,
          error: 'Ticket ID is required'
        });
        return;
      }

      // Try to find ticket by external ID first, then by regular ID
      let ticket = await this.ticketService.getTicketByExternalId(ticketId);
      
      if (!ticket) {
        ticket = await this.ticketService.getTicketById('default', ticketId);
      }

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
        return;
      }

      res.json({
        success: true,
        data: ticket
      });
    } catch (error) {
      logger.error('Failed to get ticket', {
        ticketId: req.params.ticketId,
        error: error.message
      });

      res.status(500).json({
        success: false,
        error: 'Failed to get ticket',
        message: error.message
      });
    }
  };

  /**
   * Update ticket (simplified route)
   * PUT /api/tickets/:ticketId
   */
  updateTicketSimple = async (req: Request, res: Response): Promise<void> => {
    try {
      const { ticketId } = req.params;
      const updates: UpdateTicketRequest = req.body;
      const updatedBy = updates.updatedBy || (req as any).user?.id || 'system';

      if (!ticketId) {
        res.status(400).json({
          success: false,
          error: 'Ticket ID is required'
        });
        return;
      }

      // Get ticket first to extract customer ID
      const ticket = await this.ticketService.getTicketByExternalId(ticketId) || 
                    await this.ticketService.getTicketById('default', ticketId);

      if (!ticket) {
        res.status(404).json({
          success: false,
          error: 'Ticket not found'
        });
        return;
      }

      const updatedTicket = await this.ticketService.updateTicket(
        ticket.customerId,
        ticketId,
        updates,
        updatedBy
      );

      if (!updatedTicket) {
        res.status(404).json({
          success: false,
          error: 'Failed to update ticket'
        });
        return;
      }

      res.json({
        success: true,
        data: updatedTicket,
        message: 'Ticket updated successfully'
      });
    } catch (error) {
      logger.error('Failed to update ticket', {
        ticketId: req.params.ticketId,
        error: error.message
      });

      if (error.message.includes('Validation failed')) {
        res.status(400).json({
          success: false,
          error: 'Validation failed',
          message: error.message
        });
      } else if (error.message.includes('Invalid status transition')) {
        res.status(400).json({
          success: false,
          error: 'Invalid status transition',
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          error: 'Failed to update ticket',
          message: error.message
        });
      }
    }
  };
}