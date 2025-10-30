import { Router } from 'express';
import { Request, Response } from 'express';
import axios from 'axios';
import { logger } from '../utils/logger';
import { auth } from '../middleware/auth';
import { apiRateLimit } from '../middleware/security';

const router = Router();

// Apply authentication and rate limiting
router.use(auth);
router.use(apiRateLimit);

interface ChatMessage {
  id: string;
  message: string;
  response: string;
  timestamp: string;
  isUser: boolean;
}

interface ChatbotRequest {
  message: string;
  context?: any;
  timestamp: string;
}

interface ChatbotResponse {
  success: boolean;
  response: string;
  suggestions?: string[];
  relatedTickets?: any[];
  processingTime?: number;
}

// In-memory storage for demo (use Redis/MongoDB in production)
const chatHistory = new Map<string, ChatMessage[]>();

// AI Service URL
const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8001';

// Gemini API configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

async function callGeminiAPI(userMessage: string, conversationHistory: ChatMessage[] = []): Promise<string> {
  try {
    // Create conversation context from history
    const conversationContext = conversationHistory
      .slice(-6) // Last 6 messages for context
      .map(msg => `${msg.isUser ? 'User' : 'Assistant'}: ${msg.isUser ? msg.message : msg.response}`)
      .join('\n');

    // System prompt that defines the AI's role
    const systemPrompt = `You are an AI assistant for a ticket management platform. You help users with ticket management, SLA monitoring, analytics, and platform guidance.

PLATFORM CONTEXT:
- This is an AI-powered IT support ticket management system
- Current system has 1,247 total tickets, 342 open, 5 critical
- SLA compliance is at 94.2%
- Team utilization is 78.5%
- You can help with tickets, SLA status, workload analysis, and platform features

CONVERSATION HISTORY:
${conversationContext}

INSTRUCTIONS:
- Be helpful, conversational, and professional
- Focus on ticket management and IT support topics
- Provide specific, actionable advice when possible
- Use **bold** for emphasis and • for bullet points
- Remember the conversation context
- If asked about data, reference the platform metrics mentioned above

USER MESSAGE: ${userMessage}

Please respond naturally as an AI assistant:`;

    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{
            text: systemPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        },
        safetySettings: [
          {
            category: "HARM_CATEGORY_HARASSMENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_HATE_SPEECH", 
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          },
          {
            category: "HARM_CATEGORY_DANGEROUS_CONTENT",
            threshold: "BLOCK_MEDIUM_AND_ABOVE"
          }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    if (response.data?.candidates?.[0]?.content?.parts?.[0]?.text) {
      return response.data.candidates[0].content.parts[0].text;
    } else {
      throw new Error('Invalid response format from Gemini API');
    }
  } catch (error) {
    logger.error('Gemini API error:', error);
    throw new Error(`Gemini API failed: ${error.response?.data?.error?.message || error.message}`);
  }
}

// Real Gemini AI responses only - no static fallbacks

// System prompt and conversation context handled in callGeminiAPI

function generateSuggestions(userMessage: string, aiResponse: string): string[] {
  const suggestions: string[] = [];
  
  // Analyze the message and response to generate relevant suggestions
  const lowerMessage = userMessage.toLowerCase();
  const lowerResponse = aiResponse.toLowerCase();
  
  if (lowerMessage.includes('ticket') || lowerResponse.includes('ticket')) {
    suggestions.push('Show me all open tickets');
    suggestions.push('Create a new ticket');
    suggestions.push('Check ticket priorities');
  }
  
  if (lowerMessage.includes('sla') || lowerResponse.includes('sla')) {
    suggestions.push('Show SLA alerts');
    suggestions.push('Check SLA compliance');
    suggestions.push('View overdue tickets');
  }
  
  if (lowerMessage.includes('workload') || lowerResponse.includes('workload')) {
    suggestions.push('Show technician workload');
    suggestions.push('Optimize ticket assignments');
    suggestions.push('View capacity planning');
  }
  
  if (lowerMessage.includes('analytics') || lowerResponse.includes('analytics')) {
    suggestions.push('Show performance metrics');
    suggestions.push('View ticket trends');
    suggestions.push('Generate reports');
  }
  
  // Default suggestions if none match
  if (suggestions.length === 0) {
    suggestions.push('Show dashboard overview');
    suggestions.push('Help with ticket management');
    suggestions.push('Explain platform features');
  }
  
  return suggestions.slice(0, 3); // Limit to 3 suggestions
}

// Send message to AI chatbot
router.post('/message', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  try {
    const { message, context, timestamp }: ChatbotRequest = req.body;
    const userId = (req as any).user?.id || 'anonymous';
    
    if (!message?.trim()) {
      return res.status(400).json({
        success: false,
        response: 'Please provide a message.',
      });
    }
    
    logger.info(`Processing chatbot message from user ${userId}: ${message.substring(0, 100)}...`);
    
    // Message will be processed with context in callGeminiAPI
    
    // Get conversation history for context
    const userHistory = chatHistory.get(userId) || [];
    
    // Get AI response from Gemini with conversation memory
    const aiResponse = await callGeminiAPI(message, userHistory);
    
    // Generate suggestions
    const suggestions = generateSuggestions(message, aiResponse);
    
    // Store in chat history (reuse existing userHistory)
    const newMessage: ChatMessage = {
      id: `${Date.now()}-${Math.random()}`,
      message,
      response: aiResponse,
      timestamp: timestamp || new Date().toISOString(),
      isUser: false,
    };
    
    userHistory.push(newMessage);
    
    // Keep only last 50 messages per user
    if (userHistory.length > 50) {
      userHistory.splice(0, userHistory.length - 50);
    }
    
    chatHistory.set(userId, userHistory);
    
    const processingTime = Date.now() - startTime;
    
    const response: ChatbotResponse = {
      success: true,
      response: aiResponse,
      suggestions,
      processingTime,
    };
    
    logger.info(`Chatbot response generated in ${processingTime}ms for user ${userId}`);
    
    res.json(response);
    
  } catch (error) {
    const processingTime = Date.now() - startTime;
    logger.error('Chatbot message processing error:', error);
    
    const fallbackResponse = "I apologize, but I'm experiencing some technical difficulties right now. Please try again in a moment, or contact support if the issue persists.";
    
    res.json({
      success: false,
      response: fallbackResponse,
      processingTime,
    });
  }
});

