'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  Dumbbell,
  TrendingUp,
  Star,
  Play,
  Edit3,
  ArrowLeft,
  CheckCircle,
  Target,
  BarChart3,
  Timer,
} from 'lucide-react';
import { api } from '../../../../lib/api-client';
import { useLocale } from 'next-intl';

interface WorkoutSession {
  id: string;
  name: string;
  date?: string;
  workout_plan_id?: string;
  started_at?: string;
  completed_at?: string;
  duration_minutes?: number;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
  exercises: SessionExercise[];
  completed?: boolean;
  notes?: string;
  rating?: number;
  created_at: string;
  updated_at: string;
}

interface SessionExercise {
  exercise_id: string;
  exercise_name: string;
  sets: ExerciseSet[];
  notes?: string;
  order: number;
  details?: ExerciseDetails;
}

interface ExerciseSet {
  set_number: number;
  reps?: number;
  weight?: number;
  duration_seconds?: number;
  distance_meters?: number;
  completed: boolean;
  rest_duration_seconds?: number;
  notes?: string;
}

interface ExerciseDetails {
  id: string;
  name: string;
  category: string;
  muscle_groups: string[];
  equipment: string[];
  instructions: string[];
  tips?: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
}

export default function SessionDetailPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const sessionId = searchParams.get('id');

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchSessionDetails();
    } else {
      setError('No session ID provided');
      setLoading(false);
    }
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await api.getWorkoutSession(sessionId!);

      if (session) {
        // Fetch exercise details for each exercise
        const sessionWithDetails = { ...session };

        for (let i = 0; i < sessionWithDetails.exercises.length; i++) {
          const exercise = sessionWithDetails.exercises[i];
          try {
            const exerciseDetails = await api.getExercise(exercise.exercise_id);
            sessionWithDetails.exercises[i].details = exerciseDetails;
          } catch (err) {
            console.warn(
              `Failed to fetch details for exercise ${exercise.exercise_id}:`,
              err
            );
          }
        }

        setSession(sessionWithDetails);
      } else {
        setError('Session not found');
      }
    } catch (err) {
      console.error('Error fetching session details:', err);
      setError('Failed to load session details');
    } finally {
      setLoading(false);
    }
  };

  const formatDuration = (minutes: number) => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const calculateSessionStats = () => {
    if (!session) return { totalSets: 0, totalReps: 0, totalWeight: 0 };

    let totalSets = 0;
    let totalReps = 0;
    let totalWeight = 0;

    session.exercises.forEach((exercise) => {
      exercise.sets.forEach((set) => {
        if (set.completed) {
          totalSets++;
          totalReps += set.reps || 0;
          totalWeight += (set.weight || 0) * (set.reps || 0);
        }
      });
    });

    return { totalSets, totalReps, totalWeight };
  };

  const handleResumeSession = () => {
    router.push(`/${locale}/workouts/sessions/start?id=${sessionId}`);
  };

  const handleEditSession = () => {
    router.push(`/${locale}/workouts/edit-workout?id=${sessionId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !session) {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-600 dark:text-red-400">
            {error || 'Session not found'}
          </div>
        </div>
      </div>
    );
  }

  const stats = calculateSessionStats();
  const isCompleted = !!session.completed_at;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {session.name}
            </h1>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-1">
                <Calendar className="h-4 w-4" />
                {session.started_at
                  ? new Date(session.started_at).toLocaleDateString()
                  : 'Not started'}
              </div>
              {session.duration_minutes && (
                <div className="flex items-center gap-1">
                  <Clock className="h-4 w-4" />
                  {formatDuration(session.duration_minutes)}
                </div>
              )}
              {session.difficulty && (
                <div className="flex items-center gap-1">
                  <Target className="h-4 w-4" />
                  <span className="capitalize">{session.difficulty}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCompleted && (
            <button
              onClick={handleResumeSession}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Play className="h-4 w-4" />
              {session.started_at ? 'Resume' : 'Start'}
            </button>
          )}
          <button
            onClick={handleEditSession}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Status Banner */}
      {isCompleted && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-medium">
              Completed on{' '}
              {new Date(session.completed_at!).toLocaleDateString()}
            </span>
          </div>
          {session.rating && (
            <div className="flex items-center gap-1 mt-2">
              {[...Array(5)].map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < session.rating!
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              ))}
              <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                {session.rating}/5
              </span>
            </div>
          )}
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Dumbbell className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Exercises
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {session.exercises.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <BarChart3 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Sets</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats.totalSets}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <TrendingUp className="h-5 w-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Reps</p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats.totalReps}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Timer className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Total Weight
              </p>
              <p className="text-xl font-semibold text-gray-900 dark:text-white">
                {stats.totalWeight.toLocaleString()} kg
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Session Notes */}
      {session.notes && (
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg border border-gray-200 dark:border-gray-700 mb-6">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-3">
            Session Notes
          </h3>
          <p className="text-gray-700 dark:text-gray-300">{session.notes}</p>
        </div>
      )}

      {/* Exercises */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-medium text-gray-900 dark:text-white">
            Exercises
          </h3>
        </div>

        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {session.exercises.map((exercise, exerciseIndex) => (
            <div key={exercise.exercise_id} className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h4 className="text-lg font-medium text-gray-900 dark:text-white">
                    {exercise.exercise_name}
                  </h4>
                  {exercise.details && (
                    <div className="mt-2">
                      <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                        <span className="capitalize">
                          {exercise.details.category}
                        </span>
                        <span className="capitalize">
                          {exercise.details.difficulty}
                        </span>
                        {exercise.details.muscle_groups.length > 0 && (
                          <span>
                            {exercise.details.muscle_groups.join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  {exercise.sets.length} sets
                </span>
              </div>

              {/* Sets */}
              <div className="space-y-2">
                <div className="flex items-center gap-4 text-sm font-medium text-gray-700 dark:text-gray-300 pb-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="w-12">Set</span>
                  <span className="w-16">Reps</span>
                  <span className="w-20">Weight</span>
                  <span className="w-20">Rest</span>
                  <span className="w-16">Status</span>
                  <span className="flex-1">Notes</span>
                </div>

                {exercise.sets.map((set) => (
                  <div
                    key={set.set_number}
                    className="flex items-center gap-4 text-sm"
                  >
                    <span className="w-12 text-gray-600 dark:text-gray-400">
                      {set.set_number}
                    </span>
                    <span className="w-16 text-gray-900 dark:text-white">
                      {set.reps || '-'}
                    </span>
                    <span className="w-20 text-gray-900 dark:text-white">
                      {set.weight ? `${set.weight} kg` : '-'}
                    </span>
                    <span className="w-20 text-gray-900 dark:text-white">
                      {set.rest_duration_seconds
                        ? `${Math.floor(set.rest_duration_seconds / 60)}:${(
                            set.rest_duration_seconds % 60
                          )
                            .toString()
                            .padStart(2, '0')}`
                        : '-'}
                    </span>
                    <span className="w-16">
                      {set.completed ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full border-2 border-gray-300 dark:border-gray-600" />
                      )}
                    </span>
                    <span className="flex-1 text-gray-600 dark:text-gray-400">
                      {set.notes || '-'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Exercise Notes */}
              {exercise.notes && (
                <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    <span className="font-medium">Notes:</span> {exercise.notes}
                  </p>
                </div>
              )}

              {/* Exercise Instructions */}
              {exercise.details?.instructions &&
                exercise.details.instructions.length > 0 && (
                  <div className="mt-4">
                    <h5 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
                      Instructions:
                    </h5>
                    <ol className="list-decimal list-inside space-y-1 text-sm text-gray-700 dark:text-gray-300">
                      {exercise.details.instructions.map((instruction, i) => (
                        <li key={i}>{instruction}</li>
                      ))}
                    </ol>
                  </div>
                )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
