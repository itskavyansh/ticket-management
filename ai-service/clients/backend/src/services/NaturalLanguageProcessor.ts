import { logger } from '../utils/logger';

export interface ParsedIntent {
  intent: string;
  entities: Record<string, any>;
  confidence: number;
}

export interface CommandPattern {
  pattern: RegExp;
  intent: string;
  entityExtractors: Record<string, (match: RegExpMatchArray) => any>;
}

export class NaturalLanguageProcessor {
  private patterns: CommandPattern[] = [];

  constructor() {
    this.initializePatterns();
  }

  /**
   * Parse natural language text to extract intent and entities
   */
  parseText(text: string): ParsedIntent | null {
    const normalizedText = text.toLowerCase().trim();
    
    for (const pattern of this.patterns) {
      const match = normalizedText.match(pattern.pattern);
      if (match) {
        const entities: Record<string, any> = {};
        
        // Extract entities using pattern extractors
        for (const [entityName, extractor] of Object.entries(pattern.entityExtractors)) {
          try {
            entities[entityName] = extractor(match);
          } catch (error) {
            logger.warn(`Failed to extract entity ${entityName}:`, error);
          }
        }
        
        return {
          intent: pattern.intent,
          entities,
          confidence: this.calculateConfidence(match, pattern)
        };
      }
    }
    
    return null;
  }

