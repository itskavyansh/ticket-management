import { BaseRepository } from '../dynamodb/repositories/BaseRepository';
import { Technician, CreateTechnicianRequest, UpdateTechnicianRequest, TechnicianFilter } from '../../models/Technician';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Repository for technician data operations using DynamoDB
 */
export class TechnicianRepository extends BaseRepository<Technician> {
  constructor() {
    super(process.env.TECHNICIANS_TABLE_NAME || 'ai-ticket-management-technicians');
  }

  /**
   * Create a new technician
   */
  async create(technicianData: CreateTechnicianRequest): Promise<Technician> {
    const technicianId = uuidv4();
    const now = new Date();
    
    const technician: Technician = {
      id: technicianId,
      ...technicianData,
      skills: technicianData.skills || [],
      currentWorkload: 0,
      maxCapacity: technicianData.maxCapacity || 10,
      availability: {
        timezone: technicianData.timezone,
        workingHours: {
          monday: { start: '09:00', end: '17:00', available: true },
          tuesday: { start: '09:00', end: '17:00', available: true },
          wednesday: { start: '09:00', end: '17:00', available: true },
          thursday: { start: '09:00', end: '17:00', available: true },
          friday: { start: '09:00', end: '17:00', available: true },
          saturday: { start: '09:00', end: '17:00', available: false },
          sunday: { start: '09:00', end: '17:00', available: false }
        },
        timeOff: [],
        holidays: []
      },
      preferences: {
        notificationChannels: ['email'],
        preferredTicketTypes: [],
        autoAssignment: true
      },
      hireDate: technicianData.hireDate || now,
      isActive: true,
      currentStatus: 'available',
      timezone: technicianData.timezone,
      certifications: [],
      trainingCompleted: [],
      createdAt: now,
      updatedAt: now
    };

    try {
      await this.putItem(technician);
      
      logger.info('Technician created successfully', {
        technicianId,
        name: technician.name,
        email: technician.email
      });

      return technician;
    } catch (error) {
      logger.error('Failed to create technician', {
        technicianId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get technician by ID
   */
  async getById(technicianId: string): Promise<Technician | null> {
    try {
      const technician = await this.getItem({ id: technicianId });
      return technician as Technician | null;
    } catch (error) {
      logger.error('Failed to get technician by ID', {
        technicianId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get technician by email
   */
  async getByEmail(email: string): Promise<Technician | null> {
    try {
      const result = await this.queryItems(
        'email = :email',
        undefined,
        { ':email': email },
        'EmailIndex'
      );

      return result.items.length > 0 ? result.items[0] as Technician : null;
    } catch (error) {
      logger.error('Failed to get technician by email', {
        email,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get technician by external ID (SuperOps ID)
   */
  async getByExternalId(externalId: string): Promise<Technician | null> {
    try {
      const result = await this.queryItems(
        'externalId = :externalId',
        undefined,
        { ':externalId': externalId },
        'ExternalIdIndex'
      );

      return result.items.length > 0 ? result.items[0] as Technician : null;
    } catch (error) {
      logger.error('Failed to get technician by external ID', {
        externalId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update technician
   */
  async update(technicianId: string, updates: UpdateTechnicianRequest): Promise<Technician | null> {
    try {
      // Build update expression
      const updateExpressions: string[] = [];
      const attributeNames: Record<string, string> = {};
      const attributeValues: Record<string, any> = {};
      let expressionIndex = 0;

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const nameKey = `#${key}`;
          const valueKey = `:val${expressionIndex}`;
          
          attributeNames[nameKey] = key;
          attributeValues[valueKey] = value;
          updateExpressions.push(`${nameKey} = ${valueKey}`);
          
          expressionIndex++;
        }
      });

      // Always update the updatedAt timestamp
      attributeNames['#updatedAt'] = 'updatedAt';
      attributeValues[':updatedAt'] = new Date();
      updateExpressions.push('#updatedAt = :updatedAt');

      const updateExpression = `SET ${updateExpressions.join(', ')}`;

      const updatedTechnician = await this.updateItem(
        { id: technicianId },
        updateExpression,
        attributeNames,
        attributeValues
      );

      return updatedTechnician as Technician | null;
    } catch (error) {
      logger.error('Failed to update technician', {
        technicianId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Delete technician (soft delete by setting isActive to false)
   */
  async delete(technicianId: string): Promise<void> {
    try {
      await this.update(technicianId, { isActive: false });
      
      logger.info('Technician deleted (soft delete)', {
        technicianId
      });
    } catch (error) {
      logger.error('Failed to delete technician', {
        technicianId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get all technicians with optional filtering
   */
  async getAll(filters?: TechnicianFilter, limit: number = 100): Promise<Technician[]> {
    try {
      let filterExpression: string | undefined;
      let expressionAttributeNames: Record<string, string> | undefined;
      let expressionAttributeValues: Record<string, any> | undefined;

      if (filters) {
        const filterResult = this.buildFilterExpression(filters);
        filterExpression = filterResult.expression;
        expressionAttributeNames = filterResult.attributeNames;
        expressionAttributeValues = filterResult.attributeValues;
      }

      const result = await this.scanItems(
        filterExpression,
        expressionAttributeNames,
        expressionAttributeValues,
        undefined,
        limit
      );

      return result.items as Technician[];
    } catch (error) {
      logger.error('Failed to get all technicians', {
        filters,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get technicians by department
   */
  async getByDepartment(department: string): Promise<Technician[]> {
    try {
      const result = await this.queryItems(
        'department = :department',
        undefined,
        { ':department': department },
        'DepartmentIndex'
      );

      return result.items as Technician[];
    } catch (error) {
      logger.error('Failed to get technicians by department', {
        department,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get available technicians (active and available status)
   */
  async getAvailableTechnicians(): Promise<Technician[]> {
    try {
      const result = await this.scanItems(
        'isActive = :isActive AND currentStatus = :status',
        undefined,
        { 
          ':isActive': true,
          ':status': 'available'
        }
      );

      return result.items as Technician[];
    } catch (error) {
      logger.error('Failed to get available technicians', {
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update technician workload
   */
  async updateWorkload(technicianId: string, workload: number): Promise<void> {
    try {
      // Update workload through a custom update that handles currentWorkload
      const updateExpression = 'SET currentWorkload = :workload, updatedAt = :updatedAt';
      const attributeValues = {
        ':workload': workload,
        ':updatedAt': new Date()
      };
      
      await this.updateItem(
        { id: technicianId },
        updateExpression,
        {},
        attributeValues
      );
      
      logger.debug('Technician workload updated', {
        technicianId,
        workload
      });
    } catch (error) {
      logger.error('Failed to update technician workload', {
        technicianId,
        workload,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update technician status
   */
  async updateStatus(
    technicianId: string, 
    status: 'available' | 'busy' | 'away' | 'offline',
    statusMessage?: string
  ): Promise<void> {
    try {
      const updates: UpdateTechnicianRequest = { 
        currentStatus: status
      };
      
      if (statusMessage !== undefined) {
        updates.statusMessage = statusMessage;
      }

      await this.update(technicianId, updates);
      
      logger.debug('Technician status updated', {
        technicianId,
        status,
        statusMessage
      });
    } catch (error) {
      logger.error('Failed to update technician status', {
        technicianId,
        status,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Build filter expression for technician queries
   */
  private buildFilterExpression(filters: TechnicianFilter): {
    expression?: string;
    attributeNames?: Record<string, string>;
    attributeValues?: Record<string, any>;
  } {
    const filterConditions: string[] = [];
    const attributeNames: Record<string, string> = {};
    const attributeValues: Record<string, any> = {};

    // Role filter
    if (filters.role && filters.role.length > 0) {
      const roleKeys = filters.role.map((_, i) => `:role${i}`);
      filters.role.forEach((role, i) => {
        attributeValues[`:role${i}`] = role;
      });
      filterConditions.push(`#role IN (${roleKeys.join(', ')})`);
      attributeNames['#role'] = 'role';
    }

    // Department filter
    if (filters.department && filters.department.length > 0) {
      const deptKeys = filters.department.map((_, i) => `:dept${i}`);
      filters.department.forEach((dept, i) => {
        attributeValues[`:dept${i}`] = dept;
      });
      filterConditions.push(`department IN (${deptKeys.join(', ')})`);
    }

    // Skills filter
    if (filters.skills && filters.skills.length > 0) {
      const skillConditions = filters.skills.map((skill, i) => {
        attributeValues[`:skill${i}`] = skill;
        return `contains(skills, :skill${i})`;
      });
      filterConditions.push(`(${skillConditions.join(' OR ')})`);
    }

    // Active status filter
    if (filters.isActive !== undefined) {
      filterConditions.push(`isActive = :isActive`);
      attributeValues[':isActive'] = filters.isActive;
    }

    // Current status filter
    if (filters.currentStatus && filters.currentStatus.length > 0) {
      const statusKeys = filters.currentStatus.map((_, i) => `:status${i}`);
      filters.currentStatus.forEach((status, i) => {
        attributeValues[`:status${i}`] = status;
      });
      filterConditions.push(`currentStatus IN (${statusKeys.join(', ')})`);
    }

    // Location filter
    if (filters.location && filters.location.length > 0) {
      const locationKeys = filters.location.map((_, i) => `:location${i}`);
      filters.location.forEach((location, i) => {
        attributeValues[`:location${i}`] = location;
      });
      filterConditions.push(`#location IN (${locationKeys.join(', ')})`);
      attributeNames['#location'] = 'location';
    }

    return {
      expression: filterConditions.length > 0 ? filterConditions.join(' AND ') : undefined,
      attributeNames: Object.keys(attributeNames).length > 0 ? attributeNames : undefined,
      attributeValues: Object.keys(attributeValues).length > 0 ? attributeValues : undefined
    };
  }
}