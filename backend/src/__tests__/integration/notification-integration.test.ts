import request from 'supertest';
import { Server } from 'http';
import { createApp } from '../../index';
import { NotificationService } from '../../services/NotificationService';
import nock from 'nock';

describe('Integration: Slack and Teams Notification Delivery', () => {
  let app: any;
  let server: Server;
  let authToken: string;
  let notificationService: NotificationService;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.SLACK_BOT_TOKEN = 'xoxb-test-token';
    process.env.SLACK_WEBHOOK_URL = 'https://hooks.slack.com/test';
    process.env.TEAMS_WEBHOOK_URL = 'https://outlook.office.com/webhook/test';
    
    app = createApp();
    server = app.listen(0);
    
    const loginResponse = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'test.manager@example.com',
        password: 'testpassword123'
      });
    
    authToken = loginResponse.body.token;
    notificationService = new NotificationService();
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

  describe('Slack Integration', () => {
    it('should send Slack notifications for critical tickets', async () => {
      // Mock Slack API
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .reply(200, {
          ok: true,
          channel: 'C1234567890',
          ts: '1234567890.123456',
          message: {
            text: 'Critical ticket alert',
            user: 'U1234567890'
          }
        });

      // Create critical ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Production server down',
          description: 'Main production server is not responding',
          customerId: 'critical-customer-001',
          priority: 'Critical',
          category: 'Infrastructure'
        })
        .expect(201);

      // Wait for notification processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify notification was sent
      const notificationResponse = await request(app)
        .get(`/api/notifications/ticket/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const slackNotifications = notificationResponse.body.filter(
        (notif: any) => notif.channel === 'slack'
      );

      expect(slackNotifications.length).toBeGreaterThan(0);
      expect(slackNotifications[0].status).toBe('delivered');
      expect(slackNotifications[0].deliveredAt).toBeDefined();
    });

    it('should format Slack messages with rich content', async () => {
      let capturedMessage: any;

      // Mock Slack API and capture message
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .reply(200, function(uri, requestBody: any) {
          capturedMessage = JSON.parse(requestBody);
          return {
            ok: true,
            channel: 'C1234567890',
            ts: '1234567890.123456'
          };
        });

      // Send test notification
      await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'sla_breach_warning',
          channel: 'slack',
          ticketId: 'test-ticket-001',
          data: {
            ticketTitle: 'Database connection issue',
            priority: 'High',
            timeRemaining: '2 hours',
            assignedTechnician: 'John Doe'
          }
        })
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify message format
      expect(capturedMessage).toBeDefined();
      expect(capturedMessage.blocks).toBeDefined();
      expect(capturedMessage.attachments).toBeDefined();
      
      // Check for rich formatting elements
      const messageText = JSON.stringify(capturedMessage);
      expect(messageText).toContain('Database connection issue');
      expect(messageText).toContain('High');
      expect(messageText).toContain('2 hours');
      expect(messageText).toContain('John Doe');
    });

    it('should handle Slack API rate limiting', async () => {
      // Mock rate limit response
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .reply(429, {
          ok: false,
          error: 'rate_limited',
          headers: {
            'Retry-After': '30'
          }
        });

      // Mock successful retry
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .delay(100)
        .reply(200, {
          ok: true,
          channel: 'C1234567890',
          ts: '1234567890.123456'
        });

      // Send notification
      const notificationResponse = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'ticket_assigned',
          channel: 'slack',
          ticketId: 'rate-limit-test-001',
          data: {
            ticketTitle: 'Rate limit test',
            assignedTechnician: 'Test User'
          }
        })
        .expect(200);

      // Wait for retry processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify notification was eventually delivered
      const deliveryStatus = await request(app)
        .get(`/api/notifications/${notificationResponse.body.notificationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deliveryStatus.body.status).toBe('delivered');
      expect(deliveryStatus.body.retryCount).toBeGreaterThan(0);
    });

    it('should handle Slack webhook failures gracefully', async () => {
      // Mock webhook failure
      nock('https://hooks.slack.com')
        .post('/test')
        .reply(500, {
          error: 'Internal server error'
        });

      // Send webhook notification
      const notificationResponse = await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'system_alert',
          channel: 'slack_webhook',
          data: {
            message: 'System maintenance scheduled',
            severity: 'info'
          }
        })
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify failure was handled
      const deliveryStatus = await request(app)
        .get(`/api/notifications/${notificationResponse.body.notificationId}/status`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(deliveryStatus.body.status).toBe('failed');
      expect(deliveryStatus.body.error).toContain('500');
      expect(deliveryStatus.body.fallbackUsed).toBe(true);
    });

    it('should support Slack interactive components', async () => {
      // Mock Slack API for interactive message
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .reply(200, {
          ok: true,
          channel: 'C1234567890',
          ts: '1234567890.123456'
        });

      // Send interactive notification
      await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'ticket_approval_request',
          channel: 'slack',
          interactive: true,
          ticketId: 'interactive-test-001',
          data: {
            ticketTitle: 'Approval required for server upgrade',
            requestedBy: 'Tech Team',
            estimatedCost: '$5000'
          }
        })
        .expect(200);

      // Simulate button click response
      const interactionResponse = await request(app)
        .post('/api/slack/interactions')
        .send({
          payload: JSON.stringify({
            type: 'block_actions',
            user: { id: 'U1234567890', name: 'manager' },
            actions: [{
              action_id: 'approve_ticket',
              value: 'interactive-test-001'
            }],
            response_url: 'https://hooks.slack.com/actions/test'
          })
        })
        .expect(200);

      expect(interactionResponse.body.processed).toBe(true);

      // Verify ticket was approved
      const ticketResponse = await request(app)
        .get('/api/tickets/interactive-test-001')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(ticketResponse.body.approvalStatus).toBe('approved');
    });
  });

  describe('Microsoft Teams Integration', () => {
    it('should send Teams notifications for escalated tickets', async () => {
      // Mock Teams webhook
      nock('https://outlook.office.com')
        .post('/webhook/test')
        .reply(200, 'OK');

      // Create and escalate ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Network outage affecting multiple sites',
          description: 'Wide area network connectivity issues',
          customerId: 'enterprise-customer-001',
          priority: 'Critical',
          category: 'Network'
        })
        .expect(201);

      const ticketId = ticketResponse.body.id;

      // Escalate ticket
      await request(app)
        .post(`/api/tickets/${ticketId}/escalate`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          escalationLevel: 2,
          reason: 'Multiple sites affected'
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
      expect(teamsNotifications[0].status).toBe('delivered');
    });

    it('should format Teams messages with adaptive cards', async () => {
      let capturedMessage: any;

      // Mock Teams webhook and capture message
      nock('https://outlook.office.com')
        .post('/webhook/test')
        .reply(200, function(uri, requestBody: any) {
          capturedMessage = requestBody;
          return 'OK';
        });

      // Send Teams notification
      await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'sla_breach_alert',
          channel: 'teams',
          ticketId: 'teams-format-test-001',
          data: {
            ticketTitle: 'Email server maintenance',
            priority: 'High',
            breachTime: '30 minutes',
            assignedTechnician: 'Jane Smith'
          }
        })
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify adaptive card format
      expect(capturedMessage).toBeDefined();
      expect(capturedMessage.type).toBe('message');
      expect(capturedMessage.attachments).toBeDefined();
      expect(capturedMessage.attachments[0].contentType).toBe('application/vnd.microsoft.card.adaptive');
      
      const cardContent = capturedMessage.attachments[0].content;
      expect(cardContent.type).toBe('AdaptiveCard');
      expect(cardContent.body).toBeDefined();
      
      // Check for content elements
      const cardText = JSON.stringify(cardContent);
      expect(cardText).toContain('Email server maintenance');
      expect(cardText).toContain('High');
      expect(cardText).toContain('30 minutes');
      expect(cardText).toContain('Jane Smith');
    });

    it('should handle Teams webhook authentication', async () => {
      // Mock Teams webhook with authentication
      nock('https://outlook.office.com')
        .post('/webhook/test')
        .matchHeader('authorization', /Bearer .+/)
        .reply(200, 'OK');

      // Send authenticated notification
      await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'security_alert',
          channel: 'teams',
          requireAuth: true,
          data: {
            alertType: 'Suspicious login detected',
            severity: 'High',
            affectedUser: 'user@company.com'
          }
        })
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));
    });

    it('should support Teams bot interactions', async () => {
      // Mock Teams bot framework
      nock('https://smba.trafficmanager.net')
        .post('/apis/v3/conversations/conv123/activities')
        .reply(200, {
          id: 'activity123'
        });

      // Send bot message
      const botResponse = await request(app)
        .post('/api/teams/bot/message')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          conversationId: 'conv123',
          message: 'show my assigned tickets',
          userId: 'teams-user-001'
        })
        .expect(200);

      expect(botResponse.body.response).toBeDefined();
      expect(botResponse.body.activityId).toBe('activity123');

      // Verify bot processed the command
      expect(botResponse.body.response).toContain('assigned tickets');
    });
  });

  describe('Email Fallback Integration', () => {
    it('should send email notifications when primary channels fail', async () => {
      // Mock Slack failure
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .reply(500, {
          ok: false,
          error: 'internal_error'
        });

      // Mock email service success
      nock('https://api.sendgrid.com')
        .post('/v3/mail/send')
        .reply(202, {
          message: 'Queued. Thank you.'
        });

      // Create high priority ticket
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Critical system failure',
          description: 'Database cluster is down',
          customerId: 'critical-customer-002',
          priority: 'Critical',
          category: 'Database'
        })
        .expect(201);

      // Wait for notification processing and fallback
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Verify fallback email was sent
      const notificationResponse = await request(app)
        .get(`/api/notifications/ticket/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const emailNotifications = notificationResponse.body.filter(
        (notif: any) => notif.channel === 'email' && notif.isFallback === true
      );

      expect(emailNotifications.length).toBeGreaterThan(0);
      expect(emailNotifications[0].status).toBe('delivered');
    });

    it('should include all relevant information in fallback emails', async () => {
      let capturedEmail: any;

      // Mock email service and capture content
      nock('https://api.sendgrid.com')
        .post('/v3/mail/send')
        .reply(202, function(uri, requestBody: any) {
          capturedEmail = requestBody;
          return { message: 'Queued. Thank you.' };
        });

      // Force email fallback
      await request(app)
        .post('/api/notifications/send')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          type: 'sla_breach_imminent',
          channel: 'email',
          isFallback: true,
          ticketId: 'email-fallback-test-001',
          data: {
            ticketTitle: 'Server maintenance overdue',
            priority: 'Critical',
            timeRemaining: '15 minutes',
            assignedTechnician: 'Emergency Team',
            customerName: 'Important Client Corp',
            ticketUrl: 'https://platform.company.com/tickets/email-fallback-test-001'
          }
        })
        .expect(200);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Verify email content
      expect(capturedEmail).toBeDefined();
      expect(capturedEmail.personalizations[0].to[0].email).toBeDefined();
      expect(capturedEmail.subject).toContain('SLA Breach Alert');
      
      const emailContent = capturedEmail.content[0].value;
      expect(emailContent).toContain('Server maintenance overdue');
      expect(emailContent).toContain('Critical');
      expect(emailContent).toContain('15 minutes');
      expect(emailContent).toContain('Emergency Team');
      expect(emailContent).toContain('Important Client Corp');
      expect(emailContent).toContain('https://platform.company.com/tickets/email-fallback-test-001');
    });
  });

  describe('Notification Preferences and Routing', () => {
    it('should respect user notification preferences', async () => {
      const userId = 'pref-test-user-001';

      // Set notification preferences
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
          types: {
            ticket_assigned: true,
            sla_breach: true,
            escalation: true,
            resolution: false
          }
        })
        .expect(200);

      // Mock Slack success
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .reply(200, { ok: true, ts: '123456' });

      // Create ticket and assign to user
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Preference test ticket',
          description: 'Testing notification preferences',
          customerId: 'pref-customer-001',
          priority: 'High',
          category: 'General',
          assignedTechnicianId: userId
        })
        .expect(201);

      // Wait for notification processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify notifications were sent according to preferences
      const notificationResponse = await request(app)
        .get(`/api/notifications/ticket/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const slackNotifs = notificationResponse.body.filter((n: any) => n.channel === 'slack');
      const teamsNotifs = notificationResponse.body.filter((n: any) => n.channel === 'teams');

      expect(slackNotifs.length).toBeGreaterThan(0); // Slack enabled
      expect(teamsNotifs.length).toBe(0); // Teams disabled
    });

    it('should handle quiet hours preferences', async () => {
      const userId = 'quiet-hours-user-001';

      // Set quiet hours (assuming current time is within quiet hours for test)
      await request(app)
        .put(`/api/notification-preferences/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00',
            timezone: 'UTC'
          },
          channels: {
            slack: true,
            email: true
          }
        })
        .expect(200);

      // Create ticket during quiet hours
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Quiet hours test ticket',
          description: 'Testing quiet hours functionality',
          customerId: 'quiet-customer-001',
          priority: 'Medium', // Non-critical priority
          category: 'General',
          assignedTechnicianId: userId
        })
        .expect(201);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify notifications were queued instead of sent immediately
      const queueResponse = await request(app)
        .get(`/api/notifications/queue/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const queuedNotifications = queueResponse.body.filter(
        (n: any) => n.ticketId === ticketResponse.body.id
      );

      expect(queuedNotifications.length).toBeGreaterThan(0);
      expect(queuedNotifications[0].scheduledFor).toBeDefined();
    });

    it('should override quiet hours for critical alerts', async () => {
      const userId = 'critical-override-user-001';

      // Set quiet hours
      await request(app)
        .put(`/api/notification-preferences/${userId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          quietHours: {
            enabled: true,
            start: '22:00',
            end: '08:00',
            allowCritical: true
          },
          channels: {
            slack: true
          }
        })
        .expect(200);

      // Mock Slack success
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .reply(200, { ok: true, ts: '123456' });

      // Create critical ticket during quiet hours
      const ticketResponse = await request(app)
        .post('/api/tickets')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          title: 'Critical system outage',
          description: 'Production system completely down',
          customerId: 'critical-customer-001',
          priority: 'Critical',
          category: 'System',
          assignedTechnicianId: userId
        })
        .expect(201);

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Verify critical notification was sent immediately
      const notificationResponse = await request(app)
        .get(`/api/notifications/ticket/${ticketResponse.body.id}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      const immediateNotifications = notificationResponse.body.filter(
        (n: any) => n.status === 'delivered' && !n.wasQueued
      );

      expect(immediateNotifications.length).toBeGreaterThan(0);
    });
  });

  describe('Notification Analytics and Monitoring', () => {
    it('should track notification delivery metrics', async () => {
      // Get initial metrics
      const initialMetrics = await request(app)
        .get('/api/notifications/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Mock successful deliveries
      nock('https://slack.com')
        .post('/api/chat.postMessage')
        .times(3)
        .reply(200, { ok: true, ts: '123456' });

      // Send multiple notifications
      for (let i = 0; i < 3; i++) {
        await request(app)
          .post('/api/notifications/send')
          .set('Authorization', `Bearer ${authToken}`)
          .send({
            type: 'test_notification',
            channel: 'slack',
            data: { message: `Test ${i}` }
          })
          .expect(200);
      }

      // Wait for processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Get updated metrics
      const updatedMetrics = await request(app)
        .get('/api/notifications/metrics')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(updatedMetrics.body.totalSent).toBeGreaterThan(initialMetrics.body.totalSent);
      expect(updatedMetrics.body.deliveryRate).toBeGreaterThan(0);
      expect(updatedMetrics.body.channelStats.slack.sent).toBeGreaterThan(0);
    });

    it('should monitor notification performance', async () => {
      // Get performance metrics
      const performanceResponse = await request(app)
        .get('/api/notifications/performance')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(performanceResponse.body).toHaveProperty('averageDeliveryTime');
      expect(performanceResponse.body).toHaveProperty('channelPerformance');
      expect(performanceResponse.body).toHaveProperty('failureRate');
      expect(performanceResponse.body).toHaveProperty('retryRate');

      expect(performanceResponse.body.averageDeliveryTime).toBeGreaterThan(0);
      expect(performanceResponse.body.failureRate).toBeGreaterThanOrEqual(0);
      expect(performanceResponse.body.failureRate).toBeLessThanOrEqual(1);
    });
  });
});