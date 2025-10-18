import { EventEmitter } from 'events';
import { logger } from '../utils/logger';
import { analyticsService } from './AnalyticsService';
import { DashboardMetrics } from '../models/Analytics';
import { DateRange } from '../types';

/**
 * Real-time analytics streaming service for dashboard updates
 * Manages WebSocket connections and pushes live analytics data
 */
export class RealTimeAnalyticsService extends EventEmitter {
  private updateInterval: NodeJS.Timeout | null = null;
  private subscribers: Map<string, WebSocketConnection> = new Map();
  private metricsUpdateFrequency = 30000; // 30 seconds
  private isRunning = false;

  constructor() {
    super();
    this.setMaxListeners(100); // Allow many dashboard connections
  }

  /**
   * Start the real-time analytics engine
   */
  start(): void {
    if (this.isRunning) {
      logger.warn('Real-time analytics service is already running');
      return;
    }

    this.isRunning = true;
    this.startMetricsUpdates();
    
    logger.info('Real-time analytics service started', {
      updateFrequency: this.metricsUpdateFrequency
    });
  }

  /**
   * Stop the real-time analytics engine
   */
  stop(): void {
    if (!this.isRunning) {
      return;
    }

    this.isRunning = false;
    
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
      this.updateInterval = null;
    }

    // Close all subscriber connections
    this.subscribers.forEach(connection => {
      connection.close();
    });
    this.subscribers.clear();

