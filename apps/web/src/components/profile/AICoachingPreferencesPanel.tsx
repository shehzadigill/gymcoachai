'use client';

import React, { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  Bot,
  Brain,
  MessageSquare,
  Target,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Heart,
  Zap,
  BookOpen,
  Shield,
} from 'lucide-react';
import { aiService } from '../../lib/ai-service-client';
import { api } from '../../lib/api-client';

// AI Preferences interface for the user profile service
// Matches the backend AITrainerPreferences structure
interface AIPreferences {
  enabled: boolean;
  coachingStyle: string;
  communicationFrequency: string;
  focusAreas: string[];
  injuryHistory: string[];
  equipmentAvailable: string[];
  workoutDurationPreference: number;
  workoutDaysPerWeek: number;
  mealPreferences: string[];
  allergies: string[];
  supplementPreferences: string[];
  // Frontend-only fields for UI state
  motivationType?: string;
}

interface AICoachingPreferencesPanelProps {
  userId: string;
  currentPreferences?: any;
  onPreferencesUpdate?: (preferences: any) => void;
  className?: string;
}

interface CoachingStyle {
  id: string;
  name: string;
  description: string;
  icon: React.ComponentType<any>;
  characteristics: string[];
  example: string;
}

const coachingStyles: CoachingStyle[] = [
  {
    id: 'motivational',
    name: 'Motivational',
    description: 'Encouraging and uplifting, focuses on positive reinforcement',
    icon: Heart,
    characteristics: [
      'Positive reinforcement',
      'Celebrates wins',
      'Encouraging tone',
    ],
    example:
      "Great job on completing that workout! You're making amazing progress!",
  },
  {
    id: 'analytical',
    name: 'Analytical',
    description: 'Data-driven and technical, provides detailed insights',
    icon: Brain,
    characteristics: [
      'Data-focused',
      'Technical details',
      'Performance metrics',
    ],
    example:
      'Your squat form shows 15% improvement in depth consistency this week.',
  },
  {
    id: 'educational',
    name: 'Educational',
    description: 'Teaching-focused, explains the why behind recommendations',
    icon: BookOpen,
    characteristics: [
      'Explains reasoning',
      'Educational content',
      'Learning focus',
    ],
    example:
      'Deadlifts target your posterior chain, which improves posture and athletic performance.',
  },
  {
    id: 'supportive',
    name: 'Supportive',
    description: 'Gentle and understanding, adapts to your emotional needs',
    icon: Shield,
    characteristics: ['Gentle approach', 'Emotional support', 'Adaptive tone'],
    example:
      "I understand you had a tough day. Let's do a lighter workout today.",
  },
  {
    id: 'challenging',
    name: 'Challenging',
    description: 'Pushes you to exceed your limits and achieve more',
    icon: Zap,
    characteristics: [
      'High expectations',
      'Pushes limits',
      'Achievement focus',
    ],
    example:
      "You're capable of more than you think. Let's add 10lbs to that lift.",
  },
];

const communicationFrequencies = [
  {
    id: 'daily',
    name: 'Daily',
    description: 'Regular check-ins and motivation',
  },
  { id: 'weekly', name: 'Weekly', description: 'Weekly reviews and planning' },
  {
    id: 'on-demand',
    name: 'On-Demand',
    description: 'Only when you ask for help',
  },
];

const motivationTypes = [
  {
    id: 'achievement',
    name: 'Achievement',
    description: 'Driven by goals and accomplishments',
  },
  {
    id: 'social',
    name: 'Social',
    description: 'Motivated by community and sharing',
  },
  {
    id: 'personal',
    name: 'Personal',
    description: 'Focused on personal growth and health',
  },
  {
    id: 'competitive',
    name: 'Competitive',
    description: 'Thrives on challenges and competition',
  },
];

