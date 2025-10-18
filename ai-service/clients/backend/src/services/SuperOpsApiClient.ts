import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../utils/logger';
import {
  SuperOpsConfig,
  SuperOpsAuthResponse,
  SuperOpsTicket,
  SuperOpsCustomer,
  SuperOpsTechnician,
  SuperOpsApiResponse,
  SuperOpsListParams,
  SuperOpsTicketCreateRequest,
  SuperOpsTicketUpdateRequest,
  SuperOpsApiError
} from '../types/superops';

export class SuperOpsApiClient {
  private client: AxiosInstance;
  private config: SuperOpsConfig;
  private accessToken?: string;
  private tokenExpiresAt?: Date;

  constructor(config: SuperOpsConfig) {
    this.config = config;
    this.client = axios.create({
      baseURL: config.baseUrl,
      timeout: config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    });

    this.setupInterceptors();
  }

  private setupInterceptors(): void {
    // Request interceptor for authentication
    this.client.interceptors.request.use(
      async (config) => {
        await this.ensureAuthenticated();
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`;
        }
        return config;
      },
      (error) => {
        logger.error('Request interceptor error:', error);
        return Promise.reject(error);
      }
    );

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const originalRequest = error.config;

        // Handle token expiration
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;
          try {
            await this.authenticate();
            return this.client(originalRequest);
          } catch (authError) {
            logger.error('Token refresh failed:', authError);
            throw new SuperOpsApiError('Authentication failed', 401);
          }
        }

        // Handle rate limiting
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'] || this.config.retryDelay;
          logger.warn(`Rate limited, retrying after ${retryAfter}ms`);
          await this.delay(retryAfter * 1000);
          return this.client(originalRequest);
        }

        throw this.handleApiError(error);
      }
    );
  }

  private async ensureAuthenticated(): Promise<void> {
    if (!this.accessToken || this.isTokenExpired()) {
      await this.authenticate();
    }
  }

  private isTokenExpired(): boolean {
    if (!this.tokenExpiresAt) return true;
    return new Date() >= this.tokenExpiresAt;
  }

  private async authenticate(): Promise<void> {
    try {
      logger.info('Authenticating with SuperOps API');
      
      const response = await axios.post<SuperOpsAuthResponse>(
        `${this.config.baseUrl}/oauth/token`,
        {
          grant_type: 'client_credentials',
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret
        },
        {
          headers: { 'Content-Type': 'application/json' },
          timeout: this.config.timeout
        }
      );

      this.accessToken = response.data.access_token;
      this.tokenExpiresAt = new Date(Date.now() + (response.data.expires_in * 1000));
      
      logger.info('Successfully authenticated with SuperOps API');
    } catch (error) {
      logger.error('SuperOps authentication failed:', error);
      throw new SuperOpsApiError('Authentication failed', 401, error);
    }
  }

  private handleApiError(error: any): SuperOpsApiError {
    const status = error.response?.status;
    const message = error.response?.data?.message || error.message || 'Unknown API error';
    const response = error.response?.data;

    logger.error('SuperOps API error:', {
      status,
      message,
      response,
      url: error.config?.url
    });

    return new SuperOpsApiError(message, status, response);
  }

  private async delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private async makeRequest<T>(
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
    endpoint: string,
    data?: any,
    params?: any
  ): Promise<SuperOpsApiResponse<T>> {
    let attempt = 0;
    const maxAttempts = this.config.retryAttempts;

    while (attempt < maxAttempts) {
      try {
        const config: AxiosRequestConfig = {
          method,
          url: endpoint,
          data,
          params
        };

        const response: AxiosResponse<SuperOpsApiResponse<T>> = await this.client(config);
        return response.data;
      } catch (error) {
        attempt++;
        
        if (attempt >= maxAttempts) {
          throw error;
        }

        // Only retry on specific errors
        if (error instanceof SuperOpsApiError && 
            (error.statusCode === 429 || error.statusCode === 503 || error.statusCode === 502)) {
          const delay = this.config.retryDelay * Math.pow(2, attempt - 1); // Exponential backoff
          logger.warn(`Retrying request (attempt ${attempt}/${maxAttempts}) after ${delay}ms`);
          await this.delay(delay);
        } else {
          throw error;
        }
      }
    }

    throw new SuperOpsApiError('Max retry attempts exceeded');
  }

  // Ticket operations
  async getTickets(params?: SuperOpsListParams): Promise<SuperOpsApiResponse<SuperOpsTicket[]>> {
    return this.makeRequest<SuperOpsTicket[]>('GET', '/api/v1/tickets', undefined, params);
  }

  async getTicket(ticketId: string): Promise<SuperOpsApiResponse<SuperOpsTicket>> {
    return this.makeRequest<SuperOpsTicket>('GET', `/api/v1/tickets/${ticketId}`);
  }

  async createTicket(ticketData: SuperOpsTicketCreateRequest): Promise<SuperOpsApiResponse<SuperOpsTicket>> {
    return this.makeRequest<SuperOpsTicket>('POST', '/api/v1/tickets', ticketData);
  }

  async updateTicket(ticketId: string, ticketData: SuperOpsTicketUpdateRequest): Promise<SuperOpsApiResponse<SuperOpsTicket>> {
    return this.makeRequest<SuperOpsTicket>('PUT', `/api/v1/tickets/${ticketId}`, ticketData);
  }

  async deleteTicket(ticketId: string): Promise<SuperOpsApiResponse<void>> {
    return this.makeRequest<void>('DELETE', `/api/v1/tickets/${ticketId}`);
  }

  // Customer operations
  async getCustomers(params?: SuperOpsListParams): Promise<SuperOpsApiResponse<SuperOpsCustomer[]>> {
    return this.makeRequest<SuperOpsCustomer[]>('GET', '/api/v1/customers', undefined, params);
  }

  async getCustomer(customerId: string): Promise<SuperOpsApiResponse<SuperOpsCustomer>> {
    return this.makeRequest<SuperOpsCustomer>('GET', `/api/v1/customers/${customerId}`);
  }

  async createCustomer(customerData: Partial<SuperOpsCustomer>): Promise<SuperOpsApiResponse<SuperOpsCustomer>> {
    return this.makeRequest<SuperOpsCustomer>('POST', '/api/v1/customers', customerData);
  }

  async updateCustomer(customerId: string, customerData: Partial<SuperOpsCustomer>): Promise<SuperOpsApiResponse<SuperOpsCustomer>> {
    return this.makeRequest<SuperOpsCustomer>('PUT', `/api/v1/customers/${customerId}`, customerData);
  }

  // Technician operations
  async getTechnicians(params?: SuperOpsListParams): Promise<SuperOpsApiResponse<SuperOpsTechnician[]>> {
    return this.makeRequest<SuperOpsTechnician[]>('GET', '/api/v1/technicians', undefined, params);
  }

  async getTechnician(technicianId: string): Promise<SuperOpsApiResponse<SuperOpsTechnician>> {
    return this.makeRequest<SuperOpsTechnician>('GET', `/api/v1/technicians/${technicianId}`);
  }

  async createTechnician(technicianData: Partial<SuperOpsTechnician>): Promise<SuperOpsApiResponse<SuperOpsTechnician>> {
    return this.makeRequest<SuperOpsTechnician>('POST', '/api/v1/technicians', technicianData);
  }

  async updateTechnician(technicianId: string, technicianData: Partial<SuperOpsTechnician>): Promise<SuperOpsApiResponse<SuperOpsTechnician>> {
    return this.makeRequest<SuperOpsTechnician>('PUT', `/api/v1/technicians/${technicianId}`, technicianData);
  }

  // Health check
  async healthCheck(): Promise<boolean> {
    try {
      await this.makeRequest<any>('GET', '/api/v1/health');
      return true;
    } catch (error) {
      logger.error('SuperOps health check failed:', error);
      return false;
    }
  }

  // Get API status and limits
  async getApiStatus(): Promise<SuperOpsApiResponse<any>> {
    return this.makeRequest<any>('GET', '/api/v1/status');
  }
}