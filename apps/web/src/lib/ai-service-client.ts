// Centralized AI service client for all 50+ AI service endpoints
import { apiFetch } from './api-client';
import type {
  AIResponse,
  RAGContext,
  WorkoutAdaptation,
  WorkoutAdaptationRequest,
  NutritionIntelligence,
  NutritionAnalysisRequest,
  MemoryItem,
  MemoryStoreRequest,
  PersonalizationProfile,
  PersonalizationAnalysisRequest,
  ConversationAnalytics,
  ProactiveInsight,
  WeeklyReview,
  PerformancePrediction,
  ProgressMonitoringAlert,
  ConversationThread,
  ConversationSummary,
  ChatMessageRequest,
  PaginatedResponse,
  RateLimitInfo,
  AIError,
} from '../types/ai-service';

export class AIServiceClient {
  private baseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || process.env.NEXT_PUBLIC_AI_SERVICE_URL || '/ai';
  }

  // Cache management
  private getCached<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  // Memory & Personalization APIs
  async storeConversationMemory(
    data: MemoryStoreRequest
  ): Promise<AIResponse<MemoryItem>> {
    const response = await apiFetch('/api/ai/memory/store', {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return response.json();
  }

  async retrieveRelevantMemories(
    query: string,
    context?: Record<string, any>
  ): Promise<AIResponse<MemoryItem[]>> {
    const cacheKey = `memories:${query}:${JSON.stringify(context || {})}`;
    const cached = this.getCached<AIResponse<MemoryItem[]>>(cacheKey);
    if (cached) return cached;

    const response = await apiFetch('/api/ai/memory/retrieve', {
      method: 'POST',
      body: JSON.stringify({ query, context }),
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  async updateMemoryImportance(
    memoryId: string,
    importance: number
  ): Promise<AIResponse<void>> {
    const response = await apiFetch('/api/ai/memory/update', {
      method: 'POST',
      body: JSON.stringify({ memoryId, importance }),
    });
    return response.json();
  }

  async cleanupOldMemories(): Promise<AIResponse<{ deletedCount: number }>> {
    const response = await apiFetch('/api/ai/memory/cleanup', {
      method: 'POST',
    });
    return response.json();
  }

  async getMemorySummary(): Promise<
    AIResponse<{ summary: string; keyInsights: string[] }>
  > {
    const cacheKey = 'memory:summary';
    const cached =
      this.getCached<AIResponse<{ summary: string; keyInsights: string[] }>>(
        cacheKey
      );
    if (cached) return cached;

    const response = await apiFetch('/api/ai/memory/summary', {
      method: 'GET',
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  async analyzeUserPreferences(
    request?: PersonalizationAnalysisRequest
  ): Promise<AIResponse<PersonalizationProfile>> {
    const cacheKey = `preferences:${JSON.stringify(request || {})}`;
    const cached = this.getCached<AIResponse<PersonalizationProfile>>(cacheKey);
    if (cached) return cached;

    const response = await apiFetch('/api/ai/personalization/analyze', {
      method: 'POST',
      body: JSON.stringify(request || {}),
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  async determineCoachingStyle(
    context?: Record<string, any>
  ): Promise<AIResponse<{ style: string; confidence: number }>> {
    const response = await apiFetch('/api/ai/personalization/style', {
      method: 'POST',
      body: JSON.stringify({ context }),
    });
    return response.json();
  }

  async adaptCoachingMessage(
    message: string,
    style: string,
    context?: Record<string, any>
  ): Promise<AIResponse<{ adaptedMessage: string; reasoning: string }>> {
    const response = await apiFetch('/api/ai/personalization/adapt', {
      method: 'POST',
      body: JSON.stringify({ message, style, context }),
    });
    return response.json();
  }

  async submitPersonalizationFeedback(feedback: {
    type: string;
    rating: number;
    comments?: string;
  }): Promise<AIResponse<void>> {
    const response = await apiFetch('/api/ai/personalization/feedback', {
      method: 'POST',
      body: JSON.stringify(feedback),
    });
    return response.json();
  }

  // Workout Intelligence APIs
  async adaptWorkoutPlan(
    request: WorkoutAdaptationRequest
  ): Promise<AIResponse<WorkoutAdaptation>> {
    const response = await apiFetch('/api/ai/workout/adapt', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.json();
  }

  async assessInjuryRisk(): Promise<
    AIResponse<{ risk: string; factors: any[]; recommendations: string[] }>
  > {
    const cacheKey = 'injury:risk';
    const cached =
      this.getCached<
        AIResponse<{ risk: string; factors: any[]; recommendations: string[] }>
      >(cacheKey);
    if (cached) return cached;

    const response = await apiFetch('/api/ai/workout/assess-risk', {
      method: 'POST',
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  async substituteExercise(
    exerciseId: string,
    reason: string
  ): Promise<AIResponse<{ alternatives: any[]; reasoning: string }>> {
    const response = await apiFetch('/api/ai/workout/substitute', {
      method: 'POST',
      body: JSON.stringify({ exerciseId, reason }),
    });
    return response.json();
  }

  async analyzePerformance(
    workoutData?: Record<string, any>
  ): Promise<
    AIResponse<{ analysis: any; trends: any[]; recommendations: any[] }>
  > {
    const response = await apiFetch('/api/ai/performance/analyze', {
      method: 'POST',
      body: JSON.stringify(workoutData || {}),
    });
    return response.json();
  }

  async detectPerformanceAnomalies(): Promise<
    AIResponse<{ anomalies: any[]; explanations: string[] }>
  > {
    const response = await apiFetch('/api/ai/performance/anomalies', {
      method: 'POST',
    });
    return response.json();
  }

  async predictPerformance(
    userId?: string
  ): Promise<AIResponse<PerformancePrediction[]>> {
    const cacheKey = `performance:predict:${userId || 'current'}`;
    const cached =
      this.getCached<AIResponse<PerformancePrediction[]>>(cacheKey);
    if (cached) return cached;

    const response = await apiFetch('/api/ai/performance/predict', {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  async generatePerformanceReport(): Promise<
    AIResponse<{ report: any; insights: string[]; recommendations: any[] }>
  > {
    const response = await apiFetch('/api/ai/performance/report', {
      method: 'POST',
    });
    return response.json();
  }

  // Nutrition Intelligence APIs
  async analyzeNutritionAdherence(
    request: NutritionAnalysisRequest
  ): Promise<AIResponse<NutritionIntelligence>> {
    const cacheKey = `nutrition:adherence:${JSON.stringify(request)}`;
    const cached = this.getCached<AIResponse<NutritionIntelligence>>(cacheKey);
    if (cached) return cached;

    const response = await apiFetch('/api/ai/nutrition/analyze', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  async suggestNutritionAdjustments(
    currentPlan?: any
  ): Promise<AIResponse<{ adjustments: any[]; reasoning: string }>> {
    const response = await apiFetch('/api/ai/nutrition/adjust', {
      method: 'POST',
      body: JSON.stringify({ currentPlan }),
    });
    return response.json();
  }

  async substituteFoods(
    unavailableFoods: string[],
    context?: Record<string, any>
  ): Promise<
    AIResponse<{ substitutions: any[]; nutritionalEquivalence: any }>
  > {
    const response = await apiFetch('/api/ai/nutrition/substitute', {
      method: 'POST',
      body: JSON.stringify({ unavailableFoods, context }),
    });
    return response.json();
  }

  async analyzeHydration(
    days: number = 7
  ): Promise<AIResponse<{ analysis: any; recommendations: string[] }>> {
    const cacheKey = `hydration:analysis:${days}`;
    const cached =
      this.getCached<AIResponse<{ analysis: any; recommendations: string[] }>>(
        cacheKey
      );
    if (cached) return cached;

    const response = await apiFetch('/api/ai/nutrition/hydration', {
      method: 'POST',
      body: JSON.stringify({ days }),
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  async calculateOptimalMacros(
    goals?: string[]
  ): Promise<AIResponse<{ macros: any; reasoning: string }>> {
    const response = await apiFetch('/api/ai/nutrition/macros', {
      method: 'POST',
      body: JSON.stringify({ goals }),
    });
    return response.json();
  }

  async adjustMacros(
    currentMacros: any,
    goals?: string[]
  ): Promise<AIResponse<{ adjustedMacros: any; changes: any[] }>> {
    const response = await apiFetch('/api/ai/nutrition/macro-adjust', {
      method: 'POST',
      body: JSON.stringify({ currentMacros, goals }),
    });
    return response.json();
  }

  async optimizeMealTiming(
    mealPlan?: any
  ): Promise<AIResponse<{ optimalTiming: any; reasoning: string }>> {
    const response = await apiFetch('/api/ai/nutrition/timing', {
      method: 'POST',
      body: JSON.stringify({ mealPlan }),
    });
    return response.json();
  }

  async modifyMealTiming(
    currentTiming: any,
    workoutSchedule?: any
  ): Promise<AIResponse<{ modifiedTiming: any; changes: any[] }>> {
    const response = await apiFetch('/api/ai/nutrition/timing-modify', {
      method: 'POST',
      body: JSON.stringify({ currentTiming, workoutSchedule }),
    });
    return response.json();
  }

  async scheduleMeals(
    mealPlan: any,
    preferences?: any
  ): Promise<AIResponse<{ schedule: any; recommendations: string[] }>> {
    const response = await apiFetch('/api/ai/nutrition/schedule', {
      method: 'POST',
      body: JSON.stringify({ mealPlan, preferences }),
    });
    return response.json();
  }

  async analyzePreWorkoutNutrition(): Promise<
    AIResponse<{ recommendations: any[]; timing: any }>
  > {
    const response = await apiFetch('/api/ai/nutrition/pre-workout', {
      method: 'POST',
    });
    return response.json();
  }

  async analyzePostWorkoutNutrition(): Promise<
    AIResponse<{ recommendations: any[]; timing: any }>
  > {
    const response = await apiFetch('/api/ai/nutrition/post-workout', {
      method: 'POST',
    });
    return response.json();
  }

  async analyzeMealTiming(): Promise<
    AIResponse<{ analysis: any; optimalWindows: any[] }>
  > {
    const response = await apiFetch('/api/ai/nutrition/timing-analysis', {
      method: 'POST',
    });
    return response.json();
  }

  async suggestIntermittentFasting(): Promise<
    AIResponse<{ schedule: any; benefits: string[]; considerations: string[] }>
  > {
    const response = await apiFetch('/api/ai/nutrition/intermittent-fasting', {
      method: 'POST',
    });
    return response.json();
  }

  // Progress Monitoring APIs
  async monitorProgress(): Promise<
    AIResponse<{ status: string; alerts: ProgressMonitoringAlert[] }>
  > {
    const response = await apiFetch('/api/ai/progress/monitor', {
      method: 'POST',
    });
    return response.json();
  }

  async detectPlateaus(): Promise<
    AIResponse<{ plateaus: any[]; recommendations: string[] }>
  > {
    const response = await apiFetch('/api/ai/progress/plateau', {
      method: 'POST',
    });
    return response.json();
  }

  async generateWeeklyReview(): Promise<AIResponse<WeeklyReview>> {
    const cacheKey = 'weekly:review';
    const cached = this.getCached<AIResponse<WeeklyReview>>(cacheKey);
    if (cached) return cached;

    const response = await apiFetch('/api/ai/progress/weekly-review', {
      method: 'POST',
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  // Conversation Management APIs
  async summarizeConversation(
    conversationId: string
  ): Promise<AIResponse<ConversationSummary>> {
    const response = await apiFetch('/api/ai/conversation/summarize', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    });
    return response.json();
  }

  async createConversationThread(
    conversationId: string,
    topic: string
  ): Promise<AIResponse<ConversationThread>> {
    const response = await apiFetch('/api/ai/conversation/thread', {
      method: 'POST',
      body: JSON.stringify({ conversationId, topic }),
    });
    return response.json();
  }

  async getConversationAnalytics(
    conversationId: string
  ): Promise<AIResponse<ConversationAnalytics>> {
    const cacheKey = `conversation:analytics:${conversationId}`;
    const cached = this.getCached<AIResponse<ConversationAnalytics>>(cacheKey);
    if (cached) return cached;

    const response = await apiFetch('/api/ai/conversation/analytics', {
      method: 'POST',
      body: JSON.stringify({ conversationId }),
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  // Enhanced Chat API with RAG
  async sendChatMessage(request: ChatMessageRequest): Promise<
    AIResponse<{
      response: string;
      ragContext?: RAGContext;
      analytics?: ConversationAnalytics;
    }>
  > {
    const response = await apiFetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify(request),
    });
    return response.json();
  }

  // Proactive Coaching APIs
  async getProactiveInsights(): Promise<AIResponse<ProactiveInsight[]>> {
    const cacheKey = 'proactive:insights';
    const cached = this.getCached<AIResponse<ProactiveInsight[]>>(cacheKey);
    if (cached) return cached;

    const response = await apiFetch('/api/ai/proactive/insights', {
      method: 'GET',
    });
    const result = await response.json();
    this.setCache(cacheKey, result);
    return result;
  }

  async getWeeklyReview(): Promise<AIResponse<WeeklyReview>> {
    return this.generateWeeklyReview();
  }

  async predictProgress(): Promise<AIResponse<PerformancePrediction[]>> {
    return this.predictPerformance();
  }

  // Utility APIs
  async getRateLimit(): Promise<AIResponse<RateLimitInfo>> {
    const response = await apiFetch('/api/ai/rate-limit', {
      method: 'GET',
    });
    return response.json();
  }

  async validateRAG(): Promise<
    AIResponse<{ status: string; sources: number; lastUpdated: string }>
  > {
    const response = await apiFetch('/api/ai/rag/validate', {
      method: 'GET',
    });
    return response.json();
  }

  async getRAGStats(): Promise<
    AIResponse<{
      totalVectors: number;
      namespaces: string[];
      lastUpdated: string;
    }>
  > {
    const response = await apiFetch('/api/ai/rag/stats', {
      method: 'GET',
    });
    return response.json();
  }

  // Error handling
  private handleError(error: any): AIError {
    return {
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || 'An unexpected error occurred',
      details: error.details,
      timestamp: new Date().toISOString(),
    };
  }

  // Clear cache
  clearCache(): void {
    this.cache.clear();
  }

  // Get cache stats
  getCacheStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys()),
    };
  }
}

// Export singleton instance
export const aiService = new AIServiceClient();

// Export individual methods for convenience
export const {
  storeConversationMemory,
  retrieveRelevantMemories,
  updateMemoryImportance,
  cleanupOldMemories,
  getMemorySummary,
  analyzeUserPreferences,
  determineCoachingStyle,
  adaptCoachingMessage,
  submitPersonalizationFeedback,
  adaptWorkoutPlan,
  assessInjuryRisk,
  substituteExercise,
  analyzePerformance,
  detectPerformanceAnomalies,
  predictPerformance,
  generatePerformanceReport,
  analyzeNutritionAdherence,
  suggestNutritionAdjustments,
  substituteFoods,
  analyzeHydration,
  calculateOptimalMacros,
  adjustMacros,
  optimizeMealTiming,
  modifyMealTiming,
  scheduleMeals,
  analyzePreWorkoutNutrition,
  analyzePostWorkoutNutrition,
  analyzeMealTiming,
  suggestIntermittentFasting,
  monitorProgress,
  detectPlateaus,
  generateWeeklyReview,
  summarizeConversation,
  createConversationThread,
  getConversationAnalytics,
  sendChatMessage,
  getProactiveInsights,
  getWeeklyReview,
  predictProgress,
  getRateLimit,
  validateRAG,
  getRAGStats,
} = aiService;
