import { Server as SocketIOServer } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';
import { realTimeAnalyticsService } from './RealTimeAnalyticsService';
import { UserRole } from '../types';

/**
 * WebSocket handler for real-time analytics streaming
 * Manages Socket.IO connections for dashboard updates
 */
export class WebSocketAnalyticsHandler {
  private io: SocketIOServer;
  private connectedClients: Map<string, ClientConnection> = new Map();

  constructor(server: HTTPServer) {
    this.io = new SocketIOServer(server, {
      cors: {
        origin: process.env.FRONTEND_URL || "http://localhost:3000",
        methods: ["GET", "POST"],
        credentials: true
      },
      path: '/analytics-socket',
      transports: ['websocket', 'polling']
    });

    this.setupMiddleware();
    this.setupEventHandlers();
    
    logger.info('WebSocket Analytics Handler initialized');
  }

  /**
   * Setup authentication and authorization middleware
   */
  private setupMiddleware(): void {
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');
        
        if (!token) {
          return next(new Error('Authentication token required'));
        }

        // Verify JWT token
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
        
        // Check if user has analytics read permission
        if (!this.hasAnalyticsPermission(decoded.role)) {
          return next(new Error('Insufficient permissions for analytics'));
        }

        socket.data.user = decoded;
        next();
      } catch (error) {
        logger.error('WebSocket authentication failed', { error: error.message });
        next(new Error('Authentication failed'));
      }
    });
  }

  /**
   * Setup Socket.IO event handlers
   */
  private setupEventHandlers(): void {
    this.io.on('connection', (socket) => {
      this.handleConnection(socket);
    });
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(socket: any): void {
    const userId = socket.data.user.id;
    const userRole = socket.data.user.role;
    const connectionId = `${userId}_${socket.id}`;

    logger.info('Analytics WebSocket connection established', {
      userId,
      userRole,
      connectionId,
      socketId: socket.id
    });

    // Store client connection info
    const clientConnection: ClientConnection = {
      socketId: socket.id,
      userId,
      userRole,
      connectedAt: new Date(),
      isActive: true,
      subscriptions: new Set()
    };

    this.connectedClients.set(connectionId, clientConnection);

    // Handle analytics subscription
    socket.on('subscribe_analytics', (data: AnalyticsSubscription) => {
      this.handleAnalyticsSubscription(socket, connectionId, data);
    });

    // Handle unsubscribe from analytics
    socket.on('unsubscribe_analytics', (data: { subscriptionType: string }) => {
      this.handleAnalyticsUnsubscription(connectionId, data.subscriptionType);
    });

    // Handle real-time filter updates
    socket.on('update_filters', (filters: AnalyticsFilters) => {
      this.handleFilterUpdate(connectionId, filters);
    });

    // Handle dashboard focus/blur for optimization
    socket.on('dashboard_focus', () => {
      this.handleDashboardFocus(connectionId, true);
    });

    socket.on('dashboard_blur', () => {
      this.handleDashboardFocus(connectionId, false);
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      this.handleDisconnection(connectionId, reason);
    });

    // Send initial analytics data
    this.sendInitialAnalyticsData(socket, connectionId);
  }

  /**
   * Handle analytics subscription request
   */
  private handleAnalyticsSubscription(
    socket: any, 
    connectionId: string, 
    subscription: AnalyticsSubscription
  ): void {
    const client = this.connectedClients.get(connectionId);
    if (!client) return;

    try {
      // Validate subscription permissions
      if (!this.canSubscribeToType(client.userRole, subscription.type)) {
        socket.emit('subscription_error', {
          type: subscription.type,
          error: 'Insufficient permissions for this subscription type'
        });
        return;
      }

      // Add subscription to client
      client.subscriptions.add(subscription.type);

      // Subscribe to real-time analytics service
      realTimeAnalyticsService.subscribe(connectionId, {
        send: (data: string) => socket.emit('analytics_update', JSON.parse(data)),
        on: (event: string, handler: Function) => socket.on(event, handler),
        close: () => socket.disconnect()
      }, subscription.filters);

      socket.emit('subscription_confirmed', {
        type: subscription.type,
        filters: subscription.filters
      });

      logger.info('Analytics subscription added', {
        connectionId,
        subscriptionType: subscription.type,
        filters: subscription.filters
      });
    } catch (error) {
      logger.error('Failed to handle analytics subscription', {
        connectionId,
        error: error.message
      });

      socket.emit('subscription_error', {
        type: subscription.type,
        error: 'Failed to subscribe to analytics updates'
      });
    }
  }

  /**
   * Handle analytics unsubscription
   */
  private handleAnalyticsUnsubscription(connectionId: string, subscriptionType: string): void {
    const client = this.connectedClients.get(connectionId);
    if (!client) return;

    client.subscriptions.delete(subscriptionType);
    
    // If no more subscriptions, unsubscribe from real-time service
    if (client.subscriptions.size === 0) {
      realTimeAnalyticsService.unsubscribe(connectionId);
    }

    logger.info('Analytics subscription removed', {
      connectionId,
      subscriptionType
    });
  }

  /**
   * Handle filter updates for existing subscriptions
   */
  private handleFilterUpdate(connectionId: string, filters: AnalyticsFilters): void {
    const client = this.connectedClients.get(connectionId);
    if (!client) return;

    // Update filters in real-time service
    // This would require extending the real-time service to support filter updates
    
    logger.info('Analytics filters updated', {
      connectionId,
      filters
    });
  }

  /**
   * Handle dashboard focus/blur for performance optimization
   */
  private handleDashboardFocus(connectionId: string, isFocused: boolean): void {
    const client = this.connectedClients.get(connectionId);
    if (!client) return;

    // Adjust update frequency based on focus state
    // When dashboard is not focused, reduce update frequency to save resources
    
    logger.debug('Dashboard focus state changed', {
      connectionId,
      isFocused
    });
  }

  /**
   * Handle client disconnection
   */
  private handleDisconnection(connectionId: string, reason: string): void {
    const client = this.connectedClients.get(connectionId);
    if (!client) return;

    client.isActive = false;
    
    // Unsubscribe from real-time analytics
    realTimeAnalyticsService.unsubscribe(connectionId);
    
    // Remove client from connected clients
    this.connectedClients.delete(connectionId);

    logger.info('Analytics WebSocket disconnected', {
      connectionId,
      reason,
      connectionDuration: Date.now() - client.connectedAt.getTime()
    });
  }

  /**
   * Send initial analytics data to newly connected client
   */
  private async sendInitialAnalyticsData(socket: any, connectionId: string): Promise<void> {
    try {
      // This would be handled by the real-time analytics service
      // when the client subscribes to specific analytics types
      
      logger.debug('Initial analytics data will be sent upon subscription', {
        connectionId
      });
    } catch (error) {
      logger.error('Failed to send initial analytics data', {
        connectionId,
        error: error.message
      });
    }
  }

  /**
   * Broadcast analytics update to all connected clients
   */
  async broadcastToAll(updateType: string, data: any): Promise<void> {
    const message = {
      type: updateType,
      data,
      timestamp: new Date().toISOString()
    };

    this.io.emit('analytics_broadcast', message);
    
    logger.debug('Analytics update broadcasted to all clients', {
      updateType,
      connectedClients: this.connectedClients.size
    });
  }

  /**
   * Broadcast analytics update to specific user roles
   */
  async broadcastToRoles(updateType: string, data: any, roles: UserRole[]): Promise<void> {
    const message = {
      type: updateType,
      data,
      timestamp: new Date().toISOString()
    };

    for (const [connectionId, client] of this.connectedClients) {
      if (client.isActive && roles.includes(client.userRole)) {
        this.io.to(client.socketId).emit('analytics_broadcast', message);
      }
    }

    logger.debug('Analytics update broadcasted to specific roles', {
      updateType,
      roles,
      targetClients: Array.from(this.connectedClients.values())
        .filter(client => client.isActive && roles.includes(client.userRole)).length
    });
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): ConnectionStats {
    const activeConnections = Array.from(this.connectedClients.values())
      .filter(client => client.isActive);

    const roleDistribution = activeConnections.reduce((acc, client) => {
      acc[client.userRole] = (acc[client.userRole] || 0) + 1;
      return acc;
    }, {} as Record<UserRole, number>);

    return {
      totalConnections: this.connectedClients.size,
      activeConnections: activeConnections.length,
      roleDistribution,
      averageConnectionAge: this.calculateAverageConnectionAge(activeConnections)
    };
  }

  /**
   * Gracefully shutdown WebSocket server
   */
  async shutdown(): Promise<void> {
    logger.info('Shutting down WebSocket Analytics Handler');
    
    // Notify all clients about shutdown
    this.io.emit('server_shutdown', {
      message: 'Server is shutting down',
      timestamp: new Date().toISOString()
    });

    // Close all connections
    this.io.close();
    
    // Clear client connections
    this.connectedClients.clear();
    
    logger.info('WebSocket Analytics Handler shutdown completed');
  }

  // Private helper methods

  private hasAnalyticsPermission(role: UserRole): boolean {
    // All authenticated users can read analytics, but with different levels of access
    return [UserRole.ADMIN, UserRole.MANAGER, UserRole.TECHNICIAN, UserRole.READ_ONLY].includes(role);
  }

  private canSubscribeToType(role: UserRole, subscriptionType: string): boolean {
    // Define subscription permissions based on user role
    const permissions = {
      [UserRole.ADMIN]: ['dashboard', 'team_performance', 'bottlenecks', 'capacity_prediction', 'all_technicians'],
      [UserRole.MANAGER]: ['dashboard', 'team_performance', 'bottlenecks', 'capacity_prediction', 'team_technicians'],
      [UserRole.TECHNICIAN]: ['dashboard', 'personal_performance'],
      [UserRole.READ_ONLY]: ['dashboard']
    };

    return permissions[role]?.includes(subscriptionType) || permissions[role]?.includes('all_technicians');
  }

  private calculateAverageConnectionAge(connections: ClientConnection[]): number {
    if (connections.length === 0) return 0;

    const now = Date.now();
    const totalAge = connections.reduce((sum, client) => {
      return sum + (now - client.connectedAt.getTime());
    }, 0);

    return totalAge / connections.length;
  }
}

// Types and interfaces

interface ClientConnection {
  socketId: string;
  userId: string;
  userRole: UserRole;
  connectedAt: Date;
  isActive: boolean;
  subscriptions: Set<string>;
}

interface AnalyticsSubscription {
  type: string;
  filters?: AnalyticsFilters;
}

interface AnalyticsFilters {
  technicianIds?: string[];
  customerIds?: string[];
  ticketStatuses?: string[];
  alertSeverities?: string[];
  categories?: string[];
  dateRange?: {
    startDate: string;
    endDate: string;
  };
}

interface ConnectionStats {
  totalConnections: number;
  activeConnections: number;
  roleDistribution: Record<UserRole, number>;
  averageConnectionAge: number;
}

export { WebSocketAnalyticsHandler };