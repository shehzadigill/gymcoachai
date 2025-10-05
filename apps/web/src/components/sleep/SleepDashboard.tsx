'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Moon,
  Sun,
  Clock,
  Star,
  TrendingUp,
  Calendar,
  Target,
  Award,
  BarChart3,
  AlertTriangle,
} from 'lucide-react';
import { LineChart } from '../charts';

interface SleepStats {
  averageHours: number;
  averageQuality: number;
  totalNights: number;
  bestNight: { date: string; hours: number; quality: number };
  worstNight: { date: string; hours: number; quality: number };
  consistency: number; // percentage
  trend: 'improving' | 'declining' | 'stable';
}

interface SleepDashboardProps {
  period?: 'week' | 'month' | 'year';
  showGoals?: boolean;
}

export function SleepDashboard({
  period = 'month',
  showGoals = true,
}: SleepDashboardProps) {
  const me = useCurrentUser();
  const [loading, setLoading] = useState(true);
  const [sleepStats, setSleepStats] = useState<SleepStats | null>(null);
  const [sleepHistory, setSleepHistory] = useState<any[]>([]);
  const [sleepGoal, setSleepGoal] = useState(8); // Default 8 hours

  useEffect(() => {
    const loadSleepData = async () => {
      try {
        setLoading(true);

        // Load sleep statistics
        const statsResponse = await api.getSleepStats(undefined, period);
        if (statsResponse) {
          setSleepStats(statsResponse);
        }

        // Load sleep history for charts
        const days = period === 'week' ? 7 : period === 'month' ? 30 : 365;
        const historyResponse = await api.getSleepHistory(undefined, days);
        if (historyResponse && Array.isArray(historyResponse)) {
          setSleepHistory(historyResponse);
        }

        // Load user profile for sleep goal
        const profileResponse = await api.getUserProfile();
        if (profileResponse?.body?.sleepGoal) {
          setSleepGoal(profileResponse.body.sleepGoal);
        }
      } catch (error) {
        console.error('Failed to load sleep data:', error);
      } finally {
        setLoading(false);
      }
    };

    if (me?.id) {
      loadSleepData();
    }
  }, [period, me?.id]);

  const formatSleepData = (history: any[]): any[] => {
    return history.map((entry) => ({
      label: new Date(entry.date).toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      }),
      value: entry.hours + (entry.minutes || 0) / 60,
      quality: entry.quality || 3,
      timestamp: entry.date,
    }));
  };

  const getGoalProgress = () => {
    if (!sleepStats) return 0;
    return Math.min((sleepStats.averageHours / sleepGoal) * 100, 100);
  };

  const getConsistencyColor = (consistency: number) => {
    if (consistency >= 80) return 'text-green-600';
    if (consistency >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'improving':
        return <TrendingUp className="h-4 w-4 text-green-600" />;
      case 'declining':
        return <AlertTriangle className="h-4 w-4 text-red-600" />;
      default:
        return <BarChart3 className="h-4 w-4 text-gray-600" />;
    }
  };

  const getTrendLabel = (trend: string) => {
    switch (trend) {
      case 'improving':
        return 'Improving';
      case 'declining':
        return 'Needs Attention';
      default:
        return 'Stable';
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="animate-pulse">
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/4 mb-4"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sleep Overview Cards */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Average Sleep */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Moon className="h-6 w-6 text-blue-600" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Average Sleep
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {sleepStats?.averageHours?.toFixed(1) || '0.0'}h
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Goal: {sleepGoal}h ({getGoalProgress().toFixed(0)}%)
            </div>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-3">
            <div
              className="bg-blue-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${getGoalProgress()}%` }}
            />
          </div>
        </div>

        {/* Sleep Quality */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg">
              <Star className="h-6 w-6 text-yellow-600" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Avg Quality
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {sleepStats?.averageQuality?.toFixed(1) || '0.0'}/5
            </div>
            <div className="flex items-center space-x-1">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className={`h-4 w-4 ${
                    i < Math.round(sleepStats?.averageQuality || 0)
                      ? 'text-yellow-400 fill-current'
                      : 'text-gray-300 dark:text-gray-600'
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Consistency */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
              <Target className="h-6 w-6 text-green-600" />
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Consistency
            </span>
          </div>
          <div className="space-y-1">
            <div
              className={`text-2xl font-bold ${getConsistencyColor(sleepStats?.consistency || 0)}`}
            >
              {sleepStats?.consistency?.toFixed(0) || '0'}%
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {sleepStats?.totalNights || 0} nights tracked
            </div>
          </div>
        </div>

        {/* Trend */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/20 rounded-lg">
              {getTrendIcon(sleepStats?.trend || 'stable')}
            </div>
            <span className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">
              Trend
            </span>
          </div>
          <div className="space-y-1">
            <div className="text-lg font-bold text-gray-900 dark:text-white">
              {getTrendLabel(sleepStats?.trend || 'stable')}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              vs last {period}
            </div>
          </div>
        </div>
      </div>

      {/* Sleep History Chart */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            Sleep History
          </h3>
          <div className="flex items-center space-x-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Last {period}</span>
          </div>
        </div>

        {sleepHistory.length > 0 ? (
          <LineChart
            data={formatSleepData(sleepHistory)}
            height={300}
            color="#3B82F6"
            showDots={true}
            showGrid={true}
          />
        ) : (
          <div className="flex items-center justify-center h-[300px] text-gray-500 dark:text-gray-400">
            <div className="text-center">
              <Moon className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No sleep data available</p>
              <p className="text-sm">Start logging your sleep to see trends</p>
            </div>
          </div>
        )}
      </div>

      {/* Best & Worst Nights */}
      {sleepStats?.bestNight && sleepStats?.worstNight && (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {/* Best Night */}
          <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-xl p-6 border border-green-200 dark:border-green-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-green-100 dark:bg-green-900/20 rounded-lg">
                <Award className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-green-800 dark:text-green-200">
                  Best Night
                </h4>
                <p className="text-sm text-green-600 dark:text-green-300">
                  {new Date(sleepStats.bestNight.date).toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    }
                  )}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700 dark:text-green-300">
                  Duration
                </span>
                <span className="font-semibold text-green-800 dark:text-green-200">
                  {sleepStats.bestNight.hours}h
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-green-700 dark:text-green-300">
                  Quality
                </span>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < sleepStats.bestNight.quality
                          ? 'text-green-500 fill-current'
                          : 'text-green-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Worst Night */}
          <div className="bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 rounded-xl p-6 border border-red-200 dark:border-red-800">
            <div className="flex items-center space-x-3 mb-4">
              <div className="p-2 bg-red-100 dark:bg-red-900/20 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-red-800 dark:text-red-200">
                  Needs Improvement
                </h4>
                <p className="text-sm text-red-600 dark:text-red-300">
                  {new Date(sleepStats.worstNight.date).toLocaleDateString(
                    'en-US',
                    {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    }
                  )}
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-700 dark:text-red-300">
                  Duration
                </span>
                <span className="font-semibold text-red-800 dark:text-red-200">
                  {sleepStats.worstNight.hours}h
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-red-700 dark:text-red-300">
                  Quality
                </span>
                <div className="flex items-center space-x-1">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={`h-3 w-3 ${
                        i < sleepStats.worstNight.quality
                          ? 'text-red-500 fill-current'
                          : 'text-red-300'
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sleep Tips */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-6 border border-indigo-200 dark:border-indigo-800">
        <h4 className="font-semibold text-indigo-800 dark:text-indigo-200 mb-3 flex items-center space-x-2">
          <Sun className="h-5 w-5" />
          <span>Sleep Tips</span>
        </h4>
        <div className="grid gap-3 grid-cols-1 md:grid-cols-2">
          <div className="text-sm text-indigo-700 dark:text-indigo-300">
            • Maintain a consistent sleep schedule
          </div>
          <div className="text-sm text-indigo-700 dark:text-indigo-300">
            • Create a relaxing bedtime routine
          </div>
          <div className="text-sm text-indigo-700 dark:text-indigo-300">
            • Keep your bedroom cool and dark
          </div>
          <div className="text-sm text-indigo-700 dark:text-indigo-300">
            • Avoid screens 1 hour before bed
          </div>
        </div>
      </div>
    </div>
  );
}
