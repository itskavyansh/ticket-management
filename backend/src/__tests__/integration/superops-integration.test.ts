import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../index';
import { SuperOpsService } from '../../services/SuperOpsService';
import { SuperOpsSyncService } from '../../services/SuperOpsSyncService';
import nock from 'nock';

describe('Integration: SuperOps API Integration', () => {
  let app: any;
  let server: Server;
  let authToken: string;
  let superOpsService: SuperOpsService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SUPEROPS_API_URL = 'https://api.superops.test';
    process.env.SUPEROPS_API_KEY = 'test-api-key';
    
    app = createApp();
    server = app.listen(0);
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test.admin@example.com',
        password: 'testpassword123'
      });
    
    authToken = loginResponse.body.token;
    superOpsService = new SuperOpsService();
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

  describe('SuperOps API Client Integration', () => {
    it('should authenticate with SuperOps API successfully', async () => {
      // Mock SuperOps authentication endpoint
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, {
          access_token: 'mock-access-token',
          token_type: 'Bearer',
          expires_in: 3600
        });

      const authResult = await superOpsService.authenticate();
      
      expect(authResult).toBe(true);
      expect(superOpsService.isAuthenticated()).toBe(true);
    });

    it('should handle authentication failures gracefully', async () => {
      // Mock authentication failure
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(401, {
          error: 'invalid_credentials',
          error_description: 'Invalid API key'
        });

      const authResult = await superOpsService.authenticate();
      
      expect(authResult).toBe(false);
      expect(superOpsService.isAuthenticated()).toBe(false);
    });

    it('should fetch tickets from SuperOps API', async () => {
      const mockTickets = [
        {
          id: 'SO-12345',
          subject: 'Email server down',
          description: 'Users cannot access email',
          status: 'Open',
          priority: 'High',
          customer_id: 'CUST-001',
          technician_id: 'TECH-001',
          created_at: '2024-01-15T10:00:00Z',
          updated_at: '2024-01-15T10:30:00Z'
        },
        {
          id: 'SO-12346',
          subject: 'Printer not working',
          description: 'Office printer showing error',
          status: 'In Progress',
          priority: 'Medium',
          customer_id: 'CUST-002',
          technician_id: 'TECH-002',
          created_at: '2024-01-15T11:00:00Z',
          updated_at: '2024-01-15T11:15:00Z'
        }
      ];

      // Mock authentication
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      // Mock tickets endpoint
      nock('https://api.superops.test')
        .get('/tickets')
        .query({ limit: 100, offset: 0 })
        .reply(200, {
          tickets: mockTickets,
          total: 2,
          has_more: false
        });

      await superOpsService.authenticate();
      const tickets = await superOpsService.fetchTickets();

      expect(Array.isArray(tickets)).toBe(true);
      expect(tickets.length).toBe(2);
      expect(tickets[0].id).toBe('SO-12345');
      expect(tickets[1].id).toBe('SO-12346');
    });

    it('should handle API rate limiting', async () => {
      // Mock rate limit response
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get('/tickets')
        .reply(429, {
          error: 'rate_limit_exceeded',
          retry_after: 60
        });

      await superOpsService.authenticate();
      
      try {
        await superOpsService.fetchTickets();
        fail('Should have thrown rate limit error');
      } catch (error: any) {
        expect(error.message).toContain('rate limit');
      }
    });

    it('should update ticket status in SuperOps', async () => {
      const ticketId = 'SO-12345';
      const updateData = {
        status: 'Resolved',
        resolution: 'Restarted email service'
      };

      // Mock authentication
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      // Mock ticket update
      nock('https://api.superops.test')
        .put(`/tickets/${ticketId}`)
        .reply(200, {
          id: ticketId,
          status: 'Resolved',
          resolution: 'Restarted email service',
          updated_at: new Date().toISOString()
        });

      await superOpsService.authenticate();
      const result = await superOpsService.updateTicket(ticketId, updateData);

      expect(result.status).toBe('Resolved');
      expect(result.resolution).toBe('Restarted email service');
    });
  });

  describe('Bidirectional Synchronization', () => {
    it('should sync new tickets from SuperOps to internal system', async () => {
      const mockSuperOpsTicket = {
        id: 'SO-SYNC-001',
        subject: 'New sync test ticket',
        description: 'Testing synchronization from SuperOps',
        status: 'Open',
        priority: 'Medium',
        customer_id: 'CUST-SYNC-001',
        created_at: '2024-01-15T12:00:00Z'
      };

      // Mock SuperOps API responses
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get('/tickets')
        .query({ updated_since: /.+/ })
        .reply(200, {
          tickets: [mockSuperOpsTicket],
          total: 1,
          has_more: false
        });

      // Trigger sync
      const syncResponse = await request(app)
        .post('/api/superops/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncResponse.body.syncedTickets).toBe(1);

      // Verify ticket was created in internal system
      const ticketsResponse = await request(app)
        .get('/api/tickets')
        .query({ externalId: 'SO-SYNC-001' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(ticketsResponse.body.tickets.length).toBe(1);
      expect(ticketsResponse.body.tickets[0].externalId).toBe('SO-SYNC-001');
      expect(ticketsResponse.body.tickets[0].title).toBe('New sync test ticket');
    });

    it('should sync ticket updates from internal system to SuperOps', async () => {
      // Create ticket in internal system
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Internal ticket for sync',
          description: 'Testing sync to SuperOps',
          customerId: 'test-customer-sync-001',
          priority: 'High',
          category: 'Network',
          externalId: 'SO-SYNC-002'
        })
        .expect(201);

      const ticketId = ticketResponse.body.id;

      // Mock SuperOps update endpoint
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .put('/tickets/SO-SYNC-002')
        .reply(200, {
          id: 'SO-SYNC-002',
          status: 'In Progress',
          updated_at: new Date().toISOString()
        });

      // Update ticket status
      await request(app)
        .put(`/api/tickets/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          status: 'In Progress',
          notes: 'Started working on the issue'
        })
        .expect(200);

      // Wait for sync to complete
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify sync was successful
      const syncStatusResponse = await request(app)
        .get(`/api/tickets/${ticketId}/sync-status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncStatusResponse.body.lastSyncedAt).toBeDefined();
      expect(syncStatusResponse.body.syncStatus).toBe('success');
    });

    it('should handle sync conflicts gracefully', async () => {
      const conflictTicketId = 'SO-CONFLICT-001';

      // Create ticket in internal system
      const internalTicketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Conflict test ticket',
          description: 'Testing conflict resolution',
          customerId: 'test-customer-conflict-001',
          priority: 'Medium',
          category: 'Software',
          externalId: conflictTicketId,
          status: 'In Progress'
        })
        .expect(201);

      // Mock SuperOps ticket with different status
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get(`/tickets/${conflictTicketId}`)
        .reply(200, {
          id: conflictTicketId,
          status: 'Resolved',
          resolution: 'Fixed by SuperOps user',
          updated_at: new Date().toISOString()
        });

      // Trigger conflict detection
      const conflictResponse = await request(app)
        .post('/api/superops/detect-conflicts')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ ticketIds: [internalTicketResponse.body.id] })
        .expect(200);

      expect(conflictResponse.body.conflicts.length).toBe(1);
      expect(conflictResponse.body.conflicts[0].ticketId).toBe(internalTicketResponse.body.id);
      expect(conflictResponse.body.conflicts[0].conflictType).toBe('status_mismatch');

      // Resolve conflict by choosing SuperOps version
      await request(app)
        .post('/api/superops/resolve-conflict')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          ticketId: internalTicketResponse.body.id,
          resolution: 'use_external',
          externalData: {
            status: 'Resolved',
            resolution: 'Fixed by SuperOps user'
          }
        })
        .expect(200);

      // Verify conflict was resolved
      const updatedTicketResponse = await request(app)
        .get(`/api/tickets/${internalTicketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedTicketResponse.body.status).toBe('Resolved');
      expect(updatedTicketResponse.body.resolution).toBe('Fixed by SuperOps user');
    });
  });

  describe('Webhook Integration', () => {
    it('should process SuperOps webhook notifications', async () => {
      const webhookPayload = {
        event: 'ticket.updated',
        ticket: {
          id: 'SO-WEBHOOK-001',
          subject: 'Webhook test ticket',
          status: 'Resolved',
          priority: 'High',
          updated_at: new Date().toISOString()
        },
        timestamp: new Date().toISOString()
      };

      // Send webhook
      const webhookResponse = await request(app)
        .post('/api/superops/webhook')
        .set('X-SuperOps-Signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.processed).toBe(true);

      // Verify ticket was updated
      const ticketResponse = await request(app)
        .get('/api/tickets')
        .query({ externalId: 'SO-WEBHOOK-001' })
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (ticketResponse.body.tickets.length > 0) {
        expect(ticketResponse.body.tickets[0].status).toBe('Resolved');
      }
    });

    it('should validate webhook signatures', async () => {
      const webhookPayload = {
        event: 'ticket.created',
        ticket: {
          id: 'SO-INVALID-001',
          subject: 'Invalid signature test'
        }
      };

      // Send webhook with invalid signature
      const webhookResponse = await request(app)
        .post('/api/superops/webhook')
        .set('X-SuperOps-Signature', 'invalid-signature')
        .send(webhookPayload)
        .expect(401);

      expect(webhookResponse.body.error).toContain('Invalid signature');
    });

    it('should handle webhook delivery failures', async () => {
      const webhookPayload = {
        event: 'ticket.deleted',
        ticket: {
          id: 'SO-NONEXISTENT-001'
        }
      };

      // Send webhook for non-existent ticket
      const webhookResponse = await request(app)
        .post('/api/superops/webhook')
        .set('X-SuperOps-Signature', 'valid-signature')
        .send(webhookPayload)
        .expect(200);

      expect(webhookResponse.body.processed).toBe(false);
      expect(webhookResponse.body.reason).toContain('not found');
    });
  });

  describe('Data Mapping and Transformation', () => {
    it('should map SuperOps fields to internal data model correctly', async () => {
      const superOpsTicket = {
        id: 'SO-MAP-001',
        subject: 'Mapping test ticket',
        description: 'Testing field mapping',
        status: 'open',
        priority: 'high',
        category: 'hardware_issue',
        customer_id: 'CUST-MAP-001',
        technician_id: 'TECH-MAP-001',
        created_at: '2024-01-15T14:00:00Z',
        updated_at: '2024-01-15T14:30:00Z',
        custom_fields: {
          sla_tier: 'premium',
          business_impact: 'critical'
        }
      };

      // Mock SuperOps API
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get('/tickets/SO-MAP-001')
        .reply(200, superOpsTicket);

      // Test data mapping
      const mappingResponse = await request(app)
        .post('/api/superops/map-ticket')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ externalId: 'SO-MAP-001' })
        .expect(200);

      const mappedTicket = mappingResponse.body;

      expect(mappedTicket.title).toBe('Mapping test ticket');
      expect(mappedTicket.description).toBe('Testing field mapping');
      expect(mappedTicket.status).toBe('Open'); // Normalized from 'open'
      expect(mappedTicket.priority).toBe('High'); // Normalized from 'high'
      expect(mappedTicket.category).toBe('Hardware'); // Mapped from 'hardware_issue'
      expect(mappedTicket.customerId).toBe('CUST-MAP-001');
      expect(mappedTicket.assignedTechnicianId).toBe('TECH-MAP-001');
      expect(mappedTicket.slaTier).toBe('premium');
      expect(mappedTicket.businessImpact).toBe('critical');
    });

    it('should handle missing or invalid field values', async () => {
      const incompleteTicket = {
        id: 'SO-INCOMPLETE-001',
        subject: 'Incomplete ticket',
        // Missing description, status, priority
        customer_id: 'CUST-INC-001'
      };

      // Mock SuperOps API
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get('/tickets/SO-INCOMPLETE-001')
        .reply(200, incompleteTicket);

      // Test mapping with defaults
      const mappingResponse = await request(app)
        .post('/api/superops/map-ticket')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ externalId: 'SO-INCOMPLETE-001' })
        .expect(200);

      const mappedTicket = mappingResponse.body;

      expect(mappedTicket.title).toBe('Incomplete ticket');
      expect(mappedTicket.description).toBe(''); // Default empty description
      expect(mappedTicket.status).toBe('Open'); // Default status
      expect(mappedTicket.priority).toBe('Medium'); // Default priority
      expect(mappedTicket.category).toBe('General'); // Default category
    });

    it('should validate mapped data before saving', async () => {
      const invalidTicket = {
        id: 'SO-INVALID-DATA-001',
        subject: '', // Invalid empty subject
        description: 'Valid description',
        status: 'invalid_status',
        priority: 'invalid_priority',
        customer_id: 'INVALID-CUSTOMER'
      };

      // Mock SuperOps API
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get('/tickets/SO-INVALID-DATA-001')
        .reply(200, invalidTicket);

      // Test validation failure
      const mappingResponse = await request(app)
        .post('/api/superops/map-ticket')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ externalId: 'SO-INVALID-DATA-001' })
        .expect(400);

      expect(mappingResponse.body.errors).toBeDefined();
      expect(mappingResponse.body.errors.length).toBeGreaterThan(0);
      expect(mappingResponse.body.errors.some((e: any) => e.field === 'title')).toBe(true);
    });
  });

  describe('Error Handling and Resilience', () => {
    it('should retry failed API calls with exponential backoff', async () => {
      let callCount = 0;

      // Mock multiple failures followed by success
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get('/tickets')
        .times(3)
        .reply(() => {
          callCount++;
          if (callCount < 3) {
            return [500, { error: 'Internal server error' }];
          }
          return [200, { tickets: [], total: 0 }];
        });

      await superOpsService.authenticate();
      const tickets = await superOpsService.fetchTickets();

      expect(callCount).toBe(3);
      expect(Array.isArray(tickets)).toBe(true);
    });

    it('should handle network timeouts gracefully', async () => {
      // Mock timeout
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get('/tickets')
        .delay(30000) // 30 second delay to trigger timeout
        .reply(200, { tickets: [] });

      await superOpsService.authenticate();

      try {
        await superOpsService.fetchTickets();
        fail('Should have thrown timeout error');
      } catch (error: any) {
        expect(error.message).toContain('timeout');
      }
    });

    it('should maintain sync state during partial failures', async () => {
      const tickets = [
        { id: 'SO-PARTIAL-001', subject: 'Valid ticket 1' },
        { id: 'SO-PARTIAL-002', subject: '' }, // Invalid ticket
        { id: 'SO-PARTIAL-003', subject: 'Valid ticket 2' }
      ];

      // Mock SuperOps API
      nock('https://api.superops.test')
        .post('/auth/token')
        .reply(200, { access_token: 'mock-token', token_type: 'Bearer' });

      nock('https://api.superops.test')
        .get('/tickets')
        .reply(200, { tickets, total: 3 });

      // Trigger sync
      const syncResponse = await request(app)
        .post('/api/superops/sync')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncResponse.body.syncedTickets).toBe(2); // Only valid tickets
      expect(syncResponse.body.failedTickets).toBe(1);
      expect(syncResponse.body.errors.length).toBe(1);

      // Verify sync state was maintained
      const syncStateResponse = await request(app)
        .get('/api/superops/sync-state')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(syncStateResponse.body.lastSyncAt).toBeDefined();
      expect(syncStateResponse.body.totalProcessed).toBe(3);
      expect(syncStateResponse.body.successCount).toBe(2);
      expect(syncStateResponse.body.errorCount).toBe(1);
    });
  });
});