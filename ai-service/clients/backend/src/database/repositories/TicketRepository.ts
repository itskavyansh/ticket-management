import { BaseRepository } from '../dynamodb/repositories/BaseRepository';
import { TicketEntity } from '../../entities/TicketEntity';
import { 
  Ticket, 
  TicketFilter, 
  TicketSearchQuery, 
  CreateTicketRequest, 
  UpdateTicketRequest,
  TicketTimeline 
} from '../../models/Ticket';
import { TicketStatus, Priority, TicketCategory } from '../../types';
import { logger } from '../../utils/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Repository for ticket data operations using DynamoDB
 */
export class TicketRepository extends BaseRepository<Ticket> {
  private timelineTableName: string;

  constructor() {
    super(process.env.TICKETS_TABLE_NAME || 'ai-ticket-management-tickets');
    this.timelineTableName = process.env.TICKET_TIMELINE_TABLE_NAME || 'ai-ticket-management-ticket-timeline';
  }

  /**
   * Create a new ticket
   */
  async create(ticketData: CreateTicketRequest): Promise<TicketEntity> {
    const ticketId = uuidv4();
    const now = new Date();
    
    const ticket = new TicketEntity({
      id: ticketId,
      ...ticketData,
      attachments: ticketData.attachments?.map(att => ({
        ...att,
        id: uuidv4(),
        uploadedAt: now
      })) || [],
      status: TicketStatus.OPEN,
      timeSpent: 0,
      billableTime: 0,
      escalationLevel: 0,
      createdAt: now,
      updatedAt: now
    });

    // Calculate SLA deadline based on customer tier and priority
    this.calculateSLADeadline(ticket);

    try {
      await this.putItem(ticket);
      
      // Create initial timeline entry
      await this.addTimelineEntry(ticketId, {
        action: 'created',
        description: `Ticket created: ${ticket.title}`,
        performedBy: 'system',
        performedAt: now,
        metadata: {
          priority: ticket.priority,
          category: ticket.category,
          customerId: ticket.customerId
        }
      });

      logger.info('Ticket created successfully', {
        ticketId,
        customerId: ticket.customerId,
        priority: ticket.priority
      });

      return ticket;
    } catch (error) {
      logger.error('Failed to create ticket', {
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get ticket by ID
   */
  async getById(customerId: string, ticketId: string): Promise<TicketEntity | null> {
    try {
      const ticket = await this.getItem({
        customerId,
        ticketId
      });

      return ticket ? new TicketEntity(ticket) : null;
    } catch (error) {
      logger.error('Failed to get ticket by ID', {
        customerId,
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get ticket by external ID (SuperOps ID)
   */
  async getByExternalId(externalId: string): Promise<TicketEntity | null> {
    try {
      const result = await this.queryItems(
        'externalId = :externalId',
        undefined,
        { ':externalId': externalId },
        'ExternalIdIndex'
      );

      return result.items.length > 0 ? new TicketEntity(result.items[0]) : null;
    } catch (error) {
      logger.error('Failed to get ticket by external ID', {
        externalId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Update ticket
   */
  async update(
    customerId: string, 
    ticketId: string, 
    updates: UpdateTicketRequest,
    updatedBy: string
  ): Promise<TicketEntity | null> {
    try {
      // Get current ticket to track changes
      const currentTicket = await this.getById(customerId, ticketId);
      if (!currentTicket) {
        return null;
      }

      // Build update expression
      const updateExpressions: string[] = [];
      const attributeNames: Record<string, string> = {};
      const attributeValues: Record<string, any> = {};
      let expressionIndex = 0;

      // Track changes for timeline
      const changes: Array<{ field: string; oldValue: any; newValue: any }> = [];

      Object.entries(updates).forEach(([key, value]) => {
        if (value !== undefined) {
          const nameKey = `#${key}`;
          const valueKey = `:val${expressionIndex}`;
          
          attributeNames[nameKey] = key;
          attributeValues[valueKey] = value;
          updateExpressions.push(`${nameKey} = ${valueKey}`);
          
          // Track change for timeline
          const oldValue = (currentTicket as any)[key];
          if (oldValue !== value) {
            changes.push({ field: key, oldValue, newValue: value });
          }
          
          expressionIndex++;
        }
      });

      // Always update the updatedAt timestamp
      attributeNames['#updatedAt'] = 'updatedAt';
      attributeValues[':updatedAt'] = new Date();
      updateExpressions.push('#updatedAt = :updatedAt');

      const updateExpression = `SET ${updateExpressions.join(', ')}`;

      const updatedTicket = await this.updateItem(
        { customerId, ticketId },
        updateExpression,
        attributeNames,
        attributeValues
      );

      if (updatedTicket && changes.length > 0) {
        // Add timeline entries for significant changes
        for (const change of changes) {
          await this.addTimelineEntry(ticketId, {
            action: 'updated',
            description: `${change.field} changed from "${change.oldValue}" to "${change.newValue}"`,
            performedBy: updatedBy,
            performedAt: new Date(),
            oldValue: change.oldValue,
            newValue: change.newValue,
            metadata: { field: change.field }
          });
        }
      }

      return updatedTicket ? new TicketEntity(updatedTicket) : null;
    } catch (error) {
      logger.error('Failed to update ticket', {
        customerId,
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Delete ticket
   */
  async delete(customerId: string, ticketId: string): Promise<void> {
    try {
      await this.deleteItem({ customerId, ticketId });
      
      logger.info('Ticket deleted successfully', {
        customerId,
        ticketId
      });
    } catch (error) {
      logger.error('Failed to delete ticket', {
        customerId,
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Search and filter tickets with enhanced capabilities
   */
  async search(searchQuery: TicketSearchQuery): Promise<{
    tickets: TicketEntity[];
    totalCount: number;
    hasMore: boolean;
    lastEvaluatedKey?: Record<string, any>;
  }> {
    try {
      const { filters, sortBy = 'createdAt', sortOrder = 'desc', page = 1, limit = 20 } = searchQuery;
      
      // Calculate pagination offset
      const offset = (page - 1) * limit;
      
      let indexName: string | undefined;
      let keyConditionExpression: string | undefined;
      let filterExpression: string | undefined;
      let expressionAttributeNames: Record<string, string> = {};
      let expressionAttributeValues: Record<string, any> = {};

      // Optimize index selection based on filters and sort order
      indexName = this.selectOptimalIndex(filters, sortBy);
      
      // Build key condition expression for selected index
      if (indexName && filters) {
        const keyCondition = this.buildKeyConditionExpression(indexName, filters);
        if (keyCondition) {
          keyConditionExpression = keyCondition.expression;
          Object.assign(expressionAttributeNames, keyCondition.attributeNames);
          Object.assign(expressionAttributeValues, keyCondition.attributeValues);
        }
      }

      // Build comprehensive filter expression
      const filterResult = this.buildAdvancedFilterExpression(filters, expressionAttributeNames, expressionAttributeValues);
      filterExpression = filterResult.expression;
      Object.assign(expressionAttributeNames, filterResult.attributeNames);
      Object.assign(expressionAttributeValues, filterResult.attributeValues);

      // Execute optimized query or scan with proper pagination
      let result;
      const queryLimit = Math.min(limit * 3, 100); // Fetch more items to account for post-processing filters

      if (keyConditionExpression) {
        result = await this.queryItems(
          keyConditionExpression,
          Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
          Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
          indexName,
          filterExpression,
          queryLimit,
          sortOrder === 'asc'
        );
      } else {
        result = await this.scanItems(
          filterExpression,
          Object.keys(expressionAttributeNames).length > 0 ? expressionAttributeNames : undefined,
          Object.keys(expressionAttributeValues).length > 0 ? expressionAttributeValues : undefined,
          undefined,
          queryLimit
        );
      }

      // Convert to TicketEntity instances
      let tickets = result.items.map(item => new TicketEntity(item));

      // Apply advanced post-processing filters
      tickets = this.applyPostProcessingFilters(tickets, searchQuery);

      // Apply full-text search with enhanced matching
      if (searchQuery.query) {
        tickets = this.applyFullTextSearch(tickets, searchQuery.query);
      }

      // Apply advanced sorting
      tickets = this.applySorting(tickets, sortBy, sortOrder);

      // Calculate total count before pagination
      const totalCount = tickets.length;

      // Apply pagination
      const paginatedTickets = tickets.slice(offset, offset + limit);
      const hasMore = offset + limit < totalCount;

      logger.debug('Enhanced ticket search completed', {
        query: searchQuery.query,
        filtersApplied: !!filters,
        indexUsed: indexName,
        totalFound: totalCount,
        returned: paginatedTickets.length,
        hasMore,
        page,
        limit
      });

      return {
        tickets: paginatedTickets,
        totalCount,
        hasMore,
        lastEvaluatedKey: result.lastEvaluatedKey
      };
    } catch (error) {
      logger.error('Failed to search tickets', {
        searchQuery,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Select optimal index based on filters and sort criteria
   */
  private selectOptimalIndex(filters?: TicketFilter, sortBy?: string): string | undefined {
    if (!filters) return undefined;

    // Priority-based index selection for optimal query performance
    if (filters.assignedTechnicianId) {
      return 'TechnicianIndex';
    }
    
    if (filters.status && filters.status.length === 1) {
      return 'StatusIndex';
    }
    
    if (filters.priority && filters.priority.length === 1) {
      return 'PriorityIndex';
    }
    
    if (filters.category && filters.category.length === 1) {
      return 'CategoryIndex';
    }
    
    if (filters.customerId) {
      return 'CustomerIndex';
    }
    
    if (sortBy === 'slaDeadline') {
      return 'SLADeadlineIndex';
    }

    return undefined;
  }

  /**
   * Build key condition expression for the selected index
   */
  private buildKeyConditionExpression(
    indexName: string, 
    filters: TicketFilter
  ): { expression: string; attributeNames: Record<string, string>; attributeValues: Record<string, any> } | null {
    const attributeNames: Record<string, string> = {};
    const attributeValues: Record<string, any> = {};

    switch (indexName) {
      case 'TechnicianIndex':
        if (filters.assignedTechnicianId) {
          return {
            expression: 'assignedTechnicianId = :technicianId',
            attributeNames,
            attributeValues: { ':technicianId': filters.assignedTechnicianId }
          };
        }
        break;
        
      case 'StatusIndex':
        if (filters.status && filters.status.length === 1) {
          return {
            expression: '#status = :status',
            attributeNames: { '#status': 'status' },
            attributeValues: { ':status': filters.status[0] }
          };
        }
        break;
        
      case 'PriorityIndex':
        if (filters.priority && filters.priority.length === 1) {
          return {
            expression: '#priority = :priority',
            attributeNames: { '#priority': 'priority' },
            attributeValues: { ':priority': filters.priority[0] }
          };
        }
        break;
        
      case 'CategoryIndex':
        if (filters.category && filters.category.length === 1) {
          return {
            expression: '#category = :category',
            attributeNames: { '#category': 'category' },
            attributeValues: { ':category': filters.category[0] }
          };
        }
        break;
        
      case 'CustomerIndex':
        if (filters.customerId) {
          return {
            expression: 'customerId = :customerId',
            attributeNames,
            attributeValues: { ':customerId': filters.customerId }
          };
        }
        break;
    }

    return null;
  }

  /**
   * Build comprehensive filter expression with enhanced filtering capabilities
   */
  private buildAdvancedFilterExpression(
    filters?: TicketFilter,
    existingNames: Record<string, string> = {},
    existingValues: Record<string, any> = {}
  ): { expression?: string; attributeNames: Record<string, string>; attributeValues: Record<string, any> } {
    const filterConditions: string[] = [];
    const attributeNames = { ...existingNames };
    const attributeValues = { ...existingValues };

    if (!filters) {
      return { attributeNames, attributeValues };
    }

    // Multiple status values (if not used in key condition)
    if (filters.status && filters.status.length > 1) {
      const statusKeys = filters.status.map((_, i) => `:status${i}`);
      filters.status.forEach((status, i) => {
        attributeValues[`:status${i}`] = status;
      });
      filterConditions.push(`#status IN (${statusKeys.join(', ')})`);
      attributeNames['#status'] = 'status';
    }

    // Multiple priority values (if not used in key condition)
    if (filters.priority && filters.priority.length > 1) {
      const priorityKeys = filters.priority.map((_, i) => `:priority${i}`);
      filters.priority.forEach((priority, i) => {
        attributeValues[`:priority${i}`] = priority;
      });
      filterConditions.push(`#priority IN (${priorityKeys.join(', ')})`);
      attributeNames['#priority'] = 'priority';
    }

    // Multiple category values (if not used in key condition)
    if (filters.category && filters.category.length > 1) {
      const categoryKeys = filters.category.map((_, i) => `:category${i}`);
      filters.category.forEach((category, i) => {
        attributeValues[`:category${i}`] = category;
      });
      filterConditions.push(`#category IN (${categoryKeys.join(', ')})`);
      attributeNames['#category'] = 'category';
    }

    // Customer ID filter (if not used in key condition)
    if (filters.customerId && !existingValues[':customerId']) {
      filterConditions.push(`customerId = :customerId`);
      attributeValues[':customerId'] = filters.customerId;
    }

    // Customer tier filter
    if (filters.customerTier && filters.customerTier.length > 0) {
      const tierKeys = filters.customerTier.map((_, i) => `:tier${i}`);
      filters.customerTier.forEach((tier, i) => {
        attributeValues[`:tier${i}`] = tier;
      });
      filterConditions.push(`customerTier IN (${tierKeys.join(', ')})`);
    }

    // Enhanced date range filters
    if (filters.createdAfter) {
      filterConditions.push(`createdAt >= :createdAfter`);
      attributeValues[':createdAfter'] = filters.createdAfter.toISOString();
    }

    if (filters.createdBefore) {
      filterConditions.push(`createdAt <= :createdBefore`);
      attributeValues[':createdBefore'] = filters.createdBefore.toISOString();
    }

    if (filters.updatedAfter) {
      filterConditions.push(`updatedAt >= :updatedAfter`);
      attributeValues[':updatedAfter'] = filters.updatedAfter.toISOString();
    }

    if (filters.updatedBefore) {
      filterConditions.push(`updatedAt <= :updatedBefore`);
      attributeValues[':updatedBefore'] = filters.updatedBefore.toISOString();
    }

    // Enhanced tags filter with partial matching
    if (filters.tags && filters.tags.length > 0) {
      const tagConditions = filters.tags.map((tag, i) => {
        attributeValues[`:tag${i}`] = tag;
        return `contains(tags, :tag${i})`;
      });
      filterConditions.push(`(${tagConditions.join(' OR ')})`);
    }

    // Escalation level filter
    if (filters.escalationLevel && filters.escalationLevel.length > 0) {
      const escalationKeys = filters.escalationLevel.map((_, i) => `:escalation${i}`);
      filters.escalationLevel.forEach((level, i) => {
        attributeValues[`:escalation${i}`] = level;
      });
      filterConditions.push(`escalationLevel IN (${escalationKeys.join(', ')})`);
    }

    // Attachments filter
    if (filters.hasAttachments !== undefined) {
      if (filters.hasAttachments) {
        filterConditions.push(`size(attachments) > :zeroAttachments`);
        attributeValues[':zeroAttachments'] = 0;
      } else {
        filterConditions.push(`size(attachments) = :zeroAttachments`);
        attributeValues[':zeroAttachments'] = 0;
      }
    }

    // Time spent range filters
    if (filters.timeSpentMin !== undefined) {
      filterConditions.push(`timeSpent >= :timeSpentMin`);
      attributeValues[':timeSpentMin'] = filters.timeSpentMin;
    }

    if (filters.timeSpentMax !== undefined) {
      filterConditions.push(`timeSpent <= :timeSpentMax`);
      attributeValues[':timeSpentMax'] = filters.timeSpentMax;
    }

    // Resolution time range filters
    if (filters.resolutionTimeMin !== undefined) {
      filterConditions.push(`actualResolutionTime >= :resolutionTimeMin`);
      attributeValues[':resolutionTimeMin'] = filters.resolutionTimeMin;
    }

    if (filters.resolutionTimeMax !== undefined) {
      filterConditions.push(`actualResolutionTime <= :resolutionTimeMax`);
      attributeValues[':resolutionTimeMax'] = filters.resolutionTimeMax;
    }

    return {
      expression: filterConditions.length > 0 ? filterConditions.join(' AND ') : undefined,
      attributeNames,
      attributeValues
    };
  }

  /**
   * Apply post-processing filters that require calculation or complex logic
   */
  private applyPostProcessingFilters(tickets: TicketEntity[], searchQuery: TicketSearchQuery): TicketEntity[] {
    let filteredTickets = tickets;

    // Apply SLA risk filter
    if (searchQuery.filters?.slaRisk) {
      filteredTickets = filteredTickets.filter(ticket => {
        const riskScore = ticket.getSLARiskScore();
        switch (searchQuery.filters!.slaRisk) {
          case 'low': return riskScore < 0.3;
          case 'medium': return riskScore >= 0.3 && riskScore < 0.7;
          case 'high': return riskScore >= 0.7;
          default: return true;
        }
      });
    }

    // Apply overdue filter
    if (searchQuery.filters?.isOverdue !== undefined) {
      const now = new Date();
      filteredTickets = filteredTickets.filter(ticket => {
        const isOverdue = ticket.slaDeadline < now && 
          ![TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status);
        return searchQuery.filters!.isOverdue ? isOverdue : !isOverdue;
      });
    }

    // Apply status exclusion filters based on search preferences
    if (!searchQuery.includeResolved) {
      filteredTickets = filteredTickets.filter(ticket => ticket.status !== TicketStatus.RESOLVED);
    }

    if (!searchQuery.includeClosed) {
      filteredTickets = filteredTickets.filter(ticket => 
        ![TicketStatus.CLOSED, TicketStatus.CANCELLED].includes(ticket.status)
      );
    }

    return filteredTickets;
  }

  /**
   * Apply enhanced full-text search with relevance scoring
   */
  private applyFullTextSearch(tickets: TicketEntity[], query: string): TicketEntity[] {
    if (!query || query.trim().length === 0) {
      return tickets;
    }

    const searchTerms = query.toLowerCase().trim().split(/\s+/);
    
    return tickets
      .map(ticket => ({
        ticket,
        relevanceScore: this.calculateRelevanceScore(ticket, searchTerms)
      }))
      .filter(item => item.relevanceScore > 0)
      .sort((a, b) => b.relevanceScore - a.relevanceScore)
      .map(item => item.ticket);
  }

  /**
   * Calculate relevance score for full-text search
   */
  private calculateRelevanceScore(ticket: TicketEntity, searchTerms: string[]): number {
    let score = 0;
    const title = ticket.title.toLowerCase();
    const description = ticket.description.toLowerCase();
    const customerName = ticket.customerName.toLowerCase();
    const tags = ticket.tags.map(tag => tag.toLowerCase());

    for (const term of searchTerms) {
      // Title matches have highest weight
      if (title.includes(term)) {
        score += title.startsWith(term) ? 10 : 5;
      }

      // Customer name matches
      if (customerName.includes(term)) {
        score += customerName.startsWith(term) ? 8 : 4;
      }

      // Tag exact matches
      if (tags.some(tag => tag === term)) {
        score += 6;
      }

      // Tag partial matches
      if (tags.some(tag => tag.includes(term))) {
        score += 3;
      }

      // Description matches
      if (description.includes(term)) {
        score += 2;
      }

      // External ID matches
      if (ticket.externalId && ticket.externalId.toLowerCase().includes(term)) {
        score += 7;
      }
    }

    return score;
  }

  /**
   * Apply advanced sorting with multiple criteria and enhanced options
   */
  private applySorting(tickets: TicketEntity[], sortBy: string, sortOrder: string): TicketEntity[] {
    return tickets.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
          
        case 'priority':
          const priorityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
          const aPriority = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
          const bPriority = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
          comparison = aPriority - bPriority;
          break;
          
        case 'slaDeadline':
          comparison = a.slaDeadline.getTime() - b.slaDeadline.getTime();
          break;
          
        case 'status':
          const statusOrder = { 
            open: 1, 
            in_progress: 2, 
            pending_customer: 3, 
            resolved: 4, 
            closed: 5, 
            cancelled: 6 
          };
          const aStatus = statusOrder[a.status as keyof typeof statusOrder] || 0;
          const bStatus = statusOrder[b.status as keyof typeof statusOrder] || 0;
          comparison = aStatus - bStatus;
          break;
          
        case 'customerName':
          comparison = a.customerName.localeCompare(b.customerName);
          break;
          
        case 'escalationLevel':
          comparison = a.escalationLevel - b.escalationLevel;
          break;
          
        case 'timeSpent':
          comparison = a.timeSpent - b.timeSpent;
          break;
          
        case 'relevance':
          // Relevance sorting is handled in the full-text search function
          // This case maintains the order from search results
          return 0;
          
        case 'createdAt':
        default:
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
      }

      // Secondary sort by creation date for consistent ordering
      if (comparison === 0 && sortBy !== 'createdAt') {
        comparison = a.createdAt.getTime() - b.createdAt.getTime();
      }

      // Tertiary sort by ticket ID for absolute consistency
      if (comparison === 0) {
        comparison = a.id.localeCompare(b.id);
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Get tickets by technician
   */
  async getByTechnician(
    technicianId: string, 
    status?: TicketStatus[], 
    limit: number = 50
  ): Promise<TicketEntity[]> {
    try {
      let filterExpression: string | undefined;
      let expressionAttributeValues: Record<string, any> | undefined;

      if (status && status.length > 0) {
        const statusKeys = status.map((_, i) => `:status${i}`);
        expressionAttributeValues = {};
        status.forEach((s, i) => {
          expressionAttributeValues![`:status${i}`] = s;
        });
        filterExpression = `#status IN (${statusKeys.join(', ')})`;
      }

      const result = await this.queryItems(
        'assignedTechnicianId = :technicianId',
        status ? { '#status': 'status' } : undefined,
        { ':technicianId': technicianId, ...expressionAttributeValues },
        'TechnicianIndex',
        filterExpression,
        limit,
        false // Most recent first
      );

      return result.items.map(item => new TicketEntity(item));
    } catch (error) {
      logger.error('Failed to get tickets by technician', {
        technicianId,
        status,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get tickets by customer
   */
  async getByCustomer(
    customerId: string, 
    status?: TicketStatus[], 
    limit: number = 50
  ): Promise<TicketEntity[]> {
    try {
      let filterExpression: string | undefined;
      let expressionAttributeNames: Record<string, string> | undefined;
      let expressionAttributeValues: Record<string, any> | undefined;

      if (status && status.length > 0) {
        const statusKeys = status.map((_, i) => `:status${i}`);
        expressionAttributeNames = { '#status': 'status' };
        expressionAttributeValues = {};
        status.forEach((s, i) => {
          expressionAttributeValues![`:status${i}`] = s;
        });
        filterExpression = `#status IN (${statusKeys.join(', ')})`;
      }

      const result = await this.queryItems(
        'customerId = :customerId',
        expressionAttributeNames,
        { ':customerId': customerId, ...expressionAttributeValues },
        undefined,
        filterExpression,
        limit,
        false // Most recent first
      );

      return result.items.map(item => new TicketEntity(item));
    } catch (error) {
      logger.error('Failed to get tickets by customer', {
        customerId,
        status,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Assign ticket to technician
   */
  async assignTicket(
    customerId: string,
    ticketId: string,
    technicianId: string,
    assignedBy: string
  ): Promise<TicketEntity | null> {
    try {
      const updatedTicket = await this.update(
        customerId,
        ticketId,
        {
          assignedTechnicianId: technicianId,
          status: TicketStatus.IN_PROGRESS
        },
        assignedBy
      );

      if (updatedTicket) {
        await this.addTimelineEntry(ticketId, {
          action: 'assigned',
          description: `Ticket assigned to technician ${technicianId}`,
          performedBy: assignedBy,
          performedAt: new Date(),
          metadata: { technicianId }
        });
      }

      return updatedTicket;
    } catch (error) {
      logger.error('Failed to assign ticket', {
        customerId,
        ticketId,
        technicianId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Get ticket timeline
   */
  async getTimeline(ticketId: string): Promise<TicketTimeline[]> {
    try {
      // This would query the timeline table
      // For now, return empty array as timeline table implementation is not in scope
      return [];
    } catch (error) {
      logger.error('Failed to get ticket timeline', {
        ticketId,
        error: (error as Error).message
      });
      throw error;
    }
  }

  /**
   * Add timeline entry
   */
  private async addTimelineEntry(
    ticketId: string, 
    entry: Omit<TicketTimeline, 'id' | 'ticketId'>
  ): Promise<void> {
    try {
      // Timeline entry implementation would go here
      // For now, just log the entry
      logger.info('Timeline entry added', {
        ticketId,
        action: entry.action,
        description: entry.description,
        performedBy: entry.performedBy
      });
    } catch (error) {
      logger.error('Failed to add timeline entry', {
        ticketId,
        entry,
        error: (error as Error).message
      });
      // Don't throw error for timeline failures
    }
  }

  /**
   * Calculate SLA deadline based on customer tier and priority
   */
  private calculateSLADeadline(ticket: TicketEntity): void {
    const now = new Date();
    let deadlineMinutes: number;

    // Base SLA times by customer tier (in minutes)
    const baseSLATimes = {
      enterprise: 240,  // 4 hours
      premium: 480,     // 8 hours
      basic: 1440       // 24 hours
    };

    // Priority multipliers
    const priorityMultipliers = {
      critical: 0.25,   // 25% of base time
      high: 0.5,        // 50% of base time
      medium: 1.0,      // 100% of base time
      low: 2.0          // 200% of base time
    };

    const baseTime = baseSLATimes[ticket.customerTier] || baseSLATimes.basic;
    const multiplier = priorityMultipliers[ticket.priority] || priorityMultipliers.medium;
    
    deadlineMinutes = Math.floor(baseTime * multiplier);

    ticket.slaDeadline = new Date(now.getTime() + deadlineMinutes * 60 * 1000);
  }
}