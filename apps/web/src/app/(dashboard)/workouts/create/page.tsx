'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Plus,
  Trash2,
  Save,
  ArrowLeft,
  Clock,
  Target,
  Dumbbell,
  Play,
  Pause,
  RotateCcw,
} from 'lucide-react';

interface Exercise {
  id: string;
  name: string;
  sets: number;
  reps: number;
  weight?: number;
  restTime: number; // in seconds
  instructions: string;
  completed: boolean;
}

interface WorkoutPlan {
  name: string;
  description: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  frequencyPerWeek: number;
  exercises: Exercise[];
}

export default function CreateWorkoutPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [workout, setWorkout] = useState<WorkoutPlan>({
    name: '',
    description: '',
    difficulty: 'beginner',
    durationWeeks: 4,
    frequencyPerWeek: 3,
    exercises: [],
  });

  const [newExercise, setNewExercise] = useState<
    Omit<Exercise, 'id' | 'completed'>
  >({
    name: '',
    sets: 3,
    reps: 10,
    weight: 0,
    restTime: 60,
    instructions: '',
  });

  const addExercise = () => {
    if (newExercise.name.trim()) {
      const exercise: Exercise = {
        ...newExercise,
        id: Date.now().toString(),
        completed: false,
      };
      setWorkout({
        ...workout,
        exercises: [...workout.exercises, exercise],
      });
      setNewExercise({
        name: '',
        sets: 3,
        reps: 10,
        weight: 0,
        restTime: 60,
        instructions: '',
      });
    }
  };

  const removeExercise = (id: string) => {
    setWorkout({
      ...workout,
      exercises: workout.exercises.filter((ex) => ex.id !== id),
    });
  };

  const updateExercise = (id: string, updates: Partial<Exercise>) => {
    setWorkout({
      ...workout,
      exercises: workout.exercises.map((ex) =>
        ex.id === id ? { ...ex, ...updates } : ex
      ),
    });
  };

  const saveWorkout = async () => {
    if (!workout.name.trim()) {
      setError('Workout name is required');
      return;
    }

    if (workout.exercises.length === 0) {
      setError('At least one exercise is required');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const response = await api.createWorkoutSession({
        name: workout.name,
        description: workout.description,
        difficulty: workout.difficulty,
        durationWeeks: workout.durationWeeks,
        frequencyPerWeek: workout.frequencyPerWeek,
        exercises: workout.exercises.map(({ id, completed, ...ex }) => ex),
      });

      if (response.statusCode === 200 || response.statusCode === 201) {
        setSuccess('Workout created successfully!');
        setTimeout(() => {
          router.push('/workouts');
        }, 1500);
      } else {
        setError('Failed to create workout');
      }
    } catch (e: any) {
      console.error('Failed to create workout:', e);
      setError(e?.message || 'Failed to create workout');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create Workout
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Build your custom workout routine
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-green-600 dark:text-green-400">{success}</div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Workout Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Workout Details
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Workout Name *
                </label>
                <input
                  type="text"
                  value={workout.name}
                  onChange={(e) =>
                    setWorkout({ ...workout, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Upper Body Strength"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={workout.description}
                  onChange={(e) =>
                    setWorkout({ ...workout, description: e.target.value })
                  }
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Describe your workout..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Difficulty
                </label>
                <select
                  value={workout.difficulty}
                  onChange={(e) =>
                    setWorkout({
                      ...workout,
                      difficulty: e.target.value as any,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Duration (weeks)
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="52"
                    value={workout.durationWeeks}
                    onChange={(e) =>
                      setWorkout({
                        ...workout,
                        durationWeeks: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Frequency/week
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={workout.frequencyPerWeek}
                    onChange={(e) =>
                      setWorkout({
                        ...workout,
                        frequencyPerWeek: Number(e.target.value),
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Workout Summary */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Workout Summary
            </h3>
            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Exercises:
                </span>
                <span className="font-medium">{workout.exercises.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Total Sets:
                </span>
                <span className="font-medium">
                  {workout.exercises.reduce((acc, ex) => acc + ex.sets, 0)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600 dark:text-gray-400">
                  Estimated Time:
                </span>
                <span className="font-medium">
                  {Math.round(
                    workout.exercises.reduce(
                      (acc, ex) => acc + ex.sets * ex.restTime,
                      0
                    ) / 60
                  )}{' '}
                  min
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Exercises */}
        <div className="lg:col-span-2 space-y-6">
          {/* Add Exercise Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Add Exercise
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Exercise Name *
                </label>
                <input
                  type="text"
                  value={newExercise.name}
                  onChange={(e) =>
                    setNewExercise({ ...newExercise, name: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="e.g., Bench Press"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weight (lbs)
                </label>
                <input
                  type="number"
                  min="0"
                  step="5"
                  value={newExercise.weight}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      weight: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Sets
                </label>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={newExercise.sets}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      sets: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Reps
                </label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={newExercise.reps}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      reps: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Rest Time (seconds)
                </label>
                <input
                  type="number"
                  min="0"
                  max="300"
                  value={newExercise.restTime}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      restTime: Number(e.target.value),
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Instructions
                </label>
                <textarea
                  value={newExercise.instructions}
                  onChange={(e) =>
                    setNewExercise({
                      ...newExercise,
                      instructions: e.target.value,
                    })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Exercise instructions..."
                />
              </div>
            </div>

            <button
              onClick={addExercise}
              className="mt-4 w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>Add Exercise</span>
            </button>
          </div>

          {/* Exercise List */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Exercises ({workout.exercises.length})
            </h3>

            {workout.exercises.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Dumbbell className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No exercises added yet</p>
                <p className="text-sm">Add your first exercise above</p>
              </div>
            ) : (
              workout.exercises.map((exercise, index) => (
                <ExerciseCard
                  key={exercise.id}
                  exercise={exercise}
                  index={index}
                  onUpdate={(updates) => updateExercise(exercise.id, updates)}
                  onRemove={() => removeExercise(exercise.id)}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={saveWorkout}
          disabled={
            saving || !workout.name.trim() || workout.exercises.length === 0
          }
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save Workout'}</span>
        </button>
      </div>
    </div>
  );
}

function ExerciseCard({
  exercise,
  index,
  onUpdate,
  onRemove,
}: {
  exercise: Exercise;
  index: number;
  onUpdate: (updates: Partial<Exercise>) => void;
  onRemove: () => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(exercise);

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditData(exercise);
    setIsEditing(false);
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2 mb-2">
            <span className="text-sm font-medium text-gray-500 dark:text-gray-400">
              {index + 1}.
            </span>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {exercise.name}
            </h4>
            {exercise.weight && exercise.weight > 0 && (
              <span className="text-sm text-gray-600 dark:text-gray-400">
                ({exercise.weight} lbs)
              </span>
            )}
          </div>

          {isEditing ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-2">
              <input
                type="text"
                value={editData.name}
                onChange={(e) =>
                  setEditData({ ...editData, name: e.target.value })
                }
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Exercise name"
              />
              <input
                type="number"
                value={editData.sets}
                onChange={(e) =>
                  setEditData({ ...editData, sets: Number(e.target.value) })
                }
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Sets"
              />
              <input
                type="number"
                value={editData.reps}
                onChange={(e) =>
                  setEditData({ ...editData, reps: Number(e.target.value) })
                }
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Reps"
              />
              <input
                type="number"
                value={editData.weight}
                onChange={(e) =>
                  setEditData({ ...editData, weight: Number(e.target.value) })
                }
                className="px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="Weight"
              />
            </div>
          ) : (
            <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span className="flex items-center space-x-1">
                <Target className="h-4 w-4" />
                <span>{exercise.sets} sets</span>
              </span>
              <span className="flex items-center space-x-1">
                <RotateCcw className="h-4 w-4" />
                <span>{exercise.reps} reps</span>
              </span>
              <span className="flex items-center space-x-1">
                <Clock className="h-4 w-4" />
                <span>{exercise.restTime}s rest</span>
              </span>
            </div>
          )}

          {exercise.instructions && (
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {exercise.instructions}
            </p>
          )}
        </div>

        <div className="flex items-center space-x-2 ml-4">
          {isEditing ? (
            <>
              <button
                onClick={handleSave}
                className="text-green-600 hover:text-green-700 p-1"
              >
                <Save className="h-4 w-4" />
              </button>
              <button
                onClick={handleCancel}
                className="text-gray-500 hover:text-gray-700 p-1"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => setIsEditing(true)}
                className="text-blue-600 hover:text-blue-700 p-1"
              >
                <Edit className="h-4 w-4" />
              </button>
              <button
                onClick={onRemove}
                className="text-red-600 hover:text-red-700 p-1"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
