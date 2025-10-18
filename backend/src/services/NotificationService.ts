import { WebClient } from '@slack/web-api';
import axios from 'axios';
import nodemailer from 'nodemailer';
import { v4 as uuidv4 } from 'uuid';
import {
  NotificationChannel,
  NotificationTemplate,
  NotificationRequest,
  NotificationDelivery,
  NotificationPreferences,
  NotificationType,
  NotificationPriority,
  DeliveryStatus,
  SlackConfig,
  TeamsConfig,
  EmailConfig,
  SlackMessage,
  TeamsMessage,
  EmailMessage
} from '../types/notification';
import { logger } from '../utils/logger';

export class NotificationService {
  private channels: Map<string, NotificationChannel> = new Map();
  private templates: Map<string, NotificationTemplate> = new Map();
  private slackClients: Map<string, WebClient> = new Map();
  private emailTransporters: Map<string, nodemailer.Transporter> = new Map();
  private deliveryQueue: NotificationDelivery[] = [];
  private retryIntervals = [1000, 5000, 15000, 60000, 300000]; // 1s, 5s, 15s, 1m, 5m

  constructor() {
    this.initializeDefaultTemplates();
    this.startRetryProcessor();
  }

  /**
   * Register a notification channel
   */
  async registerChannel(channel: NotificationChannel): Promise<void> {
    try {
      // Validate channel configuration
      await this.validateChannelConfig(channel);
      
      this.channels.set(channel.id, channel);
      
      // Initialize channel-specific clients
      if (channel.type === 'slack') {
        const config = channel.config as SlackConfig;
        this.slackClients.set(channel.id, new WebClient(config.botToken));
      } else if (channel.type === 'email') {
        const config = channel.config as EmailConfig;
        const transporter = nodemailer.createTransporter({
          host: config.smtpHost,
          port: config.smtpPort,
          secure: config.smtpPort === 465,
          auth: {
            user: config.username,
            pass: config.password
          }
        });
        this.emailTransporters.set(channel.id, transporter);
      }
      
      logger.info(`Notification channel registered: ${channel.id} (${channel.type})`);
    } catch (error) {
      logger.error(`Failed to register notification channel ${channel.id}:`, error);
      throw error;
    }
  }

  /**
   * Register a notification template
   */
  registerTemplate(template: NotificationTemplate): void {
    this.templates.set(template.id, template);
    logger.info(`Notification template registered: ${template.id}`);
  }

  /**
   * Send notification to multiple channels
   */
  async sendNotification(request: NotificationRequest): Promise<string[]> {
    const notificationId = uuidv4();
    const deliveryIds: string[] = [];

    try {
      // Get template if specified
      let template: NotificationTemplate | undefined;
      if (request.templateId) {
        template = this.templates.get(request.templateId);
        if (!template) {
          throw new Error(`Template not found: ${request.templateId}`);
        }
      }

      // Determine channels to use
      const channelIds = request.channels || template?.channels || [];
      if (channelIds.length === 0) {
        throw new Error('No channels specified for notification');
      }

      // Send to each channel
      for (const channelId of channelIds) {
        const channel = this.channels.get(channelId);
        if (!channel || !channel.enabled) {
          logger.warn(`Channel not found or disabled: ${channelId}`);
          continue;
        }

        const deliveryId = await this.sendToChannel(
          notificationId,
          channel,
          template,
          request
        );
        deliveryIds.push(deliveryId);
      }

      logger.info(`Notification sent to ${deliveryIds.length} channels`, {
        notificationId,
        type: request.type,
        priority: request.priority
      });

      return deliveryIds;
    } catch (error) {
      logger.error(`Failed to send notification:`, error);
      throw error;
    }
  }

