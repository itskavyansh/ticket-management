/**
 * Monitoring configuration for the AI Ticket Management Platform
 * Defines thresholds, alert rules, and monitoring settings
 */

export interface MonitoringConfig {
  // Alert thresholds
  thresholds: {
    api: {
      errorRatePercent: number;
      latencyMs: number;
      requestsPerMinute: number;
    };
    lambda: {
      errorCount: number;
      durationMs: number;
      throttleCount: number;
      memoryUtilizationPercent: number;
    };
    database: {
      cpuUtilizationPercent: number;
      connectionCount: number;
      queryLatencyMs: number;
    };
    business: {
      ticketProcessingTimeMs: number;
      slaBreachRiskCount: number;
      slaCompliancePercent: number;
      technicianUtilizationPercent: number;
    };
    ai: {
      inferenceTimeMs: number;
      accuracyPercent: number;
      confidencePercent: number;
    };
  };
  
  // Evaluation periods for alarms
  evaluationPeriods: {
    critical: number;
    warning: number;
    info: number;
  };
  
  // Notification settings
  notifications: {
    email: string[];
    slack: {
      webhookUrl?: string;
      channel: string;
    };
    teams: {
      webhookUrl?: string;
    };
  };
  
  // Log retention settings
  logRetention: {
    application: number; // days
    audit: number; // days
    performance: number; // days
  };
  
  // Dashboard refresh intervals
  dashboardRefresh: {
    realTime: number; // seconds
    historical: number; // seconds
  };
}

export const PRODUCTION_CONFIG: MonitoringConfig = {
  thresholds: {
    api: {
      errorRatePercent: 5,
      latencyMs: 2000,
      requestsPerMinute: 1000,
    },
    lambda: {
      errorCount: 5,
      durationMs: 10000,
      throttleCount: 1,
      memoryUtilizationPercent: 80,
    },
    database: {
      cpuUtilizationPercent: 80,
      connectionCount: 16, // 80% of t3.micro max (20)
      queryLatencyMs: 1000,
    },
    business: {
      ticketProcessingTimeMs: 30000, // 30 seconds
      slaBreachRiskCount: 10,
      slaCompliancePercent: 95,
      technicianUtilizationPercent: 90,
    },
    ai: {
      inferenceTimeMs: 5000, // 5 seconds
      accuracyPercent: 85,
      confidencePercent: 70,
    },
  },
  
  evaluationPeriods: {
    critical: 1,
    warning: 2,
    info: 3,
  },
  
  notifications: {
    email: ['admin@company.com', 'devops@company.com'],
    slack: {
      channel: '#alerts-production',
    },
    teams: {},
  },
  
  logRetention: {
    application: 30,
    audit: 365,
    performance: 90,
  },
  
  dashboardRefresh: {
    realTime: 30,
    historical: 300,
  },
};

export const DEVELOPMENT_CONFIG: MonitoringConfig = {
  ...PRODUCTION_CONFIG,
  thresholds: {
    ...PRODUCTION_CONFIG.thresholds,
    api: {
      errorRatePercent: 10,
      latencyMs: 5000,
      requestsPerMinute: 100,
    },
    lambda: {
      errorCount: 10,
      durationMs: 30000,
      throttleCount: 5,
      memoryUtilizationPercent: 90,
    },
  },
  
  notifications: {
    email: ['dev@company.com'],
    slack: {
      channel: '#alerts-development',
    },
    teams: {},
  },
  
  logRetention: {
    application: 7,
    audit: 30,
    performance: 14,
  },
};

/**
 * Alert severity levels
 */
export enum AlertSeverity {
  CRITICAL = 'CRITICAL',
  WARNING = 'WARNING',
  INFO = 'INFO',
}

/**
 * Metric categories for organization
 */
export enum MetricCategory {
  INFRASTRUCTURE = 'Infrastructure',
  APPLICATION = 'Application',
  BUSINESS = 'Business',
  SECURITY = 'Security',
  AI_ML = 'AI/ML',
}

/**
 * Standard metric names used across the platform
 */
export const METRIC_NAMES = {
  // Business metrics
  TICKETS_CREATED: 'TicketsCreated',
  TICKETS_RESOLVED: 'TicketsResolved',
  TICKET_PROCESSING_TIME: 'TicketProcessingTime',
  TICKET_RESOLUTION_TIME: 'TicketResolutionTime',
  SLA_COMPLIANCE_RATE: 'SLAComplianceRate',
  TICKETS_AT_RISK_OF_SLA_BREACH: 'TicketsAtRiskOfSLABreach',
  
  // Technician metrics
  TECHNICIAN_ACTIVE_TICKETS: 'TechnicianActiveTickets',
  TECHNICIAN_UTILIZATION: 'TechnicianUtilization',
  TECHNICIAN_AVG_RESOLUTION_TIME: 'TechnicianAvgResolutionTime',
  
  // AI/ML metrics
  AI_MODEL_ACCURACY: 'AIModelAccuracy',
  AI_MODEL_INFERENCE_TIME: 'AIModelInferenceTime',
  AI_MODEL_CONFIDENCE: 'AIModelConfidence',
  
  // Integration metrics
  INTEGRATION_HEALTH: 'IntegrationHealth',
  INTEGRATION_RESPONSE_TIME: 'IntegrationResponseTime',
  INTEGRATION_ERRORS: 'IntegrationErrors',
  
  // Security metrics
  AUTHENTICATION_FAILURES: 'AuthenticationFailures',
  AUTHORIZATION_VIOLATIONS: 'AuthorizationViolations',
  SUSPICIOUS_ACTIVITIES: 'SuspiciousActivities',
} as const;

/**
 * CloudWatch Insights query templates
 */
export const LOG_INSIGHTS_QUERIES = {
  ERROR_ANALYSIS: `
    fields @timestamp, @message, @logStream, @requestId
    | filter @message like /ERROR/
    | stats count() by bin(5m)
    | sort @timestamp desc
  `,
  
  PERFORMANCE_ANALYSIS: `
    fields @timestamp, @duration, @requestId, @memoryUsed
    | filter @type = "REPORT"
    | stats avg(@duration), max(@duration), min(@duration), avg(@memoryUsed) by bin(5m)
    | sort @timestamp desc
  `,
  
  SLOW_REQUESTS: `
    fields @timestamp, @requestId, @duration
    | filter @duration > 5000
    | sort @timestamp desc
    | limit 100
  `,
  
  AUTHENTICATION_EVENTS: `
    fields @timestamp, @message, @requestId
    | filter @message like /AUTH/
    | stats count() by bin(1h)
    | sort @timestamp desc
  `,
  
  AI_MODEL_PERFORMANCE: `
    fields @timestamp, @message, @requestId
    | filter @message like /AI_INFERENCE/
    | parse @message "inference_time=* confidence=* accuracy=*"
    | stats avg(inference_time), avg(confidence), avg(accuracy) by bin(10m)
    | sort @timestamp desc
  `,
} as const;

/**
 * Dashboard widget configurations
 */
export const DASHBOARD_WIDGETS = {
  API_GATEWAY: {
    title: 'API Gateway Metrics',
    width: 12,
    height: 6,
  },
  LAMBDA_FUNCTIONS: {
    title: 'Lambda Function Metrics',
    width: 12,
    height: 6,
  },
  DATABASE: {
    title: 'Database Metrics',
    width: 12,
    height: 6,
  },
  BUSINESS_METRICS: {
    title: 'Business Metrics',
    width: 12,
    height: 6,
  },
  AI_PERFORMANCE: {
    title: 'AI Model Performance',
    width: 12,
    height: 6,
  },
} as const;