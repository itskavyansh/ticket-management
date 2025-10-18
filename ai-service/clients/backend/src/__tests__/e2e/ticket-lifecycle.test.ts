import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../index';
import { TicketService } from '../../services/TicketService';
import { SuperOpsService } from '../../services/SuperOpsService';
import { NotificationService } from '../../services/NotificationService';
import { SLAService } from '../../services/SLAService';

describe('E2E: Complete Ticket Lifecycle', () => {
  let app: any;
  let server: Server;
  let authToken: string;

  beforeAll(async () => {
    // Setup test environment
    process.env.NODE_ENV = 'test';
    app = createApp();
    server = app.listen(0);
    
    // Get auth token for testing
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test.technician@example.com',
        password: 'testpassword123'
      });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Ticket Creation to Resolution Flow', () => {
    let ticketId: string;
    let customerId: string;
    let technicianId: string;

    beforeEach(async () => {
      // Setup test data
      customerId = 'test-customer-001';
      technicianId = 'test-technician-001';
    });

    it('should create a new ticket and trigger AI triage', async () => {
      // Test ticket creation
      const ticketData = {
        title: 'Email server not responding',
        description: 'Users cannot access email. Server appears to be down. Error: Connection timeout when connecting to mail.company.com',
        customerId,
        priority: 'Medium',
        category: 'Infrastructure'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(ticketData.title);
      expect(response.body.status).toBe('Open');
      
      ticketId = response.body.id;

      // Verify AI triage was triggered
      await new Promise(resolve => setTimeout(resolve, 2000)); // Wait for async AI processing
      
      const triageResponse = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(triageResponse.body.aiInsights).toBeDefined();
      expect(triageResponse.body.aiInsights.suggestedCategory).toBeDefined();
      expect(triageResponse.body.aiInsights.triageConfidence).toBeGreaterThan(0);
    });

    it('should assign ticket to technician and calculate SLA', async () => {
      // Test ticket assignment
      const assignmentResponse = await request(app)
        .put(`/api/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ technicianId })
        .expect(200);

      expect(assignmentResponse.body.assignedTechnicianId).toBe(technicianId);
      expect(assignmentResponse.body.slaDeadline).toBeDefined();
      expect(new Date(assignmentResponse.body.slaDeadline)).toBeInstanceOf(Date);

      // Verify SLA calculation
      const slaResponse = await request(app)
        .get(`/api/tickets/${ticketId}/sla`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(slaResponse.body.deadline).toBeDefined();
      expect(slaResponse.body.remainingTime).toBeGreaterThan(0);
      expect(slaResponse.body.riskScore).toBeGreaterThanOrEqual(0);
    });

    it('should track time and update ticket progress', async () => {
      // Start time tracking
      const startTimeResponse = await request(app)
        .post(`/api/time-tracking/start`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ticketId, technicianId })
        .expect(200);

      expect(startTimeResponse.body.status).toBe('active');

      // Simulate work progress
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Add progress update
      const progressResponse = await request(app)
        .put(`/api/tickets/${ticketId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'In Progress',
          notes: 'Investigating email server connectivity issues',
          progressPercentage: 25
        })
        .expect(200);

      expect(progressResponse.body.status).toBe('In Progress');
      expect(progressResponse.body.progressPercentage).toBe(25);

      // Stop time tracking
      const stopTimeResponse = await request(app)
        .post(`/api/time-tracking/stop`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ticketId, technicianId })
        .expect(200);

      expect(stopTimeResponse.body.status).toBe('stopped');
      expect(stopTimeResponse.body.totalTime).toBeGreaterThan(0);
    });

    it('should provide AI resolution suggestions', async () => {
      // Request AI resolution suggestions
      const suggestionsResponse = await request(app)
        .get(`/api/tickets/${ticketId}/ai-suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(suggestionsResponse.body.suggestions).toBeDefined();
      expect(Array.isArray(suggestionsResponse.body.suggestions)).toBe(true);
      expect(suggestionsResponse.body.suggestions.length).toBeGreaterThan(0);

      const firstSuggestion = suggestionsResponse.body.suggestions[0];
      expect(firstSuggestion).toHaveProperty('title');
      expect(firstSuggestion).toHaveProperty('description');
      expect(firstSuggestion).toHaveProperty('confidence');
      expect(firstSuggestion.confidence).toBeGreaterThan(0);
    });

    it('should resolve ticket and update analytics', async () => {
      // Resolve the ticket
      const resolutionResponse = await request(app)
        .put(`/api/tickets/${ticketId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution: 'Restarted email server service. Issue was caused by memory leak in mail daemon.',
          resolutionCategory: 'Service Restart',
          actualResolutionTime: 45 // minutes
        })
        .expect(200);

      expect(resolutionResponse.body.status).toBe('Resolved');
      expect(resolutionResponse.body.resolution).toBeDefined();
      expect(resolutionResponse.body.resolvedAt).toBeDefined();

      // Verify analytics were updated
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for async analytics processing

      const analyticsResponse = await request(app)
        .get(`/api/analytics/technician/${technicianId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analyticsResponse.body.ticketsResolved).toBeGreaterThan(0);
      expect(analyticsResponse.body.averageResolutionTime).toBeGreaterThan(0);
    });

    it('should maintain ticket history and audit trail', async () => {
      // Get ticket timeline
      const timelineResponse = await request(app)
        .get(`/api/tickets/${ticketId}/timeline`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(timelineResponse.body)).toBe(true);
      expect(timelineResponse.body.length).toBeGreaterThan(0);

      // Verify key events are recorded
      const events = timelineResponse.body.map((event: any) => event.action);
      expect(events).toContain('created');
      expect(events).toContain('assigned');
      expect(events).toContain('status_changed');
      expect(events).toContain('resolved');

      // Get audit logs
      const auditResponse = await request(app)
        .get(`/api/audit/ticket/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(auditResponse.body)).toBe(true);
      expect(auditResponse.body.length).toBeGreaterThan(0);

      const auditLog = auditResponse.body[0];
      expect(auditLog).toHaveProperty('action');
      expect(auditLog).toHaveProperty('userId');
      expect(auditLog).toHaveProperty('timestamp');
      expect(auditLog).toHaveProperty('details');
    });
  });

  describe('SLA Monitoring and Alerting', () => {
    let highPriorityTicketId: string;

    it('should detect SLA risk and trigger alerts', async () => {
      // Create high priority ticket
      const ticketData = {
        title: 'Critical system outage',
        description: 'Production database is down, affecting all users',
        customerId: 'premium-customer-001',
        priority: 'Critical',
        category: 'Database'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      highPriorityTicketId = response.body.id;

      // Wait for SLA monitoring to process
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check SLA risk assessment
      const slaResponse = await request(app)
        .get(`/api/tickets/${highPriorityTicketId}/sla`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(slaResponse.body.riskScore).toBeDefined();
      expect(slaResponse.body.deadline).toBeDefined();

      // Verify alerts were generated if risk is high
      if (slaResponse.body.riskScore > 0.7) {
        const alertsResponse = await request(app)
          .get(`/api/sla-alerts/ticket/${highPriorityTicketId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(Array.isArray(alertsResponse.body)).toBe(true);
      }
    });

    it('should escalate tickets approaching SLA breach', async () => {
      // Simulate time passage to approach SLA deadline
      const escalationResponse = await request(app)
        .post(`/api/tickets/${highPriorityTicketId}/simulate-escalation`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ timeAdvanceMinutes: 120 })
        .expect(200);

      expect(escalationResponse.body.escalated).toBe(true);
      expect(escalationResponse.body.escalationLevel).toBeGreaterThan(0);

      // Verify escalation notifications
      const notificationsResponse = await request(app)
        .get(`/api/notifications/ticket/${highPriorityTicketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const escalationNotifications = notificationsResponse.body.filter(
        (notif: any) => notif.type === 'escalation'
      );
      expect(escalationNotifications.length).toBeGreaterThan(0);
    });
  });

  describe('Real-time Dashboard Updates', () => {
    it('should update dashboard metrics in real-time', async () => {
      // Get initial dashboard state
      const initialDashboard = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialOpenTickets = initialDashboard.body.openTickets;

      // Create new ticket
      const ticketData = {
        title: 'Test dashboard update',
        description: 'Testing real-time dashboard updates',
        customerId: 'test-customer-002',
        priority: 'Low',
        category: 'General'
      };

      await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      // Wait for real-time update processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify dashboard was updated
      const updatedDashboard = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedDashboard.body.openTickets).toBe(initialOpenTickets + 1);
    });

    it('should provide real-time workload updates', async () => {
      // Get technician workload
      const workloadResponse = await request(app)
        .get('/api/workload/technician/test-technician-001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(workloadResponse.body).toHaveProperty('currentLoad');
      expect(workloadResponse.body).toHaveProperty('capacity');
      expect(workloadResponse.body).toHaveProperty('utilizationRate');
      expect(workloadResponse.body).toHaveProperty('assignedTickets');

      // Verify workload calculation accuracy
      expect(workloadResponse.body.utilizationRate).toBeGreaterThanOrEqual(0);
      expect(workloadResponse.body.utilizationRate).toBeLessThanOrEqual(1);
    });
  });
});