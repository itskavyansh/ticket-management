import express from 'express';
import { 
  auditLogger, 
  AuditCategory, 
  RiskLevel, 
  ComplianceType, 
  ExportFormat,
  AuditLogFilters 
} from '../services/AuditLogger';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';
import { auditAdministrativeMiddleware } from '../middleware/auditMiddleware';
import { sensitiveOperationRateLimit } from '../middleware/security';

const router = express.Router();

/**
 * Get audit logs with filtering and pagination
 * GET /api/audit/logs
 */
router.get('/logs', 
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const filters: AuditLogFilters = {
        startDate: req.query.startDate as string,
        endDate: req.query.endDate as string,
        category: req.query.category as AuditCategory,
        userId: req.query.userId as string,
        action: req.query.action as string,
        riskLevel: req.query.riskLevel as RiskLevel,
        success: req.query.success ? req.query.success === 'true' : undefined,
        page: parseInt(req.query.page as string) || 1,
        limit: Math.min(parseInt(req.query.limit as string) || 50, 1000) // Max 1000 records
      };

      const result = auditLogger.getAuditLogs(filters);

      res.json({
        success: true,
        data: result,
        message: 'Audit logs retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit logs',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Get audit log statistics
 * GET /api/audit/stats
 */
router.get('/stats',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const startDate = req.query.startDate as string || 
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(); // Last 30 days
      const endDate = req.query.endDate as string || new Date().toISOString();

      // Get all logs for the period
      const allLogs = auditLogger.getAuditLogs({
        startDate,
        endDate,
        page: 1,
        limit: 100000 // Large limit to get all logs
      });

      // Calculate statistics
      const stats = {
        totalEvents: allLogs.total,
        period: { startDate, endDate },
        eventsByCategory: {} as Record<string, number>,
        eventsByRiskLevel: {} as Record<string, number>,
        successRate: 0,
        topUsers: [] as Array<{ userId: string; eventCount: number }>,
        topActions: [] as Array<{ action: string; eventCount: number }>,
        recentHighRiskEvents: allLogs.logs
          .filter(log => log.riskLevel === RiskLevel.HIGH || log.riskLevel === RiskLevel.CRITICAL)
          .slice(0, 10)
      };

      // Group by category
      allLogs.logs.forEach(log => {
        stats.eventsByCategory[log.category] = (stats.eventsByCategory[log.category] || 0) + 1;
        stats.eventsByRiskLevel[log.riskLevel] = (stats.eventsByRiskLevel[log.riskLevel] || 0) + 1;
      });

      // Calculate success rate
      const successfulEvents = allLogs.logs.filter(log => log.success).length;
      stats.successRate = allLogs.total > 0 ? (successfulEvents / allLogs.total) * 100 : 0;

      // Top users by event count
      const userEventCounts = new Map<string, number>();
      allLogs.logs.forEach(log => {
        if (log.userId !== 'system') {
          userEventCounts.set(log.userId, (userEventCounts.get(log.userId) || 0) + 1);
        }
      });
      stats.topUsers = Array.from(userEventCounts.entries())
        .map(([userId, eventCount]) => ({ userId, eventCount }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10);

      // Top actions by frequency
      const actionCounts = new Map<string, number>();
      allLogs.logs.forEach(log => {
        actionCounts.set(log.action, (actionCounts.get(log.action) || 0) + 1);
      });
      stats.topActions = Array.from(actionCounts.entries())
        .map(([action, eventCount]) => ({ action, eventCount }))
        .sort((a, b) => b.eventCount - a.eventCount)
        .slice(0, 10);

      res.json({
        success: true,
        data: stats,
        message: 'Audit statistics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit statistics',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Generate compliance report
 * POST /api/audit/compliance-report
 */
router.post('/compliance-report',
  authenticate,
  authorize(UserRole.ADMIN),
  auditAdministrativeMiddleware,
  sensitiveOperationRateLimit,
  async (req, res) => {
    try {
      const { startDate, endDate, complianceType } = req.body;

      if (!startDate || !endDate || !complianceType) {
        return res.status(400).json({
          success: false,
          error: 'Missing required fields',
          message: 'startDate, endDate, and complianceType are required'
        });
      }

      if (!Object.values(ComplianceType).includes(complianceType)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid compliance type',
          message: `Compliance type must be one of: ${Object.values(ComplianceType).join(', ')}`
        });
      }

      const report = auditLogger.generateComplianceReport(startDate, endDate, complianceType);

      res.json({
        success: true,
        data: report,
        message: 'Compliance report generated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate compliance report',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Export audit logs
 * POST /api/audit/export
 */
router.post('/export',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  auditAdministrativeMiddleware,
  sensitiveOperationRateLimit,
  async (req, res) => {
    try {
      const { filters, format } = req.body;

      if (!format || !Object.values(ExportFormat).includes(format)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid export format',
          message: `Format must be one of: ${Object.values(ExportFormat).join(', ')}`
        });
      }

      const exportFilters: AuditLogFilters = {
        startDate: filters?.startDate,
        endDate: filters?.endDate,
        category: filters?.category,
        userId: filters?.userId,
        action: filters?.action,
        riskLevel: filters?.riskLevel,
        success: filters?.success,
        page: 1,
        limit: 10000 // Max export limit
      };

      const exportResult = auditLogger.exportAuditLogs(exportFilters, format);

      // Set appropriate headers for file download
      res.setHeader('Content-Disposition', `attachment; filename="${exportResult.filename}"`);
      
      if (format === ExportFormat.CSV) {
        res.setHeader('Content-Type', 'text/csv');
      } else if (format === ExportFormat.JSON) {
        res.setHeader('Content-Type', 'application/json');
      }

      res.send(exportResult.data);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to export audit logs',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Search audit logs
 * POST /api/audit/search
 */
router.post('/search',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const { query, filters } = req.body;

      if (!query || query.trim().length === 0) {
        return res.status(400).json({
          success: false,
          error: 'Search query is required',
          message: 'Please provide a search query'
        });
      }

      const searchFilters: AuditLogFilters = {
        ...filters,
        action: query, // Search in action field
        page: parseInt(req.body.page) || 1,
        limit: Math.min(parseInt(req.body.limit) || 50, 1000)
      };

      const result = auditLogger.getAuditLogs(searchFilters);

      // Also search in other fields
      const additionalResults = auditLogger.getAuditLogs({
        ...filters,
        userId: query,
        page: 1,
        limit: 1000
      });

      // Combine and deduplicate results
      const combinedLogs = [...result.logs];
      additionalResults.logs.forEach(log => {
        if (!combinedLogs.find(existing => existing.id === log.id)) {
          combinedLogs.push(log);
        }
      });

      res.json({
        success: true,
        data: {
          logs: combinedLogs.slice(0, searchFilters.limit),
          total: combinedLogs.length,
          page: searchFilters.page,
          limit: searchFilters.limit,
          totalPages: Math.ceil(combinedLogs.length / searchFilters.limit),
          query
        },
        message: 'Search completed successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Search failed',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Get audit log by ID
 * GET /api/audit/logs/:id
 */
router.get('/logs/:id',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const { id } = req.params;

      // Get all logs and find the specific one
      const allLogs = auditLogger.getAuditLogs({
        page: 1,
        limit: 100000
      });

      const log = allLogs.logs.find(log => log.id === id);

      if (!log) {
        return res.status(404).json({
          success: false,
          error: 'Audit log not found',
          message: `No audit log found with ID: ${id}`
        });
      }

      res.json({
        success: true,
        data: log,
        message: 'Audit log retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit log',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Clean up old audit logs
 * DELETE /api/audit/cleanup
 */
router.delete('/cleanup',
  authenticate,
  authorize(UserRole.ADMIN),
  auditAdministrativeMiddleware,
  sensitiveOperationRateLimit,
  async (req, res) => {
    try {
      const retentionDays = parseInt(req.query.retentionDays as string) || 365;

      if (retentionDays < 30) {
        return res.status(400).json({
          success: false,
          error: 'Invalid retention period',
          message: 'Retention period must be at least 30 days'
        });
      }

      const deletedCount = auditLogger.cleanupOldLogs(retentionDays);

      res.json({
        success: true,
        data: {
          deletedCount,
          retentionDays
        },
        message: `Cleaned up ${deletedCount} old audit logs`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to clean up audit logs',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Get available audit categories and risk levels
 * GET /api/audit/metadata
 */
router.get('/metadata',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      res.json({
        success: true,
        data: {
          categories: Object.values(AuditCategory),
          riskLevels: Object.values(RiskLevel),
          complianceTypes: Object.values(ComplianceType),
          exportFormats: Object.values(ExportFormat)
        },
        message: 'Audit metadata retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve audit metadata',
        message: (error as Error).message
      });
    }
  }
);

export default router;