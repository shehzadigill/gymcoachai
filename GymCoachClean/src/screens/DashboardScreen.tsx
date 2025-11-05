import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {Card, LoadingSpinner} from '../components/common/UI';
import apiClient from '../services/api';
import {useTranslation} from 'react-i18next';
import FloatingSettingsButton from '../components/common/FloatingSettingsButton';
import {useTheme} from '../theme';

const {width} = Dimensions.get('window');

// Helper function to safely format dates
const formatDate = (dateInput: any): string => {
  if (!dateInput) return 'N/A';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleDateString();
  } catch (error) {
    console.warn('Invalid date format:', dateInput);
    return 'N/A';
  }
};

// Helper function to safely format time
const formatTime = (dateInput: any): string => {
  if (!dateInput) return 'N/A';

  try {
    const date = new Date(dateInput);
    if (isNaN(date.getTime())) {
      return 'N/A';
    }
    return date.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch (error) {
    console.warn('Invalid date format:', dateInput);
    return 'N/A';
  }
};

// Helper function to generate upcoming workouts from workout plans (like web dashboard)
const getUpcomingWorkouts = (plans: any[]): any[] => {
  if (!Array.isArray(plans) || plans.length === 0) {
    return [];
  }

  const upcomingWorkouts: any[] = [];
  const now = new Date();

  plans.forEach((plan: any) => {
    if (plan.workouts && Array.isArray(plan.workouts)) {
      plan.workouts.forEach((workout: any) => {
        const scheduledDate = workout.scheduledFor || workout.scheduled_for;
        if (scheduledDate) {
          const workoutDate = new Date(scheduledDate);
          if (workoutDate > now) {
            upcomingWorkouts.push({
              name: workout.name || workout.title || 'Workout Session',
              scheduledTime: workoutDate.toISOString(), // Use ISO string for consistent parsing
              scheduledFor: workoutDate.toLocaleDateString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }),
              duration: workout.duration || workout.estimatedDuration || 45,
            });
          }
        }
      });
    } else {
      // If no specific workout schedule, create a general upcoming session
      const tomorrow = new Date(now);
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(9, 0, 0, 0);

      upcomingWorkouts.push({
        name: plan.name || 'Workout Session',
        scheduledTime: tomorrow.toISOString(),
        scheduledFor: tomorrow.toLocaleDateString('en-US', {
          weekday: 'short',
          hour: 'numeric',
          minute: '2-digit',
        }),
        duration: plan.estimatedDuration || 45,
      });
    }
  });

  // Sort by scheduled time and return first 3
  return upcomingWorkouts
    .sort(
      (a, b) =>
        new Date(a.scheduledTime).getTime() -
        new Date(b.scheduledTime).getTime(),
    )
    .slice(0, 3);
};
interface DashboardData {
  // Core metrics
  workoutsCompleted: number;
  totalWorkouts: number;
  activePlan: string;
  caloriesToday: number;
  calorieGoal: number;
  waterIntake: number;
  waterGoal: number;
  currentStreak: number;
  totalWorkoutTime: number;
  lastWorkoutDate: string | null;
  weeklyProgress: number;
  achievements: any[];

  // Detailed metrics
  avgWorkoutDuration: number;
  totalCaloriesBurned: number;
  strengthProgress: number;
  enduranceProgress: number;
  nutritionScore: number;
  nutritionStreak: number;
  macroBalance: {
    protein: number;
    carbs: number;
    fat: number;
  };
  weeklyCalorieAvg: number;
  mealsToday: number;
  todaysProtein: number;
  todaysCarbs: number;
  todaysFat: number;

  // Sleep tracking
  sleepHours: number;
  sleepQuality: number;
  sleepGoal: number;

  // AI Insights
  aiInsights: any[];
  weeklyReview: any;
  performancePredictions: any[];
  personalizationProfile: any;
  performanceAnalysis: any;
  nutritionIntelligence: any;

  // Activity data
  recentActivities: any[];
  workoutHistory: any[];
  nutritionHistory: any[];
  strengthData: any[];
  progressPhotos: any[];

  // Goals and milestones
  dailyGoals: any[];
  weeklyGoals: any[];
  upcomingWorkouts: any[];
}

