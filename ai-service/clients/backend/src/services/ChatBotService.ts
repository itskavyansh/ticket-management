import {
  BotCommand,
  BotCommandRequest,
  BotCommandResponse,
  BotCommandType,
  BotContext,
  TicketSummary,
  BotAttachment,
  BotField
} from '../types/chatBot';
import { TicketService } from './TicketService';
import { WorkloadAnalysisService } from './WorkloadAnalysisService';
import { SLAService } from './SLAService';
import { naturalLanguageProcessor } from './NaturalLanguageProcessor';
import { TicketStatus } from '../types';
import { logger } from '../utils/logger';

export class ChatBotService {
  private commands: Map<string, BotCommand> = new Map();
  private ticketService: TicketService;
  private workloadService: WorkloadAnalysisService;
  private slaService: SLAService;

  constructor() {
    this.ticketService = new TicketService();
    // Create a mock TimeTrackingService for WorkloadAnalysisService
    const mockTimeTrackingService = {} as any;
    this.workloadService = new WorkloadAnalysisService(mockTimeTrackingService, this.ticketService);
    this.slaService = new SLAService();
    this.initializeCommands();
  }

  /**
   * Process a bot command
   */
  async processCommand(request: BotCommandRequest, context: BotContext): Promise<BotCommandResponse> {
    try {
      logger.info(`Processing bot command: ${request.command}`, {
        userId: request.userId,
        platform: request.platform
      });

      // Parse command and extract parameters
      const parsedCommand = this.parseCommand(request.command);
      if (!parsedCommand) {
        const suggestions = naturalLanguageProcessor.suggestCorrections(request.command);
        const suggestionText = suggestions.length > 0 
          ? `\n\nDid you mean:\n${suggestions.map(s => `• \`${s}\``).join('\n')}`
          : '';
        return this.createErrorResponse(`Command not recognized. Type "help" for available commands.${suggestionText}`);
      }

      // Check permissions
      if (!this.hasPermission(context, parsedCommand.command)) {
        return this.createErrorResponse('You do not have permission to execute this command.');
      }

      // Execute command
      const response = await this.executeCommand(parsedCommand, context);
      return response;
    } catch (error) {
      logger.error('Error processing bot command:', error);
      return this.createErrorResponse('An error occurred while processing your command.');
    }
  }

  /**
   * Parse natural language command using NLP processor
   */
  private parseCommand(text: string): { command: string; parameters: Record<string, any> } | null {
    // Clean the text first
    const cleanedText = naturalLanguageProcessor.cleanText(text);
    
    // Use NLP processor to parse intent and entities
    const parsed = naturalLanguageProcessor.parseText(cleanedText);
    
    if (!parsed || parsed.confidence < 0.5) {
      return null;
    }

    // Map intents to command types
    const intentToCommand: Record<string, string> = {
      'help': BotCommandType.HELP,
      'ticket_status': BotCommandType.TICKET_STATUS,
      'ticket_list': BotCommandType.TICKET_LIST,
      'ticket_assign': BotCommandType.TICKET_ASSIGN,
      'ticket_update': BotCommandType.TICKET_UPDATE,
      'ticket_close': BotCommandType.TICKET_CLOSE,
      'sla_status': BotCommandType.SLA_STATUS,
      'workload_status': BotCommandType.WORKLOAD_STATUS,
      'stats': BotCommandType.STATS
    };

    const command = intentToCommand[parsed.intent];
    if (!command) {
      return null;
    }

    return {
      command,
      parameters: parsed.entities
    };
  }

  /**
   * Execute a parsed command
   */
  private async executeCommand(
    parsedCommand: { command: string; parameters: Record<string, any> },
    context: BotContext
  ): Promise<BotCommandResponse> {
    switch (parsedCommand.command) {
      case BotCommandType.HELP:
        return this.handleHelpCommand(context);
      
      case BotCommandType.TICKET_STATUS:
        return this.handleTicketStatusCommand(parsedCommand.parameters, context);
      
      case BotCommandType.TICKET_LIST:
        return this.handleTicketListCommand(parsedCommand.parameters, context);
      
      case BotCommandType.TICKET_ASSIGN:
        return this.handleTicketAssignCommand(parsedCommand.parameters, context);
      
      case BotCommandType.TICKET_UPDATE:
        return this.handleTicketUpdateCommand(parsedCommand.parameters, context);
      
      case BotCommandType.TICKET_CLOSE:
        return this.handleTicketCloseCommand(parsedCommand.parameters, context);
      
      case BotCommandType.SLA_STATUS:
        return this.handleSLAStatusCommand(parsedCommand.parameters, context);
      
      case BotCommandType.WORKLOAD_STATUS:
        return this.handleWorkloadStatusCommand(parsedCommand.parameters, context);
      
      case BotCommandType.STATS:
        return this.handleStatsCommand(parsedCommand.parameters, context);
      
      default:
        return this.createErrorResponse('Unknown command');
    }
  }

  /**
   * Handle help command
   */
  private async handleHelpCommand(context: BotContext): Promise<BotCommandResponse> {
    const helpText = `
**Available Commands:**

🎫 **Ticket Commands:**
• \`ticket <ID>\` - Get ticket status
• \`list tickets\` - List your assigned tickets
• \`assign <ID> to <user>\` - Assign ticket to user
• \`update <ID> status <status>\` - Update ticket status
• \`close <ID>\` - Close/resolve ticket

📊 **Status Commands:**
• \`sla\` - Check SLA status
• \`workload\` - Check your workload
• \`stats\` - Get performance statistics

❓ **Help:**
• \`help\` - Show this help message

**Examples:**
• \`ticket T-123\`
• \`list tickets open\`
• \`assign T-123 to john.doe\`
• \`update T-123 status resolved\`
• \`sla risk\`
    `;

    return {
      success: true,
      message: helpText,
      ephemeral: true
    };
  }

