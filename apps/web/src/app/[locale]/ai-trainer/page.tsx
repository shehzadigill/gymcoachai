'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import { useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  Edit2,
  Check,
  X,
  Menu,
} from 'lucide-react';
import Link from 'next/link';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface Conversation {
  conversationId: string;
  firstMessage: string;
  lastMessageAt: string;
  messageCount: number;
  totalTokens: number;
  title?: string; // Optional custom title
}

interface RateLimit {
  limit: number;
  requestsRemaining: number;
  requestsUsed: number;
  resetAt: string;
  tier: string;
}

export default function AITrainerPage() {
  const user = useCurrentUser();
  const t = useTranslations('ai_trainer');
  const tCommon = useTranslations('common');
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [showConversations, setShowConversations] = useState(true);
  const [conversationsCollapsed, setConversationsCollapsed] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<
    string | null
  >(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [conversationSearch, setConversationSearch] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations and rate limit on mount
  useEffect(() => {
    console.log('AI Trainer page mounted, user:', user);
    if (user && !user.isLoading) {
      console.log('User is authenticated, loading data...');
      loadConversations();
      loadRateLimit();
    } else {
      console.log('User not authenticated or still loading');
    }
  }, [user]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadConversations = async () => {
    try {
      console.log('Loading conversations...');
      const data = await api.getConversations();
      console.log('Conversations loaded:', data);
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadRateLimit = async () => {
    try {
      console.log('Loading rate limit...');
      const data = await api.getRateLimit();
      console.log('Rate limit loaded:', data);
      setRateLimit(data);
    } catch (error) {
      console.error('Failed to load rate limit:', error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      console.log('Loading conversation:', conversationId);
      const data = await api.getConversation(conversationId);
      console.log('Conversation data:', data);

      // Handle different message formats from the API
      const messages = data.messages || [];
      const formattedMessages = messages.map((msg: any) => ({
        id: msg.timestamp || msg.createdAt || Date.now().toString(),
        role: msg.role || 'user',
        content: msg.content || '',
        timestamp: msg.timestamp
          ? new Date(msg.timestamp)
          : new Date(msg.createdAt || Date.now()),
      }));

      setMessages(formattedMessages);
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
      setConversations(
        conversations.filter((c) => c.conversationId !== conversationId)
      );
      if (currentConversationId === conversationId) {
        startNewConversation();
      }
    } catch (error) {
      console.error('Failed to delete conversation:', error);
    }
  };

  const startEditingConversation = (
    conversationId: string,
    currentTitle: string
  ) => {
    setEditingConversationId(conversationId);
    setEditingTitle(currentTitle || '');
  };

  const cancelEditingConversation = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const saveConversationTitle = async (conversationId: string) => {
    if (!editingTitle.trim()) return;

    const trimmedTitle = editingTitle.trim();
    if (trimmedTitle.length > 100) {
      alert('Title too long (max 100 characters)');
      return;
    }

    try {
      console.log('Saving conversation title:', {
        conversationId,
        title: trimmedTitle,
      });

      // Update conversation title in the backend
      console.log('Calling API to update conversation title...');
      await api.updateConversationTitle(conversationId, trimmedTitle);
      console.log('API call successful');

      // Update local state
      setConversations(
        conversations.map((conv) =>
          conv.conversationId === conversationId
            ? { ...conv, title: trimmedTitle }
            : conv
        )
      );

      setEditingConversationId(null);
      setEditingTitle('');
      console.log('Conversation title updated successfully');
    } catch (error) {
      console.error('Failed to update conversation title:', error);
      alert('Failed to update conversation title');
    }
  };

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) {
      return conversation.title;
    }
    // Use first message as title, truncated to 50 characters
    return conversation.firstMessage.length > 50
      ? conversation.firstMessage.substring(0, 50) + '...'
      : conversation.firstMessage;
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
      console.log(
        'Sending message:',
        inputMessage.trim(),
        'conversationId:',
        currentConversationId
      );
      const response = await api.sendChatMessage(
        inputMessage.trim(),
        currentConversationId || undefined
      );
      console.log('Message response:', response);

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          (response as any).reply ||
          (response as any).message ||
          'No response received',
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Update conversation ID if this was a new conversation
      if (!currentConversationId && (response as any).conversationId) {
        setCurrentConversationId((response as any).conversationId);
        loadConversations(); // Refresh conversations list
      }

      // Update rate limit
      if ((response as any).remainingRequests !== undefined) {
        setRateLimit((prev) =>
          prev
            ? {
                ...prev,
                requestsRemaining: (response as any).remainingRequests,
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
    const limit = rateLimit.limit || 10; // Default to 10 if limit not provided
    const percentage = (rateLimit.requestsRemaining / limit) * 100;
    if (percentage > 50) return 'text-green-500';
    if (percentage > 25) return 'text-yellow-500';
    return 'text-red-500';
  };

  const getRateLimitPercent = () => {
    if (!rateLimit) return 0;
    const limit = rateLimit.limit || 10;
    return Math.max(
      0,
      Math.min(100, (rateLimit.requestsRemaining / limit) * 100)
    );
  };

  // Show loading state if user is not authenticated
  if (user?.isLoading) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-blue-600" />
          <p className="text-gray-500">Loading AI Trainer...</p>
        </div>
      </div>
    );
  }

  // Show error state if user is not authenticated
  if (!user || user.error) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-center">
          <Bot className="h-16 w-16 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Authentication Required
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            Please sign in to access the AI Trainer
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Sign In
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-white to-gray-50 dark:from-gray-900 dark:to-gray-950">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 sticky top-0 z-10">
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
            <div className="hidden sm:flex items-center gap-3">
              <Zap className="h-4 w-4 text-yellow-500" />
              <div className="w-40">
                <div className="h-2 w-full bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-blue-600 dark:bg-blue-400 transition-all"
                    style={{ width: `${getRateLimitPercent()}%` }}
                  />
                </div>
                <div className={`text-xs mt-1 ${getRateLimitColor()}`}>
                  {rateLimit.requestsRemaining} requests left
                </div>
              </div>
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
          <div
            className={`border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 transition-all duration-300 ${conversationsCollapsed ? 'w-16' : 'w-80'}`}
          >
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                {!conversationsCollapsed && (
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Conversations
                  </h2>
                )}
                <button
                  onClick={() =>
                    setConversationsCollapsed(!conversationsCollapsed)
                  }
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700"
                  title={
                    conversationsCollapsed
                      ? 'Expand conversations'
                      : 'Collapse conversations'
                  }
                >
                  <Menu className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </button>
              </div>
              {!conversationsCollapsed && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={conversationSearch}
                    onChange={(e) => setConversationSearch(e.target.value)}
                    placeholder="Search conversations..."
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
            <div className="overflow-y-auto">
              {conversations.length === 0 ? (
                !conversationsCollapsed && (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    No conversations yet
                  </div>
                )
              ) : (
                <div className="space-y-1 p-2">
                  {conversations
                    .filter((c) =>
                      conversationSearch
                        ? (c.title || c.firstMessage)
                            .toLowerCase()
                            .includes(conversationSearch.toLowerCase())
                        : true
                    )
                    .map((conversation) => (
                      <div
                        key={conversation.conversationId}
                        className={`${conversationsCollapsed ? 'p-2' : 'p-3'} rounded-lg cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700 group ${
                          currentConversationId === conversation.conversationId
                            ? 'bg-blue-100 dark:bg-blue-900'
                            : ''
                        }`}
                        onClick={() =>
                          loadConversation(conversation.conversationId)
                        }
                        title={
                          conversationsCollapsed
                            ? getConversationTitle(conversation)
                            : undefined
                        }
                      >
                        {conversationsCollapsed ? (
                          <div className="flex justify-center">
                            <MessageCircle className="h-5 w-5 text-gray-500 dark:text-gray-400" />
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              {editingConversationId ===
                              conversation.conversationId ? (
                                <div className="flex items-center space-x-2">
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) =>
                                      setEditingTitle(e.target.value)
                                    }
                                    className="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none focus:border-blue-500"
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        saveConversationTitle(
                                          conversation.conversationId
                                        );
                                      } else if (e.key === 'Escape') {
                                        cancelEditingConversation();
                                      }
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveConversationTitle(
                                        conversation.conversationId
                                      );
                                    }}
                                    className="p-1 text-green-500 hover:text-green-700"
                                  >
                                    <Check className="h-3 w-3" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelEditingConversation();
                                    }}
                                    className="p-1 text-red-500 hover:text-red-700"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center space-x-2">
                                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                    {getConversationTitle(conversation)}
                                  </p>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      startEditingConversation(
                                        conversation.conversationId,
                                        conversation.title || ''
                                      );
                                    }}
                                    className="p-1 text-gray-400 hover:text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </button>
                                </div>
                              )}
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {conversation.lastMessageAt
                                  ? new Date(
                                      conversation.lastMessageAt
                                    ).toLocaleDateString()
                                  : 'Unknown date'}
                              </p>
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                deleteConversation(conversation.conversationId);
                              }}
                              className="p-1 text-gray-400 hover:text-red-500"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        )}
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
              <div className="mx-auto w-full max-w-3xl space-y-4">
                {messages.map((message) => (
                  <div
                    key={message.id}
                    className={`flex items-end gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    {message.role === 'assistant' && (
                      <div className="h-8 w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                        <Bot className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                      </div>
                    )}
                    <div
                      className={`max-w-[75%] px-4 py-2 rounded-2xl shadow-sm ${
                        message.role === 'user'
                          ? 'bg-blue-600 text-white rounded-br-sm'
                          : 'bg-white dark:bg-gray-700 text-gray-900 dark:text-white border border-gray-200 dark:border-gray-600 rounded-bl-sm'
                      }`}
                    >
                      {message.role === 'assistant' ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                              p: ({ children }) => (
                                <p className="mb-2 last:mb-0">{children}</p>
                              ),
                              ul: ({ children }) => (
                                <ul className="mb-2 last:mb-0">{children}</ul>
                              ),
                              ol: ({ children }) => (
                                <ol className="mb-2 last:mb-0">{children}</ol>
                              ),
                              li: ({ children }) => (
                                <li className="mb-1">{children}</li>
                              ),
                              strong: ({ children }) => (
                                <strong className="font-semibold">
                                  {children}
                                </strong>
                              ),
                              em: ({ children }) => (
                                <em className="italic">{children}</em>
                              ),
                              code: ({ children }) => (
                                <code className="bg-gray-200 dark:bg-gray-600 px-1 py-0.5 rounded text-sm">
                                  {children}
                                </code>
                              ),
                              pre: ({ children }) => (
                                <pre className="bg-gray-200 dark:bg-gray-600 p-2 rounded overflow-x-auto">
                                  {children}
                                </pre>
                              ),
                              blockquote: ({ children }) => (
                                <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic">
                                  {children}
                                </blockquote>
                              ),
                            }}
                          >
                            {message.content}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <div className="whitespace-pre-wrap">
                          {message.content}
                        </div>
                      )}
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
                    {message.role === 'user' && (
                      <div className="h-8 w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-200">
                        {user?.name?.[0]?.toUpperCase() || 'U'}
                      </div>
                    )}
                  </div>
                ))}
              </div>
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
            <div className="mx-auto w-full max-w-3xl flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask your AI trainer anything..."
                className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                disabled={isLoading}
              />
              <button
                onClick={sendMessage}
                disabled={!inputMessage.trim() || isLoading}
                className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 shadow-sm"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
            <div className="mx-auto mt-3 w-full max-w-3xl flex flex-wrap gap-2 text-xs">
              {[
                'Create a 4-day workout split',
                'Weekly meal plan at 2200 kcal',
                'Suggest mobility routine',
                'Evaluate my squat form',
              ].map((s) => (
                <button
                  key={s}
                  onClick={() => setInputMessage(s)}
                  className="px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