// Get chat history
router.get('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'anonymous';
    const userHistory = chatHistory.get(userId) || [];
    
    // Return last 20 messages
    const recentHistory = userHistory.slice(-20);
    
    res.json(recentHistory);
    
  } catch (error) {
    logger.error('Chat history retrieval error:', error);
    res.status(500).json({
      error: 'Failed to retrieve chat history',
    });
  }
});

// Clear chat history
router.delete('/history', async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id || 'anonymous';
    chatHistory.delete(userId);
    
    res.json({
      success: true,
      message: 'Chat history cleared',
    });
    
  } catch (error) {
    logger.error('Chat history clearing error:', error);
    res.status(500).json({
      error: 'Failed to clear chat history',
    });
  }
});

// Get chatbot status and health
router.get('/status', async (req: Request, res: Response) => {
  try {
    // Test Gemini API connection
    let geminiStatus = 'healthy';
    try {
      await callGeminiAPI('Test connection');
    } catch (error) {
      geminiStatus = 'unhealthy';
    }
    
    // Test AI service connection
    let aiServiceStatus = 'healthy';
    try {
      await axios.get(`${AI_SERVICE_URL}/health`, { timeout: 5000 });
    } catch (error) {
      aiServiceStatus = 'unhealthy';
    }
    
    const totalUsers = chatHistory.size;
    const totalMessages = Array.from(chatHistory.values()).reduce((sum, history) => sum + history.length, 0);
    
    res.json({
      status: 'running',
      geminiApi: geminiStatus,
      aiService: aiServiceStatus,
      statistics: {
        totalUsers,
        totalMessages,
        averageMessagesPerUser: totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0,
      },
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('Chatbot status check error:', error);
    res.status(500).json({
      error: 'Failed to get chatbot status',
    });
  }
});

export default router;