    logger.info('Real-time analytics service stopped');
  }

  /**
   * Subscribe a WebSocket connection to real-time analytics updates
   */
  subscribe(connectionId: string, websocket: any, filters?: AnalyticsFilters): void {
    const connection: WebSocketConnection = {
      id: connectionId,
      websocket,
      filters: filters || {},
      lastUpdate: new Date(),
      isActive: true
    };

    this.subscribers.set(connectionId, connection);

    // Send initial data immediately
    this.sendInitialData(connection);

    // Handle connection close
    websocket.on('close', () => {
      this.unsubscribe(connectionId);
    });

    websocket.on('error', (error: Error) => {
      logger.error('WebSocket error for analytics subscriber', {
        connectionId,
        error: error.message
      });
      this.unsubscribe(connectionId);
    });

    logger.info('New analytics subscriber connected', {
      connectionId,
      totalSubscribers: this.subscribers.size
    });
  }

  /**
   * Unsubscribe a WebSocket connection from analytics updates
   */
  unsubscribe(connectionId: string): void {
    const connection = this.subscribers.get(connectionId);
    if (connection) {
      connection.isActive = false;
      this.subscribers.delete(connectionId);
      
      logger.info('Analytics subscriber disconnected', {
        connectionId,
        totalSubscribers: this.subscribers.size
      });
    }
  }

  /**
   * Broadcast analytics update to all subscribers
   */
  async broadcastUpdate(updateType: AnalyticsUpdateType, data: any): Promise<void> {
    if (this.subscribers.size === 0) {
      return;
    }

    const message = {
      type: updateType,
      data,
      timestamp: new Date().toISOString()
    };

    const disconnectedConnections: string[] = [];

    for (const [connectionId, connection] of this.subscribers) {
      try {
        if (!connection.isActive) {
          disconnectedConnections.push(connectionId);
          continue;
        }

        // Apply filters if specified
        if (this.shouldSendUpdate(connection.filters, updateType, data)) {
          connection.websocket.send(JSON.stringify(message));
          connection.lastUpdate = new Date();
        }
      } catch (error) {
        logger.error('Failed to send analytics update to subscriber', {
          connectionId,
          error: error.message
        });
        disconnectedConnections.push(connectionId);
      }
    }

    // Clean up disconnected connections
    disconnectedConnections.forEach(id => this.unsubscribe(id));

    if (disconnectedConnections.length > 0) {
      logger.debug('Cleaned up disconnected analytics subscribers', {
        count: disconnectedConnections.length
      });
    }
  }

  /**
   * Trigger immediate metrics update for all subscribers
   */
  async triggerMetricsUpdate(): Promise<void> {
    try {
      const dashboardMetrics = await analyticsService.getDashboardMetrics();
      await this.broadcastUpdate('dashboard_metrics', dashboardMetrics);

      logger.debug('Triggered immediate metrics update', {
        subscriberCount: this.subscribers.size
      });
    } catch (error) {
      logger.error('Failed to trigger metrics update', { error: error.message });
    }
  }

  /**
   * Update metrics update frequency
   */
  setUpdateFrequency(frequencyMs: number): void {
    if (frequencyMs < 5000) { // Minimum 5 seconds
      throw new Error('Update frequency cannot be less than 5 seconds');
    }

    this.metricsUpdateFrequency = frequencyMs;

    if (this.isRunning) {
      this.stop();
      this.start();
    }

    logger.info('Analytics update frequency changed', {
      newFrequency: frequencyMs
    });
  }

  /**
   * Get current subscriber statistics
   */
  getSubscriberStats(): SubscriberStats {
    const activeConnections = Array.from(this.subscribers.values())
      .filter(conn => conn.isActive);

    return {
      totalSubscribers: this.subscribers.size,
      activeSubscribers: activeConnections.length,
      averageConnectionAge: this.calculateAverageConnectionAge(activeConnections),
      updateFrequency: this.metricsUpdateFrequency,
      isRunning: this.isRunning
    };
  }

  /**
   * Send performance metrics update for specific technician
   */
  async broadcastTechnicianUpdate(technicianId: string, metrics: any): Promise<void> {
    await this.broadcastUpdate('technician_metrics', {
      technicianId,
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Send SLA alert update
   */
  async broadcastSLAAlert(alert: any): Promise<void> {
    await this.broadcastUpdate('sla_alert', alert);
  }

  /**
   * Send ticket status update
   */
  async broadcastTicketUpdate(ticketId: string, status: string, metrics?: any): Promise<void> {
    await this.broadcastUpdate('ticket_update', {
      ticketId,
      status,
      metrics,
      timestamp: new Date().toISOString()
    });
  }

  // Private methods

  private startMetricsUpdates(): void {
    this.updateInterval = setInterval(async () => {
      try {
        await this.performScheduledUpdate();
      } catch (error) {
        logger.error('Scheduled analytics update failed', { error: error.message });
      }
    }, this.metricsUpdateFrequency);
  }

  private async performScheduledUpdate(): Promise<void> {
    if (this.subscribers.size === 0) {
      return; // No subscribers, skip update
    }

    try {
      // Get updated dashboard metrics
      const dashboardMetrics = await analyticsService.getDashboardMetrics();
      await this.broadcastUpdate('dashboard_metrics', dashboardMetrics);

      // Get real-time KPIs
      const realTimeKPIs = await this.getRealTimeKPIs();
      await this.broadcastUpdate('realtime_kpis', realTimeKPIs);

      logger.debug('Scheduled analytics update completed', {
        subscriberCount: this.subscribers.size,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Failed to perform scheduled analytics update', {
        error: error.message
      });
    }
  }

  private async sendInitialData(connection: WebSocketConnection): Promise<void> {
    try {
      // Send current dashboard metrics
      const dashboardMetrics = await analyticsService.getDashboardMetrics();
      const initialMessage = {
        type: 'initial_data',
        data: {
          dashboardMetrics,
          timestamp: new Date().toISOString()
        }
      };

      connection.websocket.send(JSON.stringify(initialMessage));
      
      logger.debug('Sent initial analytics data to subscriber', {
        connectionId: connection.id
      });
    } catch (error) {
      logger.error('Failed to send initial analytics data', {
        connectionId: connection.id,
        error: error.message
      });
    }
  }

  private shouldSendUpdate(
    filters: AnalyticsFilters,
    updateType: AnalyticsUpdateType,
    data: any
  ): boolean {
    // If no filters specified, send all updates
    if (!filters || Object.keys(filters).length === 0) {
      return true;
    }

    // Apply specific filters based on update type
    switch (updateType) {
      case 'technician_metrics':
        return !filters.technicianIds || 
               filters.technicianIds.includes(data.technicianId);
      
      case 'ticket_update':
        return !filters.ticketStatuses || 
               filters.ticketStatuses.includes(data.status);
      
      case 'sla_alert':
        return !filters.alertSeverities || 
               filters.alertSeverities.includes(data.severity);
      
      default:
        return true;
    }
  }

  private async getRealTimeKPIs(): Promise<any> {
    // This would fetch real-time KPIs that change frequently
    return {
      activeTickets: await this.getActiveTicketCount(),
      slaRiskTickets: await this.getSLARiskTicketCount(),
      averageResponseTime: await this.getCurrentAverageResponseTime(),
      technicianUtilization: await this.getCurrentTechnicianUtilization(),
      timestamp: new Date().toISOString()
    };
  }

  private async getActiveTicketCount(): Promise<number> {
    // Implementation would query database for active tickets
    return 0;
  }

  private async getSLARiskTicketCount(): Promise<number> {
    // Implementation would query database for SLA risk tickets
    return 0;
  }

  private async getCurrentAverageResponseTime(): Promise<number> {
    // Implementation would calculate current average response time
    return 0;
  }

  private async getCurrentTechnicianUtilization(): Promise<number> {
    // Implementation would calculate current technician utilization
    return 0;
  }

  private calculateAverageConnectionAge(connections: WebSocketConnection[]): number {
    if (connections.length === 0) return 0;

    const now = Date.now();
    const totalAge = connections.reduce((sum, conn) => {
      return sum + (now - conn.lastUpdate.getTime());
    }, 0);

    return totalAge / connections.length;
  }
}

// Types and interfaces

interface WebSocketConnection {
  id: string;
  websocket: any;
  filters: AnalyticsFilters;
  lastUpdate: Date;
  isActive: boolean;
}

interface AnalyticsFilters {
  technicianIds?: string[];
  customerIds?: string[];
  ticketStatuses?: string[];
  alertSeverities?: string[];
  categories?: string[];
}

type AnalyticsUpdateType = 
  | 'dashboard_metrics'
  | 'technician_metrics'
  | 'ticket_update'
  | 'sla_alert'
  | 'realtime_kpis'
  | 'initial_data';

interface SubscriberStats {
  totalSubscribers: number;
  activeSubscribers: number;
  averageConnectionAge: number;
  updateFrequency: number;
  isRunning: boolean;
}

// Export singleton instance
export const realTimeAnalyticsService = new RealTimeAnalyticsService();