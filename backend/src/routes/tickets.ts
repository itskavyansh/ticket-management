import { Router } from 'express';
import { TicketController } from '../controllers/TicketController';
import { authenticate } from '../middleware/auth';
import { authorize } from '../middleware/rbac';
import { UserRole } from '../types';

const router = Router();
const ticketController = new TicketController();

// Apply authentication to all ticket routes
router.use(authenticate);

/**
 * Ticket CRUD Operations
 */

// Create new ticket
// POST /api/tickets
router.post('/', 
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.createTicket
);

// Search tickets with filters and pagination
// GET /api/tickets/search?q=query&status=open,in_progress&priority=high&page=1&limit=20
router.get('/search',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.searchTickets
);

// Advanced search with faceted results
// GET /api/tickets/search/advanced?q=query&status=open&priority=high&page=1&limit=20
router.get('/search/advanced',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.advancedSearchTickets
);

// Get tickets needing attention (overdue or high risk)
// GET /api/tickets/attention
router.get('/attention',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.getTicketsNeedingAttention
);

// Get ticket by external ID (SuperOps ID)
// GET /api/tickets/external/:externalId
router.get('/external/:externalId',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.getTicketByExternalId
);

// Get tickets by technician
// GET /api/tickets/technician/:technicianId?status=open,in_progress&limit=50
router.get('/technician/:technicianId',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.getTicketsByTechnician
);

// Get tickets by customer
// GET /api/tickets/customer/:customerId?status=open,in_progress&limit=50
router.get('/customer/:customerId',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.getTicketsByCustomer
);

/**
 * Individual Ticket Operations
 */

// Get ticket by ID
// GET /api/tickets/:customerId/:ticketId
router.get('/:customerId/:ticketId',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.getTicketById
);

// Update ticket
// PUT /api/tickets/:customerId/:ticketId
router.put('/:customerId/:ticketId',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.updateTicket
);

// Delete ticket
// DELETE /api/tickets/:customerId/:ticketId
router.delete('/:customerId/:ticketId',
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  ticketController.deleteTicket
);

/**
 * Ticket Actions
 */

// Assign ticket to technician
// POST /api/tickets/:customerId/:ticketId/assign
// Body: { technicianId: string }
router.post('/:customerId/:ticketId/assign',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.assignTicket
);

// Escalate ticket
// POST /api/tickets/:customerId/:ticketId/escalate
// Body: { reason: string }
router.post('/:customerId/:ticketId/escalate',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.escalateTicket
);

// Get ticket timeline
// GET /api/tickets/:customerId/:ticketId/timeline
router.get('/:customerId/:ticketId/timeline',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.getTicketTimeline
);

// Get AI-powered resolution suggestions for a ticket
// GET /api/tickets/:customerId/:ticketId/resolution-suggestions
router.get('/:customerId/:ticketId/resolution-suggestions',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.getResolutionSuggestions
);

// Get AI-powered assignment recommendations for a ticket
// POST /api/tickets/:ticketId/assignment-recommendations
// Body: { availableTechnicianIds: string[] }
router.post('/:ticketId/assignment-recommendations',
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  ticketController.getAssignmentRecommendations
);

// Get SLA prediction for a ticket
// GET /api/tickets/:ticketId/sla-prediction
router.get('/:ticketId/sla-prediction',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.getSLAPrediction
);

// Get AI resolution suggestions for a ticket
// GET /api/tickets/:ticketId/resolution-suggestions
router.get('/:ticketId/resolution-suggestions',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.getResolutionSuggestions
);

// Assign ticket to technician (simplified route for integration tests)
// PUT /api/tickets/:ticketId/assign
// Body: { technicianId: string, assignedBy: string }
router.put('/:ticketId/assign',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.assignTicketSimple
);

// Get ticket by ID (simplified route for integration tests)
// GET /api/tickets/:ticketId
router.get('/:ticketId',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.getTicketByIdSimple
);

// Update ticket (simplified route for integration tests)
// PUT /api/tickets/:ticketId
router.put('/:ticketId',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.updateTicketSimple
);

/**
 * SLA Management Routes
 */

// Check for SLA breaches across all tickets
// GET /api/tickets/sla/breaches?riskThreshold=0.7&criticalThreshold=0.85
router.get('/sla/breaches',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.checkSLABreaches
);

// Get tickets at risk of SLA breach
// GET /api/tickets/sla/at-risk?riskThreshold=0.7
router.get('/sla/at-risk',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN]),
  ticketController.getTicketsAtRisk
);

// Get SLA metrics for a period
// GET /api/tickets/sla/metrics?startDate=2024-01-01&endDate=2024-01-31&customerId=123&technicianId=456
router.get('/sla/metrics',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.READ_ONLY]),
  ticketController.getSLAMetrics
);

// Get SLA status for a specific ticket
// GET /api/tickets/:customerId/:ticketId/sla
router.get('/:customerId/:ticketId/sla',
  authorize([UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY]),
  ticketController.getTicketSLAStatus
);

// Update SLA deadline for a specific ticket
// PUT /api/tickets/:customerId/:ticketId/sla
// Body: { newDeadline: string, reason: string }
router.put('/:customerId/:ticketId/sla',
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  ticketController.updateTicketSLA
);

// Recalculate SLA deadline based on current priority and customer tier
// POST /api/tickets/:customerId/:ticketId/sla/recalculate
// Body: { reason?: string }
router.post('/:customerId/:ticketId/sla/recalculate',
  authorize([UserRole.ADMIN, UserRole.MANAGER]),
  ticketController.recalculateTicketSLA
);

export default router;