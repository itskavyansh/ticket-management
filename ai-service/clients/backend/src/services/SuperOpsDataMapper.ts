import { logger } from '../utils/logger';
import {
  SuperOpsTicket,
  SuperOpsCustomer,
  SuperOpsTechnician,
  FieldMapping,
  EntityMapping
} from '../types/superops';
import {
  Ticket,
  CreateTicketRequest,
  UpdateTicketRequest
} from '../models/Ticket';
import {
  Customer,
  CreateCustomerRequest,
  UpdateCustomerRequest
} from '../models/Customer';
import {
  Technician,
  CreateTechnicianRequest,
  UpdateTechnicianRequest
} from '../models/Technician';
import {
  TicketStatus,
  Priority,
  TicketCategory,
  UserRole
} from '../types';

export class SuperOpsDataMapper {
  private static instance: SuperOpsDataMapper;
  private entityMappings: EntityMapping;

  private constructor() {
    this.entityMappings = this.initializeDefaultMappings();
  }

  public static getInstance(): SuperOpsDataMapper {
    if (!SuperOpsDataMapper.instance) {
      SuperOpsDataMapper.instance = new SuperOpsDataMapper();
    }
    return SuperOpsDataMapper.instance;
  }

  // Initialize default field mappings
  private initializeDefaultMappings(): EntityMapping {
    return {
      ticket: [
        { internalField: 'id', externalField: 'id', required: true },
        { internalField: 'title', externalField: 'subject', required: true },
        { internalField: 'description', externalField: 'description', required: true },
        { internalField: 'status', externalField: 'status', transform: this.mapSuperOpsStatus },
        { internalField: 'priority', externalField: 'priority', transform: this.mapSuperOpsPriority },
        { internalField: 'category', externalField: 'category', transform: this.mapSuperOpsCategory },
        { internalField: 'customerId', externalField: 'customer_id', required: true },
        { internalField: 'assignedTechnicianId', externalField: 'assigned_to' },
        { internalField: 'createdAt', externalField: 'created_at', transform: this.parseDate },
        { internalField: 'updatedAt', externalField: 'updated_at', transform: this.parseDate },
        { internalField: 'slaDeadline', externalField: 'due_date', transform: this.parseDate },
        { internalField: 'resolvedAt', externalField: 'resolved_at', transform: this.parseDate },
        { internalField: 'tags', externalField: 'tags', defaultValue: [] },
        { internalField: 'externalId', externalField: 'id' }
      ],
      customer: [
        { internalField: 'id', externalField: 'id', required: true },
        { internalField: 'name', externalField: 'name', required: true },
        { internalField: 'email', externalField: 'email', required: true },
        { internalField: 'companyName', externalField: 'company_name', required: true },
        { internalField: 'phoneNumber', externalField: 'phone' },
        { internalField: 'tier', externalField: 'tier', transform: this.mapCustomerTier, defaultValue: 'basic' },
        { internalField: 'slaLevel', externalField: 'sla_level', defaultValue: 'standard' },
        { internalField: 'contractStartDate', externalField: 'contract_start_date', transform: this.parseDate },
        { internalField: 'contractEndDate', externalField: 'contract_end_date', transform: this.parseDate },
        { internalField: 'createdAt', externalField: 'created_at', transform: this.parseDate },
        { internalField: 'updatedAt', externalField: 'updated_at', transform: this.parseDate },
        { internalField: 'externalId', externalField: 'id' }
      ],
      technician: [
        { internalField: 'id', externalField: 'id', required: true },
        { internalField: 'name', externalField: 'name', required: true },
        { internalField: 'email', externalField: 'email', required: true },
        { internalField: 'role', externalField: 'role', transform: this.mapTechnicianRole, defaultValue: UserRole.TECHNICIAN },
        { internalField: 'department', externalField: 'department', defaultValue: 'Support' },
        { internalField: 'isActive', externalField: 'is_active', defaultValue: true },
        { internalField: 'createdAt', externalField: 'created_at', transform: this.parseDate },
        { internalField: 'updatedAt', externalField: 'updated_at', transform: this.parseDate },
        { internalField: 'externalId', externalField: 'id' }
      ]
    };
  }

