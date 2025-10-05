'use client';

import { useState, useEffect } from 'react';
import { api } from '../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Moon,
  Sun,
  Clock,
  Star,
  Calendar,
  Save,
  Trash2,
  TrendingUp,
  AlertCircle,
  CheckCircle,
} from 'lucide-react';

interface SleepData {
  date: string;
  hours: number;
  minutes?: number;
  quality?: number; // 1-5 scale
  bedTime?: string;
  wakeTime?: string;
  notes?: string;
}

interface SleepLoggerProps {
  selectedDate?: string;
  onSleepLogged?: (data: SleepData) => void;
  showHistory?: boolean;
}

export function SleepLogger({
  selectedDate,
  onSleepLogged,
  showHistory = true,
}: SleepLoggerProps) {
  const me = useCurrentUser();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  // Current date if none selected
  const currentDate = selectedDate || new Date().toISOString().split('T')[0];

  // Form state
  const [sleepData, setSleepData] = useState<SleepData>({
    date: currentDate,
    hours: 8,
    minutes: 0,
    quality: 3,
    bedTime: '22:00',
    wakeTime: '06:00',
    notes: '',
  });

  // History state
  const [sleepHistory, setSleepHistory] = useState<SleepData[]>([]);
  const [existingEntry, setExistingEntry] = useState<SleepData | null>(null);

  // Load existing data for the selected date
  useEffect(() => {
    const loadSleepData = async () => {
      try {
        setLoading(true);

        // Load sleep data for the specific date
        const response = await api.getSleepData(undefined, currentDate);

        if (response) {
          setExistingEntry(response);
          setSleepData(response);
        } else {
          // No existing data, reset to defaults
          setExistingEntry(null);
          setSleepData({
            date: currentDate,
            hours: 8,
            minutes: 0,
            quality: 3,
            bedTime: '22:00',
            wakeTime: '06:00',
            notes: '',
          });
        }

        // Load recent history if requested
        if (showHistory) {
          const historyResponse = await api.getSleepHistory(undefined, 7);
          setSleepHistory(
            Array.isArray(historyResponse) ? historyResponse : []
          );
        }
      } catch (error) {
        console.warn('Failed to load sleep data:', error);
        // Don't show error for missing data, it's expected for new entries
      } finally {
        setLoading(false);
      }
    };

    if (me?.id) {
      loadSleepData();
    }
  }, [currentDate, me?.id, showHistory]);

  const handleSave = async () => {
    try {
      setSaving(true);

      let response;
      if (existingEntry) {
        response = await api.updateSleepData(sleepData);
      } else {
        response = await api.logSleep(sleepData);
      }

      setMessage({
        type: 'success',
        text: `Sleep data ${existingEntry ? 'updated' : 'logged'} successfully!`,
      });

      setExistingEntry(sleepData);

      // Callback for parent component
      if (onSleepLogged) {
        onSleepLogged(sleepData);
      }

      // Refresh history
      if (showHistory) {
        const historyResponse = await api.getSleepHistory(undefined, 7);
        setSleepHistory(Array.isArray(historyResponse) ? historyResponse : []);
      }

      // Clear message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Failed to save sleep data:', error);
      setMessage({
        type: 'error',
        text: error?.message || 'Failed to save sleep data',
      });
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setSaving(false);
    }
  };

  const calculateTotalSleep = () => {
    const total = sleepData.hours + (sleepData.minutes || 0) / 60;
    return total.toFixed(1);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (dateString === today.toISOString().split('T')[0]) {
      return 'Today';
    } else if (dateString === yesterday.toISOString().split('T')[0]) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      });
    }
  };

  const getQualityLabel = (quality: number) => {
    const labels = ['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'];
    return labels[quality] || 'Good';
  };

  const getQualityColor = (quality: number) => {
    const colors = [
      '',
      'text-red-600',
      'text-orange-600',
      'text-yellow-600',
      'text-green-600',
      'text-emerald-600',
    ];
    return colors[quality] || 'text-yellow-600';
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-center h-32">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Sleep Logger Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
              <Moon className="h-6 w-6 text-indigo-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Sleep Logger
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {formatDate(currentDate)} • {calculateTotalSleep()} hours
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Calendar className="h-4 w-4 text-gray-400" />
            <input
              type="date"
              value={sleepData.date}
              onChange={(e) =>
                setSleepData({ ...sleepData, date: e.target.value })
              }
              className="text-sm border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-1 bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        {/* Message */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg flex items-center space-x-2 ${
              message.type === 'success'
                ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
            }`}
          >
            {message.type === 'success' ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <span className="text-sm">{message.text}</span>
          </div>
        )}

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2">
          {/* Sleep Duration */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center space-x-2">
              <Clock className="h-4 w-4" />
              <span>Sleep Duration</span>
            </h4>

            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Hours
                </label>
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={sleepData.hours}
                  onChange={(e) =>
                    setSleepData({
                      ...sleepData,
                      hours: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Minutes
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={sleepData.minutes || 0}
                  onChange={(e) =>
                    setSleepData({
                      ...sleepData,
                      minutes: parseInt(e.target.value) || 0,
                    })
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            {/* Sleep Times */}
            <div className="grid gap-4 grid-cols-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Bed Time
                </label>
                <input
                  type="time"
                  value={sleepData.bedTime || ''}
                  onChange={(e) =>
                    setSleepData({ ...sleepData, bedTime: e.target.value })
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Wake Time
                </label>
                <input
                  type="time"
                  value={sleepData.wakeTime || ''}
                  onChange={(e) =>
                    setSleepData({ ...sleepData, wakeTime: e.target.value })
                  }
                  className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
          </div>

          {/* Sleep Quality & Notes */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900 dark:text-white flex items-center space-x-2">
              <Star className="h-4 w-4" />
              <span>Sleep Quality</span>
            </h4>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600 dark:text-gray-400">
                  {getQualityLabel(sleepData.quality || 3)}
                </span>
                <span
                  className={`text-sm font-medium ${getQualityColor(sleepData.quality || 3)}`}
                >
                  {sleepData.quality}/5
                </span>
              </div>
              <input
                type="range"
                min="1"
                max="5"
                value={sleepData.quality || 3}
                onChange={(e) =>
                  setSleepData({
                    ...sleepData,
                    quality: parseInt(e.target.value),
                  })
                }
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>Poor</span>
                <span>Fair</span>
                <span>Good</span>
                <span>Very Good</span>
                <span>Excellent</span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Notes (optional)
              </label>
              <textarea
                value={sleepData.notes || ''}
                onChange={(e) =>
                  setSleepData({ ...sleepData, notes: e.target.value })
                }
                placeholder="How did you sleep? Any factors affecting your sleep?"
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
                rows={3}
              />
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="mt-6 flex justify-end">
          <button
            onClick={handleSave}
            disabled={saving}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white px-6 py-2 rounded-lg font-medium flex items-center space-x-2 transition-colors"
          >
            {saving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                <span>{existingEntry ? 'Update' : 'Log'} Sleep</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Sleep History */}
      {showHistory && sleepHistory.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
          <h4 className="font-medium text-gray-900 dark:text-white mb-4 flex items-center space-x-2">
            <TrendingUp className="h-4 w-4" />
            <span>Recent Sleep History</span>
          </h4>

          <div className="space-y-3">
            {sleepHistory.map((entry, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-indigo-100 dark:bg-indigo-900/20 rounded-lg">
                    <Moon className="h-4 w-4 text-indigo-600" />
                  </div>
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {formatDate(entry.date)}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {entry.hours}h {entry.minutes || 0}m •{' '}
                      {getQualityLabel(entry.quality || 3)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <div className="flex items-center space-x-2">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-3 w-3 ${
                          i < (entry.quality || 3)
                            ? 'text-yellow-400 fill-current'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    ))}
                  </div>
                  {entry.bedTime && entry.wakeTime && (
                    <p className="text-xs text-gray-400 mt-1">
                      {entry.bedTime} - {entry.wakeTime}
                    </p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
