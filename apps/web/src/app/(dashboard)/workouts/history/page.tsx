'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
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
} from 'lucide-react';

interface WorkoutSession {
  id: string;
  name: string;
  started_at: string;
  completed_at?: string;
  duration_minutes?: number;
  exercises: SessionExercise[];
  notes?: string;
  rating?: number;
  workout_plan_id?: string;
}

interface SessionExercise {
  exercise_id: string;
  name: string;
  sets: ExerciseSet[];
  notes?: string;
  order: number;
}

interface ExerciseSet {
  set_number: number;
  reps?: number;
  weight?: number;
  duration_seconds?: number;
  rest_seconds?: number;
  completed: boolean;
  notes?: string;
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

export default function WorkoutHistoryPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [history, setHistory] = useState<WorkoutHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<WorkoutSession | null>(
    null
  );

  // Pagination and filters
  const [currentPage, setCurrentPage] = useState(1);
  const [pageLimit] = useState(10);
  const [filterCompleted, setFilterCompleted] = useState<string>('all'); // 'all', 'completed', 'incomplete'

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
      console.log('Raw history response:', response);

      if (response) {
        // Handle nested response structure
        let data = response;
        if (response.body) {
          data =
            typeof response.body === 'string'
              ? JSON.parse(response.body)
              : response.body;
        }

        console.log('Processed history data:', data);

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

        console.log('Final transformed history:', transformedHistory);
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

  const filteredSessions =
    history?.sessions.filter((session) => {
      if (filterCompleted === 'completed') return !!session.completed_at;
      if (filterCompleted === 'incomplete') return !session.completed_at;
      return true;
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
          {error || 'No history data available'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Workout History
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            View and manage your past workout sessions
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Sessions
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
                Completed
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
                Total Time
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
                Avg Rating
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
            onChange={(e) => setFilterCompleted(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">All Sessions</option>
            <option value="completed">Completed Only</option>
            <option value="incomplete">Incomplete Only</option>
          </select>
        </div>
      </div>

      {/* Workout Sessions List */}
      {filteredSessions.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No workout sessions found
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Start working out to see your history here.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredSessions.map((session) => (
            <div
              key={session.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              {/* Session Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <div className="flex items-center space-x-2">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {session.name}
                    </h3>
                    {session.completed_at ? (
                      <CheckCircle className="h-5 w-5 text-green-500" />
                    ) : (
                      <div className="h-5 w-5 rounded-full bg-yellow-200 dark:bg-yellow-800" />
                    )}
                  </div>
                  <div className="flex items-center space-x-4 mt-2 text-sm text-gray-600 dark:text-gray-400">
                    <div className="flex items-center">
                      <Calendar className="h-4 w-4 mr-1" />
                      {formatDate(session.started_at)}
                    </div>
                    <div className="flex items-center">
                      <Clock className="h-4 w-4 mr-1" />
                      {formatTime(session.started_at)}
                    </div>
                    {session.duration_minutes && (
                      <div className="flex items-center">
                        <span>{session.duration_minutes} min</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Rating */}
                {session.rating && (
                  <div className="flex space-x-1">
                    {renderStars(session.rating)}
                  </div>
                )}
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
                        router.push(`/workouts/session/${session.id}`)
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
          ))}
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
