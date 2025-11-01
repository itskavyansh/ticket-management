import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { errorHandler } from './middleware/errorHandler';
import { logger } from './utils/logger';
import { slaMonitoringScheduler } from './services/SLAMonitoringScheduler';
import { realTimeAnalyticsService } from './services/RealTimeAnalyticsService';
import { WebSocketAnalyticsHandler } from './services/WebSocketAnalyticsHandler';
import { initializeRedis, closeRedis } from './config/redis';
import { mongoConnection } from './config/mongodb';
import { getCacheInvalidationService } from './services/CacheInvalidationService';
import { getQueueManagementService } from './services/QueueManagementService';
import { dataStorageService } from './services/DataStorageService';
import { checkAWSHealth } from './config/aws';
import { 
  enforceHTTPS, 
  securityHeaders, 
  apiRateLimit, 
  requestId, 
  securityAuditLog,
  validateRequest,
  corsOptions
} from './middleware/security';
import { SecurityConfig } from './config/security';

// Import routes
import authRoutes from './routes/auth';
import roleRoutes from './routes/roles';
import ticketRoutes from './routes/tickets';
import superopsRoutes from './routes/superops';
import timeTrackingRoutes from './routes/timeTracking';
import workloadAnalysisRoutes from './routes/workloadAnalysis';
import productivityInsightsRoutes from './routes/productivityInsights';
import slaAlertingRoutes from './routes/slaAlerting';
import slaDashboardRoutes from './routes/slaDashboard';
import notificationRoutes from './routes/notifications';
import notificationPreferencesRoutes from './routes/notificationPreferences';
import chatBotRoutes from './routes/chatBot';
import aiChatbotRoutes from './routes/aiChatbot';
import analyticsRoutes from './routes/analytics';
import dashboardRoutes from './routes/dashboard';
import auditRoutes from './routes/audit';
import securityRoutes from './routes/security';
import aiRoutes from './routes/ai';
import storageRoutes from './routes/storage';
import { threatDetectionMiddleware, authThreatDetectionMiddleware } from './middleware/threatDetection';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Initialize WebSocket Analytics Handler
const wsAnalyticsHandler = new WebSocketAnalyticsHandler(server);

// Initialize security configuration (skip in development)
if (process.env.NODE_ENV !== 'development') {
  SecurityConfig.initialize();
}

// Initialize cache invalidation service
const cacheInvalidationService = getCacheInvalidationService();

// Initialize queue management service
const queueService = getQueueManagementService();

// Security middleware
app.use(enforceHTTPS);
app.use(requestId);
app.use(securityHeaders);
app.use(helmet({
  contentSecurityPolicy: false, // We handle CSP in securityHeaders
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
}));
app.use(cors(corsOptions));
app.use(validateRequest);
app.use(securityAuditLog);
app.use(apiRateLimit);
app.use(threatDetectionMiddleware);

// General middleware
app.use(compression());
app.use(morgan('combined', { stream: { write: (message) => logger.info(message.trim()) } }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const awsHealth = await checkAWSHealth();
    const storageHealth = await dataStorageService.healthCheck();
    
    res.status(200).json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      services: {
        aws: awsHealth,
        storage: storageHealth
      }
    });
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: (error as Error).message
    });
  }
});

// API routes
app.get('/api', (req, res) => {
  res.json({
    message: 'AI Ticket Management Platform API',
    version: '1.0.0',
    status: 'running'
  });
});

// Mount API routes
app.use('/api/auth', authThreatDetectionMiddleware, authRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/tickets', ticketRoutes);
app.use('/api/superops', superopsRoutes);
app.use('/api/time-tracking', timeTrackingRoutes);
app.use('/api/workload-analysis', workloadAnalysisRoutes);
app.use('/api/productivity-insights', productivityInsightsRoutes);
app.use('/api/sla-alerts', slaAlertingRoutes);
app.use('/api/sla-dashboard', slaDashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/notification-preferences', notificationPreferencesRoutes);
app.use('/api/chatbot', chatBotRoutes);
app.use('/api/ai-chatbot', aiChatbotRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/audit', auditRoutes);
app.use('/api/security', securityRoutes);
app.use('/api/ai', aiRoutes);
app.use('/api/storage', storageRoutes);

// Error handling middleware
app.use(errorHandler);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Initialize Redis and start server
async function startServer() {
  try {
    // Initialize MongoDB connection
    await mongoConnection.connect();
    logger.info('MongoDB connection established');

    // Initialize Redis connection
    await initializeRedis();
    logger.info('Redis connection established');

    // Warm critical caches
    await cacheInvalidationService.warmAllCaches();
    logger.info('Cache warming completed');

    // Initialize queue management
    queueService.createQueue({
      name: 'resource-intensive',
      concurrency: 2,
      maxRetries: 3,
      retryDelay: 5000,
      maxRetryDelay: 30000,
      backoffStrategy: 'exponential',
      removeOnComplete: 50,
      removeOnFail: 20
    });
    logger.info('Queue management initialized');

    // Initialize data storage service
    await dataStorageService.initialize();
    logger.info('Data storage service initialized');

    server.listen(PORT, () => {
      logger.info(`Server running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
      
      // Start SLA monitoring scheduler
      try {
        slaMonitoringScheduler.start();
        logger.info('SLA monitoring scheduler started');
      } catch (error) {
        logger.error('Failed to start SLA monitoring scheduler', { error: (error as Error).message });
      }

      // Start real-time analytics service
      try {
        realTimeAnalyticsService.start();
        logger.info('Real-time analytics service started');
      } catch (error) {
        logger.error('Failed to start real-time analytics service', { error: (error as Error).message });
      }
    });
  } catch (error) {
    logger.error('Failed to start server', { error: (error as Error).message });
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  
  // Stop services
  slaMonitoringScheduler.stop();
  realTimeAnalyticsService.stop();
  await wsAnalyticsHandler.shutdown();
  
  // Cleanup cache services
  cacheInvalidationService.cleanup();
  queueService.cleanup();
  await closeRedis();
  await mongoConnection.disconnect();
  
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  
  // Stop services
  slaMonitoringScheduler.stop();
  realTimeAnalyticsService.stop();
  await wsAnalyticsHandler.shutdown();
  
  // Cleanup cache services
  cacheInvalidationService.cleanup();
  queueService.cleanup();
  await closeRedis();
  await mongoConnection.disconnect();
  
  process.exit(0);
});

export default app;