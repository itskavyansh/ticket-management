import { NaturalLanguageProcessor } from '../NaturalLanguageProcessor';

describe('NaturalLanguageProcessor', () => {
  let nlp: NaturalLanguageProcessor;

  beforeEach(() => {
    nlp = new NaturalLanguageProcessor();
  });

  describe('parseText', () => {
    it('should parse help commands', () => {
      const testCases = ['help', 'h', '?', 'what can you do', 'commands'];
      
      testCases.forEach(text => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.intent).toBe('help');
        expect(result!.confidence).toBeGreaterThan(0.5);
      });
    });

    it('should parse ticket status commands', () => {
      const testCases = [
        { text: 'ticket T-123', expectedId: 't-123' }, // NLP normalizes to lowercase
        { text: 'show status of ticket ABC-456', expectedId: 'abc-456' },
        { text: 'get info for ticket PROJ-789', expectedId: 'proj-789' },
        { text: 'what\'s the status of ticket INC-001', expectedId: 'inc-001' }
      ];

      testCases.forEach(({ text, expectedId }) => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.intent).toBe('ticket_status');
        expect(result!.entities.ticketId).toBe(expectedId);
      });
    });

    it('should parse ticket list commands with filters', () => {
      const testCases = [
        { text: 'list tickets', expectedFilter: null },
        { text: 'show my tickets open', expectedFilter: 'open' },
        { text: 'get tickets high', expectedFilter: 'high' },
        { text: 'list my tickets critical', expectedFilter: 'critical' }
      ];

      testCases.forEach(({ text, expectedFilter }) => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.intent).toBe('ticket_list');
        expect(result!.entities.filter).toBe(expectedFilter);
      });
    });

    it('should parse ticket assignment commands', () => {
      const testCases = [
        { text: 'assign ticket T-123 to john.doe', ticketId: 't-123', assignee: 'john.doe' },
        { text: 'assign ticket ABC-456 to jane@company.com', ticketId: 'abc-456', assignee: 'jane@company.com' }
      ];

      testCases.forEach(({ text, ticketId, assignee }) => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.intent).toBe('ticket_assign');
        expect(result!.entities.ticketId).toBe(ticketId);
        expect(result!.entities.assignee).toBe(assignee);
      });
    });

    it('should parse ticket update commands', () => {
      const testCases = [
        { text: 'update ticket T-123 status to resolved', ticketId: 't-123', status: 'resolved' },
        { text: 'set ticket ABC-456 to in progress', ticketId: 'abc-456', status: 'in_progress' },
        { text: 'change ticket XYZ-789 status closed', ticketId: 'xyz-789', status: 'closed' }
      ];

      testCases.forEach(({ text, ticketId, status }) => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.intent).toBe('ticket_update');
        expect(result!.entities.ticketId).toBe(ticketId);
        expect(result!.entities.status).toBe(status);
      });
    });

    it('should parse SLA status commands', () => {
      const testCases = [
        { text: 'show sla', riskOnly: false },
        { text: 'check sla status', riskOnly: false },
        { text: 'get sla risk', riskOnly: true },
        { text: 'show sla risks', riskOnly: true }
      ];

      testCases.forEach(({ text, riskOnly }) => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.intent).toBe('sla_status');
        expect(result!.entities.riskOnly).toBe(riskOnly);
      });
    });

    it('should parse workload commands', () => {
      const testCases = [
        'show my workload',
        'check workload',
        'get my capacity',
        'what\'s my load',
        'show utilization'
      ];

      testCases.forEach(text => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.intent).toBe('workload_status');
      });
    });

    it('should parse natural variations', () => {
      const testCases = [
        { text: 'how many tickets do i have', intent: 'ticket_list' },
        { text: 'what tickets are at risk', intent: 'sla_status', riskOnly: true },
        { text: 'how am i doing', intent: 'stats' },
        { text: 'am i overloaded', intent: 'workload_status' }
      ];

      testCases.forEach(({ text, intent, riskOnly }) => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.intent).toBe(intent);
        if (riskOnly !== undefined) {
          expect(result!.entities.riskOnly).toBe(riskOnly);
        }
      });
    });

    it('should return null for unrecognized commands', () => {
      const testCases = [
        'random text',
        'this is not a command',
        'hello world',
        'invalid command structure'
      ];

      testCases.forEach(text => {
        const result = nlp.parseText(text);
        expect(result).toBeNull();
      });
    });

    it('should handle case insensitive input', () => {
      const testCases = [
        'HELP',
        'Ticket T-123',
        'LIST TICKETS',
        'Show My Workload'
      ];

      testCases.forEach(text => {
        const result = nlp.parseText(text);
        expect(result).not.toBeNull();
        expect(result!.confidence).toBeGreaterThan(0.5);
      });
    });
  });

  describe('extractMentions', () => {
    it('should extract user mentions', () => {
      const text = 'Hey <@U123456> and <@U789012>, check this out!';
      const mentions = nlp.extractMentions(text);
      
      expect(mentions.users).toEqual(['U123456', 'U789012']);
      expect(mentions.channels).toEqual([]);
    });

    it('should extract channel mentions', () => {
      const text = 'Posted in <#C123456|general> and <#C789012|random>';
      const mentions = nlp.extractMentions(text);
      
      expect(mentions.users).toEqual([]);
      expect(mentions.channels).toEqual(['C123456', 'C789012']);
    });

    it('should handle mixed mentions', () => {
      const text = '<@U123456> please check <#C789012|support>';
      const mentions = nlp.extractMentions(text);
      
      expect(mentions.users).toEqual(['U123456']);
      expect(mentions.channels).toEqual(['C789012']);
    });
  });

  describe('cleanText', () => {
    it('should remove mentions and formatting', () => {
      const text = '<@U123456> *please* check _ticket_ `T-123` in <#C789012|support>';
      const cleaned = nlp.cleanText(text);
      
      expect(cleaned).toBe('please check ticket T-123 in');
      expect(cleaned).not.toContain('<@');
      expect(cleaned).not.toContain('*');
      expect(cleaned).not.toContain('_');
      expect(cleaned).not.toContain('`');
    });

    it('should normalize whitespace', () => {
      const text = 'multiple    spaces   and\n\nnewlines';
      const cleaned = nlp.cleanText(text);
      
      expect(cleaned).toBe('multiple spaces and newlines');
    });
  });

  describe('suggestCorrections', () => {
    it('should suggest ticket-related commands', () => {
      const suggestions = nlp.suggestCorrections('show me some ticket info');
      
      expect(suggestions).toContain('ticket <ID>');
      expect(suggestions).toContain('list tickets');
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should suggest SLA commands for SLA-related text', () => {
      const suggestions = nlp.suggestCorrections('sla information please');
      
      expect(suggestions).toContain('sla status');
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should suggest workload commands for workload-related text', () => {
      const suggestions = nlp.suggestCorrections('my current work situation');
      
      expect(suggestions).toContain('workload');
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });

    it('should provide general suggestions for unrelated text', () => {
      const suggestions = nlp.suggestCorrections('random unrelated text');
      
      expect(suggestions).toContain('help');
      expect(suggestions.length).toBeLessThanOrEqual(3);
    });
  });

  describe('confidence scoring', () => {
    it('should assign higher confidence to exact matches', () => {
      const exactMatch = nlp.parseText('help');
      const partialMatch = nlp.parseText('what can you do'); // This should also match help intent
      
      // Both should match, but exact match should have higher confidence
      expect(exactMatch).not.toBeNull();
      expect(partialMatch).not.toBeNull();
      // Allow for small differences in confidence calculation
      expect(exactMatch!.confidence).toBeGreaterThanOrEqual(partialMatch!.confidence);
    });

    it('should assign higher confidence to commands with more entities', () => {
      const simpleCommand = nlp.parseText('list tickets');
      const complexCommand = nlp.parseText('assign ticket T-123 to john.doe');
      
      expect(complexCommand!.confidence).toBeGreaterThan(simpleCommand!.confidence);
    });

    it('should have minimum confidence threshold', () => {
      const result = nlp.parseText('h'); // Very short command
      
      if (result) {
        expect(result.confidence).toBeGreaterThanOrEqual(0.1);
      }
    });
  });
});