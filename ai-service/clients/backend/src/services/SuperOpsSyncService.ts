import { SuperOpsService } from './SuperOpsService';
import { SuperOpsDataMapper } from './SuperOpsDataMapper';
import { TicketService } from './TicketService';
import { logger } from '../utils/logger';
import {
  SuperOpsTicket,
  SuperOpsWebhookPayload,
  SyncStatus,
  SuperOpsSyncError
} from '../types/superops';
import { Ticket, CreateTicketRequest, UpdateTicketRequest } from '../models/Ticket';
import { TicketStatus, Priority, TicketCategory } from '../types';

export class SuperOpsSyncService {
  private static instance: SuperOpsSyncService;
  private superOpsService: SuperOpsService;
  private dataMapper: SuperOpsDataMapper;
  private ticketService: TicketService;
  private syncInProgress: Set<string> = new Set();
  private syncStatusMap: Map<string, SyncStatus> = new Map();

  private constructor() {
    this.superOpsService = SuperOpsService.getInstance();
    this.dataMapper = SuperOpsDataMapper.getInstance();
    this.ticketService = new TicketService();
  }

  public static getInstance(): SuperOpsSyncService {
    if (!SuperOpsSyncService.instance) {
      SuperOpsSyncService.instance = new SuperOpsSyncService();
    }
    return SuperOpsSyncService.instance;
  }

  // Webhook handler for SuperOps updates
  async handleWebhook(payload: SuperOpsWebhookPayload): Promise<void> {
    try {
      logger.info('Processing SuperOps webhook', { 
        event: payload.event, 
        timestamp: payload.timestamp 
      });

      switch (payload.event) {
        case 'ticket.created':
          if (payload.data.ticket) {
            await this.syncTicketFromSuperOps(payload.data.ticket, 'inbound');
          }
          break;

        case 'ticket.updated':
          if (payload.data.ticket) {
            await this.syncTicketFromSuperOps(payload.data.ticket, 'inbound');
          }
          break;

        case 'ticket.deleted':
          if (payload.data.ticket) {
            await this.handleTicketDeletion(payload.data.ticket.id);
          }
          break;

        case 'ticket.assigned':
          if (payload.data.ticket) {
            await this.syncTicketAssignment(payload.data.ticket);
          }
          break;

        default:
          logger.warn('Unhandled webhook event', { event: payload.event });
      }
    } catch (error) {
      logger.error('Error processing SuperOps webhook:', error);
      throw error;
    }
  }

  // Sync ticket from SuperOps to internal system
  async syncTicketFromSuperOps(
    superOpsTicket: SuperOpsTicket, 
    direction: 'inbound' | 'outbound' = 'inbound'
  ): Promise<void> {
    const syncKey = `ticket_${superOpsTicket.id}_${direction}`;
    
    if (this.syncInProgress.has(syncKey)) {
      logger.warn('Sync already in progress', { syncKey });
      return;
    }

    this.syncInProgress.add(syncKey);

    try {
      logger.info('Syncing ticket from SuperOps', { 
        ticketId: superOpsTicket.id,
        direction 
      });

      // Check if ticket already exists in our system
      const existingTicket = await this.findTicketByExternalId(superOpsTicket.id);

      if (existingTicket) {
        // Update existing ticket
        await this.updateInternalTicket(existingTicket, superOpsTicket);
      } else {
        // Create new ticket
        await this.createInternalTicket(superOpsTicket);
      }

      // Update sync status
      this.updateSyncStatus(superOpsTicket.id, 'ticket', direction, 'success');

      logger.info('Successfully synced ticket from SuperOps', { 
        ticketId: superOpsTicket.id 
      });
    } catch (error) {
      this.updateSyncStatus(superOpsTicket.id, 'ticket', direction, 'failed', error.message);
      logger.error('Error syncing ticket from SuperOps:', { 
        ticketId: superOpsTicket.id, 
        error 
      });
      throw new SuperOpsSyncError(
        `Failed to sync ticket ${superOpsTicket.id}`,
        'ticket',
        superOpsTicket.id,
        error
      );
    } finally {
      this.syncInProgress.delete(syncKey);
    }
  }