  // Ticket mapping methods
  public mapSuperOpsTicketToInternal(superOpsTicket: SuperOpsTicket): CreateTicketRequest {
    try {
      logger.debug('Mapping SuperOps ticket to internal format', { 
        ticketId: superOpsTicket.id 
      });

      const mapped = this.mapFields(superOpsTicket, this.entityMappings.ticket);
      
      // Enrich with additional data
      const enrichedTicket: CreateTicketRequest = {
        ...mapped,
        customerName: this.extractCustomerName(superOpsTicket),
        customerEmail: this.extractCustomerEmail(superOpsTicket),
        customerTier: this.extractCustomerTier(superOpsTicket),
        attachments: this.mapAttachments(superOpsTicket.attachments || []),
        // Set default values for required fields
        responseTimeTarget: this.calculateResponseTimeTarget(mapped.priority, mapped.customerTier),
        resolutionTimeTarget: this.calculateResolutionTimeTarget(mapped.priority, mapped.customerTier)
      };

      logger.debug('Successfully mapped SuperOps ticket', { 
        ticketId: superOpsTicket.id,
        mappedFields: Object.keys(enrichedTicket)
      });

      return enrichedTicket;
    } catch (error) {
      logger.error('Error mapping SuperOps ticket to internal format:', {
        ticketId: superOpsTicket.id,
        error
      });
      throw error;
    }
  }

  public mapInternalTicketToSuperOps(ticket: Ticket): any {
    try {
      logger.debug('Mapping internal ticket to SuperOps format', { 
        ticketId: ticket.id 
      });

      const reverseMappings = this.createReverseMappings(this.entityMappings.ticket);
      const mapped = this.mapFields(ticket, reverseMappings);

      // Apply SuperOps-specific transformations
      const superOpsTicket = {
        ...mapped,
        subject: ticket.title,
        description: ticket.description,
        status: this.mapInternalStatus(ticket.status),
        priority: this.mapInternalPriority(ticket.priority),
        category: this.mapInternalCategory(ticket.category),
        customer_id: ticket.customerId,
        assigned_to: ticket.assignedTechnicianId,
        tags: ticket.tags || [],
        custom_fields: this.extractCustomFields(ticket)
      };

      logger.debug('Successfully mapped internal ticket to SuperOps format', { 
        ticketId: ticket.id 
      });

      return superOpsTicket;
    } catch (error) {
      logger.error('Error mapping internal ticket to SuperOps format:', {
        ticketId: ticket.id,
        error
      });
      throw error;
    }
  }

  // Customer mapping methods
  public mapSuperOpsCustomerToInternal(superOpsCustomer: SuperOpsCustomer): CreateCustomerRequest {
    try {
      logger.debug('Mapping SuperOps customer to internal format', { 
        customerId: superOpsCustomer.id 
      });

      const mapped = this.mapFields(superOpsCustomer, this.entityMappings.customer);
      
      const enrichedCustomer: CreateCustomerRequest = {
        ...mapped,
        primaryContact: this.extractPrimaryContact(superOpsCustomer),
        businessHours: this.extractBusinessHours(superOpsCustomer),
        industry: this.extractIndustry(superOpsCustomer),
        preferredContactMethod: this.extractPreferredContactMethod(superOpsCustomer)
      };

      logger.debug('Successfully mapped SuperOps customer', { 
        customerId: superOpsCustomer.id 
      });

      return enrichedCustomer;
    } catch (error) {
      logger.error('Error mapping SuperOps customer to internal format:', {
        customerId: superOpsCustomer.id,
        error
      });
      throw error;
    }
  }

  public mapInternalCustomerToSuperOps(customer: Customer): any {
    try {
      logger.debug('Mapping internal customer to SuperOps format', { 
        customerId: customer.id 
      });

      const reverseMappings = this.createReverseMappings(this.entityMappings.customer);
      const mapped = this.mapFields(customer, reverseMappings);

      const superOpsCustomer = {
        ...mapped,
        name: customer.name,
        email: customer.email,
        company_name: customer.companyName,
        phone: customer.phoneNumber,
        tier: customer.tier,
        sla_level: customer.slaLevel,
        custom_fields: this.extractCustomerCustomFields(customer)
      };

      logger.debug('Successfully mapped internal customer to SuperOps format', { 
        customerId: customer.id 
      });

      return superOpsCustomer;
    } catch (error) {
      logger.error('Error mapping internal customer to SuperOps format:', {
        customerId: customer.id,
        error
      });
      throw error;
    }
  }

