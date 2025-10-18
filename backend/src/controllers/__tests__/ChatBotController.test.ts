import { Request, Response } from 'express';
import { ChatBotController } from '../ChatBotController';
import { chatBotService } from '../../services/ChatBotService';

// Mock dependencies
jest.mock('../../services/ChatBotService');
jest.mock('../../utils/logger');

describe('ChatBotController', () => {
  let controller: ChatBotController;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;

  beforeEach(() => {
    controller = new ChatBotController();
    mockRequest = {
      body: {},
      headers: {}
    };
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };

    // Reset mocks
    jest.clearAllMocks();
  });

  describe('handleSlackEvent', () => {
    it('should handle URL verification challenge', async () => {
      mockRequest.body = {
        type: 'url_verification',
        challenge: 'test_challenge_123'
      };

      await controller.handleSlackEvent(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ challenge: 'test_challenge_123' });
    });

    it('should handle event callbacks', async () => {
      mockRequest.body = {
        type: 'event_callback',
        event: {
          type: 'app_mention',
          user: 'U123456',
          channel: 'C123456',
          text: '<@UBOT123> help',
          ts: '1234567890.123'
        }
      };

      await controller.handleSlackEvent(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true });
    });

    it('should reject invalid event types', async () => {
      mockRequest.body = {
        type: 'invalid_type'
      };

      await controller.handleSlackEvent(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Invalid event type' });
    });

    it('should handle errors gracefully', async () => {
      mockRequest.body = null; // This will cause an error

      await controller.handleSlackEvent(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Internal server error' });
    });
  });

  describe('handleSlackSlashCommand', () => {
    beforeEach(() => {
      // Mock successful verification
      jest.spyOn(controller as any, 'verifySlackRequest').mockReturnValue(true);
      
      // Mock chat bot service response
      (chatBotService.processCommand as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Command processed successfully',
        ephemeral: true
      });
    });

    it('should process valid slash commands', async () => {
      mockRequest.body = {
        token: 'test_token',
        team_id: 'T123456',
        channel_id: 'C123456',
        user_id: 'U123456',
        user_name: 'testuser',
        command: '/ticket',
        text: 'T-123',
        response_url: 'https://hooks.slack.com/commands/123'
      };

      await controller.handleSlackSlashCommand(mockRequest as Request, mockResponse as Response);

      expect(chatBotService.processCommand).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should reject unauthorized requests', async () => {
      jest.spyOn(controller as any, 'verifySlackRequest').mockReturnValue(false);

      await controller.handleSlackSlashCommand(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
      expect(mockResponse.json).toHaveBeenCalledWith({ error: 'Unauthorized' });
    });

    it('should handle service errors', async () => {
      mockRequest.body = {
        user_id: 'U123456',
        channel_id: 'C123456',
        text: 'help'
      };

      (chatBotService.processCommand as jest.Mock).mockRejectedValue(new Error('Service error'));

      await controller.handleSlackSlashCommand(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
      expect(mockResponse.json).toHaveBeenCalledWith({
        text: 'Sorry, something went wrong processing your command.',
        response_type: 'ephemeral'
      });
    });
  });

  describe('handleSlackInteractive', () => {
    beforeEach(() => {
      jest.spyOn(controller as any, 'verifySlackRequest').mockReturnValue(true);
    });

    it('should handle button interactions', async () => {
      mockRequest.body = {
        payload: JSON.stringify({
          type: 'button',
          user: { id: 'U123456' },
          channel: { id: 'C123456' },
          actions: [{ value: 'close_ticket_T-123' }]
        })
      };

      await controller.handleSlackInteractive(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ ok: true });
    });

    it('should handle select menu interactions', async () => {
      mockRequest.body = {
        payload: JSON.stringify({
          type: 'select_menu',
          user: { id: 'U123456' },
          channel: { id: 'C123456' },
          actions: [{ selected_option: { value: 'priority_high' } }]
        })
      };

      await controller.handleSlackInteractive(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should reject unauthorized interactive requests', async () => {
      jest.spyOn(controller as any, 'verifySlackRequest').mockReturnValue(false);

      await controller.handleSlackInteractive(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(401);
    });
  });

  describe('handleTeamsMessage', () => {
    it('should process Teams message activities', async () => {
      mockRequest.body = {
        type: 'message',
        id: 'msg123',
        from: { id: 'user123', name: 'Test User' },
        conversation: { id: 'conv123' },
        text: 'help',
        timestamp: new Date().toISOString()
      };

      (chatBotService.processCommand as jest.Mock).mockResolvedValue({
        success: true,
        message: 'Help information',
        ephemeral: true
      });

      await controller.handleTeamsMessage(mockRequest as Request, mockResponse as Response);

      expect(chatBotService.processCommand).toHaveBeenCalled();
      expect(mockResponse.status).toHaveBeenCalledWith(200);
    });

    it('should ignore non-message activities', async () => {
      mockRequest.body = {
        type: 'typing',
        from: { id: 'user123' }
      };

      await controller.handleTeamsMessage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith({ status: 'ignored' });
    });

    it('should handle Teams service errors', async () => {
      mockRequest.body = {
        type: 'message',
        from: { id: 'user123', name: 'Test User' },
        conversation: { id: 'conv123' },
        text: 'help'
      };

      (chatBotService.processCommand as jest.Mock).mockRejectedValue(new Error('Service error'));

      await controller.handleTeamsMessage(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getBotStatus', () => {
    it('should return bot status information', async () => {
      await controller.getBotStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(mockResponse.json).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'healthy',
          supportedPlatforms: ['slack', 'teams'],
          availableCommands: expect.any(Array)
        })
      );
    });

    it('should handle status errors', async () => {
      // Force an error by mocking Date constructor to throw
      const originalDate = Date;
      global.Date = jest.fn(() => {
        throw new Error('Date error');
      }) as any;

      await controller.getBotStatus(mockRequest as Request, mockResponse as Response);

      expect(mockResponse.status).toHaveBeenCalledWith(500);

      // Restore Date
      global.Date = originalDate;
    });
  });

  describe('response formatting', () => {
    it('should format Slack responses correctly', () => {
      const botResponse = {
        success: true,
        message: 'Test message',
        ephemeral: true,
        attachments: [{
          title: 'Test Attachment',
          text: 'Attachment text',
          color: '#36a64f',
          fields: [{ title: 'Field', value: 'Value', short: true }]
        }]
      };

      const slackResponse = (controller as any).formatSlackResponse(botResponse);

      expect(slackResponse).toEqual({
        text: 'Test message',
        response_type: 'ephemeral',
        attachments: [{
          title: 'Test Attachment',
          text: 'Attachment text',
          color: '#36a64f',
          fields: [{ title: 'Field', value: 'Value', short: true }]
        }]
      });
    });

    it('should format Teams responses correctly', () => {
      const botResponse = {
        success: true,
        message: 'Test message',
        attachments: [{
          title: 'Test Attachment',
          fields: [{ title: 'Field', value: 'Value' }]
        }]
      };

      const teamsResponse = (controller as any).formatTeamsResponse(botResponse);

      expect(teamsResponse).toEqual({
        type: 'message',
        text: 'Test message',
        attachments: expect.any(Array)
      });
    });
  });

  describe('webhook verification', () => {
    beforeEach(() => {
      process.env.SLACK_SIGNING_SECRET = 'test_secret';
    });

    afterEach(() => {
      delete process.env.SLACK_SIGNING_SECRET;
    });

    it('should verify valid Slack signatures', () => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      mockRequest.headers = {
        'x-slack-request-timestamp': timestamp,
        'x-slack-signature': 'v0=valid_signature'
      };
      mockRequest.body = { test: 'data' };

      // Mock crypto functions for testing
      const crypto = require('crypto');
      jest.spyOn(crypto, 'createHmac').mockReturnValue({
        update: jest.fn().mockReturnThis(),
        digest: jest.fn().mockReturnValue('valid_signature')
      });
      jest.spyOn(crypto, 'timingSafeEqual').mockReturnValue(true);

      const isValid = (controller as any).verifySlackRequest(mockRequest);
      expect(isValid).toBe(true);
    });

    it('should reject requests with missing headers', () => {
      mockRequest.headers = {};

      const isValid = (controller as any).verifySlackRequest(mockRequest);
      expect(isValid).toBe(false);
    });

    it('should reject old requests', () => {
      const oldTimestamp = (Math.floor(Date.now() / 1000) - 400).toString(); // 400 seconds ago
      mockRequest.headers = {
        'x-slack-request-timestamp': oldTimestamp,
        'x-slack-signature': 'v0=signature'
      };

      const isValid = (controller as any).verifySlackRequest(mockRequest);
      expect(isValid).toBe(false);
    });
  });
});