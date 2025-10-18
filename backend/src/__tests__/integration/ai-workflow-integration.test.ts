import request from 'supertest';
import app from '../../index';
import { TicketService } from '../../services/TicketService';
import { aiService } from '../../services/AIService';
import { TicketStatus, Priority, TicketCategory } from '../../types';
import { CreateTicketRequest } from '../../models/Ticket';

describe('AI Workflow Integration Tests', () => {
  let ticketService: TicketService;
  let authToken: string;
  let testCustomerId: string;
  let testTicketId: string;

  beforeAll(async () => {
    ticketService = new TicketService();
    testCustomerId = 'test-customer-001';
    
    // Mock authentication for tests
    authToken = 'mock-jwt-token';
  });

  afterAll(async () => {
    // Cleanup test data if needed
  });

  describe('Complete Ticket Lifecycle with AI Processing', () => {
    test('should create ticket with AI triage integration', async () => {
      const ticketData: CreateTicketRequest = {
        title: 'Email server down affecting multiple offices',
        description: 'The Exchange email server is completely down. Users cannot send or receive emails. Error message: "Cannot connect to server". This is affecting our Bangalore and Mumbai offices with approximately 500 users impacted.',
        customerId: testCustomerId,
        reportedBy: 'john.doe@company.com',
        customerTier: 'enterprise',
        affectedSystems: ['Exchange Server', 'Outlook'],
        errorMessages: ['Cannot connect to server', 'Connection timeout'],
        category: TicketCategory.SOFTWARE,
        priority: Priority.HIGH
      };

      // Test ticket creation with AI triage
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(ticketData.title);
      expect(response.body.status).toBe(TicketStatus.OPEN);
      
      // Verify AI insights were applied
      expect(response.body).toHaveProperty('aiInsights');
      if (response.body.aiInsights) {
        expect(response.body.aiInsights).toHaveProperty('triageConfidence');
        expect(response.body.aiInsights).toHaveProperty('suggestedCategory');
        expect(response.body.aiInsights).toHaveProperty('suggestedPriority');
      }

      testTicketId = response.body.id;
    });

    test('should get SLA prediction for created ticket', async () => {
      // Test SLA prediction endpoint
      const response = await request(app)
        .get(`/api/tickets/${testTicketId}/sla-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('result');
      expect(response.body.result).toHaveProperty('breach_probability');
      expect(response.body.result).toHaveProperty('risk_level');
      expect(response.body.result).toHaveProperty('estimated_completion_hours');
      expect(response.body.result.breach_probability).toBeGreaterThanOrEqual(0);
      expect(response.body.result.breach_probability).toBeLessThanOrEqual(1);
    });

    test('should get AI resolution suggestions for ticket', async () => {
      // Test resolution suggestions endpoint
      const response = await request(app)
        .get(`/api/tickets/${testTicketId}/resolution-suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('suggestions');
      expect(Array.isArray(response.body.suggestions)).toBe(true);
      
      if (response.body.suggestions.length > 0) {
        const suggestion = response.body.suggestions[0];
        expect(suggestion).toHaveProperty('title');
        expect(suggestion).toHaveProperty('description');
        expect(suggestion).toHaveProperty('steps');
        expect(suggestion).toHaveProperty('confidence_score');
        expect(Array.isArray(suggestion.steps)).toBe(true);
      }

      expect(response.body).toHaveProperty('similar_tickets');
      expect(Array.isArray(response.body.similar_tickets)).toBe(true);
    });

    test('should get AI-powered assignment recommendations', async () => {
      const availableTechnicians = ['tech-001', 'tech-002', 'tech-003'];
      
      const response = await request(app)
        .post(`/api/tickets/${testTicketId}/assignment-recommendations`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ availableTechnicianIds: availableTechnicians })
        .expect(200);

      expect(response.body).toHaveProperty('primary_recommendation');
      expect(response.body.primary_recommendation).toHaveProperty('technician_id');
      expect(response.body.primary_recommendation).toHaveProperty('confidence_score');
      expect(response.body.primary_recommendation).toHaveProperty('reasoning');

      expect(response.body).toHaveProperty('alternative_recommendations');
      expect(Array.isArray(response.body.alternative_recommendations)).toBe(true);

      expect(response.body).toHaveProperty('routing_factors');
      expect(response.body.routing_factors).toHaveProperty('skill_match_score');
      expect(response.body.routing_factors).toHaveProperty('workload_balance_score');
    });

    test('should assign ticket and trigger workload analysis', async () => {
      const technicianId = 'tech-001';
      
      const response = await request(app)
        .put(`/api/tickets/${testTicketId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ 
          technicianId,
          assignedBy: 'manager-001'
        })
        .expect(200);

      expect(response.body.assignedTechnicianId).toBe(technicianId);
      expect(response.body.status).toBe(TicketStatus.IN_PROGRESS);
    });

    test('should update ticket status and maintain AI insights', async () => {
      const response = await request(app)
        .put(`/api/tickets/${testTicketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: TicketStatus.RESOLVED,
          resolutionNotes: 'Restarted Exchange services and verified email flow is restored.',
          updatedBy: 'tech-001'
        })
        .expect(200);

      expect(response.body.status).toBe(TicketStatus.RESOLVED);
      expect(response.body.resolutionNotes).toBeDefined();
      expect(response.body.resolvedBy).toBe('tech-001');
      
      // AI insights should still be preserved
      expect(response.body).toHaveProperty('aiInsights');
    });
  });

  describe('AI Service Error Handling and Graceful Degradation', () => {
    test('should handle AI service unavailability gracefully', async () => {
      // Mock AI service failure
      jest.spyOn(aiService, 'triageTicket').mockRejectedValueOnce(new Error('AI service unavailable'));

      const ticketData: CreateTicketRequest = {
        title: 'Network connectivity issues',
        description: 'Users unable to access internal applications',
        customerId: testCustomerId,
        reportedBy: 'jane.doe@company.com',
        category: TicketCategory.NETWORK,
        priority: Priority.MEDIUM
      };

      // Ticket creation should still succeed without AI triage
      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.title).toBe(ticketData.title);
      expect(response.body.category).toBe(ticketData.category);
      expect(response.body.priority).toBe(ticketData.priority);
      
      // AI insights should be null or empty when AI service fails
      expect(response.body.aiInsights).toBeUndefined();
    });

    test('should provide fallback responses when AI predictions fail', async () => {
      // Mock AI service failure for SLA prediction
      jest.spyOn(aiService, 'predictSLA').mockResolvedValueOnce({
        success: false,
        error: 'AI service unavailable',
        processing_time_ms: 0,
        cached: false,
        model_version: 'fallback'
      });

      const response = await request(app)
        .get(`/api/tickets/${testTicketId}/sla-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.error).toContain('unavailable');
    });

    test('should handle partial AI service failures', async () => {
      // Mock resolution service failure but triage success
      jest.spyOn(aiService, 'suggestResolution').mockResolvedValueOnce({
        success: false,
        ticket_id: testTicketId,
        error: 'Resolution service temporarily unavailable',
        processing_time_ms: 0,
        cached: false
      });

      const response = await request(app)
        .get(`/api/tickets/${testTicketId}/resolution-suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('error');
      expect(response.body.ticket_id).toBe(testTicketId);
    });
  });

  describe('Real-time AI Processing Integration', () => {
    test('should process multiple tickets concurrently with AI', async () => {
      const ticketPromises = [];
      
      // Create multiple tickets simultaneously
      for (let i = 0; i < 3; i++) {
        const ticketData: CreateTicketRequest = {
          title: `Concurrent test ticket ${i + 1}`,
          description: `Test ticket for concurrent AI processing - ${i + 1}`,
          customerId: testCustomerId,
          reportedBy: `user${i + 1}@company.com`,
          category: TicketCategory.SOFTWARE,
          priority: Priority.MEDIUM
        };

        ticketPromises.push(
          request(app)
            .post('/api/tickets')
            .set('Authorization', `Bearer ${authToken}`)
            .send(ticketData)
        );
      }

      const responses = await Promise.all(ticketPromises);
      
      // All tickets should be created successfully
      responses.forEach((response, index) => {
        expect(response.status).toBe(201);
        expect(response.body).toHaveProperty('id');
        expect(response.body.title).toContain(`Concurrent test ticket ${index + 1}`);
      });
    });

    test('should maintain AI processing performance under load', async () => {
      const startTime = Date.now();
      
      const ticketData: CreateTicketRequest = {
        title: 'Performance test ticket',
        description: 'Testing AI processing performance under load conditions',
        customerId: testCustomerId,
        reportedBy: 'performance.test@company.com',
        category: TicketCategory.HARDWARE,
        priority: Priority.LOW
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      const processingTime = Date.now() - startTime;
      
      // Ticket creation with AI processing should complete within reasonable time
      expect(processingTime).toBeLessThan(10000); // 10 seconds max
      expect(response.body).toHaveProperty('id');
    });
  });

  describe('AI Workflow Data Consistency', () => {
    test('should maintain data consistency across AI processing stages', async () => {
      const ticketData: CreateTicketRequest = {
        title: 'Data consistency test ticket',
        description: 'Testing data consistency across AI workflow stages',
        customerId: testCustomerId,
        reportedBy: 'consistency.test@company.com',
        category: TicketCategory.SECURITY,
        priority: Priority.HIGH
      };

      // Create ticket
      const createResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      const ticketId = createResponse.body.id;

      // Get ticket details
      const getResponse = await request(app)
        .get(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify data consistency
      expect(getResponse.body.id).toBe(ticketId);
      expect(getResponse.body.title).toBe(ticketData.title);
      expect(getResponse.body.description).toBe(ticketData.description);
      expect(getResponse.body.customerId).toBe(ticketData.customerId);

      // AI insights should be consistent if applied
      if (createResponse.body.aiInsights && getResponse.body.aiInsights) {
        expect(getResponse.body.aiInsights.triageConfidence)
          .toBe(createResponse.body.aiInsights.triageConfidence);
        expect(getResponse.body.aiInsights.suggestedCategory)
          .toBe(createResponse.body.aiInsights.suggestedCategory);
      }
    });

    test('should validate AI confidence thresholds', async () => {
      // Mock low confidence AI response
      jest.spyOn(aiService, 'triageTicket').mockResolvedValueOnce({
        success: true,
        result: {
          category: 'software',
          priority: 'medium',
          urgency: 'medium',
          impact: 'medium',
          confidence_score: 0.3, // Low confidence
          reasoning: 'Low confidence classification',
          suggested_technician_skills: ['general'],
          estimated_resolution_time: 120
        },
        processing_time_ms: 500,
        cached: false
      });

      const ticketData: CreateTicketRequest = {
        title: 'Low confidence test ticket',
        description: 'Testing AI confidence threshold handling',
        customerId: testCustomerId,
        reportedBy: 'confidence.test@company.com',
        category: TicketCategory.HARDWARE, // Explicit category
        priority: Priority.HIGH // Explicit priority
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      // With low AI confidence, original values should be preserved
      expect(response.body.category).toBe(TicketCategory.HARDWARE);
      expect(response.body.priority).toBe(Priority.HIGH);
      
      // AI insights should still be recorded
      expect(response.body.aiInsights).toBeDefined();
      expect(response.body.aiInsights.triageConfidence).toBe(0.3);
    });
  });

  describe('AI Service Health and Monitoring', () => {
    test('should check AI service health status', async () => {
      const response = await request(app)
        .get('/api/ai/health')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('status');
      expect(response.body).toHaveProperty('dependencies');
      expect(response.body.dependencies).toHaveProperty('gemini');
      expect(response.body.dependencies).toHaveProperty('cache');
    });

    test('should provide AI service metrics', async () => {
      const response = await request(app)
        .get('/api/ai/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('processing_stats');
      expect(response.body).toHaveProperty('model_performance');
      expect(response.body).toHaveProperty('cache_statistics');
    });
  });
});