import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Card, LoadingSpinner } from '../components/common/UI';
import apiClient from '../services/api';

const { width } = Dimensions.get('window');

interface DashboardData {
  recentWorkouts: any[];
  nutritionSummary: any;
  strengthProgress: any[];
  achievements: any[];
  upcomingWorkouts: any[];
}

// Helper function to safely format dates
const formatDate = (dateInput: any): string => {
  if (!dateInput) {
    console.log('formatDate: No date input provided');
    return 'N/A';
  }

  try {
    console.log(
      'formatDate: Attempting to format date:',
      dateInput,
      typeof dateInput
    );
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      console.warn('formatDate: Invalid date created from input:', dateInput);
      return 'N/A';
    }
    const formatted = date.toLocaleDateString();
    console.log('formatDate: Successfully formatted to:', formatted);
    return formatted;
  } catch (error) {
    console.warn('formatDate: Error formatting date:', dateInput, error);
    return 'N/A';
  }
};

// Helper function to safely format time
const formatTime = (dateInput: any): string => {
  if (!dateInput) {
    console.log('formatTime: No date input provided');
    return 'N/A';
  }

  try {
    console.log(
      'formatTime: Attempting to format time:',
      dateInput,
      typeof dateInput
    );
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      console.warn('formatTime: Invalid date created from input:', dateInput);
      return 'N/A';
    }
    const formatted = date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
    console.log('formatTime: Successfully formatted to:', formatted);
    return formatted;
  } catch (error) {
    console.warn('formatTime: Error formatting time:', dateInput, error);
    return 'N/A';
  }
};

// Helper function to extract date from workout object with multiple possible field names
const getWorkoutDate = (workout: any): any => {
  // Try different possible date field names
  const possibleFields = [
    'scheduledTime',
    'scheduled_time',
    'date',
    'startTime',
    'start_time',
    'createdAt',
    'created_at',
  ];

  for (const field of possibleFields) {
    if (workout[field]) {
      console.log(
        `getWorkoutDate: Found date in field '${field}':`,
        workout[field]
      );
      return workout[field];
    }
  }

  console.warn(
    'getWorkoutDate: No date field found in workout:',
    Object.keys(workout)
  );
  return null;
};

