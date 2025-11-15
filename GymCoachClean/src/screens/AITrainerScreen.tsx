import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
  Animated,
  Dimensions,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Icon} from '../components/common/Icon';
import Markdown from 'react-native-markdown-display';
import apiClient from '../services/api';
import {useTranslation} from 'react-i18next';
import ConfidenceIndicator from '../components/ai/ConfidenceIndicator';
import RAGSourcesDisplay from '../components/ai/RAGSourcesDisplay';
import MemoryViewer from '../components/ai/MemoryViewer';
import FloatingSettingsButton from '../components/common/FloatingSettingsButton';
import MessageItem from '../components/ai/MessageItem';
import WorkoutPlanCreator from '../components/ai/WorkoutPlanCreator';
import {useTheme} from '../theme';

interface RAGSource {
  document: string;
  score: number;
  metadata?: {
    type?: string;
    timestamp?: string;
  };
}

interface RAGContext {
  sources: RAGSource[];
  queryType?: string;
  relevanceScores?: number[];
}

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
  id: string;
  conversationId?: string;
  title: string;
  createdAt: string;
  lastMessageAt: string;
  firstMessage?: string;
}

interface RateLimit {
  limit?: number;
  requestsRemaining: number;
  requestsUsed: number;
  resetAt: string;
  tier: string;
}

interface MemoryItem {
  id: string;
  content: string;
  type: string;
  importance: number;
  timestamp: string;
  metadata?: {
    category?: string;
    confidence?: number;
  };
}

interface PersonalizationProfile {
  coachingStyle: string;
  communicationStyle: string;
  motivationType: string;
  confidence: number;
}

interface ProactiveInsight {
  id: string;
  type: string;
  title: string;
  content: string;
  priority: string;
  actionable: boolean;
  metadata?: any;
}

