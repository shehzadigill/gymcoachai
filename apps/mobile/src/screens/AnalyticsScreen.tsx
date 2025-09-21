import React, { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { useApi } from '../hooks/useApi';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

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

export function AnalyticsScreen() {
  const [timeRange, setTimeRange] = useState<'week' | 'month' | 'year'>('week');
  const [refreshing, setRefreshing] = useState(false);

  const { data: strengthProgress, loading: strengthLoading, error: strengthError, refetch: refetchStrength } = useApi<{ statusCode: number; body: any }>('/api/analytics/strength-progress/me');
  const { data: bodyMeasurements, loading: bodyLoading, error: bodyError, refetch: refetchBody } = useApi<{ statusCode: number; body: any }>('/api/analytics/body-measurements/me');
  const { data: milestones, loading: milestonesLoading, error: milestonesError, refetch: refetchMilestones } = useApi<{ statusCode: number; body: any }>('/api/analytics/milestones/me');

  const loading = strengthLoading || bodyLoading || milestonesLoading;
  const error = strengthError || bodyError || milestonesError;

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

  const analyticsData: AnalyticsData = {
    strengthProgress: {
      completed: strengthProgress?.body?.completed ?? 0,
      weeklyGoal: strengthProgress?.body?.weeklyGoal ?? 3,
      monthlyGoal: strengthProgress?.body?.monthlyGoal ?? 12,
      trend: strengthProgress?.body?.trend ?? 15,
    },
    bodyMeasurements: {
      caloriesToday: bodyMeasurements?.body?.caloriesToday ?? 1850,
      caloriesGoal: bodyMeasurements?.body?.caloriesGoal ?? 2000,
      weight: bodyMeasurements?.body?.weight ?? 75.5,
      bodyFat: bodyMeasurements?.body?.bodyFat ?? 15.2,
      muscleMass: bodyMeasurements?.body?.muscleMass ?? 65.3,
    },
    milestones: {
      recommendations: milestones?.body?.recommendations ?? 3,
      achievements: milestones?.body?.achievements ?? ['First Workout', 'Week Streak'],
      streak: milestones?.body?.streak ?? 5,
      totalWorkouts: milestones?.body?.totalWorkouts ?? 12,
    },
    weeklyData,
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([refetchStrength(), refetchBody(), refetchMilestones()]);
    setRefreshing(false);
  };

  if (loading) {
    return <LoadingSpinner message="Loading analytics..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={onRefresh} />;
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Analytics</Text>
            <Text className="text-gray-600">Track your fitness progress</Text>
          </View>
          <View className="flex-row space-x-2">
            {(['week', 'month', 'year'] as const).map((range) => (
              <TouchableOpacity
                key={range}
                onPress={() => setTimeRange(range)}
                className={`px-3 py-1 rounded-lg text-sm font-medium ${
                  timeRange === range
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <Text className={`text-sm font-medium ${
                  timeRange === range ? 'text-white' : 'text-gray-700'
                }`}>
                  {range.charAt(0).toUpperCase() + range.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Key Metrics */}
        <View className="flex-row flex-wrap -mx-2 mb-6">
          <View className="w-1/2 px-2">
            <StatCard
              title="Workouts This Week"
              value={analyticsData.strengthProgress.completed}
              icon={<Text className="text-lg">💪</Text>}
              trend={`${analyticsData.strengthProgress.trend}%`}
              color="blue"
            />
          </View>
          <View className="w-1/2 px-2">
            <StatCard
              title="Current Streak"
              value={`${analyticsData.milestones.streak} days`}
              icon={<Text className="text-lg">🔥</Text>}
              color="orange"
            />
          </View>
          <View className="w-1/2 px-2">
            <StatCard
              title="Calories Today"
              value={analyticsData.bodyMeasurements.caloriesToday}
              icon={<Text className="text-lg">🎯</Text>}
              trend={`Goal: ${analyticsData.bodyMeasurements.caloriesGoal} kcal`}
              color="green"
            />
          </View>
          <View className="w-1/2 px-2">
            <StatCard
              title="Total Workouts"
              value={analyticsData.milestones.totalWorkouts}
              icon={<Text className="text-lg">🏆</Text>}
              color="purple"
            />
          </View>
        </View>

        {/* Weekly Activity Chart */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Weekly Activity
          </Text>
          <View className="space-y-4">
            {analyticsData.weeklyData.map((day, index) => (
              <View key={day.day} className="flex-row items-center space-x-4">
                <View className="w-8">
                  <Text className="text-sm text-gray-600">{day.day}</Text>
                </View>
                <View className="flex-1">
                  <View className="flex-row items-center space-x-2 mb-1">
                    <View className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View 
                        className="h-full bg-blue-600 rounded-full"
                        style={{ width: `${(day.workouts / 2) * 100}%` }}
                      />
                    </View>
                    <Text className="text-sm text-gray-600">
                      {day.workouts} workout{day.workouts !== 1 ? 's' : ''}
                    </Text>
                  </View>
                  <View className="flex-row items-center space-x-2">
                    <View className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <View 
                        className="h-full bg-green-600 rounded-full"
                        style={{ width: `${(day.calories / 2500) * 100}%` }}
                      />
                    </View>
                    <Text className="text-sm text-gray-600">
                      {day.calories} cal
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Body Composition */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Body Composition
          </Text>
          <View className="space-y-4">
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-600">Weight</Text>
              <Text className="font-semibold text-gray-900">
                {analyticsData.bodyMeasurements.weight} kg
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-600">Body Fat</Text>
              <Text className="font-semibold text-gray-900">
                {analyticsData.bodyMeasurements.bodyFat}%
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-gray-600">Muscle Mass</Text>
              <Text className="font-semibold text-gray-900">
                {analyticsData.bodyMeasurements.muscleMass} kg
              </Text>
            </View>
            <View className="mt-4">
              <View className="flex-row justify-between text-sm text-gray-600 mb-2">
                <Text className="text-sm text-gray-600">Body Fat %</Text>
                <Text className="text-sm text-gray-600">{analyticsData.bodyMeasurements.bodyFat}%</Text>
              </View>
              <View className="w-full bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-red-500 h-2 rounded-full"
                  style={{ width: `${Math.min(analyticsData.bodyMeasurements.bodyFat * 2, 100)}%` }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Achievements */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Recent Achievements
          </Text>
          <View className="flex-row flex-wrap">
            {analyticsData.milestones.achievements.map((achievement, index) => (
              <View key={index} className="flex-row items-center space-x-3 p-3 bg-yellow-50 rounded-lg mr-2 mb-2">
                <Text className="text-lg">🏆</Text>
                <Text className="text-sm font-medium text-gray-900">
                  {achievement}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {/* AI Recommendations */}
        <View className="bg-white rounded-lg border border-gray-200 p-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            AI Recommendations
          </Text>
          <View className="space-y-3">
            <View className="p-4 bg-blue-50 rounded-lg">
              <Text className="text-sm text-gray-700">
                Based on your recent activity, consider adding more cardio to your routine for better overall fitness.
              </Text>
            </View>
            <View className="p-4 bg-green-50 rounded-lg">
              <Text className="text-sm text-gray-700">
                Your protein intake looks good! Keep maintaining this level for muscle recovery.
              </Text>
            </View>
            <View className="p-4 bg-purple-50 rounded-lg">
              <Text className="text-sm text-gray-700">
                Try increasing your workout frequency to 4-5 times per week for better results.
              </Text>
            </View>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
