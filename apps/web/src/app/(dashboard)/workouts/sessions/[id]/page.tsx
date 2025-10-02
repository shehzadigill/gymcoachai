'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
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
import { api } from '../../../../../lib/api-client';

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
  const params = useParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    fetchSessionDetails();
  }, [sessionId]);

  const fetchSessionDetails = async () => {
    try {
      setLoading(true);
      setError(null);

      const session = await api.getWorkoutSession(sessionId);
      console.log('Session details response:', session);

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
    router.push(`/workouts/sessions/${sessionId}/start`);
  };

  const handleEditSession = () => {
    router.push(`/workouts/edit/${sessionId}`);
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
              <div
                className={`flex items-center gap-1 ${
                  isCompleted ? 'text-green-600' : 'text-yellow-600'
                }`}
              >
                <CheckCircle className="h-4 w-4" />
                {isCompleted ? 'Completed' : 'In Progress'}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!isCompleted && (
            <button
              onClick={handleResumeSession}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              <Play className="h-4 w-4" />
              Resume
            </button>
          )}
          <button
            onClick={handleEditSession}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <Edit3 className="h-4 w-4" />
            Edit
          </button>
        </div>
      </div>

      {/* Session Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg">
              <Target className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {session.exercises.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Exercises
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-lg">
              <BarChart3 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalSets}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Sets
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 rounded-lg">
              <TrendingUp className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.totalReps}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Reps
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400 rounded-lg">
              <Dumbbell className="h-5 w-5" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {(stats.totalWeight / 1000).toFixed(1)}k
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Volume (lbs)
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Session Rating */}
      {session.rating && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            Session Rating
          </h3>
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-5 w-5 ${
                  star <= (session.rating || 0)
                    ? 'text-yellow-400 fill-current'
                    : 'text-gray-300 dark:text-gray-600'
                }`}
              />
            ))}
            <span className="text-sm text-gray-600 dark:text-gray-400 ml-2">
              {session.rating}/5
            </span>
          </div>
        </div>
      )}

      {/* Session Notes */}
      {session.notes && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
          <h3 className="font-medium text-gray-900 dark:text-white mb-2">
            Session Notes
          </h3>
          <p className="text-gray-600 dark:text-gray-400">{session.notes}</p>
        </div>
      )}

      {/* Exercises */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
          Exercises
        </h2>

        {session.exercises.map((exercise, index) => (
          <div
            key={exercise.exercise_id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-start gap-4">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full text-sm font-medium">
                  {index + 1}
                </div>
                <div>
                  <h3 className="font-medium text-gray-900 dark:text-white">
                    {exercise.exercise_name}
                  </h3>
                  {exercise.details && (
                    <div className="mt-1 space-y-1">
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        <span className="font-medium">Category:</span>{' '}
                        {exercise.details.category}
                      </p>
                      {exercise.details.muscle_groups.length > 0 && (
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          <span className="font-medium">Muscles:</span>{' '}
                          {exercise.details.muscle_groups.join(', ')}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Sets */}
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Sets ({exercise.sets.filter((set) => set.completed).length}/
                {exercise.sets.length} completed)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {exercise.sets.map((set, setIndex) => (
                  <div
                    key={setIndex}
                    className={`p-3 rounded-lg border ${
                      set.completed
                        ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                        : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">
                        Set {set.set_number}
                      </span>
                      {set.completed && (
                        <CheckCircle className="h-4 w-4 text-green-600" />
                      )}
                    </div>
                    <div className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                      {set.reps && <span>{set.reps} reps</span>}
                      {set.weight && <span> @ {set.weight} lbs</span>}
                      {set.duration_seconds && (
                        <span>
                          {Math.floor(set.duration_seconds / 60)}:
                          {(set.duration_seconds % 60)
                            .toString()
                            .padStart(2, '0')}
                        </span>
                      )}
                      {set.distance_meters && (
                        <span>{set.distance_meters}m</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Exercise Notes */}
            {exercise.notes && (
              <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <span className="font-medium">Notes:</span> {exercise.notes}
                </p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
