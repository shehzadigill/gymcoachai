import React, {useState, useEffect, useRef} from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
  Alert,
  ActivityIndicator,
  RefreshControl,
  FlatList,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import apiClient from '../services/api';

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

const AITrainerScreen: React.FC = () => {
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
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadConversations();
    loadRateLimit();
  }, []);

  const loadConversations = async () => {
    try {
      const data = await apiClient.getConversations();
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
      const data = await apiClient.getConversation(conversationId);
      setMessages(data.messages || []);
      setCurrentConversationId(conversationId);
      setShowConversations(false);
    } catch (error) {
      console.error('Failed to load conversation:', error);
      Alert.alert('Error', 'Failed to load conversation');
    }
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
              Alert.alert('Error', 'Failed to delete conversation');
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
      const response = await apiClient.sendChatMessage(
        inputMessage.trim(),
        currentConversationId || undefined,
      );

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.reply,
        timestamp: new Date(),
      };

      setMessages(prev => [...prev, assistantMessage]);

      if (!currentConversationId && response.conversationId) {
        setCurrentConversationId(response.conversationId);
        loadConversations();
      }

      if (response.remainingRequests !== undefined) {
        setRateLimit(prev =>
          prev
            ? {
                ...prev,
                remaining: response.remainingRequests,
              }
            : null,
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

  const getRateLimitColor = () => {
    if (!rateLimit) return '#9ca3af';
    const percentage = (rateLimit.remaining / 10) * 100;
    if (percentage > 50) return '#10b981';
    if (percentage > 25) return '#f59e0b';
    return '#ef4444';
  };

  const renderMessage = ({item}: {item: Message}) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}>
      <Text
        style={[
          styles.messageText,
          item.role === 'user'
            ? styles.userMessageText
            : styles.assistantMessageText,
        ]}>
        {item.content}
      </Text>
      <Text
        style={[
          styles.messageTime,
          item.role === 'user'
            ? styles.userMessageTime
            : styles.assistantMessageTime,
        ]}>
        {formatTime(item.timestamp)}
      </Text>
    </View>
  );

  const renderConversation = ({item}: {item: Conversation}) => (
    <TouchableOpacity
      style={[
        styles.conversationItem,
        currentConversationId === item.id && styles.activeConversation,
      ]}
      onPress={() => loadConversation(item.id)}>
      <View style={styles.conversationContent}>
        <Text style={styles.conversationTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.conversationDate}>
          {new Date(item.lastMessageAt).toLocaleDateString()}
        </Text>
      </View>
      <TouchableOpacity
        onPress={() => deleteConversation(item.id)}
        style={styles.deleteButton}>
        <Icon name="delete" size={20} color="#ef4444" />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.iconContainer}>
            <Icon name="smart-toy" size={24} color="#3b82f6" />
          </View>
          <View>
            <Text style={styles.headerTitle}>AI Trainer</Text>
            <Text style={styles.headerSubtitle}>
              Your personal fitness coach
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {rateLimit && (
            <View style={styles.rateLimitContainer}>
              <Icon name="flash-on" size={16} color={getRateLimitColor()} />
              <Text
                style={[styles.rateLimitText, {color: getRateLimitColor()}]}>
                {rateLimit.remaining}
              </Text>
            </View>
          )}

          <TouchableOpacity
            onPress={() => setShowConversations(!showConversations)}
            style={styles.headerButton}>
            <Icon name="chat" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity
            onPress={startNewConversation}
            style={styles.headerButton}>
            <Icon name="refresh" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.content}>
        {/* Conversations Sidebar */}
        {showConversations && (
          <View style={styles.sidebar}>
            <View style={styles.sidebarHeader}>
              <Text style={styles.sidebarTitle}>Conversations</Text>
            </View>
            <FlatList
              data={conversations}
              renderItem={renderConversation}
              keyExtractor={item => item.id}
              style={styles.conversationsList}
              ListEmptyComponent={
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No conversations yet
                  </Text>
                </View>
              }
            />
          </View>
        )}

        {/* Chat Area */}
        <View style={styles.chatContainer}>
          {messages.length === 0 ? (
            <View style={styles.welcomeContainer}>
              <Icon name="smart-toy" size={64} color="#d1d5db" />
              <Text style={styles.welcomeTitle}>
                Welcome to your AI Trainer!
              </Text>
              <Text style={styles.welcomeSubtitle}>
                I'm here to help you with workout plans, nutrition advice, form
                checks, and motivation.
              </Text>
              <Text style={styles.welcomeQuestion}>
                What would you like to know?
              </Text>
            </View>
          ) : (
            <FlatList
              ref={scrollViewRef}
              data={messages}
              renderItem={renderMessage}
              keyExtractor={item => item.id}
              style={styles.messagesList}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
              }
            />
          )}

          {isLoading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#3b82f6" />
              <Text style={styles.loadingText}>AI Trainer is thinking...</Text>
            </View>
          )}
        </View>
      </View>

      {/* Input Area */}
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.textInput}
          value={inputMessage}
          onChangeText={setInputMessage}
          placeholder="Ask your AI trainer anything..."
          multiline
          maxLength={500}
          editable={!isLoading}
        />
        <TouchableOpacity
          onPress={sendMessage}
          disabled={!inputMessage.trim() || isLoading}
          style={[
            styles.sendButton,
            (!inputMessage.trim() || isLoading) && styles.sendButtonDisabled,
          ]}>
          <Icon name="send" size={20} color="white" />
        </TouchableOpacity>
      </View>
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
  content: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 280,
    backgroundColor: 'white',
    borderRightWidth: 1,
    borderRightColor: '#e5e7eb',
  },
  sidebarHeader: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  sidebarTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
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
  deleteButton: {
    padding: 4,
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
});

export default AITrainerScreen;
