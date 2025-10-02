'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../../lib/api-client';
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
} from 'lucide-react';

interface EnhancedWorkoutSession {
  id: string;
  name: string;
  workout_plan_id?: string;
  plan_name?: string;
  started_at: string;
  completed_at?: string;
  duration_minutes?: number;
  exercises: SessionExercise[];
  notes?: string;
  rating?: number;
  calories_burned?: number;
  volume_load?: number; // sets × reps × weight
  intensity_score?: number;
  difficulty?: 'easy' | 'moderate' | 'hard' | 'extreme';
  location?: string;
  tags?: string[];
  weather?: string;
  mood_before?: number; // 1-5
  mood_after?: number; // 1-5
  energy_level?: number; // 1-5
  soreness_level?: number; // 1-5
  completed: boolean;
  created_at: string;
  updated_at: string;

  // Calculated fields
  sets_completed?: number;
  total_reps?: number;
  avg_rest_time?: number;
  peak_heart_rate?: number;
  avg_heart_rate?: number;
  personal_records?: PersonalRecord[];
}

interface SessionExercise {
  exercise_id: string;
  exercise_name: string;
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

interface PersonalRecord {
  exercise_name: string;
  record_type: '1RM' | 'Volume' | 'Duration' | 'Reps';
  value: number;
  previous_value?: number;
  improvement_percentage?: number;
  achieved_date: string;
}

interface WorkoutFilters {
  dateRange?: { start: string; end: string };
  completed?: boolean;
  planId?: string;
  exerciseId?: string;
  minDuration?: number;
  maxDuration?: number;
  difficulty?: string[];
  tags?: string[];
  minRating?: number;
  location?: string;
  sortBy?: 'date' | 'duration' | 'volume' | 'intensity' | 'rating';
  sortOrder?: 'asc' | 'desc';
}

interface WorkoutStats {
  total_sessions: number;
  completed_sessions: number;
  total_duration: number;
  avg_duration: number;
  total_volume: number;
  avg_intensity: number;
  completion_rate: number;
  current_streak: number;
  longest_streak: number;
  favorite_exercises: Array<{ name: string; count: number }>;
  workout_frequency: Array<{ day: string; count: number }>;
  monthly_progress: Array<{ month: string; sessions: number; volume: number }>;
}

type ViewMode = 'list' | 'grid' | 'calendar' | 'analytics';
type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all' | 'custom';

export default function EnhancedWorkoutHistoryPage() {
  const router = useRouter();
  const user = useCurrentUser();

  // Core state
  const [sessions, setSessions] = useState<EnhancedWorkoutSession[]>([]);
  const [stats, setStats] = useState<WorkoutStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // UI state
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [selectedSession, setSelectedSession] =
    useState<EnhancedWorkoutSession | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);

