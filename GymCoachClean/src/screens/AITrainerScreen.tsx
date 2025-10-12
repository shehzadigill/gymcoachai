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
  Animated,
  Dimensions,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import {Icon} from '../components/common/Icon';
import Markdown from 'react-native-markdown-display';
import apiClient from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
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

const AITrainerScreen: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [currentConversationId, setCurrentConversationId] = useState<
    string | null
  >(null);
  const [rateLimit, setRateLimit] = useState<RateLimit | null>(null);
  const [showConversations, setShowConversations] = useState(false); // Closed by default for drawer behavior
  const [refreshing, setRefreshing] = useState(false);
  const [editingConversationId, setEditingConversationId] = useState<
    string | null
  >(null);
  const [editingTitle, setEditingTitle] = useState('');
  const scrollViewRef = useRef<FlatList<Message>>(null);
  const drawerAnimation = useRef(new Animated.Value(0)).current;
  const screenWidth = Dimensions.get('window').width;

  useEffect(() => {
    loadConversations();
    loadRateLimit();
  }, []);

  useEffect(() => {
    Animated.timing(drawerAnimation, {
      toValue: showConversations ? 1 : 0,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [showConversations]);

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
      Alert.alert('Error', 'Failed to load conversation');
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
      Alert.alert('Error', 'Title too long (max 100 characters)');
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
      Alert.alert('Error', 'Failed to update conversation title');
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
        content:
          (response as any).reply ||
          (response as any).message ||
          'No response received',
        timestamp: new Date(),
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
  };

  const renderMessage = ({item}: {item: Message}) => (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}>
      {item.role === 'assistant' ? (
        <Markdown style={markdownStyles}>{item.content}</Markdown>
      ) : (
        <Text style={[styles.messageText, styles.userMessageText]}>
          {item.content}
        </Text>
      )}
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

  const renderConversation = ({item}: {item: Conversation}) => {
    const conversationId = item.id || item.conversationId || '';
    const isEditing = editingConversationId === conversationId;

    return (
      <TouchableOpacity
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
                placeholder="Enter conversation title..."
                maxLength={100}
                returnKeyType="done"
                onSubmitEditing={saveConversationTitle}
              />
              <Text style={styles.characterCount}>
                {editingTitle.length}/100 characters
              </Text>
              <View style={styles.editingButtons}>
                <TouchableOpacity
                  onPress={() => {
                    console.log('Save button pressed');
                    saveConversationTitle();
                  }}
                  style={styles.saveButton}>
                  <Icon name="check" size={16} color="#10b981" />
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={cancelEditingConversation}
                  style={styles.cancelButton}>
                  <Icon name="close" size={16} color="#ef4444" />
                </TouchableOpacity>
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
            <TouchableOpacity
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
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() =>
                conversationId && deleteConversation(conversationId)
              }
              style={styles.deleteButton}>
              <Icon name="delete" size={16} color="#ef4444" />
            </TouchableOpacity>
          </View>
        )}
      </TouchableOpacity>
    );
  };

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
                {rateLimit.requestsRemaining}
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
        {/* Conversations Drawer */}
        <Animated.View
          style={[
            styles.drawer,
            {
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
          <View style={styles.sidebarHeader}>
            <Text style={styles.sidebarTitle}>Conversations</Text>
            <TouchableOpacity
              onPress={() => setShowConversations(false)}
              style={styles.closeButton}>
              <Icon name="close" size={20} color="#6b7280" />
            </TouchableOpacity>
          </View>
          <FlatList
            data={conversations}
            renderItem={renderConversation}
            keyExtractor={item => item.id || item.conversationId || item.title}
            style={styles.conversationsList}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Text style={styles.emptyStateText}>No conversations yet</Text>
              </View>
            }
          />
        </Animated.View>

        {/* Overlay */}
        {showConversations && (
          <TouchableOpacity
            style={styles.overlay}
            onPress={() => setShowConversations(false)}
            activeOpacity={1}
          />
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
});

export default AITrainerScreen;
