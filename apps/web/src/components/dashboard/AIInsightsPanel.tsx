// AI Insights Panel Component for Dashboard
import React, { useState, useEffect } from 'react';
import {
  Brain,
  TrendingUp,
  Target,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  BarChart3,
  Star,
  ArrowRight,
} from 'lucide-react';
import { aiService } from '../../lib/ai-service-client';
import { ConfidenceIndicator, TrendChart } from '../ai/visualizations';
import type {
  ProactiveInsight,
  WeeklyReview,
  PerformancePrediction,
  PersonalizationProfile,
} from '../../types/ai-service';

interface AIInsightsPanelProps {
  className?: string;
}

export function AIInsightsPanel({ className = '' }: AIInsightsPanelProps) {
  const [insights, setInsights] = useState<ProactiveInsight[]>([]);
  const [weeklyReview, setWeeklyReview] = useState<WeeklyReview | null>(null);
  const [predictions, setPredictions] = useState<PerformancePrediction[]>([]);
  const [personalizationProfile, setPersonalizationProfile] =
    useState<PersonalizationProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);
  const [showAllInsights, setShowAllInsights] = useState(false);

  useEffect(() => {
    loadAIInsights();
  }, []);

  const loadAIInsights = async () => {
    try {
      setLoading(true);

      // Load all AI insights in parallel
      const [
        insightsResponse,
        weeklyReviewResponse,
        predictionsResponse,
        profileResponse,
      ] = await Promise.all([
        aiService.getProactiveInsights(),
        aiService.getWeeklyReview(),
        aiService.predictProgress(),
        aiService.analyzeUserPreferences(),
      ]);

      if (insightsResponse.success) {
        setInsights(insightsResponse.data);
      }
      console.log('AI Insights:', {
        weeklyReviewResponse,
        predictionsResponse,
        profileResponse,
      });
      if (weeklyReviewResponse.success) {
        setWeeklyReview(weeklyReviewResponse.data);
      }

      if (predictionsResponse.success) {
        setPredictions(predictionsResponse.data);
      }

      if (profileResponse.success) {
        setPersonalizationProfile(profileResponse.data);
      }
    } catch (error) {
      console.error('Failed to load AI insights:', error);
    } finally {
      setLoading(false);
    }
  };

  const getInsightIcon = (type: string) => {
    const icons = {
      'check-in': <MessageSquare className="h-4 w-4" />,
      motivation: <Zap className="h-4 w-4" />,
      plateau: <AlertCircle className="h-4 w-4" />,
      progress: <TrendingUp className="h-4 w-4" />,
      review: <BarChart3 className="h-4 w-4" />,
    };
    return (
      icons[type as keyof typeof icons] || <Lightbulb className="h-4 w-4" />
    );
  };

  const getInsightColor = (priority: string) => {
    const colors = {
      low: 'bg-blue-50 border-blue-200 text-blue-800',
      medium: 'bg-yellow-50 border-yellow-200 text-yellow-800',
      high: 'bg-red-50 border-red-200 text-red-800',
    };
    return (
      colors[priority as keyof typeof colors] ||
      'bg-gray-50 border-gray-200 text-gray-800'
    );
  };

  const getInsightPriorityIcon = (priority: string) => {
    const icons = {
      low: <CheckCircle className="h-3 w-3" />,
      medium: <AlertCircle className="h-3 w-3" />,
      high: <AlertCircle className="h-3 w-3" />,
    };
    return (
      icons[priority as keyof typeof icons] || (
        <CheckCircle className="h-3 w-3" />
      )
    );
  };

  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
      >
        <div className="flex items-center gap-2 mb-4">
          <Brain className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            AI Coach Insights
          </h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-gray-200 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const displayInsights = showAllInsights ? insights : insights.slice(0, 3);
  const hasMoreInsights = insights.length > 3;

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-blue-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            AI Coach Insights
          </h3>
        </div>
        <button
          onClick={loadAIInsights}
          className="p-1 text-gray-400 hover:text-gray-600 rounded"
          title="Refresh insights"
        >
          <TrendingUp className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-4">
        {/* Proactive Insights */}
        {displayInsights.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Proactive Coaching
            </h4>
            <div className="space-y-2">
              {displayInsights.map((insight) => (
                <div
                  key={insight.id}
                  className={`p-3 rounded-lg border ${getInsightColor(insight.priority)}`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-2 flex-1">
                      {getInsightIcon(insight.type)}
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h5 className="font-medium text-sm">
                            {insight.title}
                          </h5>
                          <div className="flex items-center gap-1">
                            {getInsightPriorityIcon(insight.priority)}
                            <span className="text-xs capitalize">
                              {insight.priority}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm opacity-90 mb-2">
                          {insight.message}
                        </p>

                        {insight.suggestedActions.length > 0 && (
                          <div className="space-y-1">
                            <button
                              onClick={() =>
                                setExpandedInsight(
                                  expandedInsight === insight.id
                                    ? null
                                    : insight.id
                                )
                              }
                              className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                              {expandedInsight === insight.id ? (
                                <>
                                  <ChevronUp className="h-3 w-3" />
                                  Hide actions
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-3 w-3" />
                                  Show actions (
                                  {insight.suggestedActions.length})
                                </>
                              )}
                            </button>

                            {expandedInsight === insight.id && (
                              <div className="space-y-1">
                                {insight.suggestedActions.map(
                                  (action, index) => (
                                    <div
                                      key={index}
                                      className="text-xs bg-white/50 p-2 rounded"
                                    >
                                      {action}
                                    </div>
                                  )
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 ml-2">
                      <ConfidenceIndicator
                        score={insight.confidence}
                        size="sm"
                        showLabel={false}
                      />
                      <span className="text-xs text-gray-500">
                        {new Date(insight.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {hasMoreInsights && (
              <button
                onClick={() => setShowAllInsights(!showAllInsights)}
                className="w-full mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center justify-center gap-1"
              >
                {showAllInsights
                  ? 'Show less'
                  : `Show all ${insights.length} insights`}
                {showAllInsights ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </button>
            )}
          </div>
        )}

        {/* Weekly Review */}
        {weeklyReview && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Weekly Review
            </h4>
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <BarChart3 className="h-4 w-4 text-green-600" />
                <h5 className="font-medium text-green-900">
                  Week of {weeklyReview.weekStart}
                </h5>
                <ConfidenceIndicator
                  score={weeklyReview.confidence}
                  size="sm"
                  showLabel={false}
                />
              </div>
              <p className="text-sm text-green-800 mb-3">
                {weeklyReview.summary}
              </p>

              {weeklyReview.achievements.length > 0 && (
                <div className="mb-3">
                  <h6 className="text-xs font-medium text-green-900 mb-1">
                    Achievements:
                  </h6>
                  <div className="space-y-1">
                    {weeklyReview.achievements
                      .slice(0, 2)
                      .map((achievement, index) => (
                        <div
                          key={index}
                          className="text-xs text-green-700 flex items-center gap-1"
                        >
                          <Star className="h-3 w-3" />
                          {achievement.description}
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {weeklyReview.nextWeekGoals.length > 0 && (
                <div>
                  <h6 className="text-xs font-medium text-green-900 mb-1">
                    Next Week Goals:
                  </h6>
                  <div className="space-y-1">
                    {weeklyReview.nextWeekGoals
                      .slice(0, 2)
                      .map((goal, index) => (
                        <div
                          key={index}
                          className="text-xs text-green-700 flex items-center gap-1"
                        >
                          <Target className="h-3 w-3" />
                          {goal}
                        </div>
                      ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Performance Predictions */}
        {predictions.length > 0 && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Performance Predictions
            </h4>
            <div className="space-y-2">
              {predictions.slice(0, 3).map((prediction, index) => (
                <div
                  key={index}
                  className="bg-blue-50 border border-blue-200 rounded-lg p-3"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h5 className="font-medium text-blue-900 text-sm">
                      {prediction.metric}
                    </h5>
                    <ConfidenceIndicator
                      score={prediction.confidence}
                      size="sm"
                      showLabel={false}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-blue-800">
                      Current: {prediction.currentValue}
                    </span>
                    <ArrowRight className="h-3 w-3 text-blue-600" />
                    <span className="text-blue-800 font-medium">
                      Predicted: {prediction.predictedValue}
                    </span>
                  </div>
                  <div className="text-xs text-blue-700 mt-1">
                    Timeframe: {prediction.timeframe}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Personalization Summary */}
        {personalizationProfile && (
          <div className="border-t border-gray-200 pt-4">
            <h4 className="text-sm font-medium text-gray-700 mb-3">
              Personalization
            </h4>
            <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
              <div className="flex items-center gap-2 mb-2">
                <Brain className="h-4 w-4 text-purple-600" />
                <h5 className="font-medium text-purple-900">Your AI Profile</h5>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-purple-700">Style:</span>
                  <span className="font-medium text-purple-900 ml-1 capitalize">
                    {personalizationProfile.coachingStyle}
                  </span>
                </div>
                <div>
                  <span className="text-purple-700">Communication:</span>
                  <span className="font-medium text-purple-900 ml-1 capitalize">
                    {personalizationProfile.communicationStyle}
                  </span>
                </div>
                <div>
                  <span className="text-purple-700">Motivation:</span>
                  <span className="font-medium text-purple-900 ml-1 capitalize">
                    {personalizationProfile.motivationType}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-purple-700">Confidence:</span>
                  <ConfidenceIndicator
                    score={personalizationProfile.confidence}
                    size="sm"
                    showLabel={false}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Quick Actions */}
        <div className="border-t border-gray-200 pt-4">
          <h4 className="text-sm font-medium text-gray-700 mb-3">
            Quick Actions
          </h4>
          <div className="grid grid-cols-2 gap-2">
            <button className="p-2 text-xs bg-blue-50 hover:bg-blue-100 text-blue-800 rounded border border-blue-200 transition-colors">
              <MessageSquare className="h-3 w-3 mx-auto mb-1" />
              Ask AI Coach
            </button>
            <button className="p-2 text-xs bg-green-50 hover:bg-green-100 text-green-800 rounded border border-green-200 transition-colors">
              <BarChart3 className="h-3 w-3 mx-auto mb-1" />
              View Analytics
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default AIInsightsPanel;
