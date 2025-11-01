'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
  Calendar,
  Clock,
  Target,
  Dumbbell,
  Plus,
  Play,
  Edit,
  Trash2,
  Star,
  CheckCircle,
  Users,
  TrendingUp,
  ArrowLeft,
  Filter,
  Search,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';

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
  totalSessions?: number;
  completedSessions?: number;
  nextScheduledDate?: string;
  tags?: string[];
  rating?: number;
  isTemplate?: boolean;
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

interface ScheduledWorkout {
  id: string;
  planId: string;
  planName: string;
  scheduledDate: string;
  scheduledTime: string;
  status: 'scheduled' | 'completed' | 'missed' | 'in-progress';
  week: number;
  day: number;
}

export default function WorkoutPlansPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useCurrentUser();
  const t = useTranslations('workout_plans');
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [scheduledWorkouts, setScheduledWorkouts] = useState<
    ScheduledWorkout[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Initialize view from URL parameter or default to 'my-plans'
  const initialView = searchParams.get('view') as
    | 'my-plans'
    | 'templates'
    | 'schedule'
    | null;
  const [view, setView] = useState<'my-plans' | 'templates' | 'schedule'>(
    initialView && ['my-plans', 'templates', 'schedule'].includes(initialView)
      ? initialView
      : 'my-plans'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [durationFilter, setDurationFilter] = useState<string>('all');
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);

  useEffect(() => {
    fetchWorkoutPlans();
    fetchScheduledWorkouts();
  }, []);

  const fetchWorkoutPlans = async () => {
    try {
      setLoading(true);
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
          rating: plan.rating || 0,
          isTemplate:
            plan.is_template !== undefined
              ? plan.is_template
              : plan.isTemplate || false,
          tags: plan.tags || [],
        }));
        setWorkoutPlans(plans);
      }
    } catch (e: any) {
      console.error('Failed to fetch workout plans:', e);
      setError(e.message || 'Failed to fetch workout plans');
    } finally {
      setLoading(false);
    }
  };

  const fetchScheduledWorkouts = async () => {
    try {
      const response = await api.getScheduledWorkouts();
      if (response && Array.isArray(response)) {
        const scheduled: ScheduledWorkout[] = response.map((item: any) => ({
          id: item.id,
          planId: item.plan_id || item.planId,
          planName: item.plan_name || item.planName,
          scheduledDate: item.scheduled_date || item.scheduledDate,
          scheduledTime: item.scheduled_time || item.scheduledTime,
          status: item.status,
          week: item.week,
          day: item.day,
        }));
        setScheduledWorkouts(scheduled);
      } else {
        setScheduledWorkouts([]);
      }
    } catch (e: any) {
      console.error('Failed to fetch scheduled workouts:', e);
      // Fall back to empty array on error
      setScheduledWorkouts([]);
    }
  };

  const schedulePlan = async (
    plan: WorkoutPlan,
    startDate: string,
    times: string[]
  ) => {
    try {
      console.log(
        'Scheduling plan:',
        plan.name,
        'from',
        startDate,
        'at times:',
        times
      );

      const response = await api.scheduleWorkoutPlan(plan.id, {
        startDate,
        times,
      });

      if (response) {
        // Refresh scheduled workouts from API
        await fetchScheduledWorkouts();

        setShowScheduleModal(false);
        setSelectedPlan(null);

        // Show success message
        const scheduledCount =
          response.scheduledWorkouts?.length ||
          plan.durationWeeks * plan.frequencyPerWeek;
        alert(
          `${plan.name} has been scheduled successfully! ${scheduledCount} workouts added to your calendar.`
        );
      }
    } catch (error) {
      console.error('Failed to schedule plan:', error);
      alert('Failed to schedule workout plan. Please try again.');
    }
  };

  const deleteScheduledWorkout = async (
    scheduleId: string,
    workoutName: string
  ) => {
    try {
      // Show confirmation dialog
      const confirmed = window.confirm(
        `Are you sure you want to delete the scheduled workout "${workoutName}"? This action cannot be undone.`
      );

      if (!confirmed) {
        return;
      }

      console.log('Deleting scheduled workout:', scheduleId);

      await api.cancelScheduledWorkout(scheduleId, user.id);

      // Refresh scheduled workouts list
      await fetchScheduledWorkouts();

      // Show success message
      alert(
        `Scheduled workout "${workoutName}" has been deleted successfully.`
      );
    } catch (error) {
      console.error('Failed to delete scheduled workout:', error);
      alert('Failed to delete scheduled workout. Please try again.');
    }
  };

  const filteredPlans = workoutPlans.filter((plan) => {
    const matchesSearch =
      plan.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      plan.description?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDifficulty =
      difficultyFilter === 'all' || plan.difficulty === difficultyFilter;
    const matchesDuration =
      durationFilter === 'all' ||
      (durationFilter === 'short' && plan.durationWeeks <= 4) ||
      (durationFilter === 'medium' &&
        plan.durationWeeks > 4 &&
        plan.durationWeeks <= 8) ||
      (durationFilter === 'long' && plan.durationWeeks > 8);

    if (view === 'templates') {
      return (
        matchesSearch && matchesDifficulty && matchesDuration && plan.isTemplate
      );
    }

    return (
      matchesSearch && matchesDifficulty && matchesDuration && !plan.isTemplate
    );
  });

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => router.push('/workouts')}
            className="p-2 text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              {t('title')}
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              {t('subtitle')}
            </p>
          </div>
        </div>
        <button
          onClick={() => router.push('/workouts/create')}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Plus className="h-4 w-4" />
          <span>{t('new_plan')}</span>
        </button>
      </div>

      {/* View Toggle */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-1 inline-flex">
        <button
          onClick={() => setView('my-plans')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'my-plans'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {t('my_plans')}
        </button>
        <button
          onClick={() => setView('templates')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'templates'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {t('templates')}
        </button>
        <button
          onClick={() => setView('schedule')}
          className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            view === 'schedule'
              ? 'bg-blue-600 text-white'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          {t('schedule')}
        </button>
      </div>

      {/* Filters (only show for plans views) */}
      {view !== 'schedule' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder={t('search_plans')}
                className="w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={difficultyFilter}
              onChange={(e) => setDifficultyFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('all_difficulties')}</option>
              <option value="beginner">Beginner</option>
              <option value="intermediate">Intermediate</option>
              <option value="advanced">Advanced</option>
            </select>
            <select
              value={durationFilter}
              onChange={(e) => setDurationFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">{t('all_durations')}</option>
              <option value="short">{t('short_duration')}</option>
              <option value="medium">{t('medium_duration')}</option>
              <option value="long">{t('long_duration')}</option>
            </select>
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                {t('plans_count', { count: filteredPlans.length })}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      {view === 'schedule' ? (
        <ScheduleView
          scheduledWorkouts={scheduledWorkouts}
          onDeleteScheduledWorkout={deleteScheduledWorkout}
        />
      ) : (
        <PlansGrid
          plans={filteredPlans}
          onSchedule={(plan) => {
            setSelectedPlan(plan);
            setShowScheduleModal(true);
          }}
          onStart={(plan) => {
            // Create a workout session from the plan
            router.push(`/workouts/sessions/create?planId=${plan.id}`);
          }}
          onUseTemplate={(plan) => {
            // Create a new workout plan from template
            const templateData = encodeURIComponent(
              JSON.stringify({
                name: plan.name,
                description: plan.description,
                difficulty: plan.difficulty,
                durationWeeks: plan.durationWeeks,
                frequencyPerWeek: plan.frequencyPerWeek,
                exercises: plan.exercises.map((ex) => ({
                  exerciseId: ex.exerciseId,
                  name: ex.name,
                  sets: ex.sets,
                  reps: ex.reps,
                  durationSeconds: ex.durationSeconds,
                  weight: ex.weight || 0,
                  restSeconds: ex.restSeconds || 60,
                  notes: ex.notes || '',
                  order: ex.order,
                })),
                tags: plan.tags,
              })
            );
            router.push(`/workouts/create?fromTemplate=${templateData}`);
          }}
          onCreatePlan={() => {
            if (view === 'templates') {
              // When in templates view with no templates, go to create page to make a template
              router.push('/workouts/create?template=true');
            } else {
              // Navigate to create page for new plans
              router.push('/workouts/create');
            }
          }}
          loading={loading}
          error={error}
          view={view}
        />
      )}

      {/* Schedule Modal */}
      {showScheduleModal && selectedPlan && (
        <ScheduleModal
          plan={selectedPlan}
          onSchedule={schedulePlan}
          onClose={() => {
            setShowScheduleModal(false);
            setSelectedPlan(null);
          }}
        />
      )}
    </div>
  );
}

// Schedule View Component
function ScheduleView({
  scheduledWorkouts,
  onDeleteScheduledWorkout,
}: {
  scheduledWorkouts: ScheduledWorkout[];
  onDeleteScheduledWorkout: (scheduleId: string, workoutName: string) => void;
}) {
  const today = new Date().toISOString().split('T')[0];
  const upcoming = scheduledWorkouts.filter(
    (w) => w.scheduledDate >= today && w.status === 'scheduled'
  );
  const completed = scheduledWorkouts.filter((w) => w.status === 'completed');

  return (
    <div className="space-y-6">
      {/* Today's Workouts */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Today's Workouts
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {upcoming.filter((w) => w.scheduledDate === today).length === 0 ? (
            <div className="col-span-full bg-gray-50 dark:bg-gray-800 rounded-lg p-8 text-center">
              <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 dark:text-gray-400">
                No workouts scheduled for today
              </p>
            </div>
          ) : (
            upcoming
              .filter((w) => w.scheduledDate === today)
              .map((workout) => (
                <ScheduledWorkoutCard
                  key={workout.id}
                  workout={workout}
                  onDelete={onDeleteScheduledWorkout}
                />
              ))
          )}
        </div>
      </div>

      {/* Upcoming Workouts */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Upcoming Workouts
        </h2>
        <div className="space-y-3">
          {upcoming
            .filter((w) => w.scheduledDate > today)
            .slice(0, 7)
            .map((workout) => (
              <ScheduledWorkoutCard
                key={workout.id}
                workout={workout}
                isCompact
                onDelete={onDeleteScheduledWorkout}
              />
            ))}
        </div>
      </div>
    </div>
  );
}

// Plans Grid Component
function PlansGrid({
  plans,
  onSchedule,
  onStart,
  onUseTemplate,
  onCreatePlan,
  loading,
  error,
  view,
}: {
  plans: WorkoutPlan[];
  onSchedule: (plan: WorkoutPlan) => void;
  onStart: (plan: WorkoutPlan) => void;
  onUseTemplate?: (plan: WorkoutPlan) => void;
  onCreatePlan: () => void;
  loading: boolean;
  error: string | null;
  view: string;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 animate-pulse"
          >
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-3"></div>
            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4"></div>
            <div className="space-y-2">
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
              <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
        <p className="text-red-600 dark:text-red-400">{error}</p>
      </div>
    );
  }

  if (plans.length === 0) {
    return (
      <div className="text-center py-12">
        <Dumbbell className="h-16 w-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-medium text-gray-900 dark:text-white mb-2">
          {view === 'templates'
            ? 'No workout templates found'
            : 'No workout plans yet'}
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          {view === 'templates'
            ? 'Create your first workout template that others can use.'
            : 'Create your first workout plan to start your fitness journey.'}
        </p>
        <button
          onClick={onCreatePlan}
          className="bg-green-600 hover:bg-green-700 text-white px-6 py-3 rounded-lg flex items-center space-x-2 mx-auto"
        >
          <Plus className="h-5 w-5" />
          <span>
            {view === 'templates' ? 'Create Template' : 'Create Plan'}
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {plans.map((plan) => (
        <WorkoutPlanCard
          key={plan.id}
          plan={plan}
          onSchedule={onSchedule}
          onStart={onStart}
          onUseTemplate={onUseTemplate}
          isTemplate={view === 'templates'}
        />
      ))}
    </div>
  );
}

// Workout Plan Card Component
function WorkoutPlanCard({
  plan,
  onSchedule,
  onStart,
  onUseTemplate,
  isTemplate = false,
}: {
  plan: WorkoutPlan;
  onSchedule: (plan: WorkoutPlan) => void;
  onStart: (plan: WorkoutPlan) => void;
  onUseTemplate?: (plan: WorkoutPlan) => void;
  isTemplate?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-lg transition-shadow">
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {plan.name}
              </h3>
              {isTemplate && (
                <span className="px-2 py-1 bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded-full text-xs font-medium">
                  Template
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {plan.description || 'No description provided'}
            </p>
          </div>
          {plan.rating && plan.rating > 0 && (
            <div className="flex items-center space-x-1">
              <Star className="h-4 w-4 text-yellow-400 fill-current" />
              <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
                {plan.rating.toFixed(1)}
              </span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Calendar className="h-4 w-4 mr-2" />
            {plan.durationWeeks} weeks
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Clock className="h-4 w-4 mr-2" />
            {plan.frequencyPerWeek}x/week
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Target className="h-4 w-4 mr-2" />
            <span
              className={`px-2 py-1 rounded-full text-xs font-medium capitalize ${
                plan.difficulty === 'beginner'
                  ? 'bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200'
                  : plan.difficulty === 'intermediate'
                    ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200'
                    : 'bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200'
              }`}
            >
              {plan.difficulty}
            </span>
          </div>
          <div className="flex items-center text-sm text-gray-600 dark:text-gray-400">
            <Dumbbell className="h-4 w-4 mr-2" />
            {plan.exercises.length} exercises
          </div>
        </div>

        {plan.tags && plan.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-4">
            {plan.tags.slice(0, 3).map((tag, index) => (
              <span
                key={index}
                className="px-2 py-1 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex space-x-2">
          {isTemplate && onUseTemplate ? (
            <>
              <button
                onClick={() => onUseTemplate(plan)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Plus className="h-4 w-4" />
                <span>Use Template</span>
              </button>
              <button
                onClick={() => onStart(plan)}
                className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>Start Session</span>
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => onStart(plan)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Play className="h-4 w-4" />
                <span>Start Now</span>
              </button>
              <button
                onClick={() => onSchedule(plan)}
                className="px-4 py-2 text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20 flex items-center space-x-2"
              >
                <Calendar className="h-4 w-4" />
                <span>Schedule</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Scheduled Workout Card Component
function ScheduledWorkoutCard({
  workout,
  isCompact = false,
  onDelete,
}: {
  workout: ScheduledWorkout;
  isCompact?: boolean;
  onDelete?: (scheduleId: string, workoutName: string) => void;
}) {
  const router = useRouter();

  if (isCompact) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {workout.planName}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {new Date(workout.scheduledDate).toLocaleDateString()} at{' '}
              {workout.scheduledTime}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() =>
              router.push(
                `/workouts/sessions/create?planId=${workout.planId}&week=${workout.week}&day=${workout.day}`
              )
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Play className="h-4 w-4" />
            <span>Start</span>
          </button>
          {onDelete && (
            <button
              onClick={() => onDelete(workout.id, workout.planName)}
              className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
              title="Delete scheduled workout"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gradient-to-r from-blue-50 to-blue-100 dark:from-blue-900/20 dark:to-blue-800/20 rounded-lg border border-blue-200 dark:border-blue-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="font-semibold text-blue-900 dark:text-blue-100">
            {workout.planName}
          </h3>
          <p className="text-sm text-blue-700 dark:text-blue-300 mt-1">
            Week {workout.week}, Day {workout.day} • {workout.scheduledTime}
          </p>
        </div>
        <span
          className={`px-2 py-1 rounded-full text-xs font-medium ${
            workout.status === 'scheduled'
              ? 'bg-blue-200 dark:bg-blue-800 text-blue-800 dark:text-blue-200'
              : workout.status === 'completed'
                ? 'bg-green-200 dark:bg-green-800 text-green-800 dark:text-green-200'
                : 'bg-yellow-200 dark:bg-yellow-800 text-yellow-800 dark:text-yellow-200'
          }`}
        >
          {workout.status}
        </span>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() =>
            router.push(
              `/workouts/sessions/create?planId=${workout.planId}&week=${workout.week}&day=${workout.day}`
            )
          }
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
        >
          <Play className="h-4 w-4" />
          <span>Start Workout</span>
        </button>
        {onDelete && (
          <button
            onClick={() => onDelete(workout.id, workout.planName)}
            className="px-4 py-2 text-red-600 border border-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center space-x-2 transition-colors"
            title="Delete scheduled workout"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}

// Schedule Modal Component
function ScheduleModal({
  plan,
  onSchedule,
  onClose,
}: {
  plan: WorkoutPlan;
  onSchedule: (plan: WorkoutPlan, startDate: string, times: string[]) => void;
  onClose: () => void;
}) {
  const [startDate, setStartDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [workoutTimes, setWorkoutTimes] = useState<string[]>(['09:00']);

  const addTimeSlot = () => {
    if (workoutTimes.length < plan.frequencyPerWeek) {
      setWorkoutTimes([...workoutTimes, '09:00']);
    }
  };

  const removeTimeSlot = (index: number) => {
    setWorkoutTimes(workoutTimes.filter((_, i) => i !== index));
  };

  const updateTimeSlot = (index: number, time: string) => {
    const newTimes = [...workoutTimes];
    newTimes[index] = time;
    setWorkoutTimes(newTimes);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Schedule Workout Plan
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                {plan.name}
              </p>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <svg
                className="h-6 w-6"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Start Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Workout Times ({plan.frequencyPerWeek}x per week)
                </label>
                {workoutTimes.length < plan.frequencyPerWeek && (
                  <button
                    onClick={addTimeSlot}
                    className="text-blue-600 hover:text-blue-700 text-sm font-medium"
                  >
                    + Add Time
                  </button>
                )}
              </div>
              <div className="space-y-2">
                {workoutTimes.map((time, index) => (
                  <div key={index} className="flex items-center space-x-2">
                    <input
                      type="time"
                      value={time}
                      onChange={(e) => updateTimeSlot(index, e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {workoutTimes.length > 1 && (
                      <button
                        onClick={() => removeTimeSlot(index)}
                        className="text-red-600 hover:text-red-700 p-1"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
                Schedule Summary
              </h4>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
                <p>Duration: {plan.durationWeeks} weeks</p>
                <p>Frequency: {plan.frequencyPerWeek} workouts per week</p>
                <p>
                  Total workouts: {plan.durationWeeks * plan.frequencyPerWeek}
                </p>
                <p>
                  End date:{' '}
                  {new Date(
                    new Date(startDate).getTime() +
                      plan.durationWeeks * 7 * 24 * 60 * 60 * 1000
                  ).toLocaleDateString()}
                </p>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={() => onSchedule(plan, startDate, workoutTimes)}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Schedule Plan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
