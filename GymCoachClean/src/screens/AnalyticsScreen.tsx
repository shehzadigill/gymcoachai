import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Dimensions,
  Pressable,
  Alert,
} from 'react-native';
import {Card, LoadingSpinner, Button} from '../components/common/UI';
import apiClient from '../services/api';
import {
  StrengthProgress,
  BodyMeasurement,
  Milestone,
  Achievement,
} from '../types';
import {useTranslation} from 'react-i18next';
import FloatingSettingsButton from '../components/common/FloatingSettingsButton';
import {PerformanceInsightsPanel} from '../components/analytics/PerformanceInsightsPanel';
import {AchievementBadge} from '../components/analytics/AchievementBadge';
import {useTheme} from '../theme';

interface WorkoutAnalytics {
  total_workouts: number;
  total_duration_minutes: number;
  current_streak: number;
  longest_streak: number;
  favorite_exercises: string[];
  average_workout_duration: number;
  workouts_this_week: number;
  workouts_this_month: number;
  last_workout_date?: string;
  strength_progress: any[];
  body_measurements: any[];
  calories_burned_total?: number;
  calories_burned_this_week?: number;
  volume_load_total?: number;
  volume_load_trend?: number;
  intensity_score?: number;
  consistency_score?: number;
  personal_records_count?: number;
  achievement_count?: number;
  weekly_frequency?: number;
}

type TimeRange = '7d' | '30d' | '90d' | '1y' | 'all';
type ViewMode = 'overview' | 'detailed' | 'trends';

const {width} = Dimensions.get('window');

