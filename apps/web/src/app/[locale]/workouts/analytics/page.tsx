'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  TrendingUp,
  Calendar,
  Clock,
  Target,
  Dumbbell,
  Award,
  Activity,
  BarChart3,
  Apple,
  Filter,
  Download,
  ChevronDown,
} from 'lucide-react';

// Enhanced interfaces based on your analytics service models
interface WorkoutAnalytics {
  user_id: string;
  period: string;
  total_workouts: number;
  total_exercises: number;
  total_sets: number;
  total_reps: number;
  total_volume: number;
  avg_workout_duration: number;
  total_duration_minutes: number;
  average_workout_duration: number;
  consistency_score: number;
  strength_gains: StrengthProgress[];
  most_trained_muscle_groups: string[];
  favorite_exercises: string[];
  weekly_frequency: number;
  personal_records_count: number;
  achievement_count: number;
  body_measurements: BodyMeasurement[];
  milestones_achieved: Milestone[];
  performance_trends: PerformanceTrend[];
  generated_at: string;
  // Legacy support
  current_streak?: number;
  longest_streak?: number;
  workouts_this_week?: number;
  workouts_this_month?: number;
  last_workout_date?: string;
}

interface StrengthProgress {
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  current_max_weight: number;
  previous_max_weight: number;
  weight_increase: number;
  percentage_increase: number;
  period: string;
  measurement_date: string;
  trend: string;
}

interface BodyMeasurement {
  id: string;
  user_id: string;
  measurement_type: string;
  value: number;
  unit: string;
  measured_at: string;
  notes?: string;
}

interface Milestone {
  id: string;
  user_id: string;
  milestone_type: string;
  title: string;
  description: string;
  achieved_date: string;
  value: number;
  unit: string;
}

interface PerformanceTrend {
  metric: string;
  trend: string;
  change_percentage: number;
  period: string;
}

interface WorkoutInsights {
  user_id: string;
  period: string;
  strength_trend: string;
  consistency_trend: string;
  volume_trend: string;
  recovery_analysis: string;
  recommendations: string[];
  warnings: string[];
  achievements_unlocked: string[];
  next_milestones: string[];
  plateau_risk: number;
  overtraining_risk: number;
  improvement_areas: string[];
}

interface WorkoutHistory {
  sessions: WorkoutSession[];
  total_count: number;
}

interface WorkoutSession {
  session_id: string;
  user_id: string;
  workout_plan_id?: string;
  started_at: string;
  completed_at?: string;
  duration_minutes: number;
  total_exercises: number;
  total_sets: number;
  total_reps: number;
  total_volume: number;
  notes?: string;
  is_completed: boolean;
}

