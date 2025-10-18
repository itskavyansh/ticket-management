import { ChatBotService } from '../ChatBotService';
import { BotCommandRequest, BotContext, BotCommandType } from '../../types/chatBot';

// Mock dependencies
jest.mock('../TicketService');
jest.mock('../WorkloadAnalysisService');
jest.mock('../SLAService');
jest.mock('../NaturalLanguageProcessor');

describe('ChatBotService', () => {
  let chatBotService: ChatBotService;
  let mockContext: BotContext;

  beforeEach(() => {
    chatBotService = new ChatBotService();
    mockContext = {
      userId: 'user123',
      channelId: 'channel123',
      platform: 'slack',
      userRole: 'technician'
    };
  });

  describe('processCommand', () => {
    it('should process help command successfully', async () => {
      const request: BotCommandRequest = {
        command: 'help',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      const response = await chatBotService.processCommand(request, mockContext);

      expect(response.success).toBe(true);
      expect(response.message).toContain('Available Commands');
      expect(response.ephemeral).toBe(true);
    });

    it('should handle unrecognized commands with suggestions', async () => {
      const request: BotCommandRequest = {
        command: 'invalid command',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      const response = await chatBotService.processCommand(request, mockContext);

      expect(response.success).toBe(false);
      expect(response.message).toContain('Command not recognized');
    });

    it('should handle permission denied for read-only users', async () => {
      const readOnlyContext = { ...mockContext, userRole: 'read-only' };
      const request: BotCommandRequest = {
        command: 'assign T-123 to john.doe',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      const response = await chatBotService.processCommand(request, readOnlyContext);

      expect(response.success).toBe(false);
      expect(response.message).toContain('permission');
    });
  });

  describe('natural language processing', () => {
    it('should parse ticket status commands', async () => {
      const request: BotCommandRequest = {
        command: 'show me ticket T-123',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      // Mock the parseCommand method to return expected result
      const parseCommandSpy = jest.spyOn(chatBotService as any, 'parseCommand');
      parseCommandSpy.mockReturnValue({
        command: BotCommandType.TICKET_STATUS,
        parameters: { ticketId: 'T-123' }
      });

      const response = await chatBotService.processCommand(request, mockContext);

      expect(parseCommandSpy).toHaveBeenCalledWith('show me ticket T-123');
    });

    it('should parse list tickets commands with filters', async () => {
      const request: BotCommandRequest = {
        command: 'list my high priority tickets',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      const parseCommandSpy = jest.spyOn(chatBotService as any, 'parseCommand');
      parseCommandSpy.mockReturnValue({
        command: BotCommandType.TICKET_LIST,
        parameters: { priority: 'high' }
      });

      const response = await chatBotService.processCommand(request, mockContext);

      expect(parseCommandSpy).toHaveBeenCalledWith('list my high priority tickets');
    });
  });

  describe('response formatting', () => {
    it('should format ticket status response with attachments', async () => {
      const mockTicket = {
        id: 'T-123',
        title: 'Test Ticket',
        status: 'open',
        priority: 'high',
        assignedTechnicianId: 'tech123',
        customerId: 'customer123',
        createdAt: new Date(),
        aiInsights: { slaRiskScore: 75 }
      };

      // Mock ticket service
      const mockTicketService = {
        getTicketById: jest.fn().mockResolvedValue(mockTicket)
      };
      (chatBotService as any).ticketService = mockTicketService;

      // Mock SLA service
      const mockSLAService = {
        calculateSLAStatus: jest.fn().mockResolvedValue({ riskPercentage: 75 })
      };
      (chatBotService as any).slaService = mockSLAService;

      const request: BotCommandRequest = {
        command: 'ticket T-123',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      const parseCommandSpy = jest.spyOn(chatBotService as any, 'parseCommand');
      parseCommandSpy.mockReturnValue({
        command: BotCommandType.TICKET_STATUS,
        parameters: { ticketId: 'T-123' }
      });

      const response = await chatBotService.processCommand(request, mockContext);

      expect(response.success).toBe(true);
      expect(response.attachments).toBeDefined();
      expect(response.attachments![0].title).toContain('T-123');
    });

    it('should format workload response with capacity visualization', async () => {
      const mockWorkload = {
        activeTickets: 8,
        utilizationRate: 85,
        avgResolutionTime: 4.2,
        slaComplianceRate: 94
      };

      const mockWorkloadService = {
        getTechnicianWorkload: jest.fn().mockResolvedValue(mockWorkload)
      };
      (chatBotService as any).workloadService = mockWorkloadService;

      const request: BotCommandRequest = {
        command: 'workload',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      const parseCommandSpy = jest.spyOn(chatBotService as any, 'parseCommand');
      parseCommandSpy.mockReturnValue({
        command: BotCommandType.WORKLOAD_STATUS,
        parameters: {}
      });

      const response = await chatBotService.processCommand(request, mockContext);

      expect(response.success).toBe(true);
      expect(response.attachments).toBeDefined();
      expect(response.attachments![0].fields).toBeDefined();
      expect(response.message).toContain('workload status');
    });
  });

  describe('error handling', () => {
    it('should handle service errors gracefully', async () => {
      const mockTicketService = {
        getTicketById: jest.fn().mockRejectedValue(new Error('Service error'))
      };
      (chatBotService as any).ticketService = mockTicketService;

      const request: BotCommandRequest = {
        command: 'ticket T-123',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      const parseCommandSpy = jest.spyOn(chatBotService as any, 'parseCommand');
      parseCommandSpy.mockReturnValue({
        command: BotCommandType.TICKET_STATUS,
        parameters: { ticketId: 'T-123' }
      });

      const response = await chatBotService.processCommand(request, mockContext);

      expect(response.success).toBe(false);
      expect(response.message).toContain('Failed to retrieve ticket status');
    });

    it('should handle missing ticket gracefully', async () => {
      const mockTicketService = {
        getTicketById: jest.fn().mockResolvedValue(null)
      };
      (chatBotService as any).ticketService = mockTicketService;

      const request: BotCommandRequest = {
        command: 'ticket T-999',
        parameters: {},
        userId: 'user123',
        channelId: 'channel123',
        platform: 'slack'
      };

      const parseCommandSpy = jest.spyOn(chatBotService as any, 'parseCommand');
      parseCommandSpy.mockReturnValue({
        command: BotCommandType.TICKET_STATUS,
        parameters: { ticketId: 'T-999' }
      });

      const response = await chatBotService.processCommand(request, mockContext);

      expect(response.success).toBe(false);
      expect(response.message).toContain('Ticket T-999 not found');
    });
  });

  describe('utility methods', () => {
    it('should format time remaining correctly', () => {
      const formatTimeRemaining = (chatBotService as any).formatTimeRemaining;
      
      expect(formatTimeRemaining(30)).toBe('30m');
      expect(formatTimeRemaining(90)).toBe('1h 30m');
      expect(formatTimeRemaining(1500)).toBe('1d 1h');
    });

    it('should create capacity bar visualization', () => {
      const createCapacityBar = (chatBotService as any).createCapacityBar;
      
      const bar = createCapacityBar(75);
      expect(bar).toContain('█');
      expect(bar).toContain('░');
      expect(bar).toContain('75%');
    });

    it('should get appropriate SLA icons', () => {
      const getSLAIcon = (chatBotService as any).getSLAIcon;
      
      expect(getSLAIcon(95)).toBe('🔴');
      expect(getSLAIcon(75)).toBe('🟡');
      expect(getSLAIcon(50)).toBe('🟢');
    });
  });
});