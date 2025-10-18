import { Request, Response } from 'express';
import { aiService } from '../services/AIService';
import { logger } from '../utils/logger';

/**
 * Controller for AI service management and monitoring
 */
export class AIController {
  /**
   * Get AI service health status
   */
  async getHealthStatus(req: Request, res: Response): Promise<void> {
    try {
      const healthStatus = await aiService.getStatus();
      
      if (healthStatus) {
        res.json(healthStatus);
      } else {
        res.status(503).json({
          status: 'unhealthy',
          error: 'AI service is not responding'
        });
      }
    } catch (error) {
      logger.error('Failed to get AI service health status', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        error: 'Failed to check AI service health',
        message: (error as Error).message
      });
    }
  }

  /**
   * Get AI service metrics and performance statistics
   */
  async getMetrics(req: Request, res: Response): Promise<void> {
    try {
      // Mock metrics for now - in production this would come from monitoring service
      const metrics = {
        processing_stats: {
          total_requests_24h: 1247,
          successful_requests: 1198,
          failed_requests: 49,
          average_response_time_ms: 850,
          requests_per_minute: 52
        },
        model_performance: {
          triage_accuracy: 0.94,
          sla_prediction_accuracy: 0.87,
          resolution_suggestion_relevance: 0.91,
          average_confidence_score: 0.83
        },
        cache_statistics: {
          cache_hit_rate: 0.76,
          cached_responses_24h: 948,
          cache_size_mb: 245,
          cache_evictions_24h: 23
        },
        service_uptime: {
          uptime_percentage: 99.8,
          last_restart: '2024-01-14T08:30:00Z',
          total_downtime_minutes_24h: 2.4
        }
      };

      res.json(metrics);
    } catch (error) {
      logger.error('Failed to get AI service metrics', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        error: 'Failed to retrieve AI service metrics',
        message: (error as Error).message
      });
    }
  }

  /**
   * Test AI service connectivity and basic functionality
   */
  async testConnectivity(req: Request, res: Response): Promise<void> {
    try {
      const testResults = {
        connectivity: false,
        triage_service: false,
        sla_prediction_service: false,
        resolution_service: false,
        workload_optimization_service: false,
        response_times: {
          health_check_ms: 0,
          triage_test_ms: 0,
          sla_prediction_test_ms: 0,
          resolution_test_ms: 0
        },
        errors: [] as string[]
      };

      // Test basic connectivity
      const startTime = Date.now();
      const isHealthy = await aiService.healthCheck();
      testResults.response_times.health_check_ms = Date.now() - startTime;
      testResults.connectivity = isHealthy;

      if (!isHealthy) {
        testResults.errors.push('AI service health check failed');
      }

      // Test triage service
      if (isHealthy) {
        try {
          const triageStart = Date.now();
          const triageResult = await aiService.triageTicket({
            ticket_id: 'test-001',
            title: 'Test ticket for connectivity check',
            description: 'This is a test ticket to verify AI triage functionality',
            customer_tier: 'standard'
          });
          testResults.response_times.triage_test_ms = Date.now() - triageStart;
          testResults.triage_service = triageResult.success;
          
          if (!triageResult.success) {
            testResults.errors.push(`Triage service error: ${triageResult.error}`);
          }
        } catch (error) {
          testResults.errors.push(`Triage service exception: ${(error as Error).message}`);
        }

        // Test SLA prediction service
        try {
          const slaStart = Date.now();
          const slaResult = await aiService.predictSLA({
            ticket_id: 'test-001',
            current_time: new Date(),
            priority: 'medium',
            category: 'software'
          });
          testResults.response_times.sla_prediction_test_ms = Date.now() - slaStart;
          testResults.sla_prediction_service = slaResult.success;
          
          if (!slaResult.success) {
            testResults.errors.push(`SLA prediction service error: ${slaResult.error}`);
          }
        } catch (error) {
          testResults.errors.push(`SLA prediction service exception: ${(error as Error).message}`);
        }

        // Test resolution suggestion service
        try {
          const resolutionStart = Date.now();
          const resolutionResult = await aiService.suggestResolution({
            ticket_id: 'test-001',
            title: 'Test ticket for connectivity check',
            description: 'This is a test ticket to verify AI resolution functionality'
          });
          testResults.response_times.resolution_test_ms = Date.now() - resolutionStart;
          testResults.resolution_service = resolutionResult.success;
          
          if (!resolutionResult.success) {
            testResults.errors.push(`Resolution service error: ${resolutionResult.error}`);
          }
        } catch (error) {
          testResults.errors.push(`Resolution service exception: ${(error as Error).message}`);
        }

        // Test workload optimization service
        try {
          const workloadResult = await aiService.optimizeWorkload({
            technicians: [{
              technician_id: 'test-tech-001',
              skills: ['software', 'network'],
              current_workload: 30,
              max_capacity: 40,
              availability_hours: 8
            }],
            pending_tickets: [{
              ticket_id: 'test-ticket-001',
              priority: 'medium',
              category: 'software',
              estimated_hours: 2,
              required_skills: ['software']
            }]
          });
          testResults.workload_optimization_service = workloadResult.success;
          
          if (!workloadResult.success) {
            testResults.errors.push(`Workload optimization service error: ${workloadResult.error}`);
          }
        } catch (error) {
          testResults.errors.push(`Workload optimization service exception: ${(error as Error).message}`);
        }
      }

      // Determine overall test status
      const allServicesWorking = testResults.connectivity && 
                                testResults.triage_service && 
                                testResults.sla_prediction_service && 
                                testResults.resolution_service &&
                                testResults.workload_optimization_service;

      const responseStatus = allServicesWorking ? 200 : 
                           testResults.connectivity ? 206 : 503;

      res.status(responseStatus).json({
        overall_status: allServicesWorking ? 'all_services_operational' : 
                       testResults.connectivity ? 'partial_functionality' : 'service_unavailable',
        test_results: testResults,
        timestamp: new Date().toISOString()
      });

    } catch (error) {
      logger.error('Failed to test AI service connectivity', {
        error: (error as Error).message
      });
      
      res.status(500).json({
        error: 'Failed to test AI service connectivity',
        message: (error as Error).message
      });
    }
  }
}