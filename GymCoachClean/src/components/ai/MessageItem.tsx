import React, {useState, useRef} from 'react';
import {View, Text, Pressable, Animated, StyleSheet} from 'react-native';
import Markdown from 'react-native-markdown-display';
import {Icon} from '../common/Icon';
import ConfidenceIndicator from '../ai/ConfidenceIndicator';
import RAGSourcesDisplay from '../ai/RAGSourcesDisplay';

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
}

interface MessageItemProps {
  item: Message;
  styles: any;
  markdownStyles: any;
  formatTime: (date: Date) => string;
  processContent: (content: string) => string;
}

const MessageItem: React.FC<MessageItemProps> = ({
  item,
  styles,
  markdownStyles,
  formatTime,
  processContent,
}) => {
  // Hooks at top level - FIXED!
  const [showReasoning, setShowReasoning] = useState(false);
  const reasoningAnimation = useRef(new Animated.Value(0)).current;

  // Extract reasoning from message content
  const reasoningMatch = item.content.match(
    /<reasoning>([\s\S]*?)<\/reasoning>/,
  );
  const reasoning = reasoningMatch ? reasoningMatch[1].trim() : null;
  let mainContent = item.content
    .replace(/<reasoning>[\s\S]*?<\/reasoning>/, '')
    .trim();

  // Process HTML entities and special characters
  mainContent = processContent(mainContent);

  const toggleReasoning = () => {
    const toValue = showReasoning ? 0 : 1;
    Animated.spring(reasoningAnimation, {
      toValue,
      useNativeDriver: false,
      tension: 50,
      friction: 7,
    }).start();
    setShowReasoning(!showReasoning);
  };

  const reasoningHeight = reasoningAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 150], // Adjust max height as needed
  });

  const reasoningOpacity = reasoningAnimation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.6],
  });

  return (
    <View
      style={[
        styles.messageContainer,
        item.role === 'user' ? styles.userMessage : styles.assistantMessage,
      ]}>
      {item.role === 'assistant' ? (
        <>
          {/* Reasoning Section (Collapsible, Blurred, Small Text) */}
          {reasoning && (
            <View style={styles.reasoningContainer}>
              <Pressable
                onPress={toggleReasoning}
                style={styles.reasoningToggle}
                accessible={true}
                accessibilityLabel={
                  showReasoning ? 'Hide reasoning' : 'Show reasoning'
                }
                accessibilityHint="Tap to toggle the AI's internal reasoning for this response"
                accessibilityRole="button">
                <View style={styles.reasoningToggleContent}>
                  <Icon name="psychology" size={14} color="#6b7280" />
                  <Text style={styles.reasoningToggleText}>Reasoning</Text>
                </View>
                <Icon
                  name={showReasoning ? 'expand-less' : 'expand-more'}
                  size={14}
                  color="#6b7280"
                />
              </Pressable>
              <Animated.View
                style={[
                  styles.reasoningContentWrapper,
                  {
                    height: reasoningHeight,
                    opacity: showReasoning ? 1 : 0,
                  },
                ]}>
                <Animated.View
                  style={[
                    styles.reasoningContent,
                    {
                      opacity: reasoningOpacity,
                    },
                  ]}>
                  <Text style={styles.reasoningText}>{reasoning}</Text>
                </Animated.View>
              </Animated.View>
            </View>
          )}

          <Markdown style={markdownStyles}>{mainContent}</Markdown>

          {/* Confidence Indicator */}
          {item.confidence !== undefined && (
            <View style={styles.messageMetadata}>
              <ConfidenceIndicator
                score={item.confidence}
                size="sm"
                showLabel={true}
              />
            </View>
          )}

          {/* RAG Sources */}
          {item.ragContext && (
            <RAGSourcesDisplay ragContext={item.ragContext} maxSources={3} />
          )}
        </>
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
};

export default MessageItem;