  /**
   * Initialize command patterns for intent recognition
   */
  private initializePatterns(): void {
    this.patterns = [
      // Help patterns
      {
        pattern: /^(help|h|\?|what can you do|commands?)$/,
        intent: 'help',
        entityExtractors: {}
      },

      // Ticket status patterns
      {
        pattern: /^(?:show|get|check|what'?s the)?\s*(?:status of|info for)?\s*ticket\s+([a-zA-Z0-9-]+)$/,
        intent: 'ticket_status',
        entityExtractors: {
          ticketId: (match) => match[1]
        }
      },

      // List tickets patterns
      {
        pattern: /^(?:list|show|get)\s+(?:my\s+)?tickets?(?:\s+(open|closed|resolved|in[_\s]progress|high|critical|low|medium))?$/,
        intent: 'ticket_list',
        entityExtractors: {
          filter: (match) => match[1] || null
        }
      },

      // Assign ticket patterns
      {
        pattern: /^assign\s+ticket\s+([a-zA-Z0-9-]+)\s+to\s+([a-zA-Z0-9._@-]+)$/,
        intent: 'ticket_assign',
        entityExtractors: {
          ticketId: (match) => match[1],
          assignee: (match) => match[2]
        }
      },

      // Update ticket status patterns
      {
        pattern: /^(?:update|set|change)\s+ticket\s+([a-zA-Z0-9-]+)\s+(?:status\s+)?(?:to\s+)?(open|closed|resolved|in[_\s]progress|on[_\s]hold)$/,
        intent: 'ticket_update',
        entityExtractors: {
          ticketId: (match) => match[1],
          status: (match) => match[2].replace(/\s+/g, '_')
        }
      },

      // Close/resolve ticket patterns
      {
        pattern: /^(?:close|resolve|finish|complete)\s+ticket\s+([a-zA-Z0-9-]+)$/,
        intent: 'ticket_close',
        entityExtractors: {
          ticketId: (match) => match[1]
        }
      },

      // SLA status patterns
      {
        pattern: /^(?:show|check|get)\s+sla\s*(?:status)?(?:\s+(risk|risks|at[_\s]risk))?$/,
        intent: 'sla_status',
        entityExtractors: {
          riskOnly: (match) => !!match[1]
        }
      },

      // Workload patterns
      {
        pattern: /^(?:show|check|get|what'?s)\s+(?:my\s+)?(?:workload|capacity|load|utilization)$/,
        intent: 'workload_status',
        entityExtractors: {}
      },

      // Statistics patterns
      {
        pattern: /^(?:show|get|check)\s+(?:my\s+)?(?:stats|statistics|metrics|performance)$/,
        intent: 'stats',
        entityExtractors: {}
      },

      // More natural variations
      {
        pattern: /^how many tickets do i have\??$/,
        intent: 'ticket_list',
        entityExtractors: {}
      },

      {
        pattern: /^what tickets are at risk\??$/,
        intent: 'sla_status',
        entityExtractors: {
          riskOnly: () => true
        }
      },

      {
        pattern: /^how am i doing\??$/,
        intent: 'stats',
        entityExtractors: {}
      },

      {
        pattern: /^am i overloaded\??$/,
        intent: 'workload_status',
        entityExtractors: {}
      },

      // Priority-based ticket queries
      {
        pattern: /^(?:show|list)\s+(?:my\s+)?(high|critical|low|medium)\s+priority\s+tickets?$/,
        intent: 'ticket_list',
        entityExtractors: {
          priority: (match) => match[1]
        }
      },

      // Time-based queries
      {
        pattern: /^(?:show|list)\s+tickets?\s+(?:created|opened)\s+(today|yesterday|this week|last week)$/,
        intent: 'ticket_list',
        entityExtractors: {
          timeFilter: (match) => match[1]
        }
      },

      // Customer-specific queries
      {
        pattern: /^(?:show|list)\s+tickets?\s+for\s+customer\s+([a-zA-Z0-9._-]+)$/,
        intent: 'ticket_list',
        entityExtractors: {
          customerId: (match) => match[1]
        }
      }
    ];
  }

  /**
   * Calculate confidence score for a match
   */
  private calculateConfidence(match: RegExpMatchArray, pattern: CommandPattern): number {
    // Base confidence
    let confidence = 0.8;
    
    // Increase confidence for exact matches
    if (match[0] === match.input) {
      confidence += 0.1;
    }
    
    // Increase confidence for patterns with more specific entities
    const entityCount = Object.keys(pattern.entityExtractors).length;
    confidence += Math.min(entityCount * 0.05, 0.15);
    
    // Decrease confidence for very short matches
    if (match[0].length < 5) {
      confidence -= 0.1;
    }
    
    return Math.min(Math.max(confidence, 0.1), 1.0);
  }

  /**
   * Extract mentions from text (users, channels, etc.)
   */
  extractMentions(text: string): { users: string[]; channels: string[] } {
    const userMentions = text.match(/<@([A-Z0-9]+)>/g) || [];
    const channelMentions = text.match(/<#([A-Z0-9]+)\|([^>]+)>/g) || [];
    
    return {
      users: userMentions.map(mention => mention.replace(/<@([A-Z0-9]+)>/, '$1')),
      channels: channelMentions.map(mention => mention.replace(/<#([A-Z0-9]+)\|([^>]+)>/, '$1'))
    };
  }

  /**
   * Clean text by removing mentions and formatting
   */
  cleanText(text: string): string {
    return text
      .replace(/<@[A-Z0-9]+>/g, '') // Remove user mentions
      .replace(/<#[A-Z0-9]+\|[^>]+>/g, '') // Remove channel mentions
      .replace(/[*_~`]/g, '') // Remove formatting
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim();
  }

  /**
   * Suggest corrections for unrecognized commands
   */
  suggestCorrections(text: string): string[] {
    const suggestions: string[] = [];
    const normalizedText = text.toLowerCase();
    
    // Common command suggestions based on partial matches
    if (normalizedText.includes('ticket')) {
      suggestions.push('ticket <ID>', 'list tickets', 'assign ticket <ID> to <user>');
    }
    
    if (normalizedText.includes('sla')) {
      suggestions.push('sla status', 'sla risk');
    }
    
    if (normalizedText.includes('work') || normalizedText.includes('load')) {
      suggestions.push('workload', 'my workload');
    }
    
    if (normalizedText.includes('stat') || normalizedText.includes('perf')) {
      suggestions.push('stats', 'my stats');
    }
    
    // If no specific suggestions, provide general help
    if (suggestions.length === 0) {
      suggestions.push('help', 'list tickets', 'workload', 'stats');
    }
    
    return suggestions.slice(0, 3); // Limit to 3 suggestions
  }
}

export const naturalLanguageProcessor = new NaturalLanguageProcessor();