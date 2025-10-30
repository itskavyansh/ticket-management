import React, { useState, useRef, useEffect } from 'react';
import { MessageCircle, Send, X, Bot, User, Loader2, RefreshCw } from 'lucide-react';
import { apiService, ChatMessage, ChatbotResponse } from '../../services/api';
import { formatDistanceToNow } from 'date-fns';

// Simplified formatting using dangerouslySetInnerHTML

interface ChatbotProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const AIChatbot: React.FC<ChatbotProps> = ({ isOpen, onToggle }) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isInitialized) {
      initializeChatbot();
    }
  }, [isOpen, isInitialized]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const initializeChatbot = async () => {
    setIsLoading(true);
    try {
      // Load chat history
      const history = await apiService.getChatHistory();
      setMessages(history);
      
      // Add welcome message if no history
      if (history.length === 0) {
        const welcomeMessage: ChatMessage = {
          id: 'welcome',
          message: '',
          response: "👋 Hi! I'm your AI assistant for the ticket management platform. I can help you with:\n\n• Finding and managing tickets\n• Understanding SLA status\n• Getting resolution suggestions\n• Analyzing workload and performance\n• Explaining platform features\n\nWhat would you like to know?",
          timestamp: new Date().toISOString(),
          isUser: false,
        };
        setMessages([welcomeMessage]);
      }
      
      setIsInitialized(true);
    } catch (error) {
      console.error('Failed to initialize chatbot:', error);
      const errorMessage: ChatMessage = {
        id: 'error',
        message: '',
        response: "Sorry, I'm having trouble connecting right now. Please try again later.",
        timestamp: new Date().toISOString(),
        isUser: false,
      };
      setMessages([errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      message: inputMessage,
      response: '',
      timestamp: new Date().toISOString(),
      isUser: true,
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response: ChatbotResponse = await apiService.sendChatMessage(inputMessage, {
        previousMessages: messages.slice(-5), // Send last 5 messages for context
      });

      const botMessage: ChatMessage = {
        id: `bot-${Date.now()}`,
        message: inputMessage,
        response: response.response,
        timestamp: new Date().toISOString(),
        isUser: false,
      };

      setMessages(prev => [...prev, botMessage]);

      // Add suggestions as quick actions if provided
      if (response.suggestions && response.suggestions.length > 0) {
        const suggestionsMessage: ChatMessage = {
          id: `suggestions-${Date.now()}`,
          message: '',
          response: `💡 **Quick actions:**\n${response.suggestions.map(s => `• ${s}`).join('\n')}`,
          timestamp: new Date().toISOString(),
          isUser: false,
        };
        setMessages(prev => [...prev, suggestionsMessage]);
      }

    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: ChatMessage = {
        id: `error-${Date.now()}`,
        message: inputMessage,
        response: "Sorry, I encountered an error processing your request. Please try again.",
        timestamp: new Date().toISOString(),
        isUser: false,
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setIsInitialized(false);
    initializeChatbot();
  };



  if (!isOpen) {
    return (
      <button
        onClick={onToggle}
        className="fixed bottom-6 right-6 bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-full shadow-lg transition-all duration-200 hover:scale-105 z-50"
        aria-label="Open AI Assistant"
      >
        <MessageCircle size={24} />
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 w-96 h-[600px] bg-white rounded-lg shadow-2xl border border-gray-200 flex flex-col z-50">
      {/* Header */}
      <div className="bg-blue-600 text-white p-4 rounded-t-lg flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Bot size={20} />
          <div>
            <h3 className="font-semibold">AI Assistant</h3>
            <p className="text-xs text-blue-100">Powered by Gemini AI</p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={clearChat}
            className="p-1 hover:bg-blue-700 rounded"
            title="Clear chat"
          >
            <RefreshCw size={16} />
          </button>
          <button
            onClick={onToggle}
            className="p-1 hover:bg-blue-700 rounded"
            title="Close chat"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.isUser ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] p-4 rounded-lg shadow-sm ${
                message.isUser
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-800 border border-gray-200'
              }`}
            >
              <div className="flex items-start space-x-2">
                {!message.isUser && <Bot size={16} className="mt-1 flex-shrink-0" />}
                {message.isUser && <User size={16} className="mt-1 flex-shrink-0" />}
                <div className="flex-1">
                  {message.isUser ? (
                    <p className="text-sm">{message.message}</p>
                  ) : (
                    <div className="text-sm leading-relaxed">
                      <div dangerouslySetInnerHTML={{ 
                        __html: message.response
                          .replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
                          .replace(/\n/g, '<br>')
                          .replace(/•/g, '<span class="text-blue-600 mr-2">•</span>')
                      }} />
                    </div>
                  )}
                  <p className={`text-xs mt-1 ${
                    message.isUser ? 'text-blue-100' : 'text-gray-500'
                  }`}>
                    {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-white text-gray-800 p-4 rounded-lg max-w-[80%] border border-gray-200 shadow-sm">
              <div className="flex items-center space-x-2">
                <Bot size={16} className="text-blue-600" />
                <Loader2 size={16} className="animate-spin text-blue-600" />
                <span className="text-sm text-gray-600">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>



      {/* Input */}
      <div className="p-4 border-t border-gray-200">
        <div className="flex space-x-2">
          <input
            ref={inputRef}
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about tickets, SLA, or the platform..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            disabled={isLoading}
          />
          <button
            onClick={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white p-2 rounded-lg transition-colors"
          >
            {isLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};