  // Technician mapping methods
  public mapSuperOpsTechnicianToInternal(superOpsTechnician: SuperOpsTechnician): CreateTechnicianRequest {
    try {
      logger.debug('Mapping SuperOps technician to internal format', { 
        technicianId: superOpsTechnician.id 
      });

      const mapped = this.mapFields(superOpsTechnician, this.entityMappings.technician);
      
      const enrichedTechnician: CreateTechnicianRequest = {
        ...mapped,
        skills: this.mapTechnicianSkills(superOpsTechnician.skills || []),
        timezone: this.extractTimezone(superOpsTechnician),
        hireDate: this.extractHireDate(superOpsTechnician),
        maxCapacity: this.calculateMaxCapacity(superOpsTechnician)
      };

      logger.debug('Successfully mapped SuperOps technician', { 
        technicianId: superOpsTechnician.id 
      });

      return enrichedTechnician;
    } catch (error) {
      logger.error('Error mapping SuperOps technician to internal format:', {
        technicianId: superOpsTechnician.id,
        error
      });
      throw error;
    }
  }

  public mapInternalTechnicianToSuperOps(technician: Technician): any {
    try {
      logger.debug('Mapping internal technician to SuperOps format', { 
        technicianId: technician.id 
      });

      const reverseMappings = this.createReverseMappings(this.entityMappings.technician);
      const mapped = this.mapFields(technician, reverseMappings);

      const superOpsTechnician = {
        ...mapped,
        name: technician.name,
        email: technician.email,
        role: this.mapInternalRole(technician.role),
        department: technician.department,
        is_active: technician.isActive,
        skills: technician.skills?.map(skill => skill.category) || [],
        custom_fields: this.extractTechnicianCustomFields(technician)
      };

      logger.debug('Successfully mapped internal technician to SuperOps format', { 
        technicianId: technician.id 
      });

      return superOpsTechnician;
    } catch (error) {
      logger.error('Error mapping internal technician to SuperOps format:', {
        technicianId: technician.id,
        error
      });
      throw error;
    }
  }

  // Generic field mapping utility
  private mapFields(source: any, mappings: FieldMapping[]): any {
    const result: any = {};

    for (const mapping of mappings) {
      let value = source[mapping.externalField];

      // Apply transformation if provided
      if (mapping.transform && value !== undefined && value !== null) {
        value = mapping.transform(value);
      }

      // Use default value if no value found
      if ((value === undefined || value === null) && mapping.defaultValue !== undefined) {
        value = mapping.defaultValue;
      }

      // Set the mapped value
      if (value !== undefined) {
        result[mapping.internalField] = value;
      } else if (mapping.required) {
        throw new Error(`Required field ${mapping.internalField} is missing`);
      }
    }

    return result;
  }

  // Create reverse mappings for internal to external conversion
  private createReverseMappings(mappings: FieldMapping[]): FieldMapping[] {
    return mappings.map(mapping => ({
      internalField: mapping.externalField,
      externalField: mapping.internalField,
      transform: mapping.transform,
      required: mapping.required,
      defaultValue: mapping.defaultValue
    }));
  }

  // Transformation functions
  private mapSuperOpsStatus = (status: string): TicketStatus => {
    const statusMap: Record<string, TicketStatus> = {
      'open': TicketStatus.OPEN,
      'in_progress': TicketStatus.IN_PROGRESS,
      'pending': TicketStatus.PENDING_CUSTOMER,
      'resolved': TicketStatus.RESOLVED,
      'closed': TicketStatus.CLOSED,
      'cancelled': TicketStatus.CANCELLED
    };
    return statusMap[status.toLowerCase()] || TicketStatus.OPEN;
  };

  private mapSuperOpsPriority = (priority: string): Priority => {
    const priorityMap: Record<string, Priority> = {
      'critical': Priority.CRITICAL,
      'high': Priority.HIGH,
      'medium': Priority.MEDIUM,
      'low': Priority.LOW
    };
    return priorityMap[priority.toLowerCase()] || Priority.MEDIUM;
  };

