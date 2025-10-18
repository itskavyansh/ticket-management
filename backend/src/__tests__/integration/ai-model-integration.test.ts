import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../index';
import axios from 'axios';
import nock from 'nock';

describe('Integration: AI Model Integration and Fallback Scenarios', () => {
  let app: any;
  let server: Server;
  let authToken: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.AI_SERVICE_URL = 'http://localhost:8000';
    process.env.OPENAI_API_KEY = 'test-openai-key';

    app = createApp();
    server = app.listen(0);

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test.admin@example.com',
        password: 'testpassword123'
      });

    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    nock.cleanAll();
    if (server) {
      server.close();
    }
  });

  beforeEach(() => {
    nock.cleanAll();
  });

  describe('AI Service Integration', () => {
    it('should successfully integrate with AI triage service', async () => {
      // Mock AI service response
      nock('http://localhost:8000')
        .post('/triage')
        .reply(200, {
          category: 'Hardware',
          priority: 'High',
          urgency: 'Medium',
          impact: 'High',
          confidence: 0.89,
          reasoning: 'Keywords indicate hardware failure with high business impact',
          suggested_technician: 'hardware-specialist-001',
          estimated_resolution_time: 120
        });

      // Create ticket to trigger AI triage
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Server hardware failure',
          description: 'Production server showing RAID controller errors and system instability',
          customerId: 'enterprise-customer-001'
        })
        .expect(201);

      // Wait for AI processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify AI triage results
      const aiInsightsResponse = await request(app)
        .get(`/api/tickets/${ticketResponse.body.id}/ai-insights`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(aiInsightsResponse.body.suggestedCategory).toBe('Hardware');
      expect(aiInsightsResponse.body.suggestedPriority).toBe('High');
      expect(aiInsightsResponse.body.triageConfidence).toBe(0.89);
      expect(aiInsightsResponse.body.suggestedTechnician).toBe('hardware-specialist-001');
      expect(aiInsightsResponse.body.estimatedResolutionTime).toBe(120);
    });

    it('should handle AI service timeouts gracefully', async () => {
      // Mock AI service timeout
      nock('http://localhost:8000')
        .post('/triage')
        .delay(30000) // 30 second delay to trigger timeout
        .reply(200, { category: 'General' });

      // Create ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Timeout test ticket',
          description: 'Testing AI service timeout handling',
          customerId: 'test-customer-timeout-001'
        })
        .expect(201);

      // Wait for timeout and fallback processing
      await new Promise(resolve => setTimeout(resolve, 5000));

      // Verify fallback was used
      const ticketDetails = await request(app)
        .get(`/api/tickets/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(ticketDetails.body.category).toBeDefined();
      expect(ticketDetails.body.priority).toBeDefined();
      expect(ticketDetails.body.aiInsights.fallbackUsed).toBe(true);
      expect(ticketDetails.body.aiInsights.fallbackReason).toContain('timeout');
    });

    it('should integrate with SLA prediction service', async () => {
      // Mock SLA prediction service
      nock('http://localhost:8000')
        .post('/predict-sla')
        .reply(200, {
          breach_probability: 0.75,
          estimated_completion_time: 180,
          confidence: 0.82,
          risk_factors: [
            'High complexity ticket',
            'Technician currently overloaded',
            'Similar tickets historically take longer'
          ],
          recommended_actions: [
            'Consider reassigning to available technician',
            'Escalate to senior technician',
            'Increase priority level'
          ]
        });

      // Create and assign ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Complex network configuration',
          description: 'Multi-site VPN configuration with custom routing requirements',
          customerId: 'enterprise-customer-002',
          priority: 'High',
          category: 'Network'
        })
        .expect(201);

      const ticketId = ticketResponse.body.id;

      // Assign to technician
      await request(app)
        .put(`/api/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ technicianId: 'overloaded-technician-001' })
        .expect(200);

      // Wait for SLA prediction
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get SLA prediction results
      const slaResponse = await request(app)
        .get(`/api/tickets/${ticketId}/sla-prediction`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(slaResponse.body.breachProbability).toBe(0.75);
      expect(slaResponse.body.estimatedCompletionTime).toBe(180);
      expect(slaResponse.body.predictionConfidence).toBe(0.82);
      expect(Array.isArray(slaResponse.body.riskFactors)).toBe(true);
      expect(Array.isArray(slaResponse.body.recommendedActions)).toBe(true);
    });

    it('should integrate with resolution suggestion service', async () => {
      // Mock resolution suggestion service
      nock('http://localhost:8000')
        .post('/suggest-resolution')
        .reply(200, {
          suggestions: [
            {
              id: 'suggestion-001',
              title: 'Restart Print Spooler Service',
              description: 'Common fix for printer connectivity issues',
              steps: [
                'Open Services management console',
                'Locate Print Spooler service',
                'Right-click and select Restart',
                'Test printer functionality'
              ],
              confidence: 0.91,
              estimated_time: 15,
              success_rate: 0.87,
              similar_tickets: ['TICK-001', 'TICK-045', 'TICK-123']
            },
            {
              id: 'suggestion-002',
              title: 'Update Printer Drivers',
              description: 'Install latest printer drivers from manufacturer',
              steps: [
                'Identify printer model',
                'Download latest drivers from manufacturer website',
                'Uninstall old drivers',
                'Install new drivers',
                'Restart computer'
              ],
              confidence: 0.78,
              estimated_time: 30,
              success_rate: 0.82,
              similar_tickets: ['TICK-067', 'TICK-089']
            }
          ],
          knowledge_base_articles: [
            {
              id: 'KB-001',
              title: 'Printer Troubleshooting Guide',
              url: 'https://kb.company.com/printer-troubleshooting',
              relevance: 0.95
            }
          ]
        });

      // Create printer issue ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Office printer not responding',
          description: 'Users cannot print to the main office printer. Error message: "Printer offline"',
          customerId: 'office-customer-001',
          priority: 'Medium',
          category: 'Hardware'
        })
        .expect(201);

      // Wait for AI processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get resolution suggestions
      const suggestionsResponse = await request(app)
        .get(`/api/tickets/${ticketResponse.body.id}/resolution-suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(suggestionsResponse.body.suggestions)).toBe(true);
      expect(suggestionsResponse.body.suggestions.length).toBe(2);

      const topSuggestion = suggestionsResponse.body.suggestions[0];
      expect(topSuggestion.title).toBe('Restart Print Spooler Service');
      expect(topSuggestion.confidence).toBe(0.91);
      expect(Array.isArray(topSuggestion.steps)).toBe(true);
      expect(topSuggestion.steps.length).toBe(4);

      expect(Array.isArray(suggestionsResponse.body.knowledgeBaseArticles)).toBe(true);
      expect(suggestionsResponse.body.knowledgeBaseArticles[0].relevance).toBe(0.95);
    });

    it('should integrate with workload optimization service', async () => {
      // Mock workload optimization service
      nock('http://localhost:8000')
        .post('/optimize-workload')
        .reply(200, {
          recommendations: [
            {
              ticket_id: 'workload-test-001',
              current_technician: 'overloaded-tech-001',
              recommended_technician: 'available-tech-002',
              match_score: 0.89,
              reasoning: 'Better skill match and lower current workload',
              skill_match: {
                required_skills: ['Network Administration', 'Cisco Configuration'],
                technician_skills: ['Network Administration', 'Cisco Configuration', 'Security'],
                match_percentage: 0.95
              },
              workload_impact: {
                current_utilization: 0.92,
                projected_utilization: 0.75,
                estimated_completion_improvement: '25%'
              }
            }
          ],
          overall_optimization: {
            total_tickets_analyzed: 15,
            recommendations_generated: 3,
            potential_time_savings: 120,
            workload_balance_improvement: 0.15
          }
        });

      // Create multiple tickets to trigger workload optimization
      const ticketIds = [];
      for (let i = 0; i < 3; i++) {
        const response = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Network issue ${i + 1}`,
            description: `Network configuration problem requiring Cisco expertise`,
            customerId: `workload-customer-00${i + 1}`,
            priority: 'Medium',
            category: 'Network'
          })
          .expect(201);

        ticketIds.push(response.body.id);
      }

      // Trigger workload optimization
      const optimizationResponse = await request(app)
        .post('/api/workload/optimize')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ticketIds })
        .expect(200);

      expect(Array.isArray(optimizationResponse.body.recommendations)).toBe(true);
      expect(optimizationResponse.body.recommendations.length).toBeGreaterThan(0);

      const recommendation = optimizationResponse.body.recommendations[0];
      expect(recommendation.matchScore).toBe(0.89);
      expect(recommendation.skillMatch.matchPercentage).toBe(0.95);
      expect(recommendation.workloadImpact.projectedUtilization).toBe(0.75);

      expect(optimizationResponse.body.overallOptimization.totalTicketsAnalyzed).toBe(15);
      expect(optimizationResponse.body.overallOptimization.potentialTimeSavings).toBe(120);
    });
  });

  describe('OpenAI API Integration', () => {
    it('should integrate with OpenAI for advanced ticket analysis', async () => {
      // Mock OpenAI API
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'Security',
                priority: 'Critical',
                urgency: 'High',
                impact: 'High',
                confidence: 0.94,
                reasoning: 'Email content indicates potential phishing attack with malicious attachments',
                immediate_actions: [
                  'Isolate affected user account',
                  'Scan for malware on user device',
                  'Check email logs for similar messages',
                  'Notify security team immediately'
                ],
                escalation_required: true,
                estimated_resolution_time: 60
              })
            }
          }],
          usage: {
            prompt_tokens: 150,
            completion_tokens: 200,
            total_tokens: 350
          }
        });

      // Create security-related ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Suspicious email with attachment',
          description: 'Employee received email claiming to be from bank with .exe attachment. Subject: "Urgent: Verify your account immediately". Sender: security@bank-verify.com',
          customerId: 'security-customer-001'
        })
        .expect(201);

      // Wait for OpenAI processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify OpenAI analysis results
      const analysisResponse = await request(app)
        .get(`/api/tickets/${ticketResponse.body.id}/ai-analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analysisResponse.body.category).toBe('Security');
      expect(analysisResponse.body.priority).toBe('Critical');
      expect(analysisResponse.body.confidence).toBe(0.94);
      expect(analysisResponse.body.escalationRequired).toBe(true);
      expect(Array.isArray(analysisResponse.body.immediateActions)).toBe(true);
      expect(analysisResponse.body.immediateActions.length).toBe(4);
    });

    it('should handle OpenAI API rate limits', async () => {
      // Mock rate limit response
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(429, {
          error: {
            message: 'Rate limit reached',
            type: 'rate_limit_error',
            code: 'rate_limit_exceeded'
          }
        });

      // Mock successful retry after delay
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .delay(1000)
        .reply(200, {
          choices: [{
            message: {
              content: JSON.stringify({
                category: 'General',
                priority: 'Medium',
                confidence: 0.7
              })
            }
          }]
        });

      // Create ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Rate limit test',
          description: 'Testing OpenAI rate limit handling',
          customerId: 'rate-limit-customer-001'
        })
        .expect(201);

      // Wait for retry processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify analysis was eventually completed
      const analysisResponse = await request(app)
        .get(`/api/tickets/${ticketResponse.body.id}/ai-analysis`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(analysisResponse.body.category).toBe('General');
      expect(analysisResponse.body.retryCount).toBeGreaterThan(0);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      // Mock OpenAI API error
      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(500, {
          error: {
            message: 'Internal server error',
            type: 'server_error'
          }
        });

      // Create ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'OpenAI error test',
          description: 'Testing OpenAI error handling',
          customerId: 'error-test-customer-001'
        })
        .expect(201);

      // Wait for error handling
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify fallback was used
      const ticketDetails = await request(app)
        .get(`/api/tickets/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(ticketDetails.body.aiInsights.fallbackUsed).toBe(true);
      expect(ticketDetails.body.aiInsights.fallbackReason).toContain('OpenAI API error');
      expect(ticketDetails.body.category).toBeDefined(); // Fallback classification applied
    });
  });

  describe('Fallback Scenarios', () => {
    it('should use rule-based classification when AI services fail', async () => {
      // Mock all AI services as unavailable
      nock('http://localhost:8000')
        .post('/triage')
        .reply(503, { error: 'Service unavailable' });

      nock('https://api.openai.com')
        .post('/v1/chat/completions')
        .reply(503, { error: 'Service unavailable' });

      // Create ticket with clear keywords for rule-based classification
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Email server down - urgent',
          description: 'Exchange server not responding. Users cannot send or receive emails. Critical business impact.',
          customerId: 'fallback-customer-001'
        })
        .expect(201);

      // Wait for fallback processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify rule-based classification
      const ticketDetails = await request(app)
        .get(`/api/tickets/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(ticketDetails.body.category).toBe('Email'); // Rule-based: "email" keyword
      expect(ticketDetails.body.priority).toBe('Critical'); // Rule-based: "urgent", "critical" keywords
      expect(ticketDetails.body.aiInsights.fallbackUsed).toBe(true);
      expect(ticketDetails.body.aiInsights.classificationMethod).toBe('rule-based');
    });

    it('should provide basic SLA estimates when prediction service fails', async () => {
      // Mock SLA prediction service failure
      nock('http://localhost:8000')
        .post('/predict-sla')
        .reply(500, { error: 'Prediction service error' });

      // Create ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'SLA fallback test',
          description: 'Testing SLA fallback calculations',
          customerId: 'sla-fallback-customer-001',
          priority: 'High',
          category: 'Network'
        })
        .expect(201);

      const ticketId = ticketResponse.body.id;

      // Assign ticket
      await request(app)
        .put(`/api/tickets/${ticketId}/assign`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ technicianId: 'fallback-technician-001' })
        .expect(200);

      // Wait for fallback SLA calculation
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify fallback SLA calculation
      const slaResponse = await request(app)
        .get(`/api/tickets/${ticketId}/sla`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(slaResponse.body.deadline).toBeDefined();
      expect(slaResponse.body.estimatedResolutionTime).toBeGreaterThan(0);
      expect(slaResponse.body.calculationMethod).toBe('fallback');
      expect(slaResponse.body.basedOn).toContain('priority and category defaults');
    });

    it('should provide generic resolution suggestions when AI fails', async () => {
      // Mock resolution service failure
      nock('http://localhost:8000')
        .post('/suggest-resolution')
        .reply(503, { error: 'Resolution service unavailable' });

      // Create ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Printer not working',
          description: 'Office printer showing error message',
          customerId: 'resolution-fallback-customer-001',
          priority: 'Medium',
          category: 'Hardware'
        })
        .expect(201);

      // Wait for fallback processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get fallback resolution suggestions
      const suggestionsResponse = await request(app)
        .get(`/api/tickets/${ticketResponse.body.id}/resolution-suggestions`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(Array.isArray(suggestionsResponse.body.suggestions)).toBe(true);
      expect(suggestionsResponse.body.suggestions.length).toBeGreaterThan(0);
      expect(suggestionsResponse.body.fallbackUsed).toBe(true);

      // Verify generic suggestions are provided
      const suggestion = suggestionsResponse.body.suggestions[0];
      expect(suggestion.title).toBeDefined();
      expect(suggestion.description).toBeDefined();
      expect(suggestion.source).toBe('knowledge-base-fallback');
    });

    it('should maintain system functionality during complete AI outage', async () => {
      // Mock complete AI infrastructure failure
      nock('http://localhost:8000')
        .persist()
        .post(/.*/)
        .reply(503, { error: 'AI service completely unavailable' });

      nock('https://api.openai.com')
        .persist()
        .post(/.*/)
        .reply(503, { error: 'OpenAI service unavailable' });

      // Create multiple tickets to test system resilience
      const ticketIds = [];
      const ticketTypes = [
        { title: 'Email server issue', category: 'Email', priority: 'High' },
        { title: 'Network connectivity problem', category: 'Network', priority: 'Medium' },
        { title: 'Database performance slow', category: 'Database', priority: 'Critical' }
      ];

      for (const ticketType of ticketTypes) {
        const response = await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: ticketType.title,
            description: `Testing system resilience during AI outage`,
            customerId: 'outage-customer-001'
          })
          .expect(201);

        ticketIds.push(response.body.id);
      }

      // Wait for fallback processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify all tickets were processed with fallbacks
      for (const ticketId of ticketIds) {
        const ticketResponse = await request(app)
          .get(`/api/tickets/${ticketId}`)
          .set('Authorization', `Bearer ${authToken}`)
          .expect(200);

        expect(ticketResponse.body.category).toBeDefined();
        expect(ticketResponse.body.priority).toBeDefined();
        expect(ticketResponse.body.status).toBe('Open');
        expect(ticketResponse.body.aiInsights.fallbackUsed).toBe(true);
      }

      // Verify system metrics are still being collected
      const metricsResponse = await request(app)
        .get('/api/dashboard/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(metricsResponse.body.totalTickets).toBeGreaterThan(0);
      expect(metricsResponse.body.openTickets).toBeGreaterThan(0);
      expect(metricsResponse.body.aiServiceStatus).toBe('degraded');
    });
  });

  describe('AI Model Performance Monitoring', () => {
    it('should track AI model response times and accuracy', async () => {
      // Mock AI service with performance data
      nock('http://localhost:8000')
        .post('/triage')
        .delay(500) // Simulate processing time
        .reply(200, {
          category: 'Software',
          priority: 'Medium',
          confidence: 0.85,
          processing_time_ms: 500
        });

      // Create ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Software installation issue',
          description: 'Cannot install new accounting software',
          customerId: 'performance-customer-001'
        })
        .expect(201);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get AI performance metrics
      const performanceResponse = await request(app)
        .get('/api/ai/performance-metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(performanceResponse.body.triageModel.averageResponseTime).toBeGreaterThan(0);
      expect(performanceResponse.body.triageModel.totalRequests).toBeGreaterThan(0);
      expect(performanceResponse.body.triageModel.successRate).toBeGreaterThan(0);
      expect(performanceResponse.body.triageModel.averageConfidence).toBeGreaterThan(0);
    });

    it('should detect and alert on AI model degradation', async () => {
      // Mock degraded AI responses
      nock('http://localhost:8000')
        .post('/triage')
        .times(5)
        .reply(200, {
          category: 'General',
          priority: 'Medium',
          confidence: 0.45 // Low confidence indicating degradation
        });

      // Create multiple tickets to trigger degradation detection
      for (let i = 0; i < 5; i++) {
        await request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: `Degradation test ticket ${i}`,
            description: 'Testing AI model degradation detection',
            customerId: 'degradation-customer-001'
          })
          .expect(201);
      }

      // Wait for degradation analysis
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check for degradation alerts
      const alertsResponse = await request(app)
        .get('/api/ai/degradation-alerts')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const triageAlerts = alertsResponse.body.filter(
        (alert: any) => alert.model === 'triage' && alert.type === 'confidence_degradation'
      );

      expect(triageAlerts.length).toBeGreaterThan(0);
      expect(triageAlerts[0].averageConfidence).toBeLessThan(0.5);
      expect(triageAlerts[0].recommendedAction).toContain('review');
    });
  });
});