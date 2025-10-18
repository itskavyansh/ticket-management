import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../index';
import axios from 'axios';

describe('E2E: AI Processing Pipeline', () => {
  let app: any;
  let server: Server;
  let authToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = createApp();
    server = app.listen(0);
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test.manager@example.com',
        password: 'testpassword123'
      });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    if (server) {
      server.close();
    }
  });

  describe('Ticket Triage AI Pipeline', () => {
    it('should classify tickets accurately using AI', async () => {
      const testCases = [
        {
          title: 'Laptop screen flickering',
          description: 'User reports laptop screen is flickering intermittently. Issue started after recent Windows update.',
          expectedCategory: 'Hardware',
          expectedPriority: 'Medium'
        },
        {
          title: 'Cannot access shared network drive',
          description: 'Multiple users unable to access \\\\server\\shared folder. Getting access denied error.',
          expectedCategory: 'Network',
          expectedPriority: 'High'
        },
        {
          title: 'Suspicious email received',
          description: 'Employee received phishing email with malicious attachment. Need to investigate potential security breach.',
          expectedCategory: 'Security',
          expectedPriority: 'Critical'
        }
      ];

      for (const testCase of testCases) {
        // Create ticket
        const ticketResponse = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: testCase.title,
            description: testCase.description,
            customerId: 'test-customer-ai-001'
          })
          .expect(201);

        const ticketId = ticketResponse.body.id;

        // Wait for AI processing
        await new Promise(resolve => setTimeout(resolve, 3000));

        // Verify AI classification
        const aiResponse = await request(app)
          .get(`/api/tickets/${ticketId}/ai-insights`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(aiResponse.body.suggestedCategory).toBe(testCase.expectedCategory);
        expect(aiResponse.body.suggestedPriority).toBe(testCase.expectedPriority);
        expect(aiResponse.body.triageConfidence).toBeGreaterThan(0.7);
      }
    });

    it('should handle AI service failures gracefully', async () => {
      // Mock AI service failure
      const originalAiServiceUrl = process.env.AI_SERVICE_URL;
      process.env.AI_SERVICE_URL = 'http://invalid-ai-service:8000';

      const ticketData = {
        title: 'Test AI fallback',
        description: 'Testing fallback when AI service is unavailable',
        customerId: 'test-customer-fallback-001'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      // Wait for processing attempt
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify fallback classification was applied
      const ticketResponse = await request(app)
        .get(`/api/tickets/${response.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(ticketResponse.body.category).toBeDefined();
      expect(ticketResponse.body.priority).toBeDefined();
      expect(ticketResponse.body.aiInsights.fallbackUsed).toBe(true);

      // Restore original AI service URL
      process.env.AI_SERVICE_URL = originalAiServiceUrl;
    });

    it('should provide confidence scores for AI decisions', async () => {
      const ticketData = {
        title: 'Clear hardware issue',
        description: 'Desktop computer will not power on. No lights, no fans spinning. Checked power cable and outlet.',
        customerId: 'test-customer-confidence-001'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 2000));

      const aiResponse = await request(app)
        .get(`/api/tickets/${response.body.id}/ai-insights`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(aiResponse.body.triageConfidence).toBeGreaterThan(0.8);
      expect(aiResponse.body.categoryConfidence).toBeGreaterThan(0.8);
      expect(aiResponse.body.priorityConfidence).toBeGreaterThan(0.7);
    });
  });

  describe('SLA Prediction AI Pipeline', () => {
    it('should predict SLA breach probability accurately', async () => {
      // Create tickets with different complexity levels
      const complexTicket = {
        title: 'Complex network infrastructure issue',
        description: 'Multiple servers experiencing intermittent connectivity issues. Affects critical business applications.',
        customerId: 'enterprise-customer-001',
        priority: 'Critical',
        category: 'Network'
      };

      const simpleTicket = {
        title: 'Password reset request',
        description: 'User forgot password and needs reset for email account.',
        customerId: 'standard-customer-001',
        priority: 'Low',
        category: 'Account'
      };

      // Create complex ticket
      const complexResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(complexTicket)
        .expect(201);

      // Create simple ticket
      const simpleResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(simpleTicket)
        .expect(201);

      // Wait for SLA prediction processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get SLA predictions
      const complexSlaResponse = await request(app)
        .get(`/api/tickets/${complexResponse.body.id}/sla-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const simpleSlaResponse = await request(app)
        .get(`/api/tickets/${simpleResponse.body.id}/sla-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Complex ticket should have higher breach probability
      expect(complexSlaResponse.body.breachProbability).toBeGreaterThan(
        simpleSlaResponse.body.breachProbability
      );

      // Verify prediction confidence
      expect(complexSlaResponse.body.predictionConfidence).toBeGreaterThan(0.6);
      expect(simpleSlaResponse.body.predictionConfidence).toBeGreaterThan(0.6);

      // Verify estimated completion times
      expect(complexSlaResponse.body.estimatedCompletionTime).toBeGreaterThan(
        simpleSlaResponse.body.estimatedCompletionTime
      );
    });

    it('should update SLA predictions based on progress', async () => {
      const ticketData = {
        title: 'Server maintenance task',
        description: 'Scheduled server maintenance and updates',
        customerId: 'test-customer-sla-001',
        priority: 'Medium',
        category: 'Maintenance'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      const ticketId = response.body.id;

      // Get initial SLA prediction
      await new Promise(resolve => setTimeout(resolve, 2000));
      const initialSlaResponse = await request(app)
        .get(`/api/tickets/${ticketId}/sla-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const initialBreachProbability = initialSlaResponse.body.breachProbability;

      // Update ticket progress
      await request(app)
        .put(`/api/tickets/${ticketId}/progress`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'In Progress',
          progressPercentage: 60,
          notes: 'Server updates completed, testing in progress'
        })
        .expect(200);

      // Wait for SLA prediction update
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get updated SLA prediction
      const updatedSlaResponse = await request(app)
        .get(`/api/tickets/${ticketId}/sla-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Breach probability should decrease with progress
      expect(updatedSlaResponse.body.breachProbability).toBeLessThan(initialBreachProbability);
    });
  });

  describe('Resolution Suggestion AI Pipeline', () => {
    it('should provide relevant resolution suggestions', async () => {
      // Create ticket with common issue
      const ticketData = {
        title: 'Outlook not receiving emails',
        description: 'User reports Outlook is not receiving new emails. Can send emails but inbox not updating.',
        customerId: 'test-customer-resolution-001',
        priority: 'Medium',
        category: 'Email'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      const ticketId = response.body.id;

      // Wait for AI processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Get resolution suggestions
      const suggestionsResponse = await request(app)
        .get(`/api/tickets/${ticketId}/resolution-suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(suggestionsResponse.body.suggestions)).toBe(true);
      expect(suggestionsResponse.body.suggestions.length).toBeGreaterThan(0);

      const topSuggestion = suggestionsResponse.body.suggestions[0];
      expect(topSuggestion).toHaveProperty('title');
      expect(topSuggestion).toHaveProperty('description');
      expect(topSuggestion).toHaveProperty('steps');
      expect(topSuggestion).toHaveProperty('confidence');
      expect(topSuggestion).toHaveProperty('similarTickets');

      expect(topSuggestion.confidence).toBeGreaterThan(0.5);
      expect(Array.isArray(topSuggestion.steps)).toBe(true);
      expect(topSuggestion.steps.length).toBeGreaterThan(0);
    });

    it('should rank suggestions by relevance and confidence', async () => {
      const ticketData = {
        title: 'Printer not working',
        description: 'Office printer showing error code E001. Paper jam cleared but still not printing.',
        customerId: 'test-customer-ranking-001',
        priority: 'Low',
        category: 'Hardware'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      await new Promise(resolve => setTimeout(resolve, 3000));

      const suggestionsResponse = await request(app)
        .get(`/api/tickets/${response.body.id}/resolution-suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const suggestions = suggestionsResponse.body.suggestions;
      expect(suggestions.length).toBeGreaterThan(1);

      // Verify suggestions are ranked by confidence (descending)
      for (let i = 1; i < suggestions.length; i++) {
        expect(suggestions[i - 1].confidence).toBeGreaterThanOrEqual(suggestions[i].confidence);
      }

      // Verify top suggestion has high relevance
      expect(suggestions[0].confidence).toBeGreaterThan(0.6);
    });

    it('should learn from resolution outcomes', async () => {
      const ticketData = {
        title: 'VPN connection issues',
        description: 'Cannot connect to company VPN. Getting authentication failed error.',
        customerId: 'test-customer-learning-001',
        priority: 'Medium',
        category: 'Network'
      };

      const response = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send(ticketData)
        .expect(201);

      const ticketId = response.body.id;

      // Get initial suggestions
      await new Promise(resolve => setTimeout(resolve, 2000));
      const initialSuggestions = await request(app)
        .get(`/api/tickets/${ticketId}/resolution-suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Apply a resolution and mark it as successful
      await request(app)
        .put(`/api/tickets/${ticketId}/resolve`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          resolution: 'Reset VPN client configuration and updated certificates',
          resolutionCategory: 'Configuration Reset',
          suggestionUsed: initialSuggestions.body.suggestions[0].id,
          resolutionSuccess: true,
          actualResolutionTime: 30
        })
        .expect(200);

      // Verify learning feedback was recorded
      const feedbackResponse = await request(app)
        .get(`/api/ai/resolution-feedback/${initialSuggestions.body.suggestions[0].id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(feedbackResponse.body.successCount).toBeGreaterThan(0);
      expect(feedbackResponse.body.totalUsage).toBeGreaterThan(0);
    });
  });

  describe('Workload Optimization AI Pipeline', () => {
    it('should optimize ticket assignments based on technician skills and workload', async () => {
      // Create multiple tickets with different skill requirements
      const tickets = [
        {
          title: 'Database performance issue',
          description: 'SQL queries running slowly, need database optimization',
          category: 'Database',
          priority: 'High',
          requiredSkills: ['Database Administration', 'SQL Optimization']
        },
        {
          title: 'Network configuration',
          description: 'Configure new VLAN for department',
          category: 'Network',
          priority: 'Medium',
          requiredSkills: ['Network Administration', 'VLAN Configuration']
        },
        {
          title: 'Software installation',
          description: 'Install and configure new accounting software',
          category: 'Software',
          priority: 'Low',
          requiredSkills: ['Software Installation', 'Application Support']
        }
      ];

      const createdTickets = [];
      for (const ticket of tickets) {
        const response = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: ticket.title,
            description: ticket.description,
            customerId: 'test-customer-workload-001',
            category: ticket.category,
            priority: ticket.priority
          })
          .expect(201);

        createdTickets.push(response.body.id);
      }

      // Wait for AI workload optimization
      await new Promise(resolve => setTimeout(resolve, 4000));

      // Get optimization recommendations
      const optimizationResponse = await request(app)
        .get('/api/workload/optimization-recommendations')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(optimizationResponse.body.recommendations)).toBe(true);
      expect(optimizationResponse.body.recommendations.length).toBeGreaterThan(0);

      // Verify recommendations include skill matching
      const recommendations = optimizationResponse.body.recommendations;
      for (const rec of recommendations) {
        expect(rec).toHaveProperty('ticketId');
        expect(rec).toHaveProperty('recommendedTechnicianId');
        expect(rec).toHaveProperty('matchScore');
        expect(rec).toHaveProperty('reasoning');
        expect(rec.matchScore).toBeGreaterThan(0);
      }
    });

    it('should predict and prevent technician overutilization', async () => {
      // Get current workload analysis
      const workloadResponse = await request(app)
        .get('/api/workload/analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(workloadResponse.body).toHaveProperty('technicians');
      expect(Array.isArray(workloadResponse.body.technicians)).toBe(true);

      // Find technician with high utilization
      const highUtilizationTech = workloadResponse.body.technicians.find(
        (tech: any) => tech.utilizationRate > 0.8
      );

      if (highUtilizationTech) {
        // Get overutilization prediction
        const predictionResponse = await request(app)
          .get(`/api/workload/overutilization-prediction/${highUtilizationTech.id}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(predictionResponse.body).toHaveProperty('riskScore');
        expect(predictionResponse.body).toHaveProperty('predictedOverutilization');
        expect(predictionResponse.body).toHaveProperty('recommendations');

        if (predictionResponse.body.riskScore > 0.7) {
          expect(Array.isArray(predictionResponse.body.recommendations)).toBe(true);
          expect(predictionResponse.body.recommendations.length).toBeGreaterThan(0);
        }
      }
    });
  });

  describe('AI Model Performance Monitoring', () => {
    it('should track AI model accuracy and performance metrics', async () => {
      // Get AI model performance metrics
      const metricsResponse = await request(app)
        .get('/api/ai/performance-metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(metricsResponse.body).toHaveProperty('triageModel');
      expect(metricsResponse.body).toHaveProperty('slaModel');
      expect(metricsResponse.body).toHaveProperty('resolutionModel');

      // Verify triage model metrics
      const triageMetrics = metricsResponse.body.triageModel;
      expect(triageMetrics).toHaveProperty('accuracy');
      expect(triageMetrics).toHaveProperty('averageConfidence');
      expect(triageMetrics).toHaveProperty('totalPredictions');
      expect(triageMetrics).toHaveProperty('averageResponseTime');

      expect(triageMetrics.accuracy).toBeGreaterThanOrEqual(0);
      expect(triageMetrics.accuracy).toBeLessThanOrEqual(1);
      expect(triageMetrics.averageResponseTime).toBeGreaterThan(0);
    });

    it('should detect model drift and trigger retraining alerts', async () => {
      // Get model drift analysis
      const driftResponse = await request(app)
        .get('/api/ai/model-drift-analysis')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(driftResponse.body).toHaveProperty('models');
      expect(Array.isArray(driftResponse.body.models)).toBe(true);

      for (const model of driftResponse.body.models) {
        expect(model).toHaveProperty('modelName');
        expect(model).toHaveProperty('driftScore');
        expect(model).toHaveProperty('lastTrainingDate');
        expect(model).toHaveProperty('recommendRetraining');

        expect(model.driftScore).toBeGreaterThanOrEqual(0);
        expect(model.driftScore).toBeLessThanOrEqual(1);
      }

      // Check for retraining alerts
      const alertsResponse = await request(app)
        .get('/api/ai/retraining-alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(alertsResponse.body)).toBe(true);
    });
  });
});