export default function DashboardScreen() {
  const {t} = useTranslation();
  const {colors, isDark} = useTheme();
  const {user, userProfile} = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);

      // Load critical data first (batch 1)
      console.log('Loading critical dashboard data (batch 1)...');
      const [userProfileData, workoutPlans, workoutSessions] =
        await Promise.allSettled([
          apiClient.getUserProfile(user?.id || ''),
          apiClient.getWorkouts(),
          apiClient.getWorkoutSessions(),
        ]);

      // Small delay before next batch to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load secondary data (batch 2)
      console.log('Loading secondary dashboard data (batch 2)...');
      const [nutritionStats, todaysMeals, waterIntake] =
        await Promise.allSettled([
          apiClient.getNutritionStats(),
          apiClient.getMealsByDate(new Date().toISOString().split('T')[0]),
          apiClient.getWater(new Date().toISOString().split('T')[0]),
        ]);

      // Another small delay
      await new Promise(resolve => setTimeout(resolve, 100));

      // Load analytics and achievements (batch 3)
      console.log('Loading analytics dashboard data (batch 3)...');
      const [
        strengthProgress,
        achievements,
        sleepData,
        progressPhotos,
        workoutAnalytics,
      ] = await Promise.allSettled([
        apiClient.getStrengthProgress(),
        apiClient.getAchievements(),
        apiClient.getSleepData(),
        apiClient.getProgressPhotos(),
        apiClient.getWorkoutAnalytics(),
      ]);

      // Load AI insights in background (batch 4 - optional, non-blocking)
      console.log('Loading AI insights (batch 4 - optional)...');
      const [
        aiInsightsPromise,
        weeklyReviewPromise,
        performancePredictionsPromise,
        personalizationPromise,
        performanceAnalysisPromise,
      ] = await Promise.allSettled([
        apiClient.getProactiveInsights().catch(() => []),
        apiClient.getWeeklyReview().catch(() => null),
        apiClient.predictPerformance(user?.id).catch(() => []),
        apiClient.analyzeUserPreferences().catch(() => null),
        apiClient.analyzePerformance({}).catch(() => null),
      ]);

      console.log('Dashboard data loaded:', {
        workoutSessions: workoutSessions.status,
        nutritionStats: nutritionStats.status,
        strengthProgress: strengthProgress.status,
        achievements: achievements.status,
        workoutPlans: workoutPlans.status,
        userProfileData: userProfileData.status,
        todaysMeals: todaysMeals.status,
        waterIntake: waterIntake.status,
      });

      // Log any failures for debugging
      if (workoutSessions.status === 'rejected') {
        console.warn(
          'Failed to fetch workout sessions:',
          workoutSessions.reason,
        );
      }
      if (nutritionStats.status === 'rejected') {
        console.warn('Failed to fetch nutrition stats:', nutritionStats.reason);
      }
      if (strengthProgress.status === 'rejected') {
        console.warn(
          'Failed to fetch strength progress:',
          strengthProgress.reason,
        );
      }
      if (achievements.status === 'rejected') {
        console.warn('Failed to fetch achievements:', achievements.reason);
      }
      if (workoutPlans.status === 'rejected') {
        console.warn('Failed to fetch workout plans:', workoutPlans.reason);
      }
      if (userProfileData.status === 'rejected') {
        console.warn(
          'Failed to fetch user profile (this is expected if API is not implemented):',
          userProfileData.reason,
        );
      }
      if (todaysMeals.status === 'rejected') {
        console.warn("Failed to fetch today's meals:", todaysMeals.reason);
      }
      if (waterIntake.status === 'rejected') {
        console.warn('Failed to fetch water intake:', waterIntake.reason);
      }

      // Process workout data
      const workoutData =
        workoutSessions.status === 'fulfilled' ? workoutSessions.value : [];
      const completedWorkouts = workoutData.filter((session: any) => {
        return (
          session.completed === true ||
          session.status === 'completed' ||
          session.completedAt ||
          session.completed_at ||
          session.endTime ||
          session.end_time
        );
      }).length;

      const totalWorkoutTime = workoutData
        .filter((session: any) => {
          return (
            session.completed === true ||
            session.status === 'completed' ||
            session.completedAt ||
            session.completed_at ||
            session.endTime ||
            session.end_time
          );
        })
        .reduce((total: number, session: any) => {
          const duration =
            session.durationMinutes ||
            session.duration_minutes ||
            session.duration ||
            session.totalTime ||
            session.total_time ||
            0;
          return total + duration;
        }, 0);

      const avgWorkoutDuration =
        completedWorkouts > 0
          ? Math.round(totalWorkoutTime / completedWorkouts)
          : 0;

      // Process user profile data safely (API might not be implemented)
      const userProfile =
        userProfileData.status === 'fulfilled' ? userProfileData.value : null;
      console.log('User profile data:', userProfile);

      // Process nutrition data
      const nutritionData =
        nutritionStats.status === 'fulfilled' ? nutritionStats.value : {};
      const todaysCalories = nutritionData.today_calories || 0;
      const todaysProtein = nutritionData.today_protein || 0;
      const todaysCarbs = nutritionData.today_carbs || 0;
      const todaysFat = nutritionData.today_fat || 0;
      const nutritionScore = nutritionData.nutrition_score || 0;
      const nutritionStreak =
        nutritionData.streak || nutritionData.nutrition_streak || 0;
      const macroBalance = nutritionData.macro_balance || {
        protein: 0,
        carbs: 0,
        fat: 0,
      };
      const weeklyCalorieAvg = nutritionData.weekly_average || 0;
      const mealsToday = nutritionData.meals_today || 0;

      // Process sleep data
      const sleepDataResult =
        sleepData.status === 'fulfilled' ? sleepData.value : {};
      const sleepHours =
        sleepDataResult?.hours || sleepDataResult?.body?.hours || 0;
      const sleepQuality =
        sleepDataResult?.quality || sleepDataResult?.body?.quality || 0;
      const sleepGoal =
        userProfileData.status === 'fulfilled'
          ? (userProfileData.value as any)?.sleepGoal ||
            (userProfileData.value as any)?.body?.sleepGoal ||
            8
          : 8;

      // Process AI insights
      const aiInsights =
        aiInsightsPromise.status === 'fulfilled'
          ? aiInsightsPromise.value || []
          : [];
      const weeklyReview =
        weeklyReviewPromise.status === 'fulfilled'
          ? weeklyReviewPromise.value
          : null;
      const performancePredictions =
        performancePredictionsPromise.status === 'fulfilled'
          ? performancePredictionsPromise.value || []
          : [];
      const personalizationProfile =
        personalizationPromise.status === 'fulfilled'
          ? personalizationPromise.value
          : null;
      const performanceAnalysis =
        performanceAnalysisPromise.status === 'fulfilled'
          ? performanceAnalysisPromise.value
          : null;
      const nutritionIntelligence = null;
      // nutritionIntelligencePromise.status === 'fulfilled'
      //   ? nutritionIntelligencePromise.value
      //   : null;

      // Process progress photos
      const photos =
        progressPhotos.status === 'fulfilled' ? progressPhotos.value || [] : [];

      // Calculate workout streak
      const currentStreak = calculateWorkoutStreak(workoutData);

      // Get last workout date
      const lastWorkoutDate = getLastWorkoutDate(workoutData);

      // Generate recent activities
      const recentActivities = generateRecentActivities(
        workoutData,
        todaysMeals.status === 'fulfilled' ? todaysMeals.value : [],
        achievements.status === 'fulfilled' ? achievements.value : [],
      );

      // Calculate weekly goals
      const now = new Date();
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);

      const workoutsThisWeek = workoutData.filter((session: any) => {
        const isCompleted =
          session.completed === true ||
          session.status === 'completed' ||
          session.completedAt ||
          session.completed_at ||
          session.endTime ||
          session.end_time;

        if (!isCompleted) return false;

        const dateString =
          session.completedAt ||
          session.completed_at ||
          session.endTime ||
          session.end_time ||
          session.createdAt ||
          session.created_at;

        if (!dateString) return false;

        try {
          const sessionDate = new Date(dateString);
          return sessionDate >= startOfWeek && sessionDate <= now;
        } catch (error) {
          return false;
        }
      }).length;

      // Extract daily goals from user profile preferences
      const profileData =
        userProfileData.status === 'fulfilled'
          ? (userProfileData.value as any)?.body || userProfileData.value || {}
          : {};
      const dailyGoalsFromPrefs = profileData?.preferences?.dailyGoals;

      // Separate daily and weekly goals
      const dailyGoals = [
        {
          name: 'Calories',
          current: Math.round(todaysCalories),
          target:
            dailyGoalsFromPrefs?.calories ||
            nutritionData.daily_goal ||
            nutritionData.weekly_goal ||
            2000,
          unit: 'kcal',
        },
        {
          name: 'Protein',
          current: Math.round(nutritionData.today_protein || 0),
          target: dailyGoalsFromPrefs?.protein || 150,
          unit: 'g',
        },
        {
          name: 'Carbs',
          current: Math.round(nutritionData.today_carbs || 0),
          target: dailyGoalsFromPrefs?.carbs || 200,
          unit: 'g',
        },
        {
          name: 'Fat',
          current: Math.round(nutritionData.today_fat || 0),
          target: dailyGoalsFromPrefs?.fat || 67,
          unit: 'g',
        },
        {
          name: 'Water',
          current:
            waterIntake.status === 'fulfilled'
              ? waterIntake.value?.glasses || 0
              : 0,
          target: dailyGoalsFromPrefs?.water || nutritionData.water_goal || 8,
          unit: 'glasses',
        },
      ];

      const weeklyGoals = [
        {
          name: 'Workouts',
          current: workoutsThisWeek,
          target: 4, // Default target since user profile API is not available
          unit: 'sessions',
        },
      ];

      setData({
        // Core metrics
        workoutsCompleted: completedWorkouts,
        totalWorkouts: workoutData.length,
        activePlan: 'Custom Plan', // Can be enhanced later
        caloriesToday: todaysCalories,
        calorieGoal:
          dailyGoalsFromPrefs?.calories || nutritionData.weekly_goal || 2000,
        waterIntake:
          waterIntake.status === 'fulfilled'
            ? waterIntake.value?.glasses || 0
            : 0,
        waterGoal: dailyGoalsFromPrefs?.water || nutritionData.water_goal || 8,
        currentStreak,
        totalWorkoutTime,
        lastWorkoutDate,
        weeklyProgress: Math.round((workoutsThisWeek / 4) * 100),
        achievements:
          achievements.status === 'fulfilled'
            ? achievements.value.slice(0, 3)
            : [],

        // Detailed metrics
        avgWorkoutDuration,
        totalCaloriesBurned: Math.round(totalWorkoutTime * 8), // Estimate 8 cal/min
        strengthProgress: 0, // Can be calculated from strength data
        enduranceProgress: 0, // Can be calculated from workout data
        nutritionScore,
        nutritionStreak,
        macroBalance,
        weeklyCalorieAvg,
        mealsToday,
        todaysProtein,
        todaysCarbs,
        todaysFat,

        // Sleep tracking
        sleepHours,
        sleepQuality,
        sleepGoal,

        // AI Insights
        aiInsights,
        weeklyReview,
        performancePredictions,
        personalizationProfile,
        performanceAnalysis,
        nutritionIntelligence,

        // Activity data
        recentActivities,
        workoutHistory: processWorkoutHistory(workoutData),
        nutritionHistory: [], // Can be implemented later
        strengthData:
          strengthProgress.status === 'fulfilled' ? strengthProgress.value : [],
        progressPhotos: photos,

        // Goals and milestones
        dailyGoals,
        weeklyGoals,
        upcomingWorkouts:
          workoutPlans.status === 'fulfilled'
            ? getUpcomingWorkouts(workoutPlans.value)
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
      userProfile?.firstName ||
      user?.email?.split('@')[0] ||
      t('dashboard.there');

    if (hour < 12) return t('dashboard.good_morning', {name});
    if (hour < 17) return t('dashboard.good_afternoon', {name});
    return t('dashboard.good_evening', {name});
  };

  const calculateWorkoutStreak = (sessions: any[]) => {
    if (sessions.length === 0) return 0;

    const sortedSessions = sessions
      .filter(s => {
        return (
          s.completed === true ||
          s.status === 'completed' ||
          s.completedAt ||
          s.completed_at ||
          s.endTime ||
          s.end_time
        );
      })
      .map(session => {
        const dateString =
          session.completedAt || session.completed_at || session.createdAt;
        if (!dateString) return null;

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;

        return {...session, validDate: date};
      })
      .filter(Boolean)
      .sort((a: any, b: any) => b.validDate.getTime() - a.validDate.getTime());

    let streak = 0;
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);

    for (const session of sortedSessions) {
      const sessionDate = new Date(session.validDate);
      sessionDate.setHours(0, 0, 0, 0);

      const daysDiff = Math.floor(
        (currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24),
      );

      if (daysDiff === streak) {
        streak++;
      } else if (daysDiff > streak) {
        break;
      }
    }

    return streak;
  };

  const getLastWorkoutDate = (sessions: any[]) => {
    if (sessions.length === 0) return null;

    const completedSessions = sessions
      .filter(s => {
        return (
          s.completed === true ||
          s.status === 'completed' ||
          s.completedAt ||
          s.completed_at ||
          s.endTime ||
          s.end_time
        );
      })
      .map(session => {
        const dateString =
          session.completedAt || session.completed_at || session.createdAt;
        if (!dateString) return null;

        const date = new Date(dateString);
        if (isNaN(date.getTime())) return null;

        return {...session, validDate: date, originalDateString: dateString};
      })
      .filter(Boolean);

    if (completedSessions.length === 0) return null;

    const sortedSessions = completedSessions.sort(
      (a: any, b: any) => b.validDate.getTime() - a.validDate.getTime(),
    );

    return sortedSessions[0].originalDateString;
  };

  const generateRecentActivities = (
    workouts: any[],
    meals: any[],
    achievements: any[],
  ) => {
    const activities: any[] = [];

    // Add recent workouts (only completed ones)
    if (workouts.length > 0) {
      workouts
        .filter((workout: any) => {
          return (
            workout.completed === true ||
            workout.status === 'completed' ||
            workout.completedAt ||
            workout.completed_at ||
            workout.endTime ||
            workout.end_time
          );
        })
        .slice(0, 3)
        .forEach((workout: any) => {
          if (workout) {
            activities.push({
              type: 'workout',
              title: `Completed ${workout.workout?.name || 'Workout'}`,
              description: `${workout.exercises?.length || 0} exercises`,
              timestamp:
                workout.completedAt ||
                workout.completed_at ||
                workout.createdAt,
              icon: '💪',
            });
          }
        });
    }

    // Add nutrition entries
    if (Array.isArray(meals) && meals.length > 0) {
      meals.slice(0, 2).forEach((meal: any) => {
        if (meal) {
          activities.push({
            type: 'nutrition',
            title: `Logged ${meal.name}`,
            description: `${meal.total_calories || 0} calories`,
            timestamp: meal.created_at || new Date().toISOString(),
            icon: '🍽️',
          });
        }
      });
    }

    // Add achievements
    if (Array.isArray(achievements) && achievements.length > 0) {
      achievements.slice(0, 2).forEach((achievement: any) => {
        if (achievement) {
          activities.push({
            type: 'achievement',
            title: achievement.title,
            description: achievement.description,
            timestamp: achievement.unlockedAt || new Date().toISOString(),
            icon: '🏆',
          });
        }
      });
    }

    return activities
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      )
      .slice(0, 6);
  };

  const processWorkoutHistory = (sessions: any[]) => {
    if (sessions.length === 0) return [];

    // Generate last 7 days of data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayWorkouts = sessions.filter((session: any) => {
        try {
          const sessionDateStr =
            session.completedAt ||
            session.completed_at ||
            session.createdAt ||
            session.created_at;
          if (!sessionDateStr) return false;

          const sessionDate = new Date(sessionDateStr);
          if (isNaN(sessionDate.getTime())) return false;

          const sessionDateOnly = sessionDate.toISOString().split('T')[0];
          return (
            sessionDateOnly === dateStr &&
            (session.completed === true ||
              session.status === 'completed' ||
              session.completedAt ||
              session.completed_at ||
              session.endTime ||
              session.end_time)
          );
        } catch (error) {
          return false;
        }
      });

      last7Days.push({
        label: date.toLocaleDateString('en-US', {weekday: 'short'}),
        value: dayWorkouts.length,
        timestamp: dateStr,
      });
    }

    return last7Days;
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Unknown';

    try {
      const date = new Date(dateString);

      if (isNaN(date.getTime())) return 'Unknown';

      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
      else if (diffInHours < 24) return `${diffInHours}h ago`;
      else return `${diffInDays}d ago`;
    } catch (error) {
      return 'Unknown';
    }
  };

  if (loading && !data) {
    return (
      <SafeAreaView
        style={[styles.container, {backgroundColor: colors.background}]}>
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
        <View style={styles.header}>
          <Text style={[styles.greeting, {color: colors.text}]}>
            {getGreeting()}
          </Text>
          <Text style={[styles.subtitle, {color: colors.subtext}]}>
            {t('dashboard.subtitle')}
          </Text>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>
              {data?.workoutsCompleted || 0}
            </Text>
            <Text style={styles.statLabel}>
              {t('dashboard.stats.workouts_done')}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{data?.caloriesToday || 0}</Text>
            <Text style={styles.statLabel}>
              {t('dashboard.stats.calories_today')}
            </Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{data?.currentStreak || 0}</Text>
            <Text style={styles.statLabel}>
              {t('dashboard.stats.day_streak')}
            </Text>
          </Card>
        </View>

        {/* Daily Goals */}
        {data?.dailyGoals && data.dailyGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.todays_goals')}
            </Text>
            {data.dailyGoals.map((goal: any, index: number) => (
              <Card key={index} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalProgress}>
                    {goal.current} / {goal.target} {goal.unit}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(
                          (goal.current / goal.target) * 100,
                          100,
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.goalPercentage}>
                  {Math.round((goal.current / goal.target) * 100)}%{' '}
                  {t('dashboard.complete')}
                </Text>
              </Card>
            ))}
          </View>
        )}

        {/* Weekly Goals */}
        {data?.weeklyGoals && data.weeklyGoals.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.weekly_goals')}
            </Text>
            {data.weeklyGoals.map((goal: any, index: number) => (
              <Card key={index} style={styles.goalCard}>
                <View style={styles.goalHeader}>
                  <Text style={styles.goalName}>{goal.name}</Text>
                  <Text style={styles.goalProgress}>
                    {goal.current} / {goal.target} {goal.unit}
                  </Text>
                </View>
                <View style={styles.progressBarContainer}>
                  <View
                    style={[
                      styles.progressBar,
                      {
                        width: `${Math.min(
                          (goal.current / goal.target) * 100,
                          100,
                        )}%`,
                      },
                    ]}
                  />
                </View>
                <Text style={styles.goalPercentage}>
                  {Math.round((goal.current / goal.target) * 100)}%{' '}
                  {t('dashboard.complete')}
                </Text>
              </Card>
            ))}
          </View>
        )}

        {/* Recent Activities */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('dashboard.recent_activity')}
          </Text>
          {data?.recentActivities && data.recentActivities.length > 0 ? (
            data.recentActivities.map((activity, index) => (
              <Card key={index} style={styles.activityCard}>
                <View style={styles.activityContent}>
                  <Text style={styles.activityIcon}>{activity.icon}</Text>
                  <View style={styles.activityDetails}>
                    <Text style={styles.activityTitle}>{activity.title}</Text>
                    <Text style={styles.activityDescription}>
                      {activity.description}
                    </Text>
                    <Text style={styles.activityTime}>
                      {formatTimeAgo(activity.timestamp)}
                    </Text>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                {t('dashboard.no_recent_activity')}
              </Text>
              <Text style={styles.emptySubtext}>
                {t('dashboard.start_tracking')}
              </Text>
            </Card>
          )}
        </View>

        {/* Performance Overview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('dashboard.performance_overview')}
          </Text>
          <Card style={styles.performanceCard}>
            <View style={styles.performanceGrid}>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceValue}>
                  {data?.avgWorkoutDuration || 0}m
                </Text>
                <Text style={styles.performanceLabel}>
                  {t('dashboard.avg_duration')}
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceValue}>
                  {data?.totalCaloriesBurned || 0}
                </Text>
                <Text style={styles.performanceLabel}>
                  {t('dashboard.calories_burned')}
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceValue}>
                  {data?.nutritionScore || 0}
                </Text>
                <Text style={styles.performanceLabel}>
                  {t('dashboard.nutrition_score')}
                </Text>
              </View>
              <View style={styles.performanceItem}>
                <Text style={styles.performanceValue}>
                  {data?.mealsToday || 0}
                </Text>
                <Text style={styles.performanceLabel}>
                  {t('dashboard.meals_today')}
                </Text>
              </View>
            </View>
          </Card>
        </View>

        {/* Upcoming Workouts */}
        {data?.upcomingWorkouts && data.upcomingWorkouts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.upcoming_workouts')}
            </Text>
            {data.upcomingWorkouts.map((workout, index) => (
              <Card key={workout.id || index} style={styles.upcomingCard}>
                <Text style={styles.upcomingName}>{workout.name}</Text>
                <Text style={styles.upcomingTime}>
                  {workout.scheduledFor ||
                    `${formatDate(workout.scheduledTime)} at ${formatTime(
                      workout.scheduledTime,
                    )}`}
                </Text>
                <Text style={styles.workoutDuration}>
                  {workout.duration}min
                </Text>
              </Card>
            ))}
          </View>
        )}

        {/* Recent Achievements */}
        {data?.achievements && data.achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.recent_achievements')}
            </Text>
            {data.achievements.map(achievement => (
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

        {/* Enhanced Nutrition Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('dashboard.nutrition_insights') || 'Nutrition Insights'}
          </Text>

          {/* Nutrition Score & Streak */}
          <View style={styles.nutritionMetricsRow}>
            <Card style={[styles.statCard, {flex: 0.48}]}>
              <Text style={styles.statNumber}>
                {data?.nutritionScore || 0}/100
              </Text>
              <Text style={styles.statLabel}>
                {t('dashboard.nutrition_score') || 'Nutrition Score'}
              </Text>
            </Card>
            <Card style={[styles.statCard, {flex: 0.48}]}>
              <Text style={styles.statNumber}>
                {data?.nutritionStreak || 0} 🔥
              </Text>
              <Text style={styles.statLabel}>
                {t('dashboard.nutrition_streak') || 'Day Streak'}
              </Text>
            </Card>
          </View>

          {/* Macro Balance */}
          {data?.macroBalance && (
            <Card style={styles.nutritionCard}>
              <Text style={styles.sectionSubtitle}>Today's Macros</Text>
              <View style={styles.nutritionRow}>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {data.todaysProtein || 0}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Protein</Text>
                  <Text style={styles.nutritionPercent}>
                    {data.macroBalance.protein || 0}%
                  </Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {data.todaysCarbs || 0}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Carbs</Text>
                  <Text style={styles.nutritionPercent}>
                    {data.macroBalance.carbs || 0}%
                  </Text>
                </View>
                <View style={styles.nutritionItem}>
                  <Text style={styles.nutritionValue}>
                    {data.todaysFat || 0}g
                  </Text>
                  <Text style={styles.nutritionLabel}>Fat</Text>
                  <Text style={styles.nutritionPercent}>
                    {data.macroBalance.fat || 0}%
                  </Text>
                </View>
              </View>
              <Text style={styles.macroNote}>
                Weekly Average: {data.weeklyCalorieAvg || 0} calories
              </Text>
            </Card>
          )}
        </View>

        {/* Sleep Tracking */}
        {data?.sleepHours !== undefined && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.sleep_tracking') || 'Sleep Tracking'}
            </Text>
            <Card style={styles.sleepCard}>
              <View style={styles.sleepContent}>
                <View>
                  <Text style={styles.sleepHours}>
                    {data.sleepHours || 0}h / {data.sleepGoal || 8}h
                  </Text>
                  <Text style={styles.sleepLabel}>Last Night</Text>
                </View>
                {data.sleepQuality > 0 && (
                  <View style={styles.sleepQualityContainer}>
                    <Text style={styles.sleepQualityLabel}>Quality:</Text>
                    <View style={styles.sleepStars}>
                      {Array.from({length: 5}).map((_, i) => (
                        <Text
                          key={i}
                          style={[
                            styles.sleepStar,
                            i < (data.sleepQuality || 3)
                              ? styles.sleepStarFilled
                              : styles.sleepStarEmpty,
                          ]}>
                          ⭐
                        </Text>
                      ))}
                    </View>
                  </View>
                )}
              </View>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${Math.min(
                        ((data.sleepHours || 0) / (data.sleepGoal || 8)) * 100,
                        100,
                      )}%`,
                      backgroundColor: '#8b5cf6',
                    },
                  ]}
                />
              </View>
            </Card>
          </View>
        )}

        {/* AI Insights Panel */}
        {data?.aiInsights && data.aiInsights.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.ai_insights') || 'AI Coach Insights'}
            </Text>
            {data.aiInsights.slice(0, 3).map((insight: any, index: number) => (
              <Card key={insight.id || index} style={styles.aiInsightCard}>
                <View style={styles.aiInsightHeader}>
                  <Text style={styles.aiInsightIcon}>🧠</Text>
                  <Text style={styles.aiInsightTitle}>{insight.title}</Text>
                </View>
                <Text style={styles.aiInsightMessage}>{insight.message}</Text>
                {insight.suggestedActions &&
                  insight.suggestedActions.length > 0 && (
                    <View style={styles.aiActionsContainer}>
                      <Text style={styles.aiActionsLabel}>
                        Suggested Actions:
                      </Text>
                      {insight.suggestedActions
                        .slice(0, 2)
                        .map((action: string, actionIndex: number) => (
                          <Text key={actionIndex} style={styles.aiActionItem}>
                            • {action}
                          </Text>
                        ))}
                    </View>
                  )}
              </Card>
            ))}
          </View>
        )}

        {/* Weekly Review */}
        {data?.weeklyReview && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.weekly_review') || 'Weekly Review'}
            </Text>
            <Card style={styles.weeklyReviewCard}>
              <Text style={styles.weeklyReviewTitle}>
                Week of {data.weeklyReview.weekStart || 'This Week'}
              </Text>
              <Text style={styles.weeklyReviewSummary}>
                {data.weeklyReview.summary || 'No summary available'}
              </Text>
              {data.weeklyReview.achievements &&
                data.weeklyReview.achievements.length > 0 && (
                  <View style={styles.achievementsContainer}>
                    <Text style={styles.achievementsTitle}>Achievements:</Text>
                    {data.weeklyReview.achievements
                      .slice(0, 3)
                      .map((achievement: any, index: number) => (
                        <Text key={index} style={styles.achievementItem}>
                          ⭐ {achievement.description || achievement}
                        </Text>
                      ))}
                  </View>
                )}
            </Card>
          </View>
        )}

        {/* Performance Predictions */}
        {data?.performancePredictions &&
          data.performancePredictions.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                {t('dashboard.performance_predictions') ||
                  'Performance Predictions'}
              </Text>
              {data.performancePredictions
                .slice(0, 3)
                .map((prediction: any, index: number) => (
                  <Card key={index} style={styles.predictionCard}>
                    <Text style={styles.predictionMetric}>
                      {prediction.metric || 'Metric'}
                    </Text>
                    <View style={styles.predictionValues}>
                      <Text style={styles.predictionCurrent}>
                        Current: {prediction.currentValue || 'N/A'}
                      </Text>
                      <Text style={styles.predictionArrow}>→</Text>
                      <Text style={styles.predictionPredicted}>
                        Predicted: {prediction.predictedValue || 'N/A'}
                      </Text>
                    </View>
                    <Text style={styles.predictionTimeframe}>
                      In {prediction.timeframe || '30'} days
                    </Text>
                  </Card>
                ))}
            </View>
          )}

        {/* Nutrition Intelligence */}
        {data?.nutritionIntelligence && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t('dashboard.nutrition_intelligence') ||
                'Nutrition Intelligence'}
            </Text>
            <Card style={styles.nutritionIntelligenceCard}>
              {data.nutritionIntelligence.adherenceScore !== undefined && (
                <View style={styles.adherenceContainer}>
                  <Text style={styles.adherenceLabel}>Adherence Score</Text>
                  <Text style={styles.adherenceValue}>
                    {Math.round(data.nutritionIntelligence.adherenceScore || 0)}
                    %
                  </Text>
                </View>
              )}
              {data.nutritionIntelligence.recommendations &&
                data.nutritionIntelligence.recommendations.length > 0 && (
                  <View style={styles.recommendationsContainer}>
                    <Text style={styles.recommendationsTitle}>
                      AI Recommendations:
                    </Text>
                    {data.nutritionIntelligence.recommendations
                      .slice(0, 3)
                      .map((rec: any, index: number) => (
                        <Text key={index} style={styles.recommendationItem}>
                          • {rec.description || rec}
                        </Text>
                      ))}
                  </View>
                )}
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
    marginBottom: 4,
  },
  workoutDuration: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '600',
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
  goalCard: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  goalProgress: {
    fontSize: 14,
    color: '#6b7280',
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 3,
  },
  goalPercentage: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'right',
  },
  activityCard: {
    marginBottom: 8,
  },
  activityContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  activityIcon: {
    fontSize: 24,
    marginRight: 12,
  },
  activityDetails: {
    flex: 1,
  },
  activityTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 2,
  },
  activityDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 2,
  },
  activityTime: {
    fontSize: 12,
    color: '#6b7280',
  },
  performanceCard: {
    paddingVertical: 20,
  },
  performanceGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  performanceItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 16,
  },
  performanceValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  performanceLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  macroNote: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  nutritionMetricsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionSubtitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 12,
  },
  nutritionPercent: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 2,
  },
  sleepCard: {
    marginBottom: 12,
    paddingVertical: 16,
  },
  sleepContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sleepHours: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  sleepLabel: {
    fontSize: 14,
    color: '#6b7280',
  },
  sleepQualityContainer: {
    alignItems: 'flex-end',
  },
  sleepQualityLabel: {
    fontSize: 12,
    color: '#6b7280',
    marginBottom: 4,
  },
  sleepStars: {
    flexDirection: 'row',
  },
  sleepStar: {
    fontSize: 16,
  },
  sleepStarFilled: {
    opacity: 1,
  },
  sleepStarEmpty: {
    opacity: 0.3,
  },
  aiInsightCard: {
    marginBottom: 12,
    paddingVertical: 16,
    backgroundColor: '#f0f9ff',
    borderColor: '#bfdbfe',
    borderWidth: 1,
  },
  aiInsightHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  aiInsightIcon: {
    fontSize: 20,
    marginRight: 8,
  },
  aiInsightTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  aiInsightMessage: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 8,
  },
  aiActionsContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  aiActionsLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6b7280',
    marginBottom: 4,
  },
  aiActionItem: {
    fontSize: 12,
    color: '#374151',
    marginTop: 4,
  },
  weeklyReviewCard: {
    marginBottom: 12,
    paddingVertical: 16,
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  weeklyReviewTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  weeklyReviewSummary: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 12,
    lineHeight: 20,
  },
  achievementsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  achievementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  achievementItem: {
    fontSize: 13,
    color: '#374151',
    marginTop: 4,
  },
  predictionCard: {
    marginBottom: 12,
    paddingVertical: 16,
    backgroundColor: '#eff6ff',
    borderColor: '#93c5fd',
    borderWidth: 1,
  },
  predictionMetric: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  predictionValues: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  predictionCurrent: {
    fontSize: 14,
    color: '#374151',
  },
  predictionArrow: {
    fontSize: 16,
    color: '#6b7280',
    marginHorizontal: 8,
  },
  predictionPredicted: {
    fontSize: 14,
    fontWeight: '600',
    color: '#2563eb',
  },
  predictionTimeframe: {
    fontSize: 12,
    color: '#6b7280',
  },
  nutritionIntelligenceCard: {
    marginBottom: 12,
    paddingVertical: 16,
    backgroundColor: '#f0fdf4',
    borderColor: '#86efac',
    borderWidth: 1,
  },
  adherenceContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  adherenceLabel: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  adherenceValue: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#10b981',
  },
  recommendationsContainer: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  recommendationItem: {
    fontSize: 13,
    color: '#374151',
    marginTop: 4,
    lineHeight: 18,
  },
});
