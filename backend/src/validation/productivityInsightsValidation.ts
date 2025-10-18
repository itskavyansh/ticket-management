import Joi from 'joi';

/**
 * Validation schema for date range query parameters
 */
export const dateRangeQuerySchema = Joi.object({
  startDate: Joi.date().iso().required().messages({
    'date.base': 'Start date must be a valid date',
    'date.format': 'Start date must be in ISO format',
    'any.required': 'Start date is required'
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
    'date.base': 'End date must be a valid date',
    'date.format': 'End date must be in ISO format',
    'date.min': 'End date must be after start date',
    'any.required': 'End date is required'
  }),
  technicianId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Technician ID must be a valid UUID'
  }),
  teamId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Team ID must be a valid UUID'
  })
});

/**
 * Validation schema for technician ID parameter
 */
export const technicianIdParamSchema = Joi.object({
  technicianId: Joi.string().uuid().required().messages({
    'string.uuid': 'Technician ID must be a valid UUID',
    'any.required': 'Technician ID is required'
  })
});

/**
 * Validation schema for team productivity report request
 */
export const teamProductivityReportSchema = Joi.object({
  technicianIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(50)
    .required()
    .messages({
      'array.base': 'Technician IDs must be an array',
      'array.min': 'At least one technician ID is required',
      'array.max': 'Maximum 50 technician IDs allowed',
      'string.uuid': 'Each technician ID must be a valid UUID',
      'any.required': 'Technician IDs array is required'
    })
});

/**
 * Validation schema for productivity trends request
 */
export const productivityTrendsSchema = Joi.object({
  technicianIds: Joi.array()
    .items(Joi.string().uuid())
    .min(1)
    .max(20)
    .required()
    .messages({
      'array.base': 'Technician IDs must be an array',
      'array.min': 'At least one technician ID is required',
      'array.max': 'Maximum 20 technician IDs allowed for trends analysis',
      'string.uuid': 'Each technician ID must be a valid UUID',
      'any.required': 'Technician IDs array is required'
    })
});

/**
 * Validation schema for performance comparison request
 */
export const performanceComparisonSchema = Joi.object({
  technicianIds: Joi.array()
    .items(Joi.string().uuid())
    .min(2)
    .max(10)
    .required()
    .messages({
      'array.base': 'Technician IDs must be an array',
      'array.min': 'At least two technician IDs are required for comparison',
      'array.max': 'Maximum 10 technician IDs allowed for comparison',
      'string.uuid': 'Each technician ID must be a valid UUID',
      'any.required': 'Technician IDs array is required'
    })
});

/**
 * Validation schema for dashboard query parameters
 */
export const dashboardQuerySchema = Joi.object({
  startDate: Joi.date().iso().required().messages({
    'date.base': 'Start date must be a valid date',
    'date.format': 'Start date must be in ISO format',
    'any.required': 'Start date is required'
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
    'date.base': 'End date must be a valid date',
    'date.format': 'End date must be in ISO format',
    'date.min': 'End date must be after start date',
    'any.required': 'End date is required'
  }),
  technicianId: Joi.string().uuid().optional().messages({
    'string.uuid': 'Technician ID must be a valid UUID'
  }),
  includeInsights: Joi.boolean().optional().default(true),
  includeComparison: Joi.boolean().optional().default(false)
});

/**
 * Validation schema for throughput metrics query parameters
 */
export const throughputMetricsQuerySchema = Joi.object({
  startDate: Joi.date().iso().required().messages({
    'date.base': 'Start date must be a valid date',
    'date.format': 'Start date must be in ISO format',
    'any.required': 'Start date is required'
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
    'date.base': 'End date must be a valid date',
    'date.format': 'End date must be in ISO format',
    'date.min': 'End date must be after start date',
    'any.required': 'End date is required'
  }),
  includeHourlyBreakdown: Joi.boolean().optional().default(false),
  includePeakHours: Joi.boolean().optional().default(true)
});

/**
 * Validation schema for resolution analysis query parameters
 */
export const resolutionAnalysisQuerySchema = Joi.object({
  startDate: Joi.date().iso().required().messages({
    'date.base': 'Start date must be a valid date',
    'date.format': 'Start date must be in ISO format',
    'any.required': 'Start date is required'
  }),
  endDate: Joi.date().iso().min(Joi.ref('startDate')).required().messages({
    'date.base': 'End date must be a valid date',
    'date.format': 'End date must be in ISO format',
    'date.min': 'End date must be after start date',
    'any.required': 'End date is required'
  }),
  includeBreakdown: Joi.boolean().optional().default(true),
  includeBenchmarks: Joi.boolean().optional().default(true),
  includeRecommendations: Joi.boolean().optional().default(true)
});

/**
 * Middleware function to validate request parameters
 */
export const validateProductivityInsightsRequest = (schema: Joi.ObjectSchema) => {
  return (req: any, res: any, next: any) => {
    const { error } = schema.validate({
      ...req.params,
      ...req.query,
      ...req.body
    }, {
      abortEarly: false,
      allowUnknown: false,
      stripUnknown: true
    });

    if (error) {
      const errorDetails = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message,
        value: detail.context?.value
      }));

      return res.status(400).json({
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: errorDetails
      });
    }

    next();
  };
};

/**
 * Combined validation schemas for different endpoints
 */
export const validationSchemas = {
  dateRangeQuery: dateRangeQuerySchema,
  technicianIdParam: technicianIdParamSchema,
  teamProductivityReport: teamProductivityReportSchema,
  productivityTrends: productivityTrendsSchema,
  performanceComparison: performanceComparisonSchema,
  dashboard: dashboardQuerySchema,
  throughputMetrics: throughputMetricsQuerySchema,
  resolutionAnalysis: resolutionAnalysisQuerySchema
};