'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '../../../lib/api-client';
import { aiService } from '../../../lib/ai-service-client';
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
  Brain,
  TrendingUp,
  Settings,
  Info,
  Star,
  Clock,
  Target,
  Lightbulb,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import Link from 'next/link';
import {
  RAGSourcesDisplay,
  ConfidenceIndicator,
} from '../../../components/ai/visualizations';
import MemoryViewer from '../../../components/ai/MemoryViewer';
import type {
  RAGContext,
  ConversationAnalytics,
  PersonalizationProfile,
  MemoryItem,
  ProactiveInsight,
} from '../../../types/ai-service';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  ragContext?: RAGContext;
  confidence?: number;
  personalizationStyle?: string;
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

  // Enhanced AI features state
  const [conversationAnalytics, setConversationAnalytics] =
    useState<ConversationAnalytics | null>(null);
  const [personalizationProfile, setPersonalizationProfile] =
    useState<PersonalizationProfile | null>(null);
  const [userMemories, setUserMemories] = useState<MemoryItem[]>([]);
  const [proactiveInsights, setProactiveInsights] = useState<
    ProactiveInsight[]
  >([]);
  const [showRAGSources, setShowRAGSources] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showPersonalization, setShowPersonalization] = useState(false);
  const [coachingStyle, setCoachingStyle] = useState<string>('adaptive');
  const [ragStats, setRagStats] = useState<{
    totalVectors: number;
    namespaces: string[];
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Load conversations and rate limit on mount
  useEffect(() => {
    console.log('AI Trainer page mounted, user:', user);
    if (user && !user.isLoading) {
      console.log('User is authenticated, loading data...');
      loadConversations();
      loadRateLimit();
      loadEnhancedAIFeatures();
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

  const loadEnhancedAIFeatures = async () => {
    try {
      console.log('Loading enhanced AI features...');

      // Load personalization profile
      const profileResponse = await aiService.getPersonalizationProfile();
      console.log('Personalization profile response:', profileResponse);
      if (profileResponse.success) {
        setPersonalizationProfile(profileResponse.data);
        setCoachingStyle(profileResponse.data.coachingStyle || 'adaptive');
      } else {
        console.error(
          'Failed to load personalization profile:',
          profileResponse.error
        );
      }

      // Load user memories
      const memoriesResponse = await aiService.retrieveRelevantMemories(
        'user preferences and goals',
        { context: 'profile_load' }
      );
      console.log('User memories response:', memoriesResponse);
      if (memoriesResponse.success) {
        setUserMemories(memoriesResponse.data || []);
      } else {
        console.error('Failed to load user memories:', memoriesResponse.error);
        setUserMemories([]); // Set empty array as fallback
      }

      // Load proactive insights
      const insightsResponse = await aiService.getProactiveInsights();
      if (insightsResponse.success) {
        setProactiveInsights(insightsResponse.data);
      }

      // Load RAG stats
      const ragStatsResponse = await aiService.getRAGStats();
      if (ragStatsResponse.success) {
        setRagStats(ragStatsResponse.data);
      }

      console.log('Enhanced AI features loaded successfully');
    } catch (error) {
      console.error('Failed to load enhanced AI features:', error);
    }
  };

  const loadConversationAnalytics = async (conversationId: string) => {
    try {
      const response = await aiService.getConversationAnalytics(conversationId);
      if (response.success) {
        setConversationAnalytics(response.data);
      }
    } catch (error) {
      console.error('Failed to load conversation analytics:', error);
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

      // Load conversation analytics
      loadConversationAnalytics(conversationId);
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

      // Use enhanced AI service for chat
      const response = await aiService.sendChatMessage({
        message: inputMessage.trim(),
        conversationId: currentConversationId || undefined,
        includeRAG: true,
        personalizationLevel: 'high',
        context: {
          coachingStyle,
          userMemories: userMemories.slice(0, 5), // Include recent memories
          personalizationProfile: personalizationProfile || {
            coachingStyle: coachingStyle,
            communicationStyle: 'friendly',
            motivationType: 'achievement',
            confidence: 0.5,
          },
        },
      });

      console.log('Enhanced message response:', response);

      if (response.success) {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: response.data.response,
          timestamp: new Date(),
          ragContext: response.data.ragContext,
          confidence: response.metadata.confidence,
          personalizationStyle: personalizationProfile?.coachingStyle,
        };

        setMessages((prev) => [...prev, assistantMessage]);

        // Update conversation ID if this was a new conversation
        if (!currentConversationId && (response as any).conversationId) {
          setCurrentConversationId((response as any).conversationId);
          loadConversations(); // Refresh conversations list
        }

        // Update analytics if available
        if (response.data.analytics) {
          setConversationAnalytics(response.data.analytics);
        }

        // Refresh memories after conversation (to get any new memories stored)
        try {
          const memoriesResponse = await aiService.retrieveRelevantMemories(
            'user preferences and goals',
            { context: 'conversation_update' }
          );
          if (memoriesResponse.success) {
            setUserMemories(memoriesResponse.data || []);
          }
        } catch (error) {
          console.error('Failed to refresh memories:', error);
        }

        // Update rate limit
        if ((response as any).rateLimit) {
          setRateLimit((prev) =>
            prev
              ? {
                  ...prev,
                  requestsRemaining: (response as any).rateLimit.remaining,
                }
              : null
          );
        }
      } else {
        throw new Error(response.error || 'Failed to get response');
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

  const handleCoachingStyleChange = async (newStyle: string) => {
    setCoachingStyle(newStyle);
    try {
      await aiService.submitPersonalizationFeedback({
        type: 'coaching_style',
        rating: 5,
        comments: `User selected ${newStyle} coaching style`,
      });
    } catch (error) {
      console.error('Failed to update coaching style:', error);
    }
  };

  const summarizeConversation = async () => {
    if (!currentConversationId) return;

    try {
      const response = await aiService.summarizeConversation(
        currentConversationId
      );
      if (response.success) {
        // Show summary in a modal or notification
        alert(`Conversation Summary:\n\n${response.data.summary}`);
      }
    } catch (error) {
      console.error('Failed to summarize conversation:', error);
    }
  };

  const getCoachingStyleIcon = (style: string) => {
    const icons = {
      motivational: '🔥',
      analytical: '📊',
      educational: '📚',
      supportive: '🤗',
      challenging: '💪',
      adaptive: '🧠',
    };
    return icons[style as keyof typeof icons] || '💬';
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

        <div className="flex items-center space-x-2">
          {/* Coaching Style Indicator */}
          {personalizationProfile && (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <span className="text-sm">
                {getCoachingStyleIcon(coachingStyle)}
              </span>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 capitalize">
                {coachingStyle}
              </span>
            </div>
          )}

          {/* RAG Stats */}
          {ragStats && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Brain className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-300">
                {ragStats.totalVectors.toLocaleString()} sources
              </span>
            </div>
          )}

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

          {/* AI Features Toggle */}
          <button
            onClick={() => setShowAnalytics(!showAnalytics)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Toggle AI Analytics"
          >
            <TrendingUp className="h-5 w-5" />
          </button>

          {/* Personalization Toggle */}
          <button
            onClick={() => setShowPersonalization(!showPersonalization)}
            className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
            title="Toggle Personalization"
          >
            <Settings className="h-5 w-5" />
          </button>

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

        {/* AI Analytics Panel */}
        {showAnalytics && (
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                AI Analytics
              </h3>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Conversation Analytics */}
              {conversationAnalytics && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Conversation Insights
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Messages:
                      </span>
                      <span className="font-medium">
                        {conversationAnalytics.engagementMetrics.messageCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Satisfaction:
                      </span>
                      <span className="font-medium">
                        {
                          conversationAnalytics.engagementMetrics
                            .userSatisfaction
                        }
                        /5
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Sentiment:
                      </span>
                      <span
                        className={`font-medium ${
                          conversationAnalytics.sentimentAnalysis.overall ===
                          'positive'
                            ? 'text-green-600'
                            : conversationAnalytics.sentimentAnalysis
                                  .overall === 'negative'
                              ? 'text-red-600'
                              : 'text-gray-600'
                        }`}
                      >
                        {conversationAnalytics.sentimentAnalysis.overall}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Proactive Insights */}
              {proactiveInsights.length > 0 && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Proactive Insights
                  </h4>
                  <div className="space-y-2">
                    {proactiveInsights.slice(0, 3).map((insight) => (
                      <div
                        key={insight.id}
                        className="text-sm p-2 bg-blue-50 dark:bg-blue-900/20 rounded"
                      >
                        <div className="font-medium text-blue-900 dark:text-blue-300">
                          {insight.title}
                        </div>
                        <div className="text-blue-700 dark:text-blue-400 text-xs mt-1">
                          {insight.message}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* RAG Sources Summary */}
              {ragStats && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Knowledge Base
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Total Sources:
                      </span>
                      <span className="font-medium">
                        {ragStats.totalVectors.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      <span className="text-xs">Namespaces:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ragStats.namespaces.map((ns) => (
                          <span
                            key={ns}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-600 rounded text-xs"
                          >
                            {ns}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Personalization Panel */}
        {showPersonalization && (
          <div className="w-80 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Personalization
              </h3>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Coaching Style Selector */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  Coaching Style
                </h4>
                <div className="space-y-2">
                  {[
                    'motivational',
                    'analytical',
                    'educational',
                    'supportive',
                    'challenging',
                    'adaptive',
                  ].map((style) => (
                    <button
                      key={style}
                      onClick={() => handleCoachingStyleChange(style)}
                      className={`w-full text-left p-2 rounded text-sm flex items-center gap-2 ${
                        coachingStyle === style
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-300'
                          : 'hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>{getCoachingStyleIcon(style)}</span>
                      <span className="capitalize">{style}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* User Memories */}
              {userMemories.length > 0 && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    AI Memories
                  </h4>
                  <div className="space-y-2">
                    {userMemories.slice(0, 5).map((memory) => (
                      <div
                        key={memory.id}
                        className="text-sm p-2 bg-gray-50 dark:bg-gray-600 rounded"
                      >
                        <div className="font-medium text-gray-900 dark:text-white">
                          {memory.type}
                        </div>
                        <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">
                          {memory.content}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personalization Profile */}
              {personalizationProfile && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    Profile
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Communication:
                      </span>
                      <span className="font-medium capitalize">
                        {personalizationProfile.communicationStyle}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Motivation:
                      </span>
                      <span className="font-medium capitalize">
                        {personalizationProfile.motivationType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        Confidence:
                      </span>
                      <ConfidenceIndicator
                        score={personalizationProfile.confidence}
                        size="sm"
                        showLabel={false}
                      />
                    </div>
                  </div>
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
                  <button
                    onClick={() =>
                      setInputMessage(
                        'Create a personalized 4-day workout split for me'
                      )
                    }
                    className="p-4 text-left bg-blue-50 dark:bg-blue-900/20 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Dumbbell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        Smart Workout Plan
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      AI-powered personalized routines
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setInputMessage(
                        'Create a weekly meal plan optimized for my goals'
                      )
                    }
                    className="p-4 text-left bg-green-50 dark:bg-green-900/20 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 border border-green-200 dark:border-green-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Apple className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        Nutrition Intelligence
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      AI-optimized meal planning
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setInputMessage(
                        'Analyze my recent workout performance and suggest improvements'
                      )
                    }
                    className="p-4 text-left bg-purple-50 dark:bg-purple-900/20 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 border border-purple-200 dark:border-purple-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        Performance Analysis
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      AI-powered progress insights
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setInputMessage(
                        'Give me personalized motivation based on my current goals'
                      )
                    }
                    className="p-4 text-left bg-orange-50 dark:bg-orange-900/20 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/30 border border-orange-200 dark:border-orange-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Target className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        Personalized Coaching
                      </div>
                    </div>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Adaptive motivation & guidance
                    </div>
                  </button>
                </div>

                {/* Enhanced Features Showcase */}
                {(personalizationProfile || ragStats) && (
                  <div className="mt-8 max-w-2xl">
                    <div className="text-center mb-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Powered by Advanced AI
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      {personalizationProfile && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-2xl mb-1">
                            {getCoachingStyleIcon(coachingStyle)}
                          </div>
                          <div className="text-xs font-medium text-blue-900 dark:text-blue-300 capitalize">
                            {coachingStyle} Style
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-400">
                            Personalized coaching
                          </div>
                        </div>
                      )}

                      {ragStats && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-2xl mb-1">🧠</div>
                          <div className="text-xs font-medium text-green-900 dark:text-green-300">
                            {ragStats.totalVectors.toLocaleString()}+ Sources
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-400">
                            Knowledge base
                          </div>
                        </div>
                      )}

                      {userMemories.length > 0 && (
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="text-2xl mb-1">💭</div>
                          <div className="text-xs font-medium text-purple-900 dark:text-purple-300">
                            {userMemories.length} Memories
                          </div>
                          <div className="text-xs text-purple-700 dark:text-purple-400">
                            Long-term context
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
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

                          {/* Enhanced AI Features */}
                          <div className="mt-3 pt-2 border-t border-gray-200 dark:border-gray-600">
                            <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                              <div className="flex items-center gap-3">
                                {/* Confidence Indicator */}
                                {message.confidence !== undefined && (
                                  <ConfidenceIndicator
                                    score={message.confidence}
                                    size="sm"
                                    showLabel={false}
                                  />
                                )}

                                {/* Personalization Style */}
                                {message.personalizationStyle && (
                                  <div className="flex items-center gap-1">
                                    <span>
                                      {getCoachingStyleIcon(
                                        message.personalizationStyle
                                      )}
                                    </span>
                                    <span className="capitalize">
                                      {message.personalizationStyle}
                                    </span>
                                  </div>
                                )}
                              </div>

                              {/* RAG Sources Toggle */}
                              {message.ragContext &&
                                message.ragContext.sources.length > 0 && (
                                  <button
                                    onClick={() =>
                                      setShowRAGSources(!showRAGSources)
                                    }
                                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                                  >
                                    <Brain className="h-3 w-3" />
                                    <span>
                                      {message.ragContext.sources.length}{' '}
                                      sources
                                    </span>
                                    {showRAGSources ? (
                                      <ChevronUp className="h-3 w-3" />
                                    ) : (
                                      <ChevronDown className="h-3 w-3" />
                                    )}
                                  </button>
                                )}
                            </div>

                            {/* RAG Sources Display */}
                            {message.ragContext &&
                              message.ragContext.sources.length > 0 &&
                              showRAGSources && (
                                <div className="mt-2">
                                  <RAGSourcesDisplay
                                    sources={message.ragContext.sources}
                                    showDetails={true}
                                    maxSources={3}
                                  />
                                </div>
                              )}
                          </div>
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
            <div className="mx-auto mt-3 w-full max-w-3xl">
              {/* Enhanced Quick Actions */}
              <div className="flex flex-wrap gap-2 text-xs mb-3">
                {[
                  'Create a 4-day workout split',
                  'Weekly meal plan at 2200 kcal',
                  'Analyze my progress',
                  'Motivate me to work out',
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

              {/* AI Features Status */}
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <div className="flex items-center gap-4">
                  {personalizationProfile && (
                    <div className="flex items-center gap-1">
                      <span>{getCoachingStyleIcon(coachingStyle)}</span>
                      <span className="capitalize">{coachingStyle}</span>
                    </div>
                  )}

                  {ragStats && (
                    <div className="flex items-center gap-1">
                      <Brain className="h-3 w-3" />
                      <span>
                        {ragStats.totalVectors.toLocaleString()}+ sources
                      </span>
                    </div>
                  )}

                  {userMemories.length > 0 && (
                    <div className="flex items-center gap-1">
                      <span>💭</span>
                      <span>{userMemories.length} memories</span>
                    </div>
                  )}
                </div>

                {/* Conversation Actions */}
                {currentConversationId && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={summarizeConversation}
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400"
                      title="Summarize conversation"
                    >
                      <Lightbulb className="h-3 w-3" />
                      <span>Summarize</span>
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Memory Viewer Section */}
      {user?.id && (
        <div className="mt-8">
          <MemoryViewer userId={user.id} />
        </div>
      )}
    </div>
  );
}
