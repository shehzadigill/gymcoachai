'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  CalendarDays,
  Target,
  Flame,
  Brain,
  TrendingUp,
  Activity,
  Award,
  Clock,
  Dumbbell,
  Heart,
} from 'lucide-react';

interface DashboardData {
  workoutsCompleted: number;
  activePlan: string;
  caloriesToday: number;
  aiRecommendations: number;
  currentStreak: number;
  totalWorkoutTime: number;
  lastWorkoutDate: string | null;
  weeklyProgress: number;
  monthlyGoal: number;
  achievements: string[];
}

export default function DashboardPage() {
  const me = useCurrentUser();
  const userLoading = me.isLoading;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLive, setIsLive] = useState(false);

  // Activity logging form state
  const [logSubmitting, setLogSubmitting] = useState(false);
  const [logError, setLogError] = useState<string | null>(null);
  const [logSuccess, setLogSuccess] = useState<string | null>(null);
  const [activity, setActivity] = useState({
    date: new Date().toISOString().slice(0, 10),
    exercise: '',
    sets: 3,
    reps: 10,
    weight: 0,
    notes: '',
  });

  const fetchDashboardData = useMemo(
    () => async () => {
      try {
        setLoading(true);
        setError(null);

        const [workouts, profile, nutrition, ai, milestones] =
          await Promise.all([
            api
              .getStrengthProgress()
              .catch(() => ({ statusCode: 200, body: { completed: 0 } })),

            api.getUserProfile().catch(() => ({
              statusCode: 200,
              body: { activePlan: 'No active plan' },
            })),

            api
              .getBodyMeasurements()
              .catch(() => ({ statusCode: 200, body: { caloriesToday: 0 } })),

            api
              .getMilestones()
              .catch(() => ({ statusCode: 200, body: { recommendations: 0 } })),

            api
              .getAchievements()
              .catch(() => ({ statusCode: 200, body: { achievements: [] } })),
          ]);

        setData({
          workoutsCompleted: workouts.body?.completed ?? 0,
          activePlan: profile.body?.activePlan ?? 'No active plan',
          caloriesToday: nutrition.body?.caloriesToday ?? 0,
          aiRecommendations: ai.body?.recommendations ?? 0,
          currentStreak: profile.body?.currentStreak ?? 0,
          totalWorkoutTime: profile.body?.totalWorkoutTime ?? 0,
          lastWorkoutDate: profile.body?.lastWorkoutDate ?? null,
          weeklyProgress: 75,
          monthlyGoal: 20,
          achievements: milestones.body?.achievements ?? [],
        });
      } catch (e: any) {
        console.error('Dashboard error:', e);
        setError(e?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    if (userLoading) return;
    fetchDashboardData();

    // Simple polling for "real-time" updates
    setIsLive(true);
    const id = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(id);
  }, [userLoading, fetchDashboardData]);

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="flex items-center">
          <div className="text-red-600 dark:text-red-400">
            <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
              Error loading dashboard
            </h3>
            <p className="text-sm text-red-700 dark:text-red-300 mt-1">
              {error}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Welcome Section */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 text-white">
        <h1 className="text-2xl font-bold mb-2">
          Welcome back, {me?.name || 'User'}!
        </h1>
        <p className="text-blue-100 flex items-center gap-2">
          Ready to crush your fitness goals today?
          {isLive && (
            <span className="inline-flex items-center gap-1 text-xs bg-white/20 px-2 py-0.5 rounded">
              <span className="h-2 w-2 bg-green-300 rounded-full animate-pulse" />
              Live
            </span>
          )}
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 grid-cols-1 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="Workouts Completed"
          value={data?.workoutsCompleted ?? 0}
          icon={<Dumbbell className="h-5 w-5" />}
          trend="+12% this week"
          color="blue"
        />
        <StatCard
          title="Current Streak"
          value={`${data?.currentStreak ?? 0} days`}
          icon={<Flame className="h-5 w-5" />}
          trend="Keep it up!"
          color="orange"
        />
        <StatCard
          title="Calories Today"
          value={`${data?.caloriesToday ?? 0} kcal`}
          icon={<Target className="h-5 w-5" />}
          trend="Goal: 2000 kcal"
          color="green"
        />
        <StatCard
          title="AI Recommendations"
          value={data?.aiRecommendations ?? 0}
          icon={<Brain className="h-5 w-5" />}
          trend="New insights available"
          color="purple"
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
        {/* Progress Overview */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Weekly Progress
              </h2>
              <TrendingUp className="h-5 w-5 text-green-500" />
            </div>
            <div className="space-y-4">
              <div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span>Workouts this week</span>
                  <span>
                    {data?.workoutsCompleted ?? 0} / {data?.monthlyGoal ?? 20}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(((data?.workoutsCompleted ?? 0) / (data?.monthlyGoal ?? 20)) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-1">
                  <span>Total workout time</span>
                  <span>{data?.totalWorkoutTime ?? 0} min</span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-green-600 h-2 rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.min(((data?.totalWorkoutTime ?? 0) / 300) * 100, 100)}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Quick Actions
            </h3>
            <div className="space-y-3">
              <button className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-colors">
                Start Workout
              </button>
              <button className="w-full bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-colors">
                Log Nutrition
              </button>
              <button className="w-full bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors">
                View Analytics
              </button>
            </div>
          </div>

          {/* Log Activity Form */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Log Activity
            </h3>
            {logError && (
              <div className="mb-3 text-sm text-red-600 dark:text-red-400">
                {logError}
              </div>
            )}
            {logSuccess && (
              <div className="mb-3 text-sm text-green-600 dark:text-green-400">
                {logSuccess}
              </div>
            )}
            <form
              className="space-y-3"
              onSubmit={async (e) => {
                e.preventDefault();
                try {
                  setLogSubmitting(true);
                  setLogError(null);
                  setLogSuccess(null);
                  // Transform the activity data to match backend expectations
                  const activityData = {
                    activityType: activity.exercise,
                    duration: 30, // Default duration in minutes
                    caloriesBurned: Math.round(
                      activity.sets * activity.reps * activity.weight * 0.1
                    ), // Rough calculation
                    notes: activity.notes,
                    sets: activity.sets,
                    reps: activity.reps,
                    weight: activity.weight,
                  };
                  await api.logActivity(activityData);
                  setLogSuccess('Activity logged successfully');
                  fetchDashboardData();
                } catch (err: any) {
                  setLogError(err?.message || 'Failed to log activity');
                } finally {
                  setLogSubmitting(false);
                }
              }}
            >
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Date
                  </label>
                  <input
                    type="date"
                    value={activity.date}
                    onChange={(e) =>
                      setActivity({ ...activity, date: e.target.value })
                    }
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Exercise
                  </label>
                  <input
                    type="text"
                    value={activity.exercise}
                    onChange={(e) =>
                      setActivity({ ...activity, exercise: e.target.value })
                    }
                    placeholder="Bench Press"
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Sets
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={activity.sets}
                    onChange={(e) =>
                      setActivity({ ...activity, sets: Number(e.target.value) })
                    }
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Reps
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={activity.reps}
                    onChange={(e) =>
                      setActivity({ ...activity, reps: Number(e.target.value) })
                    }
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Weight (kg)
                  </label>
                  <input
                    type="number"
                    min={0}
                    step="0.5"
                    value={activity.weight}
                    onChange={(e) =>
                      setActivity({
                        ...activity,
                        weight: Number(e.target.value),
                      })
                    }
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-700 dark:text-gray-300 mb-1">
                    Notes
                  </label>
                  <input
                    type="text"
                    value={activity.notes}
                    onChange={(e) =>
                      setActivity({ ...activity, notes: e.target.value })
                    }
                    placeholder="Felt strong today"
                    className="w-full rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2"
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={logSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white px-4 py-2 rounded-lg transition-colors"
              >
                {logSubmitting ? 'Saving...' : 'Save Activity'}
              </button>
            </form>
          </div>

          {/* Recent Activity */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Recent Activity
            </h3>
            <div className="space-y-3">
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Completed chest workout
                </span>
                <span className="text-xs text-gray-500 ml-auto">2h ago</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Logged 1,850 calories
                </span>
                <span className="text-xs text-gray-500 ml-auto">4h ago</span>
              </div>
              <div className="flex items-center space-x-3">
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  New AI recommendation
                </span>
                <span className="text-xs text-gray-500 ml-auto">1d ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      {data?.achievements && data.achievements.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
            <Award className="h-5 w-5 mr-2 text-yellow-500" />
            Recent Achievements
          </h2>
          <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
            {data.achievements.map((achievement, index) => (
              <div
                key={index}
                className="flex items-center space-x-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg"
              >
                <Award className="h-5 w-5 text-yellow-500" />
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {achievement}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
  color = 'blue',
}: {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend: string;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
}) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
    green: 'text-green-600 bg-green-100 dark:bg-green-900/20',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
    red: 'text-red-600 bg-red-100 dark:bg-red-900/20',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
            {title}
          </p>
          <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
            {value}
          </p>
          <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
            {trend}
          </p>
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>{icon}</div>
      </div>
    </div>
  );
}
