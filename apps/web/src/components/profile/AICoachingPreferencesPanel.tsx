'use client';

import React, { useState, useEffect } from 'react';
import {
  Bot,
  Brain,
  MessageSquare,
  Target,
  Clock,
  Settings,
  Save,
  RefreshCw,
  CheckCircle,
  AlertCircle,
  Sparkles,
  Heart,
  Zap,
  BookOpen,
  Shield,
  Users,
} from 'lucide-react';
import { aiService } from '../../lib/ai-service-client';
import { ConfidenceIndicator } from '../ai/visualizations';

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
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [personalizationProfile, setPersonalizationProfile] =
    useState<any>(null);
  const [preferences, setPreferences] = useState({
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
  });

  const [activeTab, setActiveTab] = useState<
    'style' | 'communication' | 'goals' | 'equipment'
  >('style');

  useEffect(() => {
    fetchPersonalizationProfile();
  }, [userId]);

  const fetchPersonalizationProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await aiService.getPersonalizationProfile(userId);
      setPersonalizationProfile(response.data);

      // Update preferences with AI insights
      if (response.data) {
        setPreferences((prev) => ({
          ...prev,
          coachingStyle: response.data.coachingStyle || prev.coachingStyle,
          communicationFrequency:
            response.data.communicationFrequency || prev.communicationFrequency,
          motivationType: response.data.motivationType || prev.motivationType,
        }));
      }
    } catch (err: any) {
      console.error('Failed to fetch personalization profile:', err);
      setError(err.message || 'Failed to load AI preferences');
    } finally {
      setLoading(false);
    }
  };

  const handlePreferenceChange = (key: string, value: any) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleArrayPreferenceChange = (
    key: string,
    value: string,
    checked: boolean
  ) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: checked
        ? [...(prev[key as keyof typeof prev] as string[]), value]
        : (prev[key as keyof typeof prev] as string[]).filter(
            (item) => item !== value
          ),
    }));
  };

  const handleSavePreferences = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Update personalization profile
      await aiService.updatePersonalizationProfile(userId, {
        coachingStyle: preferences.coachingStyle,
        communicationFrequency: preferences.communicationFrequency,
        motivationType: preferences.motivationType,
        preferences: preferences,
      });

      // Update user preferences
      if (onPreferencesUpdate) {
        onPreferencesUpdate(preferences);
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

      const response = await aiService.analyzeUserPreferences(userId, {
        currentPreferences: preferences,
        includeRecommendations: true,
      });

      if (response.data?.recommendations) {
        // Apply AI recommendations
        const recommendations = response.data.recommendations;
        setPreferences((prev) => ({
          ...prev,
          coachingStyle: recommendations.coachingStyle || prev.coachingStyle,
          communicationFrequency:
            recommendations.communicationFrequency ||
            prev.communicationFrequency,
          motivationType: recommendations.motivationType || prev.motivationType,
        }));
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
            AI Coaching Preferences
          </h3>
          <Sparkles className="w-4 h-4 text-purple-500" />
        </div>
        {personalizationProfile && (
          <ConfidenceIndicator
            score={personalizationProfile.confidence || 0.8}
          />
        )}
      </div>

      {/* AI Analysis */}
      {personalizationProfile && (
        <div className="bg-white rounded-lg p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-gray-900">AI Analysis</h4>
            <button
              onClick={handleAnalyzePreferences}
              disabled={loading}
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center space-x-1"
            >
              <RefreshCw
                className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`}
              />
              <span>Re-analyze</span>
            </button>
          </div>
          <div className="text-sm text-gray-600">
            <p className="mb-2">
              <strong>Current Style:</strong>{' '}
              {personalizationProfile.coachingStyle || 'Not analyzed'}
            </p>
            <p className="mb-2">
              <strong>Communication Style:</strong>{' '}
              {personalizationProfile.communicationStyle || 'Not analyzed'}
            </p>
            <p>
              <strong>Motivation Type:</strong>{' '}
              {personalizationProfile.motivationType || 'Not analyzed'}
            </p>
          </div>
        </div>
      )}

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
          Coaching Style
        </button>
        <button
          onClick={() => setActiveTab('communication')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'communication'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Communication
        </button>
        <button
          onClick={() => setActiveTab('goals')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'goals'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Goals & Focus
        </button>
        <button
          onClick={() => setActiveTab('equipment')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'equipment'
              ? 'bg-purple-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Equipment
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Coaching Style Tab */}
        {activeTab === 'style' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                Select Your Preferred Coaching Style
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
                            {style.name}
                          </h5>
                          <p className="text-sm text-gray-600 mb-2">
                            {style.description}
                          </p>
                          <div className="text-xs text-gray-500 mb-2">
                            <strong>Characteristics:</strong>{' '}
                            {style.characteristics.join(', ')}
                          </div>
                          <div className="text-xs text-gray-500 italic">
                            "{style.example}"
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
                Motivation Type
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
                        {type.name}
                      </div>
                      <div className="text-xs text-gray-600 mt-1">
                        {type.description}
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
                Communication Frequency
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
                          {freq.name}
                        </div>
                        <div className="text-sm text-gray-600">
                          {freq.description}
                        </div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                Workout Preferences
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Workout Duration (minutes)
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
                    Workout Days Per Week
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
              <h4 className="font-medium text-gray-900 mb-4">Focus Areas</h4>
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
                        {area}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                Meal Preferences
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
                        {pref}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                Allergies & Restrictions
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
                        {allergy}
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
                Available Equipment
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
                        {equipment}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">Injury History</h4>
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
                        {injury}
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
          disabled={saving}
          className="bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          {saving ? (
            <RefreshCw className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          <span>{saving ? 'Saving...' : 'Save Preferences'}</span>
        </button>
        <button
          onClick={handleAnalyzePreferences}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white px-6 py-2 rounded-lg font-medium transition-colors flex items-center space-x-2"
        >
          <Brain className="w-4 h-4" />
          <span>AI Analysis</span>
        </button>
      </div>
    </div>
  );
}
