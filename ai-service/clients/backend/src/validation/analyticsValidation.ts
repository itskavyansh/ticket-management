import Joi from 'joi';

// Date range validation schema
const dateRangeSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required()
});

// Dashboard metrics validation schema
export const dashboardMetricsSchema = Joi.object({
  totalTickets: Joi.number().integer().min(0).required(),
  openTickets: Joi.number().integer().min(0).required(),
  resolvedTickets: Joi.number().integer().min(0).required(),
  averageResponseTime: Joi.number().min(0).required(),
  averageResolutionTime: Joi.number().min(0).required(),
  slaComplianceRate: Joi.number().min(0).max(100).required(),
  customerSatisfactionScore: Joi.number().min(1).max(5).required(),
  technicianUtilization: Joi.number().min(0).max(100).required(),
  trends: Joi.object({
    ticketVolume: Joi.number().required(),
    responseTime: Joi.number().required(),
    resolutionTime: Joi.number().required(),
    slaCompliance: Joi.number().required(),
    satisfaction: Joi.number().required()
  }).required(),
  activeTickets: Joi.number().integer().min(0).required(),
  availableTechnicians: Joi.number().integer().min(0).required(),
  slaRiskTickets: Joi.number().integer().min(0).required(),
  overdueTickets: Joi.number().integer().min(0).required(),
  lastUpdated: Joi.date().required()
});

// Team performance metrics validation schema
export const teamPerformanceMetricsSchema = Joi.object({
  teamId: Joi.string().uuid().optional(),
  teamName: Joi.string().max(100).trim().optional(),
  period: dateRangeSchema.required(),
  totalTicketsHandled: Joi.number().integer().min(0).required(),
  averageResolutionTime: Joi.number().min(0).required(),
  slaComplianceRate: Joi.number().min(0).max(100).required(),
  customerSatisfactionScore: Joi.number().min(1).max(5).required(),
  firstCallResolutionRate: Joi.number().min(0).max(100).required(),
  technicianMetrics: Joi.array().items(Joi.object({
    technicianId: Joi.string().uuid().required(),
    period: dateRangeSchema.required(),
    ticketsResolved: Joi.number().integer().min(0).required(),
    averageResolutionTime: Joi.number().min(0).required(),
    slaComplianceRate: Joi.number().min(0).max(100).required(),
    customerSatisfactionScore: Joi.number().min(1).max(5).required(),
    utilizationRate: Joi.number().min(0).max(100).required(),
    firstCallResolutionRate: Joi.number().min(0).max(100).required()
  })).required(),
  workloadDistribution: Joi.array().items(Joi.object({
    technicianId: Joi.string().uuid().required(),
    technicianName: Joi.string().max(100).trim().required(),
    ticketsAssigned: Joi.number().integer().min(0).required(),
    utilizationRate: Joi.number().min(0).max(100).required(),
    performanceScore: Joi.number().min(0).max(100).required()
  })).required(),
  categoryPerformance: Joi.array().items(Joi.object({
    category: Joi.string().max(100).required(),
    ticketCount: Joi.number().integer().min(0).required(),
    averageResolutionTime: Joi.number().min(0).required(),
    slaComplianceRate: Joi.number().min(0).max(100).required()
  })).required()
});

// Trend analysis validation schema
export const trendAnalysisSchema = Joi.object({
  metric: Joi.string().required().max(100).trim(),
  period: dateRangeSchema.required(),
  dataPoints: Joi.array().items(Joi.object({
    date: Joi.date().required(),
    value: Joi.number().required(),
    target: Joi.number().optional()
  })).min(1).required(),
  trend: Joi.string().valid('increasing', 'decreasing', 'stable').required(),
  trendPercentage: Joi.number().required(),
  seasonality: Joi.object({
    pattern: Joi.string().valid('daily', 'weekly', 'monthly').required(),
    strength: Joi.number().min(0).max(1).required()
  }).optional(),
  forecast: Joi.array().items(Joi.object({
    date: Joi.date().required(),
    predictedValue: Joi.number().required(),
    confidence: Joi.number().min(0).max(1).required()
  })).optional()
});

