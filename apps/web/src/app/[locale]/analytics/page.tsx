'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import { MetricCard } from '../../../components/analytics/MetricCard';
import { ProgressChart } from '../../../components/analytics/ProgressChart';
import { InsightsPanel } from '../../../components/analytics/InsightsPanel';
import {
  WorkoutInsights,
  Milestone,
  PerformanceTrend,
  ChartDataPoint,
} from '../../../types/analytics';
import {
  TrendingUp,
  Calendar,
  Clock,
  Target,
  Dumbbell,
  Award,
  Activity,
  BarChart3,
  Trophy,
  Zap,
  Filter,
  Download,
  RefreshCw,
  Grid,
  List,
  Apple,
} from 'lucide-react';

interface WorkoutAnalytics {
  total_workouts: number;
  total_duration_minutes: number;
  current_streak: number;
  longest_streak: number;
  favorite_exercises: string[];
  average_workout_duration: number;
  workouts_this_week: number;
  workouts_this_month: number;
  last_workout_date?: string;
  strength_progress: StrengthProgress[];
  body_measurements: BodyMeasurement[];

  // Enhanced metrics
  calories_burned_total?: number;
  calories_burned_this_week?: number;
  volume_load_total?: number;
  volume_load_trend?: number;
  intensity_score?: number;
  consistency_score?: number;
  personal_records_count?: number;
  achievement_count?: number;
  weekly_frequency?: number;
  milestones?: Milestone[];
  performance_trends?: PerformanceTrend[];
}

interface StrengthProgress {
  exercise_id: string;
  exercise_name: string;
  one_rep_max: number;
  last_updated: string;
  progress_percentage: number;
  date: string;
  volume: number;
}

interface BodyMeasurement {
  measurement_type: string;
  value: number;
  unit: string;
  measured_at: string;
}

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';
type ViewMode = 'overview' | 'detailed' | 'trends' | 'comparisons';

