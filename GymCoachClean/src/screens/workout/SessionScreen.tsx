import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
} from 'react-native';
import {Card, Button, LoadingSpinner} from '../../components/common/UI';
import apiClient from '../../services/api';

export default function SessionScreen({route, navigation}: any) {
  const {sessionId, workoutId} = route.params || {};
  const [sessionData, setSessionData] = useState<any>(null);
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);

  useEffect(() => {
    loadSessionData();
  }, []);

  const loadSessionData = async () => {
    try {
      setLoading(true);

      if (workoutId) {
        // Starting a session from a workout plan
        const workouts = await apiClient.getWorkouts();
        const workout = workouts.find((w: any) => w.id === workoutId);
        setWorkoutData(workout);
      }

      if (sessionId) {
        // Continuing an existing session
        const sessions = await apiClient.getWorkoutSessions();
        const session = sessions.find((s: any) => s.id === sessionId);
        setSessionData(session);
      }
    } catch (error) {
      console.error('Error loading session data:', error);
      Alert.alert('Error', 'Failed to load session data');
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    try {
      const newSession = await apiClient.createWorkoutSession({
        workoutId: workoutId,
        name: workoutData?.name || 'Quick Workout',
        status: 'in_progress',
        startTime: new Date().toISOString(),
        exercises: workoutData?.exercises || [],
      });

      setSessionData(newSession);
      setSessionStarted(true);
      setStartTime(new Date());

      Alert.alert('Success', 'Workout session started!');
    } catch (error) {
      console.error('Error starting session:', error);
      Alert.alert('Error', 'Failed to start workout session');
    }
  };

  const completeSession = async () => {
    if (!sessionData?.id) return;

    try {
      await apiClient.completeWorkoutSession(sessionData.id);
      Alert.alert(
        'Session Complete!',
        'Great job! Your workout has been logged.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.error('Error completing session:', error);
      Alert.alert('Error', 'Failed to complete session');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const isNewSession = !sessionData && workoutData;
  const displayData = sessionData || workoutData;

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {isNewSession ? 'Start Workout' : 'Workout Session'}
          </Text>

          {displayData && (
            <Card style={styles.workoutCard}>
              <Text style={styles.workoutName}>{displayData.name}</Text>
              {displayData.description && (
                <Text style={styles.workoutDescription}>
                  {displayData.description}
                </Text>
              )}

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {displayData.exercises?.length || 0}
                  </Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </View>
                {displayData.difficulty && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {displayData.difficulty}
                    </Text>
                    <Text style={styles.statLabel}>Difficulty</Text>
                  </View>
                )}
                {displayData.duration && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {displayData.duration}min
                    </Text>
                    <Text style={styles.statLabel}>Duration</Text>
                  </View>
                )}
              </View>
            </Card>
          )}

          {sessionStarted && startTime && (
            <Card style={styles.timerCard}>
              <Text style={styles.timerTitle}>Session in Progress</Text>
              <Text style={styles.timerText}>
                Started: {startTime.toLocaleTimeString()}
              </Text>
            </Card>
          )}

          {displayData?.exercises && displayData.exercises.length > 0 && (
            <Card style={styles.exercisesCard}>
              <Text style={styles.sectionTitle}>Exercises</Text>
              {displayData.exercises
                .slice(0, 5)
                .map((exercise: any, index: number) => (
                  <View key={index} style={styles.exerciseItem}>
                    <Text style={styles.exerciseName}>
                      {exercise.name ||
                        exercise.exerciseName ||
                        `Exercise ${index + 1}`}
                    </Text>
                    {exercise.sets && (
                      <Text style={styles.exerciseDetails}>
                        {exercise.sets} sets × {exercise.reps || '8-12'} reps
                      </Text>
                    )}
                  </View>
                ))}
              {displayData.exercises.length > 5 && (
                <Text style={styles.moreExercises}>
                  +{displayData.exercises.length - 5} more exercises
                </Text>
              )}
            </Card>
          )}

          <View style={styles.actionButtons}>
            {isNewSession && !sessionStarted && (
              <Button
                title="🔥 Start Workout"
                onPress={startSession}
                style={styles.startButton}
              />
            )}

            {sessionStarted && (
              <Button
                title="✅ Complete Workout"
                onPress={completeSession}
                style={styles.completeButton}
              />
            )}

            <Button
              title="Cancel"
              variant="outline"
              onPress={() => navigation.goBack()}
              style={styles.cancelButton}
            />
          </View>
        </View>
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
  content: {
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  workoutCard: {
    marginBottom: 20,
  },
  workoutName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  workoutDescription: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  timerCard: {
    marginBottom: 20,
    backgroundColor: '#fef3c7',
    borderColor: '#f59e0b',
    borderWidth: 1,
  },
  timerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#92400e',
    marginBottom: 4,
  },
  timerText: {
    fontSize: 14,
    color: '#92400e',
  },
  exercisesCard: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  exerciseItem: {
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  exerciseDetails: {
    fontSize: 14,
    color: '#6b7280',
  },
  moreExercises: {
    fontSize: 14,
    color: '#3b82f6',
    fontStyle: 'italic',
    textAlign: 'center',
    marginTop: 8,
  },
  actionButtons: {
    gap: 12,
  },
  startButton: {
    backgroundColor: '#ef4444',
  },
  completeButton: {
    backgroundColor: '#10b981',
  },
  cancelButton: {
    // Default outline style
  },
});