// Bottleneck analysis validation schema
export const bottleneckAnalysisSchema = Joi.object({
  type: Joi.string().valid('technician', 'category', 'customer', 'process').required(),
  identifier: Joi.string().required().max(100).trim(),
  description: Joi.string().required().max(500).trim(),
  impact: Joi.string().valid('low', 'medium', 'high', 'critical').required(),
  metrics: Joi.object({
    affectedTickets: Joi.number().integer().min(0).required(),
    delayImpact: Joi.number().min(0).required(),
    slaRisk: Joi.number().min(0).max(100).required()
  }).required(),
  recommendations: Joi.array().items(Joi.string().max(200)).min(1).required(),
  detectedAt: Joi.date().required()
});

// KPI target validation schema
export const kpiTargetSchema = Joi.object({
  metric: Joi.string().required().max(100).trim(),
  target: Joi.number().required(),
  unit: Joi.string().required().max(50).trim(),
  period: Joi.string().valid('daily', 'weekly', 'monthly', 'quarterly').required(),
  threshold: Joi.object({
    warning: Joi.number().required(),
    critical: Joi.number().required()
  }).required(),
  isActive: Joi.boolean().required()
});

// Report configuration validation schema
export const reportConfigurationSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  description: Joi.string().max(500).trim().optional(),
  type: Joi.string().valid('dashboard', 'performance', 'sla', 'customer', 'custom').required(),
  metrics: Joi.array().items(Joi.string().max(100)).min(1).required(),
  filters: Joi.object({
    dateRange: dateRangeSchema.optional(),
    technicians: Joi.array().items(Joi.string().uuid()).optional(),
    customers: Joi.array().items(Joi.string().uuid()).optional(),
    categories: Joi.array().items(Joi.string().max(100)).optional(),
    priorities: Joi.array().items(Joi.string().max(50)).optional()
  }).optional(),
  schedule: Joi.object({
    frequency: Joi.string().valid('daily', 'weekly', 'monthly').required(),
    time: Joi.string().pattern(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/).required(),
    timezone: Joi.string().max(50).required(),
    recipients: Joi.array().items(Joi.string().email()).min(1).required()
  }).optional(),
  format: Joi.string().valid('pdf', 'csv', 'excel', 'json').required(),
  includeCharts: Joi.boolean().required(),
  createdBy: Joi.string().uuid().required(),
  isActive: Joi.boolean().required()
});

// Capacity prediction validation schema
export const capacityPredictionSchema = Joi.object({
  period: dateRangeSchema.required(),
  predictedTicketVolume: Joi.number().integer().min(0).required(),
  requiredTechnicianHours: Joi.number().min(0).required(),
  availableTechnicianHours: Joi.number().min(0).required(),
  capacityUtilization: Joi.number().min(0).max(100).required(),
  staffingGap: Joi.number().required(),
  recommendedActions: Joi.array().items(Joi.object({
    action: Joi.string().valid('hire', 'reassign', 'overtime', 'training').required(),
    priority: Joi.string().valid('low', 'medium', 'high').required(),
    description: Joi.string().max(200).trim().required(),
    estimatedImpact: Joi.number().required()
  })).required(),
  risks: Joi.array().items(Joi.object({
    type: Joi.string().valid('sla_breach', 'overload', 'skill_gap').required(),
    probability: Joi.number().min(0).max(1).required(),
    impact: Joi.string().valid('low', 'medium', 'high').required(),
    mitigation: Joi.array().items(Joi.string().max(200)).min(1).required()
  })).required(),
  confidence: Joi.number().min(0).max(1).required(),
  generatedAt: Joi.date().required()
});

