import request from 'supertest';
import { app } from '../../index';
import { TicketService } from '../../services/TicketService';
import { AIService } from '../../services/AIService';
import { SLAService } from '../../services/SLAService';
import { NotificationService } from '../../services/NotificationService';

describe('End-to-End AI Workflow Integration', () => {
  let ticketService: TicketService;
  let aiService: AIService;
  let slaService: SLAService;
  let notificationService: NotificationService;
  let authToken: string;

  beforeAll(async () => {
    // Initialize services
    ticketService = new TicketService();
    aiService = new AIService();
    slaService = new SLAService();
    notificationService = new NotificationService();

    // Get authentication token for tests
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test@example.com',
        password: 'testpassword'
      });
    
    authToken = loginResponse.body.token;
  });

  describe('Complete Ticket Lifecycle with AI Processing', () => {
    let ticketId: string;

    test('1. Create ticket and trigger AI triage', async () => {
      const ticketData = {
        title: 'Server performance issues - high CPU usage',
        description: 'Customer reports slow response times on their web application. Server monitoring shows CPU usage at 95% consistently. Error logs show database connection timeouts.',
        customerId: 'customer-123',
        customerTier: 'premium',
        source: 'email'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      ticketId = response.body.ticket.id;
      
      // Verify ticket was created
      expect(response.body.ticket).toMatchObject({
        title: ticketData.title,
        description: ticketData.description,
        customerId: ticketData.customerId,
        status: 'open'
      });

      // Wait for AI triage to complete (async processing)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify AI triage results were applied
      const triageResponse = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(triageResponse.body.ticket.aiInsights).toBeDefined();
      expect(triageResponse.body.ticket.aiInsights.category).toBe('infrastructure');
      expect(triageResponse.body.ticket.aiInsights.priority).toBe('high');
      expect(triageResponse.body.ticket.aiInsights.triageConfidence).toBeGreaterThan(0.7);
    });

    test('2. Verify SLA calculation and risk prediction', async () => {
      // Get ticket with SLA information
      const response = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const ticket = response.body.ticket;
      
      // Verify SLA deadline was calculated
      expect(ticket.slaDeadline).toBeDefined();
      expect(new Date(ticket.slaDeadline)).toBeInstanceOf(Date);

      // Test SLA risk prediction
      const slaResponse = await request(app)
        .post('/api/sla/predict')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ticketId })
        .expect(200);

      expect(slaResponse.body.prediction).toBeDefined();
      expect(slaResponse.body.prediction.breachProbability).toBeGreaterThanOrEqual(0);
      expect(slaResponse.body.prediction.breachProbability).toBeLessThanOrEqual(1);
      expect(slaResponse.body.prediction.riskLevel).toMatch(/^(low|medium|high|critical)$/);
    });

    test('3. Get AI-powered resolution suggestions', async () => {
      const response = await request(app)
        .post('/api/tickets/resolution-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ticketId })
        .expect(200);

      expect(response.body.suggestions).toBeDefined();
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      expect(response.body.suggestions.length).toBeGreaterThan(0);

      // Verify suggestion structure
      const suggestion = response.body.suggestions[0];
      expect(suggestion).toHaveProperty('title');
      expect(suggestion).toHaveProperty('steps');
      expect(suggestion).toHaveProperty('confidenceScore');
      expect(suggestion).toHaveProperty('estimatedTime');
      expect(suggestion.confidenceScore).toBeGreaterThan(0);
      expect(suggestion.confidenceScore).toBeLessThanOrEqual(1);
    });

    test('4. Assign ticket and verify workload optimization', async () => {
      // Get available technicians
      const techResponse = await request(app)
        .get('/api/technicians')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const technicians = techResponse.body.technicians;
      expect(technicians.length).toBeGreaterThan(0);

      // Test workload optimization
      const workloadResponse = await request(app)
        .post('/api/workload/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticketIds: [ticketId],
          technicians: technicians.map(t => t.id)
        })
        .expect(200);

      expect(workloadResponse.body.recommendations).toBeDefined();
      expect(Array.isArray(workloadResponse.body.recommendations)).toBe(true);

      // Assign ticket based on AI recommendation
      const recommendation = workloadResponse.body.recommendations[0];
      const assignResponse = await request(app)
        .put(`/api/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ technicianId: recommendation.technicianId })
        .expect(200);

      expect(assignResponse.body.ticket.assignedTechnicianId).toBe(recommendation.technicianId);
    });

    test('5. Simulate ticket progress and SLA monitoring', async () => {
      // Update ticket status to in_progress
      await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      // Simulate time passage and check SLA monitoring
      const slaMonitorResponse = await request(app)
        .get(`/api/sla/monitor/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(slaMonitorResponse.body.monitoring).toBeDefined();
      expect(slaMonitorResponse.body.monitoring.currentRisk).toBeDefined();
      expect(slaMonitorResponse.body.monitoring.timeRemaining).toBeDefined();
    });

    test('6. Test notification system integration', async () => {
      // Simulate high SLA risk to trigger notifications
      const highRiskTicket = {
        title: 'Critical system outage - production down',
        description: 'Complete system failure affecting all users. Revenue impact estimated at $10k/hour.',
        customerId: 'customer-456',
        customerTier: 'enterprise',
        priority: 'critical'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(highRiskTicket)
        .expect(201);

      const criticalTicketId = response.body.ticket.id;

      // Wait for AI processing and SLA risk calculation
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if notifications were triggered
      const notificationResponse = await request(app)
        .get(`/api/notifications/ticket/${criticalTicketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(notificationResponse.body.notifications).toBeDefined();
      expect(Array.isArray(notificationResponse.body.notifications)).toBe(true);
    });

    test('7. Complete ticket resolution workflow', async () => {
      // Add resolution notes
      const resolutionData = {
        status: 'resolved',
        resolutionNotes: 'Optimized database queries and increased server resources. CPU usage now stable at 45%.',
        resolutionTime: 240 // 4 hours in minutes
      };

      const response = await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(resolutionData)
        .expect(200);

      expect(response.body.ticket.status).toBe('resolved');
      expect(response.body.ticket.resolutionNotes).toBe(resolutionData.resolutionNotes);
      expect(response.body.ticket.actualResolutionTime).toBe(resolutionData.resolutionTime);

      // Verify analytics were updated
      const analyticsResponse = await request(app)
        .get('/api/analytics/performance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.metrics).toBeDefined();
    });
  });

  describe('AI Service Error Handling and Graceful Degradation', () => {
    test('Handle AI service unavailability', async () => {
      // Mock AI service failure
      jest.spyOn(aiService, 'triageTicket').mockRejectedValue(new Error('AI service unavailable'));

      const ticketData = {
        title: 'Test ticket for AI failure scenario',
        description: 'Testing graceful degradation when AI service fails',
        customerId: 'customer-789'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      // Ticket should still be created with fallback classification
      expect(response.body.ticket).toBeDefined();
      expect(response.body.ticket.status).toBe('open');
      expect(response.body.ticket.priority).toBe('medium'); // Default fallback priority
    });

    test('Handle partial AI service failures', async () => {
      // Mock triage success but resolution suggestion failure
      jest.spyOn(aiService, 'triageTicket').mockResolvedValue({
        category: 'software',
        priority: 'high',
        confidence: 0.85
      });
      jest.spyOn(aiService, 'getResolutionSuggestions').mockRejectedValue(new Error('Resolution service down'));

      const ticketData = {
        title: 'Partial AI failure test',
        description: 'Testing partial AI service degradation',
        customerId: 'customer-101'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      const ticketId = response.body.ticket.id;

      // Triage should work
      expect(response.body.ticket.aiInsights.category).toBe('software');

      // Resolution suggestions should fail gracefully
      const suggestionResponse = await request(app)
        .post('/api/tickets/resolution-suggestions')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ticketId })
        .expect(200);

      expect(suggestionResponse.body.suggestions).toBeDefined();
      expect(suggestionResponse.body.fallbackUsed).toBe(true);
    });
  });

  describe('Real-time Integration Testing', () => {
    test('WebSocket updates for ticket changes', async () => {
      // This would require WebSocket testing setup
      // For now, we'll test the REST API that feeds the WebSocket
      const ticketData = {
        title: 'Real-time update test',
        description: 'Testing real-time notifications',
        customerId: 'customer-202'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      const ticketId = response.body.ticket.id;

      // Update ticket and verify event is published
      await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ status: 'in_progress' })
        .expect(200);

      // Check if update event was recorded
      const eventsResponse = await request(app)
        .get(`/api/tickets/${ticketId}/events`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(eventsResponse.body.events).toBeDefined();
      expect(eventsResponse.body.events.length).toBeGreaterThan(0);
    });
  });

  describe('Cross-Service Integration', () => {
    test('SuperOps integration workflow', async () => {
      // Test webhook handling from SuperOps
      const superOpsWebhook = {
        event: 'ticket.created',
        ticket: {
          id: 'superops-123',
          title: 'Network connectivity issue',
          description: 'Customer cannot access email server',
          customer_id: 'superops-customer-456',
          priority: 'medium',
          status: 'open'
        }
      };

      const response = await request(app)
        .post('/api/superops/webhook')
        .set('X-SuperOps-Signature', 'test-signature')
        .send(superOpsWebhook)
        .expect(200);

      expect(response.body.processed).toBe(true);

      // Verify ticket was created and processed by AI
      const ticketsResponse = await request(app)
        .get('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ externalId: 'superops-123' })
        .expect(200);

      expect(ticketsResponse.body.tickets.length).toBe(1);
      const ticket = ticketsResponse.body.tickets[0];
      expect(ticket.externalId).toBe('superops-123');
      expect(ticket.aiInsights).toBeDefined();
    });

    test('Slack notification integration', async () => {
      // Create high-priority ticket that should trigger Slack notification
      const urgentTicket = {
        title: 'Production database failure',
        description: 'Primary database server is unresponsive. All services affected.',
        customerId: 'customer-303',
        priority: 'critical'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(urgentTicket)
        .expect(201);

      // Wait for notification processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Check notification delivery status
      const notificationStatus = await request(app)
        .get(`/api/notifications/delivery-status/${response.body.ticket.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(notificationStatus.body.deliveries).toBeDefined();
      expect(notificationStatus.body.deliveries.some(d => d.channel === 'slack')).toBe(true);
    });
  });

  afterAll(async () => {
    // Cleanup test data
    await ticketService.cleanup();
  });
});