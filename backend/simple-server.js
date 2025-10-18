/**
 * Simple Express server for demo purposes
 * Runs without external dependencies like PostgreSQL, Redis, etc.
 */

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors({
  origin: ['http://localhost:3001', 'http://localhost:3000'],
  credentials: true
}));
app.use(compression());
app.use(morgan('combined'));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Mock data
const mockTickets = [
  {
    id: 'TKT-001',
    title: 'Server not responding',
    description: 'Production web server stopped responding to requests',
    status: 'open',
    priority: 'high',
    category: 'hardware',
    customerId: 'CUST-001',
    customerName: 'Acme Corporation',
    assignedTechnicianId: 'TECH-001',
    assignedTechnicianName: 'John Smith',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date().toISOString(),
    slaDeadline: new Date(Date.now() + 4 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'TKT-002',
    title: 'Email delivery issues',
    description: 'Customers reporting delayed email delivery',
    status: 'in_progress',
    priority: 'medium',
    category: 'email',
    customerId: 'CUST-002',
    customerName: 'TechStart Inc',
    assignedTechnicianId: 'TECH-002',
    assignedTechnicianName: 'Sarah Johnson',
    createdAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
    slaDeadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  },
  {
    id: 'TKT-003',
    title: 'Database performance issues',
    description: 'Slow query performance affecting application response times',
    status: 'resolved',
    priority: 'high',
    category: 'database',
    customerId: 'CUST-003',
    customerName: 'Global Solutions Ltd',
    assignedTechnicianId: 'TECH-001',
    assignedTechnicianName: 'John Smith',
    createdAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    slaDeadline: new Date(Date.now() - 20 * 60 * 60 * 1000).toISOString()
  }
];

const mockTechnicians = [
  {
    id: 'TECH-001',
    name: 'John Smith',
    email: 'john.smith@company.com',
    skills: ['Windows Server', 'Network Security', 'Database Management'],
    currentWorkload: 3,
    maxCapacity: 8,
    status: 'available'
  },
  {
    id: 'TECH-002',
    name: 'Sarah Johnson',
    email: 'sarah.johnson@company.com',
    skills: ['Linux Administration', 'Email Systems', 'Cloud Computing'],
    currentWorkload: 2,
    maxCapacity: 6,
    status: 'available'
  }
];

const mockCustomers = [
  {
    id: 'CUST-001',
    name: 'Acme Corporation',
    tier: 'enterprise',
    slaHours: 4
  },
  {
    id: 'CUST-002',
    name: 'TechStart Inc',
    tier: 'business',
    slaHours: 8
  },
  {
    id: 'CUST-003',
    name: 'Global Solutions Ltd',
    tier: 'enterprise',
    slaHours: 4
  }
];

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      database: { status: 'mock', type: 'demo' },
      redis: { status: 'mock', type: 'demo' },
      aiService: { status: 'connected', url: 'http://localhost:8001' }
    }
  });
});

// API root
app.get('/api', (req, res) => {
  res.json({
    message: 'AI Ticket Management Platform API',
    version: '1.0.0',
    status: 'running',
    mode: 'demo'
  });
});

// Tickets endpoints
app.get('/api/tickets', (req, res) => {
  const { status, priority, category, limit = 50, offset = 0 } = req.query;
  
  let filteredTickets = [...mockTickets];
  
  if (status) {
    filteredTickets = filteredTickets.filter(t => t.status === status);
  }
  if (priority) {
    filteredTickets = filteredTickets.filter(t => t.priority === priority);
  }
  if (category) {
    filteredTickets = filteredTickets.filter(t => t.category === category);
  }
  
  const startIndex = parseInt(offset);
  const endIndex = startIndex + parseInt(limit);
  const paginatedTickets = filteredTickets.slice(startIndex, endIndex);
  
  res.json({
    tickets: paginatedTickets,
    total: filteredTickets.length,
    limit: parseInt(limit),
    offset: parseInt(offset)
  });
});

