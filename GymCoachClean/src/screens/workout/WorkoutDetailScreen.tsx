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

export default function WorkoutDetailScreen({route, navigation}: any) {
  const {workoutId} = route.params;
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadWorkoutData();
  }, []);

  const loadWorkoutData = async () => {
    try {
      setLoading(true);
      const workouts = await apiClient.getWorkouts();
      const workout = workouts.find((w: any) => w.id === workoutId);

      if (!workout) {
        Alert.alert('Error', 'Workout not found');
        navigation.goBack();
        return;
      }

      setWorkoutData(workout);
    } catch (error) {
      console.error('Error loading workout data:', error);
      Alert.alert('Error', 'Failed to load workout details');
    } finally {
      setLoading(false);
    }
  };

  const startWorkout = () => {
    navigation.navigate('Session', {workoutId});
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  if (!workoutData) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>Workout not found</Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          {/* Header Card */}
          <Card style={styles.headerCard}>
            <Text style={styles.workoutName}>{workoutData.name}</Text>
            {workoutData.description && (
              <Text style={styles.workoutDescription}>
                {workoutData.description}
              </Text>
            )}

            <View style={styles.statsContainer}>
              {workoutData.difficulty && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Difficulty</Text>
                  <View
                    style={[
                      styles.difficultyBadge,
                      getDifficultyStyle(workoutData.difficulty),
                    ]}>
                    <Text style={styles.difficultyText}>
                      {workoutData.difficulty}
                    </Text>
                  </View>
                </View>
              )}

              {workoutData.exercises && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Exercises</Text>
                  <Text style={styles.statValue}>
                    {workoutData.exercises.length}
                  </Text>
                </View>
              )}

              {workoutData.duration && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Duration</Text>
                  <Text style={styles.statValue}>
                    {workoutData.duration} min
                  </Text>
                </View>
              )}

              {workoutData.durationWeeks && (
                <View style={styles.statItem}>
                  <Text style={styles.statLabel}>Program</Text>
                  <Text style={styles.statValue}>
                    {workoutData.durationWeeks} weeks
                  </Text>
                </View>
              )}
            </View>
          </Card>

          {/* Exercises List */}
          {workoutData.exercises && workoutData.exercises.length > 0 && (
            <Card style={styles.exercisesCard}>
              <Text style={styles.sectionTitle}>
                Exercises ({workoutData.exercises.length})
              </Text>
              {workoutData.exercises.map((exercise: any, index: number) => (
                <View key={index} style={styles.exerciseItem}>
                  <View style={styles.exerciseHeader}>
                    <Text style={styles.exerciseName}>
                      {index + 1}.{' '}
                      {exercise.name ||
                        exercise.exerciseName ||
                        `Exercise ${index + 1}`}
                    </Text>
                  </View>

                  <View style={styles.exerciseDetails}>
                    {exercise.sets && (
                      <Text style={styles.exerciseDetail}>
                        Sets: {exercise.sets}
                      </Text>
                    )}
                    {exercise.reps && (
                      <Text style={styles.exerciseDetail}>
                        Reps: {exercise.reps}
                      </Text>
                    )}
                    {exercise.weight && (
                      <Text style={styles.exerciseDetail}>
                        Weight: {exercise.weight}kg
                      </Text>
                    )}
                    {exercise.restSeconds && (
                      <Text style={styles.exerciseDetail}>
                        Rest: {exercise.restSeconds}s
                      </Text>
                    )}
                  </View>

                  {exercise.notes && (
                    <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                  )}
                </View>
              ))}
            </Card>
          )}

          {/* Action Buttons */}
          <View style={styles.actionButtons}>
            <Button
              title="🔥 Start This Workout"
              onPress={startWorkout}
              style={styles.startButton}
            />
            <Button
              title="Back to Workouts"
              variant="outline"
              onPress={() => navigation.goBack()}
            />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const getDifficultyStyle = (difficulty: string) => {
  const difficultyColors: Record<string, any> = {
    beginner: {backgroundColor: '#dcfce7', borderColor: '#16a34a'},
    intermediate: {backgroundColor: '#fed7aa', borderColor: '#ea580c'},
    advanced: {backgroundColor: '#fecaca', borderColor: '#dc2626'},
  };
  return (
    difficultyColors[difficulty] || {
      backgroundColor: '#f3f4f6',
      borderColor: '#9ca3af',
    }
  );
};

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
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  errorText: {
    fontSize: 18,
    color: '#ef4444',
    marginBottom: 20,
    textAlign: 'center',
  },
  headerCard: {
    marginBottom: 20,
  },
  workoutName: {
    fontSize: 24,
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
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  statItem: {
    alignItems: 'center',
    minWidth: 70,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
    textAlign: 'center',
  },
  statValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#3b82f6',
  },
  difficultyBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  difficultyText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  exercisesCard: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
  },
  exerciseItem: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  exerciseHeader: {
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  exerciseDetails: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 4,
  },
  exerciseDetail: {
    fontSize: 14,
    color: '#6b7280',
    backgroundColor: '#f3f4f6',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  exerciseNotes: {
    fontSize: 14,
    color: '#374151',
    fontStyle: 'italic',
    marginTop: 4,
  },
  actionButtons: {
    gap: 12,
  },
  startButton: {
    backgroundColor: '#ef4444',
    marginBottom: 8,
  },
});