  private mapSuperOpsCategory = (category: string): TicketCategory => {
    const categoryMap: Record<string, TicketCategory> = {
      'hardware': TicketCategory.HARDWARE,
      'software': TicketCategory.SOFTWARE,
      'network': TicketCategory.NETWORK,
      'security': TicketCategory.SECURITY
    };
    return categoryMap[category.toLowerCase()] || TicketCategory.GENERAL;
  };

  private mapCustomerTier = (tier: string): 'basic' | 'premium' | 'enterprise' => {
    const tierMap: Record<string, 'basic' | 'premium' | 'enterprise'> = {
      'basic': 'basic',
      'standard': 'basic',
      'premium': 'premium',
      'enterprise': 'enterprise',
      'business': 'premium'
    };
    return tierMap[tier.toLowerCase()] || 'basic';
  };

  private mapTechnicianRole = (role: string): UserRole => {
    const roleMap: Record<string, UserRole> = {
      'admin': UserRole.ADMIN,
      'administrator': UserRole.ADMIN,
      'manager': UserRole.MANAGER,
      'supervisor': UserRole.MANAGER,
      'technician': UserRole.TECHNICIAN,
      'support': UserRole.TECHNICIAN,
      'readonly': UserRole.READ_ONLY,
      'viewer': UserRole.READ_ONLY
    };
    return roleMap[role.toLowerCase()] || UserRole.TECHNICIAN;
  };

  private parseDate = (dateString: string): Date => {
    return new Date(dateString);
  };

  // Reverse mapping functions
  private mapInternalStatus(status: TicketStatus): string {
    const statusMap: Record<TicketStatus, string> = {
      [TicketStatus.OPEN]: 'open',
      [TicketStatus.IN_PROGRESS]: 'in_progress',
      [TicketStatus.PENDING_CUSTOMER]: 'pending',
      [TicketStatus.RESOLVED]: 'resolved',
      [TicketStatus.CLOSED]: 'closed',
      [TicketStatus.CANCELLED]: 'cancelled'
    };
    return statusMap[status] || 'open';
  }

  private mapInternalPriority(priority: Priority): string {
    const priorityMap: Record<Priority, string> = {
      [Priority.CRITICAL]: 'critical',
      [Priority.HIGH]: 'high',
      [Priority.MEDIUM]: 'medium',
      [Priority.LOW]: 'low'
    };
    return priorityMap[priority] || 'medium';
  }

  private mapInternalCategory(category: TicketCategory): string {
    const categoryMap: Record<TicketCategory, string> = {
      [TicketCategory.HARDWARE]: 'hardware',
      [TicketCategory.SOFTWARE]: 'software',
      [TicketCategory.NETWORK]: 'network',
      [TicketCategory.SECURITY]: 'security',
      [TicketCategory.GENERAL]: 'general'
    };
    return categoryMap[category] || 'general';
  }

  private mapInternalRole(role: UserRole): string {
    const roleMap: Record<UserRole, string> = {
      [UserRole.ADMIN]: 'admin',
      [UserRole.MANAGER]: 'manager',
      [UserRole.TECHNICIAN]: 'technician',
      [UserRole.READ_ONLY]: 'readonly'
    };
    return roleMap[role] || 'technician';
  }

  // Data enrichment methods
  private extractCustomerName(superOpsTicket: SuperOpsTicket): string {
    // This would typically fetch customer data from SuperOps
    return superOpsTicket.custom_fields?.customer_name || 'Unknown Customer';
  }

  private extractCustomerEmail(superOpsTicket: SuperOpsTicket): string {
    return superOpsTicket.custom_fields?.customer_email || 'unknown@example.com';
  }

  private extractCustomerTier(superOpsTicket: SuperOpsTicket): 'basic' | 'premium' | 'enterprise' {
    return this.mapCustomerTier(superOpsTicket.custom_fields?.customer_tier || 'basic');
  }

  private mapAttachments(attachments: any[]): any[] {
    return attachments.map(attachment => ({
      filename: attachment.filename,
      url: attachment.url,
      size: attachment.size,
      mimeType: attachment.content_type
    }));
  }