export default function AICoachingPreferencesPanel({
  userId,
  currentPreferences,
  onPreferencesUpdate,
  className = '',
}: AICoachingPreferencesPanelProps) {
  const t = useTranslations('profile_page');

  console.log(
    '🔧 AICoachingPreferencesPanel - currentPreferences prop:',
    currentPreferences
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [preferences, setPreferences] = useState<AIPreferences>(() => {
    const defaultPrefs = {
      enabled: true,
      coachingStyle: 'motivational',
      communicationFrequency: 'weekly',
      motivationType: 'achievement',
      focusAreas: [] as string[],
      injuryHistory: [] as string[],
      equipmentAvailable: [] as string[],
      workoutDurationPreference: 60,
      workoutDaysPerWeek: 4,
      mealPreferences: [] as string[],
      allergies: [] as string[],
      supplementPreferences: [] as string[],
      ...currentPreferences,
    };
    console.log('🎯 Initial preferences state:', defaultPrefs);
    return defaultPrefs;
  });

  const [activeTab, setActiveTab] = useState<
    'style' | 'communication' | 'goals' | 'equipment'
  >('style');

  useEffect(() => {
    console.log(
      '🚀 AICoachingPreferencesPanel mounted, fetching fresh preferences...'
    );
    fetchPersonalizationProfile();
  }, []); // Remove userId dependency to ensure fresh API call on mount

  const fetchPersonalizationProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log('Fetching user preferences for userId:', userId);

      // Fetch AI preferences from user profile service
      const res = await api.getUserPreferences(userId);
      const userPreferencesResponse = res;
      console.log('User preferences response:', userPreferencesResponse);

      if (userPreferencesResponse?.aiTrainer) {
        console.log(
          '✅ Found AI trainer preferences:',
          userPreferencesResponse.aiTrainer
        );

        // Map backend snake_case to frontend camelCase and add defaults
        const aiTrainerPrefs = userPreferencesResponse.aiTrainer as any;
        const mappedPreferences: Partial<AIPreferences> = {
          enabled: aiTrainerPrefs.enabled ?? true,
          coachingStyle:
            aiTrainerPrefs.coaching_style ||
            aiTrainerPrefs.coachingStyle ||
            'motivational',
          communicationFrequency:
            aiTrainerPrefs.communication_frequency ||
            aiTrainerPrefs.communicationFrequency ||
            'weekly',
          focusAreas:
            aiTrainerPrefs.focus_areas || aiTrainerPrefs.focusAreas || [],
          injuryHistory:
            aiTrainerPrefs.injury_history || aiTrainerPrefs.injuryHistory || [],
          equipmentAvailable:
            aiTrainerPrefs.equipment_available ||
            aiTrainerPrefs.equipmentAvailable ||
            [],
          workoutDurationPreference:
            aiTrainerPrefs.workout_duration_preference ||
            aiTrainerPrefs.workoutDurationPreference ||
            60,
          workoutDaysPerWeek:
            aiTrainerPrefs.workout_days_per_week ||
            aiTrainerPrefs.workoutDaysPerWeek ||
            4,
          mealPreferences:
            aiTrainerPrefs.meal_preferences ||
            aiTrainerPrefs.mealPreferences ||
            [],
          allergies: aiTrainerPrefs.allergies || [],
          supplementPreferences:
            aiTrainerPrefs.supplement_preferences ||
            aiTrainerPrefs.supplementPreferences ||
            [],
        };

        const newPreferences = {
          ...preferences,
          ...mappedPreferences,
        };

        setPreferences(newPreferences);
        console.log('🎯 Updated preferences state:', newPreferences);
        console.log('🎯 Specifically enabled value:', newPreferences.enabled);
      } else {
        console.log(
          'ℹ️ No AI trainer preferences found, ensuring defaults are set'
        );

        // Ensure preferences have proper defaults when no backend data exists
        setPreferences((prev: AIPreferences) => ({
          ...prev,
          enabled: true, // Explicitly ensure enabled is true by default
          coachingStyle: prev.coachingStyle || 'motivational',
          communicationFrequency: prev.communicationFrequency || 'weekly',
          focusAreas: prev.focusAreas || [],
          injuryHistory: prev.injuryHistory || [],
          equipmentAvailable: prev.equipmentAvailable || [],
          workoutDurationPreference: prev.workoutDurationPreference || 60,
          workoutDaysPerWeek: prev.workoutDaysPerWeek || 4,
          mealPreferences: prev.mealPreferences || [],
          allergies: prev.allergies || [],
          supplementPreferences: prev.supplementPreferences || [],
        }));

        console.log('🎯 Set default preferences with enabled=true');
      }
    } catch (err: any) {
      console.error('Failed to fetch AI preferences:', err);
      setError(err.message || 'Failed to load AI preferences');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key: keyof AIPreferences, value: any) => {
    console.log('🔧 Preference change:', key, '=', value);
    const newPreferences = {
      ...preferences,
      [key]: value,
    };
    console.log('🔧 New preferences after change:', newPreferences);
    setPreferences(newPreferences);
  };

  const handleArrayPreferenceChange = (
    key: keyof AIPreferences,
    value: string,
    checked: boolean
  ) => {
    const updatedPreferences = {
      ...preferences,
      [key]: checked
        ? [...(preferences[key] as string[]), value]
        : (preferences[key] as string[]).filter((item) => item !== value),
    };
    setPreferences(updatedPreferences);

    // Immediately notify parent component for real-time sync
    if (onPreferencesUpdate) {
      onPreferencesUpdate(updatedPreferences);
    }
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      console.log('💾 Saving AI preferences:', preferences);

      // Map frontend camelCase to backend snake_case format
      const backendPreferences = {
        enabled: preferences.enabled,
        coaching_style: preferences.coachingStyle,
        communication_frequency: preferences.communicationFrequency,
        focus_areas: preferences.focusAreas,
        injury_history: preferences.injuryHistory,
        equipment_available: preferences.equipmentAvailable,
        workout_duration_preference: preferences.workoutDurationPreference,
        workout_days_per_week: preferences.workoutDaysPerWeek,
        meal_preferences: preferences.mealPreferences,
        allergies: preferences.allergies,
        supplement_preferences: preferences.supplementPreferences,
      };

      console.log('📤 Sending backend preferences:', backendPreferences);

      // Save preferences to user profile service
      const saveResult = await api.updateAIPreferences(backendPreferences);

      console.log('✅ Save result:', saveResult);

      // Immediately update parent component with the saved preferences
      if (onPreferencesUpdate) {
        onPreferencesUpdate(preferences);
      }

      // Refresh the preferences data to ensure we have the latest from backend
      await fetchPersonalizationProfile();

      // Also submit feedback to AI service about preference changes
      // This helps the AI learn and improve personalization
      try {
        await aiService.submitPersonalizationFeedback({
          type: 'preference_update',
          rating: 5, // User actively updated preferences
          comments: `User updated AI preferences: enabled=${preferences.enabled}, coaching style=${preferences.coachingStyle}, communication=${preferences.communicationFrequency}, motivation=${preferences.motivationType}`,
        });
      } catch (feedbackError) {
        console.warn('Failed to submit preference feedback:', feedbackError);
        // Don't fail the whole operation if feedback fails
      }

      setSuccess('AI coaching preferences updated successfully!');
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error('Failed to save preferences:', err);
      setError(err.message || 'Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const handleAnalyzePreferences = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await aiService.analyzeUserPreferences({
        conversationHistory: true,
        userBehavior: true,
        feedbackHistory: true,
        preferences: true,
      });

      if (response) {
        // Apply AI analysis to update preferences
        const profile = response;
        const oldPreferences = { ...preferences };
        const newPreferences = {
          ...preferences,
          coachingStyle: profile.coachingStyle || preferences.coachingStyle,
          communicationFrequency: preferences.communicationFrequency, // Keep current preference
          motivationType: profile.motivationType || preferences.motivationType,
        };

        setPreferences(newPreferences);

        // Submit feedback about AI analysis usage
        try {
          await aiService.submitPersonalizationFeedback({
            type: 'ai_analysis_used',
            rating: 4, // User engaged with AI analysis feature
            comments: `User requested AI preference analysis. Changes suggested: ${
              oldPreferences.coachingStyle !== newPreferences.coachingStyle
                ? `coaching style from ${oldPreferences.coachingStyle} to ${newPreferences.coachingStyle}`
                : 'no coaching style change'
            }, ${
              oldPreferences.motivationType !== newPreferences.motivationType
                ? `motivation type from ${oldPreferences.motivationType} to ${newPreferences.motivationType}`
                : 'no motivation type change'
            }`,
          });
        } catch (feedbackError) {
          console.warn('Failed to submit analysis feedback:', feedbackError);
        }
      }
    } catch (err: any) {
      console.error('Failed to analyze preferences:', err);
      setError(err.message || 'Failed to analyze preferences');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
      >
        <div className="animate-pulse">
          <div className="h-4 bg-gray-200 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            <div className="h-3 bg-gray-200 rounded"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
            <div className="h-3 bg-gray-200 rounded w-4/6"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg border border-purple-200 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Bot className="w-5 h-5 text-purple-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            {t('ai_coaching_preferences')}
          </h3>
          <Sparkles className="w-4 h-4 text-purple-500" />
        </div>
        <div className="flex items-center space-x-4">
          {/* AI Trainer Enable/Disable Toggle */}
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-600">
              {t('ai_trainer_label')}
            </span>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={preferences.enabled}
                onChange={(e) => {
                  console.log(
                    '🎛️ Toggle clicked, current checked:',
                    preferences.enabled,
                    'new value:',
                    e.target.checked
                  );
                  handlePreferenceChange('enabled', e.target.checked);
                }}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-600"></div>
            </label>
            <span
              className={`text-sm font-medium ${preferences.enabled ? 'text-green-600' : 'text-gray-400'}`}
            >
              {preferences.enabled ? t('enabled') : t('disabled')}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setActiveTab('style')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'style'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t('coaching_style_tab')}
        </button>
        <button
          onClick={() => setActiveTab('communication')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'communication'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t('communication_tab')}
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'goals'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t('goals_focus_tab')}
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'equipment'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          {t('equipment_tab')}
        </button>
      </div>

      {/* Content */}
      {!preferences.enabled && (
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center mb-6">
          <Bot className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h4 className="text-lg font-medium text-gray-600 mb-2">
            {t('ai_trainer_disabled')}
          </h4>
          <p className="text-gray-500 mb-4">
            {t('enable_ai_trainer_description')}
          </p>
        </div>
      )}

      <div
        className={`space-y-6 ${!preferences.enabled ? 'opacity-50 pointer-events-none' : ''}`}
      >
        {/* Coaching Style Tab */}
        {activeTab === 'style' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('select_preferred_coaching_style')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {coachingStyles.map((style) => {
                  const IconComponent = style.icon;
                  return (
                    <div
                      key={style.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        preferences.coachingStyle === style.id
                          ? 'border-purple-500 bg-purple-50'
                          : 'border-gray-200 hover:border-purple-300'
                      }`}
                      onClick={() =>
                        handlePreferenceChange('coachingStyle', style.id)
                      }
                    >
                      <div className="flex items-start space-x-3">
                        <IconComponent className="w-6 h-6 text-purple-600 mt-1" />
                        <div className="flex-1">
                          <h5 className="font-medium text-gray-900 mb-1">
                            {t(`coaching_style_${style.id}`)}
                          </h5>
                          <p className="text-sm text-gray-600 mb-2">
                            {t(`coaching_style_${style.id}_desc`)}
                          </p>
                          <div className="text-xs text-gray-500 mb-2">
                            <strong>{t('characteristics')}:</strong>{' '}
                            {t(`coaching_style_${style.id}_chars`)}
                          </div>
                          <div className="text-xs text-gray-500 italic">
                            &apos;{t(`coaching_style_${style.id}_example`)}
                            &apos;
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('motivation_type_section')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {motivationTypes.map((type) => (
                  <label
                    key={type.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      preferences.motivationType === type.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="motivationType"
                      value={type.id}
                      checked={preferences.motivationType === type.id}
                      onChange={(e) =>
                        handlePreferenceChange('motivationType', e.target.value)
                      }
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="font-medium text-sm text-gray-900">
                        {t(`motivation_type_${type.id}`)}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {t(`motivation_type_${type.id}_desc`)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Communication Tab */}
        {activeTab === 'communication' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('communication_frequency')}
              </h4>
              <div className="space-y-3">
                {communicationFrequencies.map((freq) => (
                  <label
                    key={freq.id}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      preferences.communicationFrequency === freq.id
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="communicationFrequency"
                      value={freq.id}
                      checked={preferences.communicationFrequency === freq.id}
                      onChange={(e) =>
                        handlePreferenceChange(
                          'communicationFrequency',
                          e.target.value
                        )
                      }
                      className="sr-only"
                    />
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="w-5 h-5 text-purple-600" />
                      <div>
                        <div className="font-medium text-gray-900">
                          {t(`communication_freq_${freq.id}`)}
                        </div>
                        <div className="text-sm text-gray-600">
                          {t(`communication_freq_${freq.id}_desc`)}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('workout_preferences')}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('workout_duration_minutes')}
                  </label>
                  <input
                    type="number"
                    min="15"
                    max="180"
                    value={preferences.workoutDurationPreference}
                    onChange={(e) =>
                      handlePreferenceChange(
                        'workoutDurationPreference',
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    {t('workout_days_per_week')}
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="7"
                    value={preferences.workoutDaysPerWeek}
                    onChange={(e) =>
                      handlePreferenceChange(
                        'workoutDaysPerWeek',
                        parseInt(e.target.value)
                      )
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Goals & Focus Tab */}
        {activeTab === 'goals' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('focus_areas')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Strength',
                  'Cardio',
                  'Flexibility',
                  'Weight Loss',
                  'Muscle Gain',
                  'Endurance',
                  'Balance',
                  'Recovery',
                ].map((area) => (
                  <label
                    key={area}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      preferences.focusAreas.includes(area)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={preferences.focusAreas.includes(area)}
                      onChange={(e) =>
                        handleArrayPreferenceChange(
                          'focusAreas',
                          area,
                          e.target.checked
                        )
                      }
                      className="sr-only"
                    />
                    <div className="text-center">
                      <Target className="w-5 h-5 text-purple-600 mx-auto mb-1" />
                      <div className="text-sm font-medium text-gray-900">
                        {t(
                          `focus_area_${area.toLowerCase().replace(' ', '_')}`
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('meal_preferences')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Vegetarian',
                  'Vegan',
                  'Keto',
                  'Paleo',
                  'Mediterranean',
                  'Low-Carb',
                  'High-Protein',
                  'Gluten-Free',
                ].map((pref) => (
                  <label
                    key={pref}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      preferences.mealPreferences.includes(pref)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={preferences.mealPreferences.includes(pref)}
                      onChange={(e) =>
                        handleArrayPreferenceChange(
                          'mealPreferences',
                          pref,
                          e.target.checked
                        )
                      }
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {t(
                          `meal_pref_${pref.toLowerCase().replace('-', '_').replace(' ', '_')}`
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('allergies_restrictions')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Nuts',
                  'Dairy',
                  'Gluten',
                  'Soy',
                  'Eggs',
                  'Shellfish',
                  'Fish',
                  'Sesame',
                ].map((allergy) => (
                  <label
                    key={allergy}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      preferences.allergies.includes(allergy)
                        ? 'border-red-500 bg-red-50'
                        : 'border-gray-200 hover:border-red-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={preferences.allergies.includes(allergy)}
                      onChange={(e) =>
                        handleArrayPreferenceChange(
                          'allergies',
                          allergy,
                          e.target.checked
                        )
                      }
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {t(`allergy_${allergy.toLowerCase()}`)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Equipment Tab */}
        {activeTab === 'equipment' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('available_equipment')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Dumbbells',
                  'Barbell',
                  'Kettlebell',
                  'Resistance Bands',
                  'Pull-up Bar',
                  'Bench',
                  'Squat Rack',
                  'Cardio Machine',
                  'Yoga Mat',
                  'Medicine Ball',
                  'TRX',
                  'Cable Machine',
                ].map((equipment) => (
                  <label
                    key={equipment}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      preferences.equipmentAvailable.includes(equipment)
                        ? 'border-purple-500 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={preferences.equipmentAvailable.includes(
                        equipment
                      )}
                      onChange={(e) =>
                        handleArrayPreferenceChange(
                          'equipmentAvailable',
                          equipment,
                          e.target.checked
                        )
                      }
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {t(
                          `equipment_${equipment
                            .toLowerCase()
                            .replace(/[-\s]+/g, '_')
                            .replace(/[^a-z0-9_]/g, '')}`
                        )}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                {t('injury_history')}
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  'Knee',
                  'Shoulder',
                  'Back',
                  'Ankle',
                  'Wrist',
                  'Hip',
                  'Neck',
                  'Elbow',
                ].map((injury) => (
                  <label
                    key={injury}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      preferences.injuryHistory.includes(injury)
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-orange-300'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={preferences.injuryHistory.includes(injury)}
                      onChange={(e) =>
                        handleArrayPreferenceChange(
                          'injuryHistory',
                          injury,
                          e.target.checked
                        )
                      }
                      className="sr-only"
                    />
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900">
                        {t(`injury_${injury.toLowerCase()}`)}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <span className="text-red-700">{error}</span>
          </div>
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="w-5 h-5 text-green-500" />
            <span className="text-green-700">{success}</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={handleSavePreferences}
          disabled={saving || !preferences.enabled}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? t('saving') : t('save_preferences')}</span>
        </button>
        <button
          onClick={handleAnalyzePreferences}
          disabled={loading || !preferences.enabled}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <Brain className="w-4 h-4" />
          <span>{t('ai_analysis_button')}</span>
        </button>
      </div>
    </div>
  );
}
