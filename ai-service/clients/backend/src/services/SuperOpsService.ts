import { SuperOpsApiClient } from './SuperOpsApiClient';
import { SuperOpsConfigService } from './SuperOpsConfigService';
import { logger } from '../utils/logger';
import {
  SuperOpsTicket,
  SuperOpsCustomer,
  SuperOpsTechnician,
  SuperOpsApiResponse,
  SuperOpsListParams,
  SuperOpsTicketCreateRequest,
  SuperOpsTicketUpdateRequest,
  SuperOpsApiError
} from '../types/superops';

export class SuperOpsService {
  private static instance: SuperOpsService;
  private apiClient: SuperOpsApiClient;
  private configService: SuperOpsConfigService;
  private isHealthy: boolean = false;
  private lastHealthCheck: Date | null = null;

  private constructor() {
    this.configService = SuperOpsConfigService.getInstance();
    
    if (!this.configService.validateConfig()) {
      throw new Error('Invalid SuperOps configuration');
    }

    this.apiClient = new SuperOpsApiClient(this.configService.getConfig());
    this.initializeHealthMonitoring();
  }

  public static getInstance(): SuperOpsService {
    if (!SuperOpsService.instance) {
      SuperOpsService.instance = new SuperOpsService();
    }
    return SuperOpsService.instance;
  }

  private initializeHealthMonitoring(): void {
    // Perform initial health check
    this.performHealthCheck();

    // Set up periodic health checks (every 5 minutes)
    setInterval(() => {
      this.performHealthCheck();
    }, 5 * 60 * 1000);
  }

  private async performHealthCheck(): Promise<void> {
    try {
      this.isHealthy = await this.apiClient.healthCheck();
      this.lastHealthCheck = new Date();
      
      if (this.isHealthy) {
        logger.info('SuperOps API health check passed');
      } else {
        logger.warn('SuperOps API health check failed');
      }
    } catch (error) {
      this.isHealthy = false;
      this.lastHealthCheck = new Date();
      logger.error('SuperOps API health check error:', error);
    }
  }

  public getHealthStatus(): { isHealthy: boolean; lastCheck: Date | null } {
    return {
      isHealthy: this.isHealthy,
      lastCheck: this.lastHealthCheck
    };
  }

  // Ticket operations with error handling and logging
  async fetchTickets(params?: SuperOpsListParams): Promise<SuperOpsTicket[]> {
    try {
      logger.info('Fetching tickets from SuperOps', { params });
      const response = await this.apiClient.getTickets(params);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to fetch tickets: ${response.message}`);
      }

      logger.info(`Successfully fetched ${response.data.length} tickets from SuperOps`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching tickets from SuperOps:', error);
      throw error;
    }
  }

  async fetchTicket(ticketId: string): Promise<SuperOpsTicket> {
    try {
      logger.info('Fetching ticket from SuperOps', { ticketId });
      const response = await this.apiClient.getTicket(ticketId);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to fetch ticket: ${response.message}`);
      }

