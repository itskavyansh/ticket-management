import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';

/**
 * AI Service client for communicating with the AI processing service
 */
export class AIService {
  private client: AxiosInstance;
  private baseURL: string;
  private timeout: number;

  constructor() {
    this.baseURL = process.env.AI_SERVICE_URL || 'http://localhost:8001';
    this.timeout = parseInt(process.env.AI_SERVICE_TIMEOUT || '10000');
    
    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add request interceptor for logging
    this.client.interceptors.request.use(
      (config) => {
        logger.debug('AI Service request', {
          method: config.method,
          url: config.url,
          data: config.data ? '[REDACTED]' : undefined
        });
        return config;
      },
      (error) => {
        logger.error('AI Service request error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.client.interceptors.response.use(
      (response) => {
        logger.debug('AI Service response', {
          status: response.status,
          url: response.config.url,
          processingTime: response.data?.processing_time_ms
        });
        return response;
      },
      (error) => {
        logger.error('AI Service response error', {
          status: error.response?.status,
          url: error.config?.url,
          message: error.message
        });
        return Promise.reject(error);
      }
    );
  }

  /**
   * Perform ticket triage using AI
   */
  async triageTicket(ticketData: {
    ticket_id: string;
    title: string;
    description: string;
    customer_tier?: string;
    affected_systems?: string[];
    error_messages?: string[];
    reported_by?: string;
  }): Promise<{
    success: boolean;
    result?: {
      category: string;
      priority: string;
      urgency: string;
      impact: string;
      confidence_score: number;
      reasoning: string;
      suggested_technician_skills: string[];
      estimated_resolution_time?: number;
    };
    error?: string;
    processing_time_ms: number;
    cached: boolean;
  }> {
    try {
      const response: AxiosResponse = await this.client.post('/ai/triage', ticketData);
      return response.data;
    } catch (error) {
      logger.error('AI triage failed', {
        ticketId: ticketData.ticket_id,
        error: error.message
      });
      
      // Return fallback response
      return {
        success: false,
        error: 'AI service unavailable',
        processing_time_ms: 0,
        cached: false
      };
    }
  }

  /**
   * Predict SLA breach probability
   */
  async predictSLA(ticketData: {
    ticket_id: string;
    current_time: Date;
    priority?: string;
    category?: string;
    customer_tier?: string;
    assigned_technician_id?: string;
    created_at?: Date;
    sla_deadline?: Date;
    progress_percentage?: number;
  }): Promise<{
    success: boolean;
    result?: {
      breach_probability: number;
      risk_level: string;
      estimated_completion_hours: number;
      confidence_score: number;
      risk_factors?: string[];
      recommendations?: string[];
    };
    error?: string;
    processing_time_ms: number;
    cached: boolean;
    model_version: string;
  }> {
    try {
      const response: AxiosResponse = await this.client.post('/ai/predict-sla', ticketData);
      return response.data;
    } catch (error) {
      logger.error('AI SLA prediction failed', {
        ticketId: ticketData.ticket_id,
        error: error.message
      });
      
      // Return fallback response
      return {
        success: false,
        error: 'AI service unavailable',
        processing_time_ms: 0,
        cached: false,
        model_version: 'fallback'
      };
    }
  }

  /**
   * Get resolution suggestions for a ticket
   */
  async suggestResolution(ticketData: {
    ticket_id: string;
    title: string;
    description: string;
    category?: string;
    error_messages?: string[];
    system_info?: string;
  }): Promise<{
    success: boolean;
    ticket_id: string;
    suggestions?: Array<{
      title: string;
      description: string;
      steps: string[];
      confidence_score: number;
      estimated_time_minutes: number;
      difficulty_level: string;
      required_skills: string[];
    }>;
    similar_tickets?: Array<{
      ticket_id: string;
      title: string;
      similarity_score: number;
      resolution_summary: string;
    }>;
    error?: string;
    processing_time_ms: number;
    cached: boolean;
  }> {
    try {
      const response: AxiosResponse = await this.client.post('/ai/suggest-resolution', ticketData);
      return response.data;
    } catch (error) {
      logger.error('AI resolution suggestion failed', {
        ticketId: ticketData.ticket_id,
        error: error.message
      });
      
      // Return fallback response
      return {
        success: false,
        ticket_id: ticketData.ticket_id,
        error: 'AI service unavailable',
        processing_time_ms: 0,
        cached: false
      };
    }
  }

  /**
   * Get workload optimization recommendations
   */
  async optimizeWorkload(data: {
    technicians: Array<{
      technician_id: string;
      skills: string[];
      current_workload: number;
      max_capacity: number;
      availability_hours: number;
    }>;
    pending_tickets: Array<{
      ticket_id: string;
      priority: string;
      category: string;
      estimated_hours: number;
      required_skills: string[];
    }>;
  }): Promise<{
    success: boolean;
    recommendations?: Array<{
      ticket_id: string;
      recommended_technician_id: string;
      confidence_score: number;
      reasoning: string;
    }>;
    workload_analysis?: {
      overutilized_technicians: string[];
      underutilized_technicians: string[];
      capacity_recommendations: Array<{
        technician_id: string;
        recommended_action: string;
        impact: string;
      }>;
    };
    error?: string;
    processing_time_ms: number;
  }> {
    try {
      const response: AxiosResponse = await this.client.post('/ai/optimize-workload', data);
      return response.data;
    } catch (error) {
      logger.error('AI workload optimization failed', {
        error: error.message
      });
      
      // Return fallback response
      return {
        success: false,
        error: 'AI service unavailable',
        processing_time_ms: 0
      };
    }
  }

  /**
   * Health check for AI service
   */
  async healthCheck(): Promise<boolean> {
    try {
      const response: AxiosResponse = await this.client.get('/health');
      return response.status === 200 && response.data.status === 'healthy';
    } catch (error) {
      logger.warn('AI service health check failed', { error: error.message });
      return false;
    }
  }

  /**
   * Get AI service status and metrics
   */
  async getStatus(): Promise<{
    status: string;
    version: string;
    dependencies: Record<string, any>;
  } | null> {
    try {
      const response: AxiosResponse = await this.client.get('/health');
      return response.data;
    } catch (error) {
      logger.error('Failed to get AI service status', { error: error.message });
      return null;
    }
  }
}

// Export singleton instance
export const aiService = new AIService();