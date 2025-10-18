import { Request, Response } from 'express';
import { chatBotService } from '../services/ChatBotService';
import {
  BotCommandRequest,
  BotContext,
  SlackEvent,
  SlackSlashCommand,
  TeamsActivity
} from '../types/chatBot';
import { logger } from '../utils/logger';
import crypto from 'crypto';

export class ChatBotController {
  /**
   * Handle Slack events (mentions, direct messages)
   */
  async handleSlackEvent(req: Request, res: Response): Promise<void> {
    try {
      const { type, challenge, event } = req.body;

      // Handle URL verification challenge
      if (type === 'url_verification') {
        res.status(200).json({ challenge });
        return;
      }

      // Handle event callbacks
      if (type === 'event_callback' && event) {
        await this.processSlackEvent(event);
        res.status(200).json({ ok: true });
        return;
      }

      res.status(400).json({ error: 'Invalid event type' });
    } catch (error) {
      logger.error('Error handling Slack event:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Slack slash commands
   */
  async handleSlackSlashCommand(req: Request, res: Response): Promise<void> {
    try {
      const slackCommand: SlackSlashCommand = req.body;
      
      // Verify the request is from Slack
      if (!this.verifySlackRequest(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      const botRequest: BotCommandRequest = {
        command: slackCommand.text,
        parameters: {},
        userId: slackCommand.user_id,
        channelId: slackCommand.channel_id,
        platform: 'slack'
      };

      const context: BotContext = {
        userId: slackCommand.user_id,
        channelId: slackCommand.channel_id,
        platform: 'slack'
      };

      const response = await chatBotService.processCommand(botRequest, context);
      
      // Convert bot response to Slack format
      const slackResponse = this.formatSlackResponse(response);
      
      res.status(200).json(slackResponse);
    } catch (error) {
      logger.error('Error handling Slack slash command:', error);
      res.status(500).json({
        text: 'Sorry, something went wrong processing your command.',
        response_type: 'ephemeral'
      });
    }
  }

  /**
   * Handle Slack interactive components (buttons, menus)
   */
  async handleSlackInteractive(req: Request, res: Response): Promise<void> {
    try {
      const payload = JSON.parse(req.body.payload);
      
      // Verify the request is from Slack
      if (!this.verifySlackRequest(req)) {
        res.status(401).json({ error: 'Unauthorized' });
        return;
      }

      // Handle different interaction types
      switch (payload.type) {
        case 'button':
          await this.handleSlackButtonClick(payload);
          break;
        case 'select_menu':
          await this.handleSlackMenuSelection(payload);
          break;
        default:
          logger.warn(`Unhandled Slack interaction type: ${payload.type}`);
      }

      res.status(200).json({ ok: true });
    } catch (error) {
      logger.error('Error handling Slack interactive component:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  /**
   * Handle Microsoft Teams messages
   */
  async handleTeamsMessage(req: Request, res: Response): Promise<void> {
    try {
      const activity: TeamsActivity = req.body;
      
      // Only process message activities
      if (activity.type !== 'message' || !activity.text) {
        res.status(200).json({ status: 'ignored' });
        return;
      }

      const botRequest: BotCommandRequest = {
        command: activity.text,
        parameters: {},
        userId: activity.from.id,
        channelId: activity.conversation.id,
        platform: 'teams'
      };

      const context: BotContext = {
        userId: activity.from.id,
        channelId: activity.conversation.id,
        platform: 'teams'
      };

      const response = await chatBotService.processCommand(botRequest, context);
      
      // Convert bot response to Teams format
      const teamsResponse = this.formatTeamsResponse(response);
      
      res.status(200).json(teamsResponse);
    } catch (error) {
      logger.error('Error handling Teams message:', error);
      res.status(500).json({
        type: 'message',
        text: 'Sorry, something went wrong processing your message.'
      });
    }
  }

  /**
   * Process Slack event
   */
  private async processSlackEvent(event: SlackEvent): Promise<void> {
    try {
      // Skip bot messages to avoid loops
      if (event.bot_id) {
        return;
      }

      // Only process app mentions and direct messages
      if (event.type !== 'app_mention' && event.type !== 'message') {
        return;
      }

      // Extract command from message text
      let commandText = event.text;
      if (event.type === 'app_mention') {
        // Remove bot mention from text
        commandText = event.text.replace(/<@[A-Z0-9]+>/g, '').trim();
      }

      const botRequest: BotCommandRequest = {
        command: commandText,
        parameters: {},
        userId: event.user,
        channelId: event.channel,
        platform: 'slack'
      };

      const context: BotContext = {
        userId: event.user,
        channelId: event.channel,
        platform: 'slack'
      };

      const response = await chatBotService.processCommand(botRequest, context);
      
      // Send response back to Slack (would need Slack Web API client)
      logger.info('Bot response generated for Slack event', {
        userId: event.user,
        channelId: event.channel,
        success: response.success
      });
    } catch (error) {
      logger.error('Error processing Slack event:', error);
    }
  }

  /**
   * Handle Slack button clicks
   */
  private async handleSlackButtonClick(payload: any): Promise<void> {
    const { user, actions, channel } = payload;
    const action = actions[0];
    
    logger.info('Slack button clicked', {
      userId: user.id,
      channelId: channel.id,
      actionValue: action.value
    });

    // Process button action based on value
    // This could trigger specific bot commands or actions
  }

  /**
   * Handle Slack menu selections
   */
  private async handleSlackMenuSelection(payload: any): Promise<void> {
    const { user, actions, channel } = payload;
    const action = actions[0];
    
    logger.info('Slack menu selection', {
      userId: user.id,
      channelId: channel.id,
      selectedValue: action.selected_option.value
    });

    // Process menu selection
  }

  /**
   * Verify Slack request signature
   */
  private verifySlackRequest(req: Request): boolean {
    const slackSigningSecret = process.env.SLACK_SIGNING_SECRET;
    if (!slackSigningSecret) {
      logger.warn('SLACK_SIGNING_SECRET not configured');
      return false;
    }

    const timestamp = req.headers['x-slack-request-timestamp'] as string;
    const signature = req.headers['x-slack-signature'] as string;
    
    if (!timestamp || !signature) {
      return false;
    }

    // Check if request is too old (replay attack protection)
    const currentTime = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTime - parseInt(timestamp)) > 300) {
      return false;
    }

    // Verify signature
    const body = JSON.stringify(req.body);
    const baseString = `v0:${timestamp}:${body}`;
    const expectedSignature = `v0=${crypto
      .createHmac('sha256', slackSigningSecret)
      .update(baseString)
      .digest('hex')}`;

    return crypto.timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSignature)
    );
  }

  /**
   * Format bot response for Slack
   */
  private formatSlackResponse(response: any): any {
    const slackResponse: any = {
      text: response.message,
      response_type: response.ephemeral ? 'ephemeral' : 'in_channel'
    };

    if (response.attachments && response.attachments.length > 0) {
      slackResponse.attachments = response.attachments.map((attachment: any) => ({
        title: attachment.title,
        text: attachment.text,
        color: attachment.color,
        fields: attachment.fields?.map((field: any) => ({
          title: field.title,
          value: field.value,
          short: field.short
        }))
      }));
    }

    if (response.actions && response.actions.length > 0) {
      slackResponse.attachments = slackResponse.attachments || [{}];
      slackResponse.attachments[0].actions = response.actions.map((action: any) => ({
        type: 'button',
        text: action.text,
        value: action.value,
        style: action.style
      }));
    }

    return slackResponse;
  }

  /**
   * Format bot response for Teams
   */
  private formatTeamsResponse(response: any): any {
    const teamsResponse: any = {
      type: 'message',
      text: response.message
    };

    if (response.attachments && response.attachments.length > 0) {
      teamsResponse.attachments = response.attachments.map((attachment: any) => ({
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.2',
          body: [
            {
              type: 'TextBlock',
              text: attachment.title,
              weight: 'Bolder',
              size: 'Medium'
            },
            ...(attachment.fields || []).map((field: any) => ({
              type: 'FactSet',
              facts: [
                {
                  title: field.title,
                  value: field.value
                }
              ]
            }))
          ]
        }
      }));
    }

    return teamsResponse;
  }

  /**
   * Get bot status and health
   */
  async getBotStatus(req: Request, res: Response): Promise<void> {
    try {
      const status = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        supportedPlatforms: ['slack', 'teams'],
        availableCommands: [
          'help',
          'ticket <id>',
          'list tickets',
          'assign <id> to <user>',
          'update <id> status <status>',
          'close <id>',
          'sla',
          'workload',
          'stats'
        ]
      };

      res.status(200).json(status);
    } catch (error) {
      logger.error('Error getting bot status:', error);
      res.status(500).json({ error: 'Failed to get bot status' });
    }
  }
}

export const chatBotController = new ChatBotController();