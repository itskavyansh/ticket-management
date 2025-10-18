import Joi from 'joi';

export const workloadAnalysisValidation = {
  // Validate technician ID parameter
  technicianId: Joi.object({
    technicianId: Joi.string().uuid().required().messages({
      'string.guid': 'Technician ID must be a valid UUID',
      'any.required': 'Technician ID is required'
    })
  }),

  // Validate team ID parameter
  teamId: Joi.object({
    teamId: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Team ID must be at least 1 character',
      'string.max': 'Team ID must not exceed 100 characters',
      'any.required': 'Team ID is required'
    })
  }),

  // Validate workload analysis query parameters
  analysisQuery: Joi.object({
    days: Joi.number().integer().min(1).max(365).default(30).messages({
      'number.base': 'Days must be a number',
      'number.integer': 'Days must be an integer',
      'number.min': 'Days must be at least 1',
      'number.max': 'Days must not exceed 365'
    }),
    includeInactive: Joi.boolean().default(false),
    threshold: Joi.number().min(0).max(100).default(85).messages({
      'number.base': 'Threshold must be a number',
      'number.min': 'Threshold must be at least 0',
      'number.max': 'Threshold must not exceed 100'
    })
  }),

  // Validate rebalancing request
  rebalanceRequest: Joi.object({
    teamId: Joi.string().min(1).max(100).required().messages({
      'string.min': 'Team ID must be at least 1 character',
      'string.max': 'Team ID must not exceed 100 characters',
      'any.required': 'Team ID is required'
    }),
    threshold: Joi.number().min(0).max(100).default(85).messages({
      'number.base': 'Threshold must be a number',
      'number.min': 'Threshold must be at least 0',
      'number.max': 'Threshold must not exceed 100'
    }),
    maxReassignments: Joi.number().integer().min(1).max(10).default(5).messages({
      'number.base': 'Max reassignments must be a number',
      'number.integer': 'Max reassignments must be an integer',
      'number.min': 'Max reassignments must be at least 1',
      'number.max': 'Max reassignments must not exceed 10'
    }),
    skillMatchThreshold: Joi.number().min(0).max(100).default(60).messages({
      'number.base': 'Skill match threshold must be a number',
      'number.min': 'Skill match threshold must be at least 0',
      'number.max': 'Skill match threshold must not exceed 100'
    })
  }),

  // Validate workload prediction parameters
  predictionQuery: Joi.object({
    horizon: Joi.number().integer().min(1).max(30).default(7).messages({
      'number.base': 'Prediction horizon must be a number',
      'number.integer': 'Prediction horizon must be an integer',
      'number.min': 'Prediction horizon must be at least 1 day',
      'number.max': 'Prediction horizon must not exceed 30 days'
    }),
    includeWeekends: Joi.boolean().default(false),
    confidenceLevel: Joi.number().min(0.5).max(0.99).default(0.8).messages({
      'number.base': 'Confidence level must be a number',
      'number.min': 'Confidence level must be at least 0.5',
      'number.max': 'Confidence level must not exceed 0.99'
    })
  }),

  // Validate utilization metrics query
  utilizationQuery: Joi.object({
    period: Joi.string().valid('day', 'week', 'month', 'quarter').default('month').messages({
      'any.only': 'Period must be one of: day, week, month, quarter'
    }),
    startDate: Joi.date().iso().max('now').messages({
      'date.base': 'Start date must be a valid date',
      'date.format': 'Start date must be in ISO format',
      'date.max': 'Start date cannot be in the future'
    }),
    endDate: Joi.date().iso().min(Joi.ref('startDate')).max('now').messages({
      'date.base': 'End date must be a valid date',
      'date.format': 'End date must be in ISO format',
      'date.min': 'End date must be after start date',
      'date.max': 'End date cannot be in the future'
    }),
    includeBreakdown: Joi.boolean().default(false)
  }),

  // Validate alert query parameters
  alertQuery: Joi.object({
    severity: Joi.array().items(
      Joi.string().valid('info', 'warning', 'critical', 'urgent')
    ).messages({
      'array.base': 'Severity must be an array',
      'any.only': 'Severity values must be one of: info, warning, critical, urgent'
    }),
    alertType: Joi.array().items(
      Joi.string().valid(
        'overutilization', 
        'underutilization', 
        'burnout_risk', 
        'sla_risk', 
        'capacity_exceeded', 
        'skill_mismatch', 
        'workload_imbalance'
      )
    ).messages({
      'array.base': 'Alert type must be an array',
      'any.only': 'Alert type values must be valid alert types'
    }),
    isActive: Joi.boolean().default(true),
    limit: Joi.number().integer().min(1).max(100).default(50).messages({
      'number.base': 'Limit must be a number',
      'number.integer': 'Limit must be an integer',
      'number.min': 'Limit must be at least 1',
      'number.max': 'Limit must not exceed 100'
    })
  })
};

// Middleware function to validate request parameters
export const validateWorkloadAnalysis = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error, value } = schema.validate({
      ...req.params,
      ...req.query,
      ...req.body
    }, { 
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message
        }))
      });
    }

    // Merge validated values back to request
    Object.assign(req.params, value);
    Object.assign(req.query, value);
    Object.assign(req.body, value);

    next();
  };
};