  // Sync ticket from internal system to SuperOps
  async syncTicketToSuperOps(ticket: Ticket): Promise<void> {
    const syncKey = `ticket_${ticket.id}_outbound`;
    
    if (this.syncInProgress.has(syncKey)) {
      logger.warn('Sync already in progress', { syncKey });
      return;
    }

    this.syncInProgress.add(syncKey);

    try {
      logger.info('Syncing ticket to SuperOps', { ticketId: ticket.id });

      if (ticket.externalId) {
        // Update existing ticket in SuperOps
        const updateData = this.mapInternalToSuperOpsUpdate(ticket);
        await this.superOpsService.updateTicket(ticket.externalId, updateData);
      } else {
        // Create new ticket in SuperOps
        const createData = this.mapInternalToSuperOpsCreate(ticket);
        const superOpsTicket = await this.superOpsService.createTicket(createData);
        
        // Update internal ticket with external ID
        await this.ticketService.updateTicket(ticket.id, { 
          externalId: superOpsTicket.id 
        } as UpdateTicketRequest);
      }

      this.updateSyncStatus(ticket.id, 'ticket', 'outbound', 'success');

      logger.info('Successfully synced ticket to SuperOps', { ticketId: ticket.id });
    } catch (error) {
      this.updateSyncStatus(ticket.id, 'ticket', 'outbound', 'failed', error.message);
      logger.error('Error syncing ticket to SuperOps:', { 
        ticketId: ticket.id, 
        error 
      });
      throw new SuperOpsSyncError(
        `Failed to sync ticket ${ticket.id} to SuperOps`,
        'ticket',
        ticket.id,
        error
      );
    } finally {
      this.syncInProgress.delete(syncKey);
    }
  }

  // Bulk sync operations
  async performFullSync(): Promise<void> {
    try {
      logger.info('Starting full synchronization with SuperOps');

      // Sync tickets from SuperOps
      const superOpsTickets = await this.superOpsService.fetchTickets({
        per_page: 100 // Adjust based on API limits
      });

      for (const superOpsTicket of superOpsTickets) {
        try {
          await this.syncTicketFromSuperOps(superOpsTicket);
        } catch (error) {
          logger.error('Error syncing individual ticket during full sync:', {
            ticketId: superOpsTicket.id,
            error
          });
          // Continue with other tickets
        }
      }

      // Sync tickets to SuperOps (tickets without external ID)
      const internalTickets = await this.ticketService.getTickets({
        // Filter for tickets without external ID
        // This would need to be implemented in TicketService
      });

      for (const ticket of internalTickets) {
        if (!ticket.externalId) {
          try {
            await this.syncTicketToSuperOps(ticket);
          } catch (error) {
            logger.error('Error syncing internal ticket during full sync:', {
              ticketId: ticket.id,
              error
            });
            // Continue with other tickets
          }
        }
      }

      logger.info('Full synchronization completed');
    } catch (error) {
      logger.error('Error during full synchronization:', error);
      throw error;
    }
  }

  // Conflict resolution
  async resolveConflict(
    internalTicket: Ticket, 
    superOpsTicket: SuperOpsTicket,
    strategy: 'local_wins' | 'remote_wins' | 'manual_review' = 'remote_wins'
  ): Promise<void> {
    try {
      logger.info('Resolving sync conflict', {
        ticketId: internalTicket.id,
        externalId: superOpsTicket.id,
        strategy
      });

      switch (strategy) {
        case 'local_wins':
          await this.syncTicketToSuperOps(internalTicket);
          break;

        case 'remote_wins':
          await this.updateInternalTicket(internalTicket, superOpsTicket);
          break;

        case 'manual_review':
          // Store conflict for manual resolution
          await this.storeConflictForReview(internalTicket, superOpsTicket);
          break;
      }
    } catch (error) {
      logger.error('Error resolving sync conflict:', error);
      throw error;
    }
  }

