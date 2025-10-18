import Joi from 'joi';
import {
  SuperOpsTicket,
  SuperOpsCustomer,
  SuperOpsTechnician,
  SuperOpsWebhookPayload
} from '../types/superops';

// SuperOps ticket validation schema
export const superOpsTicketSchema = Joi.object({
  id: Joi.string().required(),
  subject: Joi.string().required().min(1).max(500),
  description: Joi.string().required().min(1),
  status: Joi.string().valid('open', 'in_progress', 'pending', 'resolved', 'closed', 'cancelled').required(),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low').required(),
  category: Joi.string().valid('hardware', 'software', 'network', 'security', 'general').required(),
  customer_id: Joi.string().required(),
  assigned_to: Joi.string().optional().allow(null),
  created_at: Joi.string().isoDate().required(),
  updated_at: Joi.string().isoDate().required(),
  due_date: Joi.string().isoDate().optional().allow(null),
  resolved_at: Joi.string().isoDate().optional().allow(null),
  tags: Joi.array().items(Joi.string()).optional().default([]),
  custom_fields: Joi.object().optional().default({}),
  attachments: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    filename: Joi.string().required(),
    url: Joi.string().uri().required(),
    size: Joi.number().integer().min(0).required(),
    content_type: Joi.string().required(),
    uploaded_at: Joi.string().isoDate().required()
  })).optional().default([]),
  time_entries: Joi.array().items(Joi.object({
    id: Joi.string().required(),
    ticket_id: Joi.string().required(),
    technician_id: Joi.string().required(),
    start_time: Joi.string().isoDate().required(),
    end_time: Joi.string().isoDate().optional().allow(null),
    duration: Joi.number().integer().min(0).required(),
    description: Joi.string().optional().allow(''),
    billable: Joi.boolean().required(),
    created_at: Joi.string().isoDate().required()
  })).optional().default([])
});

// SuperOps customer validation schema
export const superOpsCustomerSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required().min(1).max(200),
  email: Joi.string().email().required(),
  company_name: Joi.string().required().min(1).max(200),
  phone: Joi.string().optional().allow(null, ''),
  address: Joi.string().optional().allow(null, ''),
  tier: Joi.string().valid('basic', 'standard', 'premium', 'enterprise', 'business').required(),
  contract_start_date: Joi.string().isoDate().optional().allow(null),
  contract_end_date: Joi.string().isoDate().optional().allow(null),
  sla_level: Joi.string().optional().allow(null, ''),
  created_at: Joi.string().isoDate().required(),
  updated_at: Joi.string().isoDate().required(),
  custom_fields: Joi.object().optional().default({})
});

// SuperOps technician validation schema
export const superOpsTechnicianSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required().min(1).max(200),
  email: Joi.string().email().required(),
  role: Joi.string().valid('admin', 'administrator', 'manager', 'supervisor', 'technician', 'support', 'readonly', 'viewer').required(),
  department: Joi.string().optional().allow(null, ''),
  skills: Joi.array().items(Joi.string()).optional().default([]),
  is_active: Joi.boolean().required(),
  created_at: Joi.string().isoDate().required(),
  updated_at: Joi.string().isoDate().required(),
  custom_fields: Joi.object().optional().default({})
});

// SuperOps webhook payload validation schema
export const superOpsWebhookSchema = Joi.object({
  event: Joi.string().valid(
    'ticket.created',
    'ticket.updated',
    'ticket.deleted',
    'ticket.assigned',
    'customer.created',
    'customer.updated',
    'customer.deleted',
    'technician.created',
    'technician.updated',
    'technician.deleted'
  ).required(),
  timestamp: Joi.string().isoDate().required(),
  data: Joi.object({
    ticket: superOpsTicketSchema.optional(),
    customer: superOpsCustomerSchema.optional(),
    technician: superOpsTechnicianSchema.optional(),
    changes: Joi.object().pattern(
      Joi.string(),
      Joi.object({
        old_value: Joi.any(),
        new_value: Joi.any()
      })
    ).optional()
  }).required()
});

// SuperOps API response validation schema
export const superOpsApiResponseSchema = Joi.object({
  success: Joi.boolean().required(),
  data: Joi.any().required(),
  message: Joi.string().optional(),
  errors: Joi.array().items(Joi.string()).optional(),
  pagination: Joi.object({
    page: Joi.number().integer().min(1).required(),
    per_page: Joi.number().integer().min(1).max(1000).required(),
    total: Joi.number().integer().min(0).required(),
    total_pages: Joi.number().integer().min(0).required()
  }).optional()
});

// SuperOps list parameters validation schema
export const superOpsListParamsSchema = Joi.object({
  page: Joi.number().integer().min(1).optional().default(1),
  per_page: Joi.number().integer().min(1).max(1000).optional().default(50),
  sort_by: Joi.string().optional(),
  sort_order: Joi.string().valid('asc', 'desc').optional().default('desc'),
  filters: Joi.object().optional().default({})
});

