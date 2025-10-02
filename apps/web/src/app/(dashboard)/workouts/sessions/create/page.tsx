'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Clock, Dumbbell, Plus, Save } from 'lucide-react';
import { api } from '../../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';

interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  exercises: WorkoutPlanExercise[];
}

interface WorkoutPlanExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps?: number;
  durationSeconds?: number;
  weight?: number;
  restSeconds?: number;
  notes?: string;
  order: number;
}

interface SessionExercise {
  exerciseId?: string;
  name: string;
  sets: Array<{
    reps?: number;
    weight?: number;
    duration_seconds?: number;
    rest_seconds?: number;
    completed: boolean;
    notes?: string;
  }>;
  notes?: string;
  order?: number;
}

interface WorkoutSessionData {
  name: string;
  workout_plan_id?: string;
  exercises: SessionExercise[];
  notes?: string;
}

export default function CreateWorkoutSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();

  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [sessionData, setSessionData] = useState<WorkoutSessionData>({
    name: '',
    exercises: [],
    notes: '',
  });

  const planId = searchParams.get('planId');
  const week = searchParams.get('week');
  const day = searchParams.get('day');

  useEffect(() => {
    // Wait for user authentication to complete
    if (user.isLoading) {
      return;
    }

    if (!user.isAuthenticated || !user.id) {
      setError('User not authenticated');
      setLoading(false);
      return;
    }

    if (!planId) {
      setError('Missing workout plan ID');
      setLoading(false);
      return;
    }

    fetchWorkoutPlan();
  }, [planId, user.isLoading, user.isAuthenticated, user.id]);

  const fetchWorkoutPlan = async () => {
    try {
      setLoading(true);
      console.log('Fetching workout plan:', { userId: user.id, planId });
      const plan = await api.getWorkoutPlan(user.id, planId!);

      if (plan) {
        console.log('Workout plan loaded:', plan);
        setWorkoutPlan(plan);

        // Convert workout plan exercises to session exercises
        console.log('Plan exercises:', plan.exercises);
        const sessionExercises: SessionExercise[] = (plan.exercises || []).map(
          (ex: WorkoutPlanExercise) => ({
            exerciseId: ex.exerciseId,
            name: ex.name,
            sets: Array.from({ length: ex.sets || 3 }, () => ({
              reps: ex.reps,
              weight: ex.weight || 0,
              duration_seconds: ex.durationSeconds,
              rest_seconds: ex.restSeconds,
              completed: false,
              notes: '',
            })),
            notes: ex.notes || '',
            order: ex.order,
          })
        );

        console.log('Session exercises:', sessionExercises);

        // Generate session name
        let sessionName = plan.name;
        if (week && day) {
          sessionName += ` - Week ${week}, Day ${day}`;
        } else {
          sessionName += ` - ${new Date().toLocaleDateString()}`;
        }

        setSessionData({
          name: sessionName,
          workout_plan_id: plan.id,
          exercises: sessionExercises,
          notes: '',
        });
      } else {
        setError('Workout plan not found');
      }
    } catch (error) {
      console.error('Failed to fetch workout plan:', error);
      setError('Failed to load workout plan');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSession = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      if (!sessionData.name.trim()) {
        setError('Session name is required');
        return;
      }

      const response = await api.createWorkoutSession(
        {
          ...sessionData,
          name: sessionData.name.trim(),
        },
        user.id
      );

      if (response) {
        setSuccess('Workout session created successfully!');
        setTimeout(() => {
          router.push('/workouts/sessions');
        }, 1500);
      }
    } catch (error) {
      console.error('Failed to create workout session:', error);
      setError('Failed to create workout session');
    } finally {
      setSaving(false);
    }
  };

  const handleStartSession = async () => {
    try {
      setSaving(true);
      setError(null);

      if (!sessionData.name.trim()) {
        setError('Session name is required');
        return;
      }

      const response = await api.createWorkoutSession(
        {
          ...sessionData,
          name: sessionData.name.trim(),
          started_at: new Date().toISOString(),
        },
        user.id
      );

      if (response) {
        // Redirect to start the session immediately
        router.push(`/workouts/sessions/${response.id}/start`);
      }
    } catch (error) {
      console.error('Failed to create and start workout session:', error);
      setError('Failed to create and start workout session');
    } finally {
      setSaving(false);
    }
  };

  const updateExerciseSet = (
    exerciseIndex: number,
    setIndex: number,
    field: string,
    value: any
  ) => {
    setSessionData((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, exIdx) =>
        exIdx === exerciseIndex
          ? {
              ...ex,
              sets: ex.sets.map((set, setIdx) =>
                setIdx === setIndex ? { ...set, [field]: value } : set
              ),
            }
          : ex
      ),
    }));
  };

  const toggleSetCompleted = (exerciseIndex: number, setIndex: number) => {
    updateExerciseSet(
      exerciseIndex,
      setIndex,
      'completed',
      !sessionData.exercises[exerciseIndex].sets[setIndex].completed
    );
  };

  if (user.isLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-3 text-gray-600 dark:text-gray-400">
          {user.isLoading ? 'Authenticating...' : 'Loading workout plan...'}
        </span>
      </div>
    );
  }

  if (error && !workoutPlan) {
    return (
      <div className="space-y-6">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.back()}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Create Workout Session
          </h1>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      </div>
    );
  }

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
            Create Workout Session
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {workoutPlan
              ? `From: ${workoutPlan.name}`
              : 'Loading workout plan...'}
          </p>
        </div>
      </div>

      {/* Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <p className="text-green-600 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Session Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <div className="space-y-6">
          {/* Session Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Session Name
            </label>
            <input
              type="text"
              value={sessionData.name}
              onChange={(e) =>
                setSessionData((prev) => ({ ...prev, name: e.target.value }))
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Enter session name"
            />
          </div>

          {/* Session Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Session Notes (Optional)
            </label>
            <textarea
              value={sessionData.notes || ''}
              onChange={(e) =>
                setSessionData((prev) => ({ ...prev, notes: e.target.value }))
              }
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
              placeholder="Add any notes for this session..."
            />
          </div>

          {/* Exercises */}
          <div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
              Exercises ({sessionData.exercises.length})
            </h3>
            <div className="space-y-4">
              {sessionData.exercises.map((exercise, exerciseIndex) => (
                <div
                  key={exerciseIndex}
                  className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                >
                  <div className="flex items-center space-x-2 mb-3">
                    <Dumbbell className="h-5 w-5 text-blue-600" />
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      {exercise.name}
                    </h4>
                  </div>

                  {/* Sets */}
                  <div className="space-y-2">
                    <div className="grid grid-cols-12 gap-2 text-xs font-medium text-gray-500 dark:text-gray-400 px-2">
                      <div className="col-span-1">Set</div>
                      <div className="col-span-2">Reps</div>
                      <div className="col-span-2">Weight</div>
                      <div className="col-span-2">Duration</div>
                      <div className="col-span-2">Rest</div>
                      <div className="col-span-2">Status</div>
                      <div className="col-span-1"></div>
                    </div>

                    {exercise.sets.map((set, setIndex) => (
                      <div
                        key={setIndex}
                        className="grid grid-cols-12 gap-2 items-center"
                      >
                        <div className="col-span-1 text-sm text-gray-600 dark:text-gray-400 text-center">
                          {setIndex + 1}
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={set.reps || ''}
                            onChange={(e) =>
                              updateExerciseSet(
                                exerciseIndex,
                                setIndex,
                                'reps',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            min="0"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={set.weight || ''}
                            onChange={(e) =>
                              updateExerciseSet(
                                exerciseIndex,
                                setIndex,
                                'weight',
                                parseFloat(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            step="0.5"
                            min="0"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={set.duration_seconds || ''}
                            onChange={(e) =>
                              updateExerciseSet(
                                exerciseIndex,
                                setIndex,
                                'duration_seconds',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            min="0"
                          />
                        </div>
                        <div className="col-span-2">
                          <input
                            type="number"
                            value={set.rest_seconds || ''}
                            onChange={(e) =>
                              updateExerciseSet(
                                exerciseIndex,
                                setIndex,
                                'rest_seconds',
                                parseInt(e.target.value) || 0
                              )
                            }
                            className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded focus:ring-1 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                            min="0"
                          />
                        </div>
                        <div className="col-span-2">
                          <button
                            onClick={() =>
                              toggleSetCompleted(exerciseIndex, setIndex)
                            }
                            className={`w-full px-2 py-1 rounded text-xs font-medium transition-colors ${
                              set.completed
                                ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                            }`}
                          >
                            {set.completed ? 'Done' : 'Pending'}
                          </button>
                        </div>
                        <div className="col-span-1"></div>
                      </div>
                    ))}
                  </div>

                  {/* Exercise Notes */}
                  {exercise.notes && (
                    <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
                      <strong>Notes:</strong> {exercise.notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex space-x-4 pt-6">
            <button
              onClick={handleSaveSession}
              disabled={saving || !sessionData.name.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <Save className="h-4 w-4" />
              <span>{saving ? 'Saving...' : 'Save Session'}</span>
            </button>

            <button
              onClick={handleStartSession}
              disabled={saving || !sessionData.name.trim()}
              className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg flex items-center justify-center space-x-2 transition-colors"
            >
              <Clock className="h-4 w-4" />
              <span>{saving ? 'Starting...' : 'Save & Start Now'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
