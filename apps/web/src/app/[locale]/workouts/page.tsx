'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations, useLocale } from 'next-intl';
import { api } from '../../../lib/api-client';
import { aiService } from '../../../lib/ai-service-client';
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
  Brain,
  AlertTriangle,
  BarChart3,
  Sparkles,
  X,
} from 'lucide-react';
import ExerciseFormModal from '../../../components/modals/ExerciseFormModal';
import ExerciseSelectionModal from '../../../components/modals/ExerciseSelectionModal';
import WorkoutAdaptationModal from '../../../components/modals/WorkoutAdaptationModal';
import PerformanceAnalytics from '../../../components/workouts/PerformanceAnalytics';
import { ConfidenceIndicator } from '../../../components/ai/visualizations';
import ContextualAITrigger from '../../../components/ai/ContextualAITrigger';
import WorkoutPlanCreator from '../../../components/ai/WorkoutPlanCreator';
import type { WorkoutAdaptation } from '../../../types/ai-service';

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
  createdBy?: string;
  isSystem: boolean;
  tags: string[];
}

interface LibraryExercise {
  id: string;
  name: string;
  muscle_group: string;
  description?: string;
  equipment?: string;
  difficulty?: 'beginner' | 'intermediate' | 'advanced';
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
  const locale = useLocale();
  const t = useTranslations('workouts_page');
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
  // 🔧 STREAMLINED: Keep 3 core views - sessions, plans, exercises
  // Removed: templates (AI generates personalized plans, not generic templates)
  // Analytics shown inline in sessions view instead of separate view
  const [activeView, setActiveView] = useState<
    'sessions' | 'plans' | 'exercises'
  >(
    (searchParams.get('view') as 'sessions' | 'plans' | 'exercises') ||
      'sessions'
  );

  // Function to update view and persist in URL
  const updateActiveView = (view: 'sessions' | 'plans' | 'exercises') => {
    setActiveView(view);
    const params = new URLSearchParams(searchParams.toString());
    params.set('view', view);
    router.push(`/${locale}/workouts?${params.toString()}`);
  };

  // Exercises state
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [exercisesError, setExercisesError] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all');
  const [exerciseSearchTerm, setExerciseSearchTerm] = useState<string>('');
  const [showExerciseForm, setShowExerciseForm] = useState(false);
  const [editingExercise, setEditingExercise] =
    useState<ExerciseLibraryItem | null>(null);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [workoutExercises, setWorkoutExercises] = useState<
    WorkoutPlanExercise[]
  >([]);
  const [creatingWorkout, setCreatingWorkout] = useState<
    'session' | 'plan' | null
  >(null);

  // AI-related state
  const [aiSuggestions, setAiSuggestions] = useState<{
    adaptations: WorkoutAdaptation | null;
    performance: any;
    injuryRisk: any;
  }>({
    adaptations: null,
    performance: null,
    injuryRisk: null,
  });
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [showAdaptationModal, setShowAdaptationModal] = useState(false);
  const [selectedPlanForAdaptation, setSelectedPlanForAdaptation] =
    useState<WorkoutPlan | null>(null);
  const [showPerformanceAnalytics, setShowPerformanceAnalytics] =
    useState(false);

  // AI Workout Plan Creator state
  const [showAIPlanCreator, setShowAIPlanCreator] = useState(false);

  useEffect(() => {
    fetchWorkouts();
    fetchWorkoutPlans();
    if (activeView === 'exercises') {
      fetchExercises();
    }
    // Load AI suggestions when user data is available
    if (user?.id) {
      fetchAISuggestions();
    }
  }, [activeView, user?.id]);

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

        // Remove duplicates based on ID (in case of any backend issues)
        const uniqueWorkouts = apiWorkouts.filter(
          (workout, index, self) =>
            index === self.findIndex((w) => w.id === workout.id)
        );

        setWorkouts(uniqueWorkouts);
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
            createdBy: exercise.created_by || exercise.createdBy,
            isSystem: exercise.is_system || exercise.isSystem || false,
            tags: exercise.tags || [],
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

