import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl } from 'react-native';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { useApi } from '../hooks/useApi';
import { StatCard } from '../components/StatCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

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

export function DashboardScreen() {
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser({ ...currentUser, attributes });
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const { data: workoutsData, loading: workoutsLoading, error: workoutsError } = useApi<{ statusCode: number; body: { completed: number } }>('/api/analytics/strength-progress/me');
  const { data: profileData, loading: profileLoading, error: profileError } = useApi<{ statusCode: number; body: any }>('/api/user-profiles/profile');
  const { data: nutritionData, loading: nutritionLoading, error: nutritionError } = useApi<{ statusCode: number; body: { caloriesToday: number } }>('/api/analytics/body-measurements/me');
  const { data: aiData, loading: aiLoading, error: aiError } = useApi<{ statusCode: number; body: { recommendations: number } }>('/api/analytics/milestones/me');
  const { data: achievementsData, loading: achievementsLoading, error: achievementsError } = useApi<{ statusCode: number; body: { achievements: string[] } }>('/api/analytics/achievements/me');

  const loading = workoutsLoading || profileLoading || nutritionLoading || aiLoading || achievementsLoading;
  const error = workoutsError || profileError || nutritionError || aiError || achievementsError;

  const dashboardData: DashboardData = {
    workoutsCompleted: workoutsData?.body?.completed ?? 0,
    activePlan: profileData?.body?.activePlan ?? 'No active plan',
    caloriesToday: nutritionData?.body?.caloriesToday ?? 0,
    aiRecommendations: aiData?.body?.recommendations ?? 0,
    currentStreak: profileData?.body?.currentStreak ?? 0,
    totalWorkoutTime: profileData?.body?.totalWorkoutTime ?? 0,
    lastWorkoutDate: profileData?.body?.lastWorkoutDate ?? null,
    weeklyProgress: 75, // Mock data
    monthlyGoal: 20, // Mock data
    achievements: achievementsData?.body?.achievements ?? []
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUser();
    setRefreshing(false);
  };

  if (loading) {
    return <LoadingSpinner message="Loading dashboard..." />;
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
        {/* Welcome Section */}
        <View className="bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg p-6 mb-6">
          <Text className="text-2xl font-bold text-white mb-2">
            Welcome back, {user?.attributes?.given_name || 'User'}!
          </Text>
          <Text className="text-blue-100">
            Ready to crush your fitness goals today?
          </Text>
        </View>

        {/* Stats Grid */}
        <View className="flex-row flex-wrap -mx-2 mb-6">
          <View className="w-1/2 px-2">
            <StatCard
              title="Workouts Completed"
              value={dashboardData.workoutsCompleted}
              icon={<Text className="text-lg">💪</Text>}
              trend="+12% this week"
              color="blue"
            />
          </View>
          <View className="w-1/2 px-2">
            <StatCard
              title="Current Streak"
              value={`${dashboardData.currentStreak} days`}
              icon={<Text className="text-lg">🔥</Text>}
              trend="Keep it up!"
              color="orange"
            />
          </View>
          <View className="w-1/2 px-2">
            <StatCard
              title="Calories Today"
              value={`${dashboardData.caloriesToday} kcal`}
              icon={<Text className="text-lg">🎯</Text>}
              trend="Goal: 2000 kcal"
              color="green"
            />
          </View>
          <View className="w-1/2 px-2">
            <StatCard
              title="AI Recommendations"
              value={dashboardData.aiRecommendations}
              icon={<Text className="text-lg">🧠</Text>}
              trend="New insights available"
              color="purple"
            />
          </View>
        </View>

        {/* Progress Overview */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-lg font-semibold text-gray-900">
              Weekly Progress
            </Text>
            <Text className="text-lg">📈</Text>
          </View>
          <View className="space-y-4">
            <View>
              <View className="flex-row justify-between text-sm text-gray-600 mb-1">
                <Text className="text-sm text-gray-600">Workouts this week</Text>
                <Text className="text-sm text-gray-600">
                  {dashboardData.workoutsCompleted} / {dashboardData.monthlyGoal}
                </Text>
              </View>
              <View className="w-full bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ 
                    width: `${Math.min((dashboardData.workoutsCompleted / dashboardData.monthlyGoal) * 100, 100)}%` 
                  }}
                />
              </View>
            </View>
            <View>
              <View className="flex-row justify-between text-sm text-gray-600 mb-1">
                <Text className="text-sm text-gray-600">Total workout time</Text>
                <Text className="text-sm text-gray-600">
                  {dashboardData.totalWorkoutTime} min
                </Text>
              </View>
              <View className="w-full bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-green-600 h-2 rounded-full"
                  style={{ 
                    width: `${Math.min((dashboardData.totalWorkoutTime / 300) * 100, 100)}%` 
                  }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Quick Actions */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Quick Actions
          </Text>
          <View className="space-y-3">
            <TouchableOpacity className="w-full bg-blue-600 rounded-lg py-3">
              <Text className="text-white font-semibold text-center">Start Workout</Text>
            </TouchableOpacity>
            <TouchableOpacity className="w-full bg-green-600 rounded-lg py-3">
              <Text className="text-white font-semibold text-center">Log Nutrition</Text>
            </TouchableOpacity>
            <TouchableOpacity className="w-full bg-purple-600 rounded-lg py-3">
              <Text className="text-white font-semibold text-center">View Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Recent Activity */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Recent Activity
          </Text>
          <View className="space-y-3">
            <View className="flex-row items-center space-x-3">
              <View className="w-2 h-2 bg-green-500 rounded-full" />
              <Text className="text-sm text-gray-600 flex-1">
                Completed chest workout
              </Text>
              <Text className="text-xs text-gray-500">2h ago</Text>
            </View>
            <View className="flex-row items-center space-x-3">
              <View className="w-2 h-2 bg-blue-500 rounded-full" />
              <Text className="text-sm text-gray-600 flex-1">
                Logged 1,850 calories
              </Text>
              <Text className="text-xs text-gray-500">4h ago</Text>
            </View>
            <View className="flex-row items-center space-x-3">
              <View className="w-2 h-2 bg-purple-500 rounded-full" />
              <Text className="text-sm text-gray-600 flex-1">
                New AI recommendation
              </Text>
              <Text className="text-xs text-gray-500">1d ago</Text>
            </View>
          </View>
        </View>

        {/* Achievements */}
        {dashboardData.achievements.length > 0 && (
          <View className="bg-white rounded-lg border border-gray-200 p-6">
            <Text className="text-lg font-semibold text-gray-900 mb-4 flex-row items-center">
              <Text className="text-lg mr-2">🏆</Text>
              Recent Achievements
            </Text>
            <View className="flex-row flex-wrap">
              {dashboardData.achievements.map((achievement, index) => (
                <View key={index} className="flex-row items-center space-x-3 p-3 bg-yellow-50 rounded-lg mr-2 mb-2">
                  <Text className="text-lg">🏆</Text>
                  <Text className="text-sm font-medium text-gray-900">
                    {achievement}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </View>
    </ScrollView>
  );
}
