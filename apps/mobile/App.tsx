import { StatusBar } from 'expo-status-bar';
import { Text, View, ScrollView, TouchableOpacity } from 'react-native';
import { User, Workout } from 'types';

export default function App() {
  const sampleUser: User = {
    id: '1',
    email: 'user@example.com',
    name: 'John Doe',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    preferences: {
      units: 'metric',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: true,
        workoutReminders: true,
        nutritionReminders: true,
      },
      privacy: {
        profileVisibility: 'private',
        workoutSharing: false,
        progressSharing: false,
      },
    },
  };

  const sampleWorkout: Workout = {
    id: '1',
    userId: '1',
    name: 'Morning Cardio',
    description: 'A quick morning cardio session',
    exercises: [],
    duration: 30,
    difficulty: 'beginner',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  return (
    <View className="flex-1 bg-gradient-to-br from-primary-50 to-secondary-50">
      <StatusBar style="auto" />
      <ScrollView className="flex-1 p-6">
        <View className="items-center mb-8">
          <Text className="text-4xl font-bold text-secondary-900 mb-2">
            GymCoach AI
          </Text>
          <Text className="text-lg text-secondary-600 text-center">
            Your intelligent fitness companion
          </Text>
        </View>

        <View className="bg-white rounded-xl p-6 mb-6 shadow-soft">
          <Text className="text-xl font-semibold text-secondary-900 mb-2">
            Welcome back, {sampleUser.name}!
          </Text>
          <Text className="text-secondary-600 mb-4">
            Ready for your next workout?
          </Text>
          <TouchableOpacity className="bg-primary-600 py-3 px-6 rounded-lg">
            <Text className="text-white font-semibold text-center">
              Start Workout
            </Text>
          </TouchableOpacity>
        </View>

        <View className="bg-white rounded-xl p-6 mb-6 shadow-soft">
          <Text className="text-lg font-semibold text-secondary-900 mb-2">
            Today's Workout
          </Text>
          <Text className="text-secondary-600 mb-2">{sampleWorkout.name}</Text>
          <Text className="text-sm text-secondary-500">
            Duration: {sampleWorkout.duration} minutes
          </Text>
        </View>

        <View className="flex-row justify-between">
          <TouchableOpacity className="bg-secondary-100 py-3 px-6 rounded-lg flex-1 mr-2">
            <Text className="text-secondary-700 font-semibold text-center">
              Nutrition
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="bg-secondary-100 py-3 px-6 rounded-lg flex-1 ml-2">
            <Text className="text-secondary-700 font-semibold text-center">
              Progress
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
