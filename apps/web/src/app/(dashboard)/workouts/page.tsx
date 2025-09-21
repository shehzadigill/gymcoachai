'use client';

import { useEffect, useState } from 'react';
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
  const { user } = useCurrentUser();
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

      if (response.statusCode === 200) {
        // Transform API response to frontend format
        const apiWorkouts: Workout[] = response.body.map((session: any) => ({
          id: session.id,
          name: session.workout_plan?.name || 'Workout Session',
          description: session.workout_plan?.description || 'No description',
          duration: session.duration_minutes || 0,
          difficulty: session.workout_plan?.difficulty || 'beginner',
          completed: session.status === 'completed',
          completedAt: session.completed_at,
          exercises: session.exercises || [],
        }));
        setWorkouts(apiWorkouts);
      } else {
        // Fallback to mock data if API fails
        const mockWorkouts: Workout[] = [
          {
            id: '1',
            name: 'Upper Body Strength',
            description: 'Focus on chest, shoulders, and arms',
            duration: 45,
            difficulty: 'intermediate',
            completed: false,
            exercises: [
              {
                id: '1',
                name: 'Bench Press',
                sets: 3,
                reps: 10,
                weight: 135,
                restTime: 90,
                instructions: 'Lie flat on bench, lower bar to chest, press up',
              },
              {
                id: '2',
                name: 'Shoulder Press',
                sets: 3,
                reps: 12,
                weight: 50,
                restTime: 60,
                instructions: 'Press dumbbells overhead from shoulder height',
              },
            ],
          },
          {
            id: '2',
            name: 'Lower Body Power',
            description: 'Squats, deadlifts, and leg exercises',
            duration: 60,
            difficulty: 'advanced',
            completed: true,
            completedAt: '2024-01-15T10:30:00Z',
            exercises: [
              {
                id: '3',
                name: 'Back Squat',
                sets: 4,
                reps: 8,
                weight: 185,
                restTime: 120,
                instructions: 'Squat down until thighs parallel to floor',
              },
            ],
          },
        ];

        setWorkouts(mockWorkouts);
      }
    } catch (e: any) {
      console.error('Failed to fetch workouts:', e);
      // Use mock data as fallback
      const mockWorkouts: Workout[] = [
        {
          id: '1',
          name: 'Upper Body Strength',
          description: 'Focus on chest, shoulders, and arms',
          duration: 45,
          difficulty: 'intermediate',
          completed: false,
          exercises: [
            {
              id: '1',
              name: 'Bench Press',
              sets: 3,
              reps: 10,
              weight: 135,
              restTime: 90,
              instructions: 'Lie flat on bench, lower bar to chest, press up',
            },
            {
              id: '2',
              name: 'Shoulder Press',
              sets: 3,
              reps: 12,
              weight: 50,
              restTime: 60,
              instructions: 'Press dumbbells overhead from shoulder height',
            },
          ],
        },
        {
          id: '2',
          name: 'Lower Body Power',
          description: 'Squats, deadlifts, and leg exercises',
          duration: 60,
          difficulty: 'advanced',
          completed: true,
          completedAt: '2024-01-15T10:30:00Z',
          exercises: [
            {
              id: '3',
              name: 'Back Squat',
              sets: 4,
              reps: 8,
              weight: 185,
              restTime: 120,
              instructions: 'Squat down until thighs parallel to floor',
            },
          ],
        },
      ];
      setWorkouts(mockWorkouts);
    } finally {
      setLoading(false);
    }
  };

  const startWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
  };

  const completeWorkout = async (workoutId: string) => {
    try {
      // API call to update workout session status
      await api.updateWorkoutSession(workoutId, {
        status: 'completed',
        completed_at: new Date().toISOString(),
      });

      setWorkouts(
        workouts.map((w) =>
          w.id === workoutId
            ? { ...w, completed: true, completedAt: new Date().toISOString() }
            : w
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
            Manage your workout routines
          </p>
        </div>
        <button
          onClick={() => (window.location.href = '/workouts/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Workout</span>
        </button>
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