export default function DashboardScreen() {
  const { user, userProfile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load dashboard data in parallel
      const [
        workoutSessions,
        nutritionStats,
        strengthProgress,
        achievements,
        scheduledWorkouts,
      ] = await Promise.allSettled([
        apiClient.getWorkoutSessions(),
        apiClient.getNutritionStats(),
        apiClient.getStrengthProgress(),
        apiClient.getAchievements(),
        apiClient.getScheduledWorkouts(),
      ]);

      // Debug log the scheduled workouts data
      if (scheduledWorkouts.status === 'fulfilled') {
        console.log(
          'Dashboard: Scheduled workouts data:',
          JSON.stringify(scheduledWorkouts.value, null, 2)
        );
      } else {
        console.log(
          'Dashboard: Scheduled workouts failed:',
          scheduledWorkouts.reason
        );
      }

      setData({
        recentWorkouts:
          workoutSessions.status === 'fulfilled'
            ? workoutSessions.value.slice(0, 3)
            : [],
        nutritionSummary:
          nutritionStats.status === 'fulfilled' ? nutritionStats.value : null,
        strengthProgress:
          strengthProgress.status === 'fulfilled'
            ? strengthProgress.value.slice(0, 5)
            : [],
        achievements:
          achievements.status === 'fulfilled'
            ? achievements.value.slice(0, 3)
            : [],
        upcomingWorkouts:
          scheduledWorkouts.status === 'fulfilled'
            ? scheduledWorkouts.value.slice(0, 3)
            : [],
      });
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadDashboardData();
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    const name =
      userProfile?.firstName || user?.email?.split('@')[0] || 'there';

    if (hour < 12) return `Good morning, ${name}!`;
    if (hour < 17) return `Good afternoon, ${name}!`;
    return `Good evening, ${name}!`;
  };

  if (loading && !data) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>{getGreeting()}</Text>
          <Text style={styles.subtitle}>
            Let's crush your fitness goals today!
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {data?.recentWorkouts?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Workouts This Week</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {data?.nutritionSummary?.todayCalories || 0}
            </Text>
            <Text style={styles.statLabel}>Calories Today</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {data?.achievements?.length || 0}
            </Text>
            <Text style={styles.statLabel}>Achievements</Text>
          </Card>
        </View>

        {/* Recent Workouts */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Workouts</Text>
          {data?.recentWorkouts && data.recentWorkouts.length > 0 ? (
            data.recentWorkouts.map((workout, index) => (
              <Card key={workout.id || index} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutName}>
                    {workout.workout?.name || 'Custom Workout'}
                  </Text>
                  <Text style={styles.workoutDate}>
                    {formatDate(workout.createdAt)}
                  </Text>
                </View>
                <Text style={styles.workoutStatus}>
                  Status: {workout.status}
                </Text>
                {workout.exercises && (
                  <Text style={styles.workoutExercises}>
                    {workout.exercises.length} exercises
                  </Text>
                )}
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No recent workouts</Text>
              <Text style={styles.emptySubtext}>
                Start your first workout today!
              </Text>
            </Card>
          )}
        </View>

        {/* Upcoming Workouts */}
        {data?.upcomingWorkouts && data.upcomingWorkouts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Upcoming Workouts</Text>
            {data.upcomingWorkouts.map((workout, index) => {
              const workoutDate = getWorkoutDate(workout);
              console.log(`Upcoming workout ${index}:`, workout);
              console.log(`Extracted date for workout ${index}:`, workoutDate);

              return (
                <Card key={workout.id || index} style={styles.upcomingCard}>
                  <Text style={styles.upcomingName}>
                    {workout.name || workout.workoutName || 'Unnamed Workout'}
                  </Text>
                  <Text style={styles.upcomingTime}>
                    {formatDate(workoutDate)} at {formatTime(workoutDate)}
                  </Text>
                </Card>
              );
            })}
          </View>
        )}

        {/* Recent Achievements */}
        {data?.achievements && data.achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Achievements</Text>
            {data.achievements.map((achievement) => (
              <Card key={achievement.id} style={styles.achievementCard}>
                <View style={styles.achievementContent}>
                  <Text style={styles.achievementTitle}>
                    {achievement.title}
                  </Text>
                  <Text style={styles.achievementDesc}>
                    {achievement.description}
                  </Text>
                  <Text style={styles.achievementDate}>
                    {formatDate(achievement.unlockedAt)}
                  </Text>
                </View>
                <Text style={styles.achievementEmoji}>🏆</Text>
              </Card>
            ))}
          </View>
        )}

        {/* Nutrition Summary */}
        {data?.nutritionSummary && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Today's Nutrition</Text>
            <Card style={styles.nutritionCard}>
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {data.nutritionSummary.calories || 0}
                  </Text>
                  <Text style={styles.nutritionLabel}>Calories</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {data.nutritionSummary.protein || 0}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {data.nutritionSummary.carbs || 0}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {data.nutritionSummary.fat || 0}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                </View>
              </View>
            </Card>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  workoutCard: {
    marginBottom: 8,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  workoutDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  workoutStatus: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  workoutExercises: {
    fontSize: 12,
    color: '#6b7280',
  },
  upcomingCard: {
    marginBottom: 8,
    paddingVertical: 12,
  },
  upcomingName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  upcomingTime: {
    fontSize: 14,
    color: '#6b7280',
  },
  achievementCard: {
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  achievementDesc: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  achievementDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  achievementEmoji: {
    fontSize: 24,
    marginLeft: 12,
  },
  nutritionCard: {
    paddingVertical: 20,
  },
  nutritionRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  nutritionItem: {
    alignItems: 'center',
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});
