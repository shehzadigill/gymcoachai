'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
  Edit,
  Trash2,
  MoreVertical,
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

interface ExerciseLibraryItem {
  id: string;
  name: string;
  description?: string;
  category: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  tips?: string;
  videoUrl?: string;
  imageUrl?: string;
}

interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  frequencyPerWeek: number;
  exercises: WorkoutPlanExercise[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
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

export default function WorkoutsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [showPlanForm, setShowPlanForm] = useState(false);
  const [editingPlan, setEditingPlan] = useState<WorkoutPlan | null>(null);
  const [activeView, setActiveView] = useState<
    'sessions' | 'plans' | 'exercises'
  >(
    (searchParams.get('view') as 'sessions' | 'plans' | 'exercises') ||
      'sessions'
  );

  // Exercises state
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [exercisesError, setExercisesError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all');
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState<string>('');

  useEffect(() => {
    fetchWorkouts();
    fetchWorkoutPlans();
    if (activeView === 'exercises') {
      fetchExercises();
    }
  }, [activeView]);

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

  const fetchWorkoutPlans = async () => {
    try {
      setPlansLoading(true);
      setPlansError(null);

      const response = await api.getWorkoutPlans();

      if (response && Array.isArray(response)) {
        const plans: WorkoutPlan[] = response.map((plan: any) => ({
          id: plan.id,
          userId: plan.user_id || plan.userId,
          name: plan.name,
          description: plan.description,
          difficulty: plan.difficulty,
          durationWeeks: plan.duration_weeks || plan.durationWeeks,
          frequencyPerWeek: plan.frequency_per_week || plan.frequencyPerWeek,
          exercises: plan.exercises || [],
          createdAt: plan.created_at || plan.createdAt,
          updatedAt: plan.updated_at || plan.updatedAt,
          isActive:
            plan.is_active !== undefined
              ? plan.is_active
              : plan.isActive !== undefined
                ? plan.isActive
                : true,
        }));
        setWorkoutPlans(plans);
      } else {
        setWorkoutPlans([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch workout plans:', e);
      setPlansError(e.message || 'Failed to fetch workout plans');
      setWorkoutPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchExercises = async () => {
    try {
      setExercisesLoading(true);
      setExercisesError(null);

      const response = await api.getExercises();

      if (response && Array.isArray(response)) {
        const exerciseItems: ExerciseLibraryItem[] = response.map(
          (exercise: any) => ({
            id: exercise.id,
            name: exercise.name,
            description: exercise.description,
            category: exercise.category,
            muscleGroups: exercise.muscle_groups || exercise.muscleGroups || [],
            equipment: exercise.equipment || [],
            difficulty: exercise.difficulty || 'beginner',
            instructions: exercise.instructions || [],
            tips: exercise.tips,
            videoUrl: exercise.video_url || exercise.videoUrl,
            imageUrl: exercise.image_url || exercise.imageUrl,
          })
        );
        setExercises(exerciseItems);
      } else {
        setExercises([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch exercises:', e);
      setExercisesError(e.message || 'Failed to fetch exercises');
      setExercises([]);
    } finally {
      setExercisesLoading(false);
    }
  };

  const createExercise = async (exerciseData: Partial<ExerciseLibraryItem>) => {
    try {
      await api.createExercise({
        name: exerciseData.name,
        description: exerciseData.description,
        category: exerciseData.category,
        muscleGroups: exerciseData.muscleGroups,
        equipment: exerciseData.equipment,
        difficulty: exerciseData.difficulty,
        instructions: exerciseData.instructions,
        tips: exerciseData.tips,
        videoUrl: exerciseData.videoUrl,
        imageUrl: exerciseData.imageUrl,
      });
      await fetchExercises(); // Refresh the list
    } catch (e: any) {
      console.error('Failed to create exercise:', e);
      setExercisesError(e.message || 'Failed to create exercise');
    }
  };

  const deleteExercise = async (exerciseId: string) => {
    if (!confirm('Are you sure you want to delete this exercise?')) {
      return;
    }

    try {
      await api.deleteExercise(exerciseId);
      await fetchExercises(); // Refresh the list
    } catch (e: any) {
      console.error('Failed to delete exercise:', e);
      setExercisesError(e.message || 'Failed to delete exercise');
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

  const createWorkoutPlan = async (planData: Partial<WorkoutPlan>) => {
    try {
      const response = await api.createWorkoutPlan({
        name: planData.name,
        description: planData.description,
        difficulty: planData.difficulty || 'beginner',
        durationWeeks: planData.durationWeeks || 4,
        frequencyPerWeek: planData.frequencyPerWeek || 3,
        exercises: planData.exercises || [],
      });

      console.log('Created workout plan:', response);
      await fetchWorkoutPlans(); // Refresh the list
      setShowPlanForm(false);
      setEditingPlan(null);
    } catch (e: any) {
      console.error('Failed to create workout plan:', e);
      setPlansError(e.message || 'Failed to create workout plan');
    }
  };

  const updateWorkoutPlan = async (planData: Partial<WorkoutPlan>) => {
    try {
      if (!planData.id || !planData.name) {
        throw new Error('Plan ID and name are required for update');
      }

      const response = await api.updateWorkoutPlan({
        id: planData.id,
        name: planData.name,
        description: planData.description,
        difficulty: planData.difficulty || 'beginner',
        durationWeeks: planData.durationWeeks || 4,
        frequencyPerWeek: planData.frequencyPerWeek || 3,
        exercises: planData.exercises || [],
        createdAt: planData.createdAt || new Date().toISOString(),
        isActive: planData.isActive !== undefined ? planData.isActive : true,
      });

      console.log('Updated workout plan:', response);
      await fetchWorkoutPlans(); // Refresh the list
      setShowPlanForm(false);
      setEditingPlan(null);
    } catch (e: any) {
      console.error('Failed to update workout plan:', e);
      setPlansError(e.message || 'Failed to update workout plan');
    }
  };

  const deleteWorkoutPlan = async (userId: string, planId: string) => {
    if (!confirm('Are you sure you want to delete this workout plan?')) {
      return;
    }

    try {
      await api.deleteWorkoutPlan(userId, planId);
      console.log('Deleted workout plan:', planId);
      await fetchWorkoutPlans(); // Refresh the list
    } catch (e: any) {
      console.error('Failed to delete workout plan:', e);
      setPlansError(e.message || 'Failed to delete workout plan');
    }
  };

  const deleteWorkoutSession = async (sessionId: string) => {
    if (!confirm('Are you sure you want to delete this workout session?')) {
      return;
    }

    try {
      await api.deleteWorkoutSession(sessionId);
      console.log('Deleted workout session:', sessionId);
      await fetchWorkouts(); // Refresh the list
    } catch (e: any) {
      console.error('Failed to delete workout session:', e);
      setError(e.message || 'Failed to delete workout session');
    }
  };

  const editWorkoutSession = (workout: Workout) => {
    // Navigate to edit page or set up edit modal
    router.push(`/workouts/edit/${workout.id}`);
  };

  const startPlanWorkout = async (plan: WorkoutPlan) => {
    try {
      // Convert workout plan to a workout session
      const sessionData = {
        name: `${plan.name} - Session`,
        workoutPlanId: plan.id,
        exercises: plan.exercises.map((ex, index) => ({
          exerciseId: ex.exerciseId,
          name: ex.name,
          sets: Array.from({ length: ex.sets }, (_, i) => ({
            setNumber: i + 1,
            reps: ex.reps,
            weight: ex.weight,
            durationSeconds: ex.durationSeconds,
            restSeconds: ex.restSeconds,
            completed: false,
          })),
          order: index,
          notes: ex.notes,
        })),
      };

      const response = await api.createWorkoutSession(sessionData);
      console.log('Started workout session from plan:', response);

      // Refresh workouts to show the new session
      await fetchWorkouts();

      // Switch to sessions view
      setActiveView('sessions');
    } catch (e: any) {
      console.error('Failed to start workout from plan:', e);
      setError(e.message || 'Failed to start workout from plan');
    }
  };

  if (loading && plansLoading && plansLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && plansError) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">
          Workouts: {error}
          <br />
          Plans: {plansError}
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
            Workouts
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your workout routines and track your progress
          </p>
        </div>
        <div className="flex space-x-3">
          {activeView === 'sessions' ? (
            <button
              onClick={() => router.push('/workouts/create')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Workout</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPlanForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Plan</span>
            </button>
          )}
        </div>
      </div>

      {/* View Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 inline-flex">
        <button
          onClick={() => setActiveView('sessions')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'sessions'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Workout Sessions
        </button>
        <button
          onClick={() => setActiveView('plans')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'plans'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Workout Plans
        </button>
        <button
          onClick={() => setActiveView('exercises')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            activeView === 'exercises'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          Exercise Library
        </button>
      </div>

      {/* Quick Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Workout Tools
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <button
            onClick={() => setActiveView('plans')}
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
            onClick={() => setActiveView('exercises')}
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

      {/* Content based on active view */}
      {activeView === 'sessions' && (
        <>
          {/* Workouts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workouts.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No workout sessions yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Start by creating a new workout or using a workout plan.
                </p>
                <button
                  onClick={() => setActiveView('plans')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  View Workout Plans
                </button>
              </div>
            ) : (
              workouts.map((workout: Workout) => (
                <div
                  key={workout.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {workout.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {workout.description}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        {workout.completed && (
                          <CheckCircle className="h-6 w-6 text-green-500" />
                        )}
                        <div className="flex space-x-1">
                          <button
                            onClick={() => editWorkoutSession(workout)}
                            className="text-gray-400 hover:text-blue-600 p-1"
                            title="Edit workout"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteWorkoutSession(workout.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title="Delete workout"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
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
              ))
            )}
          </div>
        </>
      )}

      {activeView === 'plans' && (
        /* Workout Plans View */
        <>
          {/* Plans Error Display */}
          {plansError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <div className="text-red-600 dark:text-red-400">{plansError}</div>
            </div>
          )}

          {/* Workout Plans Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {plansLoading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : workoutPlans.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No workout plans yet
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Create your first workout plan to get started with structured
                  training.
                </p>
                <button
                  onClick={() => setShowPlanForm(true)}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Plan</span>
                </button>
              </div>
            ) : (
              workoutPlans.map((plan: WorkoutPlan) => (
                <div
                  key={plan.id}
                  className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                          {plan.name}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {plan.description || 'No description provided'}
                        </p>
                      </div>
                      <div className="flex space-x-1">
                        <button
                          onClick={() => {
                            setEditingPlan(plan);
                            setShowPlanForm(true);
                          }}
                          className="text-gray-400 hover:text-blue-600 p-1"
                          title="Edit plan"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={() => deleteWorkoutPlan(user.id, plan.id)}
                          className="text-gray-400 hover:text-red-600 p-1"
                          title="Delete plan"
                        >
                          <svg
                            className="h-4 w-4"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4 mb-4">
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Calendar className="h-4 w-4 mr-1" />
                        {plan.durationWeeks}w
                      </div>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Target className="h-4 w-4 mr-1" />
                        {plan.difficulty}
                      </div>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Dumbbell className="h-4 w-4 mr-1" />
                        {plan.exercises.length} exercises
                      </div>
                      <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Clock className="h-4 w-4 mr-1" />
                        {plan.frequencyPerWeek}x/week
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => startPlanWorkout(plan)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                      >
                        <Play className="h-4 w-4" />
                        <span>Start Workout</span>
                      </button>
                      <button
                        onClick={() => setSelectedPlan(plan)}
                        className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg"
                      >
                        View
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </>
      )}

      {activeView === 'exercises' && (
        /* Exercise Library View */
        <>
          {/* Exercises Error Display */}
          {exercisesError && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
              <div className="text-red-600 dark:text-red-400">
                {exercisesError}
              </div>
            </div>
          )}

          {/* Exercise Filters */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Search */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Search Exercises
                </label>
                <input
                  type="text"
                  placeholder="Search by name..."
                  value={exerciseSearchTerm}
                  onChange={(e) => setExerciseSearchTerm(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              {/* Category Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Category
                </label>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Categories</option>
                  <option value="strength">Strength</option>
                  <option value="cardio">Cardio</option>
                  <option value="flexibility">Flexibility</option>
                  <option value="sports">Sports</option>
                </select>
              </div>

              {/* Muscle Group Filter */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Muscle Group
                </label>
                <select
                  value={selectedMuscleGroup}
                  onChange={(e) => setSelectedMuscleGroup(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="all">All Muscle Groups</option>
                  <option value="chest">Chest</option>
                  <option value="back">Back</option>
                  <option value="shoulders">Shoulders</option>
                  <option value="arms">Arms</option>
                  <option value="legs">Legs</option>
                  <option value="core">Core</option>
                </select>
              </div>
            </div>
          </div>

          {/* Exercises Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {exercisesLoading ? (
              <div className="col-span-full flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              </div>
            ) : exercises.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  No exercises found
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  Try adjusting your filters or create a new exercise.
                </p>
                <button
                  onClick={() => {
                    /* TODO: Add create exercise modal */
                  }}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
                >
                  <Plus className="h-4 w-4" />
                  <span>Create Exercise</span>
                </button>
              </div>
            ) : (
              exercises
                .filter((exercise) => {
                  const matchesSearch =
                    exerciseSearchTerm === '' ||
                    exercise.name
                      .toLowerCase()
                      .includes(exerciseSearchTerm.toLowerCase());
                  const matchesCategory =
                    selectedCategory === 'all' ||
                    exercise.category === selectedCategory;
                  const matchesMuscleGroup =
                    selectedMuscleGroup === 'all' ||
                    exercise.muscleGroups.includes(selectedMuscleGroup);
                  return matchesSearch && matchesCategory && matchesMuscleGroup;
                })
                .map((exercise: ExerciseLibraryItem) => (
                  <div
                    key={exercise.id}
                    className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow"
                  >
                    {exercise.imageUrl && (
                      <div className="h-48 bg-gray-100 dark:bg-gray-700">
                        <img
                          src={exercise.imageUrl}
                          alt={exercise.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    )}
                    <div className="p-6">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                            {exercise.name}
                          </h3>
                          <div className="flex items-center space-x-2 mt-1">
                            <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full">
                              {exercise.category}
                            </span>
                            <span
                              className={`text-xs px-2 py-1 rounded-full ${
                                exercise.difficulty === 'beginner'
                                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                                  : exercise.difficulty === 'intermediate'
                                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
                              }`}
                            >
                              {exercise.difficulty}
                            </span>
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => {
                              /* TODO: Add edit exercise modal */
                            }}
                            className="text-gray-400 hover:text-blue-600 p-2"
                            title="Edit Exercise"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteExercise(exercise.id)}
                            className="text-gray-400 hover:text-red-600 p-2"
                            title="Delete Exercise"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>

                      {exercise.description && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                          {exercise.description}
                        </p>
                      )}

                      {/* Muscle Groups */}
                      {exercise.muscleGroups.length > 0 && (
                        <div className="mb-3">
                          <div className="flex flex-wrap gap-1">
                            {exercise.muscleGroups.map((muscle, index) => (
                              <span
                                key={index}
                                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                              >
                                {muscle}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Equipment */}
                      {exercise.equipment.length > 0 && (
                        <div className="mb-4">
                          <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                            Equipment:
                          </p>
                          <div className="flex flex-wrap gap-1">
                            {exercise.equipment.map((item, index) => (
                              <span
                                key={index}
                                className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      <div className="flex space-x-2">
                        <button
                          onClick={() => {
                            /* TODO: Add exercise to workout */
                          }}
                          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded-lg text-sm font-medium"
                        >
                          Add to Workout
                        </button>
                        {exercise.videoUrl && (
                          <button
                            onClick={() =>
                              window.open(exercise.videoUrl, '_blank')
                            }
                            className="px-3 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 text-sm"
                          >
                            Watch
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))
            )}
          </div>
        </>
      )}

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

      {/* Workout Plan Form Modal */}
      {showPlanForm && (
        <WorkoutPlanFormModal
          plan={editingPlan}
          onSave={editingPlan ? updateWorkoutPlan : createWorkoutPlan}
          onClose={() => {
            setShowPlanForm(false);
            setEditingPlan(null);
          }}
        />
      )}

      {/* Workout Plan Detail Modal */}
      {selectedPlan && (
        <WorkoutPlanDetailModal
          plan={selectedPlan}
          onClose={() => setSelectedPlan(null)}
          onStart={() => startPlanWorkout(selectedPlan)}
          onEdit={() => {
            setEditingPlan(selectedPlan);
            setShowPlanForm(true);
            setSelectedPlan(null);
          }}
        />
      )}
    </div>
  );
}

// Workout Plan Form Modal Component
function WorkoutPlanFormModal({
  plan,
  onSave,
  onClose,
}: {
  plan?: WorkoutPlan | null;
  onSave: (planData: Partial<WorkoutPlan>) => void;
  onClose: () => void;
}) {
  const [formData, setFormData] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    difficulty:
      plan?.difficulty ||
      ('beginner' as 'beginner' | 'intermediate' | 'advanced'),
    durationWeeks: plan?.durationWeeks || 4,
    frequencyPerWeek: plan?.frequencyPerWeek || 3,
    exercises: plan?.exercises || ([] as WorkoutPlanExercise[]),
  });

  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: 3,
    reps: 10,
    weight: 0,
    restSeconds: 60,
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave({
      ...formData,
      ...(plan
        ? { id: plan.id, createdAt: plan.createdAt, isActive: plan.isActive }
        : {}),
    });
  };

  const addExercise = () => {
    if (!newExercise.name.trim()) return;

    const exercise: WorkoutPlanExercise = {
      exerciseId: `temp-${Date.now()}`,
      name: newExercise.name,
      sets: newExercise.sets,
      reps: newExercise.reps,
      weight: newExercise.weight || undefined,
      restSeconds: newExercise.restSeconds,
      notes: newExercise.notes || undefined,
      order: formData.exercises.length,
    };

    setFormData({
      ...formData,
      exercises: [...formData.exercises, exercise],
    });

    setNewExercise({
      name: '',
      sets: 3,
      reps: 10,
      weight: 0,
      restSeconds: 60,
      notes: '',
    });
  };

  const removeExercise = (index: number) => {
    setFormData({
      ...formData,
      exercises: formData.exercises.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {plan ? 'Edit Workout Plan' : 'Create Workout Plan'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Info */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Plan Name
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Difficulty
                </label>
                <select
                  value={formData.difficulty}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      difficulty: e.target.value as any,
                    })
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Duration (weeks)
                </label>
                <input
                  type="number"
                  value={formData.durationWeeks}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      durationWeeks: parseInt(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="1"
                  max="52"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Frequency (per week)
                </label>
                <input
                  type="number"
                  value={formData.frequencyPerWeek}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      frequencyPerWeek: parseInt(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  min="1"
                  max="7"
                />
              </div>
            </div>

            {/* Exercises Section */}
            <div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                Exercises
              </h3>

              {/* Exercise List */}
              <div className="space-y-3 mb-4">
                {formData.exercises.map((exercise, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-600 rounded-lg p-4"
                  >
                    <div className="flex justify-between items-start">
                      <div className="flex-1">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {exercise.name}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {exercise.sets} sets × {exercise.reps} reps
                          {exercise.weight && ` @ ${exercise.weight}lbs`}
                          {exercise.restSeconds &&
                            ` • ${exercise.restSeconds}s rest`}
                        </p>
                        {exercise.notes && (
                          <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
                            {exercise.notes}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeExercise(index)}
                        className="text-red-500 hover:text-red-700 p-1"
                      >
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Exercise Form */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-white mb-3">
                  Add Exercise
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  <input
                    type="text"
                    placeholder="Exercise name"
                    value={newExercise.name}
                    onChange={(e) =>
                      setNewExercise({ ...newExercise, name: e.target.value })
                    }
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="number"
                    placeholder="Sets"
                    value={newExercise.sets}
                    onChange={(e) =>
                      setNewExercise({
                        ...newExercise,
                        sets: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="number"
                    placeholder="Reps"
                    value={newExercise.reps}
                    onChange={(e) =>
                      setNewExercise({
                        ...newExercise,
                        reps: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="number"
                    placeholder="Weight (lbs)"
                    value={newExercise.weight}
                    onChange={(e) =>
                      setNewExercise({
                        ...newExercise,
                        weight: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
                  <input
                    type="number"
                    placeholder="Rest time (seconds)"
                    value={newExercise.restSeconds}
                    onChange={(e) =>
                      setNewExercise({
                        ...newExercise,
                        restSeconds: parseInt(e.target.value) || 0,
                      })
                    }
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                  <input
                    type="text"
                    placeholder="Notes (optional)"
                    value={newExercise.notes}
                    onChange={(e) =>
                      setNewExercise({ ...newExercise, notes: e.target.value })
                    }
                    className="border border-gray-300 dark:border-gray-600 rounded px-3 py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                  />
                </div>
                <button
                  type="button"
                  onClick={addExercise}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm"
                >
                  Add Exercise
                </button>
              </div>
            </div>

            <div className="flex space-x-3">
              <button
                type="submit"
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
              >
                {plan ? 'Update Plan' : 'Create Plan'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Workout Plan Detail Modal Component
function WorkoutPlanDetailModal({
  plan,
  onClose,
  onStart,
  onEdit,
}: {
  plan: WorkoutPlan;
  onClose: () => void;
  onStart: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {plan.name}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              ✕
            </button>
          </div>

          <p className="text-gray-600 dark:text-gray-400 mb-6">
            {plan.description || 'No description provided'}
          </p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {plan.durationWeeks}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Weeks
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {plan.frequencyPerWeek}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Per Week
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {plan.exercises.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Exercises
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600 capitalize">
                {plan.difficulty}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Level
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 dark:text-white">
              Exercises
            </h3>
            {plan.exercises.map((exercise, index) => (
              <div
                key={index}
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
                  {exercise.restSeconds && ` • ${exercise.restSeconds}s rest`}
                </p>
                {exercise.notes && (
                  <p className="text-sm text-gray-500 dark:text-gray-500">
                    {exercise.notes}
                  </p>
                )}
              </div>
            ))}
          </div>

          <div className="flex space-x-3 mt-6">
            <button
              onClick={onStart}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Start Workout
            </button>
            <button
              onClick={onEdit}
              className="bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-4 py-2 rounded-lg"
            >
              Edit Plan
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
