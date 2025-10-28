'use client';

import React, { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  Clock,
  Droplet,
  Target,
  Brain,
  Sparkles,
} from 'lucide-react';
import { aiService } from '../../lib/ai-service-client';
import { api } from '../../lib/api-client';
import { ConfidenceIndicator, ComparisonView } from '../ai/visualizations';
// Types
interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  fitnessGoals: string[];
  activityLevel: string;
  height: number;
  weight: number;
  age: number;
  gender: string;
}

interface DailyGoals {
  calories: number;
  water: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface UserPreferences {
  dailyGoals?: DailyGoals;
  units: string;
}

interface NutritionStats {
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFats: number;
  waterIntake: number;
  mealsLogged: number;
}

interface NutritionIntelligencePanelProps {
  userId: string;
  className?: string;
}

export default function NutritionIntelligencePanel({
  userId,
  className = '',
}: NutritionIntelligencePanelProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nutritionData, setNutritionData] = useState<any>(null);
  const [adherenceData, setAdherenceData] = useState<any>(null);
  const [macroAnalysis, setMacroAnalysis] = useState<any>(null);
  const [hydrationData, setHydrationData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    'adherence' | 'macros' | 'hydration' | 'timing'
  >('adherence');

  // User data state
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [userPreferences, setUserPreferences] =
    useState<UserPreferences | null>(null);
  const [nutritionStats, setNutritionStats] = useState<NutritionStats | null>(
    null
  );

  useEffect(() => {
    fetchNutritionIntelligence();
  }, [userId]);

  const fetchNutritionIntelligence = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch user data first
      const [profileResponse, preferencesResponse, nutritionStatsResponse] =
        await Promise.all([
          api.getUserProfile(),
          api.getUserPreferences(),
          api.getNutritionStats(),
        ]);

      console.log('User data fetched:', {
        profileResponse,
        preferencesResponse,
        nutritionStatsResponse,
      });

      setUserProfile(profileResponse);
      setUserPreferences(preferencesResponse);
      setNutritionStats(nutritionStatsResponse);

      // Use user's fitness goals or default goals
      const userGoals = profileResponse?.fitnessGoals || [
        'weight_loss',
        'muscle_gain',
      ];

      // Fetch nutrition analysis
      const nutritionResponse = await aiService.analyzeNutritionAdherence({
        days: 14,
        includeHydration: true,
        includeTiming: true,
        goals: userGoals,
      });

      // Fetch macro analysis using user goals
      const macroResponse = await aiService.calculateOptimalMacros(userGoals);

      // Fetch hydration analysis
      const hydrationResponse = await aiService.analyzeHydration(7);

      // Transform data to match component expectations
      setNutritionData(nutritionResponse.data);

      // Calculate adherence based on real data
      const dailyGoals = preferencesResponse?.dailyGoals || {
        calories: 2000,
        protein: 150,
        carbs: 250,
        fat: 67,
        water: 8,
      };

      const currentStats = nutritionStatsResponse || {
        totalCalories: 0,
        totalProtein: 0,
        totalCarbs: 0,
        totalFats: 0,
        waterIntake: 0,
        mealsLogged: 0,
      };

      // Calculate adherence scores
      const calorieAdherence =
        dailyGoals.calories > 0
          ? Math.min(
              (currentStats.totalCalories / dailyGoals.calories) * 100,
              100
            )
          : 0;
      const proteinAdherence =
        dailyGoals.protein > 0
          ? Math.min(
              (currentStats.totalProtein / dailyGoals.protein) * 100,
              100
            )
          : 0;

      const overallScore = Math.round(
        (calorieAdherence + proteinAdherence) / 2
      );

      // Create adherence data structure
      setAdherenceData({
        score: nutritionResponse.data.adherenceScore || overallScore,
        caloriesOnTarget: Math.round(calorieAdherence),
        proteinGoalsMet: Math.round(proteinAdherence),
        mealConsistency:
          currentStats.mealsLogged >= 3 ? 85 : currentStats.mealsLogged * 30,
        recommendations: nutritionResponse.data.recommendations?.map(
          (r) => r.description
        ) || [
          `Target ${dailyGoals.calories} calories daily (currently ${currentStats.totalCalories})`,
          `Aim for ${dailyGoals.protein}g protein daily (currently ${currentStats.totalProtein}g)`,
          'Log meals consistently to track progress accurately',
        ],
      });

      // Transform macro data using user goals and current intake
      const targetProtein =
        macroResponse.data.macros?.protein || dailyGoals.protein;
      const targetCarbs = macroResponse.data.macros?.carbs || dailyGoals.carbs;
      const targetFats = macroResponse.data.macros?.fats || dailyGoals.fat;

      const totalMacroCalories =
        targetProtein * 4 + targetCarbs * 4 + targetFats * 9;
      const proteinPercent = Math.round(
        ((targetProtein * 4) / totalMacroCalories) * 100
      );
      const carbsPercent = Math.round(
        ((targetCarbs * 4) / totalMacroCalories) * 100
      );
      const fatsPercent = Math.round(
        ((targetFats * 9) / totalMacroCalories) * 100
      );

      setMacroAnalysis({
        protein: targetProtein,
        carbs: targetCarbs,
        fats: targetFats,
        proteinPercent,
        carbsPercent,
        fatsPercent,
        currentProtein: currentStats.totalProtein,
        currentCarbs: currentStats.totalCarbs,
        currentFats: currentStats.totalFats,
      });

      // Transform hydration data using user goals and current intake
      const waterGoalLiters = dailyGoals.water * 0.25 || 2.0; // Convert glasses to liters (assuming 250ml per glass)
      const currentWaterLiters = currentStats.waterIntake * 0.25 || 0;
      const achievementRate =
        waterGoalLiters > 0 ? currentWaterLiters / waterGoalLiters : 0;

      setHydrationData({
        averageIntake:
          hydrationResponse.data.analysis?.averageIntake || currentWaterLiters,
        dailyGoal: waterGoalLiters,
        daysGoalAchieved: Math.round(achievementRate * 7), // Estimate based on current performance
        tips: hydrationResponse.data.recommendations || [
          `Target ${dailyGoals.water} glasses (${waterGoalLiters}L) of water daily`,
          'Drink a glass of water before each meal',
          'Increase intake by 2-3 glasses on workout days',
        ],
      });
    } catch (err: any) {
      console.error('Failed to fetch nutrition intelligence:', err);
      setError(err.message || 'Failed to fetch nutrition intelligence');
    } finally {
      setLoading(false);
    }
  };

  const getAdherenceColor = (score: number) => {
    if (score >= 80) return 'text-green-600 bg-green-100';
    if (score >= 60) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getAdherenceIcon = (score: number) => {
    if (score >= 80) return <CheckCircle className="w-5 h-5" />;
    if (score >= 60) return <AlertCircle className="w-5 h-5" />;
    return <AlertCircle className="w-5 h-5" />;
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

  if (error) {
    return (
      <div
        className={`bg-white rounded-lg border border-gray-200 p-6 ${className}`}
      >
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error}</p>
          <button
            onClick={fetchNutritionIntelligence}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200 p-6 ${className}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center space-x-2">
          <Brain className="w-5 h-5 text-green-600" />
          <h3 className="text-lg font-semibold text-gray-900">
            Nutrition Intelligence
          </h3>
          <Sparkles className="w-4 h-4 text-purple-500" />
        </div>
        {nutritionData && (
          <ConfidenceIndicator score={nutritionData.confidence || 0.8} />
        )}
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 mb-6">
        <button
          onClick={() => setActiveTab('adherence')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'adherence'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Adherence
        </button>
        <button
          onClick={() => setActiveTab('macros')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'macros'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Macros
        </button>
        <button
          onClick={() => setActiveTab('hydration')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'hydration'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Hydration
        </button>
        <button
          onClick={() => setActiveTab('timing')}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            activeTab === 'timing'
              ? 'bg-green-600 text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          Timing
        </button>
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Adherence Tab */}
        {activeTab === 'adherence' && adherenceData && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">
                  Adherence Score (14 days)
                </h4>
                <div
                  className={`flex items-center space-x-2 px-3 py-1 rounded-full ${getAdherenceColor(
                    adherenceData.score || 75
                  )}`}
                >
                  {getAdherenceIcon(adherenceData.score || 75)}
                  <span className="font-bold">
                    {adherenceData.score || 75}%
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Calories on target
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {adherenceData.caloriesOnTarget || 10}/14 days
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Protein goals met
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {adherenceData.proteinGoalsMet || 12}/14 days
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Meal consistency
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {adherenceData.mealConsistency || 85}%
                  </span>
                </div>
              </div>
            </div>

            {/* AI Recommendations */}
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">
                AI Recommendations
              </h4>
              <div className="space-y-2">
                {(
                  adherenceData.recommendations || [
                    'Increase protein intake by 20g to meet daily goals',
                    'Consider meal prepping on Sundays for better consistency',
                    'Add a post-workout snack to optimize recovery',
                  ]
                ).map((recommendation: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-start space-x-2 p-2 bg-green-50 rounded-lg"
                  >
                    <Target className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">
                      {recommendation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Macros Tab */}
        {activeTab === 'macros' && macroAnalysis && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-4">
                Optimal Macro Distribution
              </h4>

              {/* Macro Bars */}
              <div className="space-y-4">
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Protein
                    </span>
                    <span className="text-sm text-gray-600">
                      {macroAnalysis.protein || 180}g (
                      {macroAnalysis.proteinPercent || 30}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-blue-600 h-3 rounded-full"
                      style={{
                        width: `${macroAnalysis.proteinPercent || 30}%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Carbs
                    </span>
                    <span className="text-sm text-gray-600">
                      {macroAnalysis.carbs || 225}g (
                      {macroAnalysis.carbsPercent || 40}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-green-600 h-3 rounded-full"
                      style={{ width: `${macroAnalysis.carbsPercent || 40}%` }}
                    ></div>
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-gray-700">
                      Fats
                    </span>
                    <span className="text-sm text-gray-600">
                      {macroAnalysis.fats || 75}g (
                      {macroAnalysis.fatsPercent || 30}%)
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className="bg-orange-600 h-3 rounded-full"
                      style={{ width: `${macroAnalysis.fatsPercent || 30}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            </div>

            {/* Current vs Recommended */}
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">
                Current vs Recommended
              </h4>

              {/* Custom macro comparison since ComparisonView doesn't support multi-value comparison */}
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900">
                        Current
                      </div>
                      <div className="text-xs text-gray-600">
                        P: {macroAnalysis.currentProtein || 150}g
                      </div>
                      <div className="text-xs text-gray-600">
                        C: {macroAnalysis.currentCarbs || 200}g
                      </div>
                      <div className="text-xs text-gray-600">
                        F: {macroAnalysis.currentFats || 80}g
                      </div>
                    </div>
                    <div className="text-gray-400">→</div>
                    <div className="text-center">
                      <div className="text-sm font-medium text-gray-900">
                        Recommended
                      </div>
                      <div className="text-xs text-green-600">
                        P: {macroAnalysis.protein || 180}g
                      </div>
                      <div className="text-xs text-green-600">
                        C: {macroAnalysis.carbs || 225}g
                      </div>
                      <div className="text-xs text-green-600">
                        F: {macroAnalysis.fats || 75}g
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Hydration Tab */}
        {activeTab === 'hydration' && hydrationData && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">
                  Hydration Analysis (7 days)
                </h4>
                <Droplet className="w-5 h-5 text-blue-600" />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Average daily intake
                  </span>
                  <span className="text-lg font-bold text-blue-600">
                    {hydrationData.averageIntake || 2.5}L
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Daily goal</span>
                  <span className="text-sm font-medium text-gray-900">
                    {hydrationData.dailyGoal || 3.0}L
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    Days goal achieved
                  </span>
                  <span className="text-sm font-medium text-gray-900">
                    {hydrationData.daysGoalAchieved || 4}/7 days
                  </span>
                </div>

                <div className="w-full bg-gray-200 rounded-full h-3">
                  <div
                    className="bg-blue-600 h-3 rounded-full"
                    style={{
                      width: `${((hydrationData.averageIntake || 2.5) / (hydrationData.dailyGoal || 3.0)) * 100}%`,
                    }}
                  ></div>
                </div>
              </div>
            </div>

            {/* Hydration Tips */}
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">Hydration Tips</h4>
              <div className="space-y-2">
                {(
                  hydrationData.tips || [
                    'Drink 500ml of water upon waking',
                    'Increase intake on workout days by 1L',
                    'Set reminders every 2 hours during the day',
                  ]
                ).map((tip: string, index: number) => (
                  <div
                    key={index}
                    className="flex items-start space-x-2 p-2 bg-blue-50 rounded-lg"
                  >
                    <Droplet className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">{tip}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Timing Tab */}
        {activeTab === 'timing' && (
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-4">
                <h4 className="font-medium text-gray-900">
                  Optimal Meal Timing
                </h4>
                <Clock className="w-5 h-5 text-purple-600" />
              </div>

              <div className="space-y-3">
                <div className="p-3 bg-purple-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      Pre-Workout
                    </span>
                    <span className="text-sm text-purple-600">
                      60-90 min before
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    40g carbs, 20g protein - Optimize energy and performance
                  </p>
                </div>

                <div className="p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      Post-Workout
                    </span>
                    <span className="text-sm text-green-600">
                      Within 30 min
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    30g protein, 50g carbs - Maximize recovery and muscle
                    synthesis
                  </p>
                </div>

                <div className="p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">
                      Main Meals
                    </span>
                    <span className="text-sm text-blue-600">
                      Every 4-5 hours
                    </span>
                  </div>
                  <p className="text-xs text-gray-600">
                    Balanced macros - Maintain energy and prevent overeating
                  </p>
                </div>
              </div>
            </div>

            {/* Timing Recommendations */}
            <div className="bg-white rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-3">
                AI Timing Recommendations
              </h4>
              <div className="space-y-2">
                {[
                  'Move dinner 1 hour earlier for better sleep quality',
                  'Add a mid-morning snack to stabilize energy levels',
                  'Consider intermittent fasting (16:8) based on your schedule',
                ].map((recommendation, index) => (
                  <div
                    key={index}
                    className="flex items-start space-x-2 p-2 bg-purple-50 rounded-lg"
                  >
                    <Clock className="w-4 h-4 text-purple-600 mt-0.5 flex-shrink-0" />
                    <span className="text-sm text-gray-700">
                      {recommendation}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-gray-200">
        <button
          onClick={() => {
            /* Optimize macros */
          }}
          className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
        >
          <Target className="w-4 h-4" />
          <span>Optimize My Macros</span>
        </button>
        <button
          onClick={() => {
            /* Suggest meal times */
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
        >
          <Clock className="w-4 h-4" />
          <span>Suggest Meal Times</span>
        </button>
        <button
          onClick={() => {
            /* Find substitutes */
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center space-x-2"
        >
          <Sparkles className="w-4 h-4" />
          <span>Find Food Substitutes</span>
        </button>
      </div>
    </div>
  );
}
