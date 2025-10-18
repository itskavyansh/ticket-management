export interface BotCommand {
  command: string;
  description: string;
  usage: string;
  aliases?: string[];
  parameters: BotParameter[];
  handler: string; // Method name to handle the command
}

export interface BotParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'choice';
  required: boolean;
  description: string;
  choices?: string[]; // For choice type
  default?: any;
}

export interface BotCommandRequest {
  command: string;
  parameters: Record<string, any>;
  userId: string;
  channelId: string;
  platform: 'slack' | 'teams';
  messageId?: string;
  threadId?: string;
}

export interface BotCommandResponse {
  success: boolean;
  message: string;
  data?: any;
  attachments?: BotAttachment[];
  actions?: BotAction[];
  ephemeral?: boolean; // Only visible to the user who triggered the command
}

export interface BotAttachment {
  title: string;
  text?: string;
  color?: string;
  fields?: BotField[];
  imageUrl?: string;
  thumbnailUrl?: string;
}

export interface BotField {
  title: string;
  value: string;
  short?: boolean;
}

export interface BotAction {
  type: 'button' | 'select' | 'datepicker';
  text: string;
  value: string;
  style?: 'primary' | 'danger' | 'default';
  url?: string;
}

export interface SlackEvent {
  type: string;
  user: string;
  channel: string;
  text: string;
  ts: string;
  thread_ts?: string;
  bot_id?: string;
}

export interface SlackSlashCommand {
  token: string;
  team_id: string;
  team_domain: string;
  channel_id: string;
  channel_name: string;
  user_id: string;
  user_name: string;
  command: string;
  text: string;
  response_url: string;
  trigger_id: string;
}

export interface TeamsActivity {
  type: string;
  id: string;
  timestamp: string;
  from: {
    id: string;
    name: string;
  };
  conversation: {
    id: string;
  };
  text: string;
  value?: any;
}

export interface BotContext {
  userId: string;
  channelId: string;
  platform: 'slack' | 'teams';
  userRole?: string;
  permissions?: string[];
}

export enum BotCommandType {
  TICKET_STATUS = 'ticket-status',
  TICKET_LIST = 'ticket-list',
  TICKET_ASSIGN = 'ticket-assign',
  TICKET_UPDATE = 'ticket-update',
  TICKET_CLOSE = 'ticket-close',
  SLA_STATUS = 'sla-status',
  WORKLOAD_STATUS = 'workload-status',
  HELP = 'help',
  STATS = 'stats'
}

export interface TicketSummary {
  id: string;
  title: string;
  status: string;
  priority: string;
  assignedTo?: string;
  customer: string;
  createdAt: Date;
  slaDeadline?: Date;
  slaRisk?: number;
}