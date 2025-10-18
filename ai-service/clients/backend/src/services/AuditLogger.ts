import { logger } from '../utils/logger';
import { DataMaskingUtils } from '../utils/encryption';

/**
 * Comprehensive audit logging service for compliance and security monitoring
 */
export class AuditLogger {
  private static instance: AuditLogger;
  private auditLogs: AuditLogEntry[] = [];
  private readonly maxInMemoryLogs = 10000;

  private constructor() {}

  /**
   * Get singleton instance
   */
  static getInstance(): AuditLogger {
    if (!AuditLogger.instance) {
      AuditLogger.instance = new AuditLogger();
    }
    return AuditLogger.instance;
  }

  /**
   * Log user authentication events
   */
  logAuthentication(event: AuthenticationEvent): void {
    const auditEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: AuditCategory.AUTHENTICATION,
      action: event.action,
      userId: event.userId,
      userEmail: DataMaskingUtils.maskEmail(event.userEmail || ''),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success,
      details: {
        loginMethod: event.loginMethod,
        failureReason: event.failureReason,
        sessionId: event.sessionId,
        mfaUsed: event.mfaUsed
      },
      riskLevel: event.success ? RiskLevel.LOW : RiskLevel.MEDIUM,
      compliance: {
        gdpr: true,
        sox: true,
        hipaa: false
      }
    };

