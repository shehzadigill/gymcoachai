import React, {useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Alert,
} from 'react-native';
import {SafeAreaView} from 'react-native-safe-area-context';
import LinearGradient from 'react-native-linear-gradient';
import {Icon} from '../common/Icon';
import Markdown from 'react-native-markdown-display';
import apiClient from '../../services/api';
import {useTheme} from '../../theme';

const {width} = Dimensions.get('window');

interface WorkoutPlanPreview {
  name: string;
  description: string;
  difficulty: string;
  duration_weeks: number;
  frequency_per_week: number;
  tags: string[];
  weeks?: Array<{
    week_number: number;
    focus: string;
    sessions: Array<{
      name: string;
      day: number;
      duration_minutes: number;
      exercises: Array<{
        name: string;
        sets: number;
        reps?: number;
        duration_seconds?: number;
        rest_seconds: number;
        found_in_db?: boolean;
        needs_creation?: boolean;
      }>;
    }>;
  }>;
  new_exercises_count?: number;
  total_exercises?: number;
}

interface WorkoutPlanCreationState {
  stage: 'input' | 'gathering' | 'preview' | 'saving' | 'complete';
  conversationId?: string;
  requirements?: any;
  plan?: WorkoutPlanPreview;
  message?: string;
  missingFields?: string[];
}

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface WorkoutPlanCreatorProps {
  visible: boolean;
  onClose: () => void;
  onComplete?: (planId: string) => void;
}

