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
  const [showConversations, setShowConversations] = useState(false); // Start hidden on mobile
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
      setShowConversations(false); // Close sidebar on mobile after selecting

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
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 p-3 sm:p-4 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm">
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          <div className="p-1.5 sm:p-2 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg sm:rounded-xl shadow-md flex-shrink-0">
            <Bot className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white truncate">
              {t('title')}
            </h1>
            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 truncate hidden sm:block">
              {t('subtitle')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Coaching Style Indicator */}
          {personalizationProfile && (
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-700">
              <span className="text-sm">
                {getCoachingStyleIcon(coachingStyle)}
              </span>
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 capitalize">
                {coachingStyle}
              </span>
            </div>
          )}

          {/* Rate Limit Indicator */}
          {rateLimit && (
            <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
              <Zap className="h-4 w-4 text-yellow-500" />
              <div className="flex items-center gap-2">
                <div className="w-24 h-2 bg-gray-200 dark:bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-2 bg-gradient-to-r from-blue-500 to-blue-600 transition-all"
                    style={{ width: `${getRateLimitPercent()}%` }}
                  />
                </div>
                <span className={`text-xs font-medium ${getRateLimitColor()}`}>
                  {rateLimit.requestsRemaining}
                </span>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowConversations(!showConversations)}
              className={`p-1.5 sm:p-2 rounded-lg transition-colors ${
                showConversations
                  ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-400'
                  : 'text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
              title="Conversations"
            >
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>

            <button
              onClick={startNewConversation}
              className="p-1.5 sm:p-2 text-gray-600 hover:text-gray-900 dark:text-gray-300 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="New Conversation"
            >
              <RefreshCw className="h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden relative">
        {/* Conversations Sidebar */}
        {showConversations && (
          <>
            {/* Overlay for mobile */}
            <div
              className="fixed inset-0 bg-black/50 z-40 md:hidden"
              onClick={() => setShowConversations(false)}
            />

            <div className="fixed md:relative inset-y-0 left-0 z-50 md:z-0 w-80 md:w-80 border-r border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 flex flex-col flex-shrink-0 shadow-xl md:shadow-none">
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {t('conversations')}
                  </h2>
                  <button
                    onClick={() => setShowConversations(false)}
                    className="md:hidden p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-500 dark:text-gray-400"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
                <input
                  type="text"
                  value={conversationSearch}
                  onChange={(e) => setConversationSearch(e.target.value)}
                  placeholder={t('search_conversations')}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                {conversations.length === 0 ? (
                  <div className="p-8 text-center">
                    <MessageCircle className="h-12 w-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {t('no_conversations')}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1">
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
                          className={`p-3 rounded-lg cursor-pointer transition-all ${
                            currentConversationId ===
                            conversation.conversationId
                              ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700'
                              : 'hover:bg-gray-50 dark:hover:bg-gray-700 border border-transparent'
                          } group`}
                          onClick={() =>
                            loadConversation(conversation.conversationId)
                          }
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              {editingConversationId ===
                              conversation.conversationId ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="text"
                                    value={editingTitle}
                                    onChange={(e) =>
                                      setEditingTitle(e.target.value)
                                    }
                                    className="flex-1 text-sm font-medium text-gray-900 dark:text-white bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    onKeyPress={(e) => {
                                      if (e.key === 'Enter') {
                                        saveConversationTitle(
                                          conversation.conversationId
                                        );
                                      } else if (e.key === 'Escape') {
                                        cancelEditingConversation();
                                      }
                                    }}
                                    onClick={(e) => e.stopPropagation()}
                                    autoFocus
                                  />
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      saveConversationTitle(
                                        conversation.conversationId
                                      );
                                    }}
                                    className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300"
                                  >
                                    <Check className="h-4 w-4" />
                                  </button>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelEditingConversation();
                                    }}
                                    className="p-1 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                                  >
                                    <X className="h-4 w-4" />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="text-sm font-medium text-gray-900 dark:text-white truncate flex-1">
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
                                      className="p-1 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                                    >
                                      <Edit2 className="h-3 w-3" />
                                    </button>
                                  </div>
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {conversation.lastMessageAt
                                        ? new Date(
                                            conversation.lastMessageAt
                                          ).toLocaleDateString()
                                        : t('unknown_date')}
                                    </p>
                                    <span className="text-xs text-gray-400 dark:text-gray-500">
                                      {conversation.messageCount} msgs
                                    </span>
                                  </div>
                                </>
                              )}
                            </div>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (confirm(t('confirm_delete'))) {
                                  deleteConversation(
                                    conversation.conversationId
                                  );
                                }
                              }}
                              className="p-1 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
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
          </>
        )}

        {/* Chat Area */}
        <div className="flex-1 flex flex-col bg-white dark:bg-gray-900 min-w-0">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 dark:bg-gray-900">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center px-4">
                <div className="p-4 bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl shadow-lg mb-6">
                  <Bot className="h-16 w-16 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">
                  {t('welcome_title')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-8 max-w-md">
                  {t('welcome_message')}
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-3xl w-full">
                  <button
                    onClick={() =>
                      setInputMessage(t('quick_action_workout_plan'))
                    }
                    className="group p-6 text-left bg-white dark:bg-gray-800 rounded-xl hover:shadow-lg border-2 border-gray-200 dark:border-gray-700 hover:border-blue-500 dark:hover:border-blue-500 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg group-hover:scale-110 transition-transform">
                        <Dumbbell className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {t('smart_workout_plan_title')}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t('smart_workout_plan_desc')}
                    </div>
                  </button>

                  <button
                    onClick={() => setInputMessage(t('quick_action_meal_plan'))}
                    className="group p-6 text-left bg-white dark:bg-gray-800 rounded-xl hover:shadow-lg border-2 border-gray-200 dark:border-gray-700 hover:border-green-500 dark:hover:border-green-500 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg group-hover:scale-110 transition-transform">
                        <Apple className="h-6 w-6 text-green-600 dark:text-green-400" />
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
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
                    className="group p-6 text-left bg-white dark:bg-gray-800 rounded-xl hover:shadow-lg border-2 border-gray-200 dark:border-gray-700 hover:border-purple-500 dark:hover:border-purple-500 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-lg group-hover:scale-110 transition-transform">
                        <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
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
                    className="group p-6 text-left bg-white dark:bg-gray-800 rounded-xl hover:shadow-lg border-2 border-gray-200 dark:border-gray-700 hover:border-orange-500 dark:hover:border-orange-500 transition-all"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-orange-100 dark:bg-orange-900 rounded-lg group-hover:scale-110 transition-transform">
                        <Target className="h-6 w-6 text-orange-600 dark:text-orange-400" />
                      </div>
                      <div className="font-semibold text-gray-900 dark:text-white">
                        {t('personalized_coaching_title')}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-300">
                      {t('personalized_coaching_desc')}
                    </div>
                  </button>
                </div>
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
                      className={`flex items-end gap-2 sm:gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {message.role === 'assistant' && (
                        <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center flex-shrink-0">
                          <Bot className="h-3 w-3 sm:h-4 sm:w-4 text-blue-600 dark:text-blue-400" />
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-2 rounded-2xl shadow-sm ${
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
                        <div className="h-6 w-6 sm:h-8 sm:w-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center text-xs font-semibold text-gray-700 dark:text-gray-200 flex-shrink-0">
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
          <div className="border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-3 sm:p-4">
            <div className="mx-auto w-full max-w-4xl">
              <div className="flex gap-2 sm:gap-3">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder={t('input_placeholder')}
                  className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 text-sm border border-gray-300 dark:border-gray-600 rounded-lg sm:rounded-xl shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  disabled={isLoading}
                />
                <button
                  onClick={sendMessage}
                  disabled={!inputMessage.trim() || isLoading}
                  className="px-4 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg sm:rounded-xl hover:from-blue-700 hover:to-blue-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-md transition-all hover:shadow-lg flex-shrink-0"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline font-medium">Send</span>
                </button>
              </div>

              {/* Quick Actions */}
              <div className="mt-2 sm:mt-3 flex flex-wrap gap-1.5 sm:gap-2">
                {[
                  t('quick_action_1'),
                  t('quick_action_2'),
                  t('quick_action_3'),
                  t('quick_action_4'),
                ].map((action) => (
                  <button
                    key={action}
                    onClick={() => setInputMessage(action)}
                    className="px-2.5 sm:px-3 py-1 sm:py-1.5 text-xs rounded-full border border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 transition-colors"
                  >
                    {action}
                  </button>
                ))}
              </div>

              {/* Status Bar */}
              {currentConversationId && (
                <div className="mt-2 sm:mt-3 flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                  <div className="flex items-center gap-2 sm:gap-3">
                    {personalizationProfile && (
                      <div className="flex items-center gap-1">
                        <span>{getCoachingStyleIcon(coachingStyle)}</span>
                        <span className="hidden sm:inline capitalize">
                          {coachingStyle}
                        </span>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={summarizeConversation}
                    className="flex items-center gap-1 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
                  >
                    <Lightbulb className="h-3 w-3" />
                    <span className="hidden sm:inline">{t('summarize')}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Summary Modal */}
      <SummaryModal
        isOpen={showSummaryModal}
        summary={cachedSummary}
        onClose={() => setShowSummaryModal(false)}
      />
    </div>
  );
}
