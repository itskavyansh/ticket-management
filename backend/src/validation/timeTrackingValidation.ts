import Joi from 'joi';
import { TimeEntryStatus } from '../models/TimeTracking';

export const createTimeEntrySchema = Joi.object({
  technicianId: Joi.string().required().messages({
    'string.empty': 'Technician ID is required',
    'any.required': 'Technician ID is required'
  }),
  ticketId: Joi.string().required().messages({
    'string.empty': 'Ticket ID is required',
    'any.required': 'Ticket ID is required'
  }),
  description: Joi.string().optional().max(500).messages({
    'string.max': 'Description cannot exceed 500 characters'
  }),
  isBillable: Joi.boolean().optional().default(true),
  isAutomatic: Joi.boolean().optional().default(false)
});

export const updateTimeEntrySchema = Joi.object({
  endTime: Joi.date().optional(),
  status: Joi.string().valid(...Object.values(TimeEntryStatus)).optional(),
  description: Joi.string().optional().max(500).messages({
    'string.max': 'Description cannot exceed 500 characters'
  }),
  isBillable: Joi.boolean().optional(),
  pauseReason: Joi.string().optional().max(200).messages({
    'string.max': 'Pause reason cannot exceed 200 characters'
  }),
  correctionReason: Joi.string().optional().max(500).messages({
    'string.max': 'Correction reason cannot exceed 500 characters'
  })
});

export const timeValidationSchema = Joi.object({
  timeEntryId: Joi.string().required().messages({
    'string.empty': 'Time entry ID is required',
    'any.required': 'Time entry ID is required'
  }),
  validatedBy: Joi.string().required().messages({
    'string.empty': 'Validator ID is required',
    'any.required': 'Validator ID is required'
  }),
  correctedDuration: Joi.number().optional().min(0).max(24 * 60).messages({
    'number.min': 'Duration cannot be negative',
    'number.max': 'Duration cannot exceed 24 hours'
  }),
  correctionReason: Joi.string().optional().max(500).messages({
    'string.max': 'Correction reason cannot exceed 500 characters'
  }),
  isBillable: Joi.boolean().optional()
});

export const timeEntryFilterSchema = Joi.object({
  technicianId: Joi.string().optional(),
  ticketId: Joi.string().optional(),
  status: Joi.array().items(Joi.string().valid(...Object.values(TimeEntryStatus))).optional(),
  isBillable: Joi.boolean().optional(),
  isAutomatic: Joi.boolean().optional(),
  isValidated: Joi.boolean().optional(),
  dateRange: Joi.object({
    startDate: Joi.date().required(),
    endDate: Joi.date().required().min(Joi.ref('startDate'))
  }).optional(),
  minDuration: Joi.number().optional().min(0),
  maxDuration: Joi.number().optional().min(Joi.ref('minDuration'))
});

export const pauseReasonSchema = Joi.object({
  reason: Joi.string().optional().max(200).messages({
    'string.max': 'Pause reason cannot exceed 200 characters'
  })
});

export const dateRangeSchema = Joi.object({
  startDate: Joi.date().required().messages({
    'date.base': 'Start date must be a valid date',
    'any.required': 'Start date is required'
  }),
  endDate: Joi.date().required().min(Joi.ref('startDate')).messages({
    'date.base': 'End date must be a valid date',
    'date.min': 'End date must be after start date',
    'any.required': 'End date is required'
  })
});

export const paginationSchema = Joi.object({
  page: Joi.number().optional().min(1).default(1),
  limit: Joi.number().optional().min(1).max(100).default(50)
});

// Validation functions
export const validateCreateTimeEntry = (data: any) => {
  return createTimeEntrySchema.validate(data, { abortEarly: false });
};

export const validateUpdateTimeEntry = (data: any) => {
  return updateTimeEntrySchema.validate(data, { abortEarly: false });
};

export const validateTimeValidation = (data: any) => {
  return timeValidationSchema.validate(data, { abortEarly: false });
};

export const validateTimeEntryFilter = (data: any) => {
  return timeEntryFilterSchema.validate(data, { abortEarly: false });
};

export const validatePauseReason = (data: any) => {
  return pauseReasonSchema.validate(data, { abortEarly: false });
};

export const validateDateRange = (data: any) => {
  return dateRangeSchema.validate(data, { abortEarly: false });
};

export const validatePagination = (data: any) => {
  return paginationSchema.validate(data, { abortEarly: false });
};