// Alert configuration validation schema
export const alertConfigurationSchema = Joi.object({
  name: Joi.string().required().min(2).max(100).trim(),
  description: Joi.string().max(500).trim().optional(),
  metric: Joi.string().required().max(100).trim(),
  operator: Joi.string().valid('gt', 'lt', 'eq', 'gte', 'lte').required(),
  threshold: Joi.number().required(),
  duration: Joi.number().integer().min(1).max(1440).required(), // max 24 hours
  severity: Joi.string().valid('info', 'warning', 'error', 'critical').required(),
  channels: Joi.array().items(Joi.object({
    type: Joi.string().valid('email', 'slack', 'teams', 'webhook').required(),
    target: Joi.string().required().max(200),
    template: Joi.string().max(100).optional()
  })).min(1).required(),
  suppressionRules: Joi.object({
    cooldownPeriod: Joi.number().integer().min(1).max(1440).required(),
    maxAlertsPerHour: Joi.number().integer().min(1).max(100).required(),
    businessHoursOnly: Joi.boolean().required()
  }).optional(),
  isActive: Joi.boolean().required(),
  createdBy: Joi.string().uuid().required()
});

// Analytics query validation schema
export const analyticsQuerySchema = Joi.object({
  metrics: Joi.array().items(Joi.string().max(100)).min(1).required(),
  period: dateRangeSchema.required(),
  filters: Joi.object({
    technicians: Joi.array().items(Joi.string().uuid()).optional(),
    customers: Joi.array().items(Joi.string().uuid()).optional(),
    categories: Joi.array().items(Joi.string().max(100)).optional(),
    priorities: Joi.array().items(Joi.string().max(50)).optional(),
    departments: Joi.array().items(Joi.string().max(100)).optional()
  }).optional(),
  groupBy: Joi.array().items(Joi.string().valid('day', 'week', 'month', 'technician', 'category', 'priority', 'customer')).optional(),
  aggregation: Joi.string().valid('sum', 'avg', 'min', 'max', 'count').optional().default('avg')
});

// Validation helper functions
export const validateDashboardMetrics = (data: any) => {
  return dashboardMetricsSchema.validate(data, { abortEarly: false });
};

export const validateTeamPerformanceMetrics = (data: any) => {
  return teamPerformanceMetricsSchema.validate(data, { abortEarly: false });
};

export const validateTrendAnalysis = (data: any) => {
  return trendAnalysisSchema.validate(data, { abortEarly: false });
};

export const validateBottleneckAnalysis = (data: any) => {
  return bottleneckAnalysisSchema.validate(data, { abortEarly: false });
};

export const validateKPITarget = (data: any) => {
  return kpiTargetSchema.validate(data, { abortEarly: false });
};

export const validateReportConfiguration = (data: any) => {
  return reportConfigurationSchema.validate(data, { abortEarly: false });
};

export const validateCapacityPrediction = (data: any) => {
  return capacityPredictionSchema.validate(data, { abortEarly: false });
};

export const validateAlertConfiguration = (data: any) => {
  return alertConfigurationSchema.validate(data, { abortEarly: false });
};

export const validateAnalyticsQuery = (data: any) => {
  return analyticsQuerySchema.validate(data, { abortEarly: false });
};

// Dashboard widget validation schema
export const dashboardWidgetSchema = Joi.object({
  widgets: Joi.array().items(
    Joi.string().valid(
      'kpi-summary',
      'ticket-volume',
      'response-times',
      'sla-compliance',
      'technician-workload',
      'category-breakdown',
      'customer-satisfaction',
      'recent-activity'
    )
  ).optional(),
  startDate: Joi.date().optional(),
  endDate: Joi.date().min(Joi.ref('startDate')).optional(),
  technicians: Joi.array().items(Joi.string().uuid()).optional(),
  customers: Joi.array().items(Joi.string().uuid()).optional(),
  categories: Joi.array().items(Joi.string().max(100)).optional(),
  priorities: Joi.array().items(Joi.string().max(50)).optional()
});

