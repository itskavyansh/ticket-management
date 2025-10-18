import { logger } from '../utils/logger';
import { auditLogger } from './AuditLogger';

/**
 * Security monitoring and threat detection service
 */
export class SecurityMonitor {
  private static instance: SecurityMonitor;
  private suspiciousActivities: Map<string, SuspiciousActivity[]> = new Map();
  private blockedIPs: Set<string> = new Set();
  private rateLimitViolations: Map<string, RateLimitViolation[]> = new Map();
  private readonly maxSuspiciousActivities = 1000;
  private readonly cleanupInterval = 60 * 60 * 1000; // 1 hour

  private constructor() {
    this.startCleanupTimer();
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SecurityMonitor {
    if (!SecurityMonitor.instance) {
      SecurityMonitor.instance = new SecurityMonitor();
    }
    return SecurityMonitor.instance;
  }

  /**
   * Detect and log suspicious authentication attempts
   */
  detectSuspiciousAuth(event: AuthAttemptEvent): ThreatAssessment {
    const clientId = event.ipAddress;
    const now = Date.now();
    
    // Get recent activities for this client
    const activities = this.suspiciousActivities.get(clientId) || [];
    
    // Clean old activities (older than 1 hour)
    const recentActivities = activities.filter(
      activity => now - activity.timestamp < 60 * 60 * 1000
    );

    // Count failed attempts in the last 15 minutes
    const recentFailures = recentActivities.filter(
      activity => 
        activity.type === 'failed_auth' && 
        now - activity.timestamp < 15 * 60 * 1000
    ).length;

    // Assess threat level
    let threatLevel = ThreatLevel.LOW;
    let shouldBlock = false;
    const reasons: string[] = [];

    // Multiple failed attempts
    if (recentFailures >= 5) {
      threatLevel = ThreatLevel.HIGH;
      shouldBlock = true;
      reasons.push(`${recentFailures} failed authentication attempts in 15 minutes`);
    } else if (recentFailures >= 3) {
      threatLevel = ThreatLevel.MEDIUM;
      reasons.push(`${recentFailures} failed authentication attempts`);
    }

    // Suspicious user agents
    if (this.isSuspiciousUserAgent(event.userAgent)) {
      threatLevel = Math.max(threatLevel, ThreatLevel.MEDIUM);
      reasons.push('Suspicious user agent detected');
    }

    // Rapid requests from same IP
    const rapidRequests = recentActivities.filter(
      activity => now - activity.timestamp < 60 * 1000 // Last minute
    ).length;

    if (rapidRequests > 20) {
      threatLevel = ThreatLevel.HIGH;
      shouldBlock = true;
      reasons.push(`${rapidRequests} requests in the last minute`);
    }

    // Geographic anomalies (simplified check)
    if (this.isAnomalousLocation(event.ipAddress)) {
      threatLevel = Math.max(threatLevel, ThreatLevel.MEDIUM);
      reasons.push('Request from unusual geographic location');
    }

    // Record this activity
    const activity: SuspiciousActivity = {
      timestamp: now,
      type: event.success ? 'successful_auth' : 'failed_auth',
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      userId: event.userId,
      details: event
    };

    recentActivities.push(activity);
    this.suspiciousActivities.set(clientId, recentActivities);

    // Block IP if necessary
    if (shouldBlock) {
      this.blockIP(event.ipAddress, 'Multiple security violations');
    }

    // Log security event
    auditLogger.logSecurityEvent({
      action: 'threat_detection',
      userId: event.userId,
      userEmail: event.userEmail,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: !shouldBlock,
      threatType: 'suspicious_authentication',
      severity: threatLevel,
      blocked: shouldBlock,
      ruleTriggered: reasons.join(', '),
      additionalContext: {
        recentFailures,
        rapidRequests,
        totalActivities: recentActivities.length
      }
    });

    return {
      threatLevel,
      shouldBlock,
      reasons,
      confidence: this.calculateConfidence(reasons.length, threatLevel)
    };
  }

  /**
   * Detect suspicious API usage patterns
   */
  detectSuspiciousAPIUsage(event: APIUsageEvent): ThreatAssessment {
    const clientId = event.ipAddress;
    const now = Date.now();

    // Track rate limit violations
    const violations = this.rateLimitViolations.get(clientId) || [];
    const recentViolations = violations.filter(
      violation => now - violation.timestamp < 60 * 60 * 1000 // Last hour
    );

    let threatLevel = ThreatLevel.LOW;
    let shouldBlock = false;
    const reasons: string[] = [];

    // Excessive API calls
    if (event.requestCount > 1000) {
      threatLevel = ThreatLevel.HIGH;
      shouldBlock = true;
      reasons.push(`Excessive API calls: ${event.requestCount} requests`);
    } else if (event.requestCount > 500) {
      threatLevel = ThreatLevel.MEDIUM;
      reasons.push(`High API usage: ${event.requestCount} requests`);
    }

    // Suspicious endpoints
    if (this.isSuspiciousEndpoint(event.endpoint)) {
      threatLevel = Math.max(threatLevel, ThreatLevel.MEDIUM);
      reasons.push(`Access to sensitive endpoint: ${event.endpoint}`);
    }

    // Data scraping patterns
    if (this.isDataScrapingPattern(event)) {
      threatLevel = ThreatLevel.HIGH;
      shouldBlock = true;
      reasons.push('Data scraping pattern detected');
    }

    // SQL injection attempts
    if (this.containsSQLInjection(event.queryParams)) {
      threatLevel = ThreatLevel.CRITICAL;
      shouldBlock = true;
      reasons.push('SQL injection attempt detected');
    }

    // XSS attempts
    if (this.containsXSS(event.requestBody)) {
      threatLevel = ThreatLevel.HIGH;
      shouldBlock = true;
      reasons.push('XSS attempt detected');
    }

    // Record violation if threat detected
    if (threatLevel > ThreatLevel.LOW) {
      const violation: RateLimitViolation = {
        timestamp: now,
        ipAddress: event.ipAddress,
        endpoint: event.endpoint,
        requestCount: event.requestCount,
        threatLevel
      };

      recentViolations.push(violation);
      this.rateLimitViolations.set(clientId, recentViolations);
    }

    // Block IP if necessary
    if (shouldBlock) {
      this.blockIP(event.ipAddress, 'Malicious API usage detected');
    }

    // Log security event
    auditLogger.logSecurityEvent({
      action: 'api_threat_detection',
      userId: event.userId,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      success: !shouldBlock,
      threatType: 'suspicious_api_usage',
      severity: threatLevel,
      blocked: shouldBlock,
      ruleTriggered: reasons.join(', '),
      additionalContext: {
        endpoint: event.endpoint,
        requestCount: event.requestCount,
        recentViolations: recentViolations.length
      }
    });

    return {
      threatLevel,
      shouldBlock,
      reasons,
      confidence: this.calculateConfidence(reasons.length, threatLevel)
    };
  }

  /**
   * Check if IP is blocked
   */
  isIPBlocked(ipAddress: string): boolean {
    return this.blockedIPs.has(ipAddress);
  }

  /**
   * Block an IP address
   */
  blockIP(ipAddress: string, reason: string): void {
    this.blockedIPs.add(ipAddress);
    
    logger.warn('IP address blocked', {
      ipAddress,
      reason,
      timestamp: new Date().toISOString()
    });

    // Auto-unblock after 24 hours
    setTimeout(() => {
      this.unblockIP(ipAddress);
    }, 24 * 60 * 60 * 1000);
  }

  /**
   * Unblock an IP address
   */
  unblockIP(ipAddress: string): void {
    this.blockedIPs.delete(ipAddress);
    
    logger.info('IP address unblocked', {
      ipAddress,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Get security metrics
   */
  getSecurityMetrics(): SecurityMetrics {
    const now = Date.now();
    const oneHourAgo = now - 60 * 60 * 1000;
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    let totalSuspiciousActivities = 0;
    let recentSuspiciousActivities = 0;
    let uniqueThreateningIPs = new Set<string>();

    // Count suspicious activities
    for (const [ip, activities] of this.suspiciousActivities) {
      totalSuspiciousActivities += activities.length;
      
      const recentActivities = activities.filter(
        activity => activity.timestamp > oneHourAgo
      );
      recentSuspiciousActivities += recentActivities.length;

      if (recentActivities.length > 0) {
        uniqueThreateningIPs.add(ip);
      }
    }

    // Count rate limit violations
    let totalViolations = 0;
    let recentViolations = 0;

    for (const violations of this.rateLimitViolations.values()) {
      totalViolations += violations.length;
      recentViolations += violations.filter(
        violation => violation.timestamp > oneHourAgo
      ).length;
    }

    return {
      blockedIPs: this.blockedIPs.size,
      totalSuspiciousActivities,
      recentSuspiciousActivities,
      uniqueThreateningIPs: uniqueThreateningIPs.size,
      totalRateLimitViolations: totalViolations,
      recentRateLimitViolations: recentViolations,
      lastUpdated: new Date().toISOString()
    };
  }

  /**
   * Get blocked IPs list
   */
  getBlockedIPs(): string[] {
    return Array.from(this.blockedIPs);
  }

  /**
   * Get recent threats
   */
  getRecentThreats(limit: number = 50): ThreatSummary[] {
    const threats: ThreatSummary[] = [];
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    // Collect recent suspicious activities
    for (const [ip, activities] of this.suspiciousActivities) {
      const recentActivities = activities.filter(
        activity => activity.timestamp > oneDayAgo
      );

      for (const activity of recentActivities) {
        threats.push({
          timestamp: new Date(activity.timestamp).toISOString(),
          ipAddress: activity.ipAddress,
          threatType: activity.type,
          severity: this.assessActivitySeverity(activity),
          blocked: this.blockedIPs.has(activity.ipAddress),
          details: activity.details
        });
      }
    }

    // Sort by timestamp (newest first) and limit
    return threats
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);
  }

  // Private helper methods

  private isSuspiciousUserAgent(userAgent: string): boolean {
    const suspiciousPatterns = [
      /bot/i,
      /crawler/i,
      /spider/i,
      /scraper/i,
      /curl/i,
      /wget/i,
      /python/i,
      /java/i,
      /^$/,
      /null/i
    ];

    return suspiciousPatterns.some(pattern => pattern.test(userAgent));
  }

  private isAnomalousLocation(ipAddress: string): boolean {
    // Simplified check - in production, use GeoIP service
    const knownMaliciousRanges = [
      '10.0.0.0/8',
      '172.16.0.0/12',
      '192.168.0.0/16'
    ];

    // This is a placeholder - implement proper GeoIP checking
    return false;
  }

  private isSuspiciousEndpoint(endpoint: string): boolean {
    const sensitiveEndpoints = [
      '/admin',
      '/config',
      '/debug',
      '/test',
      '/.env',
      '/backup',
      '/dump',
      '/phpinfo',
      '/wp-admin'
    ];

    return sensitiveEndpoints.some(sensitive => 
      endpoint.toLowerCase().includes(sensitive)
    );
  }

  private isDataScrapingPattern(event: APIUsageEvent): boolean {
    // Check for patterns indicating data scraping
    return (
      event.requestCount > 100 && // High request volume
      event.endpoint.includes('/api/') && // API endpoints
      event.queryParams && 
      (event.queryParams.limit > 1000 || event.queryParams.page > 100) // Large data requests
    );
  }

  private containsSQLInjection(queryParams: any): boolean {
    if (!queryParams) return false;

    const sqlPatterns = [
      /union.*select/i,
      /drop.*table/i,
      /insert.*into/i,
      /delete.*from/i,
      /update.*set/i,
      /exec.*xp_/i,
      /sp_executesql/i,
      /'.*or.*'.*=/i,
      /'.*and.*'.*=/i,
      /1=1/i,
      /1' or '1'='1/i
    ];

    const queryString = JSON.stringify(queryParams).toLowerCase();
    return sqlPatterns.some(pattern => pattern.test(queryString));
  }

  private containsXSS(requestBody: any): boolean {
    if (!requestBody) return false;

    const xssPatterns = [
      /<script/i,
      /javascript:/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
      /onmouseover=/i,
      /<iframe/i,
      /<object/i,
      /<embed/i
    ];

    const bodyString = JSON.stringify(requestBody).toLowerCase();
    return xssPatterns.some(pattern => pattern.test(bodyString));
  }

  private calculateConfidence(reasonCount: number, threatLevel: ThreatLevel): number {
    let baseConfidence = 0;

    switch (threatLevel) {
      case ThreatLevel.LOW: baseConfidence = 30; break;
      case ThreatLevel.MEDIUM: baseConfidence = 60; break;
      case ThreatLevel.HIGH: baseConfidence = 85; break;
      case ThreatLevel.CRITICAL: baseConfidence = 95; break;
    }

    // Increase confidence with more reasons
    const confidenceBoost = Math.min(reasonCount * 10, 30);
    return Math.min(baseConfidence + confidenceBoost, 100);
  }

  private assessActivitySeverity(activity: SuspiciousActivity): ThreatLevel {
    if (activity.type === 'failed_auth') {
      return ThreatLevel.MEDIUM;
    }
    return ThreatLevel.LOW;
  }

  private startCleanupTimer(): void {
    setInterval(() => {
      this.cleanupOldData();
    }, this.cleanupInterval);
  }

  private cleanupOldData(): void {
    const now = Date.now();
    const cutoffTime = now - 24 * 60 * 60 * 1000; // 24 hours ago

    // Clean suspicious activities
    for (const [ip, activities] of this.suspiciousActivities) {
      const recentActivities = activities.filter(
        activity => activity.timestamp > cutoffTime
      );
      
      if (recentActivities.length === 0) {
        this.suspiciousActivities.delete(ip);
      } else {
        this.suspiciousActivities.set(ip, recentActivities);
      }
    }

    // Clean rate limit violations
    for (const [ip, violations] of this.rateLimitViolations) {
      const recentViolations = violations.filter(
        violation => violation.timestamp > cutoffTime
      );
      
      if (recentViolations.length === 0) {
        this.rateLimitViolations.delete(ip);
      } else {
        this.rateLimitViolations.set(ip, recentViolations);
      }
    }

    logger.info('Security monitor cleanup completed', {
      suspiciousActivitiesCount: this.suspiciousActivities.size,
      rateLimitViolationsCount: this.rateLimitViolations.size,
      blockedIPsCount: this.blockedIPs.size
    });
  }
}

// Enums and interfaces

export enum ThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface AuthAttemptEvent {
  userId: string;
  userEmail?: string;
  ipAddress: string;
  userAgent: string;
  success: boolean;
  timestamp?: number;
}

export interface APIUsageEvent {
  userId?: string;
  ipAddress: string;
  userAgent: string;
  endpoint: string;
  requestCount: number;
  queryParams?: any;
  requestBody?: any;
  timestamp?: number;
}

export interface ThreatAssessment {
  threatLevel: ThreatLevel;
  shouldBlock: boolean;
  reasons: string[];
  confidence: number;
}

export interface SuspiciousActivity {
  timestamp: number;
  type: string;
  ipAddress: string;
  userAgent: string;
  userId?: string;
  details: any;
}

export interface RateLimitViolation {
  timestamp: number;
  ipAddress: string;
  endpoint: string;
  requestCount: number;
  threatLevel: ThreatLevel;
}

export interface SecurityMetrics {
  blockedIPs: number;
  totalSuspiciousActivities: number;
  recentSuspiciousActivities: number;
  uniqueThreateningIPs: number;
  totalRateLimitViolations: number;
  recentRateLimitViolations: number;
  lastUpdated: string;
}

export interface ThreatSummary {
  timestamp: string;
  ipAddress: string;
  threatType: string;
  severity: ThreatLevel;
  blocked: boolean;
  details: any;
}

// Export singleton instance
export const securityMonitor = SecurityMonitor.getInstance();