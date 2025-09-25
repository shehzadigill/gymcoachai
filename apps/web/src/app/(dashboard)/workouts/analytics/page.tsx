'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  TrendingUp,
  Calendar,
  Clock,
  Target,
  Dumbbell,
  Award,
  Activity,
  BarChart3,
} from 'lucide-react';

interface WorkoutAnalytics {
  total_workouts: number;
  total_duration_minutes: number;
  current_streak: number;
  longest_streak: number;
  favorite_exercises: string[];
  average_workout_duration: number;
  workouts_this_week: number;
  workouts_this_month: number;
  last_workout_date?: string;
  strength_progress: StrengthProgress[];
  body_measurements: BodyMeasurement[];
}

interface StrengthProgress {
  exercise_id: string;
  exercise_name: string;
  one_rep_max: number;
  last_updated: string;
  progress_percentage: number;
}

interface BodyMeasurement {
  measurement_type: string;
  value: number;
  unit: string;
  measured_at: string;
}

export default function WorkoutAnalyticsPage() {
  const user = useCurrentUser();
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getWorkoutAnalytics();
      if (response) {
        // Use the response which contains the actual data
        const data = response;
        const transformedAnalytics: WorkoutAnalytics = {
          total_workouts: data.total_workouts || data.TotalWorkouts || 0,
          total_duration_minutes:
            data.total_duration_minutes || data.TotalDurationMinutes || 0,
          current_streak: data.current_streak || data.CurrentStreak || 0,
          longest_streak: data.longest_streak || data.LongestStreak || 0,
          favorite_exercises:
            data.favorite_exercises || data.FavoriteExercises || [],
          average_workout_duration:
            data.average_workout_duration || data.AverageWorkoutDuration || 0,
          workouts_this_week:
            data.workouts_this_week || data.WorkoutsThisWeek || 0,
          workouts_this_month:
            data.workouts_this_month || data.WorkoutsThisMonth || 0,
          last_workout_date: data.last_workout_date || data.LastWorkoutDate,
          strength_progress:
            data.strength_progress || data.StrengthProgress || [],
          body_measurements:
            data.body_measurements || data.BodyMeasurements || [],
        };
        setAnalytics(transformedAnalytics);
      } else {
        setError('No analytics data available');
        setAnalytics({
          total_workouts: 0,
          total_duration_minutes: 0,
          current_streak: 0,
          longest_streak: 0,
          favorite_exercises: [],
          average_workout_duration: 0,
          workouts_this_week: 0,
          workouts_this_month: 0,
          last_workout_date: undefined,
          strength_progress: [],
          body_measurements: [],
        });
      }
    } catch (e: any) {
      console.error('Failed to fetch analytics:', e);
      setError(e.message || 'Failed to fetch analytics');
      setAnalytics({
        total_workouts: 0,
        total_duration_minutes: 0,
        current_streak: 0,
        longest_streak: 0,
        favorite_exercises: [],
        average_workout_duration: 0,
        workouts_this_week: 0,
        workouts_this_month: 0,
        last_workout_date: undefined,
        strength_progress: [],
        body_measurements: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getProgressColor = (percentage: number) => {
    if (percentage > 10) return 'text-green-600';
    if (percentage > 5) return 'text-yellow-600';
    return 'text-red-600';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">
          {error || 'No analytics data available'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Workout Analytics
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Track your fitness progress and achievements
        </p>
      </div>

      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Workouts
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.total_workouts}
              </p>
            </div>
            <Dumbbell className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total Time
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {Math.round(analytics.total_duration_minutes / 60)}h
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                {analytics.total_duration_minutes} minutes
              </p>
            </div>
            <Clock className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Current Streak
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.current_streak}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                days in a row
              </p>
            </div>
            <Activity className="h-8 w-8 text-orange-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Longest Streak
              </p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {analytics.longest_streak}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-500">
                personal best
              </p>
            </div>
            <Award className="h-8 w-8 text-purple-600" />
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Recent Activity
          </h2>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  This Week
                </span>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {analytics.workouts_this_week} workouts
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  This Month
                </span>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {analytics.workouts_this_month} workouts
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="h-5 w-5 text-gray-400 mr-2" />
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  Avg Duration
                </span>
              </div>
              <span className="text-lg font-semibold text-gray-900 dark:text-white">
                {Math.round(analytics.average_workout_duration)}m
              </span>
            </div>
            {analytics.last_workout_date && (
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <Target className="h-5 w-5 text-gray-400 mr-2" />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    Last Workout
                  </span>
                </div>
                <span className="text-lg font-semibold text-gray-900 dark:text-white">
                  {formatDate(analytics.last_workout_date)}
                </span>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Favorite Exercises
          </h2>
          <div className="space-y-3">
            {analytics.favorite_exercises.slice(0, 5).map((exercise, index) => (
              <div key={index} className="flex items-center">
                <div className="flex items-center justify-center w-8 h-8 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-full mr-3 text-sm font-medium">
                  {index + 1}
                </div>
                <span className="text-gray-900 dark:text-white">
                  {exercise}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Strength Progress */}
      {analytics.strength_progress.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Strength Progress
            </h2>
            <TrendingUp className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {analytics.strength_progress.map((exercise, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4"
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2">
                  {exercise.exercise_name}
                </h3>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-2xl font-bold text-gray-900 dark:text-white">
                      {exercise.one_rep_max}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      1RM (lbs)
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-medium ${getProgressColor(exercise.progress_percentage)}`}
                    >
                      +{exercise.progress_percentage.toFixed(1)}%
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-500">
                      vs last month
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Body Measurements */}
      {analytics.body_measurements.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Body Measurements
            </h2>
            <BarChart3 className="h-5 w-5 text-gray-400" />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {analytics.body_measurements.map((measurement, index) => (
              <div
                key={index}
                className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 text-center"
              >
                <h3 className="font-medium text-gray-900 dark:text-white mb-2 capitalize">
                  {measurement.measurement_type.replace('_', ' ')}
                </h3>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {measurement.value}
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-500 ml-1">
                    {measurement.unit}
                  </span>
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                  Last updated: {formatDate(measurement.measured_at)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