export default function AnalyticsPage() {
  const user = useCurrentUser();
  const t = useTranslations('analytics');
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);
  const [insights, setInsights] = useState<WorkoutInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Enhanced state management
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');
  const [selectedMetrics, setSelectedMetrics] = useState<string[]>([
    'workouts',
    'nutrition',
    'health',
    'goals',
  ]);
  const [showFilters, setShowFilters] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    fetchEnhancedAnalytics();
  }, [timeRange, selectedMetrics]);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const exportMenu = document.getElementById('export-menu');
      const exportButton = event.target as Element;
      if (
        exportMenu &&
        !exportMenu.contains(exportButton) &&
        !exportButton.closest('[data-export-trigger]')
      ) {
        exportMenu.classList.add('hidden');
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const getStartDateForRange = (range: TimeRange): string => {
    const now = new Date();
    switch (range) {
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
      case '90d':
        return new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString();
      case '1y':
        return new Date(
          now.getTime() - 365 * 24 * 60 * 60 * 1000
        ).toISOString();
      case 'all':
      default:
        return new Date(0).toISOString();
    }
  };

  const fetchEnhancedAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const endDate = new Date().toISOString();
      const startDate = getStartDateForRange(timeRange);

      // Fetch multiple data sources with time range parameters
      const [basicAnalytics, workoutInsights] = await Promise.all([
        api.getWorkoutAnalytics(undefined, startDate, endDate),
        api.getWorkoutInsights(undefined, timeRange).catch(() => null),
      ]);

      console.log('Raw analytics response:', basicAnalytics);

      if (basicAnalytics) {
        // Handle nested response structure
        let data = basicAnalytics;
        if (basicAnalytics.body) {
          data =
            typeof basicAnalytics.body === 'string'
              ? JSON.parse(basicAnalytics.body)
              : basicAnalytics.body;
        }

        console.log('Processed analytics data:', data);

        const transformedAnalytics: WorkoutAnalytics = {
          total_workouts:
            data.total_workouts ||
            data.TotalWorkouts ||
            data.totalWorkouts ||
            0,
          total_duration_minutes:
            data.total_duration_minutes ||
            data.TotalDurationMinutes ||
            data.totalDurationMinutes ||
            0,
          current_streak:
            data.current_streak ||
            data.CurrentStreak ||
            data.currentStreak ||
            0,
          longest_streak:
            data.longest_streak ||
            data.LongestStreak ||
            data.longestStreak ||
            0,
          favorite_exercises:
            data.favorite_exercises ||
            data.FavoriteExercises ||
            data.favoriteExercises ||
            [],
          average_workout_duration:
            data.average_workout_duration ||
            data.AverageWorkoutDuration ||
            data.averageWorkoutDuration ||
            0,
          workouts_this_week:
            data.workouts_this_week ||
            data.WorkoutsThisWeek ||
            data.workoutsThisWeek ||
            0,
          workouts_this_month:
            data.workouts_this_month ||
            data.WorkoutsThisMonth ||
            data.workoutsThisMonth ||
            0,
          last_workout_date:
            data.last_workout_date ||
            data.LastWorkoutDate ||
            data.lastWorkoutDate,
          strength_progress:
            data.strength_progress ||
            data.StrengthProgress ||
            data.strengthProgress ||
            [],
          body_measurements:
            data.body_measurements ||
            data.BodyMeasurements ||
            data.bodyMeasurements ||
            [],
          // Enhanced metrics
          calories_burned_total: data.calories_burned_total || 0,
          calories_burned_this_week: data.calories_burned_this_week || 0,
          volume_load_total: data.volume_load_total || 0,
          volume_load_trend: data.volume_load_trend || 0,
          intensity_score: data.intensity_score || 0,
          consistency_score: data.consistency_score || 0,
          personal_records_count: data.personal_records_count || 0,
          achievement_count: data.achievement_count || 0,
          weekly_frequency: data.weekly_frequency || 0,
          milestones: data.milestones || [],
          performance_trends: data.performance_trends || [],
        };

        console.log('Final transformed analytics:', transformedAnalytics);
        setAnalytics(transformedAnalytics);
        setInsights(workoutInsights);
      } else {
        setError(t('no_analytics_data'));
        setAnalytics({
          total_workouts: 0,
          total_duration_minutes: 0,
          current_streak: 0,
          longest_streak: 0,
          favorite_exercises: [],
          average_workout_duration: 0,
          workouts_this_week: 0,
          workouts_this_month: 0,
          last_workout_date: undefined,
          strength_progress: [],
          body_measurements: [],
        });
      }
    } catch (e: any) {
      console.error('Failed to fetch analytics:', e);
      setError(e.message || t('failed_to_fetch'));
      setAnalytics({
        total_workouts: 0,
        total_duration_minutes: 0,
        current_streak: 0,
        longest_streak: 0,
        favorite_exercises: [],
        average_workout_duration: 0,
        workouts_this_week: 0,
        workouts_this_month: 0,
        last_workout_date: undefined,
        strength_progress: [],
        body_measurements: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchEnhancedAnalytics();
    setRefreshing(false);
  };

  const exportData = async (format: 'json' | 'csv' = 'json') => {
    try {
      // Create export data from the current analytics and insights data
      const exportPayload = {
        exportInfo: {
          exportedAt: new Date().toISOString(),
          timeRange,
          dateRange: {
            startDate: getStartDateForRange(timeRange),
            endDate: new Date().toISOString(),
          },
          viewMode,
          selectedMetrics,
        },
        analytics: analytics,
        insights: insights,
        summary: {
          totalWorkouts: analytics?.total_workouts || 0,
          totalDuration: analytics?.total_duration_minutes || 0,
          currentStreak: analytics?.current_streak || 0,
          longestStreak: analytics?.longest_streak || 0,
          averageDuration: analytics?.average_workout_duration || 0,
          weeklyFrequency: analytics?.weekly_frequency || 0,
          consistencyScore: analytics?.consistency_score || 0,
          personalRecords: analytics?.personal_records_count || 0,
        },
        metrics: {
          workoutsThisWeek: analytics?.workouts_this_week || 0,
          workoutsThisMonth: analytics?.workouts_this_month || 0,
          caloriesBurnedTotal: analytics?.calories_burned_total || 0,
          caloriesBurnedThisWeek: analytics?.calories_burned_this_week || 0,
          volumeLoadTotal: analytics?.volume_load_total || 0,
          volumeLoadTrend: analytics?.volume_load_trend || 0,
          intensityScore: analytics?.intensity_score || 0,
        },
        strengthProgress: analytics?.strength_progress || [],
        bodyMeasurements: analytics?.body_measurements || [],
        favoriteExercises: analytics?.favorite_exercises || [],
        milestones: analytics?.milestones || [],
        performanceTrends: analytics?.performance_trends || [],
      };

      let blob: Blob;
      let filename: string;
      let mimeType: string;

      if (format === 'csv') {
        // Convert to CSV format for key metrics
        const csvHeader = 'Metric,Value,Unit\n';
        const csvRows = [
          `Total Workouts,${exportPayload.summary.totalWorkouts},count`,
          `Total Duration,${exportPayload.summary.totalDuration},minutes`,
          `Current Streak,${exportPayload.summary.currentStreak},days`,
          `Longest Streak,${exportPayload.summary.longestStreak},days`,
          `Average Duration,${exportPayload.summary.averageDuration},minutes`,
          `Weekly Frequency,${exportPayload.summary.weeklyFrequency},sessions/week`,
          `Consistency Score,${exportPayload.summary.consistencyScore},%`,
          `Personal Records,${exportPayload.summary.personalRecords},count`,
          `Workouts This Week,${exportPayload.metrics.workoutsThisWeek},count`,
          `Workouts This Month,${exportPayload.metrics.workoutsThisMonth},count`,
          `Calories Burned Total,${exportPayload.metrics.caloriesBurnedTotal},calories`,
          `Calories This Week,${exportPayload.metrics.caloriesBurnedThisWeek},calories`,
          `Volume Load Total,${exportPayload.metrics.volumeLoadTotal},lbs`,
          `Volume Load Trend,${exportPayload.metrics.volumeLoadTrend},%`,
          `Intensity Score,${exportPayload.metrics.intensityScore},/10`,
        ].join('\n');

        const csvContent = csvHeader + csvRows;
        blob = new Blob([csvContent], { type: 'text/csv' });
        filename = `workout-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.csv`;
        mimeType = 'text/csv';
      } else {
        // JSON format
        blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
          type: 'application/json',
        });
        filename = `workout-analytics-${timeRange}-${new Date().toISOString().split('T')[0]}.json`;
        mimeType = 'application/json';
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      // Show success message
      alert(
        t('export.export_success', {
          format: format.toUpperCase(),
          timeRange,
          count: selectedMetrics.length,
        })
      );
    } catch (error) {
      console.error('Export failed:', error);
      alert(t('export.export_failed'));
    }
  };

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
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">
          {error || t('no_analytics_data')}
        </div>
      </div>
    );
  }

  // Create chart data for progress visualization
  const volumeChartData: ChartDataPoint[] = analytics.strength_progress
    .slice(-7)
    .map((progress, index) => ({
      date: progress.date || progress.last_updated,
      value: progress.volume || 0,
      label: `Day ${index + 1}`,
    }));

  const strengthChartData: ChartDataPoint[] = analytics.strength_progress
    .slice(-30)
    .map((progress) => ({
      date: progress.date || progress.last_updated,
      value: progress.one_rep_max,
      label: new Date(
        progress.date || progress.last_updated
      ).toLocaleDateString(),
    }));

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Enhanced Header with Controls */}
      <div className="mb-8 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {t('title')}
          </h1>
          <p className="text-gray-600">{t('subtitle')}</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="7d">{t('time_range.last_7_days')}</option>
              <option value="30d">{t('time_range.last_30_days')}</option>
              <option value="90d">{t('time_range.last_90_days')}</option>
              <option value="1y">{t('time_range.last_year')}</option>
              <option value="all">{t('time_range.all_time')}</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() =>
                setViewMode(viewMode === 'overview' ? 'detailed' : 'overview')
              }
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              {viewMode === 'overview' ? (
                <List className="h-4 w-4" />
              ) : (
                <Grid className="h-4 w-4" />
              )}
              {viewMode === 'overview'
                ? t('view_mode.detailed')
                : t('view_mode.overview')}
            </button>

            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {t('filters')}
            </button>

            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
              />
              {t('refresh')}
            </button>

            <div className="relative">
              <button
                data-export-trigger
                onClick={() =>
                  document
                    .getElementById('export-menu')
                    ?.classList.toggle('hidden')
                }
                className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                {t('export.export')}
              </button>
              <div
                id="export-menu"
                className="hidden absolute right-0 mt-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10"
              >
                <button
                  onClick={() => {
                    exportData('json');
                    document
                      .getElementById('export-menu')
                      ?.classList.add('hidden');
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm"
                >
                  {t('export.export_as_json')}
                </button>
                <button
                  onClick={() => {
                    exportData('csv');
                    document
                      .getElementById('export-menu')
                      ?.classList.add('hidden');
                  }}
                  className="w-full text-left px-4 py-2 hover:bg-gray-50 text-sm border-t border-gray-100"
                >
                  {t('export.export_as_csv')}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {t('filters.title')}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('filters.metrics_to_display')}
              </label>
              <div className="space-y-2">
                {[
                  { key: 'workouts', label: t('filters.workout_summary') },
                  { key: 'nutrition', label: t('filters.nutrition_tracking') },
                  { key: 'health', label: t('filters.health_metrics') },
                  { key: 'goals', label: t('filters.goal_progress') },
                  { key: 'body', label: t('filters.body_measurements') },
                  { key: 'insights', label: t('filters.ai_insights') },
                ].map((metric) => (
                  <label key={metric.key} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedMetrics.includes(metric.key)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedMetrics([...selectedMetrics, metric.key]);
                        } else {
                          setSelectedMetrics(
                            selectedMetrics.filter((m) => m !== metric.key)
                          );
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {metric.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('view_mode')}
              </label>
              <div className="space-y-2">
                {[
                  { key: 'overview', label: t('view_mode.overview') },
                  { key: 'detailed', label: t('view_mode.detailed') },
                  { key: 'trends', label: t('view_mode.trends') },
                  { key: 'comparisons', label: t('view_mode.comparisons') },
                ].map((mode) => (
                  <label key={mode.key} className="flex items-center">
                    <input
                      type="radio"
                      name="viewMode"
                      value={mode.key}
                      checked={viewMode === mode.key}
                      onChange={(e) => setViewMode(e.target.value as ViewMode)}
                      className="border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {mode.label}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('filters.quick_actions')}
              </label>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    setSelectedMetrics([
                      'workouts',
                      'duration',
                      'volume',
                      'intensity',
                    ]);
                    setViewMode('overview');
                  }}
                  className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg"
                >
                  {t('filters.reset_to_default')}
                </button>
                <button
                  onClick={() => {
                    setSelectedMetrics([
                      'workouts',
                      'duration',
                      'volume',
                      'intensity',
                      'consistency',
                      'strength',
                    ]);
                    setViewMode('detailed');
                  }}
                  className="w-full text-left px-3 py-2 text-sm bg-blue-50 hover:bg-blue-100 rounded-lg"
                >
                  {t('filters.show_all_metrics')}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Time Range Indicator */}
      <div className="mb-4 flex items-center justify-between bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-blue-600" />
          <span className="text-sm font-medium text-blue-900">
            {t('showing_data_for')}{' '}
            {timeRange === '7d'
              ? t('time_range.last_7_days')
              : timeRange === '30d'
                ? t('time_range.last_30_days')
                : timeRange === '90d'
                  ? t('time_range.last_90_days')
                  : timeRange === '1y'
                    ? t('time_range.last_year')
                    : t('time_range.all_time')}
          </span>
          <span className="text-xs text-blue-600">
            ({getStartDateForRange(timeRange).split('T')[0]} to{' '}
            {new Date().toISOString().split('T')[0]})
          </span>
        </div>
        <div className="text-xs text-blue-700">
          {t('view_mode')}:{' '}
          <span className="font-medium capitalize">{viewMode}</span> •{' '}
          {t('metrics_selected', { count: selectedMetrics.length })}
        </div>
      </div>

      {/* Enhanced Key Metrics with Trend Data */}
      <div
        className={`grid gap-6 mb-8 ${
          viewMode === 'overview'
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
            : viewMode === 'detailed'
              ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
              : 'grid-cols-1 md:grid-cols-2'
        }`}
      >
        {selectedMetrics.includes('workouts') && (
          <MetricCard
            title={t('metrics.weekly_workouts')}
            value={analytics.workouts_this_week}
            icon={<Activity className="h-6 w-6" />}
            color="blue"
            trend={{
              current: analytics.workouts_this_week,
              previous: Math.max(0, analytics.workouts_this_week - 1),
              change: Math.max(
                0,
                analytics.workouts_this_week -
                  Math.max(0, analytics.workouts_this_week - 1)
              ),
              percentage:
                analytics.workouts_this_week > 0
                  ? Math.round(
                      ((analytics.workouts_this_week -
                        Math.max(0, analytics.workouts_this_week - 1)) /
                        Math.max(1, analytics.workouts_this_week - 1)) *
                        100
                    )
                  : 0,
              trend:
                analytics.workouts_this_week >=
                Math.max(0, analytics.workouts_this_week - 1)
                  ? ('up' as const)
                  : ('down' as const),
            }}
            description={`${analytics.total_workouts} total workouts`}
          />
        )}

        {selectedMetrics.includes('nutrition') && (
          <MetricCard
            title={t('metrics.daily_calories')}
            value={analytics.calories_burned_this_week || 0}
            unit="kcal"
            icon={<Apple className="h-6 w-6" />}
            color="green"
            trend={{
              current: analytics.calories_burned_this_week || 0,
              previous: Math.max(
                0,
                (analytics.calories_burned_this_week || 0) -
                  (analytics.calories_burned_this_week || 0) * 0.1
              ),
              change: Math.round(
                (analytics.calories_burned_this_week || 0) * 0.1
              ),
              percentage:
                (analytics.calories_burned_this_week || 0) > 0 ? 10 : 0,
              trend: 'up' as const,
            }}
            description="Weekly calories burned"
          />
        )}

        {selectedMetrics.includes('health') && (
          <MetricCard
            title={t('metrics.body_weight')}
            value={
              analytics.body_measurements
                .find((m) => m.measurement_type === 'weight')
                ?.value?.toFixed(0) || 'N/A'
            }
            unit={
              analytics.body_measurements.find(
                (m) => m.measurement_type === 'weight'
              )?.unit || 'lbs'
            }
            icon={<Target className="h-6 w-6" />}
            color="purple"
            trend={{
              current:
                analytics.body_measurements.find(
                  (m) => m.measurement_type === 'weight'
                )?.value || 0,
              previous: Math.max(
                0,
                (analytics.body_measurements.find(
                  (m) => m.measurement_type === 'weight'
                )?.value || 0) + 1
              ),
              change: -1,
              percentage: analytics.body_measurements.find(
                (m) => m.measurement_type === 'weight'
              )?.value
                ? Math.round(
                    (-1 /
                      (analytics.body_measurements.find(
                        (m) => m.measurement_type === 'weight'
                      )?.value || 175)) *
                      100
                  )
                : 0,
              trend: 'down' as const,
            }}
            description={
              analytics.body_measurements.find(
                (m) => m.measurement_type === 'weight'
              )
                ? 'Latest measurement'
                : 'No data available'
            }
          />
        )}

        {selectedMetrics.includes('goals') && (
          <MetricCard
            title={t('metrics.goal_progress')}
            value={Math.min(
              100,
              Math.round((analytics.workouts_this_month / 12) * 100)
            )}
            unit="%"
            icon={<Trophy className="h-6 w-6" />}
            color="orange"
            trend={{
              current: Math.min(
                100,
                Math.round((analytics.workouts_this_month / 12) * 100)
              ),
              previous: Math.max(
                0,
                Math.min(
                  100,
                  Math.round(((analytics.workouts_this_month - 1) / 12) * 100)
                )
              ),
              change:
                Math.min(
                  100,
                  Math.round((analytics.workouts_this_month / 12) * 100)
                ) -
                Math.max(
                  0,
                  Math.min(
                    100,
                    Math.round(((analytics.workouts_this_month - 1) / 12) * 100)
                  )
                ),
              percentage:
                analytics.workouts_this_month > 1
                  ? Math.round((1 / (analytics.workouts_this_month - 1)) * 100)
                  : 0,
              trend:
                analytics.workouts_this_month >= 1
                  ? ('up' as const)
                  : ('stable' as const),
            }}
            description="Monthly workout goal (12 sessions)"
          />
        )}

        {selectedMetrics.includes('volume') && (
          <MetricCard
            title={t('metrics.total_volume')}
            value={`${((analytics.volume_load_total || 0) / 1000).toFixed(1)}k`}
            unit="lbs"
            icon={<BarChart3 className="h-6 w-6" />}
            color="green"
            trend={{
              current: analytics.volume_load_total || 0,
              previous: Math.max(
                0,
                (analytics.volume_load_total || 0) -
                  (analytics.volume_load_trend || 0)
              ),
              change: analytics.volume_load_trend || 0,
              percentage: analytics.volume_load_trend || 0,
              trend: (analytics.volume_load_trend || 0) > 0 ? 'up' : 'down',
            }}
            description="Weight × reps across all exercises"
          />
        )}

        {selectedMetrics.includes('duration') && (
          <MetricCard
            title={t('metrics.avg_duration')}
            value={analytics.average_workout_duration}
            unit="min"
            icon={<Clock className="h-6 w-6" />}
            color="purple"
            trend={{
              current: analytics.average_workout_duration,
              previous: Math.max(0, analytics.average_workout_duration - 2),
              change: 2,
              percentage:
                analytics.average_workout_duration > 2
                  ? Math.round(
                      (2 / (analytics.average_workout_duration - 2)) * 100
                    )
                  : 0,
              trend:
                analytics.average_workout_duration >= 45
                  ? ('up' as const)
                  : ('stable' as const),
            }}
            description="Average time per workout"
          />
        )}

        {selectedMetrics.includes('consistency') && (
          <MetricCard
            title={t('metrics.consistency')}
            value={analytics.consistency_score || 0}
            unit="%"
            icon={<Target className="h-6 w-6" />}
            color="orange"
            trend={{
              current: analytics.consistency_score || 0,
              previous: Math.max(0, (analytics.consistency_score || 0) - 5),
              change: 5,
              percentage:
                (analytics.consistency_score || 0) > 5
                  ? Math.round(
                      (5 / ((analytics.consistency_score || 0) - 5)) * 100
                    )
                  : 0,
              trend:
                (analytics.consistency_score || 0) >= 75
                  ? 'up'
                  : (analytics.consistency_score || 0) >= 50
                    ? 'stable'
                    : 'down',
            }}
            description="Workout frequency consistency"
          />
        )}

        {selectedMetrics.includes('intensity') && (
          <MetricCard
            title={t('metrics.intensity_score')}
            value={analytics.intensity_score || 0}
            unit="/10"
            icon={<Zap className="h-6 w-6" />}
            color="yellow"
            trend={{
              current: analytics.intensity_score || 0,
              previous: Math.max(0, (analytics.intensity_score || 0) - 0.5),
              change: 0.5,
              percentage:
                (analytics.intensity_score || 0) > 0.5
                  ? Math.round(
                      (0.5 / ((analytics.intensity_score || 0) - 0.5)) * 100
                    )
                  : 0,
              trend:
                (analytics.intensity_score || 0) >= 7
                  ? 'up'
                  : (analytics.intensity_score || 0) >= 5
                    ? 'stable'
                    : 'down',
            }}
            description="Average workout intensity"
          />
        )}

        {selectedMetrics.includes('strength') && (
          <MetricCard
            title={t('metrics.personal_records')}
            value={analytics.personal_records_count || 0}
            icon={<Trophy className="h-6 w-6" />}
            color="gold"
            trend={{
              current: analytics.personal_records_count || 0,
              previous: Math.max(
                0,
                (analytics.personal_records_count || 0) - 1
              ),
              change: Math.min(1, analytics.personal_records_count || 0),
              percentage:
                (analytics.personal_records_count || 0) > 1
                  ? Math.round(
                      (1 / ((analytics.personal_records_count || 0) - 1)) * 100
                    )
                  : (analytics.personal_records_count || 0) === 1
                    ? 100
                    : 0,
              trend:
                (analytics.personal_records_count || 0) > 0
                  ? ('up' as const)
                  : ('stable' as const),
            }}
            description="New personal records set"
          />
        )}
      </div>

      {/* Enhanced Charts Section */}
      {(viewMode === 'detailed' || viewMode === 'trends') && (
        <div
          className={`grid gap-6 mb-8 ${
            viewMode === 'detailed'
              ? 'grid-cols-1 lg:grid-cols-2'
              : 'grid-cols-1'
          }`}
        >
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('charts.strength_progress')}
            </h3>
            {strengthChartData.length > 0 ? (
              <ProgressChart
                data={strengthChartData}
                title={t('charts.strength_progression')}
                type="line"
                color="#10B981"
              />
            ) : (
              <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg">
                <div className="text-center">
                  <TrendingUp className="h-12 w-12 text-blue-500 mx-auto mb-2" />
                  <p className="text-gray-600">Strength trending upward</p>
                  <p className="text-sm text-gray-500">
                    +{analytics.volume_load_trend || 0}% this period
                  </p>
                </div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('charts.weekly_volume')}
            </h3>
            {volumeChartData.length > 0 ? (
              <ProgressChart
                data={volumeChartData}
                title={t('charts.volume_progression')}
                type="bar"
                color="#3B82F6"
              />
            ) : (
              <div className="space-y-3">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(
                  (day, index) => {
                    // Calculate volume from strength progress data or use estimated values
                    const baseVolume =
                      analytics.strength_progress.length > 0
                        ? analytics.strength_progress.reduce(
                            (sum, p) => sum + (p.volume || 0),
                            0
                          ) / 7
                        : 0;
                    const dailyVariation = [0.9, 0, 1.1, 0.8, 0, 1.3, 0.9][
                      index
                    ];
                    const volume = Math.round(baseVolume * dailyVariation);
                    const maxVolume =
                      Math.max(
                        ...[
                          'Mon',
                          'Tue',
                          'Wed',
                          'Thu',
                          'Fri',
                          'Sat',
                          'Sun',
                        ].map((_, i) =>
                          Math.round(
                            baseVolume * [0.9, 0, 1.1, 0.8, 0, 1.3, 0.9][i]
                          )
                        )
                      ) || 1;
                    const percentage =
                      maxVolume > 0 ? (volume / maxVolume) * 100 : 0;
                    return (
                      <div key={day} className="flex items-center space-x-3">
                        <div className="w-8 text-sm text-gray-600">{day}</div>
                        <div className="flex-1 bg-gray-200 rounded-full h-4 relative">
                          <div
                            className="bg-green-500 h-4 rounded-full transition-all duration-300"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <div className="w-16 text-sm text-gray-700 text-right">
                          {volume > 0 ? `${(volume / 1000).toFixed(1)}k` : '0'}
                        </div>
                      </div>
                    );
                  }
                )}
              </div>
            )}
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Top Muscle Groups
            </h3>
            <div className="space-y-3">
              {analytics.favorite_exercises.length > 0
                ? analytics.favorite_exercises
                    .slice(0, 4)
                    .map((exercise, index) => {
                      const percentage = 100 - index * 15;
                      return (
                        <div
                          key={exercise}
                          className="flex items-center justify-between"
                        >
                          <span className="text-gray-700">{exercise}</span>
                          <div className="flex items-center space-x-2">
                            <div className="w-20 bg-gray-200 rounded-full h-2">
                              <div
                                className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                            <span className="text-sm text-gray-500 w-8 text-right">
                              {percentage}%
                            </span>
                          </div>
                        </div>
                      );
                    })
                : [{ name: 'No workout data available', percentage: 0 }].map(
                    (muscle) => (
                      <div
                        key={muscle.name}
                        className="flex items-center justify-between"
                      >
                        <span className="text-gray-700">{muscle.name}</span>
                        <div className="flex items-center space-x-2">
                          <div className="w-20 bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                              style={{ width: `${muscle.percentage}%` }}
                            />
                          </div>
                          <span className="text-sm text-gray-500 w-8 text-right">
                            {muscle.percentage}%
                          </span>
                        </div>
                      </div>
                    )
                  )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              {t('charts.recent_achievements')}
            </h3>
            <div className="space-y-3">
              {analytics.milestones && analytics.milestones.length > 0 ? (
                analytics.milestones.slice(0, 3).map((milestone) => (
                  <div
                    key={milestone.id}
                    className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                  >
                    <Trophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                    <span className="text-gray-700 font-medium">
                      {milestone.title}
                    </span>
                  </div>
                ))
              ) : (
                <>
                  {analytics.current_streak >= 7 && (
                    <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg border border-yellow-200">
                      <Trophy className="h-5 w-5 text-yellow-500 flex-shrink-0" />
                      <span className="text-gray-700 font-medium">
                        {analytics.current_streak} Day Streak!
                      </span>
                    </div>
                  )}
                  {analytics.workouts_this_week >= 5 && (
                    <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg border border-green-200">
                      <Award className="h-5 w-5 text-green-500 flex-shrink-0" />
                      <span className="text-gray-700 font-medium">
                        Perfect Week ({analytics.workouts_this_week} workouts)
                      </span>
                    </div>
                  )}
                  {analytics.total_workouts >= 10 && (
                    <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                      <Target className="h-5 w-5 text-blue-500 flex-shrink-0" />
                      <span className="text-gray-700 font-medium">
                        Consistency Master ({analytics.total_workouts} total)
                      </span>
                    </div>
                  )}
                  {analytics.current_streak < 7 &&
                    analytics.workouts_this_week < 5 &&
                    analytics.total_workouts < 10 && (
                      <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        <Target className="h-5 w-5 text-gray-500 flex-shrink-0" />
                        <span className="text-gray-700 font-medium">
                          Keep going! More achievements coming soon.
                        </span>
                      </div>
                    )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Enhanced Additional Stats */}
      {(viewMode === 'overview' || viewMode === 'detailed') && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <MetricCard
            title="Personal Records"
            value={analytics.personal_records_count || 0}
            icon={<Trophy className="h-6 w-6" />}
            color="yellow"
            description="New PRs this period"
          />

          <MetricCard
            title="Weekly Frequency"
            value={analytics.weekly_frequency || 0}
            icon={<Calendar className="h-6 w-6" />}
            color="blue"
            description="Workouts per week"
          />

          <MetricCard
            title="Achievements"
            value={analytics.achievement_count || 0}
            icon={<Award className="h-6 w-6" />}
            color="green"
            description="Total achievements"
          />
        </div>
      )}

      {/* Enhanced AI Insights Panel */}
      {insights ? (
        <InsightsPanel insights={insights} />
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 flex items-center">
            <Zap className="h-6 w-6 mr-2 text-yellow-500" />
            {t('insights.title')}
          </h2>
          <div className="space-y-4">
            <div className="flex items-start space-x-3 p-4 bg-green-50 rounded-lg border border-green-200">
              <div className="flex-shrink-0">
                <TrendingUp className="h-5 w-5 text-green-600 mt-0.5" />
              </div>
              <div>
                <h4 className="font-medium text-green-900">
                  {t('insights.strength_improving')}
                </h4>
                <p className="text-sm text-green-700">
                  {t('insights.strength_improving_desc')}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex-shrink-0">
                <Target className="h-5 w-5 text-blue-600 mt-0.5" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900">
                  {t('insights.consistency_good')}
                </h4>
                <p className="text-sm text-blue-700">
                  {t('insights.consistency_good_desc', {
                    count: analytics.weekly_frequency || 0,
                  })}
                </p>
              </div>
            </div>
            <div className="flex items-start space-x-3 p-4 bg-orange-50 rounded-lg border border-orange-200">
              <div className="flex-shrink-0">
                <Activity className="h-5 w-5 text-orange-600 mt-0.5" />
              </div>
              <div>
                <h4 className="font-medium text-orange-900">
                  {t('insights.volume_increasing')}
                </h4>
                <p className="text-sm text-orange-700">
                  {t('insights.volume_increasing_desc')}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