// SuperOps ticket create request validation schema
export const superOpsTicketCreateSchema = Joi.object({
  subject: Joi.string().required().min(1).max(500),
  description: Joi.string().required().min(1),
  customer_id: Joi.string().required(),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low').optional().default('medium'),
  category: Joi.string().valid('hardware', 'software', 'network', 'security', 'general').optional().default('general'),
  assigned_to: Joi.string().optional().allow(null),
  due_date: Joi.string().isoDate().optional().allow(null),
  tags: Joi.array().items(Joi.string()).optional().default([]),
  custom_fields: Joi.object().optional().default({})
});

// SuperOps ticket update request validation schema
export const superOpsTicketUpdateSchema = Joi.object({
  subject: Joi.string().min(1).max(500).optional(),
  description: Joi.string().min(1).optional(),
  status: Joi.string().valid('open', 'in_progress', 'pending', 'resolved', 'closed', 'cancelled').optional(),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low').optional(),
  category: Joi.string().valid('hardware', 'software', 'network', 'security', 'general').optional(),
  assigned_to: Joi.string().optional().allow(null),
  due_date: Joi.string().isoDate().optional().allow(null),
  tags: Joi.array().items(Joi.string()).optional(),
  custom_fields: Joi.object().optional()
});

// Validation functions
export const validateSuperOpsTicket = (data: any): { error?: Joi.ValidationError; value?: SuperOpsTicket } => {
  return superOpsTicketSchema.validate(data, { abortEarly: false, stripUnknown: true });
};

export const validateSuperOpsCustomer = (data: any): { error?: Joi.ValidationError; value?: SuperOpsCustomer } => {
  return superOpsCustomerSchema.validate(data, { abortEarly: false, stripUnknown: true });
};

export const validateSuperOpsTechnician = (data: any): { error?: Joi.ValidationError; value?: SuperOpsTechnician } => {
  return superOpsTechnicianSchema.validate(data, { abortEarly: false, stripUnknown: true });
};

export const validateSuperOpsWebhook = (data: any): { error?: Joi.ValidationError; value?: SuperOpsWebhookPayload } => {
  return superOpsWebhookSchema.validate(data, { abortEarly: false, stripUnknown: true });
};

export const validateSuperOpsListParams = (data: any): { error?: Joi.ValidationError; value?: any } => {
  return superOpsListParamsSchema.validate(data, { abortEarly: false, stripUnknown: true });
};

export const validateSuperOpsTicketCreate = (data: any): { error?: Joi.ValidationError; value?: any } => {
  return superOpsTicketCreateSchema.validate(data, { abortEarly: false, stripUnknown: true });
};

export const validateSuperOpsTicketUpdate = (data: any): { error?: Joi.ValidationError; value?: any } => {
  return superOpsTicketUpdateSchema.validate(data, { abortEarly: false, stripUnknown: true });
};

// Data enrichment validation
export const validateDataEnrichment = (entityType: string, data: any): boolean => {
  const requiredFields = {
    ticket: ['id', 'subject', 'description', 'customer_id'],
    customer: ['id', 'name', 'email', 'company_name'],
    technician: ['id', 'name', 'email', 'role']
  };

  const required = requiredFields[entityType as keyof typeof requiredFields];
  if (!required) {
    return false;
  }

  return required.every(field => data[field] !== undefined && data[field] !== null && data[field] !== '');
};

// Custom validation for business rules
export const validateBusinessRules = (entityType: string, data: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  switch (entityType) {
    case 'ticket':
      // Validate ticket business rules
      if (data.priority === 'critical' && !data.assigned_to) {
        errors.push('Critical tickets must be assigned to a technician');
      }
      
      if (data.status === 'resolved' && !data.resolved_at) {
        errors.push('Resolved tickets must have a resolution date');
      }
      
      if (data.due_date && new Date(data.due_date) < new Date()) {
        errors.push('Due date cannot be in the past');
      }
      break;

    case 'customer':
      // Validate customer business rules
      if (data.tier === 'enterprise' && !data.sla_level) {
        errors.push('Enterprise customers must have an SLA level defined');
      }
      
      if (data.contract_end_date && data.contract_start_date && 
          new Date(data.contract_end_date) <= new Date(data.contract_start_date)) {
        errors.push('Contract end date must be after start date');
      }
      break;

    case 'technician':
      // Validate technician business rules
      if (data.role === 'admin' && data.department !== 'IT') {
        // This is just an example rule
        // errors.push('Admin users should typically be in IT department');
      }
      break;
  }

  return {
    valid: errors.length === 0,
    errors
  };
};

// Field mapping validation
export const validateFieldMapping = (mapping: any): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  if (!mapping.internalField || typeof mapping.internalField !== 'string') {
    errors.push('Internal field must be a non-empty string');
  }

  if (!mapping.externalField || typeof mapping.externalField !== 'string') {
    errors.push('External field must be a non-empty string');
  }

  if (mapping.transform && typeof mapping.transform !== 'function') {
    errors.push('Transform must be a function');
  }

  if (mapping.required !== undefined && typeof mapping.required !== 'boolean') {
    errors.push('Required must be a boolean');
  }

  return {
    valid: errors.length === 0,
    errors
  };
};