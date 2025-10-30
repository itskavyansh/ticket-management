import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { logger } from './utils/logger';

// Load environment variables
dotenv.config();

const app = express();
const server = createServer(app);
const PORT = process.env.PORT || 3000;

// Basic middleware
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true,
}));
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Simple mock auth middleware for development
const mockAuth = (req: any, res: any, next: any) => {
  req.user = {
    userId: 'dev-user-1',
    email: 'developer@example.com',
    role: 'admin',
  };
  next();
};

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API root
app.get('/api', (req, res) => {
  res.json({
    message: 'AI Ticket Management Platform API',
    version: '1.0.0',
    status: 'running'
  });
});

// Import and mount AI chatbot routes
import aiChatbotRoutes from './routes/aiChatbot';
app.use('/api/ai-chatbot', aiChatbotRoutes);

// Mock dashboard metrics endpoint
app.get('/api/dashboard/metrics', mockAuth, (req, res) => {
  res.json({
    totalTickets: 1247,
    openTickets: 342,
    resolvedTickets: 89,
    slaCompliance: 94.2,
    averageResolutionTime: 2.4,
    criticalTickets: 5,
    overdueTickets: 12,
    technicianUtilization: 78.5,
  });
});

// Mock SLA alerts endpoint
app.get('/api/sla-alerts', mockAuth, (req, res) => {
  res.json([
    {
      id: '1',
      ticketId: 'TKT-001',
      ticketTitle: 'Email server down affecting Bangalore and Mumbai offices',
      riskLevel: 'critical',
      timeRemaining: -30,
      assignedTechnician: 'Rajesh Kumar',
      customer: 'Tata Consultancy Services',
      createdAt: '2024-01-15T10:30:00Z',
    },
    {
      id: '2',
      ticketId: 'TKT-002',
      ticketTitle: 'Printer not working in accounts department',
      riskLevel: 'high',
      timeRemaining: 45,
      assignedTechnician: 'Priya Sharma',
      customer: 'Infosys Limited',
      createdAt: '2024-01-15T11:15:00Z',
    }
  ]);
});

// Mock ticket trends endpoint
app.get('/api/analytics/trends', mockAuth, (req, res) => {
  res.json([
    { date: '2024-01-08', created: 45, resolved: 38, open: 342 },
    { date: '2024-01-09', created: 52, resolved: 41, open: 353 },
    { date: '2024-01-10', created: 38, resolved: 47, open: 344 },
    { date: '2024-01-11', created: 61, resolved: 39, open: 366 },
    { date: '2024-01-12', created: 43, resolved: 55, open: 354 },
    { date: '2024-01-13', created: 29, resolved: 31, open: 352 },
    { date: '2024-01-14', created: 48, resolved: 42, open: 358 },
  ]);
});

// Mock tickets endpoint
app.get('/api/tickets', mockAuth, (req, res) => {
  const mockTickets = [
    {
      id: '1',
      externalId: 'TKT-001',
      title: 'Email server not responding',
      description: 'Users are unable to send or receive emails. The exchange server appears to be down since morning.',
      category: 'email',
      priority: 'critical',
      status: 'in_progress',
      customerId: 'cust-1',
      customerName: 'Tata Consultancy Services',
      assignedTechnicianId: 'tech-1',
      assignedTechnicianName: 'Rajesh Kumar',
      createdAt: '2024-01-15T09:00:00Z',
      updatedAt: '2024-01-15T10:30:00Z',
      slaDeadline: '2024-01-15T13:00:00Z',
      tags: ['email', 'server', 'critical'],
      attachments: [],
    },
    {
      id: '2',
      externalId: 'TKT-002',
      title: 'Printer not working in accounts department',
      description: 'HP LaserJet Pro in accounts department is showing offline status and not printing invoices.',
      category: 'printer',
      priority: 'medium',
      status: 'open',
      customerId: 'cust-2',
      customerName: 'Infosys Limited',
      createdAt: '2024-01-15T08:30:00Z',
      updatedAt: '2024-01-15T08:30:00Z',
      slaDeadline: '2024-01-16T08:30:00Z',
      tags: ['printer', 'hardware', 'accounts'],
      attachments: [],
    }
  ];

  res.json({
    tickets: mockTickets,
    total: mockTickets.length,
    page: 1,
    limit: 20,
    totalPages: 1
  });
});

// Error handling middleware
app.use((error: any, req: any, res: any, next: any) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Start server
server.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${process.env.NODE_ENV || 'development'}`);
  logger.info('Simple development server started successfully');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

export default app;