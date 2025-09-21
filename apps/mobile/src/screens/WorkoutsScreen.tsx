import React, { useEffect, useState } from 'react';
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  RefreshControl,
  Modal,
} from 'react-native';
import { getCurrentUser } from 'aws-amplify/auth';
import { useApi, apiFetch } from '../hooks/useApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

interface Workout {
  id: string;
  name: string;
  description: string;
  duration: number;
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
  restTime: number;
  instructions: string;
}

export function WorkoutsScreen() {
  const [user, setUser] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedWorkout, setSelectedWorkout] = useState<Workout | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const {
    data: workoutsResponse,
    loading,
    error,
    refetch,
  } = useApi<{ statusCode: number; body: any[] }>('/api/workouts/sessions');

  // Transform API response or use mock data
  const workouts: Workout[] =
    workoutsResponse?.statusCode === 200
      ? workoutsResponse.body.map((session: any) => ({
          id: session.id,
          name: session.workout_plan?.name || 'Workout Session',
          description: session.workout_plan?.description || 'No description',
          duration: session.duration_minutes || 0,
          difficulty: session.workout_plan?.difficulty || 'beginner',
          completed: session.status === 'completed',
          completedAt: session.completed_at,
          exercises: session.exercises || [],
        }))
      : [
          {
            id: '1',
            name: 'Upper Body Strength',
            description: 'Focus on chest, shoulders, and arms',
            duration: 45,
            difficulty: 'intermediate',
            completed: false,
            exercises: [
              {
                id: '1',
                name: 'Bench Press',
                sets: 3,
                reps: 10,
                weight: 135,
                restTime: 90,
                instructions: 'Lie flat on bench, lower bar to chest, press up',
              },
              {
                id: '2',
                name: 'Shoulder Press',
                sets: 3,
                reps: 12,
                weight: 50,
                restTime: 60,
                instructions: 'Press dumbbells overhead from shoulder height',
              },
            ],
          },
          {
            id: '2',
            name: 'Lower Body Power',
            description: 'Squats, deadlifts, and leg exercises',
            duration: 60,
            difficulty: 'advanced',
            completed: true,
            completedAt: '2024-01-15T10:30:00Z',
            exercises: [
              {
                id: '3',
                name: 'Back Squat',
                sets: 4,
                reps: 8,
                weight: 185,
                restTime: 120,
                instructions: 'Squat down until thighs parallel to floor',
              },
            ],
          },
        ];

  const onRefresh = async () => {
    setRefreshing(true);
    await refetch();
    setRefreshing(false);
  };

  const startWorkout = (workout: Workout) => {
    setSelectedWorkout(workout);
  };

  const completeWorkout = async (workoutId: string) => {
    try {
      await apiFetch(`/api/workouts/sessions`, {
        method: 'PUT',
        body: JSON.stringify({
          id: workoutId,
          status: 'completed',
          completed_at: new Date().toISOString(),
        }),
      });
      await refetch();
      setSelectedWorkout(null);
    } catch (e: any) {
      console.error('Failed to complete workout:', e);
      await refetch();
      setSelectedWorkout(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading workouts..." />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={onRefresh} />;
  }

  const completedWorkouts = workouts.filter((w) => w.completed).length;
  const totalTime = workouts.reduce((acc, w) => acc + w.duration, 0);
  const weeklyWorkouts = workouts.filter(
    (w) =>
      w.completed &&
      w.completedAt &&
      new Date(w.completedAt) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  ).length;

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
            <Text className="text-2xl font-bold text-gray-900">Workouts</Text>
            <Text className="text-gray-600">Manage your workout routines</Text>
          </View>
          <TouchableOpacity
            onPress={() => setShowCreateForm(true)}
            className="bg-blue-600 rounded-lg px-4 py-2"
          >
            <Text className="text-white font-semibold">+ New</Text>
          </TouchableOpacity>
        </View>

        {/* Stats */}
        <View className="flex-row flex-wrap -mx-2 mb-6">
          <View className="w-1/2 px-2">
            <View className="bg-white rounded-lg border border-gray-200 p-4">
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">💪</Text>
                <View>
                  <Text className="text-sm font-medium text-gray-600">
                    Total Workouts
                  </Text>
                  <Text className="text-2xl font-semibold text-gray-900">
                    {workouts.length}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View className="w-1/2 px-2">
            <View className="bg-white rounded-lg border border-gray-200 p-4">
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">✅</Text>
                <View>
                  <Text className="text-sm font-medium text-gray-600">
                    Completed
                  </Text>
                  <Text className="text-2xl font-semibold text-gray-900">
                    {completedWorkouts}
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View className="w-1/2 px-2">
            <View className="bg-white rounded-lg border border-gray-200 p-4">
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">⏱️</Text>
                <View>
                  <Text className="text-sm font-medium text-gray-600">
                    Total Time
                  </Text>
                  <Text className="text-2xl font-semibold text-gray-900">
                    {totalTime}m
                  </Text>
                </View>
              </View>
            </View>
          </View>
          <View className="w-1/2 px-2">
            <View className="bg-white rounded-lg border border-gray-200 p-4">
              <View className="flex-row items-center">
                <Text className="text-2xl mr-3">📈</Text>
                <View>
                  <Text className="text-sm font-medium text-gray-600">
                    This Week
                  </Text>
                  <Text className="text-2xl font-semibold text-gray-900">
                    {weeklyWorkouts}
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Workouts List */}
        <View className="space-y-4">
          {workouts.map((workout) => (
            <View
              key={workout.id}
              className="bg-white rounded-lg border border-gray-200 overflow-hidden"
            >
              <View className="p-6">
                <View className="flex-row items-start justify-between mb-4">
                  <View className="flex-1">
                    <Text className="text-lg font-semibold text-gray-900 mb-1">
                      {workout.name}
                    </Text>
                    <Text className="text-sm text-gray-600">
                      {workout.description}
                    </Text>
                  </View>
                  {workout.completed && (
                    <Text className="text-green-500 text-xl">✅</Text>
                  )}
                </View>

                <View className="flex-row items-center space-x-4 mb-4">
                  <View className="flex-row items-center">
                    <Text className="text-sm text-gray-600 mr-1">⏱️</Text>
                    <Text className="text-sm text-gray-600">
                      {workout.duration}m
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-sm text-gray-600 mr-1">🎯</Text>
                    <Text className="text-sm text-gray-600 capitalize">
                      {workout.difficulty}
                    </Text>
                  </View>
                  <View className="flex-row items-center">
                    <Text className="text-sm text-gray-600 mr-1">💪</Text>
                    <Text className="text-sm text-gray-600">
                      {workout.exercises.length} exercises
                    </Text>
                  </View>
                </View>

                <View className="flex-row space-x-2">
                  <TouchableOpacity
                    onPress={() => startWorkout(workout)}
                    className="flex-1 bg-blue-600 rounded-lg py-3 flex-row items-center justify-center"
                  >
                    <Text className="text-white mr-2">▶️</Text>
                    <Text className="text-white font-semibold">
                      {workout.completed ? 'Repeat' : 'Start'}
                    </Text>
                  </TouchableOpacity>
                  {!workout.completed && (
                    <TouchableOpacity
                      onPress={() => completeWorkout(workout.id)}
                      className="bg-green-600 rounded-lg px-4 py-3"
                    >
                      <Text className="text-white font-semibold">Complete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* Workout Detail Modal */}
        <Modal
          visible={!!selectedWorkout}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <View className="flex-1 bg-white">
            <View className="p-6 border-b border-gray-200">
              <View className="flex-row justify-between items-start">
                <View className="flex-1">
                  <Text className="text-xl font-semibold text-gray-900">
                    {selectedWorkout?.name}
                  </Text>
                  <Text className="text-gray-600 mt-1">
                    {selectedWorkout?.description}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedWorkout(null)}
                  className="ml-4"
                >
                  <Text className="text-2xl">✕</Text>
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView className="flex-1 p-6">
              <Text className="text-lg font-medium text-gray-900 mb-4">
                Exercises
              </Text>
              {selectedWorkout?.exercises.map((exercise, index) => (
                <View
                  key={exercise.id}
                  className="border border-gray-200 rounded-lg p-4 mb-4"
                >
                  <View className="flex-row justify-between items-start mb-2">
                    <Text className="font-medium text-gray-900 flex-1">
                      {index + 1}. {exercise.name}
                    </Text>
                    {exercise.weight && (
                      <Text className="text-sm text-gray-600">
                        {exercise.weight} lbs
                      </Text>
                    )}
                  </View>
                  <Text className="text-sm text-gray-600 mb-2">
                    {exercise.sets} sets × {exercise.reps} reps
                  </Text>
                  <Text className="text-sm text-gray-500">
                    {exercise.instructions}
                  </Text>
                </View>
              ))}

              <View className="flex-row space-x-3 mt-6">
                <TouchableOpacity
                  onPress={() =>
                    selectedWorkout && completeWorkout(selectedWorkout.id)
                  }
                  className="flex-1 bg-green-600 rounded-lg py-3"
                >
                  <Text className="text-white font-semibold text-center">
                    Mark as Complete
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={() => setSelectedWorkout(null)}
                  className="px-4 py-3 border border-gray-300 rounded-lg"
                >
                  <Text className="text-gray-700 font-semibold">Close</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </Modal>
      </View>
    </ScrollView>
  );
}
