'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Play,
  Clock,
  Target,
  Dumbbell,
  Plus,
  Calendar,
  TrendingUp,
  CheckCircle,
} from 'lucide-react';

interface Workout {
  id: string;
  name: string;
  description: string;
  duration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  exercises: Exercise[];
  completed: boolean;
  completedAt?: string;
}

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restTime: number; // in seconds
  instructions: string;
}

export default function WorkoutsPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    fetchWorkouts();
  }, []);

  const fetchWorkouts = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch workout sessions from API
      const response = await api.getWorkoutSessions();

      if (response && Array.isArray(response)) {
        // Transform API response to frontend format
        const apiWorkouts: Workout[] = response.map((session: any) => ({
          id: session.id || session.WorkoutSessionId,
          name: session.name || session.Name || 'Workout Session',
          description:
            session.description || session.Description || 'No description',
          duration: session.duration_minutes || session.DurationMinutes || 0,
          difficulty: session.difficulty || session.Difficulty || 'beginner',
          completed: session.completed_at || session.CompletedAt ? true : false,
          completedAt: session.completed_at || session.CompletedAt,
          exercises: session.exercises || session.Exercises || [],
        }));
        setWorkouts(apiWorkouts);
      } else {
        setError('No workouts found');
        setWorkouts([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch workouts:', e);
      setError(e.message || 'Failed to fetch workouts');
      setWorkouts([]);
    } finally {
      setLoading(false);
    }
  };

  const startWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
  };

  const completeWorkout = async (workoutId: string) => {
    try {
      // Find the workout to get its name and other details
      const workout = workouts.find((w) => w.id === workoutId);
      if (!workout) {
        throw new Error('Workout not found');
      }

      const now = new Date().toISOString();
      const sessionData = {
        name: workout.name,
        startedAt: now,
        completedAt: now,
        durationMinutes: workout.duration,
        exercises: workout.exercises.map((ex, index) => ({
          exerciseId: ex.id,
          name: ex.name,
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: ex.reps,
            weight: ex.weight,
            completed: true,
          })),
          order: index,
        })),
      };

      // Try to create a new completed workout session
      console.log('Creating completed workout session:', {
        workoutId,
        workout: workout.name,
        userId: user.id,
        sessionData,
      });

      try {
        // First create the session
        const createResponse = await api.createWorkoutSession(sessionData);
        console.log('Session create response:', createResponse);

        // Extract the created session ID from the response
        let createdSessionId = null;
        if (createResponse.statusCode === 201) {
          const responseBody =
            typeof createResponse.body === 'string'
              ? JSON.parse(createResponse.body)
              : createResponse.body;
          createdSessionId = responseBody?.id;
        }

        // If we got a session ID, update it to mark as completed
        if (createdSessionId) {
          console.log('Updating session to completed:', createdSessionId);
          const updateResponse = await api.updateWorkoutSession(
            createdSessionId,
            {
              ...sessionData,
              completedAt: now,
            }
          );
          console.log('Session update response:', updateResponse);
        }
      } catch (sessionError: any) {
        console.error('Failed to create/update session:', sessionError.message);
        // Continue anyway - we'll still update the UI
      }

      setWorkouts(
        workouts.map((w) =>
          w.id === workoutId ? { ...w, completed: true, completedAt: now } : w
        )
      );
      setSelectedWorkout(null);
    } catch (e: any) {
      console.error('Failed to complete workout:', e);
      // Still update UI even if API call fails
      setWorkouts(
        workouts.map((w) =>
          w.id === workoutId
            ? { ...w, completed: true, completedAt: new Date().toISOString() }
            : w
        )
      );
      setSelectedWorkout(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Workouts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your workout routines and track your progress
          </p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => router.push('/workouts/create')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>New Workout</span>
          </button>
        </div>
      </div>

      {/* Quick Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Workout Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            onClick={() => router.push('/workouts/plans')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <Calendar className="h-8 w-8 text-blue-600 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              Workout Plans
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Create and manage structured workout routines
            </p>
          </button>

          <button
            onClick={() => router.push('/workouts/exercises')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <Dumbbell className="h-8 w-8 text-green-600 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              Exercise Library
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Browse and manage your exercise database
            </p>
          </button>

          <button
            onClick={() => router.push('/workouts/analytics')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <TrendingUp className="h-8 w-8 text-purple-600 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              Analytics
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Track your fitness progress and achievements
            </p>
          </button>

          <button
            onClick={() => router.push('/workouts/history')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <Clock className="h-8 w-8 text-orange-600 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              Workout History
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              View and manage your past workout sessions
            </p>
          </button>

          <button
            onClick={() => router.push('/workouts/progress-photos')}
            className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
          >
            <Target className="h-8 w-8 text-pink-600 mb-2" />
            <h3 className="font-medium text-gray-900 dark:text-white">
              Progress Photos
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Document your fitness transformation journey
            </p>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Dumbbell className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Workouts
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {workouts.length}
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
                {workouts.filter((w) => w.completed).length}
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
                {workouts.reduce((acc, w) => acc + w.duration, 0)}m
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <TrendingUp className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                This Week
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {
                  workouts.filter(
                    (w) =>
                      w.completed &&
                      w.completedAt &&
                      new Date(w.completedAt) >
                        new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
                  ).length
                }
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workouts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {workouts.map((workout) => (
          <div
            key={workout.id}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {workout.name}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {workout.description}
                  </p>
                </div>
                {workout.completed && (
                  <CheckCircle className="h-6 w-6 text-green-500" />
                )}
              </div>

              <div className="flex items-center space-x-4 mb-4">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Clock className="h-4 w-4 mr-1" />
                  {workout.duration}m
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Target className="h-4 w-4 mr-1" />
                  {workout.difficulty}
                </div>
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                  <Dumbbell className="h-4 w-4 mr-1" />
                  {workout.exercises.length} exercises
                </div>
              </div>

              <div className="flex space-x-2">
                <button
                  onClick={() => startWorkout(workout)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <Play className="h-4 w-4" />
                  <span>{workout.completed ? 'Repeat' : 'Start'}</span>
                </button>
                {!workout.completed && (
                  <button
                    onClick={() => completeWorkout(workout.id)}
                    className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                  >
                    Complete
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Workout Detail Modal */}
      {selectedWorkout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  {selectedWorkout.name}
                </h2>
                <button
                  onClick={() => setSelectedWorkout(null)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  ✕
                </button>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                {selectedWorkout.description}
              </p>

              <div className="space-y-4">
                <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                  Exercises
                </h3>
                {selectedWorkout.exercises.map((exercise, index) => (
                  <div
                    key={exercise.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {index + 1}. {exercise.name}
                      </h4>
                      {exercise.weight && (
                        <span className="text-sm text-gray-600 dark:text-gray-400">
                          {exercise.weight} lbs
                        </span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {exercise.sets} sets × {exercise.reps} reps
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500">
                      {exercise.instructions}
                    </p>
                  </div>
                ))}
              </div>

              <div className="flex space-x-3 mt-6">
                <button
                  onClick={() => completeWorkout(selectedWorkout.id)}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                >
                  Mark as Complete
                </button>
                <button
                  onClick={() => setSelectedWorkout(null)}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
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
