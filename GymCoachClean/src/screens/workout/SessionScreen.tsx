import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Alert,
  Pressable,
} from 'react-native';
import {Card, Button, LoadingSpinner} from '../../components/common/UI';
import apiClient from '../../services/api';
import {useTranslation} from 'react-i18next';

export default function SessionScreen({route, navigation}: any) {
  const {t} = useTranslation();
  const {sessionId, workoutId, quickWorkout} = route.params || {};
  const [sessionData, setSessionData] = useState<any>(null);
  const [workoutData, setWorkoutData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [sessionStarted, setSessionStarted] = useState(false);
  const [startTime, setStartTime] = useState<Date | null>(null);
  const [exercises, setExercises] = useState<any[]>([]);
  const [exerciseLibrary, setExerciseLibrary] = useState<any[]>([]);
  const [showExerciseSelection, setShowExerciseSelection] = useState(false);

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
        if (session?.exercises) {
          setExercises(session.exercises);
        }
      }

      // Load exercise library for quick workout
      if (quickWorkout) {
        try {
          console.log('Loading exercise library for quick workout...');
          const library = await apiClient.getExercises();
          console.log(
            'Exercise library loaded:',
            library?.length || 0,
            'exercises',
          );
          setExerciseLibrary(library?.slice(0, 20) || []); // Load first 20 exercises
        } catch (error) {
          console.error('Failed to load exercise library:', error);
          // Set empty array as fallback
          setExerciseLibrary([]);
        }
      }
    } catch (error) {
      console.error('Error loading session data:', error);
      Alert.alert(
        t('common.error'),
        t('common.errors.failed_to_load_session_data'),
      );
    } finally {
      setLoading(false);
    }
  };

  const startSession = async () => {
    try {
      // Validate that at least one exercise is added for quick workout
      if (quickWorkout && exercises.length === 0) {
        Alert.alert(
          'No Exercises',
          'Please add at least one exercise before starting your workout.',
          [{text: 'OK'}],
        );
        return;
      }

      const sessionData = {
        name: quickWorkout
          ? 'Quick Workout'
          : workoutData?.name || 'Workout Session',
        status: 'in_progress' as const,
        startTime: new Date().toISOString(),
        exercises: quickWorkout ? exercises : workoutData?.exercises || [],
        workout: quickWorkout
          ? {name: 'Quick Workout'}
          : {...workoutData, name: workoutData?.name || 'Workout Session'},
        notes: quickWorkout ? 'Quick workout session' : undefined,
        // Add required fields for backend
        userId: await apiClient.getCurrentUserId(),
        createdAt: new Date().toISOString(),
      };

      console.log(
        'Starting session with data:',
        JSON.stringify(sessionData, null, 2),
      );
      const newSession = await apiClient.createWorkoutSession(sessionData);

      console.log('Created session:', JSON.stringify(newSession, null, 2));
      console.log('Session ID from creation:', newSession?.id);
      console.log('Session creation successful:', !!newSession);
      console.log('Session has ID:', !!newSession?.id);
      setSessionData(newSession);
      setSessionStarted(true);
      setStartTime(new Date());

      Alert.alert('Success', 'Workout session started!');
    } catch (error) {
      console.error('Error starting session:', error);
      Alert.alert(
        t('common.error'),
        t('common.errors.failed_to_start_workout_session'),
      );
    }
  };

  const addExerciseToSession = (exercise: any) => {
    console.log('Adding exercise to session:', exercise);

    const newExercise = {
      exerciseId: exercise.id,
      name: exercise.name,
      sets: [
        {
          setNumber: 1,
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
        {
          setNumber: 2,
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
        {
          setNumber: 3,
          reps: 10,
          weight: null,
          durationSeconds: null,
          restSeconds: 60,
          completed: false,
          notes: null,
        },
      ],
      notes: exercise.description || null,
    };

    console.log('New exercise created:', newExercise);
    const updatedExercises = [...exercises, newExercise];
    setExercises(updatedExercises);

    // Update session data if it exists to keep it in sync
    if (sessionData) {
      setSessionData({
        ...sessionData,
        exercises: updatedExercises,
      });
    }

    setShowExerciseSelection(false);
    console.log(
      'Exercise added successfully. Total exercises:',
      updatedExercises.length,
    );
  };

  const removeExerciseFromSession = (index: number) => {
    const newExercises = exercises.filter((_, i) => i !== index);
    setExercises(newExercises);

    // Update session data if it exists to keep it in sync
    if (sessionData) {
      setSessionData({
        ...sessionData,
        exercises: newExercises,
      });
    }
  };

  const completeSession = async () => {
    if (!sessionData?.id) {
      console.log('No session data or ID available');
      Alert.alert(
        t('common.error'),
        t('common.errors.no_active_session_to_complete'),
      );
      return;
    }

    try {
      console.log('Attempting to complete session:', sessionData.id);
      console.log('Session data:', JSON.stringify(sessionData, null, 2));
      console.log('Current exercises:', JSON.stringify(exercises, null, 2));
      console.log('Session ID type:', typeof sessionData.id);
      console.log('Session ID value:', sessionData.id);

      // Update session with current exercises before completing
      const updatedSession = {
        ...sessionData,
        exercises: exercises,
      };

      // First update the session with current exercises
      await apiClient.updateWorkoutSession(sessionData.id, {
        exercises: exercises,
      });

      // Then complete the session
      const result = await apiClient.completeWorkoutSession(sessionData.id);
      console.log('Session completion result:', result);

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
      console.error('Error details:', JSON.stringify(error, null, 2));

      // More specific error message
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error occurred';
      Alert.alert(
        t('common.error'),
        `${t('common.errors.failed_to_complete_session')}: ${errorMessage}`,
      );
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const isNewSession = !sessionData && (workoutData || quickWorkout);
  const displayData = sessionData || workoutData;
  // For quick workout, always use local exercises state since we're adding exercises dynamically
  const currentExercises = quickWorkout
    ? exercises
    : sessionData?.exercises || exercises;

  // Debug logging
  console.log('SessionScreen Debug:', {
    sessionData: !!sessionData,
    workoutData: !!workoutData,
    quickWorkout,
    isNewSession,
    sessionStarted,
    exercisesCount: exercises.length,
    exerciseLibraryCount: exerciseLibrary.length,
    currentExercisesCount: currentExercises.length,
    sessionDataExercisesCount: sessionData?.exercises?.length || 0,
  });

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {quickWorkout
              ? 'Quick Workout'
              : isNewSession
              ? 'Start Workout'
              : 'Workout Session'}
          </Text>

          {(displayData || quickWorkout) && (
            <Card style={styles.workoutCard}>
              <Text style={styles.workoutName}>
                {quickWorkout
                  ? 'Quick Workout'
                  : displayData?.name || 'Workout Session'}
              </Text>
              {displayData?.description && (
                <Text style={styles.workoutDescription}>
                  {displayData.description}
                </Text>
              )}

              <View style={styles.statsContainer}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {currentExercises?.length || 0}
                  </Text>
                  <Text style={styles.statLabel}>Exercises</Text>
                </View>
                {displayData?.difficulty && (
                  <View style={styles.statItem}>
                    <Text style={styles.statValue}>
                      {displayData.difficulty}
                    </Text>
                    <Text style={styles.statLabel}>Difficulty</Text>
                  </View>
                )}
                {displayData?.duration && (
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

          {/* Exercise Management for Quick Workout */}
          {quickWorkout && (
            <Card style={styles.exercisesCard}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>
                  Exercises ({currentExercises.length})
                </Text>
                <Button
                  title="+ Add Exercise"
                  variant="outline"
                  size="small"
                  onPress={() => {
                    console.log('Add Exercise button pressed');
                    console.log(
                      'Exercise library count:',
                      exerciseLibrary.length,
                    );
                    setShowExerciseSelection(true);
                  }}
                />
              </View>

              {currentExercises.length > 0 ? (
                currentExercises.map((exercise: any, index: number) => (
                  <View key={index} style={styles.exerciseItem}>
                    <View style={styles.exerciseHeader}>
                      <Text style={styles.exerciseName}>
                        {exercise.name ||
                          exercise.exerciseName ||
                          `Exercise ${index + 1}`}
                      </Text>
                      {quickWorkout && (
                        <Button
                          title="Remove"
                          variant="outline"
                          size="small"
                          onPress={() => removeExerciseFromSession(index)}
                          style={styles.removeButton}
                        />
                      )}
                    </View>
                    {exercise.sets && (
                      <Text style={styles.exerciseDetails}>
                        {exercise.sets.length} sets ×{' '}
                        {exercise.sets[0]?.reps || '8-12'} reps
                      </Text>
                    )}
                  </View>
                ))
              ) : (
                <Text style={styles.emptyExercises}>
                  No exercises added yet. Tap "Add Exercise" to get started!
                </Text>
              )}
            </Card>
          )}

          {/* Regular exercise display for workout plans */}
          {!quickWorkout &&
            displayData?.exercises &&
            displayData.exercises.length > 0 && (
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
            {((isNewSession && !sessionStarted) ||
              (quickWorkout && !sessionStarted)) && (
              <Button
                title={
                  quickWorkout ? '🔥 Start Quick Workout' : '🔥 Start Workout'
                }
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

      {/* Exercise Selection Modal */}
      {showExerciseSelection && (
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Exercise</Text>
              <Button
                title="✕"
                variant="outline"
                size="small"
                onPress={() => setShowExerciseSelection(false)}
              />
            </View>
            <ScrollView style={styles.exerciseList}>
              {exerciseLibrary.length > 0 ? (
                exerciseLibrary.map((exercise: any, index: number) => (
                  <Pressable
                    key={exercise.id || index}
                    style={styles.exerciseOption}
                    onPress={() => addExerciseToSession(exercise)}>
                    <Text style={styles.exerciseOptionName}>
                      {exercise.name}
                    </Text>
                    {exercise.category && (
                      <Text style={styles.exerciseOptionCategory}>
                        {exercise.category}
                      </Text>
                    )}
                  </Pressable>
                ))
              ) : (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateText}>
                    No exercises available. Please try again later.
                  </Text>
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      )}
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
  // New styles for Quick Workout functionality
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  removeButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  emptyExercises: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
    paddingVertical: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    maxHeight: '85%',
    width: '95%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  exerciseList: {
    maxHeight: 400,
    width: '100%',
  },
  exerciseOption: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
    width: '100%',
  },
  exerciseOptionName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  exerciseOptionCategory: {
    fontSize: 14,
    color: '#6b7280',
  },
  emptyState: {
    padding: 20,
    alignItems: 'center',
  },
  emptyStateText: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
});
