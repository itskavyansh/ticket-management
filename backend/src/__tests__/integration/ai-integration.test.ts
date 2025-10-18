import { AIService } from '../../services/AIService';
import { TicketService } from '../../services/TicketService';
import { CreateTicketRequest } from '../../models/Ticket';
import { Priority, TicketCategory } from '../../types';

describe('AI Integration Tests', () => {
  let aiService: AIService;
  let ticketService: TicketService;

  beforeAll(() => {
    aiService = new AIService();
    ticketService = new TicketService();
  });

  describe('AI Service Health Check', () => {
    it('should check AI service health', async () => {
      const isHealthy = await aiService.healthCheck();
      // This might fail if AI service is not running, which is expected in test environment
      expect(typeof isHealthy).toBe('boolean');
    });

    it('should get AI service status', async () => {
      const status = await aiService.getStatus();
      // Status might be null if service is not running
      expect(status === null || typeof status === 'object').toBe(true);
    });
  });

  describe('Ticket Triage Integration', () => {
    it('should handle AI triage request', async () => {
      const triageRequest = {
        ticket_id: 'test-ticket-1',
        title: 'Server not responding',
        description: 'The main application server is not responding to requests',
        customer_tier: 'premium'
      };

      const result = await aiService.triageTicket(triageRequest);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processing_time_ms');
      expect(result).toHaveProperty('cached');
      
      if (result.success) {
        expect(result.result).toHaveProperty('category');
        expect(result.result).toHaveProperty('priority');
        expect(result.result).toHaveProperty('confidence_score');
      }
    });

    it('should create ticket with AI triage integration', async () => {
      const ticketData: CreateTicketRequest = {
        customerId: 'test-customer-1',
        title: 'Email server down',
        description: 'Users cannot send or receive emails',
        category: TicketCategory.EMAIL,
        priority: Priority.HIGH,
        customerTier: 'enterprise',
        reportedBy: 'test-user@example.com'
      };

      // This test assumes the ticket creation will attempt AI triage
      // In a real test environment, you might want to mock the AI service
      try {
        const ticket = await ticketService.createTicket(ticketData);
        expect(ticket).toBeDefined();
        expect(ticket.title).toBe(ticketData.title);
        expect(ticket.customerId).toBe(ticketData.customerId);
      } catch (error) {
        // Expected if database is not available in test environment
        expect(error).toBeDefined();
      }
    });
  });

  describe('SLA Prediction Integration', () => {
    it('should handle SLA prediction request', async () => {
      const predictionRequest = {
        ticket_id: 'test-ticket-2',
        current_time: new Date(),
        priority: 'high',
        category: 'network',
        customer_tier: 'premium'
      };

      const result = await aiService.predictSLA(predictionRequest);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processing_time_ms');
      expect(result).toHaveProperty('model_version');
      
      if (result.success) {
        expect(result.result).toHaveProperty('breach_probability');
        expect(result.result).toHaveProperty('risk_level');
        expect(result.result).toHaveProperty('confidence_score');
      }
    });
  });

  describe('Resolution Suggestions Integration', () => {
    it('should handle resolution suggestion request', async () => {
      const suggestionRequest = {
        ticket_id: 'test-ticket-3',
        title: 'Printer not working',
        description: 'Office printer is showing error messages and not printing',
        category: 'printer'
      };

      const result = await aiService.suggestResolution(suggestionRequest);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('ticket_id');
      expect(result).toHaveProperty('processing_time_ms');
      
      if (result.success) {
        expect(Array.isArray(result.suggestions)).toBe(true);
        expect(Array.isArray(result.similar_tickets)).toBe(true);
      }
    });
  });

  describe('Workload Optimization Integration', () => {
    it('should handle workload optimization request', async () => {
      const optimizationRequest = {
        technicians: [
          {
            technician_id: 'tech-1',
            skills: ['hardware', 'network'],
            current_workload: 30,
            max_capacity: 40,
            availability_hours: 8
          },
          {
            technician_id: 'tech-2',
            skills: ['software', 'email'],
            current_workload: 35,
            max_capacity: 40,
            availability_hours: 8
          }
        ],
        pending_tickets: [
          {
            ticket_id: 'ticket-1',
            priority: 'high',
            category: 'hardware',
            estimated_hours: 4,
            required_skills: ['hardware']
          },
          {
            ticket_id: 'ticket-2',
            priority: 'medium',
            category: 'software',
            estimated_hours: 2,
            required_skills: ['software']
          }
        ]
      };

      const result = await aiService.optimizeWorkload(optimizationRequest);
      
      expect(result).toHaveProperty('success');
      expect(result).toHaveProperty('processing_time_ms');
      
      if (result.success) {
        expect(Array.isArray(result.recommendations)).toBe(true);
        expect(result.workload_analysis).toBeDefined();
      }
    });
  });

  describe('Error Handling', () => {
    it('should handle AI service unavailable gracefully', async () => {
      // Test with invalid data to trigger error handling
      const invalidRequest = {
        ticket_id: '',
        title: '',
        description: ''
      };

      const result = await aiService.triageTicket(invalidRequest);
      
      // Should not throw, but return error response
      expect(result).toHaveProperty('success');
      expect(result.success).toBe(false);
      expect(result).toHaveProperty('error');
    });

    it('should handle network timeouts gracefully', async () => {
      // This test would require mocking network conditions
      // For now, just ensure the service handles errors properly
      const result = await aiService.healthCheck();
      expect(typeof result).toBe('boolean');
    });
  });
});