import express from 'express';
import { securityMonitor } from '../services/SecurityMonitor';
import { authenticate, authorize } from '../middleware/auth';
import { UserRole } from '../types';
import { auditAdministrativeMiddleware } from '../middleware/auditMiddleware';
import { sensitiveOperationRateLimit } from '../middleware/security';

const router = express.Router();

/**
 * Get security metrics and dashboard data
 * GET /api/security/metrics
 */
router.get('/metrics',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const metrics = securityMonitor.getSecurityMetrics();

      res.json({
        success: true,
        data: metrics,
        message: 'Security metrics retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security metrics',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Get recent security threats
 * GET /api/security/threats
 */
router.get('/threats',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 1000);
      const threats = securityMonitor.getRecentThreats(limit);

      res.json({
        success: true,
        data: {
          threats,
          total: threats.length,
          limit
        },
        message: 'Recent threats retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve threats',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Get blocked IPs list
 * GET /api/security/blocked-ips
 */
router.get('/blocked-ips',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const blockedIPs = securityMonitor.getBlockedIPs();

      res.json({
        success: true,
        data: {
          blockedIPs,
          count: blockedIPs.length
        },
        message: 'Blocked IPs retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve blocked IPs',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Block an IP address manually
 * POST /api/security/block-ip
 */
router.post('/block-ip',
  authenticate,
  authorize(UserRole.ADMIN),
  auditAdministrativeMiddleware,
  sensitiveOperationRateLimit,
  async (req, res) => {
    try {
      const { ipAddress, reason } = req.body;

      if (!ipAddress) {
        return res.status(400).json({
          success: false,
          error: 'IP address is required',
          message: 'Please provide an IP address to block'
        });
      }

      // Validate IP address format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ipAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IP address format',
          message: 'Please provide a valid IPv4 address'
        });
      }

      // Don't allow blocking localhost or private IPs in development
      if (process.env.NODE_ENV === 'development') {
        const privateRanges = [
          /^127\./,
          /^10\./,
          /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
          /^192\.168\./
        ];

        if (privateRanges.some(range => range.test(ipAddress))) {
          return res.status(400).json({
            success: false,
            error: 'Cannot block private IP in development',
            message: 'Private IP addresses cannot be blocked in development mode'
          });
        }
      }

      const blockReason = reason || `Manually blocked by ${req.user?.email}`;
      securityMonitor.blockIP(ipAddress, blockReason);

      res.json({
        success: true,
        data: {
          ipAddress,
          reason: blockReason,
          blockedAt: new Date().toISOString()
        },
        message: 'IP address blocked successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to block IP address',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Unblock an IP address
 * POST /api/security/unblock-ip
 */
router.post('/unblock-ip',
  authenticate,
  authorize(UserRole.ADMIN),
  auditAdministrativeMiddleware,
  sensitiveOperationRateLimit,
  async (req, res) => {
    try {
      const { ipAddress } = req.body;

      if (!ipAddress) {
        return res.status(400).json({
          success: false,
          error: 'IP address is required',
          message: 'Please provide an IP address to unblock'
        });
      }

      // Check if IP is actually blocked
      if (!securityMonitor.isIPBlocked(ipAddress)) {
        return res.status(404).json({
          success: false,
          error: 'IP not blocked',
          message: 'The specified IP address is not currently blocked'
        });
      }

      securityMonitor.unblockIP(ipAddress);

      res.json({
        success: true,
        data: {
          ipAddress,
          unblockedAt: new Date().toISOString(),
          unblockedBy: req.user?.email
        },
        message: 'IP address unblocked successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to unblock IP address',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Check if an IP address is blocked
 * GET /api/security/check-ip/:ipAddress
 */
router.get('/check-ip/:ipAddress',
  authenticate,
  authorize(UserRole.ADMIN, UserRole.MANAGER),
  async (req, res) => {
    try {
      const { ipAddress } = req.params;

      // Validate IP address format
      const ipRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/;
      if (!ipRegex.test(ipAddress)) {
        return res.status(400).json({
          success: false,
          error: 'Invalid IP address format',
          message: 'Please provide a valid IPv4 address'
        });
      }

      const isBlocked = securityMonitor.isIPBlocked(ipAddress);

      res.json({
        success: true,
        data: {
          ipAddress,
          isBlocked,
          checkedAt: new Date().toISOString()
        },
        message: `IP address ${isBlocked ? 'is' : 'is not'} blocked`
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to check IP status',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Get security configuration and status
 * GET /api/security/status
 */
router.get('/status',
  authenticate,
  authorize(UserRole.ADMIN),
  async (req, res) => {
    try {
      const metrics = securityMonitor.getSecurityMetrics();
      const blockedIPs = securityMonitor.getBlockedIPs();
      const recentThreats = securityMonitor.getRecentThreats(10);

      const status = {
        securityLevel: calculateSecurityLevel(metrics, recentThreats),
        activeThreats: recentThreats.filter(threat => 
          new Date(threat.timestamp).getTime() > Date.now() - 60 * 60 * 1000 // Last hour
        ).length,
        blockedIPsCount: blockedIPs.length,
        systemHealth: {
          threatDetection: 'active',
          rateLimiting: 'active',
          auditLogging: 'active',
          encryption: 'active'
        },
        lastUpdated: new Date().toISOString()
      };

      res.json({
        success: true,
        data: status,
        message: 'Security status retrieved successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to retrieve security status',
        message: (error as Error).message
      });
    }
  }
);

/**
 * Generate security report
 * POST /api/security/report
 */
router.post('/report',
  authenticate,
  authorize(UserRole.ADMIN),
  auditAdministrativeMiddleware,
  sensitiveOperationRateLimit,
  async (req, res) => {
    try {
      const { startDate, endDate, includeDetails } = req.body;

      const start = startDate ? new Date(startDate) : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const end = endDate ? new Date(endDate) : new Date();

      if (start >= end) {
        return res.status(400).json({
          success: false,
          error: 'Invalid date range',
          message: 'Start date must be before end date'
        });
      }

      const metrics = securityMonitor.getSecurityMetrics();
      const threats = securityMonitor.getRecentThreats(1000);
      const blockedIPs = securityMonitor.getBlockedIPs();

      // Filter threats by date range
      const filteredThreats = threats.filter(threat => {
        const threatDate = new Date(threat.timestamp);
        return threatDate >= start && threatDate <= end;
      });

      const report = {
        reportPeriod: {
          startDate: start.toISOString(),
          endDate: end.toISOString()
        },
        summary: {
          totalThreats: filteredThreats.length,
          blockedIPs: blockedIPs.length,
          highSeverityThreats: filteredThreats.filter(t => 
            t.severity === 'high' || t.severity === 'critical'
          ).length,
          successfulBlocks: filteredThreats.filter(t => t.blocked).length
        },
        threatsByType: groupThreatsByType(filteredThreats),
        threatsBySeverity: groupThreatsBySeverity(filteredThreats),
        topThreateningIPs: getTopThreateningIPs(filteredThreats),
        recommendations: generateSecurityRecommendations(metrics, filteredThreats),
        generatedAt: new Date().toISOString(),
        generatedBy: req.user?.email
      };

      if (includeDetails) {
        report['detailedThreats'] = filteredThreats.slice(0, 100); // Limit to 100 for performance
      }

      res.json({
        success: true,
        data: report,
        message: 'Security report generated successfully'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to generate security report',
        message: (error as Error).message
      });
    }
  }
);

// Helper functions

function calculateSecurityLevel(metrics: any, recentThreats: any[]): string {
  const recentHighThreats = recentThreats.filter(threat => 
    threat.severity === 'high' || threat.severity === 'critical'
  ).length;

  if (recentHighThreats > 10) return 'critical';
  if (recentHighThreats > 5) return 'high';
  if (recentHighThreats > 2) return 'medium';
  return 'low';
}

function groupThreatsByType(threats: any[]): Record<string, number> {
  return threats.reduce((acc, threat) => {
    acc[threat.threatType] = (acc[threat.threatType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function groupThreatsBySeverity(threats: any[]): Record<string, number> {
  return threats.reduce((acc, threat) => {
    acc[threat.severity] = (acc[threat.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
}

function getTopThreateningIPs(threats: any[]): Array<{ ip: string; threatCount: number }> {
  const ipCounts = threats.reduce((acc, threat) => {
    acc[threat.ipAddress] = (acc[threat.ipAddress] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(ipCounts)
    .map(([ip, count]) => ({ ip, threatCount: count }))
    .sort((a, b) => b.threatCount - a.threatCount)
    .slice(0, 10);
}

function generateSecurityRecommendations(metrics: any, threats: any[]): string[] {
  const recommendations: string[] = [];

  if (metrics.blockedIPs > 50) {
    recommendations.push('Consider implementing geographic IP filtering to reduce threat volume');
  }

  if (threats.filter(t => t.threatType === 'suspicious_authentication').length > 20) {
    recommendations.push('Enable multi-factor authentication for all users');
  }

  if (threats.filter(t => t.threatType === 'suspicious_api_usage').length > 30) {
    recommendations.push('Implement stricter API rate limiting');
  }

  const highSeverityThreats = threats.filter(t => t.severity === 'high' || t.severity === 'critical');
  if (highSeverityThreats.length > 10) {
    recommendations.push('Review and strengthen security policies');
  }

  if (recommendations.length === 0) {
    recommendations.push('Security posture is good, continue monitoring');
  }

  return recommendations;
}

export default router;