      logger.info('Successfully fetched ticket from SuperOps', { ticketId });
      return response.data;
    } catch (error) {
      logger.error('Error fetching ticket from SuperOps:', { ticketId, error });
      throw error;
    }
  }

  async createTicket(ticketData: SuperOpsTicketCreateRequest): Promise<SuperOpsTicket> {
    try {
      logger.info('Creating ticket in SuperOps', { subject: ticketData.subject });
      const response = await this.apiClient.createTicket(ticketData);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to create ticket: ${response.message}`);
      }

      logger.info('Successfully created ticket in SuperOps', { 
        ticketId: response.data.id,
        subject: ticketData.subject 
      });
      return response.data;
    } catch (error) {
      logger.error('Error creating ticket in SuperOps:', { ticketData, error });
      throw error;
    }
  }

  async updateTicket(ticketId: string, ticketData: SuperOpsTicketUpdateRequest): Promise<SuperOpsTicket> {
    try {
      logger.info('Updating ticket in SuperOps', { ticketId });
      const response = await this.apiClient.updateTicket(ticketId, ticketData);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to update ticket: ${response.message}`);
      }

      logger.info('Successfully updated ticket in SuperOps', { ticketId });
      return response.data;
    } catch (error) {
      logger.error('Error updating ticket in SuperOps:', { ticketId, error });
      throw error;
    }
  }

  // Customer operations
  async fetchCustomers(params?: SuperOpsListParams): Promise<SuperOpsCustomer[]> {
    try {
      logger.info('Fetching customers from SuperOps', { params });
      const response = await this.apiClient.getCustomers(params);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to fetch customers: ${response.message}`);
      }

      logger.info(`Successfully fetched ${response.data.length} customers from SuperOps`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching customers from SuperOps:', error);
      throw error;
    }
  }

  async fetchCustomer(customerId: string): Promise<SuperOpsCustomer> {
    try {
      logger.info('Fetching customer from SuperOps', { customerId });
      const response = await this.apiClient.getCustomer(customerId);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to fetch customer: ${response.message}`);
      }

      logger.info('Successfully fetched customer from SuperOps', { customerId });
      return response.data;
    } catch (error) {
      logger.error('Error fetching customer from SuperOps:', { customerId, error });
      throw error;
    }
  }

  async createCustomer(customerData: Partial<SuperOpsCustomer>): Promise<SuperOpsCustomer> {
    try {
      logger.info('Creating customer in SuperOps', { name: customerData.name });
      const response = await this.apiClient.createCustomer(customerData);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to create customer: ${response.message}`);
      }

      logger.info('Successfully created customer in SuperOps', { 
        customerId: response.data.id,
        name: customerData.name 
      });
      return response.data;
    } catch (error) {
      logger.error('Error creating customer in SuperOps:', { customerData, error });
      throw error;
    }
  }

  async updateCustomer(customerId: string, customerData: Partial<SuperOpsCustomer>): Promise<SuperOpsCustomer> {
    try {
      logger.info('Updating customer in SuperOps', { customerId });
      const response = await this.apiClient.updateCustomer(customerId, customerData);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to update customer: ${response.message}`);
      }

      logger.info('Successfully updated customer in SuperOps', { customerId });
      return response.data;
    } catch (error) {
      logger.error('Error updating customer in SuperOps:', { customerId, error });
      throw error;
    }
  }

  // Technician operations
  async fetchTechnicians(params?: SuperOpsListParams): Promise<SuperOpsTechnician[]> {
    try {
      logger.info('Fetching technicians from SuperOps', { params });
      const response = await this.apiClient.getTechnicians(params);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to fetch technicians: ${response.message}`);
      }

      logger.info(`Successfully fetched ${response.data.length} technicians from SuperOps`);
      return response.data;
    } catch (error) {
      logger.error('Error fetching technicians from SuperOps:', error);
      throw error;
    }
  }

  async fetchTechnician(technicianId: string): Promise<SuperOpsTechnician> {
    try {
      logger.info('Fetching technician from SuperOps', { technicianId });
      const response = await this.apiClient.getTechnician(technicianId);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to fetch technician: ${response.message}`);
      }

      logger.info('Successfully fetched technician from SuperOps', { technicianId });
      return response.data;
    } catch (error) {
      logger.error('Error fetching technician from SuperOps:', { technicianId, error });
      throw error;
    }
  }

  async createTechnician(technicianData: Partial<SuperOpsTechnician>): Promise<SuperOpsTechnician> {
    try {
      logger.info('Creating technician in SuperOps', { name: technicianData.name });
      const response = await this.apiClient.createTechnician(technicianData);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to create technician: ${response.message}`);
      }

      logger.info('Successfully created technician in SuperOps', { 
        technicianId: response.data.id,
        name: technicianData.name 
      });
      return response.data;
    } catch (error) {
      logger.error('Error creating technician in SuperOps:', { technicianData, error });
      throw error;
    }
  }

  async updateTechnician(technicianId: string, technicianData: Partial<SuperOpsTechnician>): Promise<SuperOpsTechnician> {
    try {
      logger.info('Updating technician in SuperOps', { technicianId });
      const response = await this.apiClient.updateTechnician(technicianId, technicianData);
      
      if (!response.success) {
        throw new SuperOpsApiError(`Failed to update technician: ${response.message}`);
      }

      logger.info('Successfully updated technician in SuperOps', { technicianId });
      return response.data;
    } catch (error) {
      logger.error('Error updating technician in SuperOps:', { technicianId, error });
      throw error;
    }
  }

  // Utility methods
  async testConnection(): Promise<boolean> {
    try {
      const status = await this.apiClient.getApiStatus();
      return status.success;
    } catch (error) {
      logger.error('SuperOps connection test failed:', error);
      return false;
    }
  }

  public getApiClient(): SuperOpsApiClient {
    return this.apiClient;
  }
}