'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Plus,
  Calendar,
  Clock,
  Target,
  Dumbbell,
  Edit,
  Trash2,
  Play,
  Users,
} from 'lucide-react';

interface WorkoutPlan {
  id: string;
  name: string;
  description?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  duration_weeks: number;
  frequency_per_week: number;
  exercises: Exercise[];
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

interface Exercise {
  exercise_id: string;
  name: string;
  sets: number;
  reps?: number;
  duration_seconds?: number;
  weight?: number;
  rest_seconds?: number;
  notes?: string;
  order: number;
}

export default function WorkoutPlansPage() {
  const router = useRouter();
  const user = useCurrentUser();
  const [plans, setPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);

  useEffect(() => {
    fetchWorkoutPlans();
  }, []);

  const fetchWorkoutPlans = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getWorkoutPlans();
      if (response && Array.isArray(response)) {
        setPlans(response);
      } else {
        setError('Failed to fetch workout plans');
        setPlans([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch workout plans:', e);
      setError('Failed to fetch workout plans');
    } finally {
      setLoading(false);
    }
  };

  const deletePlan = async (planId: string) => {
    if (!confirm('Are you sure you want to delete this workout plan?')) return;

    try {
      const response = await api.deleteWorkoutPlan(planId);
      // If no error is thrown, deletion was successful
      setPlans(plans.filter((p) => p.id !== planId));
    } catch (e: any) {
      console.error('Failed to delete workout plan:', e);
      alert('Failed to delete workout plan');
    }
  };

  const startWorkoutFromPlan = async (plan: WorkoutPlan) => {
    try {
      // Create a new workout session from this plan
      const sessionData = {
        name: `${plan.name} - Session`,
        workoutPlanId: plan.id,
        exercises: plan.exercises.map((ex) => ({
          exerciseId: ex.exercise_id,
          name: ex.name,
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: ex.reps,
            weight: ex.weight,
            durationSeconds: ex.duration_seconds,
            restSeconds: ex.rest_seconds,
            completed: false,
          })),
          order: ex.order,
        })),
      };

      const response = await api.createWorkoutSession(sessionData);
      const sessionId = typeof response === 'string' ? JSON.parse(response).id : response.id;
      router.push(`/workouts/session/${sessionId}`);
    } catch (e: any) {
      console.error('Failed to start workout:', e);
      alert('Failed to start workout session');
    }
  };

  const getDifficultyColor = (difficulty: string) => {
    switch (difficulty) {
      case 'beginner':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'intermediate':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      case 'advanced':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
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
            Workout Plans
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Create and manage your workout routines
          </p>
        </div>
        <button
          onClick={() => router.push('/workouts/plans/create')}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>New Plan</span>
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Plans
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {plans.length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Target className="h-8 w-8 text-green-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Active Plans
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {plans.filter((p) => p.is_active).length}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Dumbbell className="h-8 w-8 text-orange-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Exercises
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {plans.reduce((acc, p) => acc + p.exercises.length, 0)}
              </p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Clock className="h-8 w-8 text-purple-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Avg Duration
              </p>
              <p className="text-2xl font-semibold text-gray-900 dark:text-white">
                {plans.length > 0
                  ? Math.round(
                      plans.reduce((acc, p) => acc + p.duration_weeks, 0) /
                        plans.length
                    )
                  : 0}
                w
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Workout Plans Grid */}
      {plans.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
            No workout plans
          </h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating a new workout plan.
          </p>
          <div className="mt-6">
            <button
              onClick={() => router.push('/workouts/plans/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
            >
              <Plus className="h-4 w-4" />
              <span>New Plan</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 hover:shadow-md transition-shadow"
            >
              {/* Plan Header */}
              <div className="flex justify-between items-start mb-4">
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {plan.name}
                  </h3>
                  {plan.description && (
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      {plan.description}
                    </p>
                  )}
                </div>
                <span
                  className={`px-2 py-1 rounded-full text-xs font-medium ${getDifficultyColor(plan.difficulty)}`}
                >
                  {plan.difficulty}
                </span>
              </div>

              {/* Plan Stats */}
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Calendar className="h-4 w-4 mr-1" />
                    Duration
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {plan.duration_weeks} weeks
                  </p>
                </div>
                <div>
                  <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                    <Target className="h-4 w-4 mr-1" />
                    Frequency
                  </div>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {plan.frequency_per_week}x/week
                  </p>
                </div>
              </div>

              {/* Exercises Preview */}
              <div className="mb-4">
                <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                  <Dumbbell className="h-4 w-4 mr-1" />
                  Exercises ({plan.exercises.length})
                </div>
                <div className="space-y-1">
                  {plan.exercises.slice(0, 3).map((exercise, index) => (
                    <div
                      key={index}
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      • {exercise.name} ({exercise.sets} sets)
                    </div>
                  ))}
                  {plan.exercises.length > 3 && (
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      +{plan.exercises.length - 3} more exercises
                    </div>
                  )}
                </div>
              </div>

              {/* Actions */}
              <div className="flex space-x-2">
                <button
                  onClick={() => startWorkoutFromPlan(plan)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-md text-sm flex items-center justify-center space-x-1"
                >
                  <Play className="h-4 w-4" />
                  <span>Start</span>
                </button>
                <button
                  onClick={() => router.push(`/workouts/plans/edit/${plan.id}`)}
                  className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-3 py-2 rounded-md text-sm"
                >
                  <Edit className="h-4 w-4" />
                </button>
                <button
                  onClick={() => deletePlan(plan.id)}
                  className="bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 text-red-700 dark:text-red-400 px-3 py-2 rounded-md text-sm"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
