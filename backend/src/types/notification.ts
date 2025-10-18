export interface NotificationChannel {
  id: string;
  type: 'slack' | 'teams' | 'email';
  name: string;
  config: SlackConfig | TeamsConfig | EmailConfig;
  enabled: boolean;
}

export interface SlackConfig {
  botToken: string;
  channelId: string;
  webhookUrl?: string;
}

export interface TeamsConfig {
  webhookUrl: string;
  channelId?: string;
}

export interface EmailConfig {
  smtpHost: string;
  smtpPort: number;
  username: string;
  password: string;
  fromAddress: string;
  toAddresses: string[];
}

export interface NotificationTemplate {
  id: string;
  name: string;
  type: NotificationType;
  channels: string[]; // Channel IDs
  subject: string;
  message: string;
  priority: NotificationPriority;
  variables: string[]; // Template variables like {{ticketId}}, {{technician}}
}

export enum NotificationType {
  SLA_BREACH_WARNING = 'sla_breach_warning',
  SLA_BREACH_CRITICAL = 'sla_breach_critical',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_ESCALATED = 'ticket_escalated',
  TICKET_RESOLVED = 'ticket_resolved',
  WORKLOAD_ALERT = 'workload_alert',
  SYSTEM_ALERT = 'system_alert'
}

export enum NotificationPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface NotificationRequest {
  type: NotificationType;
  priority: NotificationPriority;
  templateId?: string;
  channels?: string[];
  data: Record<string, any>;
  userId?: string;
  ticketId?: string;
}

export interface NotificationDelivery {
  id: string;
  notificationId: string;
  channelId: string;
  channelType: 'slack' | 'teams' | 'email';
  status: DeliveryStatus;
  attempts: number;
  lastAttempt: Date;
  deliveredAt?: Date;
  error?: string;
}

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying'
}

export interface NotificationPreferences {
  userId: string;
  channels: {
    [key in NotificationType]?: string[]; // Channel IDs for each notification type
  };
  quietHours?: {
    start: string; // HH:MM format
    end: string;   // HH:MM format
    timezone: string;
  };
  enabled: boolean;
}

export interface SlackMessage {
  channel: string;
  text: string;
  blocks?: any[];
  attachments?: any[];
  thread_ts?: string;
}

export interface TeamsMessage {
  '@type': string;
  '@context': string;
  summary: string;
  themeColor: string;
  sections: TeamsSection[];
  potentialAction?: TeamsAction[];
}

export interface TeamsSection {
  activityTitle: string;
  activitySubtitle?: string;
  activityImage?: string;
  facts?: TeamsFact[];
  text?: string;
}

export interface TeamsFact {
  name: string;
  value: string;
}

export interface TeamsAction {
  '@type': string;
  name: string;
  targets: {
    os: string;
    uri: string;
  }[];
}

export interface EmailMessage {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject: string;
  text?: string;
  html?: string;
  attachments?: EmailAttachment[];
}

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
  contentType?: string;
}