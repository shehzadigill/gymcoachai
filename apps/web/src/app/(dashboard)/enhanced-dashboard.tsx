'use client';

import { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  CalendarDays,
  Target,
  Flame,
  Brain,
  TrendingUp,
  Activity,
  Award,
  Clock,
  Dumbbell,
  Heart,
  User,
  Apple,
  Zap,
  Trophy,
  Timer,
  BarChart3,
  Play,
  Camera,
  Settings,
  Plus,
  Calendar,
  Utensils,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  Star,
  Droplets,
  Moon,
  Sun,
} from 'lucide-react';

// Import custom components
import { LineChart, BarChart, DonutChart } from '../../components/charts';
import {
  MetricCard,
  DashboardSection,
  ActivityFeed,
  QuickActions,
  ProgressRing,
} from '../../components/dashboard';

interface DashboardData {
  // Core metrics
  workoutsCompleted: number;
  totalWorkouts: number;
  activePlan: string;
  caloriesToday: number;
  calorieGoal: number;
  waterIntake: number;
  waterGoal: number;
  aiRecommendations: number;
  currentStreak: number;
  totalWorkoutTime: number;
  lastWorkoutDate: string | null;
  weeklyProgress: number;
  monthlyGoal: number;
  achievements: any[];

  // Detailed metrics
  avgWorkoutDuration: number;
  totalCaloriesBurned: number;
  strengthProgress: number;
  enduranceProgress: number;
  weightProgress: number;
  bodyFatProgress: number;
  sleepHours: number;
  sleepQuality: number;
  sleepGoal: number;

  // Enhanced nutrition metrics from Rust service
  todaysProtein: number;
  todaysCarbs: number;
  todaysFat: number;
  nutritionStreak: number;
  nutritionScore: number;
  macroBalance: {
    protein: number;
    carbs: number;
    fat: number;
  };
  weeklyCalorieAvg: number;
  monthlyCalorieAvg: number;
  mealsToday: number;

  // Activity data
  recentActivities: any[];
  workoutHistory: any[];
  nutritionHistory: any[];
  strengthData: any[];
  progressPhotos: any[];

  // Goals and milestones
  dailyGoals: any[];
  weeklyGoals: any[];
  monthlyGoals: any[];
  upcomingWorkouts: any[];
}

