'use client';

import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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

// Helper function to process and clean content
function processContent(content: string): string {
  // Replace HTML line breaks with markdown line breaks
  let processed = content.replace(/<br\s*\/?>/gi, '\n');

  // Handle common HTML entities
  processed = processed
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–')
    .replace(/&ldquo;/g, '"')
    .replace(/&rdquo;/g, '"')
    .replace(/&lsquo;/g, "'")
    .replace(/&rsquo;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, '&');

  return processed;
}

// Reasoning Section Component with animations
function ReasoningSection({ reasoning }: { reasoning: string }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="mb-3 pb-2 border-b border-gray-200 dark:border-gray-600">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full px-3 py-2 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-all duration-200 text-xs text-gray-600 dark:text-gray-400 group"
        aria-label={isExpanded ? 'Hide reasoning' : 'Show reasoning'}
      >
        <span className="font-medium flex items-center gap-2">
          <Brain className="h-3 w-3" />
          Reasoning
        </span>
        <ChevronDown
          className={`h-3 w-3 transition-transform duration-200 ${
            isExpanded ? 'rotate-180' : ''
          }`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          isExpanded ? 'max-h-96 opacity-100 mt-2' : 'max-h-0 opacity-0'
        }`}
      >
        <div
          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg text-xs text-gray-500 dark:text-gray-400 italic leading-relaxed"
          style={{
            filter: 'blur(0.3px)',
            WebkitFilter: 'blur(0.3px)',
          }}
        >
          {processContent(reasoning)}
        </div>
      </div>
    </div>
  );
}

// Summary Modal Component
interface SummaryModalProps {
  isOpen: boolean;
  summary: string | null;
  onClose: () => void;
}

function SummaryModal({ isOpen, summary, onClose }: SummaryModalProps) {
  if (!isOpen || !summary) return null;

  // Extract reasoning from summary if present
  const reasoningMatch = summary.match(/<reasoning>([\s\S]*?)<\/reasoning>/);
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null;
  let mainContent = summary
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/, '')
    .trim();
  // Process HTML entities and special characters
  mainContent = processContent(mainContent);

  return (
    <div
      className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-800">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Conversation Summary
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            aria-label="Close summary"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="overflow-y-auto flex-1 p-6">
          <div className="max-w-none">
            {/* Reasoning Section */}
            {reasoning && <ReasoningSection reasoning={reasoning} />}

            {/* Main Summary Content */}
            <div className="prose prose-sm dark:prose-invert max-w-none">
              <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                components={{
                  h1: ({ ...props }) => (
                    <h1
                      className="text-2xl font-bold mb-4 text-gray-900 dark:text-white"
                      {...props}
                    />
                  ),
                  h2: ({ ...props }) => (
                    <h2
                      className="text-xl font-bold mb-3 mt-4 text-gray-900 dark:text-white"
                      {...props}
                    />
                  ),
                  h3: ({ ...props }) => (
                    <h3
                      className="text-lg font-bold mb-2 mt-3 text-gray-900 dark:text-white"
                      {...props}
                    />
                  ),
                  p: ({ ...props }) => (
                    <p
                      className="mb-3 text-gray-700 dark:text-gray-300 leading-relaxed"
                      {...props}
                    />
                  ),
                  ul: ({ ...props }) => (
                    <ul
                      className="mb-3 ml-4 list-disc list-inside text-gray-700 dark:text-gray-300"
                      {...props}
                    />
                  ),
                  ol: ({ ...props }) => (
                    <ol
                      className="mb-3 ml-4 list-decimal list-inside text-gray-700 dark:text-gray-300"
                      {...props}
                    />
                  ),
                  li: ({ ...props }) => <li className="mb-1" {...props} />,
                  table: ({ ...props }) => (
                    <div className="mb-4 overflow-x-auto">
                      <table
                        className="w-full border-collapse border border-gray-300 dark:border-gray-600"
                        {...props}
                      />
                    </div>
                  ),
                  thead: ({ ...props }) => (
                    <thead
                      className="bg-gray-100 dark:bg-gray-700"
                      {...props}
                    />
                  ),
                  tbody: ({ ...props }) => (
                    <tbody
                      className="divide-y divide-gray-200 dark:divide-gray-600"
                      {...props}
                    />
                  ),
                  tr: ({ ...props }) => (
                    <tr
                      className="divide-x divide-gray-200 dark:divide-gray-600"
                      {...props}
                    />
                  ),
                  th: ({ ...props }) => (
                    <th
                      className="p-2 text-left font-semibold text-gray-900 dark:text-white"
                      {...props}
                    />
                  ),
                  td: ({ ...props }) => (
                    <td
                      className="p-2 text-gray-700 dark:text-gray-300"
                      {...props}
                    />
                  ),
                  blockquote: ({ ...props }) => (
                    <blockquote
                      className="mb-3 pl-4 border-l-4 border-blue-500 text-gray-600 dark:text-gray-400 italic"
                      {...props}
                    />
                  ),
                  code: ({ ...props }) => (
                    <code
                      className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded text-sm font-mono text-gray-900 dark:text-white"
                      {...props}
                    />
                  ),
                  pre: ({ ...props }) => (
                    <pre
                      className="mb-3 p-3 bg-gray-900 dark:bg-gray-950 rounded-lg overflow-x-auto"
                      {...props}
                    />
                  ),
                }}
              >
                {mainContent}
              </ReactMarkdown>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-6 bg-gray-50 dark:bg-gray-700/50">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-500 transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AITrainerPage() {
  const user = useCurrentUser();
  const t = useTranslations('ai_trainer');
  const tCommon = useTranslations('common');
  const searchParams = useSearchParams();
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

  // User context state for enhanced personalization
  const [userProfile, setUserProfile] = useState<any>(null);
  const [userPreferences, setUserPreferences] = useState<any>(null);

  // Summary modal state with caching
  const [showSummaryModal, setShowSummaryModal] = useState(false);
  const [cachedSummary, setCachedSummary] = useState<string | null>(null);
  const [lastMessageCount, setLastMessageCount] = useState(0);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Handle URL parameters for contextual AI queries
  useEffect(() => {
    const context = searchParams.get('context');
    const question = searchParams.get('question');
    const dataParam = searchParams.get('data');

    if (context && question && user && !user.isLoading) {
      // Parse the data if provided
      let parsedData = null;
      if (dataParam) {
        try {
          parsedData = JSON.parse(decodeURIComponent(dataParam));
        } catch (error) {
          console.error('Failed to parse data parameter:', error);
        }
      }

      // Build contextual message
      const decodedQuestion = decodeURIComponent(question);
      const contextualMessage = parsedData
        ? `Context: ${context}\n\nQuestion: ${decodedQuestion}\n\nRelevant Data:\n${JSON.stringify(parsedData, null, 2)}`
        : `Context: ${context}\n\nQuestion: ${decodedQuestion}`;

      // Set the input message
      setInputMessage(contextualMessage);

      // Close the conversations sidebar to show the chat
      setShowConversations(false);

      // Clear URL parameters after processing (optional - keeps URL clean)
      // You can comment this out if you want to keep params in URL
      if (typeof window !== 'undefined') {
        const url = new URL(window.location.href);
        url.searchParams.delete('context');
        url.searchParams.delete('question');
        url.searchParams.delete('data');
        window.history.replaceState({}, '', url.toString());
      }
    }
  }, [searchParams, user]);

  // Load conversations and rate limit on mount
  useEffect(() => {
    if (user && !user.isLoading) {
      loadConversations();
      loadRateLimit();
      loadEnhancedAIFeatures();
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

  const loadEnhancedAIFeatures = async () => {
    try {
      // Load user profile and preferences for context
      try {
        const profile = await api.getUserProfile();
        setUserProfile(profile);
      } catch (error) {
        console.error('Failed to load user profile:', error);
      }

      try {
        const preferences = await api.getUserPreferences();
        setUserPreferences(preferences);
      } catch (error) {
        console.error('Failed to load user preferences:', error);
      }

      // Load personalization profile
      const profileResponse = await aiService.getPersonalizationProfile();
      setPersonalizationProfile(profileResponse);
      setCoachingStyle(profileResponse.coachingStyle || 'adaptive');

      // Load user memories
      const memoriesResponse = await aiService.retrieveRelevantMemories(
        'user preferences and goals',
        { context: 'profile_load' }
      );
      if (memoriesResponse.success) {
        setUserMemories(memoriesResponse.data || []);
      } else {
        console.error('Failed to load user memories:', memoriesResponse.error);
        setUserMemories([]); // Set empty array as fallback
      }

      // Load proactive insights
      const insightsResponse = await aiService.getProactiveInsights();
      if (insightsResponse) {
        setProactiveInsights(insightsResponse);
      }

      // Load RAG stats
      const ragStatsResponse = await aiService.getRAGStats();
      if (ragStatsResponse.success) {
        setRagStats(ragStatsResponse.data);
      }
    } catch (error) {
      console.error('Failed to load enhanced AI features:', error);
    }
  };

  const loadConversationAnalytics = async (conversationId: string) => {
    if (!conversationId) return;
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
      const data = await api.getConversation(conversationId);

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
      alert(t('title_too_long'));
      return;
    }

    try {
      // Update conversation title in the backend
      await api.updateConversationTitle(conversationId, trimmedTitle);

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
    } catch (error) {
      console.error('Failed to update conversation title:', error);
      alert(t('failed_to_update_title'));
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

    // Clear cached summary when new message is sent
    setCachedSummary(null);
    setShowSummaryModal(false);

    try {
      // Use enhanced AI service for chat
      const response = await aiService.sendChatMessage({
        message: inputMessage.trim(),
        conversationId: currentConversationId || undefined,
        includeRAG: true,
        personalizationLevel: 'high',
        context: {
          coachingStyle,
          userProfile, // Include user profile data
          userPreferences, // Include user preferences data
          userMemories: userMemories.slice(0, 5), // Include recent memories
          personalizationProfile: personalizationProfile || {
            coachingStyle: coachingStyle,
            communicationStyle: 'friendly',
            motivationType: 'achievement',
            confidence: 0.5,
          },
        },
      });

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
        content: t('error_message'),
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
        // Cache the summary and show modal
        setCachedSummary(response.summary);
        setLastMessageCount(messages.length);
        setShowSummaryModal(true);
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
          <p className="text-gray-500">{t('loading')}</p>
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
            {t('auth_required_title')}
          </h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">
            {t('auth_required_message')}
          </p>
          <Link
            href="/auth/signin"
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            {tCommon('sign_in')}
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
              {t('title')}
            </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {t('subtitle')}
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
            <div className="hidden lg:flex items-center gap-2 px-3 py-1 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
              <Brain className="h-4 w-4 text-green-600 dark:text-green-400" />
              <span className="text-xs font-medium text-green-700 dark:text-green-200">
                {ragStats.totalVectors.toLocaleString()} sources
              </span>
            </div>
          )}{' '}
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
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle AI Analytics"
          >
            <TrendingUp className="h-5 w-5" />
          </button>
          {/* Personalization Toggle */}
          <button
            onClick={() => setShowPersonalization(!showPersonalization)}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            title="Toggle Personalization"
          >
            <Settings className="h-5 w-5" />
          </button>
          {/* Conversations Button */}
          <button
            onClick={() => setShowConversations(!showConversations)}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <MessageCircle className="h-5 w-5" />
          </button>
          {/* New Conversation Button */}
          <button
            onClick={startNewConversation}
            className="p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
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
                    {t('conversations')}
                  </h2>
                )}
                <button
                  onClick={() =>
                    setConversationsCollapsed(!conversationsCollapsed)
                  }
                  className="p-1 rounded-md hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300"
                  title={
                    conversationsCollapsed
                      ? t('expand_conversations')
                      : t('collapse_conversations')
                  }
                >
                  <Menu className="h-4 w-4" />
                </button>
              </div>
              {!conversationsCollapsed && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={conversationSearch}
                    onChange={(e) => setConversationSearch(e.target.value)}
                    placeholder={t('search_conversations')}
                    className="w-full px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              )}
            </div>
            <div className="overflow-y-auto">
              {conversations.length === 0 ? (
                !conversationsCollapsed && (
                  <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                    {t('no_conversations')}
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
                            ? 'bg-blue-100 dark:bg-blue-900/50'
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
                            <MessageCircle className="h-5 w-5 text-gray-600 dark:text-gray-300" />
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
                                  : t('unknown_date')}
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
                {t('ai_analytics')}
              </h3>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Conversation Analytics */}
              {conversationAnalytics && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {t('conversation_insights')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        {t('messages')}:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {conversationAnalytics.engagementMetrics.messageCount}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        {t('satisfaction')}:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {
                          conversationAnalytics.engagementMetrics
                            .userSatisfaction
                        }
                        /5
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-300">
                        {t('sentiment')}:
                      </span>
                      <span
                        className={`font-medium ${
                          conversationAnalytics.sentimentAnalysis.overall ===
                          'positive'
                            ? 'text-green-600 dark:text-green-400'
                            : conversationAnalytics.sentimentAnalysis
                                  .overall === 'negative'
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
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
                    {t('proactive_insights')}
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
                    {t('knowledge_base')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t('total_sources')}:
                      </span>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {ragStats.totalVectors.toLocaleString()}
                      </span>
                    </div>
                    <div className="text-gray-600 dark:text-gray-400">
                      <span className="text-xs">{t('namespaces')}:</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {ragStats.namespaces.map((ns) => (
                          <span
                            key={ns}
                            className="px-2 py-1 bg-gray-100 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded text-xs"
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
                {t('personalization')}
              </h3>
            </div>
            <div className="p-4 space-y-4 overflow-y-auto">
              {/* Coaching Style Selector */}
              <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                  {t('coaching_style')}
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
                      className={`w-full text-left p-2 rounded text-sm flex items-center gap-2 transition-colors ${
                        coachingStyle === style
                          ? 'bg-blue-100 dark:bg-blue-900 text-blue-900 dark:text-blue-200'
                          : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-600'
                      }`}
                    >
                      <span>{getCoachingStyleIcon(style)}</span>
                      <span className="capitalize">{style}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* User Memories - Full List */}
              {userMemories.length > 0 && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2 flex items-center gap-2">
                    <Brain className="h-4 w-4" />
                    {t('all_ai_memories', { count: userMemories.length })}
                  </h4>
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {userMemories.map((memory) => (
                      <div
                        key={memory.id}
                        className="text-sm p-2 bg-gray-50 dark:bg-gray-600 rounded border border-gray-200 dark:border-gray-500"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-gray-900 dark:text-white capitalize text-xs">
                            {memory.type}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {Math.round(memory.importance * 100)}%
                          </span>
                        </div>
                        <div className="text-gray-600 dark:text-gray-300 text-xs">
                          {memory.content}
                        </div>
                        {memory.metadata?.category && (
                          <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            {memory.metadata.category}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Personalization Profile */}
              {personalizationProfile && (
                <div className="bg-white dark:bg-gray-700 rounded-lg p-3">
                  <h4 className="font-medium text-gray-900 dark:text-white mb-2">
                    {t('profile')}
                  </h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t('communication')}:
                      </span>
                      <span className="font-medium capitalize text-gray-900 dark:text-white">
                        {personalizationProfile.communicationStyle}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t('motivation')}:
                      </span>
                      <span className="font-medium capitalize text-gray-900 dark:text-white">
                        {personalizationProfile.motivationType}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">
                        {t('confidence')}:
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
                  {t('welcome_title')}
                </h3>
                <p className="text-gray-500 dark:text-gray-400 mb-6 max-w-md">
                  {t('welcome_message')}
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl">
                  <button
                    onClick={() =>
                      setInputMessage(t('quick_action_workout_plan'))
                    }
                    className="p-4 text-left bg-blue-50 dark:bg-blue-900/30 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/40 border border-blue-200 dark:border-blue-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Dumbbell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        {t('smart_workout_plan_title')}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t('smart_workout_plan_desc')}
                    </div>
                  </button>

                  <button
                    onClick={() => setInputMessage(t('quick_action_meal_plan'))}
                    className="p-4 text-left bg-green-50 dark:bg-green-900/30 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/40 border border-green-200 dark:border-green-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Apple className="h-6 w-6 text-green-600 dark:text-green-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        {t('nutrition_intelligence_title')}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t('nutrition_intelligence_desc')}
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setInputMessage(t('quick_action_progress_analysis'))
                    }
                    className="p-4 text-left bg-purple-50 dark:bg-purple-900/30 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/40 border border-purple-200 dark:border-purple-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        {t('performance_analysis_title')}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t('performance_analysis_desc')}
                    </div>
                  </button>

                  <button
                    onClick={() =>
                      setInputMessage(t('quick_action_motivation'))
                    }
                    className="p-4 text-left bg-orange-50 dark:bg-orange-900/30 rounded-lg hover:bg-orange-100 dark:hover:bg-orange-900/40 border border-orange-200 dark:border-orange-800 transition-colors"
                  >
                    <div className="flex items-center space-x-3 mb-2">
                      <Target className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      <div className="font-medium text-gray-900 dark:text-white">
                        {t('personalized_coaching_title')}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t('personalized_coaching_desc')}
                    </div>
                  </button>
                </div>

                {/* Enhanced Features Showcase */}
                {(personalizationProfile || ragStats) && (
                  <div className="mt-8 max-w-2xl">
                    <div className="text-center mb-4">
                      <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('powered_by_advanced_ai')}
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                      {personalizationProfile && (
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800">
                          <div className="text-2xl mb-1">
                            {getCoachingStyleIcon(coachingStyle)}
                          </div>
                          <div className="text-xs font-medium text-blue-900 dark:text-blue-200 capitalize">
                            {coachingStyle} {t('style')}
                          </div>
                          <div className="text-xs text-blue-700 dark:text-blue-300">
                            {t('personalized_coaching_desc')}
                          </div>
                        </div>
                      )}

                      {ragStats && (
                        <div className="p-3 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-800">
                          <div className="text-2xl mb-1">🧠</div>
                          <div className="text-xs font-medium text-green-900 dark:text-green-200">
                            {ragStats.totalVectors.toLocaleString()}+{' '}
                            {t('sources')}
                          </div>
                          <div className="text-xs text-green-700 dark:text-green-300">
                            {t('knowledge_base_desc')}
                          </div>
                        </div>
                      )}

                      {userMemories.length > 0 && (
                        <div className="p-3 bg-purple-50 dark:bg-purple-900/30 rounded-lg border border-purple-200 dark:border-purple-800">
                          <div className="text-2xl mb-1">💭</div>
                          <div className="text-xs font-medium text-purple-900 dark:text-purple-200">
                            {userMemories.length} {t('memories')}
                          </div>
                          <div className="text-xs text-purple-700 dark:text-purple-300">
                            {t('long_term_context')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="mx-auto w-full max-w-3xl space-y-4">
                {messages.map((message) => {
                  // Extract reasoning from message content
                  const reasoningMatch = message.content.match(
                    /<reasoning>([\s\S]*?)<\/reasoning>/
                  );
                  const reasoning = reasoningMatch
                    ? reasoningMatch[1].trim()
                    : null;
                  let mainContent = message.content
                    .replace(/<reasoning>[\s\S]*?<\/reasoning>/, '')
                    .trim();
                  // Process HTML entities and special characters
                  mainContent = processContent(mainContent);

                  return (
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
                            {/* Reasoning Section (Collapsible, Blurred, Small Text) */}
                            {reasoning && (
                              <ReasoningSection reasoning={reasoning} />
                            )}

                            <ReactMarkdown
                              remarkPlugins={[remarkGfm]}
                              components={{
                                p: ({ children }) => (
                                  <p className="mb-2 last:mb-0">{children}</p>
                                ),
                                ul: ({ children }) => (
                                  <ul className="list-disc list-inside mb-2 last:mb-0 space-y-1">
                                    {children}
                                  </ul>
                                ),
                                ol: ({ children }) => (
                                  <ol className="list-decimal list-inside mb-2 last:mb-0 space-y-1">
                                    {children}
                                  </ol>
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
                                  <code className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 px-1 py-0.5 rounded text-sm font-mono">
                                    {children}
                                  </code>
                                ),
                                pre: ({ children }) => (
                                  <pre className="bg-gray-200 dark:bg-gray-800 text-gray-900 dark:text-gray-100 p-3 rounded overflow-x-auto mb-2 last:mb-0 text-sm">
                                    {children}
                                  </pre>
                                ),
                                blockquote: ({ children }) => (
                                  <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic text-gray-700 dark:text-gray-300 my-2">
                                    {children}
                                  </blockquote>
                                ),
                                table: ({ children }) => (
                                  <div className="overflow-x-auto my-3 rounded-lg border border-gray-300 dark:border-gray-600">
                                    <table className="w-full text-sm border-collapse">
                                      {children}
                                    </table>
                                  </div>
                                ),
                                thead: ({ children }) => (
                                  <thead className="bg-gray-100 dark:bg-gray-700 border-b-2 border-gray-300 dark:border-gray-600">
                                    {children}
                                  </thead>
                                ),
                                tbody: ({ children }) => (
                                  <tbody className="divide-y divide-gray-200 dark:divide-gray-600">
                                    {children}
                                  </tbody>
                                ),
                                tr: ({ children }) => (
                                  <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    {children}
                                  </tr>
                                ),
                                td: ({ children }) => (
                                  <td className="px-3 py-2 text-gray-900 dark:text-gray-100 border-r border-gray-200 dark:border-gray-600 last:border-r-0">
                                    {children}
                                  </td>
                                ),
                                th: ({ children }) => (
                                  <th className="px-3 py-2 text-gray-900 dark:text-gray-100 font-semibold border-r border-gray-300 dark:border-gray-600 last:border-r-0 text-left">
                                    {children}
                                  </th>
                                ),
                              }}
                            >
                              {mainContent}
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
                  );
                })}
              </div>
            )}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white px-4 py-2 rounded-lg">
                  <div className="flex items-center space-x-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>{t('ai_thinking')}</span>
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-200 dark:border-gray-700 p-4">
            {/* Memory Section - Collapsible */}
            {userMemories.length > 0 && (
              <div className="mx-auto w-full max-w-3xl mb-3">
                <details className="group bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <summary className="cursor-pointer p-3 flex items-center justify-between hover:bg-blue-100 dark:hover:bg-blue-900/40 rounded-lg transition-colors">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-900 dark:text-blue-200">
                      <Brain className="h-4 w-4" />
                      <span>
                        {t('ai_memories', { count: userMemories.length })}
                      </span>
                    </div>
                    <ChevronDown className="h-4 w-4 text-blue-600 dark:text-blue-400 group-open:rotate-180 transition-transform" />
                  </summary>
                  <div className="p-3 pt-0 space-y-2 max-h-48 overflow-y-auto">
                    {userMemories.slice(0, 5).map((memory) => (
                      <div
                        key={memory.id}
                        className="text-sm p-2 bg-white dark:bg-gray-800 rounded border border-blue-100 dark:border-gray-700"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-blue-900 dark:text-blue-200 capitalize text-xs">
                            {memory.type}
                          </span>
                          <span className="text-xs text-gray-500 dark:text-gray-400">
                            {Math.round(memory.importance * 100)}%{' '}
                            {t('importance')}
                          </span>
                        </div>
                        <div className="text-gray-700 dark:text-gray-300 text-xs">
                          {memory.content}
                        </div>
                      </div>
                    ))}
                    {userMemories.length > 5 && (
                      <button
                        onClick={() => setShowPersonalization(true)}
                        className="text-xs text-blue-600 dark:text-blue-400 hover:underline w-full text-center py-1"
                      >
                        {t('view_all_memories', { count: userMemories.length })}
                      </button>
                    )}
                  </div>
                </details>
              </div>
            )}

            <div className="mx-auto w-full max-w-3xl flex space-x-2">
              <input
                type="text"
                value={inputMessage}
                onChange={(e) => setInputMessage(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder={t('input_placeholder')}
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
                  t('quick_action_1'),
                  t('quick_action_2'),
                  t('quick_action_3'),
                  t('quick_action_4'),
                ].map((s) => (
                  <button
                    key={s}
                    onClick={() => setInputMessage(s)}
                    className="px-3 py-1 rounded-full border border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>

              {/* AI Features Status */}
              <div className="flex items-center justify-between text-xs text-gray-600 dark:text-gray-400">
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
                      className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                      title="Summarize conversation"
                    >
                      <Lightbulb className="h-3 w-3" />
                      <span>{t('summarize')}</span>
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

      {/* Summary Modal */}
      <SummaryModal
        isOpen={showSummaryModal}
        summary={cachedSummary}
        onClose={() => setShowSummaryModal(false)}
      />
    </div>
  );
}