export default function WorkoutAnalyticsPage() {
  const user = useCurrentUser();
  const t = useTranslations('workouts_page.workout_analytics');
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);
  const [insights, setInsights] = useState<WorkoutInsights | null>(null);
  const [strengthProgress, setStrengthProgress] = useState<StrengthProgress[]>(
    []
  );
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutHistory | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedExercise, setSelectedExercise] = useState<string>('all');
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d' | '1y'>(
    '30d'
  );

  useEffect(() => {
    fetchAllData();
  }, [timeRange, selectedExercise]);

  const fetchAllData = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date().toISOString();
      const startDate = new Date();

      // Calculate start date based on time range
      switch (timeRange) {
        case '7d':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case '30d':
          startDate.setDate(startDate.getDate() - 30);
          break;
        case '90d':
          startDate.setDate(startDate.getDate() - 90);
          break;
        case '1y':
          startDate.setFullYear(startDate.getFullYear() - 1);
          break;
      }

      // Fetch data from multiple endpoints
      const [
        analyticsResponse,
        insightsResponse,
        strengthResponse,
        historyResponse,
      ] = await Promise.all([
        api
          .getWorkoutAnalytics(undefined, startDate.toISOString(), endDate)
          .catch(() => null),
        api.getWorkoutInsights(undefined, timeRange).catch(() => null),
        api
          .getStrengthProgress(undefined, startDate.toISOString(), endDate)
          .catch(() => null),
        api
          .getWorkoutHistory(undefined, 1, 10, {
            startDate: startDate.toISOString(),
            endDate: endDate,
            completed: true,
          })
          .catch(() => null),
      ]);

      // Process analytics data with better error handling
      if (analyticsResponse) {
        try {
          let data = analyticsResponse;
          if (typeof analyticsResponse.body === 'string') {
            data = JSON.parse(analyticsResponse.body);
          } else if (analyticsResponse.body) {
            data = analyticsResponse.body;
          }
          setAnalytics(data);
        } catch (error) {
          console.error('Error processing analytics data:', error);
        }
      }

      // Process insights data with better error handling
      if (insightsResponse) {
        try {
          let data = insightsResponse;
          if (typeof insightsResponse.body === 'string') {
            data = JSON.parse(insightsResponse.body);
          } else if (insightsResponse.body) {
            data = insightsResponse.body;
          }
          // Ensure risk values are numbers
          if (data) {
            data.plateau_risk =
              typeof data.plateau_risk === 'number' ? data.plateau_risk : 0;
            data.overtraining_risk =
              typeof data.overtraining_risk === 'number'
                ? data.overtraining_risk
                : 0;
          }
          setInsights(data);
        } catch (error) {
          console.error('Error processing insights data:', error);
        }
      }

      // Process strength progress data with better error handling
      if (strengthResponse) {
        try {
          let data = strengthResponse;
          if (typeof strengthResponse.body === 'string') {
            data = JSON.parse(strengthResponse.body);
          } else if (strengthResponse.body) {
            data = strengthResponse.body;
          }

          // Filter by selected exercise if not 'all'
          const progressData = Array.isArray(data)
            ? data
            : data?.strength_progress || [];
          const filteredProgress =
            selectedExercise === 'all'
              ? progressData
              : progressData.filter(
                  (p: StrengthProgress) => p.exercise_name === selectedExercise
                );

          setStrengthProgress(filteredProgress);
        } catch (error) {
          console.error('Error processing strength progress data:', error);
          setStrengthProgress([]);
        }
      }

      // Process workout history with better error handling
      if (historyResponse) {
        try {
          let data = historyResponse;
          if (typeof historyResponse.body === 'string') {
            data = JSON.parse(historyResponse.body);
          } else if (historyResponse.body) {
            data = historyResponse.body;
          }
          setWorkoutHistory(data);
        } catch (error) {
          console.error('Error processing workout history data:', error);
          setWorkoutHistory(null);
        }
      }
    } catch (err) {
      console.error('Error fetching analytics data:', err);
      setError('Failed to load analytics data');
    } finally {
      setLoading(false);
    }
  };

  const getTimeRangeLabel = (range: string) => {
    switch (range) {
      case '7d':
        return t('time_range.last_7_days');
      case '30d':
        return t('time_range.last_30_days');
      case '90d':
        return t('time_range.last_90_days');
      case '1y':
        return t('time_range.last_year');
      default:
        return t('time_range.last_30_days');
    }
  };

  const calculateTrendColor = (trend: string, value?: number) => {
    if (value !== undefined) {
      return value > 0
        ? 'text-green-600'
        : value < 0
          ? 'text-red-600'
          : 'text-gray-600';
    }
    switch (trend?.toLowerCase()) {
      case 'increasing':
        return 'text-green-600';
      case 'decreasing':
        return 'text-red-600';
      case 'improving':
        return 'text-green-600';
      case 'declining':
        return 'text-red-600';
      default:
        return 'text-gray-600';
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  // Get unique exercises for filter dropdown
  const uniqueExercises = Array.from(
    new Set([
      ...(analytics?.favorite_exercises || []),
      ...strengthProgress.map((p) => p.exercise_name),
    ])
  );

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getProgressColor = (percentage: number) => {
    if (percentage > 10) return 'text-green-600';
    if (percentage > 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-red-600 text-xl mb-4">{t('error_loading')}</div>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={fetchAllData}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header with Dynamic Filters */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {t('subtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Time Range Filter */}
          <div className="relative">
            <select
              value={timeRange}
              onChange={(e) =>
                setTimeRange(e.target.value as '7d' | '30d' | '90d' | '1y')
              }
              className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="7d">{t('time_range.last_7_days')}</option>
              <option value="30d">{t('time_range.last_30_days')}</option>
              <option value="90d">{t('time_range.last_90_days')}</option>
              <option value="1y">{t('time_range.last_year')}</option>
            </select>
            <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Exercise Filter */}
          {uniqueExercises.length > 0 && (
            <div className="relative">
              <select
                value={selectedExercise}
                onChange={(e) => setSelectedExercise(e.target.value)}
                className="appearance-none bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg px-4 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">{t('filters.all_exercises')}</option>
                {uniqueExercises.map((exercise) => (
                  <option key={exercise} value={exercise}>
                    {exercise}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>
          )}
        </div>
      </div>

      {/* Key Metrics Cards - All from Backend */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('metrics.total_workouts')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics?.total_workouts || 0}
              </p>
            </div>
            <Dumbbell className="h-8 w-8 text-blue-600" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {getTimeRangeLabel(timeRange)}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('metrics.total_volume')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics?.total_volume
                  ? `${(analytics.total_volume / 1000).toFixed(1)}k`
                  : '0'}
              </p>
            </div>
            <Target className="h-8 w-8 text-green-600" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {t('metrics.total_volume_desc')}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('metrics.training_time')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics?.total_duration_minutes
                  ? formatDuration(analytics.total_duration_minutes)
                  : '0m'}
              </p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {t('metrics.avg_prefix')}{' '}
            {analytics?.average_workout_duration
              ? formatDuration(Math.round(analytics.average_workout_duration))
              : '0m'}
          </p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('metrics.personal_records')}
              </p>
              <p className="text-3xl font-bold text-gray-900 dark:text-white">
                {analytics?.personal_records_count || 0}
              </p>
            </div>
            <Award className="h-8 w-8 text-yellow-600" />
          </div>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
            {t('metrics.new_achievements')}
          </p>
        </div>
      </div>

      {/* Training Distribution & Analytics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Favorite Exercises from Backend */}
        {analytics?.favorite_exercises &&
          analytics.favorite_exercises.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('sections.favorite_exercises')}
              </h2>
              <div className="space-y-3">
                {analytics.favorite_exercises
                  .slice(0, 5)
                  .map((exercise, index) => (
                    <div key={index} className="flex items-center">
                      <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full mr-3 text-sm font-medium">
                        {index + 1}
                      </div>
                      <span className="text-gray-900 dark:text-white">
                        {exercise}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
      </div>

      {/* Strength Progress */}
      {strengthProgress.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('sections.strength_progress')}
            </h2>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {strengthProgress.slice(0, 6).map((exercise, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  {exercise.exercise_name}
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {exercise.current_max_weight} lbs
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {t('sections.strength_progress_1rm')}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${calculateTrendColor(exercise.trend, exercise.percentage_increase)}`}
                    >
                      +{exercise.percentage_increase.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      {t('sections.strength_progress_vs_last_month')}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body Measurements */}
      {analytics?.body_measurements &&
        analytics.body_measurements.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                {t('sections.body_measurements')}
              </h2>
              <BarChart3 className="h-5 w-5 text-gray-400" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {analytics.body_measurements.map((measurement, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center"
                >
                  <h3 className="font-medium text-gray-900 dark:text-white mb-2 capitalize">
                    {measurement.measurement_type.replace('_', ' ')}
                  </h3>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {measurement.value}
                    <span className="text-sm font-normal text-gray-500 dark:text-gray-500 ml-1">
                      {measurement.unit}
                    </span>
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {t('sections.body_measurements_last_updated')}{' '}
                    {formatDate(measurement.measured_at)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

      {/* Performance Insights from Backend */}
      {insights && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            {t('sections.performance_insights')}
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Trends */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                {t('trends.title')}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('trends.strength')}
                  </span>
                  <span
                    className={`text-sm font-medium capitalize ${calculateTrendColor(insights.strength_trend)}`}
                  >
                    {insights.strength_trend}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('trends.consistency')}
                  </span>
                  <span
                    className={`text-sm font-medium capitalize ${calculateTrendColor(insights.consistency_trend)}`}
                  >
                    {insights.consistency_trend}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('trends.volume')}
                  </span>
                  <span
                    className={`text-sm font-medium capitalize ${calculateTrendColor(insights.volume_trend)}`}
                  >
                    {insights.volume_trend}
                  </span>
                </div>
              </div>
            </div>

            {/* Risk Assessment */}
            <div>
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                {t('trends.risk_assessment')}
              </h3>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('trends.plateau_risk')}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          (insights.plateau_risk || 0) > 0.7
                            ? 'bg-red-500'
                            : (insights.plateau_risk || 0) > 0.4
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{
                          width: `${(insights.plateau_risk || 0) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {Math.round((insights.plateau_risk || 0) * 100)}%
                    </span>
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {t('trends.overtraining')}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full ${
                          (insights.overtraining_risk || 0) > 0.7
                            ? 'bg-red-500'
                            : (insights.overtraining_risk || 0) > 0.4
                              ? 'bg-yellow-500'
                              : 'bg-green-500'
                        }`}
                        style={{
                          width: `${(insights.overtraining_risk || 0) * 100}%`,
                        }}
                      />
                    </div>
                    <span className="text-sm font-medium">
                      {Math.round((insights.overtraining_risk || 0) * 100)}%
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          {insights.recommendations && insights.recommendations.length > 0 && (
            <div className="mt-6">
              <h3 className="font-medium text-gray-900 dark:text-white mb-3">
                {t('recommendations.title')}
              </h3>
              <ul className="space-y-2">
                {insights.recommendations.slice(0, 3).map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0" />
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {rec}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Training Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Muscle Group Distribution from Backend */}
        {analytics?.most_trained_muscle_groups &&
          analytics.most_trained_muscle_groups.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('sections.muscle_group_focus')}
              </h2>
              <div className="space-y-3">
                {analytics.most_trained_muscle_groups
                  .slice(0, 5)
                  .map((muscle, index) => {
                    const percentage = ((5 - index) / 5) * 100; // Simulated percentage based on order
                    const colors = [
                      'bg-blue-500',
                      'bg-green-500',
                      'bg-purple-500',
                      'bg-yellow-500',
                      'bg-red-500',
                    ];
                    return (
                      <div
                        key={muscle}
                        className="flex items-center justify-between"
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={`w-3 h-3 rounded-full ${colors[index % colors.length]}`}
                          />
                          <span className="font-medium text-gray-900 dark:text-white capitalize">
                            {muscle}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <div className="w-32 bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                            <div
                              className={`h-2 rounded-full ${colors[index % colors.length]}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-600 dark:text-gray-400 w-12 text-right">
                            #{index + 1}
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

        {/* Recent Workout Sessions from Backend */}
        {workoutHistory?.sessions && workoutHistory.sessions.length > 0 && (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {t('sections.recent_sessions')}
            </h2>
            <div className="space-y-3">
              {workoutHistory.sessions.slice(0, 5).map((session, index) => (
                <div
                  key={session.session_id || `session-${index}`}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                >
                  <div>
                    <h3 className="font-medium text-gray-900 dark:text-white">
                      {new Date(session.started_at).toLocaleDateString()}
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {session.total_exercises}{' '}
                      {t('sections.recent_sessions_exercises')} •{' '}
                      {session.total_sets} {t('sections.recent_sessions_sets')}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-bold text-blue-600">
                      {formatDuration(session.duration_minutes)}
                    </div>
                    <p className="text-xs text-gray-500">
                      {session.total_volume
                        ? `${(session.total_volume / 1000).toFixed(1)}k lbs`
                        : t('sections.recent_sessions_volume')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Training Consistency & Achievement Milestones from Backend */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('sections.training_consistency')}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-3xl font-bold text-blue-600 mb-2">
              {analytics?.weekly_frequency?.toFixed(1) || '0.0'}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('sections.training_consistency_weekly_frequency')}
            </div>
            <div className="text-xs text-green-600 mt-1">
              {(analytics?.weekly_frequency || 0) >= 3
                ? t('sections.training_consistency_excellent')
                : t('sections.training_consistency_good')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-green-600 mb-2">
              {Math.round((analytics?.consistency_score || 0) * 100)}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('sections.training_consistency_score')}
            </div>
            <div className="text-xs text-green-600 mt-1">
              {(analytics?.consistency_score || 0) > 0.8
                ? t('sections.training_consistency_excellent')
                : t('sections.training_consistency_good')}
            </div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-purple-600 mb-2">
              {analytics?.achievement_count || 0}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {t('sections.training_consistency_achievements')}
            </div>
            <div className="text-xs text-blue-600 mt-1">
              {t('sections.training_consistency_this_period')}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