export default function AnalyticsScreen() {
  const {t} = useTranslation();
  const {colors, isDark} = useTheme();
  const [analytics, setAnalytics] = useState<WorkoutAnalytics | null>(null);
  const [strengthProgress, setStrengthProgress] = useState<any[]>([]);
  const [bodyMeasurements, setBodyMeasurements] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [insights, setInsights] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>('30d');
  const [viewMode, setViewMode] = useState<ViewMode>('overview');

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        strengthData,
        bodyData,
        milestonesData,
        achievementsData,
        workoutSessions,
        insightsData,
      ] = await Promise.allSettled([
        apiClient.getStrengthProgress(),
        apiClient.getBodyMeasurements(),
        apiClient.getMilestones(),
        apiClient.getAchievements(),
        apiClient.getWorkoutSessions(),
        apiClient.getWorkoutInsights(),
      ]);

      // Process strength progress data
      const strengthResults =
        strengthData.status === 'fulfilled' ? strengthData.value || [] : [];
      setStrengthProgress(strengthResults);

      // Process body measurements data
      const bodyResults =
        bodyData.status === 'fulfilled' ? bodyData.value || [] : [];
      setBodyMeasurements(bodyResults);

      // Process milestones data
      const milestonesResults =
        milestonesData.status === 'fulfilled' ? milestonesData.value || [] : [];
      setMilestones(milestonesResults);

      // Process achievements data
      const achievementsResults =
        achievementsData.status === 'fulfilled'
          ? achievementsData.value || []
          : [];
      setAchievements(achievementsResults);

      // Process insights data
      const insightsResults =
        insightsData.status === 'fulfilled' ? insightsData.value : null;
      setInsights(insightsResults);

      // Process workout sessions to create analytics summary
      const sessions =
        workoutSessions.status === 'fulfilled'
          ? workoutSessions.value || []
          : [];
      const completedSessions = sessions.filter(
        (s: any) => s.status === 'completed' || s.completed_at,
      );

      // Calculate analytics summary
      const totalWorkouts = completedSessions.length;
      const totalDuration = completedSessions.reduce(
        (sum: number, session: any) => {
          const duration =
            session.duration_minutes || session.DurationMinutes || 0;
          return sum + duration;
        },
        0,
      );

      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const workoutsThisWeek = completedSessions.filter((s: any) => {
        const sessionDate = new Date(
          s.createdAt || s.created_at || s.completedAt || s.completed_at,
        );
        return sessionDate >= weekAgo;
      }).length;

      const workoutsThisMonth = completedSessions.filter((s: any) => {
        const sessionDate = new Date(
          s.createdAt || s.created_at || s.completedAt || s.completed_at,
        );
        return sessionDate >= monthAgo;
      }).length;

      const lastWorkoutDate =
        completedSessions.length > 0
          ? (completedSessions[0] as any)?.completedAt ||
            (completedSessions[0] as any)?.completed_at ||
            (completedSessions[0] as any)?.createdAt
          : undefined;

      const analyticsData: WorkoutAnalytics = {
        total_workouts: totalWorkouts,
        total_duration_minutes: totalDuration,
        current_streak: calculateCurrentStreak(completedSessions),
        longest_streak: calculateLongestStreak(completedSessions),
        favorite_exercises: extractFavoriteExercises(completedSessions),
        average_workout_duration:
          totalWorkouts > 0 ? Math.round(totalDuration / totalWorkouts) : 0,
        workouts_this_week: workoutsThisWeek,
        workouts_this_month: workoutsThisMonth,
        last_workout_date: lastWorkoutDate,
        strength_progress: strengthResults,
        body_measurements: bodyResults,
        personal_records_count: strengthResults.length,
        achievement_count: achievementsResults.length,
        weekly_frequency: workoutsThisWeek,
      };

      setAnalytics(analyticsData);
    } catch (error) {
      console.error('Error loading analytics data:', error);
      setError(
        error instanceof Error
          ? error.message
          : 'Failed to load analytics data',
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateCurrentStreak = (sessions: any[]): number => {
    if (sessions.length === 0) return 0;

    // Sort sessions by date (most recent first)
    const sortedSessions = sessions.sort((a, b) => {
      const dateA = new Date(
        a.completedAt || a.completed_at || a.createdAt || a.created_at,
      );
      const dateB = new Date(
        b.completedAt || b.completed_at || b.createdAt || b.created_at,
      );
      return dateB.getTime() - dateA.getTime();
    });

    // Simple streak calculation - consecutive days with workouts
    let streak = 0;
    const today = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;

    for (let i = 0; i < sortedSessions.length; i++) {
      const sessionDate = new Date(
        sortedSessions[i].completedAt ||
          sortedSessions[i].completed_at ||
          sortedSessions[i].createdAt ||
          sortedSessions[i].created_at,
      );
      const daysDiff = Math.floor(
        (today.getTime() - sessionDate.getTime()) / oneDayMs,
      );

      if (daysDiff <= streak + 1) {
        streak++;
      } else {
        break;
      }
    }

    return streak;
  };

  const calculateLongestStreak = (sessions: any[]): number => {
    // Simplified longest streak calculation
    return Math.max(
      calculateCurrentStreak(sessions),
      sessions.length > 0 ? 1 : 0,
    );
  };

  const extractFavoriteExercises = (sessions: any[]): string[] => {
    const exerciseCount: {[key: string]: number} = {};

    sessions.forEach(session => {
      const exercises = session.exercises || session.Exercises || [];
      exercises.forEach((exercise: any) => {
        const name = exercise.name || exercise.Name || 'Unknown Exercise';
        exerciseCount[name] = (exerciseCount[name] || 0) + 1;
      });
    });

    return Object.entries(exerciseCount)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name]) => name);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
  };

  if (loading && !strengthProgress.length) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

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
            {t('analytics_screen.title')}
          </Text>
          <Text style={[styles.subtitle, {color: colors.subtext}]}>
            {t('analytics_screen.subtitle')}
          </Text>

          {/* Time Range Selector */}
          <View style={styles.timeRangeContainer}>
            {(['7d', '30d', '90d', '1y', 'all'] as TimeRange[]).map(range => (
              <Pressable
                key={range}
                style={[
                  styles.timeRangeButton,
                  timeRange === range && styles.activeTimeRangeButton,
                ]}
                onPress={() => setTimeRange(range)}>
                <Text
                  style={[
                    styles.timeRangeText,
                    timeRange === range && styles.activeTimeRangeText,
                  ]}>
                  {range === 'all' ? 'All' : range.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Overview Stats */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics?.total_workouts || 0}
            </Text>
            <Text style={styles.statLabel}>
              {t('analytics.total_workouts')}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics?.current_streak || 0}
            </Text>
            <Text style={styles.statLabel}>
              {t('analytics.current_streak')}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics?.workouts_this_week || 0}
            </Text>
            <Text style={styles.statLabel}>{t('analytics.this_week')}</Text>
          </Card>
        </View>

        {/* Enhanced Stats Row */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {Math.round((analytics?.total_duration_minutes || 0) / 60)}
            </Text>
            <Text style={styles.statLabel}>{t('analytics.hours_trained')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics?.average_workout_duration || 0}
            </Text>
            <Text style={styles.statLabel}>{t('analytics.avg_duration')}</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {analytics?.personal_records_count || 0}
            </Text>
            <Text style={styles.statLabel}>
              {t('analytics.personal_records')}
            </Text>
          </Card>
        </View>

        {/* Performance Insights */}
        {insights && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>AI Performance Insights</Text>
            <PerformanceInsightsPanel insights={insights} loading={loading} />
          </View>
        )}

        {/* Recent Strength Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('analytics.recent_strength_progress')}
          </Text>
          {strengthProgress && strengthProgress.length > 0 ? (
            strengthProgress.slice(0, 5).map((record, index) => (
              <Card key={record.id || index} style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.exerciseName}>
                    {record.exercise?.name ||
                      record.exerciseName ||
                      record.exercise_name ||
                      'Exercise'}
                  </Text>
                  <Text style={styles.progressDate}>
                    {record.date
                      ? new Date(record.date).toLocaleDateString()
                      : record.last_updated
                      ? new Date(record.last_updated).toLocaleDateString()
                      : 'N/A'}
                  </Text>
                </View>
                <View style={styles.progressStats}>
                  <View style={styles.progressStat}>
                    <Text style={styles.progressValue}>
                      {record.weight || 0}kg
                    </Text>
                    <Text style={styles.progressLabel}>Weight</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text style={styles.progressValue}>{record.reps || 0}</Text>
                    <Text style={styles.progressLabel}>Reps</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text style={styles.progressValue}>
                      {record.oneRepMax || record.one_rep_max || 0}kg
                    </Text>
                    <Text style={styles.progressLabel}>1RM</Text>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No strength progress recorded
              </Text>
              <Text style={styles.emptySubtext}>
                Start tracking your workouts!
              </Text>
            </Card>
          )}
        </View>

        {/* Recent Body Measurements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Body Measurements</Text>
          {bodyMeasurements && bodyMeasurements.length > 0 ? (
            bodyMeasurements.slice(0, 3).map((measurement, index) => (
              <Card
                key={measurement.id || index}
                style={styles.measurementCard}>
                <View style={styles.measurementHeader}>
                  <Text style={styles.measurementDate}>
                    {measurement.date
                      ? new Date(measurement.date).toLocaleDateString()
                      : measurement.measured_at
                      ? new Date(measurement.measured_at).toLocaleDateString()
                      : 'N/A'}
                  </Text>
                </View>
                <View style={styles.measurementStats}>
                  {(measurement.weight ||
                    (measurement.measurement_type === 'weight' &&
                      measurement.value)) && (
                    <View style={styles.measurementStat}>
                      <Text style={styles.measurementValue}>
                        {measurement.weight || measurement.value}
                        {measurement.unit || 'kg'}
                      </Text>
                      <Text style={styles.measurementLabel}>
                        {t('analytics.weight')}
                      </Text>
                    </View>
                  )}
                  {(measurement.bodyFat ||
                    (measurement.measurement_type === 'body_fat' &&
                      measurement.value)) && (
                    <View style={styles.measurementStat}>
                      <Text style={styles.measurementValue}>
                        {measurement.bodyFat || measurement.value}%
                      </Text>
                      <Text style={styles.measurementLabel}>
                        {t('analytics.body_fat')}
                      </Text>
                    </View>
                  )}
                  {(measurement.muscleMass ||
                    (measurement.measurement_type === 'muscle_mass' &&
                      measurement.value)) && (
                    <View style={styles.measurementStat}>
                      <Text style={styles.measurementValue}>
                        {measurement.muscleMass || measurement.value}
                        {measurement.unit || 'kg'}
                      </Text>
                      <Text style={styles.measurementLabel}>
                        {t('analytics.muscle_mass')}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t('analytics.no_body_measurements')}
              </Text>
              <Text style={styles.emptySubtext}>
                {t('analytics.track_body_composition')}
              </Text>
            </Card>
          )}
        </View>

        {/* Active Milestones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('analytics.active_milestones')}
          </Text>
          {milestones && milestones.length > 0 ? (
            milestones
              .filter(m => !m.achieved)
              .slice(0, 3)
              .map(milestone => (
                <Card key={milestone.id} style={styles.milestoneCard}>
                  <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                  {milestone.description && (
                    <Text style={styles.milestoneDescription}>
                      {milestone.description}
                    </Text>
                  )}
                  <View style={styles.milestoneProgress}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${
                              (milestone.currentValue / milestone.targetValue) *
                              100
                            }%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {milestone.currentValue} / {milestone.targetValue}{' '}
                      {milestone.unit}
                    </Text>
                  </View>
                </Card>
              ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t('analytics.no_active_milestones')}
              </Text>
              <Text style={styles.emptySubtext}>
                {t('analytics.set_first_goal')}
              </Text>
            </Card>
          )}
        </View>

        {/* Recent Achievements */}
        {achievements && achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('analytics.recent_achievements')}
            </Text>
            {achievements.slice(0, 3).map(achievement => (
              <AchievementBadge
                key={achievement.id}
                achievement={{
                  ...achievement,
                  earned_at: achievement.unlockedAt,
                }}
              />
            ))}
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
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 16,
  },
  // Time Range Selector styles
  timeRangeContainer: {
    flexDirection: 'row',
    backgroundColor: '#f3f4f6',
    borderRadius: 12,
    padding: 4,
    marginTop: 12,
  },
  timeRangeButton: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 8,
  },
  activeTimeRangeButton: {
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
  timeRangeText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#6b7280',
  },
  activeTimeRangeText: {
    color: '#3b82f6',
    fontWeight: '600',
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
  progressCard: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  progressDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  measurementCard: {
    marginBottom: 12,
  },
  measurementHeader: {
    marginBottom: 12,
  },
  measurementDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  measurementStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  measurementStat: {
    alignItems: 'center',
  },
  measurementValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  measurementLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  milestoneCard: {
    marginBottom: 12,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  milestoneDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  milestoneProgress: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  achievementCard: {
    marginBottom: 12,
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
  achievementDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  achievementDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  achievementBadge: {
    fontSize: 24,
    marginLeft: 12,
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