  // AI Functions
  const fetchAISuggestions = async () => {
    if (!user?.id) return;

    try {
      setAiLoading(true);
      setAiError(null);

      // Get active workout plan for adaptations
      const activePlan = workoutPlans.find((plan) => plan.isActive);

      if (activePlan) {
        // Analyze workout plan adaptations
        const adaptationResponse = await aiService.adaptWorkoutPlan({
          workoutPlanId: activePlan.id,
          recentPerformance: {},
          userFeedback: '',
          injuryStatus: 'none',
          equipmentAvailable: ['dumbbells', 'barbell', 'bodyweight'],
        });

        // Assess injury risk
        const injuryResponse = await aiService.assessInjuryRisk();

        setAiSuggestions((prev) => ({
          ...prev,
          adaptations: adaptationResponse.data,
          injuryRisk: injuryResponse.data,
        }));
      }

      // Analyze performance trends
      const performanceResponse = await aiService.analyzePerformance({});

      setAiSuggestions((prev) => ({
        ...prev,
        performance: performanceResponse.data,
      }));
    } catch (err: any) {
      console.error('Failed to fetch AI suggestions:', err);
      setAiError(err.message || 'Failed to fetch AI suggestions');
    } finally {
      setAiLoading(false);
    }
  };

  const handleOptimizePlan = (plan: WorkoutPlan) => {
    setSelectedPlanForAdaptation(plan);
    setShowAdaptationModal(true);
  };

  const handleCheckInjuryRisk = async () => {
    if (!user?.id) return;

    try {
      setAiLoading(true);
      const injuryResponse = await aiService.assessInjuryRisk();

      setAiSuggestions((prev) => ({
        ...prev,
        injuryRisk: injuryResponse.data,
      }));
    } catch (err: any) {
      console.error('Failed to check injury risk:', err);
      setAiError(err.message || 'Failed to check injury risk');
    } finally {
      setAiLoading(false);
    }
  };

