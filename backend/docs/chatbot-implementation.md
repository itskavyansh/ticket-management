# Chat Bot Implementation

This document describes the implementation of the chat bot functionality for the AI Ticket Management Platform.

## Overview

The chat bot provides natural language interface for technicians to interact with the ticket management system through Slack and Microsoft Teams. It supports various commands for ticket management, workload monitoring, and SLA tracking.

## Architecture

### Core Components

1. **ChatBotService** - Main service handling command processing and business logic
2. **NaturalLanguageProcessor** - Parses natural language commands into structured intents
3. **ChatBotController** - Handles webhook requests from Slack and Teams
4. **Webhook Verification Middleware** - Ensures security of incoming webhook requests

### Supported Platforms

- **Slack**: Events API, Slash Commands, Interactive Components
- **Microsoft Teams**: Bot Framework messages

## Features Implemented

### Command Categories

#### Ticket Management
- `ticket <ID>` - Get ticket status and details
- `list tickets [filter]` - List assigned tickets with optional filters
- `assign <ID> to <user>` - Assign ticket to technician
- `update <ID> status <status>` - Update ticket status
- `close <ID>` - Close/resolve ticket

#### SLA Monitoring
- `sla` - Check SLA status for all tickets
- `sla risk` - Show only tickets at SLA risk

#### Workload Management
- `workload` - Check current workload and capacity
- `stats` - Get performance statistics

#### Help
- `help` - Show available commands and usage

### Natural Language Processing

The NLP component supports various natural language patterns:

```typescript
// Examples of supported patterns
"show me ticket T-123"
"what tickets are at risk?"
"how am i doing?"
"assign ticket T-456 to john.doe"
"update ticket T-789 status to resolved"
```

### Response Formatting

Responses are formatted appropriately for each platform:

- **Slack**: Rich attachments with fields, colors, and actions
- **Teams**: Adaptive cards with structured content

## API Endpoints

### Slack Webhooks
- `POST /api/chatbot/slack/events` - Slack Events API
- `POST /api/chatbot/slack/commands` - Slash commands
- `POST /api/chatbot/slack/interactive` - Interactive components

### Teams Webhooks
- `POST /api/chatbot/teams/messages` - Teams bot messages

### Management
- `GET /api/chatbot/status` - Bot health and status

## Security

### Webhook Verification
- Slack signature verification using signing secret
- Rate limiting (200 requests per minute)
- Request timestamp validation (5-minute window)

### Authentication
- Management endpoints require authentication
- Role-based access control for admin functions

## Configuration

### Environment Variables

```bash
# Slack Configuration
SLACK_SIGNING_SECRET=your_slack_signing_secret
SLACK_BOT_TOKEN=xoxb-your-bot-token

# Teams Configuration (if using Bot Framework)
MICROSOFT_APP_ID=your_app_id
MICROSOFT_APP_PASSWORD=your_app_password
```

### Slack App Setup

1. Create Slack app at https://api.slack.com/apps
2. Enable Events API with subscription URL: `https://your-domain/api/chatbot/slack/events`
3. Subscribe to bot events: `app_mention`, `message.im`
4. Create slash command: `/ticket` pointing to `https://your-domain/api/chatbot/slack/commands`
5. Install app to workspace and get bot token

### Teams Bot Setup

1. Register bot in Azure Bot Service
2. Configure messaging endpoint: `https://your-domain/api/chatbot/teams/messages`
3. Add Teams channel and configure app manifest

## Usage Examples

### Slack Usage

```
# Direct message to bot
@ticketbot help

# Slash command
/ticket T-123

# Natural language
@ticketbot show me my high priority tickets
```

### Teams Usage

```
# Direct message to bot
help

# Natural language
what tickets are at risk?
how am i doing?
```

## Error Handling

- Graceful degradation when services are unavailable
- Helpful error messages with suggestions
- Fallback to basic functionality when AI services fail

## Testing

The implementation includes comprehensive tests:

- **Unit Tests**: ChatBotService, NaturalLanguageProcessor
- **Integration Tests**: ChatBotController, webhook handling
- **Mock Services**: External dependencies are mocked for testing

Run tests:
```bash
npm test -- --testPathPattern="ChatBot|NaturalLanguage"
```

## Future Enhancements

1. **Advanced NLP**: Integration with external NLP services (OpenAI, Dialogflow)
2. **Conversation Context**: Multi-turn conversations with context retention
3. **Proactive Notifications**: Bot-initiated messages for alerts
4. **Voice Commands**: Integration with voice assistants
5. **Analytics**: Usage analytics and conversation insights
6. **Multi-language Support**: Internationalization for global teams

## Troubleshooting

### Common Issues

1. **Webhook Verification Fails**
   - Check signing secret configuration
   - Verify request timestamp is within 5-minute window
   - Ensure raw body is preserved for signature calculation

2. **Commands Not Recognized**
   - Check NLP patterns in `NaturalLanguageProcessor.ts`
   - Verify command parsing logic
   - Review confidence thresholds

3. **Service Integration Errors**
   - Check service dependencies (TicketService, SLAService, etc.)
   - Verify database connections
   - Review error logs for specific failures

### Debugging

Enable debug logging:
```bash
DEBUG=chatbot:* npm start
```

Check webhook delivery in platform admin panels:
- Slack: App settings > Event Subscriptions > Request URL verification
- Teams: Bot Framework portal > Channels > Test in Web Chat