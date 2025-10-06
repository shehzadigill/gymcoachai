import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { Card, LoadingSpinner, Button } from '../components/common/UI';
import apiClient from '../services/api';

export default function WorkoutsScreen({ navigation }: any) {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadWorkouts();
  }, []);

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      const [workoutsData, sessionsData] = await Promise.allSettled([
        apiClient.getWorkouts(),
        apiClient.getWorkoutSessions(),
      ]);

      setWorkouts(
        workoutsData.status === 'fulfilled' ? workoutsData.value : []
      );
      setSessions(
        sessionsData.status === 'fulfilled' ? sessionsData.value : []
      );
    } catch (error) {
      console.error('Error loading workouts:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadWorkouts();
  };

  const startQuickWorkout = () => {
    navigation.navigate('Session', { workoutId: null });
  };

  if (loading && !workouts.length) {
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
          <Text style={styles.title}>Workouts</Text>
          <Text style={styles.subtitle}>
            Choose a workout or start a custom session
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title="🔥 Start Quick Workout"
            onPress={startQuickWorkout}
            style={styles.quickWorkoutButton}
          />
        </View>

        {/* Recent Sessions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sessions</Text>
          {sessions && sessions.length > 0 ? (
            sessions.slice(0, 5).map((session, index) => (
              <Card key={session.id || index} style={styles.sessionCard}>
                <View style={styles.sessionHeader}>
                  <Text style={styles.sessionName}>
                    {session.workout?.name || 'Custom Workout'}
                  </Text>
                  <Text style={styles.sessionDate}>
                    {new Date(session.createdAt).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.sessionInfo}>
                  <Text style={styles.sessionDetail}>
                    Status:{' '}
                    <Text style={getStatusStyle(session.status)}>
                      {session.status}
                    </Text>
                  </Text>
                  {session.exercises && (
                    <Text style={styles.sessionDetail}>
                      {session.exercises.length} exercises
                    </Text>
                  )}
                  {session.startTime && session.endTime && (
                    <Text style={styles.sessionDetail}>
                      Duration:{' '}
                      {calculateDuration(session.startTime, session.endTime)}
                    </Text>
                  )}
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No workout sessions yet</Text>
              <Text style={styles.emptySubtext}>
                Start your first workout above!
              </Text>
            </Card>
          )}
        </View>

        {/* Workout Plans */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Workout Plans</Text>
          {workouts && workouts.length > 0 ? (
            workouts.map((workout) => (
              <Card key={workout.id} style={styles.workoutCard}>
                <View style={styles.workoutHeader}>
                  <Text style={styles.workoutName}>{workout.name}</Text>
                  {workout.difficulty && (
                    <View
                      style={[
                        styles.difficultyBadge,
                        getDifficultyStyle(workout.difficulty),
                      ]}
                    >
                      <Text style={styles.difficultyText}>
                        {workout.difficulty}
                      </Text>
                    </View>
                  )}
                </View>
                {workout.description && (
                  <Text style={styles.workoutDescription}>
                    {workout.description}
                  </Text>
                )}
                <View style={styles.workoutInfo}>
                  {workout.exercises && (
                    <Text style={styles.workoutDetail}>
                      {workout.exercises.length} exercises
                    </Text>
                  )}
                  {workout.duration && (
                    <Text style={styles.workoutDetail}>
                      ~{workout.duration} minutes
                    </Text>
                  )}
                  {workout.category && (
                    <Text style={styles.workoutDetail}>
                      Category: {workout.category}
                    </Text>
                  )}
                </View>
                <View style={styles.workoutActions}>
                  <Button
                    title="View Details"
                    variant="outline"
                    size="small"
                    onPress={() =>
                      navigation.navigate('WorkoutDetail', {
                        workoutId: workout.id,
                      })
                    }
                    style={styles.actionButton}
                  />
                  <Button
                    title="Start Workout"
                    size="small"
                    onPress={() =>
                      navigation.navigate('Session', { workoutId: workout.id })
                    }
                    style={styles.actionButton}
                  />
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No workout plans yet</Text>
              <Text style={styles.emptySubtext}>
                Create your first workout plan!
              </Text>
            </Card>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusStyle = (status: string) => {
  const statusColors: Record<string, any> = {
    completed: { color: '#10b981' },
    in_progress: { color: '#f59e0b' },
    planned: { color: '#6b7280' },
    cancelled: { color: '#ef4444' },
  };
  return statusColors[status] || { color: '#6b7280' };
};

const getDifficultyStyle = (difficulty: string) => {
  const difficultyColors: Record<string, any> = {
    easy: { backgroundColor: '#dcfce7' },
    medium: { backgroundColor: '#fed7aa' },
    hard: { backgroundColor: '#fecaca' },
  };
  return difficultyColors[difficulty] || { backgroundColor: '#f3f4f6' };
};

const calculateDuration = (startTime: string, endTime: string) => {
  const start = new Date(startTime);
  const end = new Date(endTime);
  const duration = Math.round((end.getTime() - start.getTime()) / (1000 * 60));
  return `${duration} min`;
};

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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  quickWorkoutButton: {
    backgroundColor: '#ef4444',
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
  sessionCard: {
    marginBottom: 12,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sessionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  sessionDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  sessionInfo: {
    gap: 4,
  },
  sessionDetail: {
    fontSize: 14,
    color: '#374151',
  },
  workoutCard: {
    marginBottom: 12,
  },
  workoutHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  workoutName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#374151',
  },
  workoutDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  workoutInfo: {
    marginBottom: 16,
    gap: 4,
  },
  workoutDetail: {
    fontSize: 14,
    color: '#374151',
  },
  workoutActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButton: {
    flex: 1,
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
    textAlign: 'center',
  },
});
