'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../..//lib/api-client';
import {
  Bot,
  Send,
  Loader2,
  MessageCircle,
  Trash2,
  RefreshCw,
  Zap,
  Dumbbell,
  Apple,
  BarChart3,
} from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  id: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
}

interface RateLimit {
  remaining: number;
  resetAt: string;
  tier: string;
}

export default function AITrainerPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations and rate limit on mount
  useEffect(() => {
    loadConversations();
    loadRateLimit();
  }, []);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      const data = await api.getConversations();
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadRateLimit = async () => {
    try {
      const data = await api.getRateLimit();
      setRateLimit(data);
    } catch (error) {
      console.error('Failed to load rate limit:', error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      const data = await api.getConversation(conversationId);
      setMessages(data.messages || []);
      setCurrentConversationId(conversationId);
      setShowConversations(false);
    } catch (error) {
      console.error('Failed to load conversation:', error);
    }
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowConversations(false);
  };

  const deleteConversation = async (conversationId: string) => {
    try {
      await api.deleteConversation(conversationId);
      setConversations(conversations.filter((c) => c.id !== conversationId));
      if (currentConversationId === conversationId) {
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await api.sendChatMessage(
        inputMessage.trim(),
        currentConversationId || undefined
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update conversation ID if this was a new conversation
      if (!currentConversationId && response.conversationId) {
        setCurrentConversationId(response.conversationId);
        loadConversations(); // Refresh conversations list
      }

      // Update rate limit
      if (response.remainingRequests !== undefined) {
        setRateLimit((prev) =>
          prev
            ? {
                ...prev,
                remaining: response.remainingRequests,
              }
            : null
        );
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, errorMessage]);
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

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getRateLimitColor = () => {
    if (!rateLimit) return 'text-gray-500';
    const percentage = (rateLimit.remaining / 10) * 100; // Assuming max 10 for free tier
    if (percentage > 50) return 'text-green-500';
    if (percentage > 25) return 'text-yellow-500';
    return 'text-red-500';
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
            <Bot className="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
              AI Trainer
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Your personal fitness coach powered by AI
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          {/* Rate Limit Indicator */}
          {rateLimit && (
            <div className="flex items-center space-x-2 text-sm">
              <Zap className="h-4 w-4 text-yellow-500" />
              <span className={getRateLimitColor()}>
                {rateLimit.remaining} requests left
              </span>
            </div>
          )}

          {/* Conversations Button */}
          <button
            onClick={() => setShowConversations(!showConversations)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <MessageCircle className="h-5 w-5" />
          </button>

          {/* New Conversation Button */}
          <button
            onClick={startNewConversation}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <RefreshCw className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Conversations Sidebar */}
        {showConversations && (
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Conversations
              </h2>
            </div>
            <div className="overflow-y-auto">
              {conversations.length === 0 ? (
                <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                  No conversations yet
                </div>
              ) : (
                <div className="space-y-1 p-2">
                  {conversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`p-3 rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 ${
                        currentConversationId === conversation.id
                          ? 'bg-blue-100 dark:bg-blue-900'
                          : ''
                      }`}
                      onClick={() => loadConversation(conversation.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                            {conversation.title}
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {new Date(
                              conversation.lastMessageAt
                            ).toLocaleDateString()}
                          </p>
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteConversation(conversation.id);
                          }}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Bot className="h-16 w-16 text-gray-300 dark:text-gray-600 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Welcome to your AI Trainer!
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                  I'm here to help you with workout plans, nutrition advice,
                  form checks, and motivation. What would you like to know?
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <Link
                    href="/ai-trainer/workout-plan"
                    className="p-4 text-left bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Dumbbell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        Workout Plan Generator
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Create personalized workout routines
                    </div>
                  </Link>

                  <Link
                    href="/ai-trainer/meal-plan"
                    className="p-4 text-left bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Apple className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        Meal Plan Generator
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Get personalized nutrition plans
                    </div>
                  </Link>

                  <button
                    onClick={() => setInputMessage('Check my form for squats')}
                    className="p-4 text-left bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <BarChart3 className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        Form Check
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Exercise technique help
                    </div>
                  </button>

                  <button
                    onClick={() => setInputMessage('Motivate me to work out')}
                    className="p-4 text-left bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Bot className="h-6 w-6 text-gray-600 dark:text-gray-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        Motivation
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Stay motivated
                    </div>
                  </button>
                </div>
              </div>
            ) : (
              messages.map((message) => (
                <div
                  key={message.id}
                  className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                      message.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                    }`}
                  >
                    <div className="whitespace-pre-wrap">{message.content}</div>
                    <div
                      className={`text-xs mt-1 ${
                        message.role === 'user'
                          ? 'text-blue-100'
                          : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {formatTime(message.timestamp)}
                    </div>
                  </div>
                </div>
              ))
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>AI Trainer is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            <div className="flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask your AI trainer anything..."
                className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