    this.writeAuditLog(auditEntry);
  }

  /**
   * Log data access events
   */
  logDataAccess(event: DataAccessEvent): void {
    const auditEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: AuditCategory.DATA_ACCESS,
      action: event.action,
      userId: event.userId,
      userEmail: DataMaskingUtils.maskEmail(event.userEmail || ''),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success,
      details: {
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        dataFields: event.dataFields,
        queryParameters: this.sanitizeQueryParams(event.queryParameters),
        recordCount: event.recordCount
      },
      riskLevel: this.calculateDataAccessRisk(event),
      compliance: {
        gdpr: true,
        sox: event.resourceType === 'financial_data',
        hipaa: event.resourceType === 'health_data'
      }
    };

    this.writeAuditLog(auditEntry);
  }

  /**
   * Log data modification events
   */
  logDataModification(event: DataModificationEvent): void {
    const auditEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: AuditCategory.DATA_MODIFICATION,
      action: event.action,
      userId: event.userId,
      userEmail: DataMaskingUtils.maskEmail(event.userEmail || ''),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success,
      details: {
        resourceType: event.resourceType,
        resourceId: event.resourceId,
        oldValues: this.sanitizeDataValues(event.oldValues),
        newValues: this.sanitizeDataValues(event.newValues),
        changedFields: event.changedFields
      },
      riskLevel: this.calculateModificationRisk(event),
      compliance: {
        gdpr: true,
        sox: event.resourceType === 'financial_data',
        hipaa: event.resourceType === 'health_data'
      }
    };

    this.writeAuditLog(auditEntry);
  }

  /**
   * Log administrative actions
   */
  logAdministrativeAction(event: AdministrativeEvent): void {
    const auditEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: AuditCategory.ADMINISTRATIVE,
      action: event.action,
      userId: event.userId,
      userEmail: DataMaskingUtils.maskEmail(event.userEmail || ''),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success,
      details: {
        targetUserId: event.targetUserId,
        targetUserEmail: DataMaskingUtils.maskEmail(event.targetUserEmail || ''),
        roleChanges: event.roleChanges,
        permissionChanges: event.permissionChanges,
        configurationChanges: event.configurationChanges
      },
      riskLevel: RiskLevel.HIGH,
      compliance: {
        gdpr: true,
        sox: true,
        hipaa: true
      }
    };

    this.writeAuditLog(auditEntry);
  }

  /**
   * Log security events
   */
  logSecurityEvent(event: SecurityEvent): void {
    const auditEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: AuditCategory.SECURITY,
      action: event.action,
      userId: event.userId,
      userEmail: DataMaskingUtils.maskEmail(event.userEmail || ''),
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: event.success,
      details: {
        threatType: event.threatType,
        severity: event.severity,
        blocked: event.blocked,
        ruleTriggered: event.ruleTriggered,
        additionalContext: event.additionalContext
      },
      riskLevel: this.mapSeverityToRisk(event.severity),
      compliance: {
        gdpr: true,
        sox: true,
        hipaa: true
      }
    };

    this.writeAuditLog(auditEntry);
  }

  /**
   * Log system events
   */
  logSystemEvent(event: SystemEvent): void {
    const auditEntry: AuditLogEntry = {
      id: this.generateAuditId(),
      timestamp: new Date().toISOString(),
      category: AuditCategory.SYSTEM,
      action: event.action,
      userId: 'system',
      userEmail: 'system@ai-ticket-management.com',
      ipAddress: 'localhost',
      userAgent: 'system',
      success: event.success,
      details: {
        component: event.component,
        version: event.version,
        errorMessage: event.errorMessage,
        stackTrace: event.stackTrace,
        performanceMetrics: event.performanceMetrics
      },
      riskLevel: event.success ? RiskLevel.LOW : RiskLevel.MEDIUM,
      compliance: {
        gdpr: false,
        sox: true,
        hipaa: false
      }
    };

    this.writeAuditLog(auditEntry);
  }

  /**
   * Get audit logs with filtering and pagination
   */
  getAuditLogs(filters: AuditLogFilters): AuditLogResult {
    let filteredLogs = [...this.auditLogs];

    // Apply filters
    if (filters.startDate) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) >= new Date(filters.startDate!)
      );
    }

    if (filters.endDate) {
      filteredLogs = filteredLogs.filter(log => 
        new Date(log.timestamp) <= new Date(filters.endDate!)
      );
    }

    if (filters.category) {
      filteredLogs = filteredLogs.filter(log => log.category === filters.category);
    }

    if (filters.userId) {
      filteredLogs = filteredLogs.filter(log => log.userId === filters.userId);
    }

    if (filters.action) {
      filteredLogs = filteredLogs.filter(log => 
        log.action.toLowerCase().includes(filters.action!.toLowerCase())
      );
    }

    if (filters.riskLevel) {
      filteredLogs = filteredLogs.filter(log => log.riskLevel === filters.riskLevel);
    }

    if (filters.success !== undefined) {
      filteredLogs = filteredLogs.filter(log => log.success === filters.success);
    }

    // Sort by timestamp (newest first)
    filteredLogs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    // Apply pagination
    const offset = (filters.page - 1) * filters.limit;
    const paginatedLogs = filteredLogs.slice(offset, offset + filters.limit);

    return {
      logs: paginatedLogs,
      total: filteredLogs.length,
      page: filters.page,
      limit: filters.limit,
      totalPages: Math.ceil(filteredLogs.length / filters.limit)
    };
  }

  /**
   * Generate compliance report
   */
  generateComplianceReport(
    startDate: string, 
    endDate: string, 
    complianceType: ComplianceType
  ): ComplianceReport {
    const logs = this.auditLogs.filter(log => {
      const logDate = new Date(log.timestamp);
      return logDate >= new Date(startDate) && 
             logDate <= new Date(endDate) &&
             log.compliance[complianceType];
    });

    const report: ComplianceReport = {
      complianceType,
      reportPeriod: { startDate, endDate },
      totalEvents: logs.length,
      eventsByCategory: this.groupByCategory(logs),
      riskDistribution: this.groupByRiskLevel(logs),
      failedEvents: logs.filter(log => !log.success).length,
      highRiskEvents: logs.filter(log => log.riskLevel === RiskLevel.HIGH).length,
      userActivity: this.getUserActivitySummary(logs),
      generatedAt: new Date().toISOString()
    };

    return report;
  }

  /**
   * Export audit logs to various formats
   */
  exportAuditLogs(
    filters: AuditLogFilters, 
    format: ExportFormat
  ): ExportResult {
    const result = this.getAuditLogs(filters);
    
    switch (format) {
      case ExportFormat.CSV:
        return {
          format,
          data: this.convertToCSV(result.logs),
          filename: `audit_logs_${new Date().toISOString().split('T')[0]}.csv`
        };
      
      case ExportFormat.JSON:
        return {
          format,
          data: JSON.stringify(result, null, 2),
          filename: `audit_logs_${new Date().toISOString().split('T')[0]}.json`
        };
      
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * Clear old audit logs based on retention policy
   */
  cleanupOldLogs(retentionDays: number = 365): number {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const initialCount = this.auditLogs.length;
    this.auditLogs = this.auditLogs.filter(log => 
      new Date(log.timestamp) > cutoffDate
    );

    const deletedCount = initialCount - this.auditLogs.length;
    
    if (deletedCount > 0) {
      logger.info(`Cleaned up ${deletedCount} old audit logs`, {
        retentionDays,
        cutoffDate: cutoffDate.toISOString()
      });
    }

    return deletedCount;
  }

  // Private helper methods

  private writeAuditLog(entry: AuditLogEntry): void {
    // Add to in-memory storage
    this.auditLogs.push(entry);

    // Maintain memory limit
    if (this.auditLogs.length > this.maxInMemoryLogs) {
      this.auditLogs.shift();
    }

    // Log to structured logger for external aggregation
    logger.info('Audit log entry', {
      auditId: entry.id,
      category: entry.category,
      action: entry.action,
      userId: entry.userId,
      success: entry.success,
      riskLevel: entry.riskLevel,
      timestamp: entry.timestamp
    });

    // For high-risk events, also log as warning
    if (entry.riskLevel === RiskLevel.HIGH || entry.riskLevel === RiskLevel.CRITICAL) {
      logger.warn('High-risk audit event detected', {
        auditId: entry.id,
        category: entry.category,
        action: entry.action,
        userId: entry.userId,
        details: entry.details
      });
    }
  }

  private generateAuditId(): string {
    return `audit_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
  }

  private calculateDataAccessRisk(event: DataAccessEvent): RiskLevel {
    if (event.resourceType === 'user_credentials' || event.resourceType === 'api_keys') {
      return RiskLevel.HIGH;
    }
    
    if (event.recordCount && event.recordCount > 1000) {
      return RiskLevel.MEDIUM;
    }
    
    return RiskLevel.LOW;
  }

  private calculateModificationRisk(event: DataModificationEvent): RiskLevel {
    if (event.resourceType === 'user_roles' || event.resourceType === 'permissions') {
      return RiskLevel.HIGH;
    }
    
    if (event.changedFields && event.changedFields.length > 5) {
      return RiskLevel.MEDIUM;
    }
    
    return RiskLevel.LOW;
  }

  private mapSeverityToRisk(severity: string): RiskLevel {
    switch (severity.toLowerCase()) {
      case 'critical': return RiskLevel.CRITICAL;
      case 'high': return RiskLevel.HIGH;
      case 'medium': return RiskLevel.MEDIUM;
      case 'low': return RiskLevel.LOW;
      default: return RiskLevel.LOW;
    }
  }

  private sanitizeQueryParams(params: any): any {
    if (!params) return null;
    
    const sanitized = { ...params };
    const sensitiveKeys = ['password', 'token', 'secret', 'key', 'apiKey'];
    
    for (const key of sensitiveKeys) {
      if (key in sanitized) {
        sanitized[key] = '[REDACTED]';
      }
    }
    
    return sanitized;
  }

  private sanitizeDataValues(values: any): any {
    if (!values) return null;
    
    return DataMaskingUtils.sanitizeForLogging(values);
  }

  private groupByCategory(logs: AuditLogEntry[]): Record<string, number> {
    return logs.reduce((acc, log) => {
      acc[log.category] = (acc[log.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private groupByRiskLevel(logs: AuditLogEntry[]): Record<string, number> {
    return logs.reduce((acc, log) => {
      acc[log.riskLevel] = (acc[log.riskLevel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
  }

  private getUserActivitySummary(logs: AuditLogEntry[]): UserActivitySummary[] {
    const userMap = new Map<string, UserActivitySummary>();
    
    for (const log of logs) {
      if (log.userId === 'system') continue;
      
      if (!userMap.has(log.userId)) {
        userMap.set(log.userId, {
          userId: log.userId,
          userEmail: log.userEmail,
          totalEvents: 0,
          failedEvents: 0,
          lastActivity: log.timestamp
        });
      }
      
      const summary = userMap.get(log.userId)!;
      summary.totalEvents++;
      
      if (!log.success) {
        summary.failedEvents++;
      }
      
      if (new Date(log.timestamp) > new Date(summary.lastActivity)) {
        summary.lastActivity = log.timestamp;
      }
    }
    
    return Array.from(userMap.values());
  }

  private convertToCSV(logs: AuditLogEntry[]): string {
    const headers = [
      'ID', 'Timestamp', 'Category', 'Action', 'User ID', 'User Email',
      'IP Address', 'Success', 'Risk Level', 'Details'
    ];
    
    const rows = logs.map(log => [
      log.id,
      log.timestamp,
      log.category,
      log.action,
      log.userId,
      log.userEmail,
      log.ipAddress,
      log.success.toString(),
      log.riskLevel,
      JSON.stringify(log.details)
    ]);
    
    const csvContent = [headers, ...rows]
      .map(row => row.map(field => `"${field}"`).join(','))
      .join('\n');
    
    return csvContent;
  }
}

// Enums and interfaces

export enum AuditCategory {
  AUTHENTICATION = 'authentication',
  DATA_ACCESS = 'data_access',
  DATA_MODIFICATION = 'data_modification',
  ADMINISTRATIVE = 'administrative',
  SECURITY = 'security',
  SYSTEM = 'system'
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum ComplianceType {
  GDPR = 'gdpr',
  SOX = 'sox',
  HIPAA = 'hipaa'
}

export enum ExportFormat {
  CSV = 'csv',
  JSON = 'json'
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  category: AuditCategory;
  action: string;
  userId: string;
  userEmail: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  details: any;
  riskLevel: RiskLevel;
  compliance: {
    gdpr: boolean;
    sox: boolean;
    hipaa: boolean;
  };
}

export interface AuthenticationEvent {
  action: string;
  userId: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  loginMethod?: string;
  failureReason?: string;
  sessionId?: string;
  mfaUsed?: boolean;
}

export interface DataAccessEvent {
  action: string;
  userId: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  resourceType: string;
  resourceId: string;
  dataFields?: string[];
  queryParameters?: any;
  recordCount?: number;
}

export interface DataModificationEvent {
  action: string;
  userId: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  resourceType: string;
  resourceId: string;
  oldValues?: any;
  newValues?: any;
  changedFields?: string[];
}

export interface AdministrativeEvent {
  action: string;
  userId: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  targetUserId?: string;
  targetUserEmail?: string;
  roleChanges?: any;
  permissionChanges?: any;
  configurationChanges?: any;
}

export interface SecurityEvent {
  action: string;
  userId?: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  threatType: string;
  severity: string;
  blocked: boolean;
  ruleTriggered?: string;
  additionalContext?: any;
}

export interface SystemEvent {
  action: string;
  success: boolean;
  component: string;
  version?: string;
  errorMessage?: string;
  stackTrace?: string;
  performanceMetrics?: any;
}

export interface AuditLogFilters {
  startDate?: string;
  endDate?: string;
  category?: AuditCategory;
  userId?: string;
  action?: string;
  riskLevel?: RiskLevel;
  success?: boolean;
  page: number;
  limit: number;
}

export interface AuditLogResult {
  logs: AuditLogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ComplianceReport {
  complianceType: ComplianceType;
  reportPeriod: {
    startDate: string;
    endDate: string;
  };
  totalEvents: number;
  eventsByCategory: Record<string, number>;
  riskDistribution: Record<string, number>;
  failedEvents: number;
  highRiskEvents: number;
  userActivity: UserActivitySummary[];
  generatedAt: string;
}

export interface UserActivitySummary {
  userId: string;
  userEmail: string;
  totalEvents: number;
  failedEvents: number;
  lastActivity: string;
}

export interface ExportResult {
  format: ExportFormat;
  data: string;
  filename: string;
}

// Export singleton instance
export const auditLogger = AuditLogger.getInstance();