  private calculateResponseTimeTarget(priority: Priority, tier: string): number {
    const targets = {
      [Priority.CRITICAL]: { basic: 60, premium: 30, enterprise: 15 },
      [Priority.HIGH]: { basic: 240, premium: 120, enterprise: 60 },
      [Priority.MEDIUM]: { basic: 480, premium: 240, enterprise: 120 },
      [Priority.LOW]: { basic: 1440, premium: 720, enterprise: 480 }
    };
    return targets[priority]?.[tier] || 480;
  }

  private calculateResolutionTimeTarget(priority: Priority, tier: string): number {
    const targets = {
      [Priority.CRITICAL]: { basic: 480, premium: 240, enterprise: 120 },
      [Priority.HIGH]: { basic: 1440, premium: 720, enterprise: 480 },
      [Priority.MEDIUM]: { basic: 2880, premium: 1440, enterprise: 720 },
      [Priority.LOW]: { basic: 5760, premium: 2880, enterprise: 1440 }
    };
    return targets[priority]?.[tier] || 2880;
  }

  private extractCustomFields(ticket: Ticket): Record<string, any> {
    return {
      internal_id: ticket.id,
      escalation_level: ticket.escalationLevel,
      time_spent: ticket.timeSpent,
      billable_time: ticket.billableTime
    };
  }

  private extractPrimaryContact(superOpsCustomer: SuperOpsCustomer): any {
    return {
      name: superOpsCustomer.name,
      email: superOpsCustomer.email,
      phoneNumber: superOpsCustomer.phone,
      role: 'Primary Contact'
    };
  }

  private extractBusinessHours(superOpsCustomer: SuperOpsCustomer): any {
    return {
      timezone: 'UTC',
      workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'],
      startTime: '09:00',
      endTime: '17:00'
    };
  }

  private extractIndustry(superOpsCustomer: SuperOpsCustomer): string {
    return superOpsCustomer.custom_fields?.industry || 'Technology';
  }

  private extractPreferredContactMethod(superOpsCustomer: SuperOpsCustomer): 'email' | 'phone' | 'chat' | 'portal' {
    return superOpsCustomer.custom_fields?.preferred_contact || 'email';
  }

  private extractCustomerCustomFields(customer: Customer): Record<string, any> {
    return {
      internal_id: customer.id,
      satisfaction_score: customer.satisfactionScore,
      total_tickets: customer.totalTickets,
      open_tickets: customer.openTickets
    };
  }

  private mapTechnicianSkills(skills: string[]): any[] {
    return skills.map(skill => ({
      category: skill,
      proficiencyLevel: 5, // Default proficiency
      certifications: [],
      yearsExperience: 1
    }));
  }

  private extractTimezone(superOpsTechnician: SuperOpsTechnician): string {
    return superOpsTechnician.custom_fields?.timezone || 'UTC';
  }

  private extractHireDate(superOpsTechnician: SuperOpsTechnician): Date {
    return superOpsTechnician.custom_fields?.hire_date 
      ? new Date(superOpsTechnician.custom_fields.hire_date)
      : new Date();
  }

  private calculateMaxCapacity(superOpsTechnician: SuperOpsTechnician): number {
    return superOpsTechnician.custom_fields?.max_capacity || 10;
  }

  private extractTechnicianCustomFields(technician: Technician): Record<string, any> {
    return {
      internal_id: technician.id,
      current_workload: technician.currentWorkload,
      max_capacity: technician.maxCapacity,
      timezone: technician.timezone,
      location: technician.location
    };
  }

  // Configuration methods
  public updateFieldMapping(entityType: keyof EntityMapping, mappings: FieldMapping[]): void {
    this.entityMappings[entityType] = mappings;
    logger.info('Updated field mappings', { entityType, mappingCount: mappings.length });
  }

  public getFieldMappings(entityType: keyof EntityMapping): FieldMapping[] {
    return this.entityMappings[entityType];
  }

  public validateMapping(entityType: keyof EntityMapping, data: any): boolean {
    try {
      const mappings = this.entityMappings[entityType];
      const requiredFields = mappings.filter(m => m.required);
      
      for (const field of requiredFields) {
        if (!data[field.externalField]) {
          logger.error('Missing required field in mapping validation', {
            entityType,
            field: field.externalField
          });
          return false;
        }
      }
      
      return true;
    } catch (error) {
      logger.error('Error validating mapping:', { entityType, error });
      return false;
    }
  }
}