app.get('/api/tickets/:id', (req, res) => {
  const ticket = mockTickets.find(t => t.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  res.json(ticket);
});

app.post('/api/tickets', (req, res) => {
  const { title, description, priority = 'medium', category = 'general', customerId } = req.body;
  
  if (!title || !description) {
    return res.status(400).json({ error: 'Title and description are required' });
  }
  
  const newTicket = {
    id: `TKT-${String(mockTickets.length + 1).padStart(3, '0')}`,
    title,
    description,
    status: 'open',
    priority,
    category,
    customerId: customerId || 'CUST-001',
    customerName: mockCustomers.find(c => c.id === customerId)?.name || 'Demo Customer',
    assignedTechnicianId: null,
    assignedTechnicianName: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    slaDeadline: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString()
  };
  
  mockTickets.push(newTicket);
  
  res.status(201).json(newTicket);
});

app.put('/api/tickets/:id', (req, res) => {
  const ticketIndex = mockTickets.findIndex(t => t.id === req.params.id);
  if (ticketIndex === -1) {
    return res.status(404).json({ error: 'Ticket not found' });
  }
  
  const updatedTicket = {
    ...mockTickets[ticketIndex],
    ...req.body,
    updatedAt: new Date().toISOString()
  };
  
  if (req.body.status === 'resolved' && !updatedTicket.resolvedAt) {
    updatedTicket.resolvedAt = new Date().toISOString();
  }
  
  mockTickets[ticketIndex] = updatedTicket;
  
  res.json(updatedTicket);
});

// Technicians endpoints
app.get('/api/technicians', (req, res) => {
  res.json({
    technicians: mockTechnicians,
    total: mockTechnicians.length
  });
});

app.get('/api/technicians/:id', (req, res) => {
  const technician = mockTechnicians.find(t => t.id === req.params.id);
  if (!technician) {
    return res.status(404).json({ error: 'Technician not found' });
  }
  res.json(technician);
});

// Customers endpoints
app.get('/api/customers', (req, res) => {
  res.json({
    customers: mockCustomers,
    total: mockCustomers.length
  });
});

// Analytics endpoints
app.get('/api/analytics/dashboard', (req, res) => {
  const totalTickets = mockTickets.length;
  const openTickets = mockTickets.filter(t => t.status === 'open').length;
  const inProgressTickets = mockTickets.filter(t => t.status === 'in_progress').length;
  const resolvedTickets = mockTickets.filter(t => t.status === 'resolved').length;
  
  const highPriorityTickets = mockTickets.filter(t => t.priority === 'high').length;
  const criticalTickets = mockTickets.filter(t => t.priority === 'critical').length;
  
  const avgResolutionTime = 4.5; // hours (mock data)
  const slaCompliance = 85; // percentage (mock data)
  
  res.json({
    summary: {
      totalTickets,
      openTickets,
      inProgressTickets,
      resolvedTickets,
      highPriorityTickets,
      criticalTickets
    },
    metrics: {
      avgResolutionTime,
      slaCompliance,
      customerSatisfaction: 4.2,
      technicianUtilization: 65
    },
    trends: {
      ticketsThisWeek: 12,
      ticketsLastWeek: 8,
      resolutionTimeImprovement: 15
    }
  });
});

// AI integration endpoints
app.post('/api/ai/triage', async (req, res) => {
  try {
    const response = await fetch('http://localhost:8001/ai/triage', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      throw new Error(`AI service responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('AI service error:', error);
    res.status(503).json({
      success: false,
      error: 'AI service unavailable',
      fallback: {
        category: 'general',
        priority: 'medium',
        confidence_score: 0.5
      }
    });
  }
});

app.post('/api/ai/predict-sla', async (req, res) => {
  try {
    const response = await fetch('http://localhost:8001/ai/predict-sla', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      throw new Error(`AI service responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('AI service error:', error);
    res.status(503).json({
      success: false,
      error: 'AI service unavailable',
      fallback: {
        breach_probability: 0.3,
        risk_level: 'medium'
      }
    });
  }
});

app.post('/api/ai/suggest-resolution', async (req, res) => {
  try {
    const response = await fetch('http://localhost:8001/ai/suggest-resolution', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(req.body)
    });
    
    if (!response.ok) {
      throw new Error(`AI service responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('AI service error:', error);
    res.status(503).json({
      success: false,
      error: 'AI service unavailable',
      fallback: {
        suggestions: ['Check system logs', 'Restart affected services']
      }
    });
  }
});

// Search endpoints
app.get('/api/tickets/search', (req, res) => {
  const { q } = req.query;
  
  if (!q) {
    return res.json({ tickets: [], total: 0 });
  }
  
  const searchTerm = q.toLowerCase();
  const filteredTickets = mockTickets.filter(ticket => 
    ticket.title.toLowerCase().includes(searchTerm) ||
    ticket.description.toLowerCase().includes(searchTerm) ||
    ticket.category.toLowerCase().includes(searchTerm)
  );
  
  res.json({
    tickets: filteredTickets,
    total: filteredTickets.length,
    query: q
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    path: req.originalUrl
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 AI Ticket Management Backend running on port ${PORT}`);
  console.log(`📊 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API root: http://localhost:${PORT}/api`);
  console.log(`🎯 Mode: Demo (using mock data)`);
  console.log(`🤖 AI Service: http://localhost:8001`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});