import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../index';
import { io as Client, Socket } from 'socket.io-client';

describe('E2E: Real-time Notifications and Dashboard Updates', () => {
  let app: any;
  let server: Server;
  let authToken: string;
  let clientSocket: Socket;
  let serverAddress: string;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    app = createApp();
    server = app.listen(0);
    
    const address = server.address();
    if (address && typeof address === 'object') {
      serverAddress = `http://localhost:${address.port}`;
    }

    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test.manager@example.com',
        password: 'testpassword123'
      });
    
    authToken = loginResponse.body.token;
  });

  afterAll(async () => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
    if (server) {
      server.close();
    }
  });

  beforeEach((done) => {
    // Setup WebSocket connection for each test
    clientSocket = Client(serverAddress, {
      auth: {
        token: authToken
      }
    });
    
    clientSocket.on('connect', () => {
      done();
    });
  });

  afterEach(() => {
    if (clientSocket) {
      clientSocket.disconnect();
    }
  });

  describe('Real-time Dashboard Updates', () => {
    it('should receive real-time updates when tickets are created', (done) => {
      let updateReceived = false;

      // Listen for dashboard updates
      clientSocket.on('dashboard:metrics:update', (data) => {
        expect(data).toHaveProperty('openTickets');
        expect(data).toHaveProperty('totalTickets');
        expect(data).toHaveProperty('averageResolutionTime');
        expect(data).toHaveProperty('slaComplianceRate');
        updateReceived = true;
      });

      // Create a new ticket to trigger update
      request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Real-time test ticket',
          description: 'Testing real-time dashboard updates',
          customerId: 'test-customer-realtime-001',
          priority: 'Medium',
          category: 'General'
        })
        .expect(201)
        .end((err) => {
          if (err) return done(err);
          
          // Wait for real-time update
          setTimeout(() => {
            expect(updateReceived).toBe(true);
            done();
          }, 2000);
        });
    });

    it('should receive workload updates when tickets are assigned', (done) => {
      let workloadUpdateReceived = false;
      const technicianId = 'test-technician-realtime-001';

      // Listen for workload updates
      clientSocket.on('workload:update', (data) => {
        expect(data).toHaveProperty('technicianId');
        expect(data).toHaveProperty('currentLoad');
        expect(data).toHaveProperty('utilizationRate');
        expect(data.technicianId).toBe(technicianId);
        workloadUpdateReceived = true;
      });

      // Create and assign ticket
      request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Workload update test',
          description: 'Testing workload real-time updates',
          customerId: 'test-customer-workload-001',
          priority: 'High',
          category: 'Support'
        })
        .expect(201)
        .end((err, res) => {
          if (err) return done(err);

          // Assign the ticket
          request(app)
            .put(`/api/tickets/${res.body.id}/assign`)
            .set('Authorization', `Bearer ${authToken}`)
            .send({ technicianId })
            .expect(200)
            .end((assignErr) => {
              if (assignErr) return done(assignErr);

              setTimeout(() => {
                expect(workloadUpdateReceived).toBe(true);
                done();
              }, 2000);
            });
        });
    });

    it('should receive SLA risk updates in real-time', (done) => {
      let slaUpdateReceived = false;

      // Listen for SLA updates
      clientSocket.on('sla:risk:update', (data) => {
        expect(data).toHaveProperty('ticketId');
        expect(data).toHaveProperty('riskScore');
        expect(data).toHaveProperty('timeRemaining');
        expect(data.riskScore).toBeGreaterThanOrEqual(0);
        expect(data.riskScore).toBeLessThanOrEqual(1);
        slaUpdateReceived = true;
      });

      // Create high-priority ticket that will trigger SLA monitoring
      request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Critical system failure',
          description: 'Production system is completely down',
          customerId: 'enterprise-customer-001',
          priority: 'Critical',
          category: 'System'
        })
        .expect(201)
        .end((err) => {
          if (err) return done(err);

          setTimeout(() => {
            expect(slaUpdateReceived).toBe(true);
            done();
          }, 3000);
        });
    });
  });

  describe('Notification Delivery', () => {
    it('should deliver Slack notifications for high-priority tickets', async () => {
      // Mock Slack API response
      const mockSlackResponse = {
        ok: true,
        channel: 'C1234567890',
        ts: '1234567890.123456'
      };

      // Create high-priority ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Critical server outage',
          description: 'Main application server is not responding',
          customerId: 'premium-customer-001',
          priority: 'Critical',
          category: 'Infrastructure'
        })
        .expect(201);

      // Wait for notification processing
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify notification was sent
      const notificationResponse = await request(app)
        .get(`/api/notifications/ticket/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const slackNotifications = notificationResponse.body.filter(
        (notif: any) => notif.channel === 'slack'
      );

      expect(slackNotifications.length).toBeGreaterThan(0);
      expect(slackNotifications[0]).toHaveProperty('status');
      expect(slackNotifications[0]).toHaveProperty('deliveredAt');
      expect(slackNotifications[0].status).toBe('delivered');
    });

    it('should deliver MS Teams notifications for escalated tickets', async () => {
      // Create ticket and escalate it
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Database connection issues',
          description: 'Multiple applications cannot connect to database',
          customerId: 'enterprise-customer-002',
          priority: 'High',
          category: 'Database'
        })
        .expect(201);

      const ticketId = ticketResponse.body.id;

      // Escalate the ticket
      await request(app)
        .post(`/api/tickets/${ticketId}/escalate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          escalationLevel: 2,
          reason: 'SLA breach imminent'
        })
        .expect(200);

      // Wait for notification processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify Teams notification was sent
      const notificationResponse = await request(app)
        .get(`/api/notifications/ticket/${ticketId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const teamsNotifications = notificationResponse.body.filter(
        (notif: any) => notif.channel === 'teams'
      );

      expect(teamsNotifications.length).toBeGreaterThan(0);
      expect(teamsNotifications[0].type).toBe('escalation');
    });

    it('should handle notification delivery failures gracefully', async () => {
      // Temporarily disable Slack integration to simulate failure
      const originalSlackToken = process.env.SLACK_BOT_TOKEN;
      process.env.SLACK_BOT_TOKEN = 'invalid-token';

      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Test notification failure',
          description: 'Testing notification failure handling',
          customerId: 'test-customer-failure-001',
          priority: 'Critical',
          category: 'Test'
        })
        .expect(201);

      // Wait for notification attempt
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify failure was logged and fallback was used
      const notificationResponse = await request(app)
        .get(`/api/notifications/ticket/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const failedNotifications = notificationResponse.body.filter(
        (notif: any) => notif.status === 'failed'
      );

      const fallbackNotifications = notificationResponse.body.filter(
        (notif: any) => notif.channel === 'email' && notif.isFallback === true
      );

      expect(failedNotifications.length).toBeGreaterThan(0);
      expect(fallbackNotifications.length).toBeGreaterThan(0);

      // Restore original token
      process.env.SLACK_BOT_TOKEN = originalSlackToken;
    });

    it('should respect user notification preferences', async () => {
      const userId = 'test-user-preferences-001';

      // Set user notification preferences
      await request(app)
        .put(`/api/notification-preferences/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          channels: {
            slack: true,
            teams: false,
            email: true
          },
          priorities: {
            critical: true,
            high: true,
            medium: false,
            low: false
          },
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00'
          }
        })
        .expect(200);

      // Create medium priority ticket (should not trigger notification)
      const mediumTicketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Medium priority issue',
          description: 'Non-urgent issue for testing preferences',
          customerId: 'test-customer-prefs-001',
          priority: 'Medium',
          category: 'General',
          assignedTechnicianId: userId
        })
        .expect(201);

      // Create high priority ticket (should trigger notification)
      const highTicketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'High priority issue',
          description: 'Urgent issue for testing preferences',
          customerId: 'test-customer-prefs-002',
          priority: 'High',
          category: 'Urgent',
          assignedTechnicianId: userId
        })
        .expect(201);

      // Wait for notification processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify medium priority ticket did not trigger notifications
      const mediumNotifications = await request(app)
        .get(`/api/notifications/ticket/${mediumTicketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(mediumNotifications.body.length).toBe(0);

      // Verify high priority ticket triggered notifications
      const highNotifications = await request(app)
        .get(`/api/notifications/ticket/${highTicketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(highNotifications.body.length).toBeGreaterThan(0);

      // Verify only preferred channels were used
      const slackNotifs = highNotifications.body.filter((n: any) => n.channel === 'slack');
      const teamsNotifs = highNotifications.body.filter((n: any) => n.channel === 'teams');

      expect(slackNotifs.length).toBeGreaterThan(0);
      expect(teamsNotifs.length).toBe(0);
    });
  });

  describe('Chat Bot Integration', () => {
    it('should respond to Slack bot commands', async () => {
      // Simulate Slack slash command
      const slackCommand = {
        token: process.env.SLACK_VERIFICATION_TOKEN,
        team_id: 'T1234567890',
        team_domain: 'testteam',
        channel_id: 'C1234567890',
        channel_name: 'general',
        user_id: 'U1234567890',
        user_name: 'testuser',
        command: '/ticket',
        text: 'status 12345',
        response_url: 'https://hooks.slack.com/commands/1234/5678'
      };

      const response = await request(app)
        .post('/api/chatbot/slack/command')
        .send(slackCommand)
        .expect(200);

      expect(response.body).toHaveProperty('response_type');
      expect(response.body).toHaveProperty('text');
      expect(response.body.response_type).toBe('ephemeral');
    });

    it('should handle Teams bot interactions', async () => {
      // Simulate Teams bot message
      const teamsMessage = {
        type: 'message',
        id: '1234567890',
        timestamp: new Date().toISOString(),
        from: {
          id: 'user123',
          name: 'Test User'
        },
        conversation: {
          id: 'conv123'
        },
        text: 'show my tickets'
      };

      const response = await request(app)
        .post('/api/chatbot/teams/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send(teamsMessage)
        .expect(200);

      expect(response.body).toHaveProperty('type');
      expect(response.body).toHaveProperty('text');
      expect(response.body.type).toBe('message');
    });

    it('should process natural language queries', async () => {
      // Test various natural language queries
      const queries = [
        'show me all critical tickets',
        'what is the status of ticket 12345',
        'assign ticket 67890 to john',
        'how many tickets are overdue'
      ];

      for (const query of queries) {
        const response = await request(app)
          .post('/api/chatbot/process-query')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            query,
            userId: 'test-user-nlp-001',
            channel: 'slack'
          })
          .expect(200);

        expect(response.body).toHaveProperty('intent');
        expect(response.body).toHaveProperty('response');
        expect(response.body).toHaveProperty('confidence');
        expect(response.body.confidence).toBeGreaterThan(0.5);
      }
    });
  });

  describe('WebSocket Connection Management', () => {
    it('should handle connection authentication', (done) => {
      // Test connection with invalid token
      const invalidSocket = Client(serverAddress, {
        auth: {
          token: 'invalid-token'
        }
      });

      invalidSocket.on('connect_error', (error) => {
        expect(error.message).toContain('Authentication failed');
        invalidSocket.disconnect();
        done();
      });
    });

    it('should handle connection drops and reconnection', (done) => {
      let reconnected = false;

      clientSocket.on('disconnect', () => {
        // Simulate reconnection
        setTimeout(() => {
          clientSocket.connect();
        }, 1000);
      });

      clientSocket.on('connect', () => {
        if (reconnected) {
          done();
        } else {
          reconnected = true;
          // Force disconnect to test reconnection
          clientSocket.disconnect();
        }
      });
    });

    it('should broadcast updates to multiple connected clients', (done) => {
      let client1UpdateReceived = false;
      let client2UpdateReceived = false;

      // Create second client
      const client2 = Client(serverAddress, {
        auth: {
          token: authToken
        }
      });

      client2.on('connect', () => {
        // Listen for updates on both clients
        clientSocket.on('dashboard:metrics:update', () => {
          client1UpdateReceived = true;
          checkCompletion();
        });

        client2.on('dashboard:metrics:update', () => {
          client2UpdateReceived = true;
          checkCompletion();
        });

        // Trigger an update
        request(app)
          .post('/api/tickets')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            title: 'Broadcast test ticket',
            description: 'Testing broadcast to multiple clients',
            customerId: 'test-customer-broadcast-001',
            priority: 'Low',
            category: 'Test'
          })
          .expect(201)
          .end();
      });

      function checkCompletion() {
        if (client1UpdateReceived && client2UpdateReceived) {
          client2.disconnect();
          done();
        }
      }
    });
  });
});