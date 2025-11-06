'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Calendar,
  Clock,
  CheckCircle,
  Star,
  Eye,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Filter,
  Search,
  Download,
  BarChart3,
  TrendingUp,
  Dumbbell,
  Target,
  ArrowUpDown,
  Play,
  Pause,
  MoreHorizontal,
  Activity,
  Zap,
  Award,
  RefreshCw,
  Calendar as CalendarIcon,
  SortAsc,
  SortDesc,
  Grid,
  List,
  Map,
  PieChart,
  Bookmark,
  Share,
  Edit,
  X,
  Smile,
  Meh,
  Frown,
  Trophy,
} from 'lucide-react';

interface EnhancedWorkoutSession {
  id: string;
  name: string;
  started_at: string;
  completed_at?: string;
  duration_minutes?: number;
  rating?: number;
  notes?: string;
  exercises: Array<{
    id: string;
    name: string;
    notes?: string;
    sets: Array<{
      id: string;
      reps: number;
      weight: number;
      completed?: boolean;
      set_number?: number;
      duration_seconds?: number;
    }>;
  }>;
  calories_burned?: number;
  volume_load?: number;
  intensity_score?: number;
  difficulty?: 'easy' | 'moderate' | 'hard' | 'extreme';
  mood?: 'great' | 'good' | 'okay' | 'tired' | 'exhausted';
  personal_records?: string[];
}

interface PersonalRecord {
  id: string;
  exercise_id: string;
  exercise_name: string;
  record_type: string;
  value: number;
  unit: string;
  achieved_at: string;
}

// For backwards compatibility
interface WorkoutSession extends EnhancedWorkoutSession {}

interface SessionExercise {
  exercise_id: string;
  exercise_name?: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
  order: number;
  rest_time_seconds?: number;
  muscle_groups?: string[];
  equipment?: string[];
}

interface ExerciseSet {
  set_number: number;
  reps?: number;
  weight?: number;
  duration_seconds?: number;
  rest_seconds?: number;
  completed: boolean;
  notes?: string;
  rpe?: number; // Rate of Perceived Exertion 1-10
  heart_rate?: number;
}

