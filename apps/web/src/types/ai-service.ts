// AI Service TypeScript interfaces for all AI service responses

export interface RAGSource {
  namespace: string;
  key: string;
  content: string;
  color: string;
  metadata: {
    type: 'exercise' | 'nutrition' | 'research' | 'workout' | 'general';
    source: string;
    confidence: number;
    lastUpdated: string;
  };
}

export interface RAGContext {
  sources: RAGSource[];
  context: string;
  metadata: RAGMetadata;
}

export interface RAGMetadata {
  totalSources: number;
  queryTime: number;
  confidence: number;
  namespaces: string[];
}

export interface WorkoutAdaptation {
  adaptations: Adaptation[];
  reasoning: string;
  confidence: number;
  riskAssessment: RiskAssessment;
  alternatives: ExerciseAlternative[];
}

export interface Adaptation {
  type: 'intensity' | 'volume' | 'frequency' | 'exercise' | 'rest';
  currentValue: any;
  recommendedValue: any;
  reasoning: string;
  confidence: number;
  impact: 'low' | 'medium' | 'high';
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high';
  factors: RiskFactor[];
  recommendations: string[];
  confidence: number;
}

export interface RiskFactor {
  factor: string;
  risk: 'low' | 'medium' | 'high';
  description: string;
  mitigation: string;
}

export interface ExerciseAlternative {
  originalId: string;
  alternatives: AlternativeExercise[];
  reasoning: string;
}

