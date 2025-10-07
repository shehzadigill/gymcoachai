import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import {Card, LoadingSpinner, Button} from '../components/common/UI';
import apiClient from '../services/api';

interface WorkoutPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  durationWeeks: number;
  frequencyPerWeek: number;
  exercises: WorkoutPlanExercise[];
  createdAt: string;
  updatedAt: string;
  isActive: boolean;
}

interface WorkoutPlanExercise {
  exerciseId: string;
  name: string;
  sets: number;
  reps?: number;
  durationSeconds?: number;
  weight?: number;
  restSeconds?: number;
  notes?: string;
  order: number;
}

interface Exercise {
  id: string;
  name: string;
  description?: string;
  category: string;
  muscleGroups: string[];
  equipment: string[];
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  instructions: string[];
  tips?: string;
  isSystem: boolean;
  tags: string[];
}

export default function WorkoutsScreen({navigation}: any) {
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<
    'sessions' | 'plans' | 'exercises'
  >('sessions');
  const [error, setError] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [exercisesError, setExercisesError] = useState<string | null>(null);

  useEffect(() => {
    loadWorkouts();
    loadWorkoutPlans();
    if (activeView === 'exercises') {
      loadExercises();
    }
  }, [activeView]);

  const loadWorkouts = async () => {
    try {
      setLoading(true);
      setError(null);

      const [workoutsData, sessionsData] = await Promise.allSettled([
        apiClient.getWorkouts(),
        apiClient.getWorkoutSessions(),
      ]);

      if (workoutsData.status === 'fulfilled') {
        setWorkouts(workoutsData.value || []);
      } else {
        console.warn('Failed to load workouts:', workoutsData.reason);
      }

      if (sessionsData.status === 'fulfilled') {
        const sessions = sessionsData.value || [];
        // Transform API response to frontend format
        const transformedSessions = sessions.map((session: any) => ({
          id: session.id || session.WorkoutSessionId,
          name: session.name || session.Name || 'Workout Session',
          description: session.description || session.Description || '',
          createdAt:
            session.createdAt || session.created_at || new Date().toISOString(),
          status: session.status || session.Status || 'planned',
          exercises: session.exercises || session.Exercises || [],
          startTime: session.startTime || session.start_time,
          endTime: session.endTime || session.end_time,
          workout: session.workout,
        }));
        setSessions(transformedSessions);
      } else {
        console.warn('Failed to load sessions:', sessionsData.reason);
      }
    } catch (error) {
      console.error('Error loading workouts:', error);
      setError(
        error instanceof Error ? error.message : 'Failed to load workouts',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadWorkoutPlans = async () => {
    try {
      setPlansLoading(true);
      setPlansError(null);

      const response = await apiClient.getWorkouts(); // This actually gets workout plans
      if (response && Array.isArray(response)) {
        const transformedPlans: WorkoutPlan[] = response.map((plan: any) => ({
          id: plan.id || plan.WorkoutPlanId,
          userId: plan.userId || plan.UserId,
          name: plan.name || plan.Name || 'Workout Plan',
          description: plan.description || plan.Description,
          difficulty: plan.difficulty || plan.Difficulty || 'beginner',
          durationWeeks: plan.durationWeeks || plan.duration_weeks || 4,
          frequencyPerWeek:
            plan.frequencyPerWeek || plan.frequency_per_week || 3,
          exercises: plan.exercises || plan.Exercises || [],
          createdAt:
            plan.createdAt || plan.created_at || new Date().toISOString(),
          updatedAt:
            plan.updatedAt || plan.updated_at || new Date().toISOString(),
          isActive: plan.isActive ?? plan.is_active ?? true,
        }));
        setWorkoutPlans(transformedPlans);
      } else {
        setWorkoutPlans([]);
      }
    } catch (error) {
      console.error('Error loading workout plans:', error);
      setPlansError(
        error instanceof Error ? error.message : 'Failed to load workout plans',
      );
      setWorkoutPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const loadExercises = async () => {
    try {
      setExercisesLoading(true);
      setExercisesError(null);

      const response = await apiClient.getExercises();
      if (response && Array.isArray(response)) {
        const transformedExercises: Exercise[] = response.map(
          (exercise: any) => ({
            id: exercise.id || exercise.ExerciseId,
            name: exercise.name || exercise.Name || 'Exercise',
            description: exercise.description || exercise.Description,
            category: exercise.category || exercise.Category || 'other',
            muscleGroups:
              exercise.muscleGroups ||
              exercise.muscle_groups ||
              exercise.MuscleGroups ||
              [],
            equipment: exercise.equipment || exercise.Equipment || [],
            difficulty:
              exercise.difficulty || exercise.Difficulty || 'beginner',
            instructions: exercise.instructions || exercise.Instructions || [],
            tips: exercise.tips || exercise.Tips,
            isSystem: exercise.isSystem ?? exercise.is_system ?? true,
            tags: exercise.tags || exercise.Tags || [],
          }),
        );
        setExercises(transformedExercises);
      } else {
        setExercises([]);
      }
    } catch (error) {
      console.error('Error loading exercises:', error);
      setExercisesError(
        error instanceof Error ? error.message : 'Failed to load exercises',
      );
      setExercises([]);
    } finally {
      setExercisesLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadWorkouts(),
      loadWorkoutPlans(),
      activeView === 'exercises' ? loadExercises() : Promise.resolve(),
    ]);
  };

  const startQuickWorkout = () => {
    navigation.navigate('Session', {workoutId: null});
  };

  const createNewPlan = () => {
    navigation.navigate('CreatePlan');
  };

  const createNewExercise = () => {
    navigation.navigate('CreateExercise');
  };

  const renderTabButton = (
    tab: 'sessions' | 'plans' | 'exercises',
    title: string,
  ) => (
    <TouchableOpacity
      style={[styles.tabButton, activeView === tab && styles.activeTabButton]}
      onPress={() => setActiveView(tab)}>
      <Text
        style={[
          styles.tabButtonText,
          activeView === tab && styles.activeTabButtonText,
        ]}>
        {title}
      </Text>
    </TouchableOpacity>
  );

  if (loading && !workouts.length && !workoutPlans.length) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const renderSessionsView = () => (
    <>
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
    </>
  );

  const renderPlansView = () => (
    <>
      {/* Create Plan Action */}
      <View style={styles.quickActions}>
        <Button
          title="➕ Create New Plan"
          onPress={createNewPlan}
          style={styles.createButton}
        />
      </View>

      {/* Workout Plans */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>My Workout Plans</Text>
        {plansLoading ? (
          <LoadingSpinner />
        ) : plansError ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Error loading workout plans</Text>
            <Text style={styles.emptySubtext}>{plansError}</Text>
          </Card>
        ) : workoutPlans && workoutPlans.length > 0 ? (
          workoutPlans.map(plan => (
            <Card key={plan.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutName}>{plan.name}</Text>
                <View
                  style={[
                    styles.difficultyBadge,
                    getDifficultyStyle(plan.difficulty),
                  ]}>
                  <Text style={styles.difficultyText}>{plan.difficulty}</Text>
                </View>
              </View>
              {plan.description && (
                <Text style={styles.workoutDescription}>
                  {plan.description}
                </Text>
              )}
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutDetail}>
                  {plan.exercises.length} exercises
                </Text>
                <Text style={styles.workoutDetail}>
                  {plan.durationWeeks} weeks
                </Text>
                <Text style={styles.workoutDetail}>
                  {plan.frequencyPerWeek}x per week
                </Text>
              </View>
              <View style={styles.workoutActions}>
                <Button
                  title="View Details"
                  variant="outline"
                  size="small"
                  onPress={() =>
                    navigation.navigate('WorkoutDetail', {
                      workoutId: plan.id,
                    })
                  }
                  style={styles.actionButton}
                />
                <Button
                  title="Start Workout"
                  size="small"
                  onPress={() =>
                    navigation.navigate('Session', {workoutId: plan.id})
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
    </>
  );

  const renderExercisesView = () => (
    <>
      {/* Create Exercise Action */}
      <View style={styles.quickActions}>
        <Button
          title="➕ Create New Exercise"
          onPress={createNewExercise}
          style={styles.createButton}
        />
      </View>

      {/* Exercise Library */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Exercise Library</Text>
        {exercisesLoading ? (
          <LoadingSpinner />
        ) : exercisesError ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Error loading exercises</Text>
            <Text style={styles.emptySubtext}>{exercisesError}</Text>
          </Card>
        ) : exercises && exercises.length > 0 ? (
          exercises.slice(0, 10).map(exercise => (
            <Card key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <View
                  style={[
                    styles.difficultyBadge,
                    getDifficultyStyle(exercise.difficulty),
                  ]}>
                  <Text style={styles.difficultyText}>
                    {exercise.difficulty}
                  </Text>
                </View>
              </View>
              {exercise.description && (
                <Text style={styles.exerciseDescription}>
                  {exercise.description}
                </Text>
              )}
              <View style={styles.exerciseInfo}>
                <Text style={styles.exerciseDetail}>
                  Category: {exercise.category}
                </Text>
                {exercise.muscleGroups.length > 0 && (
                  <Text style={styles.exerciseDetail}>
                    Muscles: {exercise.muscleGroups.join(', ')}
                  </Text>
                )}
                {exercise.equipment.length > 0 && (
                  <Text style={styles.exerciseDetail}>
                    Equipment: {exercise.equipment.join(', ')}
                  </Text>
                )}
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>No exercises found</Text>
            <Text style={styles.emptySubtext}>Create your first exercise!</Text>
          </Card>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Workouts</Text>
          <Text style={styles.subtitle}>
            Manage your workouts, plans, and exercises
          </Text>
        </View>

        {/* Tabs */}
        <View style={styles.tabContainer}>
          {renderTabButton('sessions', 'Sessions')}
          {renderTabButton('plans', 'Plans')}
          {renderTabButton('exercises', 'Exercises')}
        </View>

        {/* Content based on active view */}
        {activeView === 'sessions' && renderSessionsView()}
        {activeView === 'plans' && renderPlansView()}
        {activeView === 'exercises' && renderExercisesView()}
      </ScrollView>
    </SafeAreaView>
  );
}

const getStatusStyle = (status: string) => {
  const statusColors: Record<string, any> = {
    completed: {color: '#10b981'},
    in_progress: {color: '#f59e0b'},
    planned: {color: '#6b7280'},
    cancelled: {color: '#ef4444'},
  };
  return statusColors[status] || {color: '#6b7280'};
};

const getDifficultyStyle = (difficulty: string) => {
  const difficultyColors: Record<string, any> = {
    easy: {backgroundColor: '#dcfce7'},
    medium: {backgroundColor: '#fed7aa'},
    hard: {backgroundColor: '#fecaca'},
  };
  return difficultyColors[difficulty] || {backgroundColor: '#f3f4f6'};
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
  // Tab styles
  tabContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    marginHorizontal: 20,
    padding: 4,
  },
  tabButton: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTabButton: {
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTabButtonText: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  quickWorkoutButton: {
    backgroundColor: '#ef4444',
  },
  createButton: {
    backgroundColor: '#10b981',
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
  // Exercise styles
  exerciseCard: {
    marginBottom: 12,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  exerciseDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  exerciseInfo: {
    gap: 4,
  },
  exerciseDetail: {
    fontSize: 14,
    color: '#374151',
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
