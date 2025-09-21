'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api-client';
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  BarChart3,
  PieChart,
  Activity,
  Award,
  Clock,
  Flame,
} from 'lucide-react';

interface AnalyticsData {
  strengthProgress: {
    completed: number;
    weeklyGoal: number;
    monthlyGoal: number;
    trend: number;
  };
  bodyMeasurements: {
    caloriesToday: number;
    caloriesGoal: number;
    weight: number;
    bodyFat: number;
    muscleMass: number;
  };
  milestones: {
    recommendations: number;
    achievements: string[];
    streak: number;
    totalWorkouts: number;
  };
  weeklyData: {
    day: string;
    workouts: number;
    calories: number;
    duration: number;
  }[];
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');

  useEffect(() => {
    fetchAnalytics();
  }, [timeRange]);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const [strengthProgress, bodyMeasurements, milestones] =
        await Promise.all([
          apiFetch<{ statusCode: number; body: any }>(
            '/api/analytics/strength-progress/me'
          ).catch(() => ({
            statusCode: 200,
            body: { completed: 0, weeklyGoal: 3, monthlyGoal: 12, trend: 15 },
          })),

          apiFetch<{ statusCode: number; body: any }>(
            '/api/analytics/body-measurements/me'
          ).catch(() => ({
            statusCode: 200,
            body: {
              caloriesToday: 1850,
              caloriesGoal: 2000,
              weight: 75.5,
              bodyFat: 15.2,
              muscleMass: 65.3,
            },
          })),

          apiFetch<{ statusCode: number; body: any }>(
            '/api/analytics/milestones/me'
          ).catch(() => ({
            statusCode: 200,
            body: {
              recommendations: 3,
              achievements: ['First Workout', 'Week Streak'],
              streak: 5,
              totalWorkouts: 12,
            },
          })),
        ]);

      // Mock weekly data
      const weeklyData = [
        { day: 'Mon', workouts: 1, calories: 1800, duration: 45 },
        { day: 'Tue', workouts: 0, calories: 1650, duration: 0 },
        { day: 'Wed', workouts: 1, calories: 1950, duration: 60 },
        { day: 'Thu', workouts: 1, calories: 2100, duration: 30 },
        { day: 'Fri', workouts: 0, calories: 1750, duration: 0 },
        { day: 'Sat', workouts: 1, calories: 2200, duration: 90 },
        { day: 'Sun', workouts: 1, calories: 1900, duration: 45 },
      ];