export interface AlternativeExercise {
  id: string;
  name: string;
  similarity: number;
  equipment: string[];
  muscleGroups: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export interface NutritionIntelligence {
  adherenceScore: number;
  macroAnalysis: MacroAnalysis;
  recommendations: Recommendation[];
  hydrationAnalysis: HydrationAnalysis;
  mealTimingAnalysis: MealTimingAnalysis;
}

export interface MacroAnalysis {
  current: MacroDistribution;
  recommended: MacroDistribution;
  adherence: MacroAdherence;
  trends: MacroTrend[];
}

export interface MacroDistribution {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface MacroAdherence {
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
  overall: number;
}

export interface MacroTrend {
  date: string;
  protein: number;
  carbs: number;
  fat: number;
  calories: number;
}

export interface Recommendation {
  type: 'macro' | 'timing' | 'food' | 'hydration' | 'supplement';
  priority: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  action: string;
  impact: string;
}

export interface HydrationAnalysis {
  currentIntake: number;
  recommendedIntake: number;
  adherence: number;
  patterns: HydrationPattern[];
  recommendations: string[];
}

export interface HydrationPattern {
  timeOfDay: string;
  averageIntake: number;
  optimalIntake: number;
}

export interface MealTimingAnalysis {
  currentTiming: MealTiming[];
  optimalTiming: MealTiming[];
  adherence: number;
  recommendations: MealTimingRecommendation[];
}

export interface MealTiming {
  mealType:
    | 'breakfast'
    | 'lunch'
    | 'dinner'
    | 'snack'
    | 'pre-workout'
    | 'post-workout';
  time: string;
  macros: MacroDistribution;
}

export interface MealTimingRecommendation {
  mealType: string;
  currentTime: string;
  recommendedTime: string;
  reasoning: string;
  impact: string;
}

export interface MemoryItem {
  id: string;
  type: MemoryType;
  content: string;
  importance: number;
  createdAt: string;
  lastAccessed: string;
  tags: string[];
  metadata: Record<string, any>;
}

export type MemoryType =
  | 'goal'
  | 'preference'
  | 'achievement'
  | 'injury'
  | 'feedback'
  | 'learning'
  | 'pattern'
  | 'milestone';

export interface PersonalizationProfile {
  userId: string;
  communicationStyle: CommunicationStyle;
  motivationType: MotivationType;
  coachingStyle: CoachingStyle;
  confidence: number;
  preferences: UserPreferences;
  lastUpdated: string;
}

export type CommunicationStyle =
  | 'direct'
  | 'encouraging'
  | 'analytical'
  | 'casual'
  | 'professional';

export type MotivationType =
  | 'achievement'
  | 'social'
  | 'autonomy'
  | 'mastery'
  | 'purpose';

export type CoachingStyle =
  | 'motivational'
  | 'analytical'
  | 'educational'
  | 'supportive'
  | 'challenging';

export interface UserPreferences {
  frequency: 'daily' | 'weekly' | 'as-needed';
  detailLevel: 'brief' | 'detailed' | 'comprehensive';
  notificationTypes: string[];
  learningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading';
}

export interface ConversationAnalytics {
  conversationId: string;
  topicAnalysis: TopicAnalysis;
  engagementMetrics: EngagementMetrics;
  sentimentAnalysis: SentimentAnalysis;
  summary: string;
  keyInsights: string[];
}

export interface TopicAnalysis {
  primaryTopics: Topic[];
  secondaryTopics: Topic[];
  topicDistribution: Record<string, number>;
}

export interface Topic {
  name: string;
  confidence: number;
  mentions: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface EngagementMetrics {
  messageCount: number;
  averageResponseTime: number;
  userSatisfaction: number;
  questionCount: number;
  suggestionAcceptanceRate: number;
}

export interface SentimentAnalysis {
  overall: 'positive' | 'neutral' | 'negative';
  confidence: number;
  emotions: Emotion[];
  trends: SentimentTrend[];
}

export interface Emotion {
  name: string;
  intensity: number;
  confidence: number;
}

export interface SentimentTrend {
  timeRange: string;
  sentiment: 'positive' | 'neutral' | 'negative';
  confidence: number;
}

export interface ProactiveInsight {
  id: string;
  type: 'check-in' | 'motivation' | 'plateau' | 'progress' | 'review';
  priority: 'low' | 'medium' | 'high';
  title: string;
  message: string;
  actionRequired: boolean;
  suggestedActions: string[];
  confidence: number;
  createdAt: string;
  expiresAt?: string;
}

export interface WeeklyReview {
  weekStart: string;
  weekEnd: string;
  summary: string;
  achievements: Achievement[];
  challenges: Challenge[];
  recommendations: Recommendation[];
  nextWeekGoals: string[];
  confidence: number;
}

export interface Achievement {
  type: 'workout' | 'nutrition' | 'progress' | 'consistency';
  description: string;
  impact: 'low' | 'medium' | 'high';
  celebration: string;
}

export interface Challenge {
  type: 'adherence' | 'motivation' | 'plateau' | 'injury';
  description: string;
  severity: 'low' | 'medium' | 'high';
  suggestions: string[];
}

export interface PerformancePrediction {
  metric: string;
  currentValue: number;
  predictedValue: number;
  confidence: number;
  timeframe: string;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  factor: string;
  impact: number;
  description: string;
}

export interface ProgressMonitoringAlert {
  id: string;
  type: 'deviation' | 'plateau' | 'improvement' | 'risk';
  severity: 'low' | 'medium' | 'high';
  title: string;
  description: string;
  metrics: ProgressMetric[];
  recommendations: string[];
  actionRequired: boolean;
  createdAt: string;
}

export interface ProgressMetric {
  name: string;
  current: number;
  expected: number;
  deviation: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ConversationThread {
  id: string;
  conversationId: string;
  topic: string;
  summary: string;
  messageCount: number;
  createdAt: string;
  lastActivity: string;
  participants: string[];
}

export interface ConversationSummary {
  conversationId: string;
  summary: string;
  keyPoints: string[];
  actionItems: string[];
  nextSteps: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  createdAt: string;
  success: boolean;
}

// API Response wrappers
export interface AIResponse<T> {
  success: boolean;
  data: T;
  error?: string;
  metadata: {
    timestamp: string;
    processingTime: number;
    confidence: number;
    sources?: RAGSource[];
  };
}

export interface PaginatedResponse<T> {
  items: T[];
  totalCount: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// Request interfaces
export interface ChatMessageRequest {
  message: string;
  conversationId?: string;
  context?: Record<string, any>;
  includeRAG?: boolean;
  personalizationLevel?: 'low' | 'medium' | 'high';
}

export interface WorkoutAdaptationRequest {
  workoutPlanId: string;
  recentPerformance?: Record<string, any>;
  userFeedback?: string;
  injuryStatus?: string;
  equipmentAvailable?: string[];
}

export interface NutritionAnalysisRequest {
  days: number;
  includeHydration?: boolean;
  includeTiming?: boolean;
  goals?: string[];
}

export interface MemoryStoreRequest {
  type: MemoryType;
  content: string;
  importance: number;
  tags?: string[];
  metadata?: Record<string, any>;
}

export interface PersonalizationAnalysisRequest {
  conversationHistory?: boolean;
  userBehavior?: boolean;
  feedbackHistory?: boolean;
  preferences?: boolean;
}

// Error types
export interface AIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetTime: string;
  retryAfter?: number;
}
