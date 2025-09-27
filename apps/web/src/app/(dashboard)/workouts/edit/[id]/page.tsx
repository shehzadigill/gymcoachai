'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '../../../../../lib/api-client';
import {
  Dumbbell,
  Clock,
  Target,
  Plus,
  Trash2,
  ArrowLeft,
  Save,
} from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restTime: number; // in seconds
  instructions: string;
}

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

export default function EditWorkoutPage() {
  const router = useRouter();
  const params = useParams();
  const sessionId = params.id as string;

  const [workout, setWorkout] = useState<Workout | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      fetchWorkout();
    }
  }, [sessionId]);

  const fetchWorkout = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getWorkoutSession(sessionId);

      // Transform API response to match our interface
      const workoutData: Workout = {
        id: response.id || response.WorkoutSessionId,
        name: response.name || response.Name || 'Workout Session',
        description:
          response.description || response.Description || response.notes || '',
        duration: response.durationMinutes || response.DurationMinutes || 60,
        difficulty: response.difficulty || response.Difficulty || 'beginner',
        exercises: (response.exercises || response.Exercises || []).map(
          (exercise: any) => ({
            id: exercise.exerciseId || exercise.exercise_id,
            name: exercise.name,
            sets: exercise.sets ? exercise.sets.length : 3, // Count of sets
            reps:
              exercise.sets && exercise.sets[0]
                ? exercise.sets[0].reps || 10
                : 10, // First set's reps
            weight:
              exercise.sets && exercise.sets[0]
                ? exercise.sets[0].weight
                : undefined,
            restTime:
              exercise.sets && exercise.sets[0]
                ? exercise.sets[0].restSeconds ||
                  exercise.sets[0].rest_seconds ||
                  60
                : 60,
            instructions: exercise.notes || '',
          })
        ),
        completed: response.completed || response.Completed || false,
        completedAt: response.completedAt || response.CompletedAt,
      };

      setWorkout(workoutData);
    } catch (e: any) {
      console.error('Failed to fetch workout:', e);
      setError(e.message || 'Failed to fetch workout');
    } finally {
      setLoading(false);
    }
  };

  const updateWorkout = async () => {
    if (!workout) return;

    try {
      setSaving(true);
      setError(null);

      // Transform exercises to match backend expected format
      const transformedExercises = workout.exercises.map((exercise, index) => ({
        exerciseId: exercise.id,
        name: exercise.name,
        notes: exercise.instructions || null,
        order: index,
        sets: Array.from({ length: exercise.sets }, (_, setIndex) => ({
          setNumber: setIndex + 1,
          reps: exercise.reps,
          weight: exercise.weight || null,
          durationSeconds: null,
          restSeconds: exercise.restTime || null,
          completed: false,
          notes: null,
        })),
      }));

      const updateData = {
        name: workout.name,
        description: workout.description,
        durationMinutes: workout.duration,
        difficulty: workout.difficulty,
        exercises: transformedExercises,
        startedAt: workout.completedAt || new Date().toISOString(),
        completedAt: workout.completed
          ? workout.completedAt || new Date().toISOString()
          : null,
        notes: workout.description,
      };

      await api.updateWorkoutSession(sessionId, updateData);
      router.push('/workouts');
    } catch (e: any) {
      console.error('Failed to update workout:', e);
      setError(e.message || 'Failed to update workout');
    } finally {
      setSaving(false);
    }
  };

  const addExercise = () => {
    if (!workout) return;

    const newExercise: Exercise = {
      id: `temp_${Date.now()}`,
      name: '',
      sets: 3,
      reps: 10,
      weight: 0,
      restTime: 60,
      instructions: '',
    };

    setWorkout({
      ...workout,
      exercises: [...workout.exercises, newExercise],
    });
  };

  const removeExercise = (index: number) => {
    if (!workout) return;

    const updatedExercises = workout.exercises.filter((_, i) => i !== index);
    setWorkout({
      ...workout,
      exercises: updatedExercises,
    });
  };

  const updateExercise = (index: number, field: keyof Exercise, value: any) => {
    if (!workout) return;

    const updatedExercises = [...workout.exercises];
    updatedExercises[index] = {
      ...updatedExercises[index],
      [field]: value,
    };

    setWorkout({
      ...workout,
      exercises: updatedExercises,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
            <div className="text-red-600 dark:text-red-400">{error}</div>
          </div>
        </div>
      </div>
    );
  }

  if (!workout) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center py-12">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Workout not found
            </h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => router.push('/workouts')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Edit Workout
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Modify your workout session
              </p>
            </div>
          </div>
          <button
            onClick={updateWorkout}
            disabled={saving}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
          >
            <Save className="h-4 w-4" />
            <span>{saving ? 'Saving...' : 'Save Changes'}</span>
          </button>
        </div>

        {/* Workout Form */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Workout Name
              </label>
              <input
                type="text"
                value={workout.name}
                onChange={(e) =>
                  setWorkout({ ...workout, name: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Enter workout name"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Duration (minutes)
              </label>
              <input
                type="number"
                value={workout.duration}
                onChange={(e) =>
                  setWorkout({
                    ...workout,
                    duration: parseInt(e.target.value) || 0,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="60"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Difficulty
              </label>
              <select
                value={workout.difficulty}
                onChange={(e) =>
                  setWorkout({ ...workout, difficulty: e.target.value as any })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
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
              <input
                type="text"
                value={workout.description}
                onChange={(e) =>
                  setWorkout({ ...workout, description: e.target.value })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                placeholder="Workout description"
              />
            </div>
          </div>

          {/* Exercises Section */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-medium text-gray-900 dark:text-white">
                Exercises
              </h3>
              <button
                onClick={addExercise}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add Exercise</span>
              </button>
            </div>

            <div className="space-y-4">
              {workout.exercises.map((exercise, index) => (
                <div
                  key={index}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700"
                >
                  <div className="flex justify-between items-start mb-4">
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Exercise {index + 1}
                    </h4>
                    <button
                      onClick={() => removeExercise(index)}
                      className="text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Exercise Name
                      </label>
                      <input
                        type="text"
                        value={exercise.name}
                        onChange={(e) =>
                          updateExercise(index, 'name', e.target.value)
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                        placeholder="Exercise name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Sets
                      </label>
                      <input
                        type="number"
                        value={exercise.sets}
                        onChange={(e) =>
                          updateExercise(
                            index,
                            'sets',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Reps
                      </label>
                      <input
                        type="number"
                        value={exercise.reps}
                        onChange={(e) =>
                          updateExercise(
                            index,
                            'reps',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                        min="1"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Weight (lbs)
                      </label>
                      <input
                        type="number"
                        value={exercise.weight || 0}
                        onChange={(e) =>
                          updateExercise(
                            index,
                            'weight',
                            parseInt(e.target.value) || 0
                          )
                        }
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                        min="0"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Instructions
                    </label>
                    <textarea
                      value={exercise.instructions}
                      onChange={(e) =>
                        updateExercise(index, 'instructions', e.target.value)
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-600 dark:text-white text-sm"
                      rows={2}
                      placeholder="Exercise instructions"
                    />
                  </div>
                </div>
              ))}

              {workout.exercises.length === 0 && (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  No exercises added yet. Click "Add Exercise" to get started.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
