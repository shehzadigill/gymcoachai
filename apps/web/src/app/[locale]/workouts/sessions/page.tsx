'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import {
  CheckCircle,
  Clock,
  Dumbbell,
  Plus,
  Search,
  Filter,
  X,
  Calendar,
  MapPin,
  Star,
  Edit,
  Trash2,
  Play,
  Pause,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';

interface Exercise {
  id: string;
  name: string;

  muscle_group: string;
  description?: string;
  equipment?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
}

interface WorkoutSession {
  id: string;
  name: string;
  date?: string;
  workout_plan_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  exercises: Array<{
    exerciseId?: string;
    exercise_id?: string; // For backward compatibility
    name: string;
    sets: Array<{
      set_number?: number;
      reps?: number;
      weight?: number;
      duration_seconds?: number;
      durationSeconds?: number; // For API compatibility
      rest_seconds?: number;
      restSeconds?: number; // For API compatibility
      completed: boolean;
      notes?: string;
    }>;
    notes?: string;
    order?: number;
  }>;
  completed?: boolean; // Computed from completed_at
  notes?: string;
  rating?: number;
  created_at: string;
  updated_at: string;
}

export default function WorkoutSessionsPage() {
  const router = useRouter();
  const t = useTranslations('workout_sessions');
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<
    'all' | 'completed' | 'incomplete'
  >('all');
  const [showSessionForm, setShowSessionForm] = useState(false);
  const [editingSession, setEditingSession] = useState<WorkoutSession | null>(
    null
  );
  const [exercises, setExercises] = useState<any[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [selectedExercises, setSelectedExercises] = useState<any[]>([]);
  const [statsPeriod, setStatsPeriod] = useState<'all' | 'week' | 'month'>(
    'all'
  );

  useEffect(() => {
    fetchSessions();
    fetchExercises();
  }, []);

  // Helper function to determine if session is completed
  const isSessionCompleted = (session: any): boolean => {
    return !!(session.completed_at || session.completed);
  };

  // Helper function to format time duration
  const formatDuration = (totalMinutes: number): string => {
    if (totalMinutes === 0) return '0m';
    if (totalMinutes < 60) return `${totalMinutes}m`;

    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    if (minutes === 0) return `${hours}h`;
    return `${hours}h ${minutes}m`;
  };

  // Helper function to render star rating
  const renderStarRating = (rating: number) => {
    return (
      <div className="flex items-center space-x-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`h-4 w-4 ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
        <span className="ml-1 text-sm text-gray-600 dark:text-gray-400">
          ({rating.toFixed(1)})
        </span>
      </div>
    );
  };

  // Helper function to filter sessions by time period
  const getFilteredSessions = (period: 'all' | 'week' | 'month') => {
    if (period === 'all') return sessions;

    const now = new Date();
    const periodStart = new Date();

    if (period === 'week') {
      periodStart.setDate(now.getDate() - 7);
    } else if (period === 'month') {
      periodStart.setMonth(now.getMonth() - 1);
    }

    return sessions.filter((session) => {
      const sessionDate = new Date(session.date || session.created_at);
      return sessionDate >= periodStart;
    });
  };

  // Calculate stats based on selected period
  const statsFilteredSessions = getFilteredSessions(statsPeriod);
  const totalSessions = statsFilteredSessions.length;
  const completedSessions = statsFilteredSessions.filter(
    (s) => s.completed
  ).length;
  const totalMinutes = statsFilteredSessions.reduce(
    (total, s) => total + (s.duration_minutes || 0),
    0
  );
  const ratedSessions = statsFilteredSessions.filter(
    (s) => s.rating && s.rating > 0
  );
  const avgRating =
    ratedSessions.length > 0
      ? ratedSessions.reduce((sum, s) => sum + (s.rating || 0), 0) /
        ratedSessions.length
      : 0;
  const completionRate =
    totalSessions > 0 ? (completedSessions / totalSessions) * 100 : 0;

  // Get period label for display
  const getPeriodLabel = (period: 'all' | 'week' | 'month') => {
    switch (period) {
      case 'week':
        return t('this_week');
      case 'month':
        return t('this_month');
      default:
        return t('all_time');
        return 'All Time';
    }
  };

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const response = await api.getWorkoutSessions();
      console.log('Sessions response:', response);

      if (response) {
        // Handle different response formats
        let data: any = response;
        if (data && typeof data === 'object' && 'body' in data) {
          data =
            typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        }

        // Transform sessions data and compute completion status
        const sessionsData = Array.isArray(data)
          ? data
          : data?.sessions || data?.Sessions || data?.workoutSessions || [];

        const transformedSessions = (
          Array.isArray(sessionsData) ? sessionsData : []
        ).map((session) => ({
          ...session,
          completed: isSessionCompleted(session),
        }));
        setSessions(transformedSessions);
      }
    } catch (error) {
      console.error('Error fetching sessions:', error);
      setError('Failed to load workout sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchExercises = async () => {
    try {
      setExercisesLoading(true);
      const response = await api.getExercises();
      console.log('Exercises response:', response);

      if (response) {
        let data: any = response;
        if (data && typeof data === 'object' && 'body' in data) {
          data =
            typeof data.body === 'string' ? JSON.parse(data.body) : data.body;
        }

        const exercisesData = Array.isArray(data)
          ? data
          : data?.exercises || data?.Exercises || [];
        setExercises(Array.isArray(exercisesData) ? exercisesData : []);
      }
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setExercisesLoading(false);
    }
  };

  const filteredSessions = sessions.filter((session) => {
    const matchesSearch =
      session.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      session.notes?.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesFilter =
      filterStatus === 'all' ||
      (filterStatus === 'completed' && session.completed) ||
      (filterStatus === 'incomplete' && !session.completed);

    return matchesSearch && matchesFilter;
  });

  const handleNewSession = () => {
    setEditingSession(null);
    setShowSessionForm(true);
  };

  const handleEditSession = (session: WorkoutSession) => {
    setEditingSession(session);
    setShowSessionForm(true);
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!confirm(t('confirm_delete_session'))) return;

    try {
      await api.deleteWorkoutSession(sessionId);
      setSessions(sessions.filter((s) => s.id !== sessionId));
    } catch (error) {
      console.error('Error deleting session:', error);
      alert(t('failed_to_delete'));
    }
  };

  const handleStartSession = (sessionId: string) => {
    router.push(`/workouts/sessions/start?id=${sessionId}`);
  };

  const handleCompleteSession = async (sessionId: string) => {
    if (!confirm(t('confirm_complete_session'))) return;

    try {
      await api.completeWorkoutSession(sessionId);
      // Update the session in local state
      setSessions(
        sessions.map((s) =>
          s.id === sessionId
            ? { ...s, completed_at: new Date().toISOString(), completed: true }
            : s
        )
      );
      alert(t('session_completed'));
    } catch (error) {
      console.error('Error completing session:', error);
      alert(t('failed_to_complete'));

      alert('Failed to complete session. Please try again.');
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/4"></div>
          <div className="space-y-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-24 bg-gray-200 dark:bg-gray-700 rounded"
              ></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <button
          onClick={handleNewSession}
          className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          {t('new_session')}
        </button>
      </div>

      {/* Stats Period Filter */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          {t('stats')} - {getPeriodLabel(statsPeriod)}
        </h2>
        <div className="flex rounded-lg border border-gray-300 dark:border-gray-600 overflow-hidden">
          {(['all', 'month', 'week'] as const).map((period) => (
            <button
              key={period}
              onClick={() => setStatsPeriod(period)}
              className={`px-3 py-1 text-sm font-medium transition-colors ${
                statsPeriod === period
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
            >
              {getPeriodLabel(period)}
            </button>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Dumbbell className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Sessions
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {sessions.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <CheckCircle className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Completed
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {completedSessions}
              </p>
              {totalSessions > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {completionRate.toFixed(0)}% completion rate
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Time
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {formatDuration(totalMinutes)}
              </p>
              {totalMinutes > 0 && (
                <p className="text-xs text-gray-500 dark:text-gray-500">
                  {completedSessions > 0 &&
                    `Avg: ${formatDuration(Math.round(totalMinutes / completedSessions))} per session`}
                </p>
              )}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-yellow-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Avg Rating
              </p>
              {avgRating > 0 ? (
                <div className="mt-1">
                  {renderStarRating(avgRating)}
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {ratedSessions.length} of {totalSessions} sessions rated
                  </p>
                </div>
              ) : (
                <div>
                  <p className="text-2xl font-semibold text-gray-400 dark:text-gray-500">
                    -
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-500">
                    No ratings yet
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="text"
            placeholder="Search sessions..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <select
          value={filterStatus}
          onChange={(e) =>
            setFilterStatus(
              e.target.value as 'all' | 'completed' | 'incomplete'
            )
          }
          className="px-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">All Sessions</option>
          <option value="completed">Completed</option>
          <option value="incomplete">Incomplete</option>
        </select>
      </div>

      {/* Sessions List */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {filteredSessions.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-8 text-center">
          <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            No workout sessions found
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">
            Get started by creating your first workout session.
          </p>
          <button
            onClick={handleNewSession}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Create Session
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {session.name || 'Workout Session'}
                    </h3>
                    {session.completed ? (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-400">
                        <CheckCircle className="w-3 h-3 mr-1" />
                        Completed
                      </span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-400">
                        <Clock className="w-3 h-3 mr-1" />
                        In Progress
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400 mb-3">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-4 h-4" />
                      {session.date
                        ? new Date(session.date).toLocaleDateString()
                        : new Date(session.created_at).toLocaleDateString()}
                    </div>
                    {session.duration_minutes && (
                      <div className="flex items-center gap-1">
                        <Clock className="w-4 h-4" />
                        {session.duration_minutes} min
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Dumbbell className="w-4 h-4" />
                      {session.exercises?.length || 0} exercises
                    </div>
                    {session.rating && (
                      <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 fill-current text-yellow-500" />
                        {session.rating}/5
                      </div>
                    )}
                  </div>

                  {session.notes && (
                    <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                      {session.notes}
                    </p>
                  )}

                  {session.exercises && session.exercises.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {session.exercises.slice(0, 3).map((exercise, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300"
                        >
                          {exercise.name}
                        </span>
                      ))}
                      {session.exercises.length > 3 && (
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          +{session.exercises.length - 3} more
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {!session.completed && (
                    <button
                      onClick={() => handleStartSession(session.id)}
                      className="p-2 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                      title="Start Session"
                    >
                      <Play className="h-4 w-4" />
                    </button>
                  )}
                  {!session.completed && (
                    <button
                      onClick={() => handleCompleteSession(session.id)}
                      className="p-2 text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                      title="Mark as Complete"
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleEditSession(session)}
                    className="p-2 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                    title="Edit Session"
                  >
                    <Edit className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDeleteSession(session.id)}
                    className="p-2 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                    title="Delete Session"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Session Form Modal */}
      {showSessionForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingSession ? 'Edit Session' : 'New Session'}
              </h3>
              <button
                onClick={() => {
                  setShowSessionForm(false);
                  setEditingSession(null);
                }}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <SessionForm
              session={editingSession}
              exercises={exercises}
              onSave={async (sessionData) => {
                try {
                  if (editingSession) {
                    await api.updateWorkoutSession(editingSession.id, {
                      ...sessionData,
                      name: sessionData.name || 'Workout Session',
                    });
                  } else {
                    await api.createWorkoutSession({
                      ...sessionData,
                      name: sessionData.name || 'Workout Session',
                      exercises: sessionData.exercises || [],
                    });
                  }
                  setShowSessionForm(false);
                  setEditingSession(null);
                  fetchSessions();
                } catch (error) {
                  console.error('Error saving session:', error);
                }
              }}
              onCancel={() => {
                setShowSessionForm(false);
                setEditingSession(null);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// Enhanced Session Form Component
function SessionForm({
  session,
  onSave,
  onCancel,
  exercises,
}: {
  session: WorkoutSession | null;
  onSave: (data: any) => void;
  onCancel: () => void;
  exercises: any[];
}) {
  const [name, setName] = useState(session?.name || '');
  const [notes, setNotes] = useState(session?.notes || '');
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >(session?.difficulty || 'beginner');
  const [sessionExercises, setSessionExercises] = useState<any[]>(
    session?.exercises || []
  );
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [showCustomExerciseForm, setShowCustomExerciseForm] = useState(false);

  // Track selected exercise IDs for UI state management
  const selectedExerciseIds = sessionExercises
    .map((ex) => ex.exerciseId || ex.exercise_id)
    .filter(Boolean);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      name,
      notes,
      difficulty,
      date: session?.date || new Date().toISOString(),
      exercises: sessionExercises,
      completed: session?.completed || false,
    });
  };

  const addExerciseFromLibrary = (exercise: any) => {
    const newExercise = {
      exerciseId: exercise.id,
      name: exercise.name,
      sets: [
        {
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
        {
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
        {
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
      ],
      notes: exercise.description || null,
    };
    setSessionExercises([...sessionExercises, newExercise]);
  };

  const addCustomExercise = (customExercise: any) => {
    const customId = `custom_${Date.now()}`;
    const newExercise = {
      exerciseId: customId,
      name: customExercise.name,
      sets: [
        {
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
        {
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
        {
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
      ],
      notes: customExercise.description || null,
    };
    setSessionExercises([...sessionExercises, newExercise]);
    setShowCustomExerciseForm(false);
  };

  const removeExercise = (index: number) => {
    setSessionExercises(sessionExercises.filter((_, i) => i !== index));
  };

  const updateExercise = (index: number, field: string, value: any) => {
    const updated = [...sessionExercises];
    updated[index] = { ...updated[index], [field]: value };
    setSessionExercises(updated);
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Session Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Enter session name"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Difficulty
          </label>
          <select
            value={difficulty}
            onChange={(e) =>
              setDifficulty(
                e.target.value as 'beginner' | 'intermediate' | 'advanced'
              )
            }
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="Add any notes about this session..."
          />
        </div>

        {/* Exercises Section */}
        <div>
          <div className="flex justify-between items-center mb-2">
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
              Exercises ({sessionExercises.length})
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setShowExerciseSelection(true)}
                className="text-sm bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
              >
                Add from Library
              </button>
              <button
                type="button"
                onClick={() => setShowCustomExerciseForm(true)}
                className="text-sm bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded"
              >
                Add Custom
              </button>
            </div>
          </div>

          {sessionExercises.length === 0 ? (
            <div className="text-center py-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg">
              <p className="text-gray-500 dark:text-gray-400">
                No exercises added yet
              </p>
            </div>
          ) : (
            <div className="space-y-2 max-h-40 overflow-y-auto">
              {sessionExercises.map((exercise, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded"
                >
                  <div className="flex-1">
                    <span className="font-medium text-gray-900 dark:text-white">
                      {exercise.name}
                    </span>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {exercise.sets.length} sets
                      {exercise.sets[0]?.reps &&
                        ` × ${exercise.sets[0].reps} reps`}
                      {exercise.sets[0]?.weight &&
                        ` @ ${exercise.sets[0].weight}lbs`}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeExercise(index)}
                    className="text-red-600 hover:text-red-700 p-1"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {session ? 'Update Session' : 'Create Session'}
          </button>
        </div>
      </form>

      {/* Exercise Selection Modal */}
      {showExerciseSelection && (
        <ExerciseSelectionModal
          exercises={exercises}
          selectedExerciseIds={selectedExerciseIds}
          onSelect={addExerciseFromLibrary}
          onClose={() => setShowExerciseSelection(false)}
        />
      )}

      {/* Custom Exercise Form Modal */}
      {showCustomExerciseForm && (
        <CustomExerciseModal
          onSave={addCustomExercise}
          onClose={() => setShowCustomExerciseForm(false)}
        />
      )}
    </div>
  );
}

// Exercise Selection Modal Component
function ExerciseSelectionModal({
  exercises,
  selectedExerciseIds = [],
  onSelect,
  onClose,
}: {
  exercises: Exercise[];
  selectedExerciseIds?: string[];
  onSelect: (exercise: Exercise) => void;
  onClose: () => void;
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredExercises = exercises.filter(
    (exercise) =>
      exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.muscle_group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold">Select Exercise</h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Search exercises..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded mb-4"
        />

        <div className="overflow-y-auto max-h-96">
          {filteredExercises.map((exercise) => {
            const isSelected = selectedExerciseIds.includes(exercise.id);
            return (
              <div
                key={exercise.id}
                className={`p-3 border-b transition-colors ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer'
                }`}
                onClick={() => !isSelected && onSelect(exercise)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div
                      className={`font-medium ${
                        isSelected
                          ? 'text-blue-900 dark:text-blue-200'
                          : 'text-gray-900 dark:text-white'
                      }`}
                    >
                      {exercise.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {exercise.muscle_group}
                    </div>
                    {exercise.description && (
                      <div className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                        {exercise.description}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="text-blue-600 dark:text-blue-400 text-sm font-medium">
                      ✓ Selected
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// Custom Exercise Modal Component - Comprehensive form matching Exercise Library
function CustomExerciseModal({
  onSave,
  onClose,
}: {
  onSave: (exercise: any) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    category: 'strength',
    muscleGroups: [] as string[],
    equipment: [] as string[],
    difficulty: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    instructions: [''] as string[],
    tips: '',
    videoUrl: '',
    imageUrl: '',
  });

  const [newMuscleGroup, setNewMuscleGroup] = useState('');
  const [newEquipment, setNewEquipment] = useState('');

  const muscleGroupOptions = [
    'chest',
    'back',
    'shoulders',
    'arms',
    'legs',
    'glutes',
    'core',
    'cardio',
  ];

  const equipmentOptions = [
    'barbell',
    'dumbbell',
    'kettlebell',
    'resistance band',
    'pull-up bar',
    'bench',
    'cable machine',
    'smith machine',
    'treadmill',
    'bike',
    'none',
  ];

  const addMuscleGroup = () => {
    const group = newMuscleGroup.trim().toLowerCase();
    if (group && !formData.muscleGroups.includes(group)) {
      setFormData((prev) => ({
        ...prev,
        muscleGroups: [...prev.muscleGroups, group],
      }));
      setNewMuscleGroup('');
    }
  };

  const removeMuscleGroup = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      muscleGroups: prev.muscleGroups.filter((_, i) => i !== index),
    }));
  };

  const addEquipment = () => {
    const eq = newEquipment.trim().toLowerCase();
    if (eq && !formData.equipment.includes(eq)) {
      setFormData((prev) => ({
        ...prev,
        equipment: [...prev.equipment, eq],
      }));
      setNewEquipment('');
    }
  };

  const removeEquipment = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      equipment: prev.equipment.filter((_, i) => i !== index),
    }));
  };

  const addInstruction = () => {
    setFormData((prev) => ({
      ...prev,
      instructions: [...prev.instructions, ''],
    }));
  };

  const removeInstruction = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.filter((_, i) => i !== index),
    }));
  };

  const updateInstruction = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      instructions: prev.instructions.map((inst, i) =>
        i === index ? value : inst
      ),
    }));
  };

  const handleSave = () => {
    if (!formData.name.trim()) return;

    const exerciseData = {
      ...formData,
      instructions: formData.instructions.filter(
        (instruction) => instruction.trim() !== ''
      ),
      muscle_group: formData.muscleGroups.join(', ') || 'general', // For backward compatibility
    };

    onSave(exerciseData);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Create Custom Exercise
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-6">
            {/* Basic Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Exercise Name *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, name: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={formData.category}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      category: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="strength">Strength</option>
                  <option value="cardio">Cardio</option>
                  <option value="flexibility">Flexibility</option>
                  <option value="sports">Sports</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Difficulty
              </label>
              <select
                value={formData.difficulty}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    difficulty: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Muscle Groups */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Muscle Groups
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.muscleGroups.map((group, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                  >
                    {group}
                    <button
                      type="button"
                      onClick={() => removeMuscleGroup(index)}
                      className="ml-1 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={newMuscleGroup}
                  onChange={(e) => setNewMuscleGroup(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select muscle group...</option>
                  {muscleGroupOptions
                    .filter((option) => !formData.muscleGroups.includes(option))
                    .map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={addMuscleGroup}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Equipment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Equipment
              </label>
              <div className="flex flex-wrap gap-2 mb-2">
                {formData.equipment.map((eq, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                  >
                    {eq}
                    <button
                      type="button"
                      onClick={() => removeEquipment(index)}
                      className="ml-1 text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-2">
                <select
                  value={newEquipment}
                  onChange={(e) => setNewEquipment(e.target.value)}
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select equipment...</option>
                  {equipmentOptions
                    .filter((option) => !formData.equipment.includes(option))
                    .map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  onClick={addEquipment}
                  className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Instructions */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Instructions
              </label>
              <div className="space-y-2">
                {formData.instructions.map((instruction, index) => (
                  <div key={index} className="flex gap-2">
                    <span className="flex-shrink-0 w-6 h-8 flex items-center justify-center text-sm text-gray-500 dark:text-gray-400">
                      {index + 1}.
                    </span>
                    <input
                      type="text"
                      value={instruction}
                      onChange={(e) => updateInstruction(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Enter instruction step..."
                    />
                    {formData.instructions.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeInstruction(index)}
                        className="flex-shrink-0 p-2 text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-200"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addInstruction}
                className="mt-2 px-3 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Step</span>
              </button>
            </div>

            {/* Tips */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tips (Optional)
              </label>
              <textarea
                value={formData.tips}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, tips: e.target.value }))
                }
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="Any helpful tips for performing this exercise..."
              />
            </div>

            {/* Media URLs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Video URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.videoUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      videoUrl: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Image URL (Optional)
                </label>
                <input
                  type="url"
                  value={formData.imageUrl}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      imageUrl: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="https://example.com/image.jpg"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={!formData.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Create Exercise
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