const AITrainerScreen: React.FC = () => {
  const {t} = useTranslation();
  const {colors, isDark} = useTheme();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [showConversations, setShowConversations] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<
    string | null
  >(null);
  const [editingTitle, setEditingTitle] = useState('');

  // Enhanced AI features state
  const [userMemories, setUserMemories] = useState<MemoryItem[]>([]);
  const [personalizationProfile, setPersonalizationProfile] =
    useState<PersonalizationProfile | null>(null);
  const [proactiveInsights, setProactiveInsights] = useState<
    ProactiveInsight[]
  >([]);
  const [coachingStyle, setCoachingStyle] = useState<string>('balanced');
  const [showMemoryPanel, setShowMemoryPanel] = useState(false);
  const [showInsightsPanel, setShowInsightsPanel] = useState(false);
  const [showPersonalizationPanel, setShowPersonalizationPanel] =
    useState(false);
  const [ragStats, setRagStats] = useState<{
    totalVectors: number;
    namespaces: string[];
  } | null>(null);
  const [showWorkoutPlanCreator, setShowWorkoutPlanCreator] = useState(false);

  const scrollViewRef = useRef<FlatList<Message>>(null);
  const drawerAnimation = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadConversations();
    loadRateLimit();
    loadEnhancedAIFeatures();
  }, []);

  useEffect(() => {
    Animated.timing(drawerAnimation, {
      toValue: showConversations ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showConversations]);

  const loadEnhancedAIFeatures = async () => {
    try {
      console.log('Loading enhanced AI features...');

      // Load personalization profile
      try {
        const profileResponse = await apiClient.getPersonalizationProfile();
        if (profileResponse && profileResponse.coachingStyle) {
          setPersonalizationProfile(profileResponse);
          setCoachingStyle(profileResponse.coachingStyle || 'balanced');
        }
      } catch (error) {
        console.warn('Personalization profile not available:', error);
        // Set default profile
        setPersonalizationProfile({
          coachingStyle: 'balanced',
          communicationStyle: 'friendly',
          motivationType: 'encouraging',
          confidence: 0.5,
        });
      }

      // Load user memories
      try {
        const memoriesResponse = await apiClient.retrieveRelevantMemories(
          'user preferences and goals',
        );
        if (memoriesResponse && memoriesResponse.success) {
          setUserMemories(memoriesResponse.data || []);
        }
      } catch (error) {
        console.warn('Memories not available:', error);
        setUserMemories([]);
      }

      // Load proactive insights
      try {
        const insightsResponse = await apiClient.getProactiveInsights();
        if (insightsResponse) {
          setProactiveInsights(insightsResponse);
        }
      } catch (error) {
        console.warn('Proactive insights not available:', error);
        setProactiveInsights([]);
      }

      // Load RAG stats
      try {
        const ragStatsResponse = await apiClient.getRAGStats();
        if (ragStatsResponse && ragStatsResponse.success) {
          setRagStats(ragStatsResponse.data);
        }
      } catch (error) {
        console.warn('RAG stats not available:', error);
        setRagStats(null);
      }

      console.log('Enhanced AI features loaded successfully');
    } catch (error) {
      console.error('Failed to load enhanced AI features:', error);
    }
  };

  const loadConversations = async () => {
    try {
      const data = await apiClient.getConversations();
      console.log('Loaded conversations:', data);
      setConversations(data);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    }
  };

  const loadRateLimit = async () => {
    try {
      const data = await apiClient.getRateLimit();
      setRateLimit(data);
    } catch (error) {
      console.error('Failed to load rate limit:', error);
    }
  };

  const loadConversation = async (conversationId: string) => {
    try {
      console.log('Loading conversation:', conversationId);
      const conversation = await apiClient.getConversation(conversationId);
      console.log('Conversation data:', conversation);

      // Handle different response formats
      let messages: Message[] = [];

      if (conversation.messages && Array.isArray(conversation.messages)) {
        messages = conversation.messages.map((msg: any) => ({
          id:
            msg.id ||
            msg.messageId ||
            (msg.timestamp || msg.createdAt || Date.now()).toString(),
          role: msg.role || msg.sender || 'user',
          content: msg.content || msg.text || msg.message || '',
          timestamp: new Date(msg.timestamp || msg.createdAt || Date.now()),
        }));
      } else if (conversation.data && conversation.data.messages) {
        messages = conversation.data.messages.map((msg: any) => ({
          id:
            msg.id ||
            msg.messageId ||
            (msg.timestamp || msg.createdAt || Date.now()).toString(),
          role: msg.role || msg.sender || 'user',
          content: msg.content || msg.text || msg.message || '',
          timestamp: new Date(msg.timestamp || msg.createdAt || Date.now()),
        }));
      }

      console.log('Processed messages:', messages);
      setMessages(messages);
      setCurrentConversationId(conversationId);
      setShowConversations(false); // Close drawer after selection
    } catch (error) {
      console.error('Failed to load conversation:', error);
      Alert.alert(
        t('common.error'),
        t('common.errors.failed_to_load_conversation'),
      );
    }
  };

  const startEditingConversation = (
    conversationId: string,
    currentTitle: string,
  ) => {
    console.log('Starting to edit conversation:', {
      conversationId,
      currentTitle,
    });
    setEditingConversationId(conversationId);
    setEditingTitle(currentTitle);
  };

  const cancelEditingConversation = () => {
    setEditingConversationId(null);
    setEditingTitle('');
  };

  const saveConversationTitle = async () => {
    if (!editingConversationId || !editingTitle.trim()) return;

    const trimmedTitle = editingTitle.trim();
    if (trimmedTitle.length > 100) {
      Alert.alert(t('common.error'), t('common.errors.title_too_long'));
      return;
    }

    console.log('Saving conversation title:', {
      conversationId: editingConversationId,
      title: trimmedTitle,
    });

    try {
      // Update conversation title in the backend
      console.log('Calling API to update conversation title...');
      await apiClient.updateConversationTitle(
        editingConversationId,
        trimmedTitle,
      );
      console.log('API call successful');

      // Update local state
      setConversations(prev =>
        prev.map(conv => {
          const convId = conv.id || conv.conversationId || '';
          return convId === editingConversationId
            ? {...conv, title: trimmedTitle}
            : conv;
        }),
      );

      setEditingConversationId(null);
      setEditingTitle('');
      console.log('Conversation title updated successfully');
    } catch (error) {
      console.error('Failed to update conversation title:', error);
      Alert.alert(
        t('common.error'),
        t('common.errors.failed_to_update_conversation_title'),
      );
    }
  };

  const getConversationTitle = (conversation: Conversation) => {
    if (conversation.title) return conversation.title;

    // Try to get first user message as title
    const firstUserMessage = conversation.firstMessage;
    if (firstUserMessage) {
      return firstUserMessage.length > 50
        ? firstUserMessage.substring(0, 50) + '...'
        : firstUserMessage;
    }

    return conversation.id;
  };

  const startNewConversation = () => {
    setMessages([]);
    setCurrentConversationId(null);
    setShowConversations(false);
  };

  const deleteConversation = async (conversationId: string) => {
    Alert.alert(
      'Delete Conversation',
      'Are you sure you want to delete this conversation?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await apiClient.deleteConversation(conversationId);
              setConversations(
                conversations.filter(c => c.id !== conversationId),
              );
              if (currentConversationId === conversationId) {
                startNewConversation();
              }
            } catch (error) {
              console.error('Failed to delete conversation:', error);
              Alert.alert(
                t('common.error'),
                t('common.errors.failed_to_delete_conversation'),
              );
            }
          },
        },
      ],
    );
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Enhanced chat message with personalization context
      const response = await apiClient.sendChatMessage(
        inputMessage.trim(),
        currentConversationId || undefined,
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content:
          (response as any).reply ||
          (response as any).response ||
          (response as any).message ||
          'No response received',
        timestamp: new Date(),
        ragContext: (response as any).ragContext,
        confidence:
          (response as any).metadata?.confidence ||
          (response as any).confidence,
        personalizationStyle: personalizationProfile?.coachingStyle,
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (!currentConversationId && (response as any).conversationId) {
        setCurrentConversationId((response as any).conversationId);
        loadConversations();
      }

      if ((response as any).remainingRequests !== undefined) {
        setRateLimit(prev =>
          prev
            ? {
                ...prev,
                requestsRemaining: (response as any).remainingRequests,
              }
            : null,
        );
      }

      // Refresh memories after conversation to get any new memories stored
      try {
        const memoriesResponse = await apiClient.retrieveRelevantMemories(
          'user preferences and goals',
        );
        if (memoriesResponse && memoriesResponse.success) {
          setUserMemories(memoriesResponse.data || []);
        }
      } catch (error) {
        console.error('Failed to refresh memories:', error);
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([loadConversations(), loadRateLimit()]);
    setRefreshing(false);
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'});
  };

  // Helper function to process and clean content
  const processContent = (content: string): string => {
    // Replace HTML line breaks with newlines
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
  };

  const getRateLimitColor = () => {
    if (!rateLimit) return '#9ca3af';
    const percentage =
      (rateLimit.requestsRemaining / (rateLimit.limit || 10)) * 100;
    if (percentage > 50) return '#10b981';
    if (percentage > 25) return '#f59e0b';
    return '#ef4444';
  };

  const markdownStyles = {
    body: {
      fontSize: 14,
      lineHeight: 20,
      color: '#111827',
    },
    paragraph: {
      marginBottom: 8,
    },
    heading1: {
      fontSize: 18,
      fontWeight: '600' as const,
      color: '#111827',
      marginBottom: 8,
    },
    heading2: {
      fontSize: 16,
      fontWeight: '600' as const,
      color: '#111827',
      marginBottom: 6,
    },
    heading3: {
      fontSize: 14,
      fontWeight: '600' as const,
      color: '#111827',
      marginBottom: 4,
    },
    code_inline: {
      backgroundColor: '#f3f4f6',
      paddingHorizontal: 4,
      paddingVertical: 2,
      borderRadius: 4,
      fontSize: 13,
      fontFamily: 'monospace',
    },
    code_block: {
      backgroundColor: '#f3f4f6',
      padding: 12,
      borderRadius: 8,
      fontSize: 13,
      fontFamily: 'monospace',
      marginVertical: 8,
    },
    list_item: {
      marginBottom: 4,
      marginLeft: 8,
    },
    bullet_list: {
      marginBottom: 8,
    },
    ordered_list: {
      marginBottom: 8,
    },
    strong: {
      fontWeight: '600' as const,
    },
    em: {
      fontStyle: 'italic' as const,
    },
    link: {
      color: '#3b82f6',
      textDecorationLine: 'underline' as const,
    },
    table: {
      marginVertical: 8,
      borderWidth: 1,
      borderColor: '#d1d5db',
      borderRadius: 8,
    } as any,
    thead: {
      backgroundColor: '#f3f4f6',
    } as any,
    tbody: {
      backgroundColor: 'white',
    } as any,
    tr: {
      borderBottomWidth: 1,
      borderBottomColor: '#e5e7eb',
      flexDirection: 'row' as const,
    } as any,
    th: {
      fontWeight: '600' as const,
      flex: 1,
      padding: 8,
      backgroundColor: '#f3f4f6',
      color: '#111827',
      fontSize: 13,
    } as any,
    td: {
      flex: 1,
      padding: 8,
      color: '#374151',
      fontSize: 12,
      borderRightWidth: 1,
      borderRightColor: '#e5e7eb',
    } as any,
  };

  const renderMessage = ({item}: {item: Message}) => {
    return (
      <MessageItem
        item={item}
        styles={styles}
        markdownStyles={markdownStyles}
        formatTime={formatTime}
        processContent={processContent}
      />
    );
  };

  const renderConversation = ({item}: {item: Conversation}) => {
    const conversationId = item.id || item.conversationId || '';
    const isEditing = editingConversationId === conversationId;

    return (
      <Pressable
        style={[
          styles.conversationItem,
          currentConversationId === conversationId && styles.activeConversation,
        ]}
        onPress={() =>
          !isEditing && conversationId && loadConversation(conversationId)
        }>
        <View style={styles.conversationContent}>
          {isEditing ? (
            <View style={styles.editingContainer}>
              <TextInput
                style={styles.editingInput}
                value={editingTitle}
                onChangeText={setEditingTitle}
                autoFocus
                selectTextOnFocus
                placeholder={t('ai_trainer.enter_conversation_title')}
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={saveConversationTitle}
              />
              <Text style={styles.characterCount}>
                {editingTitle.length}/100 characters
              </Text>
              <View style={styles.editingButtons}>
                <Pressable
                  onPress={() => {
                    console.log('Save button pressed');
                    saveConversationTitle();
                  }}
                  style={styles.saveButton}>
                  <Icon name="check" size={16} color="#10b981" />
                </Pressable>
                <Pressable
                  onPress={cancelEditingConversation}
                  style={styles.cancelButton}>
                  <Icon name="close" size={16} color="#ef4444" />
                </Pressable>
              </View>
            </View>
          ) : (
            <>
              <Text style={styles.conversationTitle} numberOfLines={1}>
                {getConversationTitle(item)}
              </Text>
              <Text style={styles.conversationDate}>
                {new Date(
                  item.lastMessageAt || item.createdAt,
                ).toLocaleDateString()}
              </Text>
            </>
          )}
        </View>
        {!isEditing && (
          <View style={styles.conversationActions}>
            <Pressable
              onPress={() => {
                console.log(
                  'Edit button pressed for conversation:',
                  conversationId,
                );
                if (conversationId) {
                  startEditingConversation(
                    conversationId,
                    getConversationTitle(item),
                  );
                }
              }}
              style={styles.editButton}>
              <Icon name="edit" size={16} color="#6b7280" />
            </Pressable>
            <Pressable
              onPress={() =>
                conversationId && deleteConversation(conversationId)
              }
              style={styles.deleteButton}>
              <Icon name="delete" size={16} color="#ef4444" />
            </Pressable>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{flex: 1}}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {backgroundColor: colors.card, borderBottomColor: colors.border},
          ]}>
          <View style={styles.headerLeft}>
            <View style={styles.iconContainer}>
              <Icon name="smart-toy" size={24} color="#3b82f6" />
            </View>
            <View>
              <Text style={[styles.headerTitle, {color: colors.text}]}>
                {t('ai_trainer.title')}
              </Text>
              <Text style={[styles.headerSubtitle, {color: colors.subtext}]}>
                {t('ai_trainer.subtitle')}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            {rateLimit && (
              <View style={styles.rateLimitContainer}>
                <Icon name="flash-on" size={16} color={getRateLimitColor()} />
                <Text
                  style={[styles.rateLimitText, {color: getRateLimitColor()}]}>
                  {rateLimit.requestsRemaining}
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => setShowWorkoutPlanCreator(true)}
              style={[styles.headerButton, styles.createPlanButton]}>
              <Icon name="dumbbell" size={20} color="#10b981" />
            </Pressable>

            <Pressable
              onPress={() => setShowMemoryPanel(true)}
              style={styles.headerButton}>
              <Icon name="memory" size={20} color="#6b7280" />
              {userMemories.length > 0 && <View style={styles.badgeDot} />}
            </Pressable>

            <Pressable
              onPress={() => setShowInsightsPanel(true)}
              style={styles.headerButton}>
              <Icon name="lightbulb" size={20} color="#6b7280" />
              {proactiveInsights.length > 0 && <View style={styles.badgeDot} />}
            </Pressable>

            <Pressable
              onPress={() => setShowConversations(!showConversations)}
              style={styles.headerButton}>
              <Icon name="chat" size={20} color="#6b7280" />
            </Pressable>

            <Pressable
              onPress={startNewConversation}
              style={styles.headerButton}>
              <Icon name="refresh" size={20} color="#6b7280" />
            </Pressable>
          </View>
        </View>

        <View style={styles.content}>
          {/* Conversations Drawer */}
          <Animated.View
            style={[
              styles.drawer,
              {
                backgroundColor: colors.card,
                borderRightColor: colors.border,
                transform: [
                  {
                    translateX: drawerAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-280, 0],
                    }),
                  },
                ],
              },
            ]}>
            <View
              style={[
                styles.sidebarHeader,
                {borderBottomColor: colors.border},
              ]}>
              <Text style={[styles.sidebarTitle, {color: colors.text}]}>
                {t('ai_trainer.conversations')}
              </Text>
              <Pressable
                onPress={() => setShowConversations(false)}
                style={styles.closeButton}>
                <Icon name="close" size={20} color={colors.subtext} />
              </Pressable>
            </View>
            <FlatList
              data={conversations}
              renderItem={renderConversation}
              keyExtractor={item =>
                item.id || item.conversationId || item.title
              }
              style={styles.conversationsList}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    {t('ai_trainer.no_conversations')}
                  </Text>
                </View>
              }
            />
          </Animated.View>

          {/* Overlay */}
          {showConversations && (
            <Pressable
              style={styles.overlay}
              onPress={() => setShowConversations(false)}
            />
          )}

          {/* Chat Area */}
          <View style={styles.chatContainer}>
            {messages.length === 0 ? (
              <View style={styles.welcomeContainer}>
                <Icon
                  name="smart-toy"
                  size={64}
                  color={isDark ? '#4b5563' : '#d1d5db'}
                />
                <Text style={[styles.welcomeTitle, {color: colors.text}]}>
                  {t('ai_trainer.welcome_title')}
                </Text>
                <Text style={[styles.welcomeSubtitle, {color: colors.subtext}]}>
                  {t('ai_trainer.welcome_subtitle')}
                </Text>
                <Text style={[styles.welcomeQuestion, {color: colors.text}]}>
                  {t('ai_trainer.welcome_question')}
                </Text>
              </View>
            ) : (
              <FlatList
                ref={scrollViewRef}
                data={messages}
                renderItem={renderMessage}
                keyExtractor={item => item.id}
                style={styles.messagesList}
                keyboardShouldPersistTaps="handled"
                refreshControl={
                  <RefreshControl
                    refreshing={refreshing}
                    onRefresh={onRefresh}
                  />
                }
              />
            )}

            {isLoading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#3b82f6" />
                <Text style={styles.loadingText}>
                  {t('ai_trainer.thinking')}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Input Area */}
        <View
          style={[
            styles.inputContainer,
            {backgroundColor: colors.card, borderTopColor: colors.border},
          ]}>
          <TextInput
            style={[
              styles.textInput,
              {
                color: colors.text,
                borderColor: colors.border,
                backgroundColor: colors.surface,
              },
            ]}
            value={inputMessage}
            onChangeText={setInputMessage}
            placeholder={t('ai_trainer.ask_anything')}
            placeholderTextColor={colors.subtext}
            multiline
            maxLength={500}
            editable={!isLoading}
            accessible={true}
            accessibilityLabel="AI Trainer message input"
            accessibilityHint="Type your question or message for the AI trainer"
          />
          <Pressable
            onPress={sendMessage}
            disabled={!inputMessage.trim() || isLoading}
            style={[
              styles.sendButton,
              (!inputMessage.trim() || isLoading) && styles.sendButtonDisabled,
            ]}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            accessibilityHint="Send your message to the AI trainer"
            accessibilityState={{disabled: !inputMessage.trim() || isLoading}}>
            <Icon name="send" size={20} color="white" />
          </Pressable>
        </View>

        {/* Memory Panel Modal */}
        <Modal
          visible={showMemoryPanel}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowMemoryPanel(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t('ai_trainer.your_memory')}
                </Text>
                <Pressable onPress={() => setShowMemoryPanel(false)}>
                  <Icon name="close" size={24} color="#6b7280" />
                </Pressable>
              </View>
              <ScrollView style={styles.modalBody}>
                <MemoryViewer memories={userMemories} maxItems={10} />
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Proactive Insights Panel Modal */}
        <Modal
          visible={showInsightsPanel}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowInsightsPanel(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t('ai_trainer.insights')}
                </Text>
                <Pressable onPress={() => setShowInsightsPanel(false)}>
                  <Icon name="close" size={24} color="#6b7280" />
                </Pressable>
              </View>
              <ScrollView style={styles.modalBody}>
                {proactiveInsights.length > 0 ? (
                  proactiveInsights.map((insight, index) => (
                    <View key={insight.id || index} style={styles.insightCard}>
                      <View style={styles.insightHeader}>
                        <Icon
                          name={
                            insight.type === 'workout'
                              ? 'fitness-center'
                              : 'restaurant'
                          }
                          size={16}
                          color="#3b82f6"
                        />
                        <Text style={styles.insightType}>{insight.type}</Text>
                        <View
                          style={[
                            styles.priorityBadge,
                            {
                              backgroundColor:
                                insight.priority === 'high'
                                  ? '#fef2f2'
                                  : '#f0f9ff',
                            },
                          ]}>
                          <Text
                            style={[
                              styles.priorityText,
                              {
                                color:
                                  insight.priority === 'high'
                                    ? '#ef4444'
                                    : '#3b82f6',
                              },
                            ]}>
                            {insight.priority}
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.insightTitle}>{insight.title}</Text>
                      <Text style={styles.insightContent}>
                        {insight.content}
                      </Text>
                      {insight.actionable && (
                        <Pressable style={styles.actionButton}>
                          <Text style={styles.actionButtonText}>
                            Take Action
                          </Text>
                        </Pressable>
                      )}
                    </View>
                  ))
                ) : (
                  <View style={styles.emptyInsights}>
                    <Icon name="lightbulb-outline" size={48} color="#d1d5db" />
                    <Text style={styles.emptyText}>No insights yet</Text>
                    <Text style={styles.emptySubtext}>
                      Keep tracking your workouts and nutrition to get
                      personalized insights
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        {/* Workout Plan Creator Modal */}
        <WorkoutPlanCreator
          visible={showWorkoutPlanCreator}
          onClose={() => setShowWorkoutPlanCreator(false)}
          onComplete={planId => {
            setShowWorkoutPlanCreator(false);
            Alert.alert(
              'Success',
              'Your workout plan has been created! Check the Workouts tab to view it.',
              [{text: 'OK'}],
            );
          }}
        />

        {/* Personalization Panel Modal */}
        <Modal
          visible={showPersonalizationPanel}
          animationType="slide"
          transparent={true}
          onRequestClose={() => setShowPersonalizationPanel(false)}>
          <View style={styles.modalContainer}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>
                  {t('ai_trainer.personalization')}
                </Text>
                <Pressable onPress={() => setShowPersonalizationPanel(false)}>
                  <Icon name="close" size={24} color="#6b7280" />
                </Pressable>
              </View>
              <ScrollView style={styles.modalBody}>
                {personalizationProfile ? (
                  <View>
                    <View style={styles.profileSection}>
                      <Text style={styles.sectionTitle}>
                        Your AI Coach Profile
                      </Text>
                      <View style={styles.profileItem}>
                        <Text style={styles.profileLabel}>Coaching Style:</Text>
                        <Text style={styles.profileValue}>
                          {personalizationProfile.coachingStyle}
                        </Text>
                      </View>
                      <View style={styles.profileItem}>
                        <Text style={styles.profileLabel}>Communication:</Text>
                        <Text style={styles.profileValue}>
                          {personalizationProfile.communicationStyle}
                        </Text>
                      </View>
                      <View style={styles.profileItem}>
                        <Text style={styles.profileLabel}>
                          Motivation Type:
                        </Text>
                        <Text style={styles.profileValue}>
                          {personalizationProfile.motivationType}
                        </Text>
                      </View>
                      <View style={styles.profileItem}>
                        <Text style={styles.profileLabel}>Confidence:</Text>
                        <ConfidenceIndicator
                          score={personalizationProfile.confidence}
                          size="md"
                        />
                      </View>
                    </View>

                    {ragStats && (
                      <View style={styles.profileSection}>
                        <Text style={styles.sectionTitle}>Knowledge Base</Text>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>
                            Total Data Points:
                          </Text>
                          <Text style={styles.profileValue}>
                            {ragStats.totalVectors}
                          </Text>
                        </View>
                        <View style={styles.profileItem}>
                          <Text style={styles.profileLabel}>Categories:</Text>
                          <Text style={styles.profileValue}>
                            {ragStats.namespaces?.join(', ') || 'N/A'}
                          </Text>
                        </View>
                      </View>
                    )}
                  </View>
                ) : (
                  <View style={styles.emptyProfile}>
                    <Icon name="person-outline" size={48} color="#d1d5db" />
                    <Text style={styles.emptyText}>Profile not available</Text>
                    <Text style={styles.emptySubtext}>
                      Chat with your AI trainer to build your personalization
                      profile
                    </Text>
                  </View>
                )}
              </ScrollView>
            </View>
          </View>
        </Modal>

        <FloatingSettingsButton />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#dbeafe',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  headerSubtitle: {
    fontSize: 12,
    color: '#6b7280',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rateLimitContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 8,
  },
  rateLimitText: {
    fontSize: 12,
    fontWeight: '500',
    marginLeft: 4,
  },
  headerButton: {
    padding: 8,
    marginLeft: 4,
  },
  createPlanButton: {
    backgroundColor: '#D1FAE5',
    borderRadius: 8,
  },
  content: {
    flex: 1,
    position: 'relative',
  },
  drawer: {
    position: 'absolute',
    top: 0,
    left: 0,
    bottom: 0,
    width: 280,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
    zIndex: 1000,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: {
      width: 2,
      height: 0,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    zIndex: 999,
  },
  sidebarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  conversationsList: {
    flex: 1,
  },
  conversationItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  activeConversation: {
    backgroundColor: '#dbeafe',
  },
  conversationContent: {
    flex: 1,
  },
  conversationTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
  },
  conversationDate: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  conversationActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  editButton: {
    padding: 4,
    marginRight: 4,
  },
  deleteButton: {
    padding: 4,
  },
  editingContainer: {
    flex: 1,
  },
  editingInput: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    borderWidth: 1,
    borderColor: '#3b82f6',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 8,
    backgroundColor: '#f8fafc',
  },
  editingButtons: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  characterCount: {
    fontSize: 11,
    color: '#6b7280',
    textAlign: 'right',
    marginBottom: 8,
  },
  saveButton: {
    padding: 8,
    marginRight: 8,
    backgroundColor: '#f0fdf4',
    borderRadius: 4,
  },
  cancelButton: {
    padding: 8,
    backgroundColor: '#fef2f2',
    borderRadius: 4,
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 14,
    color: '#6b7280',
  },
  chatContainer: {
    flex: 1,
    width: '100%',
  },
  welcomeContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  welcomeTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  welcomeSubtitle: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    marginBottom: 16,
  },
  welcomeQuestion: {
    fontSize: 16,
    fontWeight: '500',
    color: '#374151',
  },
  messagesList: {
    flex: 1,
    paddingHorizontal: 16,
  },
  messageContainer: {
    marginVertical: 4,
    maxWidth: '80%',
  },
  userMessage: {
    alignSelf: 'flex-end',
    backgroundColor: '#3b82f6',
    borderRadius: 18,
    borderBottomRightRadius: 4,
  },
  assistantMessage: {
    alignSelf: 'flex-start',
    backgroundColor: 'white',
    borderRadius: 18,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  messageText: {
    padding: 12,
    fontSize: 14,
    lineHeight: 20,
  },
  userMessageText: {
    color: 'white',
  },
  assistantMessageText: {
    color: '#111827',
  },
  messageTime: {
    fontSize: 11,
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  userMessageTime: {
    color: '#bfdbfe',
    textAlign: 'right',
  },
  assistantMessageTime: {
    color: '#9ca3af',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: 'white',
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  textInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginRight: 8,
    maxHeight: 100,
    fontSize: 14,
  },
  sendButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#9ca3af',
  },
  // New styles for enhanced features
  badgeDot: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
  },
  messageMetadata: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#f3f4f6',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: 'white',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '80%',
    minHeight: '50%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  modalBody: {
    flex: 1,
    padding: 16,
  },
  insightCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  insightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  insightType: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
    textTransform: 'capitalize',
    flex: 1,
  },
  priorityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  priorityText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  insightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  insightContent: {
    fontSize: 14,
    color: '#374151',
    lineHeight: 20,
    marginBottom: 12,
  },
  actionButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  actionButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  emptyInsights: {
    alignItems: 'center',
    padding: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 12,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 8,
  },
  profileSection: {
    backgroundColor: '#f9fafb',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  profileItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  profileLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  profileValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#111827',
    textTransform: 'capitalize',
  },
  emptyProfile: {
    alignItems: 'center',
    padding: 32,
  },
  // Reasoning section styles
  reasoningContainer: {
    marginTop: 8,
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  reasoningToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 4,
  },
  reasoningToggleContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  reasoningToggleText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  reasoningContentWrapper: {
    overflow: 'hidden',
  },
  reasoningContent: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginTop: 4,
  },
  reasoningText: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
    fontStyle: 'italic',
  },
});

export default AITrainerScreen;