export default function WorkoutPlanCreator({
  visible,
  onClose,
  onComplete,
}: WorkoutPlanCreatorProps) {
  const {colors, isDark} = useTheme();
  const [state, setState] = useState<WorkoutPlanCreationState>({
    stage: 'input',
  });
  const [userInput, setUserInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversationHistory, setConversationHistory] = useState<
    ConversationMessage[]
  >([]);

  const handleSubmitRequest = async () => {
    if (!userInput.trim()) return;

    setIsLoading(true);
    setError(null);

    // Add user message to history
    setConversationHistory(prev => [
      ...prev,
      {role: 'user', content: userInput},
    ]);

    try {
      const response = await apiClient.createWorkoutPlan({
        message: userInput,
        conversationId: state.conversationId,
      });

      if (response.success) {
        // Add assistant response to history
        setConversationHistory(prev => [
          ...prev,
          {role: 'assistant', content: response.data.message},
        ]);

        setState({
          stage:
            response.data.stage === 'awaiting_approval'
              ? 'preview'
              : 'gathering',
          conversationId: response.data.conversationId,
          requirements: response.data.requirements,
          plan: response.data.plan,
          message: response.data.message,
          missingFields: response.metadata?.missingFields,
        });

        setUserInput('');
      } else {
        throw new Error(response.error || 'Failed to process request');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      Alert.alert('Error', err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!state.conversationId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await apiClient.approveWorkoutPlan({
        conversationId: state.conversationId,
        message: 'yes, save this plan',
      });

      if (response.success) {
        setState({
          stage: 'complete',
          conversationId: state.conversationId,
          message: response.data.message,
        });

        // Call onComplete callback after a short delay
        if (onComplete && response.data.planId) {
          setTimeout(() => {
            onComplete(response.data.planId);
            onClose();
          }, 2000);
        }
      } else {
        throw new Error(response.error || 'Failed to approve plan');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      Alert.alert('Error', err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleModify = async (modificationRequest: string) => {
    if (!state.conversationId) return;

    setIsLoading(true);
    setError(null);

    setConversationHistory(prev => [
      ...prev,
      {role: 'user', content: modificationRequest},
    ]);

    try {
      const response = await apiClient.approveWorkoutPlan({
        conversationId: state.conversationId,
        message: modificationRequest,
      });

      if (response.success) {
        setConversationHistory(prev => [
          ...prev,
          {role: 'assistant', content: response.data.message},
        ]);

        setState({
          stage: 'gathering',
          conversationId: state.conversationId,
          message: response.data.message,
        });
      } else {
        throw new Error(response.error || 'Failed to process modification');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
      Alert.alert('Error', err.message || 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickStart = (template: string) => {
    setUserInput(template);
    setState({...state, stage: 'gathering'});
  };

  const styles = createStyles(colors, isDark);

  const renderInitialPrompt = () => (
    <View style={styles.section}>
      <View style={styles.header}>
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={styles.iconGradient}>
          <Icon name="dumbbell" size={32} color="#FFFFFF" />
        </LinearGradient>
        <Text style={styles.title}>Create Your Personalized Workout Plan</Text>
        <Text style={styles.subtitle}>
          Let's build a workout plan tailored to your goals. Tell me what you're
          looking to achieve!
        </Text>
      </View>

      <View style={styles.quickStartContainer}>
        <TouchableOpacity
          style={[styles.quickStartCard, {borderColor: '#3B82F6'}]}
          onPress={() =>
            handleQuickStart(
              'I want to build muscle mass with 4 workouts per week for 12 weeks',
            )
          }>
          <Icon name="target" size={24} color="#3B82F6" />
          <Text style={styles.quickStartTitle}>Build Muscle</Text>
          <Text style={styles.quickStartSubtitle}>4 days/week, 12 weeks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickStartCard, {borderColor: '#10B981'}]}
          onPress={() =>
            handleQuickStart(
              'I want to lose weight with 5 days of cardio and strength training for 8 weeks',
            )
          }>
          <Icon name="trending-up" size={24} color="#10B981" />
          <Text style={styles.quickStartTitle}>Lose Weight</Text>
          <Text style={styles.quickStartSubtitle}>5 days/week, 8 weeks</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.quickStartCard, {borderColor: '#8B5CF6'}]}
          onPress={() =>
            handleQuickStart(
              'I want to improve overall fitness with 3 full-body workouts per week for 6 weeks',
            )
          }>
          <Icon name="calendar" size={24} color="#8B5CF6" />
          <Text style={styles.quickStartTitle}>General Fitness</Text>
          <Text style={styles.quickStartSubtitle}>3 days/week, 6 weeks</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderConversation = () => (
    <View style={styles.section}>
      <ScrollView style={styles.conversationScroll}>
        {conversationHistory.map((msg, idx) => (
          <View
            key={idx}
            style={[
              styles.messageContainer,
              msg.role === 'user'
                ? styles.userMessage
                : styles.assistantMessage,
            ]}>
            <View
              style={[
                styles.messageBubble,
                msg.role === 'user'
                  ? styles.userBubble
                  : styles.assistantBubble,
              ]}>
              <Markdown style={markdownStyles(colors)}>{msg.content}</Markdown>
            </View>
          </View>
        ))}
      </ScrollView>

      {state.missingFields && state.missingFields.length > 0 && (
        <View style={styles.infoBox}>
          <Icon name="alert-circle" size={20} color="#3B82F6" />
          <View style={styles.infoBoxContent}>
            <Text style={styles.infoBoxTitle}>Still need some information</Text>
            <Text style={styles.infoBoxText}>
              {state.missingFields.join(', ')}
            </Text>
          </View>
        </View>
      )}
    </View>
  );

  const renderPlanPreview = () => {
    if (!state.plan) return null;

    return (
      <ScrollView style={styles.section}>
        {/* Plan Header */}
        <LinearGradient
          colors={['#3B82F6', '#8B5CF6']}
          style={styles.planHeader}>
          <View style={styles.planHeaderContent}>
            <Text style={styles.planName}>{state.plan.name}</Text>
            <Text style={styles.planDescription}>{state.plan.description}</Text>
          </View>
          <Icon name="check-circle" size={32} color="#FFFFFF" />
        </LinearGradient>

        {/* Plan Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statBox}>
            <Icon name="calendar" size={20} color="#FFFFFF" />
            <Text style={styles.statLabel}>Duration</Text>
            <Text style={styles.statValue}>
              {state.plan.duration_weeks} weeks
            </Text>
          </View>

          <View style={styles.statBox}>
            <Icon name="clock" size={20} color="#FFFFFF" />
            <Text style={styles.statLabel}>Frequency</Text>
            <Text style={styles.statValue}>
              {state.plan.frequency_per_week} days/week
            </Text>
          </View>

          <View style={styles.statBox}>
            <Icon name="trending-up" size={20} color="#FFFFFF" />
            <Text style={styles.statLabel}>Level</Text>
            <Text style={styles.statValue}>
              {state.plan.difficulty.charAt(0).toUpperCase() +
                state.plan.difficulty.slice(1)}
            </Text>
          </View>
        </View>

        {/* Plan Details */}
        <View style={styles.detailsBox}>
          <Markdown style={markdownStyles(colors)}>
            {state.message || ''}
          </Markdown>
        </View>

        {/* Exercise Summary */}
        {state.plan.new_exercises_count &&
          state.plan.new_exercises_count > 0 && (
            <View style={styles.successBox}>
              <Icon name="check-circle" size={20} color="#10B981" />
              <View style={styles.successBoxContent}>
                <Text style={styles.successBoxTitle}>New Exercises</Text>
                <Text style={styles.successBoxText}>
                  {state.plan.new_exercises_count} new exercises will be created
                  specifically for your plan
                </Text>
              </View>
            </View>
          )}

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.primaryButton, isLoading && styles.buttonDisabled]}
            onPress={handleApprove}
            disabled={isLoading}>
            {isLoading ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Icon name="check" size={20} color="#FFFFFF" />
                <Text style={styles.primaryButtonText}>Save This Plan</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.secondaryButton, isLoading && styles.buttonDisabled]}
            onPress={() => {
              Alert.prompt(
                'Modify Plan',
                'What would you like to change?',
                [
                  {text: 'Cancel', style: 'cancel'},
                  {
                    text: 'Submit',
                    onPress: text => text && handleModify(text),
                  },
                ],
                'plain-text',
              );
            }}
            disabled={isLoading}>
            <Text style={styles.secondaryButtonText}>Modify</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  };

  const renderComplete = () => (
    <View style={styles.completeContainer}>
      <View style={styles.successIcon}>
        <Icon name="check-circle" size={64} color="#10B981" />
      </View>

      <Text style={styles.completeTitle}>Plan Created Successfully!</Text>
      <View style={styles.completeMessage}>
        <Markdown style={markdownStyles(colors)}>
          {state.message || 'Your workout plan has been saved.'}
        </Markdown>
      </View>

      <TouchableOpacity style={styles.primaryButton} onPress={onClose}>
        <Text style={styles.primaryButtonText}>View My Workouts</Text>
        <Icon name="arrow-right" size={20} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.container}>
          {/* Header */}
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>AI Workout Plan Creator</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
              <Icon name="x" size={24} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* Error Display */}
          {error && (
            <View style={styles.errorBox}>
              <Icon name="alert-circle" size={20} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
              <TouchableOpacity onPress={() => setError(null)}>
                <Icon name="x" size={20} color="#EF4444" />
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          <ScrollView style={styles.content}>
            {state.stage === 'input' && renderInitialPrompt()}
            {state.stage === 'gathering' && renderConversation()}
            {state.stage === 'preview' && renderPlanPreview()}
            {state.stage === 'complete' && renderComplete()}
          </ScrollView>

          {/* Input Section (except on complete stage) */}
          {state.stage !== 'complete' && (
            <View style={styles.inputContainer}>
              <TextInput
                style={styles.input}
                value={userInput}
                onChangeText={setUserInput}
                placeholder={
                  state.stage === 'input'
                    ? 'Describe your fitness goals...'
                    : 'Type your response...'
                }
                placeholderTextColor={colors.subtext}
                multiline
                numberOfLines={3}
                editable={!isLoading}
              />
              <TouchableOpacity
                style={[
                  styles.sendButton,
                  (!userInput.trim() || isLoading) && styles.buttonDisabled,
                ]}
                onPress={handleSubmitRequest}
                disabled={!userInput.trim() || isLoading}>
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Icon name="arrow-right" size={20} color="#FFFFFF" />
                )}
              </TouchableOpacity>
            </View>
          )}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
}

const createStyles = (colors: any, isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.background,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: 16,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: 'bold',
      color: colors.text,
    },
    closeButton: {
      padding: 8,
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 16,
    },
    header: {
      alignItems: 'center',
      marginBottom: 24,
    },
    iconGradient: {
      width: 64,
      height: 64,
      borderRadius: 16,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 16,
    },
    title: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },
    subtitle: {
      fontSize: 14,
      color: colors.textSecondary,
      textAlign: 'center',
      maxWidth: width - 64,
    },
    quickStartContainer: {
      gap: 12,
    },
    quickStartCard: {
      padding: 16,
      borderRadius: 12,
      borderWidth: 2,
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
    },
    quickStartTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
      marginTop: 8,
    },
    quickStartSubtitle: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    conversationScroll: {
      maxHeight: 400,
    },
    messageContainer: {
      marginBottom: 12,
    },
    userMessage: {
      alignItems: 'flex-end',
    },
    assistantMessage: {
      alignItems: 'flex-start',
    },
    messageBubble: {
      maxWidth: '80%',
      padding: 12,
      borderRadius: 16,
    },
    userBubble: {
      backgroundColor: '#3B82F6',
    },
    assistantBubble: {
      backgroundColor: isDark ? colors.surface : '#F3F4F6',
    },
    infoBox: {
      flexDirection: 'row',
      padding: 12,
      backgroundColor: isDark ? '#1E3A8A' : '#DBEAFE',
      borderRadius: 8,
      marginTop: 12,
    },
    infoBoxContent: {
      flex: 1,
      marginLeft: 12,
    },
    infoBoxTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#3B82F6',
      marginBottom: 4,
    },
    infoBoxText: {
      fontSize: 12,
      color: '#3B82F6',
    },
    planHeader: {
      flexDirection: 'row',
      padding: 20,
      borderRadius: 16,
      marginBottom: 16,
    },
    planHeaderContent: {
      flex: 1,
    },
    planName: {
      fontSize: 20,
      fontWeight: 'bold',
      color: '#FFFFFF',
      marginBottom: 8,
    },
    planDescription: {
      fontSize: 14,
      color: '#E0E7FF',
    },
    statsContainer: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    statBox: {
      flex: 1,
      backgroundColor: isDark ? colors.surface : '#F3F4F6',
      padding: 12,
      borderRadius: 12,
      alignItems: 'center',
    },
    statLabel: {
      fontSize: 12,
      color: colors.textSecondary,
      marginTop: 4,
    },
    statValue: {
      fontSize: 16,
      fontWeight: 'bold',
      color: colors.text,
      marginTop: 4,
    },
    detailsBox: {
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      padding: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: 16,
    },
    successBox: {
      flexDirection: 'row',
      padding: 12,
      backgroundColor: isDark ? '#065F46' : '#D1FAE5',
      borderRadius: 8,
      marginBottom: 16,
    },
    successBoxContent: {
      flex: 1,
      marginLeft: 12,
    },
    successBoxTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: '#10B981',
      marginBottom: 4,
    },
    successBoxText: {
      fontSize: 12,
      color: '#10B981',
    },
    actionButtons: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    primaryButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: '#10B981',
      padding: 16,
      borderRadius: 12,
      gap: 8,
    },
    primaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: '#FFFFFF',
    },
    secondaryButton: {
      paddingHorizontal: 24,
      paddingVertical: 16,
      borderRadius: 12,
      borderWidth: 2,
      borderColor: colors.border,
    },
    secondaryButtonText: {
      fontSize: 16,
      fontWeight: '600',
      color: colors.text,
    },
    buttonDisabled: {
      opacity: 0.5,
    },
    completeContainer: {
      alignItems: 'center',
      padding: 32,
    },
    successIcon: {
      marginBottom: 24,
    },
    completeTitle: {
      fontSize: 24,
      fontWeight: 'bold',
      color: colors.text,
      marginBottom: 16,
    },
    completeMessage: {
      marginBottom: 24,
    },
    errorBox: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: 12,
      backgroundColor: isDark ? '#7F1D1D' : '#FEE2E2',
      borderRadius: 8,
      margin: 16,
      gap: 8,
    },
    errorText: {
      flex: 1,
      fontSize: 14,
      color: '#EF4444',
    },
    inputContainer: {
      flexDirection: 'row',
      padding: 16,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: 8,
    },
    input: {
      flex: 1,
      backgroundColor: isDark ? colors.surface : '#FFFFFF',
      borderRadius: 12,
      padding: 12,
      color: colors.text,
      maxHeight: 100,
    },
    sendButton: {
      backgroundColor: '#3B82F6',
      width: 48,
      height: 48,
      borderRadius: 24,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });

const markdownStyles = (colors: any) => ({
  body: {
    color: colors.text,
    fontSize: 14,
  },
  heading1: {
    fontSize: 20,
    fontWeight: '700' as const,
    color: colors.text,
    marginVertical: 8,
  },
  heading2: {
    fontSize: 18,
    fontWeight: '700' as const,
    color: colors.text,
    marginVertical: 6,
  },
  paragraph: {
    marginVertical: 4,
  },
  strong: {
    fontWeight: '700' as const,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  code_inline: {
    backgroundColor: colors.surface,
    color: colors.text,
    padding: 2,
    borderRadius: 4,
  },
  bullet_list: {
    marginVertical: 4,
  },
});