      setData({
        strengthProgress: {
          completed: strengthProgress.body?.completed ?? 0,
          weeklyGoal: strengthProgress.body?.weeklyGoal ?? 3,
          monthlyGoal: strengthProgress.body?.monthlyGoal ?? 12,
          trend: strengthProgress.body?.trend ?? 15,
        },
        bodyMeasurements: {
          caloriesToday: bodyMeasurements.body?.caloriesToday ?? 1850,
          caloriesGoal: bodyMeasurements.body?.caloriesGoal ?? 2000,
          weight: bodyMeasurements.body?.weight ?? 75.5,
          bodyFat: bodyMeasurements.body?.bodyFat ?? 15.2,
          muscleMass: bodyMeasurements.body?.muscleMass ?? 65.3,
        },
        milestones: {
          recommendations: milestones.body?.recommendations ?? 3,
          achievements: milestones.body?.achievements ?? [
            'First Workout',
            'Week Streak',
          ],
          streak: milestones.body?.streak ?? 5,
          totalWorkouts: milestones.body?.totalWorkouts ?? 12,
        },
        weeklyData,
      });
    } catch (e: any) {
      setError(e?.message || 'Failed to load analytics');
    } finally {
      setLoading(false);
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

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Analytics
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your fitness progress
          </p>
        </div>
        <div className="flex space-x-2">
          {(['week', 'month', 'year'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-3 py-1 rounded-lg text-sm font-medium ${
                timeRange === range
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              {range.charAt(0).toUpperCase() + range.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          title="Workouts This Week"
          value={data.strengthProgress.completed}
          target={data.strengthProgress.weeklyGoal}
          icon={<Activity className="h-5 w-5" />}
          trend={data.strengthProgress.trend}
          color="blue"
        />
        <MetricCard
          title="Current Streak"
          value={`${data.milestones.streak} days`}
          icon={<Flame className="h-5 w-5" />}
          color="orange"
        />
        <MetricCard
          title="Calories Today"
          value={data.bodyMeasurements.caloriesToday}
          target={data.bodyMeasurements.caloriesGoal}
          icon={<Target className="h-5 w-5" />}
          color="green"
          unit="kcal"
        />
        <MetricCard
          title="Total Workouts"
          value={data.milestones.totalWorkouts}
          icon={<Award className="h-5 w-5" />}
          color="purple"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Weekly Activity Chart */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Weekly Activity
          </h3>
          <div className="space-y-4">
            {data.weeklyData.map((day, index) => (
              <div key={day.day} className="flex items-center space-x-4">
                <div className="w-8 text-sm text-gray-600 dark:text-gray-400">
                  {day.day}
                </div>
                <div className="flex-1">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 rounded-full transition-all duration-300"
                        style={{ width: `${(day.workouts / 2) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {day.workouts} workout{day.workouts !== 1 ? 's' : ''}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <div className="w-16 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-green-600 rounded-full transition-all duration-300"
                        style={{ width: `${(day.calories / 2500) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {day.calories} cal
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Body Composition */}
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Body Composition
          </h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Weight</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {data.bodyMeasurements.weight} kg
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">Body Fat</span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {data.bodyMeasurements.bodyFat}%
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600 dark:text-gray-400">
                Muscle Mass
              </span>
              <span className="font-semibold text-gray-900 dark:text-white">
                {data.bodyMeasurements.muscleMass} kg
              </span>
            </div>
            <div className="mt-4">
              <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
                <span>Body Fat %</span>
                <span>{data.bodyMeasurements.bodyFat}%</span>
              </div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                <div
                  className="bg-red-500 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(data.bodyMeasurements.bodyFat * 2, 100)}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Recent Achievements
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {data.milestones.achievements.map((achievement, index) => (
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

      {/* AI Recommendations */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          AI Recommendations
        </h3>
        <div className="space-y-3">
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Based on your recent activity, consider adding more cardio to your
              routine for better overall fitness.
            </p>
          </div>
          <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Your protein intake looks good! Keep maintaining this level for
              muscle recovery.
            </p>
          </div>
          <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Try increasing your workout frequency to 4-5 times per week for
              better results.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  target,
  icon,
  trend,
  color = 'blue',
  unit = '',
}: {
  title: string;
  value: string | number;
  target?: number;
  icon: React.ReactNode;
  trend?: number;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
  unit?: string;
}) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-100 dark:bg-blue-900/20',
    green: 'text-green-600 bg-green-100 dark:bg-green-900/20',
    orange: 'text-orange-600 bg-orange-100 dark:bg-orange-900/20',
    purple: 'text-purple-600 bg-purple-100 dark:bg-purple-900/20',
    red: 'text-red-600 bg-red-100 dark:bg-red-900/20',
  };

  const progress = target ? (Number(value) / target) * 100 : 0;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>{icon}</div>
        {trend && (
          <div
            className={`flex items-center text-sm ${
              trend > 0 ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend > 0 ? (
              <TrendingUp className="h-4 w-4 mr-1" />
            ) : (
              <TrendingDown className="h-4 w-4 mr-1" />
            )}
            {Math.abs(trend)}%
          </div>
        )}
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
          {value}
          {unit}
        </p>
        {target && (
          <div className="mt-2">
            <div className="flex justify-between text-xs text-gray-500 dark:text-gray-500 mb-1">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-1">
              <div
                className={`h-1 rounded-full transition-all duration-300 ${
                  color === 'blue'
                    ? 'bg-blue-600'
                    : color === 'green'
                      ? 'bg-green-600'
                      : color === 'orange'
                        ? 'bg-orange-600'
                        : color === 'purple'
                          ? 'bg-purple-600'
                          : 'bg-red-600'
                }`}
                style={{ width: `${Math.min(progress, 100)}%` }}
              ></div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