  // Filter and pagination state
  const [filters, setFilters] = useState<WorkoutFilters>({
    sortBy: 'date',
    sortOrder: 'desc',
  });
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalSessions, setTotalSessions] = useState(0);

  // Selection state for bulk actions
  const [selectedSessions, setSelectedSessions] = useState<string[]>([]);
  const [showBulkActions, setShowBulkActions] = useState(false);

  useEffect(() => {
    fetchWorkoutHistory();
    fetchWorkoutStats();
  }, [timeRange, filters, currentPage]);

  const fetchWorkoutHistory = async () => {
    try {
      setLoading(true);
      setError(null);

      const dateRange = getDateRangeForTimeRange(timeRange);
      const enhancedFilters = {
        ...filters,
        ...dateRange,
      };

      const response = await api.getWorkoutHistory(
        undefined,
        currentPage,
        pageSize,
        enhancedFilters
      );

      if (response?.sessions) {
        const enhancedSessions = response.sessions.map(enrichSessionData);
        setSessions(enhancedSessions);
        setTotalSessions(response.pagination?.total || enhancedSessions.length);
      }
    } catch (e: any) {
      console.error('Failed to fetch workout history:', e);
      setError(e.message || 'Failed to fetch workout history');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkoutStats = async () => {
    try {
      const insights = await api.getWorkoutInsights(undefined, timeRange);
      if (insights) {
        setStats(processWorkoutStats(insights));
      }
    } catch (e: any) {
      console.error('Failed to fetch workout stats:', e);
    }
  };

  const enrichSessionData = (session: any): EnhancedWorkoutSession => {
    // Calculate derived metrics
    const totalSets =
      session.exercises?.reduce(
        (sum: number, ex: any) => sum + (ex.sets?.length || 0),
        0
      ) || 0;
    const completedSets =
      session.exercises?.reduce(
        (sum: number, ex: any) =>
          sum + (ex.sets?.filter((set: any) => set.completed)?.length || 0),
        0
      ) || 0;
    const totalReps =
      session.exercises?.reduce(
        (sum: number, ex: any) =>
          sum +
          (ex.sets?.reduce(
            (reps: number, set: any) => reps + (set.reps || 0),
            0
          ) || 0),
        0
      ) || 0;
    const volumeLoad =
      session.exercises?.reduce(
        (sum: number, ex: any) =>
          sum +
          (ex.sets?.reduce(
            (vol: number, set: any) =>
              vol + (set.reps || 0) * (set.weight || 0),
            0
          ) || 0),
        0
      ) || 0;

    return {
      ...session,
      sets_completed: completedSets,
      total_reps: totalReps,
      volume_load: volumeLoad,
      intensity_score: calculateIntensityScore(session),
      calories_burned: estimateCaloriesBurned(session),
      completion_rate: totalSets > 0 ? (completedSets / totalSets) * 100 : 0,
    };
  };

  const calculateIntensityScore = (session: any): number => {
    // Simplified intensity calculation based on sets, reps, weight, and RPE
    if (!session.exercises || session.exercises.length === 0) return 0;

    let totalIntensity = 0;
    let totalSets = 0;

    session.exercises.forEach((exercise: any) => {
      exercise.sets?.forEach((set: any) => {
        if (set.completed) {
          const weight = set.weight || 0;
          const reps = set.reps || 0;
          const rpe = set.rpe || 5;

          // Simple intensity formula
          const setIntensity = (weight * reps * rpe) / 100;
          totalIntensity += setIntensity;
          totalSets++;
        }
      });
    });

    return totalSets > 0
      ? Math.min(Math.round((totalIntensity / totalSets) * 10), 100)
      : 0;
  };

  const estimateCaloriesBurned = (session: any): number => {
    // Simple calorie estimation based on duration and intensity
    const duration = session.duration_minutes || 0;
    const baseCaloriesPerMinute = 8; // Average for strength training
    const intensityMultiplier =
      1 + (calculateIntensityScore(session) || 50) / 100;

    return Math.round(duration * baseCaloriesPerMinute * intensityMultiplier);
  };

  const processWorkoutStats = (insights: any): WorkoutStats => {
    return {
      total_sessions: insights.total_sessions || 0,
      completed_sessions: insights.completed_sessions || 0,
      total_duration: insights.total_duration || 0,
      avg_duration: insights.avg_duration || 0,
      total_volume: insights.total_volume || 0,
      avg_intensity: insights.avg_intensity || 0,
      completion_rate: insights.completion_rate || 0,
      current_streak: insights.current_streak || 0,
      longest_streak: insights.longest_streak || 0,
      favorite_exercises: insights.favorite_exercises || [],
      workout_frequency: insights.workout_frequency || [],
      monthly_progress: insights.monthly_progress || [],
    };
  };

  const getDateRangeForTimeRange = (range: TimeRange) => {
    const now = new Date();
    const ranges = {
      '7d': {
        start: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString(),
      },
      '30d': {
        start: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      '90d': {
        start: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000).toISOString(),
      },
      '1y': {
        start: new Date(
          now.getTime() - 365 * 24 * 60 * 60 * 1000
        ).toISOString(),
      },
      all: {},
      custom: filters.dateRange || {},
    };

    return {
      ...ranges[range],
      end: now.toISOString(),
    };
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this workout session?'))
      return;

    try {
      await api.deleteWorkoutSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (e: any) {
      console.error('Failed to delete session:', e);
      alert('Failed to delete workout session');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedSessions.length === 0) return;
    if (!confirm(`Delete ${selectedSessions.length} selected sessions?`))
      return;

    try {
      await Promise.all(
        selectedSessions.map((id) => api.deleteWorkoutSession(id))
      );
      setSessions(sessions.filter((s) => !selectedSessions.includes(s.id)));
      setSelectedSessions([]);
      setShowBulkActions(false);
    } catch (e: any) {
      console.error('Failed to delete sessions:', e);
      alert('Failed to delete selected sessions');
    }
  };

  const exportData = async (format: 'json' | 'csv') => {
    try {
      const selectedIds =
        selectedSessions.length > 0 ? selectedSessions : undefined;
      const exportData = await api.getDetailedWorkoutHistory(
        undefined,
        selectedIds
      );

      const dataStr =
        format === 'json'
          ? JSON.stringify(exportData, null, 2)
          : convertSessionsToCSV(exportData);

      const dataUri = `data:${format === 'json' ? 'application/json' : 'text/csv'};charset=utf-8,${encodeURIComponent(dataStr)}`;
      const fileName = `workout-history-${timeRange}-${new Date().toISOString().split('T')[0]}.${format}`;

      const link = document.createElement('a');
      link.setAttribute('href', dataUri);
      link.setAttribute('download', fileName);
      link.click();
    } catch (error) {
      console.error('Export failed:', error);
    }
  };

  const convertSessionsToCSV = (sessions: any[]): string => {
    const headers = [
      'Date',
      'Name',
      'Duration',
      'Exercises',
      'Sets',
      'Reps',
      'Volume',
      'Intensity',
      'Rating',
    ];
    const rows = sessions.map((session) => [
      new Date(session.started_at).toLocaleDateString(),
      session.name,
      session.duration_minutes || 0,
      session.exercises?.length || 0,
      session.sets_completed || 0,
      session.total_reps || 0,
      session.volume_load || 0,
      session.intensity_score || 0,
      session.rating || 0,
    ]);

    return [headers, ...rows].map((row) => row.join(',')).join('\\n');
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'easy':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'moderate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'hard':
        return 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400';
      case 'extreme':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const renderStatsCards = () => (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center">
          <Dumbbell className="h-8 w-8 text-blue-600 mr-3" />
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.total_sessions || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Sessions
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center">
          <Clock className="h-8 w-8 text-green-600 mr-3" />
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round((stats?.total_duration || 0) / 60)}h
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Total Time
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center">
          <BarChart3 className="h-8 w-8 text-purple-600 mr-3" />
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {((stats?.total_volume || 0) / 1000).toFixed(0)}K
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Volume Load
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center">
          <Activity className="h-8 w-8 text-orange-600 mr-3" />
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {stats?.current_streak || 0}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Current Streak
            </p>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <div className="flex items-center">
          <Target className="h-8 w-8 text-red-600 mr-3" />
          <div>
            <p className="text-2xl font-bold text-gray-900 dark:text-white">
              {Math.round(stats?.completion_rate || 0)}%
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Completion Rate
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-lg">Loading workout history...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Enhanced Header */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between space-y-4 lg:space-y-0">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Enhanced Workout History
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Comprehensive tracking and analysis of your workout sessions
            </p>
          </div>

          <div className="flex flex-wrap items-center space-x-3">
            {/* Time Range Selector */}
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value as TimeRange)}
              className="bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 text-sm"
            >
              <option value="7d">Last 7 Days</option>
              <option value="30d">Last 30 Days</option>
              <option value="90d">Last 90 Days</option>
              <option value="1y">Last Year</option>
              <option value="all">All Time</option>
            </select>

            {/* View Mode Buttons */}
            <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
              {(
                [
                  { mode: 'list', icon: List },
                  { mode: 'grid', icon: Grid },
                  { mode: 'calendar', icon: CalendarIcon },
                  { mode: 'analytics', icon: PieChart },
                ] as const
              ).map(({ mode, icon: Icon }) => (
                <button
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`p-2 ${
                    viewMode === mode
                      ? 'bg-blue-600 text-white'
                      : 'bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600'
                  }`}
                  title={`${mode} view`}
                >
                  <Icon className="h-4 w-4" />
                </button>
              ))}
            </div>

            {/* Action Buttons */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center space-x-2 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter className="h-4 w-4" />
              <span className="text-sm">Filters</span>
            </button>

            <button
              onClick={() => exportData('csv')}
              className="flex items-center space-x-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Download className="h-4 w-4" />
              <span className="text-sm">Export</span>
            </button>
          </div>
        </div>

        {/* Search and Bulk Actions */}
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-3 sm:space-y-0">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search workouts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {selectedSessions.length > 0 && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {selectedSessions.length} selected
              </span>
              <button
                onClick={handleBulkDelete}
                className="px-3 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete Selected
              </button>
              <button
                onClick={() => exportData('csv')}
                className="px-3 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                Export Selected
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      {stats && renderStatsCards()}

      {/* Filters Panel */}
      {showFilters && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Advanced Filters
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {/* Filter controls would go here - this is a comprehensive foundation */}
            <div className="text-gray-500 dark:text-gray-400 text-sm">
              Advanced filtering options coming soon...
            </div>
          </div>
        </div>
      )}

      {/* Sessions List/Grid */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {sessions.length === 0 ? (
          <div className="p-12 text-center">
            <Dumbbell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
              No workout sessions found
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Start your fitness journey by completing your first workout!
            </p>
          </div>
        ) : (
          <div className="p-6">
            <div className="space-y-4">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <input
                        type="checkbox"
                        checked={selectedSessions.includes(session.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedSessions([
                              ...selectedSessions,
                              session.id,
                            ]);
                          } else {
                            setSelectedSessions(
                              selectedSessions.filter((id) => id !== session.id)
                            );
                          }
                        }}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {session.name}
                          </h3>
                          {session.completed && (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          )}
                          {session.difficulty && (
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(session.difficulty)}`}
                            >
                              {session.difficulty}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center">
                            <Calendar className="h-4 w-4 mr-1" />
                            {formatDate(session.started_at)}
                          </div>
                          <div className="flex items-center">
                            <Clock className="h-4 w-4 mr-1" />
                            {session.duration_minutes}m
                          </div>
                          <div className="flex items-center">
                            <Dumbbell className="h-4 w-4 mr-1" />
                            {session.exercises?.length || 0} exercises
                          </div>
                          <div className="flex items-center">
                            <BarChart3 className="h-4 w-4 mr-1" />
                            {session.volume_load?.toLocaleString() || 0}
                          </div>
                          <div className="flex items-center">
                            <Zap className="h-4 w-4 mr-1" />
                            {session.intensity_score || 0}/100
                          </div>
                          <div className="flex items-center">
                            <Activity className="h-4 w-4 mr-1" />
                            {session.calories_burned || 0} cal
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      {session.rating && (
                        <div className="flex items-center">
                          {Array.from({ length: 5 }, (_, i) => (
                            <Star
                              key={i}
                              className={`h-4 w-4 ${
                                i < (session.rating || 0)
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      )}

                      <button
                        onClick={() => {
                          setSelectedSession(session);
                          setShowDetailModal(true);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                        title="View details"
                      >
                        <Eye className="h-4 w-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteSession(session.id)}
                        className="p-1 text-gray-400 hover:text-red-600"
                        title="Delete session"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalSessions > pageSize && (
        <div className="flex items-center justify-between bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 px-6 py-3">
          <div className="text-sm text-gray-700 dark:text-gray-300">
            Showing {(currentPage - 1) * pageSize + 1} to{' '}
            {Math.min(currentPage * pageSize, totalSessions)} of {totalSessions}{' '}
            sessions
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-3 py-1 text-sm">
              Page {currentPage} of {Math.ceil(totalSessions / pageSize)}
            </span>
            <button
              onClick={() =>
                setCurrentPage(
                  Math.min(Math.ceil(totalSessions / pageSize), currentPage + 1)
                )
              }
              disabled={currentPage === Math.ceil(totalSessions / pageSize)}
              className="p-2 border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && selectedSession && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  {selectedSession.name}
                </h2>
                <button
                  onClick={() => setShowDetailModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              {/* Detailed session view would go here */}
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <p>Detailed session view - Full implementation in progress</p>
                <p className="text-sm mt-2">
                  This would show exercise breakdown, set-by-set analysis,
                  <br />
                  performance metrics, notes, and comparison with previous
                  sessions.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
