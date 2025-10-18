import Joi from 'joi';
import { NotificationType, NotificationPriority } from '../types/notification';

// Channel configuration schemas
const slackConfigSchema = Joi.object({
  botToken: Joi.string().required(),
  channelId: Joi.string().required(),
  webhookUrl: Joi.string().uri().optional()
});

const teamsConfigSchema = Joi.object({
  webhookUrl: Joi.string().uri().required(),
  channelId: Joi.string().optional()
});

const emailConfigSchema = Joi.object({
  smtpHost: Joi.string().required(),
  smtpPort: Joi.number().integer().min(1).max(65535).required(),
  username: Joi.string().required(),
  password: Joi.string().required(),
  fromAddress: Joi.string().email().required(),
  toAddresses: Joi.array().items(Joi.string().email()).min(1).required()
});

// Channel registration schema
export const channelRegistrationSchema = Joi.object({
  id: Joi.string().required(),
  type: Joi.string().valid('slack', 'teams', 'email').required(),
  name: Joi.string().required(),
  config: Joi.when('type', {
    switch: [
      { is: 'slack', then: slackConfigSchema },
      { is: 'teams', then: teamsConfigSchema },
      { is: 'email', then: emailConfigSchema }
    ]
  }).required(),
  enabled: Joi.boolean().default(true)
});

// Template registration schema
export const templateRegistrationSchema = Joi.object({
  id: Joi.string().required(),
  name: Joi.string().required(),
  type: Joi.string().valid(...Object.values(NotificationType)).required(),
  channels: Joi.array().items(Joi.string()).default([]),
  subject: Joi.string().required(),
  message: Joi.string().required(),
  priority: Joi.string().valid(...Object.values(NotificationPriority)).required(),
  variables: Joi.array().items(Joi.string()).default([])
});

// Notification request schema
export const notificationRequestSchema = Joi.object({
  type: Joi.string().valid(...Object.values(NotificationType)).required(),
  priority: Joi.string().valid(...Object.values(NotificationPriority)).required(),
  templateId: Joi.string().optional(),
  channels: Joi.array().items(Joi.string()).optional(),
  data: Joi.object().required(),
  userId: Joi.string().optional(),
  ticketId: Joi.string().optional()
});

// SLA warning notification schema
export const slaWarningSchema = Joi.object({
  ticketId: Joi.string().required(),
  riskPercentage: Joi.number().min(0).max(100).required(),
  timeRemaining: Joi.string().required(),
  technician: Joi.string().optional(),
  channels: Joi.array().items(Joi.string()).optional()
});

// Ticket assignment notification schema
export const ticketAssignmentSchema = Joi.object({
  ticketId: Joi.string().required(),
  title: Joi.string().required(),
  priority: Joi.string().valid('critical', 'high', 'medium', 'low').optional(),
  technician: Joi.string().required(),
  customer: Joi.string().optional(),
  dueDate: Joi.date().optional(),
  channels: Joi.array().items(Joi.string()).optional()
});

// Notification preferences schema
export const notificationPreferencesSchema = Joi.object({
  userId: Joi.string().required(),
  channels: Joi.object().pattern(
    Joi.string().valid(...Object.values(NotificationType)),
    Joi.array().items(Joi.string())
  ).optional(),
  quietHours: Joi.object({
    start: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    end: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    timezone: Joi.string().required()
  }).optional(),
  enabled: Joi.boolean().default(true)
});

// Validation middleware functions
export const validateChannelRegistration = (req: any, res: any, next: any) => {
  const { error } = channelRegistrationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};

export const validateTemplateRegistration = (req: any, res: any, next: any) => {
  const { error } = templateRegistrationSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};

export const validateNotificationRequest = (req: any, res: any, next: any) => {
  const { error } = notificationRequestSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};

export const validateSLAWarning = (req: any, res: any, next: any) => {
  const { error } = slaWarningSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};

export const validateTicketAssignment = (req: any, res: any, next: any) => {
  const { error } = ticketAssignmentSchema.validate(req.body);
  if (error) {
    return res.status(400).json({
      error: 'Validation error',
      details: error.details.map(detail => detail.message)
    });
  }
  next();
};