interface WorkoutHistory {
  sessions: WorkoutSession[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

type ViewMode = 'list' | 'grid' | 'timeline' | 'calendar';
type FilterStatus = 'all' | 'completed' | 'incomplete';
type SortBy = 'date' | 'duration' | 'calories' | 'volume' | 'rating';
type SortOrder = 'asc' | 'desc';
type DifficultyFilter = 'all' | 'easy' | 'moderate' | 'hard' | 'extreme';

export default function EnhancedWorkoutHistoryPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const t = useTranslations('workout_history');
  const [history, setHistory] = useState<WorkoutHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(
    null
  );

  // Enhanced state management
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit] = useState(12);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterCompleted, setFilterCompleted] = useState<FilterStatus>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(
    new Set()
  );
  const [refreshing, setRefreshing] = useState(false);

  // Analytics state
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [analyticsData, setAnalyticsData] = useState<any>(null);

  useEffect(() => {
    fetchHistory();
  }, [currentPage]);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getWorkoutHistory(
        undefined,
        currentPage,
        pageLimit
      );

      if (response) {
        // Handle nested response structure
        let data = response;
        if (response.body) {
          data =
            typeof response.body === 'string'
              ? JSON.parse(response.body)
              : response.body;
        }

        const transformedHistory: WorkoutHistory = {
          sessions: (
            data.sessions ||
            data.Sessions ||
            data.workoutSessions ||
            []
          ).map((session: any) => ({
            id:
              session.id ||
              session.WorkoutSessionId ||
              session.workoutSessionId,
            name:
              session.name ||
              session.Name ||
              session.workoutName ||
              'Workout Session',
            started_at:
              session.started_at || session.StartedAt || session.startedAt,
            completed_at:
              session.completed_at ||
              session.CompletedAt ||
              session.completedAt,
            duration_minutes:
              session.duration_minutes ||
              session.DurationMinutes ||
              session.durationMinutes,
            rating: session.rating || session.Rating,
            notes: session.notes || session.Notes,
            exercises:
              session.exercises ||
              session.Exercises ||
              session.workoutExercises ||
              [],
          })),
          pagination: {
            page: data.pagination?.page || data.page || currentPage,
            limit: data.pagination?.limit || data.limit || pageLimit,
            total: data.pagination?.total || data.total || 0,
            total_pages:
              data.pagination?.total_pages ||
              data.totalPages ||
              Math.ceil(
                (data.pagination?.total || data.total || 0) / pageLimit
              ),
          },
        };

        setHistory(transformedHistory);
      } else {
        setError('No workout history found');
        setHistory({
          sessions: [],
          pagination: {
            page: currentPage,
            limit: pageLimit,
            total: 0,
            total_pages: 0,
          },
        });
      }
    } catch (e: any) {
      console.error('Failed to fetch workout history:', e);
      setError('Failed to fetch workout history');
    } finally {
      setLoading(false);
    }
  };

  const deleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this workout session?'))
      return;

    try {
      await api.deleteWorkoutSession(sessionId);
      // Refresh the history
      fetchHistory();
    } catch (e: any) {
      console.error('Failed to delete workout session:', e);
      alert('Failed to delete workout session');
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }, (_, i) => (
      <Star
        key={i}
        className={`h-4 w-4 ${
          i < rating
            ? 'text-yellow-400 fill-current'
            : 'text-gray-300 dark:text-gray-600'
        }`}
      />
    ));
  };

  // Enhanced filtering and sorting functions
  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchHistory();
    setRefreshing(false);
  };

  const calculateSessionMetrics = (session: WorkoutSession) => {
    const totalSets = session.exercises.reduce(
      (acc, ex) => acc + ex.sets.length,
      0
    );
    const totalReps = session.exercises.reduce(
      (acc, ex) =>
        acc + ex.sets.reduce((repAcc, set) => repAcc + (set.reps || 0), 0),
      0
    );
    const totalVolume = session.exercises.reduce(
      (acc, ex) =>
        acc +
        ex.sets.reduce(
          (volAcc, set) => volAcc + (set.weight || 0) * (set.reps || 0),
          0
        ),
      0
    );

    return {
      sets: totalSets,
      reps: totalReps,
      volume: totalVolume,
      calories: Math.round(
        totalVolume * 0.05 + (session.duration_minutes || 0) * 5
      ), // Rough estimate
    };
  };

  const getDifficultyColor = (difficulty?: string) => {
    switch (difficulty) {
      case 'easy':
        return 'text-green-600 bg-green-50';
      case 'moderate':
        return 'text-yellow-600 bg-yellow-50';
      case 'hard':
        return 'text-orange-600 bg-orange-50';
      case 'extreme':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const exportData = async () => {
    try {
      const data = filteredSessions.map((session) => ({
        ...session,
        metrics: calculateSessionMetrics(session),
      }));
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `workout-history-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const getSessionSortValue = (session: WorkoutSession, sortBy: SortBy) => {
    switch (sortBy) {
      case 'date':
        return new Date(session.started_at).getTime();
      case 'duration':
        return session.duration_minutes || 0;
      case 'calories':
        return calculateSessionMetrics(session).calories;
      case 'volume':
        return calculateSessionMetrics(session).volume;
      case 'rating':
        return session.rating || 0;
      default:
        return new Date(session.started_at).getTime();
    }
  };

  const filteredSessions =
    history?.sessions
      .filter((session) => {
        // Status filter
        if (filterCompleted === 'completed' && !session.completed_at)
          return false;
        if (filterCompleted === 'incomplete' && session.completed_at)
          return false;

        // Search filter
        if (
          searchQuery &&
          !session.name.toLowerCase().includes(searchQuery.toLowerCase())
        ) {
          return false;
        }

        // Date filter
        if (dateFilter) {
          const sessionDate = new Date(session.started_at)
            .toISOString()
            .split('T')[0];
          if (sessionDate !== dateFilter) return false;
        }

        return true;
      })
      .sort((a, b) => {
        const aValue = getSessionSortValue(a, sortBy);
        const bValue = getSessionSortValue(b, sortBy);

        if (sortOrder === 'asc') {
          return aValue > bValue ? 1 : -1;
        } else {
          return aValue < bValue ? 1 : -1;
        }
      }) || [];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !history) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">
          {error || t('no_history_data')}
        </div>
      </div>
    );
  }

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
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder={t('search_workouts')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Date Filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <button
              onClick={() => setViewMode(viewMode === 'list' ? 'grid' : 'list')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              {viewMode === 'list' ? (
                <Grid className="h-4 w-4" />
              ) : (
                <List className="h-4 w-4" />
              )}
              {viewMode === 'list' ? t('grid_view') : t('list_view')}
            </button>

            {/* Sort Controls */}
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="date">{t('sort_by_date')}</option>
              <option value="duration">{t('sort_by_duration')}</option>
              <option value="calories">{t('sort_by_calories')}</option>
              <option value="volume">{t('sort_by_volume')}</option>
              <option value="rating">{t('sort_by_rating')}</option>
            </select>

            <button
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              {sortOrder === 'asc' ? (
                <SortAsc className="h-4 w-4" />
              ) : (
                <SortDesc className="h-4 w-4" />
              )}
            </button>

            {/* Filters Toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Filter className="h-4 w-4" />
              {t('filters')}
            </button>

            {/* Refresh */}
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

            {/* Export */}
            <button
              onClick={exportData}
              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Download className="h-4 w-4" />
              {t('export')}
            </button>
          </div>
        </div>
      </div>

      {/* Advanced Filters Panel */}
      {showFilters && (
        <div className="mb-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('status')}
              </label>
              <select
                value={filterCompleted}
                onChange={(e) =>
                  setFilterCompleted(e.target.value as FilterStatus)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">{t('all_sessions')}</option>
                <option value="completed">{t('completed_only')}</option>
                <option value="incomplete">{t('incomplete_only')}</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {t('difficulty')}
              </label>
              <select
                value={difficultyFilter}
                onChange={(e) =>
                  setDifficultyFilter(e.target.value as DifficultyFilter)
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">{t('all_difficulties')}</option>
                <option value="easy">{t('easy')}</option>
                <option value="moderate">{t('moderate')}</option>
                <option value="hard">{t('hard')}</option>
                <option value="extreme">{t('extreme')}</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() => {
                  setSearchQuery('');
                  setDateFilter('');
                  setFilterCompleted('all');
                  setDifficultyFilter('all');
                }}
                className="w-full px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200"
              >
                {t('clear_filters')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('total_sessions')}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {history.pagination.total}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('completed')}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {history.sessions.filter((s) => s.completed_at).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('total_time')}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {Math.round(
                  history.sessions
                    .filter((s) => s.duration_minutes)
                    .reduce((acc, s) => acc + (s.duration_minutes || 0), 0) / 60
                )}
                h
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('avg_rating')}
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {(
                  history.sessions
                    .filter((s) => s.rating)
                    .reduce((acc, s) => acc + (s.rating || 0), 0) /
                    history.sessions.filter((s) => s.rating).length || 0
                ).toFixed(1)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center space-x-4">
          <Filter className="h-5 w-5 text-gray-400" />
          <select
            value={filterCompleted}
            onChange={(e) => setFilterCompleted(e.target.value as FilterStatus)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">{t('all_sessions')}</option>
            <option value="completed">{t('completed_only')}</option>
            <option value="incomplete">{t('incomplete_only')}</option>
          </select>
        </div>
      </div>

      {/* Workout Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            {t('no_sessions_found')}
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {t('start_working_out')}
          </p>
        </div>
      ) : (
        <div
          className={`${viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'space-y-4'}`}
        >
          {filteredSessions.map((session) => {
            const enhancedSession = session as EnhancedWorkoutSession;
            const metrics = calculateSessionMetrics(enhancedSession);
            const difficultyColor = getDifficultyColor(
              enhancedSession.difficulty || 'moderate'
            );

            return (
              <div
                key={session.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 overflow-hidden"
              >
                {/* Enhanced Session Header with Status Bar */}
                <div
                  className={`h-2 w-full ${enhancedSession.completed_at ? 'bg-green-500' : 'bg-yellow-500'}`}
                />

                <div className="p-6">
                  {/* Header with Status and Difficulty */}
                  <div className="flex justify-between items-start mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">
                          {enhancedSession.name}
                        </h3>
                        <span
                          className={`px-2 py-1 text-xs font-medium rounded-full ${difficultyColor}`}
                        >
                          {enhancedSession.difficulty || 'Moderate'}
                        </span>
                        {enhancedSession.completed_at ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <Clock className="h-5 w-5 text-yellow-600" />
                        )}
                      </div>

                      <div className="flex items-center gap-4 text-sm text-gray-500">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(enhancedSession.started_at)}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {enhancedSession.duration_minutes} min
                        </div>
                      </div>
                    </div>

                    {/* Rating and Mood */}
                    <div className="flex flex-col items-end gap-2">
                      {enhancedSession.rating && (
                        <div className="flex gap-1">
                          {renderStars(enhancedSession.rating)}
                        </div>
                      )}
                      {enhancedSession.mood && (
                        <div className="flex items-center gap-1 text-sm text-gray-600">
                          {enhancedSession.mood === 'great' && (
                            <Smile className="h-4 w-4 text-green-500" />
                          )}
                          {enhancedSession.mood === 'good' && (
                            <Smile className="h-4 w-4 text-blue-500" />
                          )}
                          {enhancedSession.mood === 'okay' && (
                            <Meh className="h-4 w-4 text-yellow-500" />
                          )}
                          {enhancedSession.mood === 'tired' && (
                            <Frown className="h-4 w-4 text-orange-500" />
                          )}
                          {enhancedSession.mood === 'exhausted' && (
                            <Frown className="h-4 w-4 text-red-500" />
                          )}
                          <span className="capitalize">
                            {enhancedSession.mood}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Enhanced Metrics Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4 p-4 bg-gray-50 rounded-lg">
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                        <Target className="h-4 w-4" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {metrics.sets}
                      </div>
                      <div className="text-xs text-gray-500">Sets</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
                        <Zap className="h-4 w-4" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {metrics.reps}
                      </div>
                      <div className="text-xs text-gray-500">Reps</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-purple-600 mb-1">
                        <Activity className="h-4 w-4" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {enhancedSession.calories_burned || metrics.calories}
                      </div>
                      <div className="text-xs text-gray-500">Calories</div>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-1 text-orange-600 mb-1">
                        <Dumbbell className="h-4 w-4" />
                      </div>
                      <div className="text-lg font-semibold text-gray-900">
                        {Math.round(metrics.volume)}
                      </div>
                      <div className="text-xs text-gray-500">Volume</div>
                    </div>
                  </div>

                  {/* Exercise Summary */}
                  <div className="mb-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="text-sm font-medium text-gray-700">
                        Exercises ({enhancedSession.exercises.length})
                      </div>
                      {enhancedSession.personal_records &&
                        enhancedSession.personal_records.length > 0 && (
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <Trophy className="h-4 w-4" />
                            {enhancedSession.personal_records.length} PR
                            {enhancedSession.personal_records.length > 1
                              ? 's'
                              : ''}
                          </div>
                        )}
                    </div>
                    <div className="space-y-1">
                      {enhancedSession.exercises
                        .slice(0, 3)
                        .map((exercise, index) => (
                          <div
                            key={index}
                            className="flex justify-between items-center text-sm"
                          >
                            <span className="text-gray-700">
                              {exercise.name}
                            </span>
                            <span className="text-gray-500">
                              {exercise.sets.length} sets
                            </span>
                          </div>
                        ))}
                      {enhancedSession.exercises.length > 3 && (
                        <div className="text-sm text-gray-500 text-center py-1">
                          +{enhancedSession.exercises.length - 3} more exercises
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {enhancedSession.notes && (
                    <div className="mb-4 p-3 bg-blue-50 rounded-lg border-l-4 border-blue-200">
                      <div className="text-sm text-gray-700">
                        {enhancedSession.notes}
                      </div>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-between items-center pt-4 border-t border-gray-200">
                    <div className="flex gap-2">
                      <button
                        onClick={() => setSelectedSession(enhancedSession)}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 text-sm"
                      >
                        <Eye className="h-4 w-4" />
                        View Details
                      </button>
                      {!enhancedSession.completed_at && (
                        <button
                          onClick={() =>
                            router.push(
                              `/workouts/sessions/start?id=${enhancedSession.id}`
                            )
                          }
                          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 text-sm"
                        >
                          <Play className="h-4 w-4" />
                          Continue
                        </button>
                      )}
                    </div>
                    <button
                      onClick={() => deleteSession(enhancedSession.id)}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Exercise Summary */}
                <div className="mb-4">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Exercises ({session.exercises.length}):
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                    {session.exercises.slice(0, 6).map((exercise, index) => (
                      <div
                        key={index}
                        className="text-sm text-gray-700 dark:text-gray-300"
                      >
                        • {exercise.name} ({exercise.sets.length} sets)
                      </div>
                    ))}
                    {session.exercises.length > 6 && (
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        +{session.exercises.length - 6} more exercises
                      </div>
                    )}
                  </div>
                </div>

                {/* Notes */}
                {session.notes && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                      Notes:
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300">
                      {session.notes}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex justify-between items-center pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setSelectedSession(session)}
                      className="bg-blue-100 dark:bg-blue-900/20 hover:bg-blue-200 dark:hover:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-3 py-2 rounded-md text-sm flex items-center space-x-1"
                    >
                      <Eye className="h-4 w-4" />
                      <span>View Details</span>
                    </button>
                    {!session.completed_at && (
                      <button
                        onClick={() =>
                          router.push(
                            `/workouts/session-detail?id=${session.id}`
                          )
                        }
                        className="bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 text-green-700 dark:text-green-400 px-3 py-2 rounded-md text-sm"
                      >
                        Resume
                      </button>
                    )}
                  </div>
                  <button
                    onClick={() => deleteSession(session.id)}
                    className="bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-sm"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {history.pagination.total_pages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-gray-600 dark:text-gray-400">
            Page {history.pagination.page} of {history.pagination.total_pages}(
            {history.pagination.total} total sessions)
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() =>
                setCurrentPage(
                  Math.min(history.pagination.total_pages, currentPage + 1)
                )
              }
              disabled={currentPage === history.pagination.total_pages}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 disabled:cursor-not-allowed bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Session Details Modal */}
      {selectedSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                    {selectedSession.name}
                  </h2>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <span>{formatDate(selectedSession.started_at)}</span>
                    <span>{formatTime(selectedSession.started_at)}</span>
                    {selectedSession.duration_minutes && (
                      <span>{selectedSession.duration_minutes} minutes</span>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setSelectedSession(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>

              {/* Exercise Details */}
              <div className="space-y-6">
                {selectedSession.exercises.map((exercise, exerciseIndex) => (
                  <div
                    key={exerciseIndex}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                      {exercise.name}
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {exercise.sets.map((set, setIndex) => (
                        <div
                          key={setIndex}
                          className={`p-3 rounded-lg ${
                            set.completed
                              ? 'bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800'
                              : 'bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-gray-900 dark:text-white">
                              Set {set.set_number}
                            </span>
                            {set.completed && (
                              <CheckCircle className="h-4 w-4 text-green-500" />
                            )}
                          </div>
                          <div className="text-sm space-y-1">
                            {set.reps && (
                              <div className="text-gray-600 dark:text-gray-400">
                                Reps: {set.reps}
                              </div>
                            )}
                            {set.weight && (
                              <div className="text-gray-600 dark:text-gray-400">
                                Weight: {set.weight} lbs
                              </div>
                            )}
                            {set.duration_seconds && (
                              <div className="text-gray-600 dark:text-gray-400">
                                Duration:{' '}
                                {Math.round(set.duration_seconds / 60)}m{' '}
                                {set.duration_seconds % 60}s
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                    {exercise.notes && (
                      <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                        <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">
                          Notes:
                        </div>
                        <div className="text-sm text-gray-700 dark:text-gray-300">
                          {exercise.notes}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Session Notes and Rating */}
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {selectedSession.notes && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Session Notes
                      </h3>
                      <p className="text-gray-700 dark:text-gray-300">
                        {selectedSession.notes}
                      </p>
                    </div>
                  )}
                  {selectedSession.rating && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                        Rating
                      </h3>
                      <div className="flex space-x-1">
                        {renderStars(selectedSession.rating)}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end">
                <button
                  onClick={() => setSelectedSession(null)}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
