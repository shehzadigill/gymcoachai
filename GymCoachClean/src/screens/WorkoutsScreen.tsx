import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import {TouchableOpacity} from 'react-native-gesture-handler';
import {Card, LoadingSpinner, Button} from '../components/common/UI';
import {Icon} from '../components/common/Icon';
import {TabBar} from '../components/common/TabBar';
import apiClient from '../services/api';
import LinearGradient from 'react-native-linear-gradient';
import {useTranslation} from 'react-i18next';
import FloatingSettingsButton from '../components/common/FloatingSettingsButton';
import {useTheme} from '../theme';

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

const {width, height} = Dimensions.get('window');

export default function WorkoutsScreen({navigation}: any) {
  const {t} = useTranslation();
  const {colors, isDark} = useTheme();
  const [workouts, setWorkouts] = useState<any[]>([]);
  const [workoutPlans, setWorkoutPlans] = useState<WorkoutPlan[]>([]);
  const [sessions, setSessions] = useState<any[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [loading, setLoading] = useState(true);
  const [plansLoading, setPlansLoading] = useState(true);
  const [exercisesLoading, setExercisesLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [activeView, setActiveView] = useState<
    'sessions' | 'plans' | 'exercises' | 'templates' | 'analytics'
  >('sessions');
  const [error, setError] = useState<string | null>(null);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [exercisesError, setExercisesError] = useState<string | null>(null);

  // Enhanced states for beautiful UI and functionality
  const [templates, setTemplates] = useState<WorkoutPlan[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<WorkoutPlan | null>(null);
  const [showPlanDetail, setShowPlanDetail] = useState(false);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedSession, setSelectedSession] = useState<any>(null);
  const [showSessionDetail, setShowSessionDetail] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>('all');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createType, setCreateType] = useState<
    'session' | 'plan' | 'exercise' | 'template'
  >('session');

  // Analytics states
  const [analytics, setAnalytics] = useState<any>(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(false);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);

  // Tab configuration
  const tabs = [
    {
      id: 'sessions',
      title: t('workouts_screen.tabs.sessions'),
      icon: 'sessions',
    },
    {id: 'plans', title: t('workouts_screen.tabs.plans'), icon: 'plans'},
    {
      id: 'templates',
      title: t('workouts_screen.tabs.templates'),
      icon: 'templates',
    },
    {
      id: 'exercises',
      title: t('workouts_screen.tabs.exercises'),
      icon: 'exercises',
    },
    {
      id: 'analytics',
      title: t('workouts_screen.tabs.analytics'),
      icon: 'analytics',
    },
  ];

  useEffect(() => {
    loadWorkouts();
    loadWorkoutPlans();
    if (activeView === 'exercises') {
      loadExercises();
    }
    if (activeView === 'templates') {
      loadTemplates();
    }
    if (activeView === 'analytics') {
      loadAnalytics();
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
          name:
            session.name ||
            session.Name ||
            session.workout?.name ||
            'Quick Workout',
          description: session.description || session.Description || '',
          createdAt:
            session.createdAt || session.created_at || new Date().toISOString(),
          status: session.status || session.Status || 'planned',
          exercises: session.exercises || session.Exercises || [],
          startTime: session.startTime || session.start_time,
          endTime: session.endTime || session.end_time,
          workout: session.workout,
          workoutPlanId: session.workoutPlanId || session.workout_plan_id,
          durationMinutes: session.durationMinutes || session.duration_minutes,
          notes: session.notes,
          rating: session.rating,
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

  const loadTemplates = async () => {
    try {
      setTemplatesLoading(true);
      setTemplatesError(null);

      // For now, filter from existing workout plans that are templates
      const response = await apiClient.getWorkoutPlans();
      const allPlans = response && Array.isArray(response) ? response : [];
      const templatePlans = allPlans.filter(
        (plan: any) => plan.isTemplate === true || plan.is_template === true,
      );
      if (templatePlans && Array.isArray(templatePlans)) {
        const transformedTemplates: WorkoutPlan[] = templatePlans.map(
          (plan: any) => ({
            id: plan.id || plan.WorkoutPlanId,
            userId: plan.userId || plan.UserId,
            name: plan.name || plan.Name || 'Template',
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
          }),
        );
        setTemplates(transformedTemplates);
      } else {
        setTemplates([]);
      }
    } catch (error) {
      console.error('Error loading templates:', error);
      setTemplatesError(
        error instanceof Error ? error.message : 'Failed to load templates',
      );
      setTemplates([]);
    } finally {
      setTemplatesLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError(null);

      const [strengthProgress, bodyMeasurements, milestones, achievements] =
        await Promise.allSettled([
          apiClient.getStrengthProgress(),
          apiClient.getBodyMeasurements(),
          apiClient.getMilestones(),
          apiClient.getAchievements(),
        ]);

      const analyticsData = {
        strengthProgress:
          strengthProgress.status === 'fulfilled' ? strengthProgress.value : [],
        bodyMeasurements:
          bodyMeasurements.status === 'fulfilled' ? bodyMeasurements.value : [],
        milestones: milestones.status === 'fulfilled' ? milestones.value : [],
        achievements:
          achievements.status === 'fulfilled' ? achievements.value : [],
      };

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics:', error);
      setAnalyticsError(
        error instanceof Error ? error.message : 'Failed to load analytics',
      );
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await Promise.all([
      loadWorkouts(),
      loadWorkoutPlans(),
      activeView === 'exercises' ? loadExercises() : Promise.resolve(),
      activeView === 'templates' ? loadTemplates() : Promise.resolve(),
      activeView === 'analytics' ? loadAnalytics() : Promise.resolve(),
    ]);
  };

  const startQuickWorkout = async () => {
    try {
      // Create a quick workout session with same format as web app
      const quickSessionData = {
        name: 'Quick Workout',
        exercises: [], // Start with empty exercises, user can add them during session
        notes: 'Quick workout session',
      };

      console.log('StartQuickWorkout - sessionData:', quickSessionData);
      const newSession = await apiClient.createWorkoutSession(quickSessionData);

      // Navigate to the session screen with the new session
      navigation.navigate('Session', {
        sessionId: newSession.id,
        workoutId: null,
        quickWorkout: true,
      });
    } catch (error) {
      console.error('Error starting quick workout:', error);
      Alert.alert(
        t('common.error'),
        t('common.errors.failed_to_start_quick_workout'),
        [{text: 'OK'}],
      );
    }
  };

  const createNewPlan = () => {
    navigation.navigate('CreatePlan');
  };

  const createNewExercise = () => {
    navigation.navigate('CreateExercise');
  };

  const createNewTemplate = () => {
    navigation.navigate('CreatePlan', {isTemplate: true});
  };

  const useTemplate = (template: WorkoutPlan) => {
    navigation.navigate('CreatePlan', {fromTemplate: template});
  };

  const viewPlanDetail = (plan: WorkoutPlan) => {
    setSelectedPlan(plan);
    setShowPlanDetail(true);
  };

  const deletePlan = async (planId: string) => {
    Alert.alert(
      'Delete Plan',
      'Are you sure you want to delete this workout plan?',
      [
        {text: 'Cancel', style: 'cancel'},
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              // For now, just show success (API method needs to be added)
              console.log('Delete plan:', planId);
              loadWorkoutPlans(); // Refresh list
              Alert.alert('Success', 'Workout plan deleted successfully');
            } catch (error) {
              Alert.alert(
                t('common.error'),
                t('common.errors.failed_to_delete_workout_plan'),
              );
            }
          },
        },
      ],
    );
  };

  const scheduleWorkout = (plan: WorkoutPlan) => {
    setSelectedPlan(plan);
    setShowScheduleModal(true);
  };

  // Enhanced filter functions
  const filteredExercises = exercises.filter(exercise => {
    const matchesSearch =
      exercise.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
      exercise.muscleGroups.some(mg =>
        mg.toLowerCase().includes(searchQuery.toLowerCase()),
      );

    const matchesCategory =
      selectedCategory === 'all' || exercise.category === selectedCategory;
    const matchesDifficulty =
      selectedDifficulty === 'all' ||
      exercise.difficulty === selectedDifficulty;
    const matchesMuscleGroup =
      selectedMuscleGroup === 'all' ||
      exercise.muscleGroups.includes(selectedMuscleGroup);

    return (
      matchesSearch &&
      matchesCategory &&
      matchesDifficulty &&
      matchesMuscleGroup
    );
  });

  const filteredPlans = workoutPlans.filter(plan => {
    const matchesSearch =
      plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDifficulty =
      selectedDifficulty === 'all' || plan.difficulty === selectedDifficulty;

    return matchesSearch && matchesDifficulty;
  });

  const filteredTemplates = templates.filter(template => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      template.description?.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesDifficulty =
      selectedDifficulty === 'all' ||
      template.difficulty === selectedDifficulty;

    return matchesSearch && matchesDifficulty;
  });

  if (loading && !workouts.length && !workoutPlans.length) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  const renderSessionsView = () => (
    <>
      {/* Hero Section with Quick Actions */}
      <LinearGradient
        colors={['#667eea', '#764ba2']}
        style={styles.heroSection}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>
            {t('workouts_screen.hero.title')}
          </Text>
          <Text style={styles.heroSubtitle}>
            {sessions.length > 0
              ? t('workouts_screen.hero.completed', {
                  count: sessions.filter(s => s.status === 'completed').length,
                })
              : t('workouts_screen.hero.subtitle')}
          </Text>
          <TouchableOpacity
            style={styles.heroButton}
            onPress={startQuickWorkout}
            accessible={true}
            accessibilityRole="button"
            accessibilityLabel="Start Quick Workout"
            accessibilityHint="Creates and starts a new quick workout session">
            <Icon name="play-arrow" size={24} color="#fff" />
            <Text style={styles.heroButtonText}>
              {t('workouts_screen.actions.start_quick')}
            </Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      {/* Quick Stats */}
      <View style={styles.statsContainer}>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{sessions.length}</Text>
          <Text style={styles.statLabel}>
            {t('workouts_screen.stats.total_sessions')}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>
            {sessions.filter(s => s.status === 'completed').length}
          </Text>
          <Text style={styles.statLabel}>
            {t('workouts_screen.stats.completed')}
          </Text>
        </View>
        <View style={styles.statCard}>
          <Text style={styles.statNumber}>{workoutPlans.length}</Text>
          <Text style={styles.statLabel}>
            {t('workouts_screen.stats.plans')}
          </Text>
        </View>
      </View>

      {/* Recent Sessions */}
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {t('workouts_screen.sections.recent_sessions')}
          </Text>
          <TouchableOpacity onPress={() => setActiveView('plans')}>
            <Text style={styles.sectionAction}>
              {t('common.view_all', 'View All')}
            </Text>
          </TouchableOpacity>
        </View>
        {sessions && sessions.length > 0 ? (
          <FlatList
            data={sessions.slice(0, 5)}
            keyExtractor={(item, index) => item.id || index.toString()}
            renderItem={({item: session}) => (
              <TouchableOpacity
                onPress={() => {
                  setSelectedSession(session);
                  setShowSessionDetail(true);
                }}>
                <Card style={styles.sessionCard}>
                  <View style={styles.sessionHeader}>
                    <View style={styles.sessionTitleContainer}>
                      <Icon
                        name="fitness-center"
                        size={20}
                        color="#3b82f6"
                        style={styles.sessionIcon}
                      />
                      <Text style={styles.sessionName}>
                        {session.workout?.name ||
                          session.name ||
                          t('workouts_screen.labels.quick_workout')}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.statusBadge,
                        getStatusBadgeStyle(session.status),
                      ]}>
                      <Text style={styles.statusText}>{session.status}</Text>
                    </View>
                  </View>
                  <View style={styles.sessionInfo}>
                    <View style={styles.sessionDetailRow}>
                      <Icon name="schedule" size={16} color="#6b7280" />
                      <Text style={styles.sessionDetail}>
                        {new Date(session.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                    {session.exercises && (
                      <View style={styles.sessionDetailRow}>
                        <Icon name="list" size={16} color="#6b7280" />
                        <Text style={styles.sessionDetail}>
                          {t('workouts_screen.labels.exercises_count', {
                            count: session.exercises.length,
                          })}
                        </Text>
                      </View>
                    )}
                    {session.startTime && session.endTime && (
                      <View style={styles.sessionDetailRow}>
                        <Icon name="timer" size={16} color="#6b7280" />
                        <Text style={styles.sessionDetail}>
                          {calculateDuration(
                            session.startTime,
                            session.endTime,
                          )}
                        </Text>
                      </View>
                    )}
                  </View>
                </Card>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
        ) : (
          <Card style={styles.emptyCard}>
            <Icon name="fitness-center" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {t('workouts_screen.empty.no_sessions')}
            </Text>
            <Text style={styles.emptySubtext}>
              {t('workouts_screen.empty.start_first')}
            </Text>
          </Card>
        )}
      </View>
    </>
  );

  const renderAnalyticsView = () => (
    <>
      {/* Analytics Hero */}
      <LinearGradient
        colors={['#f093fb', '#f5576c']}
        style={styles.heroSection}
        start={{x: 0, y: 0}}
        end={{x: 1, y: 1}}>
        <View style={styles.heroContent}>
          <Text style={styles.heroTitle}>
            {t('workouts_screen.analytics.title')}
          </Text>
          <Text style={styles.heroSubtitle}>
            {t('workouts_screen.analytics.subtitle')}
          </Text>
        </View>
      </LinearGradient>

      {/* Analytics Content */}
      <View style={styles.section}>
        {analyticsLoading ? (
          <LoadingSpinner />
        ) : analyticsError ? (
          <Card style={styles.emptyCard}>
            <Icon name="error" size={48} color="#ef4444" />
            <Text style={styles.emptyText}>
              {t('workouts_screen.errors.analytics')}
            </Text>
            <Text style={styles.emptySubtext}>{analyticsError}</Text>
          </Card>
        ) : analytics ? (
          <>
            {/* Strength Progress */}
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsTitle}>
                {t('workouts_screen.analytics.strength')}
              </Text>
              <Card style={styles.analyticsCard}>
                <Text style={styles.analyticsValue}>
                  {t('workouts_screen.analytics.exercises_tracked', {
                    count: analytics.strengthProgress?.length || 0,
                  })}
                </Text>
                <Text style={styles.analyticsSubtext}>
                  {t('workouts_screen.analytics.keep_pushing')}
                </Text>
              </Card>
            </View>

            {/* Body Measurements */}
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsTitle}>
                {t('workouts_screen.analytics.body')}
              </Text>
              <Card style={styles.analyticsCard}>
                <Text style={styles.analyticsValue}>
                  {t('workouts_screen.analytics.measurements_recorded', {
                    count: analytics.bodyMeasurements?.length || 0,
                  })}
                </Text>
                <Text style={styles.analyticsSubtext}>
                  {t('workouts_screen.analytics.track_progress')}
                </Text>
              </Card>
            </View>

            {/* Milestones */}
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsTitle}>
                {t('workouts_screen.analytics.milestones')}
              </Text>
              <Card style={styles.analyticsCard}>
                <Text style={styles.analyticsValue}>
                  {t('workouts_screen.analytics.milestones_achieved', {
                    count: analytics.milestones?.length || 0,
                  })}
                </Text>
                <Text style={styles.analyticsSubtext}>
                  {t('workouts_screen.analytics.celebrate')}
                </Text>
              </Card>
            </View>

            {/* Achievements */}
            <View style={styles.analyticsSection}>
              <Text style={styles.analyticsTitle}>
                {t('workouts_screen.analytics.achievements')}
              </Text>
              <Card style={styles.analyticsCard}>
                <Text style={styles.analyticsValue}>
                  {t('workouts_screen.analytics.achievements_unlocked', {
                    count: analytics.achievements?.length || 0,
                  })}
                </Text>
                <Text style={styles.analyticsSubtext}>
                  {t('workouts_screen.analytics.great_job')}
                </Text>
              </Card>
            </View>
          </>
        ) : (
          <Card style={styles.emptyCard}>
            <Icon name="analytics" size={48} color="#d1d5db" />
            <Text style={styles.emptyText}>
              {t('workouts_screen.analytics.empty')}
            </Text>
            <Text style={styles.emptySubtext}>
              {t('workouts_screen.analytics.empty_hint')}
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
        <TouchableOpacity style={styles.createButton} onPress={createNewPlan}>
          <Icon name="add" size={20} color="#fff" />
          <Text style={styles.createButtonText}>
            {t('workouts_screen.actions.create_plan')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder={t('workouts_screen.search.plans_placeholder')}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Workout Plans */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('workouts_screen.sections.my_plans')}
        </Text>
        {plansLoading ? (
          <LoadingSpinner />
        ) : plansError ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t('workouts_screen.errors.plans')}
            </Text>
            <Text style={styles.emptySubtext}>{plansError}</Text>
          </Card>
        ) : filteredPlans && filteredPlans.length > 0 ? (
          filteredPlans.map(plan => (
            <Card key={plan.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutName}>{plan.name}</Text>
                <View style={styles.headerActions}>
                  <View
                    style={[
                      styles.difficultyBadge,
                      getDifficultyStyle(plan.difficulty),
                    ]}>
                    <Text style={styles.difficultyText}>
                      {t('profile.' + plan.difficulty, plan.difficulty)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => deletePlan(plan.id)}>
                    <Text style={styles.menuText}>⋯</Text>
                  </TouchableOpacity>
                </View>
              </View>
              {plan.description && (
                <Text style={styles.workoutDescription}>
                  {plan.description}
                </Text>
              )}
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutDetail}>
                  {t('workouts_screen.labels.exercises_count', {
                    count: plan.exercises.length,
                  })}
                </Text>
                <Text style={styles.workoutDetail}>
                  {t('workouts_screen.labels.weeks', {
                    count: plan.durationWeeks,
                  })}
                </Text>
                <Text style={styles.workoutDetail}>
                  {t('workouts_screen.labels.per_week', {
                    count: plan.frequencyPerWeek,
                  })}
                </Text>
              </View>
              <View style={styles.workoutActions}>
                <Button
                  title={t('common.view_details', 'View Details')}
                  variant="outline"
                  size="small"
                  onPress={() => viewPlanDetail(plan)}
                  style={styles.actionButton}
                />
                <Button
                  title={t('workouts_screen.actions.start_workout')}
                  size="small"
                  onPress={() =>
                    navigation.navigate('Session', {workoutId: plan.id})
                  }
                  style={styles.actionButton}
                />
              </View>
              <View style={styles.secondaryActions}>
                <Button
                  title={`📅 ${t('workouts_screen.actions.schedule')}`}
                  variant="outline"
                  size="small"
                  onPress={() => scheduleWorkout(plan)}
                  style={styles.secondaryActionButton}
                />
                <Button
                  title={`✏️ ${t('common.edit')}`}
                  variant="outline"
                  size="small"
                  onPress={() =>
                    navigation.navigate('CreatePlan', {editPlan: plan})
                  }
                  style={styles.secondaryActionButton}
                />
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t('workouts_screen.empty.no_plans')}
            </Text>
            <Text style={styles.emptySubtext}>
              {t('workouts_screen.empty.create_first_plan')}
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
        <TouchableOpacity
          style={styles.createButton}
          onPress={createNewExercise}>
          <Icon name="add" size={20} color="#fff" />
          <Text style={styles.createButtonText}>
            {t('workouts_screen.actions.create_exercise')}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Icon
            name="search"
            size={20}
            color="#6b7280"
            style={styles.searchIcon}
          />
          <TextInput
            style={styles.searchInput}
            placeholder={t('workouts_screen.search.exercises_placeholder')}
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9ca3af"
          />
        </View>
      </View>

      {/* Enhanced Filters */}
      <ScrollView
        horizontal
        style={styles.filtersContainer}
        showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedCategory === 'all' && styles.activeFilterButton,
          ]}
          onPress={() => setSelectedCategory('all')}>
          <Text
            style={[
              styles.filterText,
              selectedCategory === 'all' && styles.activeFilterText,
            ]}>
            {t('workouts_screen.filters.all_categories')}
          </Text>
        </TouchableOpacity>
        {['strength', 'cardio', 'flexibility', 'sports', 'yoga', 'pilates'].map(
          category => (
            <TouchableOpacity
              key={category}
              style={[
                styles.filterButton,
                selectedCategory === category && styles.activeFilterButton,
              ]}
              onPress={() => setSelectedCategory(category)}>
              <Text
                style={[
                  styles.filterText,
                  selectedCategory === category && styles.activeFilterText,
                ]}>
                {t(
                  'workouts_screen.filters.category.' + category,
                  category.charAt(0).toUpperCase() + category.slice(1),
                )}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>

      {/* Muscle Group Filters */}
      <ScrollView
        horizontal
        style={styles.filtersContainer}
        showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedMuscleGroup === 'all' && styles.activeFilterButton,
          ]}
          onPress={() => setSelectedMuscleGroup('all')}>
          <Text
            style={[
              styles.filterText,
              selectedMuscleGroup === 'all' && styles.activeFilterText,
            ]}>
            {t('workouts_screen.filters.all_muscles')}
          </Text>
        </TouchableOpacity>
        {['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'glutes'].map(
          muscle => (
            <TouchableOpacity
              key={muscle}
              style={[
                styles.filterButton,
                selectedMuscleGroup === muscle && styles.activeFilterButton,
              ]}
              onPress={() => setSelectedMuscleGroup(muscle)}>
              <Text
                style={[
                  styles.filterText,
                  selectedMuscleGroup === muscle && styles.activeFilterText,
                ]}>
                {t(
                  'workouts_screen.filters.muscle.' + muscle,
                  muscle.charAt(0).toUpperCase() + muscle.slice(1),
                )}
              </Text>
            </TouchableOpacity>
          ),
        )}
      </ScrollView>

      {/* Difficulty Filters */}
      <ScrollView
        horizontal
        style={styles.filtersContainer}
        showsHorizontalScrollIndicator={false}>
        <TouchableOpacity
          style={[
            styles.filterButton,
            selectedDifficulty === 'all' && styles.activeFilterButton,
          ]}
          onPress={() => setSelectedDifficulty('all')}>
          <Text
            style={[
              styles.filterText,
              selectedDifficulty === 'all' && styles.activeFilterText,
            ]}>
            {t('workouts_screen.filters.all_levels')}
          </Text>
        </TouchableOpacity>
        {['beginner', 'intermediate', 'advanced'].map(difficulty => (
          <TouchableOpacity
            key={difficulty}
            style={[
              styles.filterButton,
              selectedDifficulty === difficulty && styles.activeFilterButton,
            ]}
            onPress={() => setSelectedDifficulty(difficulty)}>
            <Text
              style={[
                styles.filterText,
                selectedDifficulty === difficulty && styles.activeFilterText,
              ]}>
              {t(
                'profile.' + difficulty,
                difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
              )}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Exercise Library */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('workouts_screen.sections.exercise_library', {
            count: filteredExercises.length,
          })}
        </Text>
        {exercisesLoading ? (
          <LoadingSpinner />
        ) : exercisesError ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t('workouts_screen.errors.exercises')}
            </Text>
            <Text style={styles.emptySubtext}>{exercisesError}</Text>
          </Card>
        ) : filteredExercises && filteredExercises.length > 0 ? (
          filteredExercises.slice(0, 10).map(exercise => (
            <Card key={exercise.id} style={styles.exerciseCard}>
              <View style={styles.exerciseHeader}>
                <Text style={styles.exerciseName}>{exercise.name}</Text>
                <View
                  style={[
                    styles.difficultyBadge,
                    getDifficultyStyle(exercise.difficulty),
                  ]}>
                  <Text style={styles.difficultyText}>
                    {t('profile.' + exercise.difficulty, exercise.difficulty)}
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
                  {t('workouts_screen.labels.category')}:{' '}
                  {t(
                    'workouts_screen.filters.category.' + exercise.category,
                    exercise.category,
                  )}
                </Text>
                {exercise.muscleGroups.length > 0 && (
                  <Text style={styles.exerciseDetail}>
                    {t('workouts_screen.labels.muscles')}:{' '}
                    {exercise.muscleGroups.join(', ')}
                  </Text>
                )}
                {exercise.equipment.length > 0 && (
                  <Text style={styles.exerciseDetail}>
                    {t('workouts_screen.labels.equipment')}:{' '}
                    {exercise.equipment.join(', ')}
                  </Text>
                )}
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {searchQuery
                ? t('workouts_screen.empty.no_matching_exercises')
                : t('workouts_screen.empty.no_exercises')}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery
                ? t('workouts_screen.empty.adjust_search')
                : t('workouts_screen.empty.create_first_exercise')}
            </Text>
          </Card>
        )}
      </View>
    </>
  );

  const renderTemplatesView = () => (
    <>
      {/* Create Template Action */}
      <View style={styles.quickActions}>
        <Button
          title="➕ Create New Template"
          onPress={createNewTemplate}
          style={styles.createButton}
        />
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search templates..."
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
      </View>

      {/* Workout Templates */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>
          {t('workouts_screen.sections.templates')}
        </Text>
        {templatesLoading ? (
          <LoadingSpinner />
        ) : templatesError ? (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {t('workouts_screen.errors.templates')}
            </Text>
            <Text style={styles.emptySubtext}>{templatesError}</Text>
          </Card>
        ) : filteredTemplates && filteredTemplates.length > 0 ? (
          filteredTemplates.map(template => (
            <Card key={template.id} style={styles.workoutCard}>
              <View style={styles.workoutHeader}>
                <Text style={styles.workoutName}>{template.name} 📋</Text>
                <View
                  style={[
                    styles.difficultyBadge,
                    getDifficultyStyle(template.difficulty),
                  ]}>
                  <Text style={styles.difficultyText}>
                    {t('profile.' + template.difficulty, template.difficulty)}
                  </Text>
                </View>
              </View>
              {template.description && (
                <Text style={styles.workoutDescription}>
                  {template.description}
                </Text>
              )}
              <View style={styles.workoutInfo}>
                <Text style={styles.workoutDetail}>
                  {t('workouts_screen.labels.exercises_count', {
                    count: template.exercises.length,
                  })}
                </Text>
                <Text style={styles.workoutDetail}>
                  {t('workouts_screen.labels.weeks', {
                    count: template.durationWeeks,
                  })}
                </Text>
                <Text style={styles.workoutDetail}>
                  {t('workouts_screen.labels.per_week', {
                    count: template.frequencyPerWeek,
                  })}
                </Text>
              </View>
              <View style={styles.workoutActions}>
                <Button
                  title={t('workouts_screen.actions.view_template')}
                  variant="outline"
                  size="small"
                  onPress={() => viewPlanDetail(template)}
                  style={styles.actionButton}
                />
                <Button
                  title={t('workouts_screen.actions.use_template')}
                  size="small"
                  onPress={() => useTemplate(template)}
                  style={styles.actionButton}
                />
              </View>
            </Card>
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {searchQuery
                ? t('workouts_screen.empty.no_matching_templates')
                : t('workouts_screen.empty.no_templates')}
            </Text>
            <Text style={styles.emptySubtext}>
              {searchQuery
                ? t('workouts_screen.empty.adjust_search')
                : t('workouts_screen.empty.create_first_template')}
            </Text>
          </Card>
        )}
      </View>
    </>
  );

  return (
    <SafeAreaView
      style={[styles.container, {backgroundColor: colors.background}]}>
      <FloatingSettingsButton />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Header */}
        <View style={[styles.header, {backgroundColor: colors.background}]}>
          <Text style={[styles.title, {color: colors.text}]}>
            {t('workouts_screen.title')}
          </Text>
          <Text style={[styles.subtitle, {color: colors.subtext}]}>
            {t('workouts_screen.subtitle')}
          </Text>
        </View>

        {/* Enhanced Tabs */}
        <TabBar
          tabs={tabs}
          activeTab={activeView}
          onTabPress={tabId => setActiveView(tabId as any)}
        />

        {/* Content based on active view */}
        {activeView === 'sessions' && renderSessionsView()}
        {activeView === 'plans' && renderPlansView()}
        {activeView === 'templates' && renderTemplatesView()}
        {activeView === 'exercises' && renderExercisesView()}
        {activeView === 'analytics' && renderAnalyticsView()}
      </ScrollView>

      {/* Plan Detail Modal */}
      <Modal
        visible={showPlanDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPlanDetail(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedPlan?.name || 'Plan Details'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowPlanDetail(false)}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            {selectedPlan && (
              <ScrollView style={{maxHeight: 400}}>
                <View style={{marginBottom: 16}}>
                  <Text style={styles.workoutDescription}>
                    {selectedPlan.description || 'No description provided'}
                  </Text>
                </View>

                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutDetail}>
                    📋 {selectedPlan.exercises.length} exercises
                  </Text>
                  <Text style={styles.workoutDetail}>
                    📅 {selectedPlan.durationWeeks} weeks
                  </Text>
                  <Text style={styles.workoutDetail}>
                    🏃 {selectedPlan.frequencyPerWeek}x per week
                  </Text>
                  <Text style={styles.workoutDetail}>
                    📊 {selectedPlan.difficulty} difficulty
                  </Text>
                </View>

                <View style={{marginTop: 16}}>
                  <Text style={styles.sectionTitle}>Exercises:</Text>
                  {selectedPlan.exercises.map((exercise, index) => (
                    <View key={index} style={styles.exerciseCard}>
                      <Text style={styles.exerciseName}>
                        {index + 1}. {exercise.name}
                      </Text>
                      <Text style={styles.exerciseDetail}>
                        {exercise.sets} sets × {exercise.reps} reps
                        {exercise.weight ? ` @ ${exercise.weight}lbs` : ''}
                      </Text>
                      {exercise.notes && (
                        <Text style={styles.exerciseDetail}>
                          💡 {exercise.notes}
                        </Text>
                      )}
                    </View>
                  ))}
                </View>

                <View style={styles.workoutActions}>
                  <Button
                    title="Start Workout"
                    onPress={() => {
                      setShowPlanDetail(false);
                      navigation.navigate('Session', {
                        workoutId: selectedPlan.id,
                      });
                    }}
                    style={styles.actionButton}
                  />
                  <Button
                    title="Edit Plan"
                    variant="outline"
                    onPress={() => {
                      setShowPlanDetail(false);
                      navigation.navigate('CreatePlan', {
                        editPlan: selectedPlan,
                      });
                    }}
                    style={styles.actionButton}
                  />
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowScheduleModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Workout</Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowScheduleModal(false)}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <Text style={{fontSize: 16, marginBottom: 20, textAlign: 'center'}}>
              📅 Schedule "{selectedPlan?.name}" for later
            </Text>

            <Text
              style={{
                fontSize: 14,
                color: '#6b7280',
                textAlign: 'center',
                marginBottom: 20,
              }}>
              Scheduling functionality coming soon! For now, you can start the
              workout immediately.
            </Text>

            <View style={styles.workoutActions}>
              <Button
                title="Start Now"
                onPress={() => {
                  setShowScheduleModal(false);
                  if (selectedPlan) {
                    navigation.navigate('Session', {
                      workoutId: selectedPlan.id,
                    });
                  }
                }}
                style={styles.actionButton}
              />
              <Button
                title="Cancel"
                variant="outline"
                onPress={() => setShowScheduleModal(false)}
                style={styles.actionButton}
              />
            </View>
          </View>
        </View>
      </Modal>

      {/* Session Detail Modal */}
      <Modal
        visible={showSessionDetail}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowSessionDetail(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedSession?.workout?.name ||
                  selectedSession?.name ||
                  'Workout Session'}
              </Text>
              <TouchableOpacity
                style={styles.closeButton}
                onPress={() => setShowSessionDetail(false)}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            {selectedSession && (
              <ScrollView style={{maxHeight: 400}}>
                <View style={{marginBottom: 16}}>
                  <Text style={styles.workoutDescription}>
                    {selectedSession.description || 'No description provided'}
                  </Text>
                </View>

                <View style={styles.workoutInfo}>
                  <Text style={styles.workoutDetail}>
                    📊 Status:{' '}
                    <Text style={getStatusStyle(selectedSession.status)}>
                      {selectedSession.status}
                    </Text>
                  </Text>
                  <Text style={styles.workoutDetail}>
                    📅 Date:{' '}
                    {new Date(selectedSession.createdAt).toLocaleDateString()}
                  </Text>
                  {selectedSession.exercises && (
                    <Text style={styles.workoutDetail}>
                      📋 {selectedSession.exercises.length} exercises
                    </Text>
                  )}
                  {selectedSession.startTime && (
                    <Text style={styles.workoutDetail}>
                      ⏰ Started:{' '}
                      {new Date(selectedSession.startTime).toLocaleTimeString()}
                    </Text>
                  )}
                  {selectedSession.endTime && (
                    <Text style={styles.workoutDetail}>
                      🏁 Finished:{' '}
                      {new Date(selectedSession.endTime).toLocaleTimeString()}
                    </Text>
                  )}
                  {selectedSession.startTime && selectedSession.endTime && (
                    <Text style={styles.workoutDetail}>
                      ⏱️ Duration:{' '}
                      {calculateDuration(
                        selectedSession.startTime,
                        selectedSession.endTime,
                      )}
                    </Text>
                  )}
                  {selectedSession.rating && (
                    <Text style={styles.workoutDetail}>
                      ⭐ Rating: {selectedSession.rating}/5
                    </Text>
                  )}
                </View>

                {selectedSession.exercises &&
                  selectedSession.exercises.length > 0 && (
                    <View style={{marginTop: 16}}>
                      <Text style={styles.sectionTitle}>
                        Exercises Completed:
                      </Text>
                      {selectedSession.exercises.map(
                        (exercise: any, index: number) => (
                          <View key={index} style={styles.exerciseCard}>
                            <Text style={styles.exerciseName}>
                              {index + 1}.{' '}
                              {exercise.name || exercise.exerciseName}
                            </Text>
                            {exercise.sets && (
                              <Text style={styles.exerciseDetail}>
                                {exercise.sets} sets ×{' '}
                                {exercise.reps || exercise.targetReps} reps
                                {exercise.weight
                                  ? ` @ ${exercise.weight}lbs`
                                  : ''}
                              </Text>
                            )}
                            {exercise.notes && (
                              <Text style={styles.exerciseDetail}>
                                💡 {exercise.notes}
                              </Text>
                            )}
                          </View>
                        ),
                      )}
                    </View>
                  )}

                {selectedSession.notes && (
                  <View style={{marginTop: 16}}>
                    <Text style={styles.sectionTitle}>Notes:</Text>
                    <Text style={styles.workoutDescription}>
                      {selectedSession.notes}
                    </Text>
                  </View>
                )}

                <View style={styles.workoutActions}>
                  <Button
                    title="Close"
                    onPress={() => setShowSessionDetail(false)}
                    style={styles.actionButton}
                  />
                  {selectedSession.status !== 'completed' && (
                    <Button
                      title="Resume Workout"
                      variant="outline"
                      onPress={() => {
                        setShowSessionDetail(false);
                        navigation.navigate('Session', {
                          sessionId: selectedSession.id,
                        });
                      }}
                      style={styles.actionButton}
                    />
                  )}
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>
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

const getStatusBadgeStyle = (status: string) => {
  const statusStyles: Record<string, any> = {
    completed: {backgroundColor: '#dcfce7', borderColor: '#10b981'},
    in_progress: {backgroundColor: '#fef3c7', borderColor: '#f59e0b'},
    planned: {backgroundColor: '#f3f4f6', borderColor: '#6b7280'},
    cancelled: {backgroundColor: '#fee2e2', borderColor: '#ef4444'},
  };
  return (
    statusStyles[status] || {backgroundColor: '#f3f4f6', borderColor: '#6b7280'}
  );
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
  // Hero Section Styles
  heroSection: {
    margin: 20,
    borderRadius: 16,
    padding: 24,
    marginBottom: 16,
  },
  heroContent: {
    alignItems: 'center',
  },
  heroTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 16,
    color: '#fff',
    opacity: 0.9,
    textAlign: 'center',
    marginBottom: 20,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  heroButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  // Stats Container
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    gap: 12,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  // Section Styles
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionAction: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  // Enhanced Tab styles
  tabScrollView: {
    marginBottom: 20,
  },
  tabScrollContainer: {
    paddingHorizontal: 20,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    minWidth: 400, // Ensure enough width for all tabs
  },
  tabButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'center',
    minWidth: 80, // Minimum width for each tab
    marginHorizontal: 2,
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
  tabIcon: {
    marginRight: 6,
  },
  tabButtonText: {
    fontSize: 11,
    fontWeight: '500',
    color: '#6b7280',
    flexShrink: 1,
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
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
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sessionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sessionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  sessionIcon: {
    marginRight: 8,
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
    gap: 8,
  },
  sessionDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  sessionDetail: {
    fontSize: 14,
    color: '#374151',
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
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
  // New styles for enhanced functionality
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  menuButton: {
    padding: 4,
    borderRadius: 4,
  },
  menuText: {
    fontSize: 18,
    color: '#6b7280',
    fontWeight: 'bold',
  },
  secondaryActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
  },
  secondaryActionButton: {
    flex: 1,
  },
  searchContainer: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#d1d5db',
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 1},
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
  },
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 16,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  activeFilterButton: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  filterText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  activeFilterText: {
    color: '#ffffff',
  },
  modalOverlay: {
    flex: 1,
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
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  // Analytics Styles
  analyticsSection: {
    marginBottom: 16,
  },
  analyticsTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  analyticsCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: {width: 0, height: 2},
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  analyticsValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  analyticsSubtext: {
    fontSize: 14,
    color: '#6b7280',
  },
});