// Chart data validation schema
export const chartDataSchema = Joi.object({
  chartType: Joi.string().valid(
    'ticket-trend',
    'response-time-trend',
    'sla-performance',
    'technician-performance',
    'category-distribution',
    'priority-distribution',
    'customer-activity',
    'workload-heatmap'
  ).required(),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  granularity: Joi.string().valid('hourly', 'daily', 'weekly', 'monthly').optional().default('daily'),
  technicians: Joi.array().items(Joi.string().uuid()).optional(),
  customers: Joi.array().items(Joi.string().uuid()).optional(),
  categories: Joi.array().items(Joi.string().max(100)).optional(),
  priorities: Joi.array().items(Joi.string().max(50)).optional()
});

// Filtered data validation schema
export const filteredDataSchema = Joi.object({
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  technicians: Joi.array().items(Joi.string().uuid()).optional(),
  customers: Joi.array().items(Joi.string().uuid()).optional(),
  categories: Joi.array().items(Joi.string().max(100)).optional(),
  priorities: Joi.array().items(Joi.string().max(50)).optional(),
  departments: Joi.array().items(Joi.string().max(100)).optional(),
  slaStatus: Joi.array().items(Joi.string().valid('met', 'breached', 'at_risk')).optional(),
  ticketStatus: Joi.array().items(Joi.string().max(50)).optional(),
  groupBy: Joi.string().valid('day', 'week', 'month', 'technician', 'category', 'priority', 'customer').optional().default('day'),
  sortBy: Joi.string().valid('date', 'tickets', 'response_time', 'resolution_time', 'sla_compliance', 'satisfaction').optional().default('date'),
  sortOrder: Joi.string().valid('asc', 'desc').optional().default('desc'),
  limit: Joi.number().integer().min(1).max(1000).optional().default(100),
  offset: Joi.number().integer().min(0).optional().default(0)
});

// Export PDF validation schema
export const exportPDFSchema = Joi.object({
  reportType: Joi.string().valid('dashboard', 'performance', 'sla', 'customer').optional().default('dashboard'),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  technicians: Joi.array().items(Joi.string().uuid()).optional(),
  customers: Joi.array().items(Joi.string().uuid()).optional(),
  categories: Joi.array().items(Joi.string().max(100)).optional(),
  priorities: Joi.array().items(Joi.string().max(50)).optional(),
  includeCharts: Joi.boolean().optional().default(true),
  template: Joi.string().valid('standard', 'detailed', 'summary').optional().default('standard')
});

// Export CSV validation schema
export const exportCSVSchema = Joi.object({
  dataType: Joi.string().valid('tickets', 'performance', 'sla', 'analytics').optional().default('tickets'),
  startDate: Joi.date().required(),
  endDate: Joi.date().min(Joi.ref('startDate')).required(),
  technicians: Joi.array().items(Joi.string().uuid()).optional(),
  customers: Joi.array().items(Joi.string().uuid()).optional(),
  categories: Joi.array().items(Joi.string().max(100)).optional(),
  priorities: Joi.array().items(Joi.string().max(50)).optional(),
  columns: Joi.array().items(Joi.string().max(100)).optional(),
  includeHeaders: Joi.boolean().optional().default(true)
});

// Validation helper functions for dashboard endpoints
export const validateDashboardWidget = (data: any) => {
  return dashboardWidgetSchema.validate(data, { abortEarly: false });
};

export const validateChartData = (data: any) => {
  return chartDataSchema.validate(data, { abortEarly: false });
};

export const validateFilteredData = (data: any) => {
  return filteredDataSchema.validate(data, { abortEarly: false });
};

export const validateExportPDF = (data: any) => {
  return exportPDFSchema.validate(data, { abortEarly: false });
};

export const validateExportCSV = (data: any) => {
  return exportCSVSchema.validate(data, { abortEarly: false });
};