export default function DashboardPage() {
  const me = useCurrentUser();
  const userLoading = me.isLoading;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLive, setIsLive] = useState(false);

  const fetchDashboardData = useMemo(
    () => async () => {
      try {
        setLoading(true);
        setError(null);

        // Fetch all data in parallel for better performance
        const [
          workoutSessions,
          workoutPlans,
          userProfile,
          nutritionStats,
          bodyMeasurements,
          strengthProgress,
          achievements,
          milestones,
          workoutAnalytics,
          todaysMeals,
          waterIntake,
          progressPhotos,
          todaysSleepData,
        ] = await Promise.all([
          api.getWorkoutSessions().catch((e) => {
            console.warn('Failed to fetch workout sessions:', e);
            return [];
          }),
          api.getWorkoutPlans().catch((e) => {
            console.warn('Failed to fetch workout plans:', e);
            return [];
          }),
          api.getUserProfile().catch((e) => {
            console.warn('Failed to fetch user profile:', e);
            return { body: {} };
          }),
          api.getNutritionStats().catch((e) => {
            console.warn('Failed to fetch nutrition stats:', e);
            return { body: {} };
          }),
          api.getBodyMeasurements().catch((e) => {
            console.warn('Failed to fetch body measurements:', e);
            return { body: [] };
          }),
          api.getStrengthProgress().catch((e) => {
            console.warn('Failed to fetch strength progress:', e);
            return { body: [] };
          }),
          api.getAchievements().catch((e) => {
            console.warn('Failed to fetch achievements:', e);
            return { body: [] };
          }),
          api.getMilestones().catch((e) => {
            console.warn('Failed to fetch milestones:', e);
            return { body: [] };
          }),
          api.getWorkoutAnalytics().catch((e) => {
            console.warn('Failed to fetch workout analytics:', e);
            return { body: {} };
          }),
          api
            .getMealsByDate(new Date().toISOString().split('T')[0])
            .catch((e) => {
              console.warn('Failed to fetch meals:', e);
              return [];
            }),
          api.getWater(new Date().toISOString().split('T')[0]).catch((e) => {
            console.warn('Failed to fetch water intake:', e);
            return { body: { glasses: 0 } };
          }),
          api.getProgressPhotos().catch((e) => {
            console.warn('Failed to fetch progress photos:', e);
            return { body: [] };
          }),
          api.getSleepData().catch((e) => {
            console.warn('Failed to fetch sleep data:', e);
            return { body: { hours: 7, quality: 3 } };
          }),
        ]);
        console.log('Fetched dashboard data:', {
          workoutSessions,
          workoutPlans,
          userProfile,
          nutritionStats,
          bodyMeasurements,
          strengthProgress,
          achievements,
          milestones,
          workoutAnalytics,
          todaysMeals,
          waterIntake,
          progressPhotos,
          todaysSleepData,
        });
        // Process workout data
        console.log('workoutSessions:', workoutSessions);

        // Handle different API response formats
        const workoutData = Array.isArray(workoutSessions)
          ? workoutSessions
          : Array.isArray((workoutSessions as any)?.body)
            ? (workoutSessions as any).body
            : [];

        console.log('Processed workoutData:', workoutData);

        // More comprehensive completion check
        const completedWorkouts = workoutData.filter((session: any) => {
          // Check multiple completion indicators
          const isCompleted =
            session.completed === true ||
            session.status === 'completed' ||
            session.completedAt ||
            session.completed_at ||
            session.endTime ||
            session.end_time;

          console.log('Session completion check:', {
            sessionId: session.id,
            completed: session.completed,
            status: session.status,
            completedAt: session.completedAt,
            completed_at: session.completed_at,
            endTime: session.endTime,
            end_time: session.end_time,
            isCompleted,
          });

          return isCompleted;
        }).length;

        console.log('Total completed workouts:', completedWorkouts);

        const totalWorkoutTime = workoutData
          .filter((session: any) => {
            // Only count time from completed workouts
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
            console.log('Session duration:', {
              sessionId: session.id,
              duration,
            });
            return total + duration;
          }, 0);

        console.log('Total workout time:', totalWorkoutTime);

        const avgWorkoutDuration =
          completedWorkouts > 0
            ? Math.round(totalWorkoutTime / completedWorkouts)
            : 0;

        // Process nutrition data from comprehensive stats
        const nutritionData = nutritionStats || {};
        const todaysCalories = nutritionData.today_calories || 0;
        const todaysProtein = nutritionData.today_protein || 0;
        const todaysCarbs = nutritionData.today_carbs || 0;
        const todaysFat = nutritionData.today_fat || 0;
        const nutritionStreak = nutritionData.streak || 0;
        const nutritionScore = nutritionData.nutrition_score || 0;
        const macroBalance = nutritionData.macro_balance || {
          protein: 0,
          carbs: 0,
          fat: 0,
        };

        // Calculate streaks
        const currentStreak = calculateWorkoutStreak(workoutSessions);

        // Process body measurements for progress
        const latestMeasurements = Array.isArray(bodyMeasurements?.body)
          ? bodyMeasurements.body[0]
          : Array.isArray(bodyMeasurements)
            ? bodyMeasurements[0]
            : {};

        // Generate activity feed
        const recentActivities = generateRecentActivities(
          workoutSessions,
          todaysMeals,
          achievements?.body || achievements
        );

        // Calculate real weekly metrics
        const now = new Date();
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay()); // Start of current week (Sunday)
        startOfWeek.setHours(0, 0, 0, 0);

        // Count workouts completed this week
        const workoutsThisWeek = workoutData.filter((session: any) => {
          // Check if workout is completed
          const isCompleted =
            session.completed === true ||
            session.status === 'completed' ||
            session.completedAt ||
            session.completed_at ||
            session.endTime ||
            session.end_time;

          if (!isCompleted) return false;

          // Get the completion date
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
            if (isNaN(sessionDate.getTime())) return false;
            return sessionDate >= startOfWeek && sessionDate <= now;
          } catch (error) {
            console.warn('Error parsing session date:', dateString, error);
            return false;
          }
        }).length;

        console.log('Workouts this week:', workoutsThisWeek);

        // Count active days this week (days with any activity)
        const activeDaysThisWeek = new Set(
          workoutData
            .filter((session: any) => {
              // Check if workout is completed
              const isCompleted =
                session.completed === true ||
                session.status === 'completed' ||
                session.completedAt ||
                session.completed_at ||
                session.endTime ||
                session.end_time;

              if (!isCompleted) return false;

              // Get the completion date
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
                if (isNaN(sessionDate.getTime())) return false;
                return sessionDate >= startOfWeek && sessionDate <= now;
              } catch (error) {
                console.warn(
                  'Error parsing session date for active days:',
                  dateString,
                  error
                );
                return false;
              }
            })
            .map((session: any) => {
              const dateString =
                session.completedAt ||
                session.completed_at ||
                session.endTime ||
                session.end_time ||
                session.createdAt ||
                session.created_at;
              try {
                return new Date(dateString).toDateString();
              } catch (error) {
                console.warn(
                  'Error formatting date for active days:',
                  dateString,
                  error
                );
                return null;
              }
            })
            .filter(Boolean)
        ).size;

        console.log('Active days this week:', activeDaysThisWeek);

        // Separate daily and weekly goals for better organization
        const dailyGoals = [
          {
            name: 'Calories',
            current: Math.round(todaysCalories),
            target:
              userProfile?.body?.dailyCalorieGoal ||
              userProfile?.dailyCalorieGoal ||
              nutritionData.daily_goal ||
              2000,
            unit: 'kcal',
          },
          {
            name: 'Water',
            current:
              nutritionData.water_intake ||
              waterIntake?.body?.glasses ||
              waterIntake?.glasses ||
              0,
            target:
              nutritionData.water_goal ||
              userProfile?.body?.dailyWaterGoal ||
              userProfile?.dailyWaterGoal ||
              8,
            unit: 'glasses',
          },
        ];

        const weeklyGoals = [
          {
            name: 'Workouts',
            current: workoutsThisWeek,
            target:
              userProfile?.body?.weeklyWorkoutGoal ||
              userProfile?.weeklyWorkoutGoal ||
              (workoutPlans && workoutPlans.length > 0
                ? workoutPlans[0].weeklyTarget || 4
                : 4),
            unit: 'sessions',
          },
          {
            name: 'Active Days',
            current: activeDaysThisWeek,
            target:
              userProfile?.body?.weeklyActiveDaysGoal ||
              userProfile?.weeklyActiveDaysGoal ||
              5,
            unit: 'days',
          },
        ];

        setData({
          // Core metrics
          workoutsCompleted: completedWorkouts,
          totalWorkouts: workoutData.length,
          activePlan:
            Array.isArray(workoutPlans) && workoutPlans.length > 0
              ? workoutPlans[0].name || 'No active plan'
              : 'No active plan',
          caloriesToday: todaysCalories,
          todaysProtein,
          todaysCarbs,
          todaysFat,
          nutritionStreak,
          nutritionScore,
          macroBalance,
          weeklyCalorieAvg: nutritionData.weekly_average || 0,
          monthlyCalorieAvg: nutritionData.monthly_average || 0,
          mealsToday: nutritionData.meals_today || 0,
          calorieGoal: userProfile?.calorieGoal || 2000,
          waterIntake: nutritionData.water_intake || waterIntake?.glasses || 0,
          waterGoal: 8,
          aiRecommendations: Array.isArray(achievements?.body)
            ? Math.min(achievements.body.length, 5)
            : 0,
          currentStreak,
          totalWorkoutTime,
          lastWorkoutDate: getLastWorkoutDate(workoutSessions),
          weeklyProgress: Math.round(((completedWorkouts % 7) / 4) * 100),
          monthlyGoal: 20,
          achievements: Array.isArray(achievements?.body)
            ? achievements.body
            : Array.isArray(achievements)
              ? achievements
              : [],

          // Detailed metrics
          avgWorkoutDuration,
          totalCaloriesBurned:
            workoutAnalytics?.body?.totalCaloriesBurned ||
            workoutAnalytics?.totalCaloriesBurned ||
            Math.round(totalWorkoutTime * 8),
          strengthProgress: calculateProgress(
            strengthProgress?.body,
            'strength'
          ),
          enduranceProgress: calculateProgress(
            workoutAnalytics?.body,
            'endurance'
          ),
          weightProgress: latestMeasurements?.weight || 0,
          bodyFatProgress: latestMeasurements?.bodyFat || 0,
          sleepHours:
            todaysSleepData?.body?.hours ||
            todaysSleepData?.hours ||
            userProfile?.body?.sleepHours ||
            latestMeasurements?.sleepHours ||
            7,
          sleepQuality:
            todaysSleepData?.body?.quality || todaysSleepData?.quality || 3,
          sleepGoal:
            userProfile?.body?.sleepGoal || userProfile?.sleepGoal || 8,

          // Activity data
          recentActivities,
          workoutHistory: processWorkoutHistory(workoutSessions),
          nutritionHistory: processNutritionHistory(todaysMeals, nutritionData),
          strengthData: processStrengthData(strengthProgress),
          progressPhotos: Array.isArray((progressPhotos as any)?.body)
            ? (progressPhotos as any).body
            : Array.isArray(progressPhotos)
              ? progressPhotos
              : [],

          // Goals and milestones
          dailyGoals,
          weeklyGoals,
          monthlyGoals: Array.isArray(milestones?.body)
            ? milestones.body.slice(0, 3)
            : Array.isArray(milestones)
              ? milestones.slice(0, 3)
              : [],
          upcomingWorkouts: getUpcomingWorkouts(workoutPlans),
        });
      } catch (e: any) {
        console.error('Dashboard error:', e);
        setError(e?.message || 'Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    },
    []
  );

  // Helper functions
  const calculateWorkoutStreak = (sessions: any[]) => {
    // Handle different API response formats
    const workoutData = Array.isArray(sessions)
      ? sessions
      : Array.isArray((sessions as any)?.body)
        ? (sessions as any).body
        : [];

    if (workoutData.length === 0) return 0;

    const sortedSessions = workoutData
      .filter((s: any) => {
        // More comprehensive completion check
        return (
          s.completed === true ||
          s.status === 'completed' ||
          s.completedAt ||
          s.completed_at ||
          s.endTime ||
          s.end_time
        );
      })
      .map((session: any) => {
        const dateString =
          session.completedAt || session.completed_at || session.createdAt;
        if (!dateString) return null;

        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          console.warn(
            'Invalid session date in streak calculation:',
            dateString
          );
          return null;
        }

        return { ...session, validDate: date };
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
        (currentDate.getTime() - sessionDate.getTime()) / (1000 * 60 * 60 * 24)
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
    // Handle different API response formats
    const workoutData = Array.isArray(sessions)
      ? sessions
      : Array.isArray((sessions as any)?.body)
        ? (sessions as any).body
        : [];

    if (workoutData.length === 0) return null;

    const completedSessions = workoutData
      .filter((s: any) => {
        // More comprehensive completion check
        return (
          s.completed === true ||
          s.status === 'completed' ||
          s.completedAt ||
          s.completed_at ||
          s.endTime ||
          s.end_time
        );
      })
      .map((session: any) => {
        const dateString =
          session.completedAt || session.completed_at || session.createdAt;
        if (!dateString) return null;

        const date = new Date(dateString);
        if (isNaN(date.getTime())) {
          console.warn('Invalid session date in last workout:', dateString);
          return null;
        }

        return { ...session, validDate: date, originalDateString: dateString };
      })
      .filter(Boolean);

    if (completedSessions.length === 0) return null;

    const sortedSessions = completedSessions.sort(
      (a: any, b: any) => b.validDate.getTime() - a.validDate.getTime()
    );

    return sortedSessions[0].originalDateString;
  };

  const calculateProgress = (data: any, type: string) => {
    if (!data || !Array.isArray(data)) return 0;

    if (type === 'strength') {
      // Calculate average progress from strength data
      const totalProgress = data.reduce((sum: number, item: any) => {
        return sum + (item.progress || item.value || item.weight || 0);
      }, 0);
      return data.length > 0 ? Math.round(totalProgress / data.length) : 0;
    }

    if (type === 'endurance') {
      // Calculate endurance progress from workout analytics
      if (Array.isArray(data)) {
        // If data is an array, calculate average endurance from workouts
        const enduranceSum = data.reduce((sum: number, workout: any) => {
          return (
            sum + (workout.enduranceScore || workout.averageHeartRate || 0)
          );
        }, 0);
        return data.length > 0 ? Math.round(enduranceSum / data.length) : 0;
      }
      // If data is an object, use direct properties
      return (
        (data as any).averageHeartRate || (data as any).enduranceScore || 0
      );
    }

    return 0;
  };

  const generateRecentActivities = (
    workouts: any[],
    meals: any[],
    achievements: any[]
  ) => {
    const activities: any[] = [];

    // Handle different API response formats for workouts
    const workoutData = Array.isArray(workouts)
      ? workouts
      : Array.isArray((workouts as any)?.body)
        ? (workouts as any).body
        : [];

    // Add recent workouts (only completed ones)
    if (workoutData.length > 0) {
      workoutData
        .filter((workout: any) => {
          // Only include completed workouts
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
              icon: <Dumbbell size={16} />,
              title: `Completed ${workout.name || 'workout session'}`,
              description: `Duration: ${workout.duration_minutes || workout.durationMinutes || 'N/A'} minutes`,
              timestamp: formatTimeAgo(
                workout.completedAt ||
                  workout.completed_at ||
                  workout.createdAt ||
                  new Date().toISOString()
              ),
              iconColor: 'text-blue-600',
            });
          }
        });
    }

    // Add nutrition entries
    if (Array.isArray(meals) && meals.length > 0) {
      meals.slice(0, 2).forEach((meal: any) => {
        if (meal) {
          activities.push({
            icon: <Utensils size={16} />,
            title: `Logged ${meal.name || 'meal'}`,
            description: `${meal.calories || 0} calories`,
            timestamp: formatTimeAgo(
              meal.created_at || meal.createdAt || new Date().toISOString()
            ),
            iconColor: 'text-green-600',
          });
        }
      });
    }

    // Add achievements
    if (Array.isArray(achievements) && achievements.length > 0) {
      achievements.slice(0, 2).forEach((achievement: any) => {
        if (achievement) {
          activities.push({
            icon: <Trophy size={16} />,
            title: `Earned achievement`,
            description: achievement.name || achievement.title,
            timestamp: formatTimeAgo(
              achievement.earned_at ||
                achievement.createdAt ||
                new Date().toISOString()
            ),
            iconColor: 'text-yellow-600',
          });
        }
      });
    }

    return activities
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, 8);
  };

  const processWorkoutHistory = (sessions: any[]) => {
    // Handle different API response formats
    const workoutData = Array.isArray(sessions)
      ? sessions
      : Array.isArray((sessions as any)?.body)
        ? (sessions as any).body
        : [];

    if (workoutData.length === 0) return [];

    // Generate last 7 days of data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const date = new Date();
      date.setDate(date.getDate() - i);
      const dateStr = date.toISOString().split('T')[0];

      const dayWorkouts = workoutData.filter((session: any) => {
        try {
          const dateString =
            session.completedAt || session.completed_at || session.createdAt;

          // Skip sessions without valid date strings
          if (!dateString) return false;

          const sessionDate = new Date(dateString);

          // Check if the date is valid
          if (isNaN(sessionDate.getTime())) {
            console.warn('Invalid session date:', dateString);
            return false;
          }

          const sessionDateStr = sessionDate.toISOString().split('T')[0];
          // Check comprehensive completion status
          const isCompleted =
            session.completed === true ||
            session.status === 'completed' ||
            session.completedAt ||
            session.completed_at ||
            session.endTime ||
            session.end_time;

          return sessionDateStr === dateStr && isCompleted;
        } catch (error) {
          console.warn('Error processing session date:', error);
          return false;
        }
      });

      last7Days.push({
        label: date.toLocaleDateString('en-US', { weekday: 'short' }),
        value: dayWorkouts.length,
        timestamp: dateStr,
      });
    }

    return last7Days;
  };

  const processNutritionHistory = (meals: any[], nutritionStats: any) => {
    // Use real nutrition data from the last 7 days
    const last7Days = [];

    // If we have comprehensive nutrition stats, use weekly data
    if (nutritionStats?.weekly_calories) {
      const weeklyCalories = nutritionStats.weekly_calories;
      const avgDaily = Math.round(weeklyCalories / 7);

      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);

        last7Days.push({
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          value: i === 0 ? nutritionStats.today_calories || 0 : avgDaily,
          timestamp: date.toISOString().split('T')[0],
        });
      }
    } else {
      // Fallback to processing meals data
      for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];

        // For today, use today's meals, for other days use estimated data
        const calories =
          i === 0 && Array.isArray(meals)
            ? meals.reduce(
                (total: number, meal: any) =>
                  total + (meal.calories || meal.total_calories || 0),
                0
              )
            : 1800; // Default estimate

        last7Days.push({
          label: date.toLocaleDateString('en-US', { weekday: 'short' }),
          value: calories,
          timestamp: dateStr,
        });
      }
    }

    return last7Days;
  };

  const processStrengthData = (strengthProgressData: any) => {
    console.log('Processing strength data:', strengthProgressData);

    // Handle different API response formats
    let strengthData = [];
    if (Array.isArray(strengthProgressData)) {
      strengthData = strengthProgressData;
    } else if (Array.isArray(strengthProgressData?.body)) {
      strengthData = strengthProgressData.body;
    } else if (
      strengthProgressData?.body &&
      typeof strengthProgressData.body === 'object'
    ) {
      // If body is an object, try to extract array from common properties
      strengthData =
        strengthProgressData.body?.exercises ||
        strengthProgressData.body?.progress ||
        strengthProgressData.body?.data ||
        [];
    }

    console.log('Processed strength data array:', strengthData);

    if (!Array.isArray(strengthData) || strengthData.length === 0) {
      // Return demo data so users can see the chart structure
      console.log('No strength data available, using demo data');
      return [
        { label: 'Chest', value: 135 },
        { label: 'Back', value: 165 },
        { label: 'Shoulders', value: 95 },
        { label: 'Arms', value: 85 },
        { label: 'Legs', value: 225 },
        { label: 'Core', value: 45 },
      ];
    }

    // Group strength data by muscle group
    const muscleGroups: { [key: string]: number[] } = {};

    strengthData.forEach((entry: any) => {
      if (!entry) return;

      const muscleGroup =
        entry.muscleGroup ||
        entry.muscle_group ||
        entry.bodyPart ||
        entry.targetMuscle ||
        entry.category ||
        'Other';

      const weight =
        entry.weight ||
        entry.maxWeight ||
        entry.max_weight ||
        entry.value ||
        entry.personalRecord ||
        entry.currentWeight ||
        entry.reps ||
        0;

      if (weight > 0) {
        if (!muscleGroups[muscleGroup]) {
          muscleGroups[muscleGroup] = [];
        }
        muscleGroups[muscleGroup].push(weight);
      }
    });

    console.log('Grouped muscle data:', muscleGroups);

    // Calculate average for each muscle group
    const processedData = Object.entries(muscleGroups).map(
      ([label, weights]) => ({
        label: label.charAt(0).toUpperCase() + label.slice(1),
        value: Math.round(
          weights.reduce((sum: number, weight: number) => sum + weight, 0) /
            weights.length
        ),
      })
    );

    console.log('Final processed strength data:', processedData);

    // If we still don't have data after processing, return demo data
    if (processedData.length === 0) {
      console.log('No valid strength data found, returning demo data');
      return [
        { label: 'Chest', value: 135 },
        { label: 'Back', value: 165 },
        { label: 'Shoulders', value: 95 },
        { label: 'Arms', value: 85 },
        { label: 'Legs', value: 225 },
        { label: 'Core', value: 45 },
      ];
    }

    return processedData;
  };

  const getUpcomingWorkouts = (plans: any[]) => {
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
          new Date(a.scheduledFor).getTime() -
          new Date(b.scheduledFor).getTime()
      )
      .slice(0, 3);
  };

  const formatTimeAgo = (dateString: string) => {
    if (!dateString) return 'Unknown';

    try {
      const date = new Date(dateString);

      // Check if date is valid
      if (isNaN(date.getTime())) {
        console.warn('Invalid date string:', dateString);
        return 'Unknown';
      }

      const now = new Date();
      const diffInMs = now.getTime() - date.getTime();
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      const diffInHours = Math.floor(diffInMinutes / 60);
      const diffInDays = Math.floor(diffInHours / 24);

      if (diffInMinutes < 60) {
        return `${Math.max(0, diffInMinutes)}m ago`;
      } else if (diffInHours < 24) {
        return `${Math.max(0, diffInHours)}h ago`;
      } else {
        return `${Math.max(0, diffInDays)}d ago`;
      }
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Unknown';
    }
  };

  useEffect(() => {
    if (userLoading) return;
    fetchDashboardData();

    // Simple polling for "real-time" updates
    setIsLive(true);
    const id = setInterval(() => {
      fetchDashboardData();
    }, 30000);
    return () => clearInterval(id);
  }, [userLoading, fetchDashboardData]);

  if (userLoading || loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="flex items-center justify-center h-64">
          <div className="flex flex-col items-center space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Loading your dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
            <div className="flex items-center">
              <div className="text-red-600 dark:text-red-400">
                <AlertCircle size={24} />
              </div>
              <div className="ml-4">
                <h3 className="text-lg font-medium text-red-800 dark:text-red-200">
                  Dashboard Error
                </h3>
                <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                  {error}
                </p>
                <button
                  onClick={() => fetchDashboardData()}
                  className="mt-3 bg-red-100 dark:bg-red-800 text-red-800 dark:text-red-100 px-4 py-2 rounded-lg text-sm font-medium hover:bg-red-200 dark:hover:bg-red-700 transition-colors"
                >
                  Try Again
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const quickActions = [
    {
      icon: <Play size={24} />,
      title: 'Start Workout',
      description: 'Begin your training session',
      onClick: () => (window.location.href = '/workouts'),
      color: 'blue' as const,
    },
    {
      icon: <Utensils size={24} />,
      title: 'Log Nutrition',
      description: 'Track your meals and calories',
      onClick: () => (window.location.href = '/nutrition'),
      color: 'green' as const,
    },
    {
      icon: <Moon size={24} />,
      title: 'Log Sleep',
      description: 'Track your sleep hours',
      onClick: () => (window.location.href = '/sleep'),
      color: 'purple' as const,
    },
    {
      icon: <Camera size={24} />,
      title: 'Progress Photo',
      description: 'Capture your transformation',
      onClick: () => (window.location.href = '/progress'),
      color: 'orange' as const,
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Header */}
        <div className="bg-gradient-to-r from-blue-600 via-purple-600 to-indigo-600 rounded-2xl p-8 text-white mb-8 relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-2">
                  Welcome back, {me?.name || 'Champion'}! 💪
                </h1>
                <p className="text-blue-100 flex items-center gap-2 text-lg">
                  Ready to crush your fitness goals today?
                  {isLive && (
                    <span className="inline-flex items-center gap-1 text-xs bg-white/20 px-2 py-1 rounded-full">
                      <span className="h-2 w-2 bg-green-300 rounded-full animate-pulse" />
                      Live
                    </span>
                  )}
                </p>
              </div>
              <div className="hidden md:flex items-center space-x-4">
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {data?.currentStreak || 0}
                  </div>
                  <div className="text-sm text-blue-200">Day Streak</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold">
                    {data?.workoutsCompleted || 0}
                  </div>
                  <div className="text-sm text-blue-200">Workouts</div>
                </div>
              </div>
            </div>
          </div>
          {/* Background decoration */}
          <div className="absolute inset-0 bg-gradient-to-r from-white/5 to-transparent" />
          <div className="absolute top-4 right-4 w-32 h-32 bg-white/10 rounded-full blur-3xl" />
          <div className="absolute bottom-4 left-4 w-24 h-24 bg-white/5 rounded-full blur-2xl" />
        </div>

        {/* Key Metrics Grid */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricCard
            title="Workouts Completed"
            value={data?.workoutsCompleted || 0}
            change={{ value: 12, period: 'this week', positive: true }}
            icon={Dumbbell}
            iconColor="text-blue-600"
            description={`Total: ${data?.totalWorkouts || 0} sessions`}
          />
          <MetricCard
            title="Current Streak"
            value={`${data?.currentStreak || 0} days`}
            change={{ value: 3, period: 'vs last week', positive: true }}
            icon={Flame}
            iconColor="text-orange-600"
            description="Keep the momentum going!"
          />
          <MetricCard
            title="Calories Today"
            value={`${data?.caloriesToday || 0}`}
            icon={Target}
            iconColor="text-green-600"
            description={`Goal: ${data?.calorieGoal || 2000} kcal`}
          >
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-green-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(((data?.caloriesToday || 0) / (data?.calorieGoal || 2000)) * 100, 100)}%`,
                }}
              />
            </div>
          </MetricCard>
          <MetricCard
            title="Water Intake"
            value={`${data?.waterIntake || 0}/${data?.waterGoal || 8}`}
            icon={Droplets}
            iconColor="text-cyan-600"
            description="glasses today"
          >
            <div className="flex space-x-1 mt-2">
              {Array.from({ length: data?.waterGoal || 8 }).map((_, i) => (
                <div
                  key={i}
                  className={`flex-1 h-2 rounded-sm ${
                    i < (data?.waterIntake || 0)
                      ? 'bg-cyan-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          </MetricCard>
        </div>

        {/* Enhanced Nutrition Metrics */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <MetricCard
            title="Nutrition Score"
            value={`${data?.nutritionScore || 0}/100`}
            icon={Trophy}
            iconColor="text-yellow-600"
            description="Daily nutrition quality"
          >
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
              <div
                className="bg-yellow-600 h-2 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min(data?.nutritionScore || 0, 100)}%`,
                }}
              />
            </div>
          </MetricCard>

          <MetricCard
            title="Nutrition Streak"
            value={`${data?.nutritionStreak || 0} days`}
            icon={Flame}
            iconColor="text-red-600"
            description="Consecutive logging days"
          />

          <MetricCard
            title="Meals Today"
            value={`${data?.mealsToday || 0}`}
            icon={Utensils}
            iconColor="text-green-600"
            description={`Avg: ${Math.round((data?.weeklyCalorieAvg || 0) / 7)} cal/day`}
          />

          <MetricCard
            title="Protein Today"
            value={`${Math.round(data?.todaysProtein || 0)}g`}
            icon={Apple}
            iconColor="text-purple-600"
            description={`${Math.round(data?.macroBalance?.protein || 0)}% of calories`}
          >
            <div className="flex space-x-2 mt-2 text-xs">
              <div className="flex-1">
                <div className="text-gray-500">Carbs</div>
                <div className="font-semibold">
                  {Math.round(data?.todaysCarbs || 0)}g
                </div>
              </div>
              <div className="flex-1">
                <div className="text-gray-500">Fat</div>
                <div className="font-semibold">
                  {Math.round(data?.todaysFat || 0)}g
                </div>
              </div>
            </div>
          </MetricCard>
        </div>

        {/* Macro Balance Visualization */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            Today's Macro Balance
          </h3>
          <div className="grid gap-4 grid-cols-3">
            <div className="text-center">
              <div className="text-2xl font-bold text-purple-600">
                {Math.round(data?.macroBalance?.protein || 0)}%
              </div>
              <div className="text-sm text-gray-500">Protein</div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-purple-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(data?.macroBalance?.protein || 0, 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round(data?.macroBalance?.carbs || 0)}%
              </div>
              <div className="text-sm text-gray-500">Carbs</div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(data?.macroBalance?.carbs || 0, 100)}%`,
                  }}
                />
              </div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round(data?.macroBalance?.fat || 0)}%
              </div>
              <div className="text-sm text-gray-500">Fat</div>
              <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(data?.macroBalance?.fat || 0, 100)}%`,
                  }}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main Dashboard Grid */}
        <div className="grid gap-8 grid-cols-1 lg:grid-cols-3">
          {/* Left Column - Charts and Progress */}
          <div className="lg:col-span-2 space-y-8">
            {/* Workout Progress Chart */}
            <DashboardSection
              title="Workout Progress"
              subtitle="Your training consistency over the last 7 days"
              action={
                <button className="text-sm text-blue-600 hover:text-blue-700 font-medium">
                  View Details
                </button>
              }
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <LineChart
                  data={data?.workoutHistory || []}
                  height={250}
                  color="#3B82F6"
                  showDots={true}
                  showGrid={true}
                />
              </div>
            </DashboardSection>

            {/* Nutrition & Performance */}
            <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
              <DashboardSection
                title="Weekly Nutrition"
                subtitle="Calorie intake trends"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  <BarChart
                    data={data?.nutritionHistory || []}
                    height={200}
                    showValues={false}
                  />
                </div>
              </DashboardSection>

              <DashboardSection
                title="Strength Progress"
                subtitle="Muscle group development"
              >
                <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                  {data?.strengthData && data.strengthData.length > 0 ? (
                    <DonutChart
                      data={data.strengthData}
                      size={200}
                      showLabels={true}
                      showValues={true}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center h-[200px] text-gray-500 dark:text-gray-400">
                      <Dumbbell size={48} className="mb-2 opacity-50" />
                      <p className="text-sm font-medium">
                        No strength data available
                      </p>
                      <p className="text-xs">
                        Start tracking your workouts to see progress
                      </p>
                      <button
                        onClick={() => (window.location.href = '/workouts')}
                        className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium"
                      >
                        Start Workout
                      </button>
                    </div>
                  )}
                </div>
              </DashboardSection>
            </div>

            {/* Daily Goals Progress */}
            <DashboardSection
              title="Today's Goals"
              subtitle="Track your daily nutrition and hydration"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                  {data?.dailyGoals?.map((goal: any, index: number) => (
                    <div key={index} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {goal.name}
                        </h4>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {goal.current}/{goal.target} {goal.unit}
                        </span>
                      </div>
                      <ProgressRing
                        progress={(goal.current / goal.target) * 100}
                        size={80}
                        color={['#10B981', '#3B82F6'][index % 2]}
                        showPercentage={false}
                      />
                    </div>
                  )) || []}
                </div>
              </div>
            </DashboardSection>

            {/* Weekly Goals Progress */}
            <DashboardSection
              title="Weekly Goals"
              subtitle="Track your progress towards weekly targets"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
                  {data?.weeklyGoals?.map((goal: any, index: number) => (
                    <div key={index} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          {goal.name}
                        </h4>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          {goal.current}/{goal.target} {goal.unit}
                        </span>
                      </div>
                      <ProgressRing
                        progress={(goal.current / goal.target) * 100}
                        size={80}
                        color={['#F59E0B', '#EF4444'][index % 2]}
                        showPercentage={false}
                      />
                    </div>
                  )) || []}
                </div>
              </div>
            </DashboardSection>
          </div>

          {/* Right Column - Actions and Activities */}
          <div className="space-y-8">
            {/* Quick Actions */}
            <DashboardSection
              title="Quick Actions"
              subtitle="Jump into your routine"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <QuickActions actions={quickActions} columns={1} />
              </div>
            </DashboardSection>

            {/* Key Metrics Summary */}
            <DashboardSection title="Today's Summary">
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
                      <Clock className="h-5 w-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Avg Workout
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {data?.avgWorkoutDuration || 0} min
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-2xl font-bold text-blue-600">
                      {data?.totalCaloriesBurned || 0}
                    </div>
                    <div className="text-xs text-gray-500">calories burned</div>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                      <Heart className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Sleep
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {data?.sleepHours || 0}h / {data?.sleepGoal || 8}h
                      </p>
                      {data?.sleepQuality && (
                        <div className="flex items-center space-x-1 mt-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star
                              key={i}
                              className={`h-3 w-3 ${
                                i < (data.sleepQuality || 3)
                                  ? 'text-yellow-400 fill-current'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <ProgressRing
                    progress={
                      ((data?.sleepHours || 0) / (data?.sleepGoal || 8)) * 100
                    }
                    size={50}
                    color="#10B981"
                    showPercentage={false}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
                      <Brain className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        AI Insights
                      </p>
                      <p className="font-semibold text-gray-900 dark:text-white">
                        {data?.aiRecommendations || 0} available
                      </p>
                    </div>
                  </div>
                  <button className="text-purple-600 hover:text-purple-700 text-sm font-medium">
                    View All
                  </button>
                </div>
              </div>
            </DashboardSection>

            {/* Recent Activity */}
            <DashboardSection
              title="Recent Activity"
              subtitle="Your latest achievements"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                <ActivityFeed
                  activities={data?.recentActivities || []}
                  maxItems={6}
                  onViewAll={() => (window.location.href = '/activity')}
                />
              </div>
            </DashboardSection>

            {/* Upcoming Workouts */}
            <DashboardSection
              title="Scheduled Workouts"
              subtitle="Next sessions"
            >
              <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                {data?.upcomingWorkouts?.length ? (
                  <div className="space-y-3">
                    {data.upcomingWorkouts.map(
                      (workout: any, index: number) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {workout.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {workout.scheduledFor}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {workout.duration}min
                            </p>
                            {/* <button className="text-xs text-blue-600 hover:text-blue-700">
                              Start Early
                            </button> */}
                          </div>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-center py-6 text-gray-500 dark:text-gray-400">
                    <Calendar size={48} className="mx-auto mb-2 opacity-50" />
                    <p>No scheduled workouts</p>
                    <button className="mt-2 text-blue-600 hover:text-blue-700 text-sm font-medium">
                      Schedule a workout
                    </button>
                  </div>
                )}
              </div>
            </DashboardSection>
          </div>
        </div>

        {/* Achievements Section */}
        {data?.achievements && data.achievements.length > 0 && (
          <DashboardSection
            title="Recent Achievements"
            subtitle="Celebrate your progress!"
            action={
              <button className="text-sm text-yellow-600 hover:text-yellow-700 font-medium">
                View All
              </button>
            }
            className="mt-8"
          >
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
                {data.achievements
                  .slice(0, 6)
                  .map((achievement: any, index: number) => (
                    <div
                      key={index}
                      className="flex items-center space-x-3 p-4 bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800"
                    >
                      <div className="flex-shrink-0">
                        <Trophy className="h-8 w-8 text-yellow-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          {achievement.name ||
                            achievement.title ||
                            'Achievement Unlocked'}
                        </p>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {achievement.description ||
                            'Great job on your progress!'}
                        </p>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          </DashboardSection>
        )}
      </div>
    </div>
  );
}