  const handleFindAlternatives = async (exerciseId: string) => {
    if (!user?.id) return;

    try {
      setAiLoading(true);
      const alternatives = await aiService.substituteExercise(
        exerciseId,
        'user_preference'
      );

      // Show alternatives in a modal or notification
    } catch (err: any) {
      console.error('Failed to find alternatives:', err);
      setAiError(err.message || 'Failed to find alternatives');
    } finally {
      setAiLoading(false);
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
        tags: exerciseData.tags,
      });
      await fetchExercises(); // Refresh the list
    } catch (e: any) {
      console.error('Failed to create exercise:', e);
      setExercisesError(e.message || 'Failed to create exercise');
    }
  };

  const updateExercise = async (exerciseData: Partial<ExerciseLibraryItem>) => {
    try {
      await api.updateExercise(exerciseData);
      await fetchExercises(); // Refresh the list
    } catch (e: any) {
      console.error('Failed to update exercise:', e);
      setExercisesError(e.message || 'Failed to update exercise');
    }
  };

  const handleAddToWorkout = (exercise: ExerciseLibraryItem) => {
    // Create a new workout exercise with default values
    const newWorkoutExercise: WorkoutPlanExercise = {
      exerciseId: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: 10,
      restSeconds: 60,
      order: workoutExercises.length,
    };

    setWorkoutExercises((prev) => [...prev, newWorkoutExercise]);

    // Show success message and open workout plan form
    alert(
      `${exercise.name} added to workout! Create or edit your workout plan now.`
    );

    // Open the workout plan form to create/edit the plan
    setShowPlanForm(true);
  };

  const handleExerciseFromLibrary = (exercise: ExerciseLibraryItem) => {
    const newWorkoutExercise: WorkoutPlanExercise = {
      exerciseId: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: 10,
      restSeconds: 60,
      order: workoutExercises.length,
    };

    setWorkoutExercises((prev) => [...prev, newWorkoutExercise]);
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

  const cloneExercise = async (exerciseId: string) => {
    if (
      !confirm(
        'This will create a custom copy of this exercise that you can edit. Continue?'
      )
    ) {
      return;
    }

    try {
      await api.cloneExercise(exerciseId);
      await fetchExercises(); // Refresh the list
      alert(
        'Exercise cloned successfully! You can now edit your custom version.'
      );
    } catch (e: any) {
      console.error('Failed to clone exercise:', e);
      setExercisesError(e.message || 'Failed to clone exercise');
    }
  };

  const startWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
  };

  const completeWorkout = async (workoutId: string) => {
    try {
      // Find the workout session to complete
      const workout = workouts.find((w) => w.id === workoutId);
      if (!workout) {
        throw new Error('Workout session not found');
      }

      // Check if already completed to prevent duplicate operations
      if (workout.completed) {
        setSelectedWorkout(null);
        return;
      }

      const now = new Date().toISOString();

      // Update the existing workout session to mark as completed

      try {
        // Transform exercises to match backend expected format
        const transformedExercises =
          workout.exercises?.map((exercise, index) => ({
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
              completed: true, // Mark all sets as completed when completing workout
              notes: null,
            })),
          })) || [];

        const updateResponse = await api.updateWorkoutSession(workoutId, {
          name: workout.name, // Required by backend
          completedAt: now,
          completed: true,
          exercises: transformedExercises, // Properly formatted exercises data
        });
        // Update the local state to reflect completion
        setWorkouts(
          workouts.map((w) =>
            w.id === workoutId ? { ...w, completed: true, completedAt: now } : w
          )
        );

        // Refresh the workouts list to ensure backend sync
        setTimeout(() => {
          fetchWorkouts();
        }, 1000);

        // Show success message
        alert('Workout completed successfully!');
      } catch (apiError: any) {
        console.error('Failed to update session via API:', apiError.message);
        // Still update UI optimistically for better UX
        setWorkouts(
          workouts.map((w) =>
            w.id === workoutId ? { ...w, completed: true, completedAt: now } : w
          )
        );
        alert('Workout marked as complete (offline mode)');
      }

      setSelectedWorkout(null);
    } catch (e: any) {
      console.error('Failed to complete workout:', e);
      alert('Failed to complete workout. Please try again.');
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
      await fetchWorkouts(); // Refresh the list
    } catch (e: any) {
      console.error('Failed to delete workout session:', e);
      setError(e.message || 'Failed to delete workout session');
    }
  };

  const editWorkoutSession = (workout: Workout) => {
    // Navigate to edit page or set up edit modal
    router.push(`/${locale}/workouts/edit-workout?id=${workout.id}`);
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

      // Refresh workouts to show the new session
      await fetchWorkouts();

      // Switch to sessions view
      updateActiveView('sessions');
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
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <div className="flex space-x-3">
          {activeView === 'sessions' ? (
            <button
              onClick={() => setCreatingWorkout('session')}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>{t('new_session')}</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowPlanForm(true)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Plus className="h-4 w-4" />
              <span>{t('new_plan')}</span>
            </button>
          )}
        </div>
      </div>

      {/* 🔧 AI-FIRST: Prominent AI Generate Plan Button */}
      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        {/* ⭐ MAIN CTA: AI Workout Plan Generation - Most Prominent */}
        <button
          onClick={() => setShowAIPlanCreator(true)}
          className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 shadow-lg transform hover:scale-105 transition-all font-semibold"
        >
          <Sparkles className="h-5 w-5" />
          <span>Generate My AI Program</span>
        </button>

        {/* Secondary Actions */}
        <button
          onClick={() => router.push(`/${locale}/workouts/sessions/create`)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Play className="h-4 w-4" />
          <span>{t('quick_workout')}</span>
        </button>
        <button
          onClick={() => router.push(`/${locale}/workouts/plans`)}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Calendar className="h-4 w-4" />
          <span>{t('browse_plans')}</span>
        </button>
        {/* 🔧 COMMENTED OUT: Manual Exercise Library Button */}
        {/* Expert Rationale: AI trainer automatically selects optimal exercises.
             Users don't need to manually browse exercise library - AI handles this. */}
        {/* <button
          onClick={() => router.push(`/${locale}/workouts/exercises`)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Dumbbell className="h-4 w-4" />
          <span>{t('exercise_library')}</span>
        </button> */}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center">
            <Dumbbell className="h-8 w-8 text-blue-600" />
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {t('total_workouts')}
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
                {t('completed')}
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
                {t('total_time')}
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
                {t('this_week')}
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

      {/* AI Suggestions Section */}
      {user?.id && (
        <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border border-blue-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-2">
              <Brain className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">
                {t('ai_intelligence')}
              </h3>
              <Sparkles className="w-4 h-4 text-purple-500" />
            </div>
            {aiLoading && (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
            )}
          </div>

          {aiError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span className="text-sm text-red-600">{aiError}</span>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            {/* Workout Adaptations */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">
                  {t('plan_adaptations')}
                </h4>
                {aiSuggestions.adaptations && (
                  <ConfidenceIndicator score={0.8} size="sm" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {t('plan_adaptations_desc')}
              </p>
              <button
                onClick={() => {
                  const activePlan = workoutPlans.find((plan) => plan.isActive);
                  if (activePlan) handleOptimizePlan(activePlan);
                }}
                disabled={
                  !workoutPlans.find((plan) => plan.isActive) || aiLoading
                }
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {t('optimize_my_plan')}
              </button>
            </div>

            {/* Injury Risk Assessment */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">
                  {t('injury_risk')}
                </h4>
                {aiSuggestions.injuryRisk && (
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      aiSuggestions.injuryRisk.risk === 'low'
                        ? 'bg-green-100 text-green-800'
                        : aiSuggestions.injuryRisk.risk === 'medium'
                          ? 'bg-yellow-100 text-yellow-800'
                          : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {aiSuggestions.injuryRisk.risk?.toUpperCase() || 'UNKNOWN'}
                  </span>
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {t('injury_risk_desc')}
              </p>
              <button
                onClick={handleCheckInjuryRisk}
                disabled={aiLoading}
                className="w-full bg-orange-600 hover:bg-orange-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {t('check_injury_risk')}
              </button>
            </div>

            {/* Performance Analytics */}
            <div className="bg-white rounded-lg border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900">
                  {t('performance')}
                </h4>
                {aiSuggestions.performance && (
                  <ConfidenceIndicator score={0.8} size="sm" />
                )}
              </div>
              <p className="text-sm text-gray-600 mb-3">
                {t('performance_desc')}
              </p>
              <button
                onClick={() => setShowPerformanceAnalytics(true)}
                disabled={aiLoading}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                {t('view_analytics')}
              </button>
            </div>
          </div>

          {/* Quick AI Actions */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() =>
                router.push(`/${locale}/ai-trainer?context=workout`)
              }
              className="bg-purple-600 hover:bg-purple-700 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
            >
              <Brain className="w-4 h-4" />
              <span>{t('ask_ai_about_workouts')}</span>
            </button>
            <button
              onClick={() => handleFindAlternatives('example-exercise-id')}
              disabled={aiLoading}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
            >
              <Target className="w-4 h-4" />
              <span>{t('find_exercise_alternatives')}</span>
            </button>
          </div>
        </div>
      )}

      {/* Content based on active view */}
      {activeView === 'sessions' && (
        <>
          {/* Workouts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {workouts.length === 0 ? (
              <div className="col-span-full text-center py-12">
                <Dumbbell className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  {t('no_sessions')}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-4">
                  {t('no_sessions_desc')}
                </p>
                <button
                  onClick={() => updateActiveView('plans')}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
                >
                  {t('view_workout_plans')}
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
                            title={t('edit_workout')}
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => deleteWorkoutSession(workout.id)}
                            className="text-gray-400 hover:text-red-600 p-1"
                            title={t('delete_workout')}
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
                        {workout.exercises.length} {t('exercises')}
                      </div>
                    </div>

                    <div className="flex space-x-2">
                      <button
                        onClick={() => startWorkout(workout)}
                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                      >
                        <Play className="h-4 w-4" />
                        <span>
                          {workout.completed ? t('repeat') : t('start')}
                        </span>
                      </button>
                      {!workout.completed && (
                        <button
                          onClick={() => completeWorkout(workout.id)}
                          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                        >
                          {t('complete')}
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

          {/* Contextual AI Trigger for Workout Plans */}
          {workoutPlans.length > 0 && (
            <ContextualAITrigger
              context={{
                type: 'workout',
                data: {
                  plans: workoutPlans,
                  activePlan: workoutPlans.find((plan) => plan.isActive),
                  totalPlans: workoutPlans.length,
                },
                title: 'Need help with your workout plans?',
                description:
                  'Get AI-powered advice on optimizing your workout routines and achieving your fitness goals.',
                suggestedQuestions: [
                  'How can I improve my current workout plan?',
                  'What exercises should I add to target specific muscle groups?',
                  'How should I progress my workouts over time?',
                  'Are there any exercises I should avoid or modify?',
                ],
              }}
              className="mb-6"
            />
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
        <>
          {/* Exercise Library Header */}
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Exercise Library
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Browse and manage your exercise collection
              </p>
            </div>
            {/* 🔧 COMMENTED OUT: Manual Exercise Creation Button */}
            {/* Expert Rationale: AI trainer should select/create exercises automatically.
                 Manual exercise creation is advanced user feature, not primary workflow. */}
            {/* <div className="flex space-x-3">
              <button
                onClick={() => {
                  setEditingExercise(null);
                  setShowExerciseForm(true);
                }}
                className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Add New Exercise</span>
              </button>
            </div> */}
          </div>

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

          {/* Exercises Display */}
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
                    setEditingExercise(null);
                    setShowExerciseForm(true);
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
                            {exercise.isSystem ? (
                              <span className="text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full">
                                System
                              </span>
                            ) : (
                              <span className="text-xs px-2 py-1 bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200 rounded-full">
                                Custom
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleAddToWorkout(exercise)}
                            className="text-gray-400 hover:text-blue-600 p-2"
                            title="Add to Workout Plan"
                          >
                            <Plus className="h-4 w-4" />
                          </button>
                          {exercise.isSystem ? (
                            // System exercise - show clone button instead of edit/delete
                            <button
                              onClick={() => cloneExercise(exercise.id)}
                              className="text-gray-400 hover:text-green-600 p-2"
                              title="Clone Exercise (Create Custom Version)"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                          ) : (
                            // User exercise - show edit and delete buttons
                            <>
                              <button
                                onClick={() => {
                                  setEditingExercise(exercise);
                                  setShowExerciseForm(true);
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
                            </>
                          )}
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
                          onClick={() => handleAddToWorkout(exercise)}
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
                {selectedWorkout.completed ? (
                  <div className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg text-center">
                    ✓ Completed on{' '}
                    {new Date(
                      selectedWorkout.completedAt!
                    ).toLocaleDateString()}
                  </div>
                ) : (
                  <button
                    onClick={() => completeWorkout(selectedWorkout.id)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg"
                  >
                    Mark as Complete
                  </button>
                )}
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

      {/* Exercise Form Modal */}
      {showExerciseForm && (
        <ExerciseFormModal
          exercise={editingExercise || undefined}
          onSave={editingExercise ? updateExercise : createExercise}
          onClose={() => {
            setShowExerciseForm(false);
            setEditingExercise(null);
          }}
        />
      )}

      {/* Exercise Selection Modal */}
      {showExerciseSelection && (
        <ExerciseSelectionModal
          onClose={() => {
            setShowExerciseSelection(false);
            setCreatingWorkout(null);
          }}
          onExerciseAdd={handleAddToWorkout}
          onCreateNew={() => {
            setShowExerciseSelection(false);
            setEditingExercise(null);
            setShowExerciseForm(true);
          }}
          selectedExercises={workoutExercises}
        />
      )}

      {/* Session Creation Modal */}
      {creatingWorkout === 'session' && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Create New Session
              </h3>
              <button
                onClick={() => setCreatingWorkout(null)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                ✕
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const formData = new FormData(e.currentTarget);
                const sessionData = {
                  name: formData.get('name') as string,
                  notes: formData.get('notes') as string,
                  difficulty: formData.get('difficulty') as
                    | 'beginner'
                    | 'intermediate'
                    | 'advanced',
                  exercises: [],
                };

                try {
                  await api.createWorkoutSession(sessionData);
                  setCreatingWorkout(null);
                  fetchWorkouts();
                } catch (error) {
                  console.error('Error creating session:', error);
                }
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Session Name
                </label>
                <input
                  name="name"
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter session name"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Difficulty
                </label>
                <select
                  name="difficulty"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="beginner">Beginner</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="advanced">Advanced</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  name="notes"
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Add any notes about this session..."
                />
              </div>

              <div className="flex justify-end space-x-3 pt-4">
                <button
                  type="button"
                  onClick={() => setCreatingWorkout(null)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Create Session
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workout Plan Form Modal */}
      {showPlanForm && (
        <WorkoutPlanFormModal
          plan={editingPlan}
          initialExercises={workoutExercises}
          onSave={editingPlan ? updateWorkoutPlan : createWorkoutPlan}
          onClose={() => {
            setShowPlanForm(false);
            setEditingPlan(null);
            setWorkoutExercises([]); // Clear exercises after closing
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

      {/* AI Modals */}
      {showAdaptationModal && selectedPlanForAdaptation && (
        <WorkoutAdaptationModal
          isOpen={showAdaptationModal}
          onClose={() => {
            setShowAdaptationModal(false);
            setSelectedPlanForAdaptation(null);
          }}
          currentPlan={selectedPlanForAdaptation}
          onApplyAdaptations={(adaptations) => {
            // Here you would typically update the workout plan with the adaptations
            fetchWorkoutPlans(); // Refresh the plans
          }}
        />
      )}

      {showPerformanceAnalytics && user?.id && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900">
                Performance Analytics
              </h2>
              <button
                onClick={() => setShowPerformanceAnalytics(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto max-h-[80vh]">
              <PerformanceAnalytics userId={user.id} />
            </div>
          </div>
        </div>
      )}

      {/* AI Workout Plan Creator Modal */}
      {showAIPlanCreator && (
        <div className="fixed inset-0 bg-black/50 dark:bg-black/70 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between z-10">
              <div className="flex items-center space-x-3">
                <div className="p-2 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg">
                  <Sparkles className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    AI Workout Plan Generator
                  </h2>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Create a personalized workout plan with AI
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAIPlanCreator(false)}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>

            <div className="p-6">
              <WorkoutPlanCreator
                onComplete={async (planId) => {
                  // Close modal
                  setShowAIPlanCreator(false);
                  // Refresh workout plans
                  await fetchWorkoutPlans();
                  // Switch to plans view
                  updateActiveView('plans');
                  // Show success message
                  console.log('Plan created successfully:', planId);
                }}
                onCancel={() => setShowAIPlanCreator(false)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Workout Plan Form Modal Component
function WorkoutPlanFormModal({
  plan,
  initialExercises = [],
  onSave,
  onClose,
}: {
  plan?: WorkoutPlan | null;
  initialExercises?: WorkoutPlanExercise[];
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
    exercises:
      plan?.exercises || initialExercises || ([] as WorkoutPlanExercise[]),
  });

  // Exercise library state
  const [availableExercises, setAvailableExercises] = useState<
    LibraryExercise[]
  >([]);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);
  const [showCustomExerciseForm, setShowCustomExerciseForm] = useState(false);

  // Track selected exercise IDs for UI state management
  const selectedExerciseIds = formData.exercises
    .map((ex) => ex.exerciseId)
    .filter(Boolean);

  const [newExercise, setNewExercise] = useState({
    name: '',
    sets: 3,
    reps: 10,
    weight: 0,
    restSeconds: 60,
    notes: '',
  });

  // Fetch exercises from library
  const fetchExercises = async () => {
    try {
      setExercisesLoading(true);
      const exercises = await api.getExercises();
      setAvailableExercises(exercises || []);
    } catch (error) {
      console.error('Error fetching exercises:', error);
    } finally {
      setExercisesLoading(false);
    }
  };

  useEffect(() => {
    fetchExercises();
  }, []);

  // Add exercise from library
  const addExerciseFromLibrary = (exercise: LibraryExercise) => {
    const workoutExercise: WorkoutPlanExercise = {
      exerciseId: exercise.id,
      name: exercise.name,
      sets: 3,
      reps: 10,
      weight: undefined,
      restSeconds: 60,
      notes: exercise.description,
      order: formData.exercises.length,
    };

    setFormData({
      ...formData,
      exercises: [...formData.exercises, workoutExercise],
    });
    setShowExerciseSelection(false);
  };

  // Add custom exercise
  const addCustomExercise = (exercise: Omit<LibraryExercise, 'id'>) => {
    const workoutExercise: WorkoutPlanExercise = {
      exerciseId: `custom-${Date.now()}`,
      name: exercise.name,
      sets: 3,
      reps: 10,
      weight: undefined,
      restSeconds: 60,
      notes: exercise.description,
      order: formData.exercises.length,
    };

    setFormData({
      ...formData,
      exercises: [...formData.exercises, workoutExercise],
    });
    setShowCustomExerciseForm(false);
  };

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

              {/* Add Exercise Section */}
              <div className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 bg-gray-50 dark:bg-gray-700">
                <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                  Add Exercises
                </h4>

                <div className="flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setShowExerciseSelection(true)}
                    disabled={exercisesLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    {exercisesLoading ? 'Loading...' : 'From Exercise Library'}
                  </button>

                  {/* 🔧 COMMENTED OUT: Manual Custom Exercise Creation */}
                  {/* Expert Rationale: AI trainer should suggest exercises. Manual creation is edge case. */}
                  {/* <button
                    type="button"
                    onClick={() => setShowCustomExerciseForm(true)}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm flex items-center justify-center gap-2"
                  >
                    <Plus className="h-4 w-4" />
                    Create Custom Exercise
                  </button> */}
                </div>

                {formData.exercises.length === 0 && (
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-3 text-center">
                    No exercises added yet. Add exercises from the library or
                    create custom ones.
                  </p>
                )}
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

      {/* Exercise Selection Modal */}
      {showExerciseSelection && (
        <PlanExerciseSelectionModal
          exercises={availableExercises}
          selectedExerciseIds={selectedExerciseIds}
          onSelect={addExerciseFromLibrary}
          onClose={() => setShowExerciseSelection(false)}
        />
      )}

      {/* Custom Exercise Modal */}
      {showCustomExerciseForm && (
        <PlanCustomExerciseModal
          onSave={addCustomExercise}
          onClose={() => setShowCustomExerciseForm(false)}
        />
      )}
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

// Exercise Selection Modal for Workout Plans
function PlanExerciseSelectionModal({
  exercises,
  onSelect,
  onClose,
  selectedExerciseIds = [],
}: {
  exercises: LibraryExercise[];
  onSelect: (exercise: LibraryExercise) => void;
  onClose: () => void;
  selectedExerciseIds?: string[];
}) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredExercises = exercises.filter(
    (exercise) =>
      exercise.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      exercise.muscle_group.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Select Exercise
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300"
          >
            ✕
          </button>
        </div>

        <input
          type="text"
          placeholder="Search exercises..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-2 border border-gray-300 dark:border-gray-600 rounded mb-4 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        />

        <div className="overflow-y-auto max-h-96">
          {filteredExercises.map((exercise) => {
            const isSelected = selectedExerciseIds.includes(exercise.id);
            return (
              <div
                key={exercise.id}
                className={`p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer relative ${
                  isSelected
                    ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
                onClick={() => !isSelected && onSelect(exercise)}
              >
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div
                      className={`font-medium ${isSelected ? 'text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'}`}
                    >
                      {exercise.name}
                    </div>
                    <div
                      className={`text-sm ${isSelected ? 'text-blue-600 dark:text-blue-400' : 'text-gray-600 dark:text-gray-400'}`}
                    >
                      {exercise.muscle_group}
                    </div>
                    {exercise.description && (
                      <div
                        className={`text-sm mt-1 ${isSelected ? 'text-blue-500 dark:text-blue-500' : 'text-gray-500 dark:text-gray-500'}`}
                      >
                        {exercise.description}
                      </div>
                    )}
                  </div>
                  {isSelected && (
                    <div className="text-blue-600 dark:text-blue-400 text-sm font-medium ml-2">
                      ✓ Selected
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {filteredExercises.length === 0 && (
            <p className="text-center text-gray-500 dark:text-gray-400 py-8">
              No exercises found matching your search.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

// Custom Exercise Modal for Workout Plans
function PlanCustomExerciseModal({
  onSave,
  onClose,
}: {
  onSave: (exercise: Omit<LibraryExercise, 'id'>) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >('beginner');
  const [muscleGroups, setMuscleGroups] = useState<string[]>([]);
  const [equipment, setEquipment] = useState<string[]>([]);
  const [instructions, setInstructions] = useState('');
  const [tips, setTips] = useState('');
  const [videoUrl, setVideoUrl] = useState('');
  const [imageUrl, setImageUrl] = useState('');

  const availableCategories = [
    'strength',
    'cardio',
    'flexibility',
    'balance',
    'endurance',
    'power',
    'agility',
  ];

  const availableMuscleGroups = [
    'chest',
    'back',
    'shoulders',
    'biceps',
    'triceps',
    'forearms',
    'abs',
    'obliques',
    'glutes',
    'quadriceps',
    'hamstrings',
    'calves',
    'full-body',
    'core',
  ];

  const availableEquipment = [
    'bodyweight',
    'dumbbells',
    'barbell',
    'kettlebell',
    'resistance-bands',
    'pull-up-bar',
    'bench',
    'cable-machine',
    'smith-machine',
    'plates',
  ];

  const handleMuscleGroupToggle = (group: string) => {
    setMuscleGroups((prev) =>
      prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]
    );
  };

  const handleEquipmentToggle = (item: string) => {
    setEquipment((prev) =>
      prev.includes(item) ? prev.filter((e) => e !== item) : [...prev, item]
    );
  };

  const handleSave = () => {
    if (!name.trim() || !category.trim() || muscleGroups.length === 0) return;

    onSave({
      name: name.trim(),
      muscle_group: muscleGroups.join(', '),
      description: instructions.trim(),
      equipment: equipment.join(', '),
      difficulty: difficulty,
      // Additional fields that match backend structure
      category: category.trim(),
      muscle_groups: muscleGroups,
      instructions: instructions.trim(),
      tips: tips.trim(),
      video_url: videoUrl.trim(),
      image_url: imageUrl.trim(),
    } as any);

    // Reset form
    setName('');
    setCategory('');
    setDifficulty('beginner');
    setMuscleGroups([]);
    setEquipment([]);
    setInstructions('');
    setTips('');
    setVideoUrl('');
    setImageUrl('');
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
            Create Custom Exercise
          </h3>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 text-xl"
          >
            ✕
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Exercise Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g., Barbell Bench Press"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select category</option>
                {availableCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat.charAt(0).toUpperCase() + cat.slice(1)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Difficulty Level
              </label>
              <select
                value={difficulty}
                onChange={(e) =>
                  setDifficulty(
                    e.target.value as 'beginner' | 'intermediate' | 'advanced'
                  )
                }
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Muscle Groups *
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                {availableMuscleGroups.map((group) => (
                  <label
                    key={group}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={muscleGroups.includes(group)}
                      onChange={() => handleMuscleGroupToggle(group)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {group.replace('-', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Equipment
              </label>
              <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto p-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700">
                {availableEquipment.map((item) => (
                  <label
                    key={item}
                    className="flex items-center space-x-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 p-1 rounded"
                  >
                    <input
                      type="checkbox"
                      checked={equipment.includes(item)}
                      onChange={() => handleEquipmentToggle(item)}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                      {item.replace('-', ' ')}
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Instructions
              </label>
              <textarea
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={4}
                placeholder="Step-by-step instructions for performing this exercise..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Tips & Form Cues
              </label>
              <textarea
                value={tips}
                onChange={(e) => setTips(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                rows={3}
                placeholder="Helpful tips and form cues..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Video URL
              </label>
              <input
                type="url"
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://youtube.com/watch?v=..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Image URL
              </label>
              <input
                type="url"
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="https://example.com/image.jpg"
              />
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-8 pt-4 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="flex-1 px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 font-medium transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={
              !name.trim() || !category.trim() || muscleGroups.length === 0
            }
            className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
          >
            Create Exercise
          </button>
        </div>
      </div>
    </div>
  );
}
