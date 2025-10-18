import Joi from 'joi';
import { TicketStatus, Priority, TicketCategory } from '../types';

// Enum validation schemas
const ticketStatusSchema = Joi.string().valid(...Object.values(TicketStatus));
const prioritySchema = Joi.string().valid(...Object.values(Priority));
const ticketCategorySchema = Joi.string().valid(...Object.values(TicketCategory));
const customerTierSchema = Joi.string().valid('basic', 'premium', 'enterprise');

// Attachment validation schema
const attachmentSchema = Joi.object({
  filename: Joi.string().required().max(255),
  url: Joi.string().uri().required(),
  size: Joi.number().integer().min(0).max(100 * 1024 * 1024), // 100MB max
  mimeType: Joi.string().required().max(100)
});

// AI Insights validation schema
const resolutionSuggestionSchema = Joi.object({
  id: Joi.string().required(),
  title: Joi.string().required().max(255),
  description: Joi.string().required().max(2000),
  confidence: Joi.number().min(0).max(1).required(),
  source: Joi.string().valid('historical', 'knowledge_base', 'ai_generated').required(),
  relatedTicketIds: Joi.array().items(Joi.string()).optional(),
  steps: Joi.array().items(Joi.string().max(500)).optional()
});

const aiInsightsSchema = Joi.object({
  triageConfidence: Joi.number().min(0).max(1).required(),
  suggestedCategory: ticketCategorySchema.required(),
  slaRiskScore: Joi.number().min(0).max(1).required(),
  resolutionSuggestions: Joi.array().items(resolutionSuggestionSchema).required(),
  similarTickets: Joi.array().items(Joi.string()).required(),
  processedAt: Joi.date().required()
});

// Create ticket validation schema
export const createTicketSchema = Joi.object({
  title: Joi.string().required().min(5).max(255).trim(),
  description: Joi.string().required().min(10).max(5000).trim(),
  customerId: Joi.string().required().uuid(),
  customerName: Joi.string().required().min(2).max(100).trim(),
  customerEmail: Joi.string().email().required(),
  customerTier: customerTierSchema.required(),
  priority: prioritySchema.optional().default(Priority.MEDIUM),
  category: ticketCategorySchema.optional().default(TicketCategory.GENERAL),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional().default([]),
  attachments: Joi.array().items(attachmentSchema).max(5).optional().default([]),
  externalId: Joi.string().max(100).optional()
});

// Update ticket validation schema
export const updateTicketSchema = Joi.object({
  title: Joi.string().min(5).max(255).trim().optional(),
  description: Joi.string().min(10).max(5000).trim().optional(),
  category: ticketCategorySchema.optional(),
  priority: prioritySchema.optional(),
  status: ticketStatusSchema.optional(),
  assignedTechnicianId: Joi.string().uuid().allow(null).optional(),
  tags: Joi.array().items(Joi.string().max(50)).max(10).optional(),
  resolutionNotes: Joi.string().max(2000).trim().optional(),
  resolutionSteps: Joi.array().items(Joi.string().max(500)).max(20).optional(),
  escalationLevel: Joi.number().integer().min(0).max(5).optional(),
  escalationReason: Joi.string().max(500).trim().optional()
});

// Enhanced ticket filter validation schema
export const ticketFilterSchema = Joi.object({
  status: Joi.array().items(ticketStatusSchema).min(1).max(10).optional(),
  priority: Joi.array().items(prioritySchema).min(1).max(4).optional(),
  category: Joi.array().items(ticketCategorySchema).min(1).max(20).optional(),
  assignedTechnicianId: Joi.string().uuid().optional(),
  customerId: Joi.string().uuid().optional(),
  customerTier: Joi.array().items(customerTierSchema).min(1).max(3).optional(),
  createdAfter: Joi.date().optional(),
  createdBefore: Joi.date().optional(),
  updatedAfter: Joi.date().optional(),
  updatedBefore: Joi.date().optional(),
  slaRisk: Joi.string().valid('low', 'medium', 'high').optional(),
  tags: Joi.array().items(Joi.string().max(50)).min(1).max(20).optional(),
  escalationLevel: Joi.array().items(Joi.number().integer().min(0).max(5)).min(1).max(6).optional(),
  hasAttachments: Joi.boolean().optional(),
  isOverdue: Joi.boolean().optional(),
  timeSpentMin: Joi.number().integer().min(0).optional(),
  timeSpentMax: Joi.number().integer().min(0).optional(),
  resolutionTimeMin: Joi.number().integer().min(0).optional(),
  resolutionTimeMax: Joi.number().integer().min(0).optional()
}).custom((value, helpers) => {
  // Validate date ranges
  if (value.createdAfter && value.createdBefore && value.createdAfter >= value.createdBefore) {
    return helpers.error('any.invalid', { message: 'createdAfter must be before createdBefore' });
  }
  
  if (value.updatedAfter && value.updatedBefore && value.updatedAfter >= value.updatedBefore) {
    return helpers.error('any.invalid', { message: 'updatedAfter must be before updatedBefore' });
  }
  
  // Validate time ranges
  if (value.timeSpentMin && value.timeSpentMax && value.timeSpentMin > value.timeSpentMax) {
    return helpers.error('any.invalid', { message: 'timeSpentMin must be less than or equal to timeSpentMax' });
  }
  
  if (value.resolutionTimeMin && value.resolutionTimeMax && value.resolutionTimeMin > value.resolutionTimeMax) {
    return helpers.error('any.invalid', { message: 'resolutionTimeMin must be less than or equal to resolutionTimeMax' });
  }
  
  return value;
});

// Enhanced ticket search query validation schema
export const ticketSearchSchema = Joi.object({
  query: Joi.string().max(500).trim().optional(),
  filters: ticketFilterSchema.optional(),
  sortBy: Joi.string().valid(
    'createdAt', 
    'updatedAt', 
    'priority', 
    'slaDeadline', 
    'status', 
    'customerName',
    'escalationLevel',
    'timeSpent',
    'relevance'
  ).optional().default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc'),
  page: Joi.number().integer().min(1).max(1000).optional().default(1),
  limit: Joi.number().integer().min(1).max(100).optional().default(20),
  includeResolved: Joi.boolean().optional().default(false),
  includeClosed: Joi.boolean().optional().default(false)
}).custom((value, helpers) => {
  // Validate pagination limits
  const maxResults = value.page * value.limit;
  if (maxResults > 10000) {
    return helpers.error('any.invalid', { 
      message: 'Maximum results exceeded. Please use more specific filters or smaller page/limit values.' 
    });
  }
  
  return value;
});

// Ticket timeline validation schema
export const ticketTimelineSchema = Joi.object({
  ticketId: Joi.string().uuid().required(),
  action: Joi.string().valid('created', 'updated', 'assigned', 'status_changed', 'escalated', 'resolved', 'closed').required(),
  description: Joi.string().required().max(500).trim(),
  performedBy: Joi.string().uuid().required(),
  performedAt: Joi.date().required(),
  oldValue: Joi.any().optional(),
  newValue: Joi.any().optional(),
  metadata: Joi.object().optional()
});

// Validation helper functions
export const validateCreateTicket = (data: any) => {
  return createTicketSchema.validate(data, { abortEarly: false });
};

export const validateUpdateTicket = (data: any) => {
  return updateTicketSchema.validate(data, { abortEarly: false });
};

export const validateTicketFilter = (data: any) => {
  return ticketFilterSchema.validate(data, { abortEarly: false });
};

export const validateTicketSearch = (data: any) => {
  return ticketSearchSchema.validate(data, { abortEarly: false });
};