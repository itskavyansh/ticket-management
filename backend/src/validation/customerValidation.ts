import Joi from 'joi';

// Customer tier validation schema
const customerTierSchema = Joi.string().valid('basic', 'premium', 'enterprise');
const contactMethodSchema = Joi.string().valid('email', 'phone', 'chat', 'portal');

// Contact information validation schema
const contactSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  email: Joi.string().email().required(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20).optional(),
  role: Joi.string().required().max(100).trim()
});

// Business hours validation schema
const businessHoursSchema = Joi.object({
  timezone: Joi.string().required().max(50),
  workingDays: Joi.array().items(
    Joi.string().valid('monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday')
  ).min(1).max(7).required(),
  startTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(), // HH:mm format
  endTime: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required()     // HH:mm format
});

// Create customer validation schema
export const createCustomerSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  email: Joi.string().email().required(),
  companyName: Joi.string().required().min(2).max(200).trim(),
  tier: customerTierSchema.required(),
  slaLevel: Joi.string().required().max(50).trim(),
  responseTimeTarget: Joi.number().integer().min(1).max(10080).required(), // max 1 week in minutes
  resolutionTimeTarget: Joi.number().integer().min(1).max(43200).required(), // max 1 month in minutes
  primaryContact: contactSchema.required(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20).optional(),
  industry: Joi.string().max(100).trim().optional(),
  preferredContactMethod: contactMethodSchema.optional().default('email'),
  businessHours: businessHoursSchema.optional(),
  subscriptionPlan: Joi.string().max(100).trim().optional(),
  externalId: Joi.string().max(100).optional()
});

// Update customer validation schema
export const updateCustomerSchema = Joi.object({
  name: Joi.string().min(2).max(100).trim().optional(),
  email: Joi.string().email().optional(),
  phoneNumber: Joi.string().pattern(/^\+?[\d\s\-\(\)]+$/).max(20).allow(null).optional(),
  companyName: Joi.string().min(2).max(200).trim().optional(),
  tier: customerTierSchema.optional(),
  slaLevel: Joi.string().max(50).trim().optional(),
  responseTimeTarget: Joi.number().integer().min(1).max(10080).optional(),
  resolutionTimeTarget: Joi.number().integer().min(1).max(43200).optional(),
  primaryContact: contactSchema.optional(),
  technicalContacts: Joi.array().items(contactSchema).max(10).optional(),
  industry: Joi.string().max(100).trim().optional(),
  employeeCount: Joi.number().integer().min(1).max(1000000).optional(),
  annualRevenue: Joi.number().min(0).max(1000000000000).optional(), // max 1 trillion
  preferredContactMethod: contactMethodSchema.optional(),
  businessHours: businessHoursSchema.optional(),
  subscriptionPlan: Joi.string().max(100).trim().optional(),
  isActive: Joi.boolean().optional()
});

// Customer SLA validation schema
export const customerSLASchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  slaLevel: Joi.string().required().max(50).trim(),
  responseTimeTarget: Joi.number().integer().min(1).max(10080).required(),
  resolutionTimeTarget: Joi.number().integer().min(1).max(43200).required(),
  availabilityTarget: Joi.number().min(0).max(100).required(), // percentage
  escalationMatrix: Joi.array().items(Joi.object({
    level: Joi.number().integer().min(1).max(5).required(),
    timeThreshold: Joi.number().integer().min(1).required(), // in minutes
    contacts: Joi.array().items(Joi.string().email()).min(1).required(),
    actions: Joi.array().items(Joi.string().max(200)).min(1).required()
  })).min(1).max(5).required(),
  penalties: Joi.array().items(Joi.object({
    condition: Joi.string().required().max(200).trim(),
    penalty: Joi.string().required().max(200).trim(),
    amount: Joi.number().min(0).optional()
  })).optional(),
  effectiveFrom: Joi.date().required(),
  effectiveTo: Joi.date().min(Joi.ref('effectiveFrom')).optional()
});

// Customer metrics validation schema
export const customerMetricsSchema = Joi.object({
  customerId: Joi.string().uuid().required(),
  period: Joi.object({
    startDate: Joi.date().required(),
    endDate: Joi.date().min(Joi.ref('startDate')).required()
  }).required(),
  totalTickets: Joi.number().integer().min(0).required(),
  resolvedTickets: Joi.number().integer().min(0).max(Joi.ref('totalTickets')).required(),
  averageResponseTime: Joi.number().min(0).required(),
  averageResolutionTime: Joi.number().min(0).required(),
  slaComplianceRate: Joi.number().min(0).max(100).required(),
  satisfactionScore: Joi.number().min(1).max(5).required(),
  escalationRate: Joi.number().min(0).max(100).required(),
  firstCallResolutionRate: Joi.number().min(0).max(100).required(),
  ticketsByCategory: Joi.object().pattern(Joi.string(), Joi.number().integer().min(0)).required(),
  ticketsByPriority: Joi.object().pattern(Joi.string(), Joi.number().integer().min(0)).required()
});

// Customer filter validation schema
export const customerFilterSchema = Joi.object({
  tier: Joi.array().items(customerTierSchema).optional(),
  industry: Joi.array().items(Joi.string().max(100)).optional(),
  isActive: Joi.boolean().optional(),
  slaLevel: Joi.array().items(Joi.string().max(50)).optional(),
  subscriptionPlan: Joi.array().items(Joi.string().max(100)).optional(),
  createdAfter: Joi.date().optional(),
  createdBefore: Joi.date().optional(),
  satisfactionScore: Joi.object({
    min: Joi.number().min(1).max(5).optional(),
    max: Joi.number().min(1).max(5).optional()
  }).optional()
});

// Validation helper functions
export const validateCreateCustomer = (data: any) => {
  return createCustomerSchema.validate(data, { abortEarly: false });
};

export const validateUpdateCustomer = (data: any) => {
  return updateCustomerSchema.validate(data, { abortEarly: false });
};

export const validateCustomerSLA = (data: any) => {
  return customerSLASchema.validate(data, { abortEarly: false });
};

export const validateCustomerMetrics = (data: any) => {
  return customerMetricsSchema.validate(data, { abortEarly: false });
};

export const validateCustomerFilter = (data: any) => {
  return customerFilterSchema.validate(data, { abortEarly: false });
};