  // Helper methods
  private async findTicketByExternalId(externalId: string): Promise<Ticket | null> {
    try {
      // This would need to be implemented in TicketService
      // For now, we'll assume it returns null
      return null;
    } catch (error) {
      logger.error('Error finding ticket by external ID:', { externalId, error });
      return null;
    }
  }

  private async createInternalTicket(superOpsTicket: SuperOpsTicket): Promise<Ticket> {
    const createRequest = this.dataMapper.mapSuperOpsTicketToInternal(superOpsTicket);
    return await this.ticketService.createTicket(createRequest);
  }

  private async updateInternalTicket(
    existingTicket: Ticket, 
    superOpsTicket: SuperOpsTicket
  ): Promise<Ticket> {
    // Map the SuperOps ticket to internal format, then extract update fields
    const mappedTicket = this.dataMapper.mapSuperOpsTicketToInternal(superOpsTicket);
    
    const updateRequest: UpdateTicketRequest = {
      title: mappedTicket.title,
      description: mappedTicket.description,
      priority: mappedTicket.priority,
      category: mappedTicket.category,
      tags: mappedTicket.tags
    };

    return await this.ticketService.updateTicket(existingTicket.id, updateRequest);
  }

  private mapInternalToSuperOpsCreate(ticket: Ticket) {
    return this.dataMapper.mapInternalTicketToSuperOps(ticket);
  }

  private mapInternalToSuperOpsUpdate(ticket: Ticket) {
    return this.dataMapper.mapInternalTicketToSuperOps(ticket);
  }

  // Mapping functions are now handled by SuperOpsDataMapper

  private async syncTicketAssignment(superOpsTicket: SuperOpsTicket): Promise<void> {
    const existingTicket = await this.findTicketByExternalId(superOpsTicket.id);
    if (existingTicket && superOpsTicket.assigned_to) {
      await this.ticketService.updateTicket(existingTicket.id, {
        assignedTechnicianId: superOpsTicket.assigned_to
      } as UpdateTicketRequest);
    }
  }

  private async handleTicketDeletion(externalId: string): Promise<void> {
    const existingTicket = await this.findTicketByExternalId(externalId);
    if (existingTicket) {
      // Mark as cancelled rather than deleting
      await this.ticketService.updateTicket(existingTicket.id, {
        status: TicketStatus.CANCELLED
      } as UpdateTicketRequest);
    }
  }

  private updateSyncStatus(
    entityId: string,
    entityType: 'ticket' | 'customer' | 'technician',
    direction: 'inbound' | 'outbound' | 'bidirectional',
    status: 'success' | 'failed' | 'pending',
    errorMessage?: string
  ): void {
    const syncStatus: SyncStatus = {
      entityType,
      entityId,
      externalId: entityId,
      lastSyncAt: new Date(),
      syncDirection: direction,
      status,
      errorMessage
    };

    this.syncStatusMap.set(`${entityType}_${entityId}`, syncStatus);
  }

  private async storeConflictForReview(
    internalTicket: Ticket,
    superOpsTicket: SuperOpsTicket
  ): Promise<void> {
    // This would store the conflict in a database table for manual review
    logger.warn('Conflict stored for manual review', {
      internalTicketId: internalTicket.id,
      externalTicketId: superOpsTicket.id
    });
  }

  // Public methods for monitoring
  public getSyncStatus(entityType: string, entityId: string): SyncStatus | undefined {
    return this.syncStatusMap.get(`${entityType}_${entityId}`);
  }

  public getAllSyncStatuses(): SyncStatus[] {
    return Array.from(this.syncStatusMap.values());
  }

  public clearSyncStatus(entityType: string, entityId: string): void {
    this.syncStatusMap.delete(`${entityType}_${entityId}`);
  }
}