  /**
   * Handle ticket status command
   */
  private async handleTicketStatusCommand(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotCommandResponse> {
    try {
      const { ticketId } = parameters;
      // For now, we'll use a mock customer ID - in production this would come from context
      const ticket = await this.ticketService.getTicketByExternalId(ticketId);
      
      if (!ticket) {
        return this.createErrorResponse(`Ticket ${ticketId} not found.`);
      }

      const slaInfo = this.slaService.getSLAStatus(ticket);
      
      const attachment: BotAttachment = {
        title: `Ticket ${ticket.id}`,
        text: ticket.title,
        color: this.getStatusColor(ticket.status),
        fields: [
          { title: 'Status', value: ticket.status, short: true },
          { title: 'Priority', value: ticket.priority, short: true },
          { title: 'Assigned To', value: ticket.assignedTechnicianId || 'Unassigned', short: true },
          { title: 'Customer', value: ticket.customerId, short: true },
          { title: 'Created', value: ticket.createdAt.toLocaleDateString(), short: true },
          { title: 'SLA Status', value: slaInfo ? `${Math.round(slaInfo.riskScore * 100)}% risk` : 'N/A', short: true }
        ]
      };

      return {
        success: true,
        message: `Here's the status for ticket ${ticketId}:`,
        attachments: [attachment]
      };
    } catch (error) {
      logger.error('Error handling ticket status command:', error);
      return this.createErrorResponse('Failed to retrieve ticket status.');
    }
  }

  /**
   * Handle ticket list command
   */
  private async handleTicketListCommand(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotCommandResponse> {
    try {
      const searchQuery = {
        filters: {
          assignedTechnicianId: parameters.assignedTechnicianId || context.userId,
          status: parameters.status ? [parameters.status] : undefined,
          priority: parameters.priority ? [parameters.priority] : undefined
        },
        limit: 10
      };

      const result = await this.ticketService.searchTickets(searchQuery);
      const tickets = result.tickets;
      
      if (tickets.length === 0) {
        return {
          success: true,
          message: 'No tickets found matching your criteria.',
          ephemeral: true
        };
      }

      const ticketList = tickets.map((ticket: any) => {
        const slaStatus = this.slaService.getSLAStatus(ticket);
        const slaIcon = this.getSLAIcon(slaStatus.riskScore * 100);
        return `${slaIcon} **${ticket.id}** - ${ticket.title} (${ticket.status})`;
      }).join('\n');

      return {
        success: true,
        message: `**Your Tickets (${tickets.length}):**\n${ticketList}`,
        ephemeral: true
      };
    } catch (error) {
      logger.error('Error handling ticket list command:', error);
      return this.createErrorResponse('Failed to retrieve ticket list.');
    }
  }

  /**
   * Handle ticket assign command
   */
  private async handleTicketAssignCommand(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotCommandResponse> {
    try {
      const { ticketId, assignee } = parameters;
      
      // Find technician by name or ID
      const technician = await this.findTechnicianByNameOrId(assignee);
      if (!technician) {
        return this.createErrorResponse(`Technician "${assignee}" not found.`);
      }

      // For now, use a mock customer ID and assignedBy - in production these would come from context
      await this.ticketService.assignTicket('mock-customer', ticketId, technician.id, context.userId);
      
      return {
        success: true,
        message: `✅ Ticket ${ticketId} has been assigned to ${technician.name}.`
      };
    } catch (error) {
      logger.error('Error handling ticket assign command:', error);
      return this.createErrorResponse('Failed to assign ticket.');
    }
  }

  /**
   * Handle ticket update command
   */
  private async handleTicketUpdateCommand(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotCommandResponse> {
    try {
      const { ticketId, status } = parameters;
      
      if (!status) {
        return this.createErrorResponse('Please specify a status to update.');
      }

      // For now, use a mock customer ID and updatedBy - in production these would come from context
      await this.ticketService.updateTicket('mock-customer', ticketId, { status }, context.userId);
      
      return {
        success: true,
        message: `✅ Ticket ${ticketId} status updated to "${status}".`
      };
    } catch (error) {
      logger.error('Error handling ticket update command:', error);
      return this.createErrorResponse('Failed to update ticket.');
    }
  }

  /**
   * Handle ticket close command
   */
  private async handleTicketCloseCommand(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotCommandResponse> {
    try {
      const { ticketId } = parameters;
      
      await this.ticketService.updateTicket('mock-customer', ticketId, { status: TicketStatus.RESOLVED, resolutionNotes: 'Resolved via chat bot' }, context.userId);
      
      return {
        success: true,
        message: `✅ Ticket ${ticketId} has been resolved and closed.`
      };
    } catch (error) {
      logger.error('Error handling ticket close command:', error);
      return this.createErrorResponse('Failed to close ticket.');
    }
  }

  /**
   * Handle SLA status command
   */
  private async handleSLAStatusCommand(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotCommandResponse> {
    try {
      const { riskOnly } = parameters;
      
      // Get SLA breach alerts as a proxy for SLA overview
      const slaAlerts = await this.slaService.checkSLABreaches(riskOnly ? 0.7 : 0.0);
      
      if (!slaAlerts || slaAlerts.length === 0) {
        return {
          success: true,
          message: riskOnly ? 'No tickets at SLA risk found.' : 'No SLA data available.',
          ephemeral: true
        };
      }

      const slaList = slaAlerts.slice(0, 10).map((item: any) => {
        const riskIcon = this.getSLAIcon(item.riskScore * 100);
        const timeLeft = item.minutesOverdue > 0 ? `${item.minutesOverdue}m overdue` : this.formatTimeRemaining(Math.max(0, (item.slaDeadline.getTime() - item.currentTime.getTime()) / (1000 * 60)));
        return `${riskIcon} **${item.ticketId}** - ${Math.round(item.riskScore * 100)}% risk (${timeLeft})`;
      }).join('\n');

      return {
        success: true,
        message: `**SLA Status:**\n${slaList}`,
        ephemeral: true
      };
    } catch (error) {
      logger.error('Error handling SLA status command:', error);
      return this.createErrorResponse('Failed to retrieve SLA status.');
    }
  }

  /**
   * Handle workload status command
   */
  private async handleWorkloadStatusCommand(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotCommandResponse> {
    try {
      const workload = await this.workloadService.analyzeWorkload(context.userId);
      
      if (!workload) {
        return this.createErrorResponse('Workload data not available.');
      }

      const utilizationRate = workload.utilizationMetrics.ticketUtilization;
      const utilizationIcon = this.getUtilizationIcon(utilizationRate);
      const capacityBar = this.createCapacityBar(utilizationRate);
      
      const attachment: BotAttachment = {
        title: 'Your Current Workload',
        color: this.getUtilizationColor(utilizationRate),
        fields: [
          { title: 'Current Capacity', value: `${workload.currentCapacity.currentActiveTickets}/${workload.currentCapacity.maxConcurrentTickets}`, short: true },
          { title: 'Utilization', value: `${Math.round(utilizationRate)}%`, short: true },
          { title: 'Capacity', value: capacityBar, short: false },
          { title: 'Avg Resolution Time', value: `${Math.round(workload.utilizationMetrics.averageTicketResolutionTime / 60)}h`, short: true },
          { title: 'Efficiency Score', value: `${Math.round(workload.currentCapacity.efficiencyScore)}%`, short: true }
        ]
      };

      return {
        success: true,
        message: `${utilizationIcon} Here's your current workload status:`,
        attachments: [attachment],
        ephemeral: true
      };
    } catch (error) {
      logger.error('Error handling workload status command:', error);
      return this.createErrorResponse('Failed to retrieve workload status.');
    }
  }

  /**
   * Handle stats command
   */
  private async handleStatsCommand(
    parameters: Record<string, any>,
    context: BotContext
  ): Promise<BotCommandResponse> {
    try {
      const stats = await this.getPersonalStats(context.userId);
      
      const attachment: BotAttachment = {
        title: 'Your Performance Statistics',
        color: '#36a64f',
        fields: [
          { title: 'Tickets Resolved (30d)', value: stats.ticketsResolved.toString(), short: true },
          { title: 'Avg Resolution Time', value: `${stats.avgResolutionTime}h`, short: true },
          { title: 'SLA Compliance', value: `${stats.slaCompliance}%`, short: true },
          { title: 'Customer Rating', value: `${stats.customerRating}/5 ⭐`, short: true },
          { title: 'Productivity Trend', value: stats.productivityTrend, short: true },
          { title: 'Rank in Team', value: `#${stats.teamRank}`, short: true }
        ]
      };

      return {
        success: true,
        message: '📊 Here are your performance statistics:',
        attachments: [attachment],
        ephemeral: true
      };
    } catch (error) {
      logger.error('Error handling stats command:', error);
      return this.createErrorResponse('Failed to retrieve statistics.');
    }
  }

  /**
   * Initialize command definitions
   */
  private initializeCommands(): void {
    // Command definitions are handled by the parseCommand method
    // This could be extended to support more structured command registration
  }

  /**
   * Check if user has permission to execute command
   */
  private hasPermission(context: BotContext, command: string): boolean {
    // Basic permission check - can be extended based on user roles
    const readOnlyCommands = [BotCommandType.HELP, BotCommandType.TICKET_STATUS, BotCommandType.TICKET_LIST, BotCommandType.SLA_STATUS, BotCommandType.WORKLOAD_STATUS, BotCommandType.STATS];
    const writeCommands = [BotCommandType.TICKET_ASSIGN, BotCommandType.TICKET_UPDATE, BotCommandType.TICKET_CLOSE];
    
    if (context.userRole === 'read-only') {
      return readOnlyCommands.includes(command as BotCommandType);
    }
    
    return true; // Allow all commands for other roles
  }

  /**
   * Create error response
   */
  private createErrorResponse(message: string): BotCommandResponse {
    return {
      success: false,
      message: `❌ ${message}`,
      ephemeral: true
    };
  }

  /**
   * Get status color for ticket status
   */
  private getStatusColor(status: string): string {
    const colors: Record<string, string> = {
      'open': '#ff9500',
      'in_progress': '#007acc',
      'resolved': '#36a64f',
      'closed': '#808080',
      'on_hold': '#ff6b6b'
    };
    return colors[status] || '#808080';
  }

  /**
   * Get SLA risk icon
   */
  private getSLAIcon(riskPercentage: number): string {
    if (riskPercentage >= 85) return '🔴';
    if (riskPercentage >= 70) return '🟡';
    return '🟢';
  }

  /**
   * Get utilization icon
   */
  private getUtilizationIcon(utilizationRate: number): string {
    if (utilizationRate >= 90) return '🔴';
    if (utilizationRate >= 75) return '🟡';
    return '🟢';
  }

  /**
   * Get utilization color
   */
  private getUtilizationColor(utilizationRate: number): string {
    if (utilizationRate >= 90) return '#ff4444';
    if (utilizationRate >= 75) return '#ffaa00';
    return '#36a64f';
  }

  /**
   * Create capacity bar visualization
   */
  private createCapacityBar(utilizationRate: number): string {
    const filled = Math.floor(utilizationRate / 10);
    const empty = 10 - filled;
    return '█'.repeat(filled) + '░'.repeat(empty) + ` ${utilizationRate}%`;
  }

  /**
   * Format time remaining
   */
  private formatTimeRemaining(minutes: number): string {
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (hours < 24) return `${hours}h ${remainingMinutes}m`;
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days}d ${remainingHours}h`;
  }

  /**
   * Find technician by name or ID
   */
  private async findTechnicianByNameOrId(identifier: string): Promise<any> {
    // This would integrate with the technician service
    // For now, return a mock response
    return {
      id: 'tech-123',
      name: identifier
    };
  }

  /**
   * Get personal statistics
   */
  private async getPersonalStats(userId: string): Promise<any> {
    // This would integrate with analytics service
    return {
      ticketsResolved: 45,
      avgResolutionTime: 4.2,
      slaCompliance: 94,
      customerRating: 4.7,
      productivityTrend: '📈 +12%',
      teamRank: 3
    };
  }
}

export const chatBotService = new ChatBotService();
 