  /**
   * Send notification to a specific channel
   */
  private async sendToChannel(
    notificationId: string,
    channel: NotificationChannel,
    template: NotificationTemplate | undefined,
    request: NotificationRequest
  ): Promise<string> {
    const deliveryId = uuidv4();
    const delivery: NotificationDelivery = {
      id: deliveryId,
      notificationId,
      channelId: channel.id,
      channelType: channel.type,
      status: DeliveryStatus.PENDING,
      attempts: 0,
      lastAttempt: new Date()
    };

    try {
      let success = false;

      switch (channel.type) {
        case 'slack':
          success = await this.sendSlackNotification(channel, template, request);
          break;
        case 'teams':
          success = await this.sendTeamsNotification(channel, template, request);
          break;
        case 'email':
          success = await this.sendEmailNotification(channel, template, request);
          break;
        default:
          throw new Error(`Unsupported channel type: ${channel.type}`);
      }

      delivery.status = success ? DeliveryStatus.SENT : DeliveryStatus.FAILED;
      if (success) {
        delivery.deliveredAt = new Date();
      }
    } catch (error) {
      delivery.status = DeliveryStatus.FAILED;
      delivery.error = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Failed to send to channel ${channel.id}:`, error);
    }

    delivery.attempts = 1;
    delivery.lastAttempt = new Date();

    // Add to retry queue if failed and retryable
    if (delivery.status === DeliveryStatus.FAILED && this.isRetryable(delivery)) {
      delivery.status = DeliveryStatus.RETRYING;
      this.deliveryQueue.push(delivery);
    }

    return deliveryId;
  }

  /**
   * Send Slack notification
   */
  private async sendSlackNotification(
    channel: NotificationChannel,
    template: NotificationTemplate | undefined,
    request: NotificationRequest
  ): Promise<boolean> {
    const config = channel.config as SlackConfig;
    const slackClient = this.slackClients.get(channel.id);

    if (!slackClient) {
      throw new Error(`Slack client not initialized for channel ${channel.id}`);
    }

    const message = this.buildSlackMessage(template, request, config);
    
    try {
      const result = await slackClient.chat.postMessage(message);
      return result.ok === true;
    } catch (error) {
      logger.error(`Slack API error:`, error);
      return false;
    }
  }

  /**
   * Send MS Teams notification
   */
  private async sendTeamsNotification(
    channel: NotificationChannel,
    template: NotificationTemplate | undefined,
    request: NotificationRequest
  ): Promise<boolean> {
    const config = channel.config as TeamsConfig;
    const message = this.buildTeamsMessage(template, request);

    try {
      const response = await axios.post(config.webhookUrl, message, {
        headers: {
          'Content-Type': 'application/json'
        }
      });
      return response.status === 200;
    } catch (error) {
      logger.error(`Teams webhook error:`, error);
      return false;
    }
  }

  /**
   * Send email notification
   */
  private async sendEmailNotification(
    channel: NotificationChannel,
    template: NotificationTemplate | undefined,
    request: NotificationRequest
  ): Promise<boolean> {
    const config = channel.config as EmailConfig;
    const transporter = this.emailTransporters.get(channel.id);

    if (!transporter) {
      throw new Error(`Email transporter not initialized for channel ${channel.id}`);
    }

    const message = this.buildEmailMessage(template, request, config);

    try {
      await transporter.sendMail(message);
      return true;
    } catch (error) {
      logger.error(`Email send error:`, error);
      return false;
    }
  }

  /**
   * Build Slack message from template and request
   */
  private buildSlackMessage(
    template: NotificationTemplate | undefined,
    request: NotificationRequest,
    config: SlackConfig
  ): SlackMessage {
    const subject = template ? this.interpolateTemplate(template.subject, request.data) : 
                   this.getDefaultSubject(request.type);
    const text = template ? this.interpolateTemplate(template.message, request.data) : 
                 this.getDefaultMessage(request.type, request.data);

    const color = this.getPriorityColor(request.priority);
    
    return {
      channel: config.channelId,
      text: subject,
      blocks: [
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: `*${subject}*\n${text}`
          }
        },
        {
          type: 'context',
          elements: [
            {
              type: 'mrkdwn',
              text: `Priority: ${request.priority.toUpperCase()} | Type: ${request.type}`
            }
          ]
        }
      ],
      attachments: [
        {
          color: color,
          fields: this.buildSlackFields(request.data)
        }
      ]
    };
  }

  /**
   * Build MS Teams message from template and request
   */
  private buildTeamsMessage(
    template: NotificationTemplate | undefined,
    request: NotificationRequest
  ): TeamsMessage {
    const subject = template ? this.interpolateTemplate(template.subject, request.data) : 
                   this.getDefaultSubject(request.type);
    const text = template ? this.interpolateTemplate(template.message, request.data) : 
                 this.getDefaultMessage(request.type, request.data);

    const color = this.getPriorityColor(request.priority);

    return {
      '@type': 'MessageCard',
      '@context': 'https://schema.org/extensions',
      summary: subject,
      themeColor: color,
      sections: [
        {
          activityTitle: subject,
          activitySubtitle: `Priority: ${request.priority.toUpperCase()}`,
          text: text,
          facts: this.buildTeamsFacts(request.data)
        }
      ]
    };
  }

  /**
   * Build email message from template and request
   */
  private buildEmailMessage(
    template: NotificationTemplate | undefined,
    request: NotificationRequest,
    config: EmailConfig
  ): EmailMessage {
    const subject = template ? this.interpolateTemplate(template.subject, request.data) : 
                   this.getDefaultSubject(request.type);
    const text = template ? this.interpolateTemplate(template.message, request.data) : 
                 this.getDefaultMessage(request.type, request.data);

    return {
      to: config.toAddresses,
      subject: subject,
      text: text,
      html: this.buildEmailHtml(subject, text, request.data, request.priority)
    };
  }

  /**
   * Interpolate template variables with actual data
   */
  private interpolateTemplate(template: string, data: Record<string, any>): string {
    return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return data[key] || match;
    });
  }

  /**
   * Get default subject for notification type
   */
  private getDefaultSubject(type: NotificationType): string {
    const subjects = {
      [NotificationType.SLA_BREACH_WARNING]: 'SLA Breach Warning',
      [NotificationType.SLA_BREACH_CRITICAL]: 'Critical: SLA Breach Imminent',
      [NotificationType.TICKET_ASSIGNED]: 'Ticket Assigned',
      [NotificationType.TICKET_ESCALATED]: 'Ticket Escalated',
      [NotificationType.TICKET_RESOLVED]: 'Ticket Resolved',
      [NotificationType.WORKLOAD_ALERT]: 'Workload Alert',
      [NotificationType.SYSTEM_ALERT]: 'System Alert'
    };
    return subjects[type] || 'Notification';
  }

  /**
   * Get default message for notification type
   */
  private getDefaultMessage(type: NotificationType, data: Record<string, any>): string {
    const messages = {
      [NotificationType.SLA_BREACH_WARNING]: `Ticket ${data.ticketId} is at risk of SLA breach. Current progress: ${data.progress}%`,
      [NotificationType.SLA_BREACH_CRITICAL]: `Critical: Ticket ${data.ticketId} will breach SLA in ${data.timeRemaining}`,
      [NotificationType.TICKET_ASSIGNED]: `Ticket ${data.ticketId} has been assigned to ${data.technician}`,
      [NotificationType.TICKET_ESCALATED]: `Ticket ${data.ticketId} has been escalated to ${data.escalatedTo}`,
      [NotificationType.TICKET_RESOLVED]: `Ticket ${data.ticketId} has been resolved by ${data.technician}`,
      [NotificationType.WORKLOAD_ALERT]: `Technician ${data.technician} workload is at ${data.utilization}%`,
      [NotificationType.SYSTEM_ALERT]: `System alert: ${data.message}`
    };
    return messages[type] || 'Notification received';
  }

  /**
   * Get color based on priority
   */
  private getPriorityColor(priority: NotificationPriority): string {
    const colors = {
      [NotificationPriority.LOW]: '#36a64f',      // Green
      [NotificationPriority.MEDIUM]: '#ffaa00',   // Orange
      [NotificationPriority.HIGH]: '#ff6b6b',     // Red
      [NotificationPriority.CRITICAL]: '#d63031'  // Dark Red
    };
    return colors[priority] || '#36a64f';
  }

  /**
   * Build Slack fields from data
   */
  private buildSlackFields(data: Record<string, any>): any[] {
    return Object.entries(data).map(([key, value]) => ({
      title: key.charAt(0).toUpperCase() + key.slice(1),
      value: String(value),
      short: true
    }));
  }

  /**
   * Build Teams facts from data
   */
  private buildTeamsFacts(data: Record<string, any>): any[] {
    return Object.entries(data).map(([key, value]) => ({
      name: key.charAt(0).toUpperCase() + key.slice(1),
      value: String(value)
    }));
  }

  /**
   * Build HTML email content
   */
  private buildEmailHtml(
    subject: string,
    text: string,
    data: Record<string, any>,
    priority: NotificationPriority
  ): string {
    const color = this.getPriorityColor(priority);
    const dataRows = Object.entries(data).map(([key, value]) => 
      `<tr><td><strong>${key}:</strong></td><td>${value}</td></tr>`
    ).join('');

    return `
      <html>
        <body style="font-family: Arial, sans-serif; margin: 0; padding: 20px;">
          <div style="border-left: 4px solid ${color}; padding-left: 20px;">
            <h2 style="color: ${color}; margin-top: 0;">${subject}</h2>
            <p style="font-size: 16px; line-height: 1.5;">${text}</p>
            ${dataRows ? `
              <table style="border-collapse: collapse; margin-top: 20px;">
                ${dataRows}
              </table>
            ` : ''}
            <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
            <p style="font-size: 12px; color: #666;">
              Priority: ${priority.toUpperCase()} | 
              Sent at: ${new Date().toISOString()}
            </p>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Validate channel configuration
   */
  private async validateChannelConfig(channel: NotificationChannel): Promise<void> {
    switch (channel.type) {
      case 'slack':
        const slackConfig = channel.config as SlackConfig;
        if (!slackConfig.botToken || !slackConfig.channelId) {
          throw new Error('Slack channel requires botToken and channelId');
        }
        break;
      case 'teams':
        const teamsConfig = channel.config as TeamsConfig;
        if (!teamsConfig.webhookUrl) {
          throw new Error('Teams channel requires webhookUrl');
        }
        break;
      case 'email':
        const emailConfig = channel.config as EmailConfig;
        if (!emailConfig.smtpHost || !emailConfig.username || !emailConfig.password) {
          throw new Error('Email channel requires SMTP configuration');
        }
        break;
      default:
        throw new Error(`Unsupported channel type: ${channel.type}`);
    }
  }

  /**
   * Check if delivery is retryable
   */
  private isRetryable(delivery: NotificationDelivery): boolean {
    return delivery.attempts < this.retryIntervals.length;
  }

  /**
   * Start retry processor for failed deliveries
   */
  private startRetryProcessor(): void {
    setInterval(() => {
      this.processRetryQueue();
    }, 10000); // Check every 10 seconds
  }

  /**
   * Process retry queue for failed deliveries
   */
  private async processRetryQueue(): Promise<void> {
    const now = new Date();
    const toRetry = this.deliveryQueue.filter(delivery => {
      const timeSinceLastAttempt = now.getTime() - delivery.lastAttempt.getTime();
      const retryDelay = this.retryIntervals[delivery.attempts - 1] || 300000;
      return timeSinceLastAttempt >= retryDelay;
    });

    for (const delivery of toRetry) {
      try {
        const channel = this.channels.get(delivery.channelId);
        if (!channel) {
          // Remove from queue if channel no longer exists
          this.removeFromQueue(delivery.id);
          continue;
        }

        // Retry the delivery (simplified - would need original request data)
        // This is a placeholder - in a real implementation, you'd store the original request
        delivery.attempts++;
        delivery.lastAttempt = now;

        if (delivery.attempts >= this.retryIntervals.length) {
          delivery.status = DeliveryStatus.FAILED;
          this.removeFromQueue(delivery.id);
          logger.error(`Delivery permanently failed after ${delivery.attempts} attempts: ${delivery.id}`);
        }
      } catch (error) {
        logger.error(`Error processing retry for delivery ${delivery.id}:`, error);
      }
    }
  }

  /**
   * Remove delivery from retry queue
   */
  private removeFromQueue(deliveryId: string): void {
    const index = this.deliveryQueue.findIndex(d => d.id === deliveryId);
    if (index !== -1) {
      this.deliveryQueue.splice(index, 1);
    }
  }

  /**
   * Initialize default notification templates
   */
  private initializeDefaultTemplates(): void {
    const defaultTemplates: NotificationTemplate[] = [
      {
        id: 'sla-breach-warning',
        name: 'SLA Breach Warning',
        type: NotificationType.SLA_BREACH_WARNING,
        channels: [],
        subject: 'SLA Breach Warning - Ticket {{ticketId}}',
        message: 'Ticket {{ticketId}} is at {{riskPercentage}}% risk of SLA breach. Time remaining: {{timeRemaining}}',
        priority: NotificationPriority.HIGH,
        variables: ['ticketId', 'riskPercentage', 'timeRemaining', 'technician']
      },
      {
        id: 'sla-breach-critical',
        name: 'Critical SLA Breach',
        type: NotificationType.SLA_BREACH_CRITICAL,
        channels: [],
        subject: 'CRITICAL: SLA Breach Imminent - Ticket {{ticketId}}',
        message: 'URGENT: Ticket {{ticketId}} will breach SLA in {{timeRemaining}}. Immediate action required!',
        priority: NotificationPriority.CRITICAL,
        variables: ['ticketId', 'timeRemaining', 'technician', 'customer']
      },
      {
        id: 'ticket-assigned',
        name: 'Ticket Assignment',
        type: NotificationType.TICKET_ASSIGNED,
        channels: [],
        subject: 'New Ticket Assigned - {{ticketId}}',
        message: 'You have been assigned ticket {{ticketId}}: {{title}}. Priority: {{priority}}',
        priority: NotificationPriority.MEDIUM,
        variables: ['ticketId', 'title', 'priority', 'customer', 'dueDate']
      }
    ];

    defaultTemplates.forEach(template => {
      this.registerTemplate(template);
    });
  }

  /**
   * Get delivery status for a notification
   */
  async getDeliveryStatus(deliveryId: string): Promise<NotificationDelivery | null> {
    // In a real implementation, this would query a database
    return this.deliveryQueue.find(d => d.id === deliveryId) || null;
  }

  /**
   * Get all registered channels
   */
  getChannels(): NotificationChannel[] {
    return Array.from(this.channels.values());
  }

  /**
   * Get all registered templates
   */
  getTemplates(): NotificationTemplate[] {
    return Array.from(this.templates.values());
  }
}

export const notificationService = new NotificationService();