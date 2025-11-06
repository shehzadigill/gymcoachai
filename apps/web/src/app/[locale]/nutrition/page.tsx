'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import { useTranslations } from 'next-intl';
import {
  Apple,
  Plus,
  Target,
  Flame,
  Clock,
  TrendingUp,
  Calendar,
  Search,
  Filter,
  Edit,
  Trash2,
  X,
  Check,
} from 'lucide-react';
import NutritionIntelligencePanel from '../../../components/nutrition/NutritionIntelligencePanel';
import ContextualAITrigger from '../../../components/ai/ContextualAITrigger';

interface Food {
  id: string;
  name: string;
  brand: string;
  category: string;
  subcategory: string;
  nutritionFacts: {
    calories: number;
    protein: number;
    total_carbs: number;
    total_fat: number;
    dietary_fiber: number;
    total_sugars: number;
    sodium: number;
  };
  commonServings: Array<{
    name: string;
    weight: number;
    nutritionFacts: {
      calories: number;
      protein: number;
      total_carbs: number;
      total_fat: number;
      dietary_fiber: number;
      total_sugars: number;
      sodium: number;
    };
  }>;
  allergens: string[];
  dietaryTags: string[];
  verified: boolean;
  isActive: boolean;
}

interface Meal {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  servingSize: string;
  servingWeight: number;
  timestamp: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foodId?: string;
}

interface DailyNutrition {
  calories: number;
  caloriesGoal: number;
  protein: number;
  proteinGoal: number;
  carbs: number;
  carbsGoal: number;
  fat: number;
  fatGoal: number;
  fiber: number;
  fiberGoal: number;
  water: number;
  waterGoal: number;
}

export default function NutritionPage() {
  const user = useCurrentUser();
  const t = useTranslations('nutrition_page');

  // All hooks must be called before any conditional returns
  const [meals, setMeals] = useState<Meal[]>([]);
  const [dailyNutrition, setDailyNutrition] = useState<DailyNutrition | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<string>('all');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searchCursor, setSearchCursor] = useState<string | null>(null);
  // const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [servingSize, setServingSize] = useState<string>('');
  const [servingWeight, setServingWeight] = useState<number>(0);
  const [selectedMealType, setSelectedMealType] = useState<
    'breakfast' | 'lunch' | 'dinner' | 'snack'
  >('breakfast');
  const [showCustomMealForm, setShowCustomMealForm] = useState(false);
  const [editingMeal, setEditingMeal] = useState<Meal | null>(null);
  const [waterCount, setWaterCount] = useState<number>(0);
  const [recentFoods, setRecentFoods] = useState<Food[]>([]);
  const [favoriteFoodIds, setFavoriteFoodIds] = useState<Set<string>>(
    new Set()
  );
  const [detailsFood, setDetailsFood] = useState<Food | null>(null);
  const [showDetailsDrawer, setShowDetailsDrawer] = useState<boolean>(false);
  const [weeklyStats, setWeeklyStats] = useState<{
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>({ calories: 0, protein: 0, carbs: 0, fat: 0 });
  const [userProfileData, setUserProfileData] = useState<any>(null);

  // All useEffect hooks must also be called before conditional returns
  useEffect(() => {
    if (!user?.isAuthenticated) return;

    // Load all data in parallel to avoid race conditions
    const loadData = async () => {
      try {
        // Load water first to get current value
        const waterRes = await api.getWater(selectedDate);
        const rawGlasses = waterRes?.body?.glasses ?? waterRes?.glasses ?? 0;
        const parsed =
          typeof rawGlasses === 'string'
            ? parseInt(rawGlasses, 10)
            : rawGlasses;
        const glasses = Number.isFinite(parsed) ? parsed : 0;
        setWaterCount(glasses);
        setIsWaterLoaded(true);

        // Then fetch nutrition data and pass the water count to avoid overwriting
        await fetchNutritionData(glasses);
      } catch (err) {
        console.error('Failed to load water from API:', err);
        setWaterCount(0);
        await fetchNutritionData(0);
      }
    };

    loadData();
    // Fetch weekly stats (last 7 days ending on selectedDate)
    fetchWeeklyStats(selectedDate);
  }, [selectedDate, user?.isAuthenticated]);

  // Load favorites once
  useEffect(() => {
    if (!user?.isAuthenticated) return;

    (async () => {
      try {
        const res = await api.listFavoriteFoods();
        const foods = res?.foods || [];
        const ids = new Set<string>(foods.map((f: any) => f.id || f.FoodId));
        setFavoriteFoodIds(ids);
      } catch {}
    })();
  }, [user?.isAuthenticated]);

  // Load recent foods once
  useEffect(() => {
    try {
      const raw = localStorage.getItem('recentFoods');
      if (raw) {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) setRecentFoods(arr);
      }
    } catch {}
  }, []);

  // Persist water whenever it changes (skip on initial load to prevent overwriting API data)
  const [isWaterLoaded, setIsWaterLoaded] = useState(false);

  useEffect(() => {
    if (!user?.isAuthenticated) return;

    setDailyNutrition((prev) => {
      return prev ? { ...prev, water: waterCount } : prev;
    });

    // Only send to backend after initial load to prevent overwriting API data with 0
    if (isWaterLoaded) {
      (async () => {
        try {
          await api.setWater(selectedDate, waterCount);
        } catch {}
      })();
    }
  }, [waterCount, selectedDate, user?.isAuthenticated, isWaterLoaded]);

  // Ensure user is authenticated - check after all hooks
  if (!user?.isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">
            {t('auth_required')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            {t('auth_required_message')}
          </p>
        </div>
      </div>
    );
  }

  const fetchNutritionData = async (currentWaterCount?: number) => {
    try {
      setLoading(true);
      setError(null);

      // Fetch both meals and user profile to get daily goals
      const [response, userProfile] = await Promise.all([
        api.getMealsByDate(selectedDate),
        api.getUserProfile().catch((e) => {
          console.warn('Failed to fetch user profile:', e);
          return null;
        }),
      ]);
      // Store user profile data for use throughout the component
      setUserProfileData(userProfile);

      if (response) {
        // Handle both response formats: new API format { meals: [] } and old format { body: [] }
        const responseAny = response as any;
        let mealsArray: any[] = [];

        if (responseAny.meals && Array.isArray(responseAny.meals)) {
          // New format: { date, count, meals: [...] }
          mealsArray = responseAny.meals;
        } else if (responseAny.body && Array.isArray(responseAny.body)) {
          // Old format: { statusCode, body: [...] }
          mealsArray = responseAny.body;
        } else if (Array.isArray(responseAny)) {
          // Direct array response
          mealsArray = responseAny;
        }

        const apiMeals: Meal[] = mealsArray.map((meal: any) => ({
          id: meal.id,
          name: meal.name,
          calories: meal.total_calories || 0,
          protein: meal.total_protein || 0,
          carbs: meal.total_carbs || 0,
          fat: meal.total_fat || 0,
          fiber: meal.total_fiber || 0,
          sugar: meal.total_sugar || 0,
          sodium: meal.total_sodium || 0,
          servingSize: meal.serving_size || '1 serving',
          servingWeight: meal.serving_weight || 100,
          timestamp: meal.created_at || new Date().toISOString(),
          mealType:
            typeof meal.meal_type === 'string'
              ? (meal.meal_type.toLowerCase() as any)
              : 'breakfast',
          foodId: meal.food_id,
        }));

        setMeals(apiMeals);
        calculateDailyNutrition(
          apiMeals,
          currentWaterCount ?? waterCount,
          userProfile
        );
      } else {
        // Fallback to empty state
        setMeals([]);
        setDailyNutrition(
          getDefaultNutrition(currentWaterCount ?? waterCount, userProfile)
        );
      }
    } catch (e: any) {
      console.error('Failed to fetch nutrition data:', e);
      setMeals([]);
      setDailyNutrition(getDefaultNutrition(currentWaterCount ?? waterCount));
      setError('Failed to load nutrition data. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  const addWater = async () => {
    if (!isWaterLoaded) return; // Prevent API calls before initial load

    try {
      const newCount = Math.min(waterCount + 1, 50);
      setWaterCount(newCount);
      await api.setWater(selectedDate, newCount);
    } catch (error) {
      console.error('Error adding water:', error);
      setWaterCount((prev) => Math.max(prev - 1, 0)); // Rollback on error
    }
  };

  const removeWater = async () => {
    if (!isWaterLoaded || waterCount <= 0) return; // Prevent API calls before initial load

    try {
      const newCount = Math.max(waterCount - 1, 0);
      setWaterCount(newCount);
      await api.setWater(selectedDate, newCount);
    } catch (error) {
      console.error('Error removing water:', error);
      setWaterCount((prev) => Math.min(prev + 1, 50)); // Rollback on error
    }
  };

  const getDefaultNutrition = (
    currentWater: number = 0,
    userProfile?: any
  ): DailyNutrition => {
    const profileData = userProfile?.body || userProfile || {};
    const dailyGoals = profileData?.preferences?.dailyGoals;

    return {
      calories: 0,
      caloriesGoal: dailyGoals?.calories || 2000,
      protein: 0,
      proteinGoal: dailyGoals?.protein || 150,
      carbs: 0,
      carbsGoal: dailyGoals?.carbs || 200,
      fat: 0,
      fatGoal: dailyGoals?.fat || 67,
      fiber: 0,
      fiberGoal: 25, // fiber goal is not in profile yet, keep default
      water: currentWater,
      waterGoal: dailyGoals?.water || 8,
    };
  };

  const calculateDailyNutrition = (
    meals: Meal[],
    currentWater: number = 0,
    userProfile?: any
  ) => {
    const totals = meals.reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.calories,
        protein: acc.protein + meal.protein,
        carbs: acc.carbs + meal.carbs,
        fat: acc.fat + meal.fat,
        fiber: acc.fiber + meal.fiber,
        sugar: acc.sugar + meal.sugar,
        sodium: acc.sodium + meal.sodium,
      }),
      {
        calories: 0,
        protein: 0,
        carbs: 0,
        fat: 0,
        fiber: 0,
        sugar: 0,
        sodium: 0,
      }
    );

    // Get daily goals from user profile preferences
    const profileData = userProfile?.body || userProfile || {};
    const dailyGoals = profileData?.preferences?.dailyGoals;

    setDailyNutrition({
      calories: Math.round(totals.calories),
      caloriesGoal: dailyGoals?.calories || 2000,
      protein: Math.round(totals.protein * 10) / 10,
      proteinGoal: dailyGoals?.protein || 150,
      carbs: Math.round(totals.carbs * 10) / 10,
      carbsGoal: dailyGoals?.carbs || 200,
      fat: Math.round(totals.fat * 10) / 10,
      fatGoal: dailyGoals?.fat || 67,
      fiber: Math.round(totals.fiber * 10) / 10,
      fiberGoal: 25, // fiber goal not in profile yet, keep default
      water: currentWater,
      waterGoal: dailyGoals?.water || 8,
    });
  };

  const searchFoods = async (query: string, cursor?: string | null) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      setSearchCursor(null);
      return;
    }

    try {
      setSearching(true);
      const { foods, nextCursor } = await api.searchFoods(
        query,
        cursor || undefined
      );
      if (cursor) {
        setSearchResults((prev) => [...prev, ...foods]);
      } else {
        setSearchResults(foods);
      }
      setSearchCursor(nextCursor);
      setShowSearchResults(true);
    } catch (e: any) {
      console.error('Failed to search foods:', e);
      setError(
        'Failed to search foods. Please check your internet connection or try again.'
      );
      setSearchResults([]);
      setShowSearchResults(false);
    } finally {
      setSearching(false);
    }
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setSearchQuery(query);
    searchFoods(query);
  };

  const openDetails = (food: Food) => {
    setDetailsFood(food);
    setShowDetailsDrawer(true);
  };
  const closeDetails = () => {
    setShowDetailsDrawer(false);
    setDetailsFood(null);
  };

  const toggleFavorite = async (food: Food) => {
    try {
      if (favoriteFoodIds.has(food.id)) {
        await api.removeFavoriteFood(food.id);
        setFavoriteFoodIds((prev) => {
          const next = new Set(prev);
          next.delete(food.id);
          return next;
        });
      } else {
        await api.addFavoriteFood(food.id);
        setFavoriteFoodIds((prev) => new Set(prev).add(food.id));
      }
    } catch (e) {
      console.error('Failed to toggle favorite:', e);
    }
  };

  const selectFood = (food: Food) => {
    setSelectedFood(food);
    setServingSize(food.commonServings[0]?.name || '100g');
    setServingWeight(food.commonServings[0]?.weight || 100);
    setShowSearchResults(false);
    setSearchQuery('');
    setShowAddForm(true);
  };

  const addCustomMeal = async (customMealData: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    servingSize: string;
    servingWeight: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  }) => {
    try {
      const mapMealTypeToEnum = (m: string) => {
        switch (m) {
          case 'breakfast':
            return t('breakfast');
          case 'lunch':
            return t('lunch');
          case 'dinner':
            return t('dinner');
          case 'snack':
            return t('snacks');
          default:
            return t('breakfast');
        }
      };

      // Create a payload with custom nutrition values
      // The backend will be modified to accept these when foods array is empty
      const payload = {
        name: customMealData.name,
        meal_type: mapMealTypeToEnum(customMealData.mealType),
        meal_date: selectedDate + 'T00:00:00Z',
        foods: [], // Empty foods array for custom meals
        notes: 'Custom meal entry',
        // Custom nutrition values for when foods is empty
        custom_nutrition: {
          calories: customMealData.calories,
          protein: customMealData.protein,
          total_carbs: customMealData.carbs,
          total_fat: customMealData.fat,
          dietary_fiber: customMealData.fiber,
          total_sugars: customMealData.sugar,
          sodium: customMealData.sodium,
        },
      };

      const response = await api.createMeal(payload);

      if (response) {
        const mealData = response.body || response;

        const newMeal: Meal = {
          id: mealData.id || Date.now().toString(),
          name: customMealData.name,
          calories: customMealData.calories,
          protein: customMealData.protein,
          carbs: customMealData.carbs,
          fat: customMealData.fat,
          fiber: customMealData.fiber,
          sugar: customMealData.sugar,
          sodium: customMealData.sodium,
          servingSize: customMealData.servingSize,
          servingWeight: customMealData.servingWeight,
          timestamp: new Date().toISOString(),
          mealType: customMealData.mealType,
          foodId: undefined,
        };

        setMeals((prev) => [...prev, newMeal]);
        calculateDailyNutrition(
          [...meals, newMeal],
          waterCount,
          userProfileData
        );
        setShowCustomMealForm(false);

        // Refresh the meal data from backend to ensure consistency
        await fetchNutritionData();
      }
    } catch (e: any) {
      console.error('Failed to add custom meal:', e);
      setError('Failed to add custom meal');
    }
  };

  const addMeal = async () => {
    if (!selectedFood) return;

    try {
      const serving =
        selectedFood.commonServings.find((s) => s.name === servingSize) ||
        selectedFood.commonServings[0];
      const multiplier = servingWeight / serving.weight;

      // Backend expects CreateMealRequest with foods list; send one item derived from selectedFood
      const mapMealTypeToEnum = (m: string) => {
        switch (m) {
          case 'breakfast':
            return t('breakfast');
          case 'lunch':
            return t('lunch');
          case 'dinner':
            return t('dinner');
          case 'snack':
            return t('snacks');
          default:
            return t('breakfast');
        }
      };
      const payload = {
        name: selectedFood.name,
        meal_type: mapMealTypeToEnum(selectedMealType),
        meal_date: selectedDate + 'T00:00:00Z',
        foods: [
          {
            food_id: selectedFood.id,
            quantity: servingWeight, // grams
            unit: 'g',
          },
        ],
        notes: null,
      };

      const response = await api.createMeal(payload);

      if (response) {
        // Backend returns: { body: { id: ..., ... } }
        const mealData = response.body || response;

        const newMeal: Meal = {
          id: mealData.id || Date.now().toString(),
          name: selectedFood.name,
          calories: Math.round(serving.nutritionFacts.calories * multiplier),
          protein: Math.round(serving.nutritionFacts.protein * multiplier),
          carbs: Math.round(serving.nutritionFacts.total_carbs * multiplier),
          fat: Math.round(serving.nutritionFacts.total_fat * multiplier),
          fiber: Math.round(serving.nutritionFacts.dietary_fiber * multiplier),
          sugar: Math.round(serving.nutritionFacts.total_sugars * multiplier),
          sodium: Math.round(serving.nutritionFacts.sodium * multiplier),
          servingSize: servingSize,
          servingWeight: servingWeight,
          timestamp: new Date().toISOString(),
          mealType: selectedMealType,
          foodId: selectedFood.id,
        };

        setMeals((prev) => [...prev, newMeal]);
        calculateDailyNutrition(
          [...meals, newMeal],
          waterCount,
          userProfileData
        );

        // Update recent foods list
        setRecentFoods((prev) => {
          const dedup = [
            selectedFood,
            ...prev.filter((f) => f.id !== selectedFood.id),
          ];
          const trimmed = dedup.slice(0, 8);
          try {
            localStorage.setItem('recentFoods', JSON.stringify(trimmed));
          } catch {}
          return trimmed;
        });

        setSelectedFood(null);
        setShowAddForm(false);

        // Refresh the meal data from backend to ensure consistency
        await fetchNutritionData();
      }
    } catch (e: any) {
      console.error('Failed to add meal:', e);
      setError('Failed to add meal');
    }
  };

  const fetchWeeklyStats = async (endDateIso: string) => {
    try {
      const end = new Date(endDateIso + 'T00:00:00Z');
      const days: string[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(end);
        d.setUTCDate(end.getUTCDate() - i);
        days.push(d.toISOString().slice(0, 10));
      }

      const responses = await Promise.all(
        days.map(async (d) => {
          try {
            const response = await api.getMealsByDate(d);
            return response;
          } catch (error) {
            return null;
          }
        })
      );

      let totals = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      for (const res of responses) {
        // Handle response format: API returns direct array
        const mealsArr = Array.isArray(res) ? res : ((res as any)?.meals ?? []);
        for (const meal of mealsArr) {
          totals.calories += meal.total_calories || 0;
          totals.protein += meal.total_protein || 0;
          totals.carbs += meal.total_carbs || 0;
          totals.fat += meal.total_fat || 0;
        }
      }

      const weeklyStatsResult = {
        calories: Math.round(totals.calories),
        protein: Math.round(totals.protein * 10) / 10,
        carbs: Math.round(totals.carbs * 10) / 10,
        fat: Math.round(totals.fat * 10) / 10,
      };
      setWeeklyStats(weeklyStatsResult);
    } catch (e) {
      console.error('Failed to fetch weekly stats:', e);
      setWeeklyStats({ calories: 0, protein: 0, carbs: 0, fat: 0 });
    }
  };

  const deleteMeal = async (mealId: string) => {
    try {
      await api.deleteMeal(mealId);
      const updatedMeals = meals.filter((meal) => meal.id !== mealId);
      setMeals(updatedMeals);
      calculateDailyNutrition(updatedMeals, waterCount, userProfileData);
    } catch (e: any) {
      console.error('Failed to delete meal:', e);
      setError('Failed to delete meal');
    }
  };

  const openEdit = (meal: Meal) => {
    setEditingMeal(meal);
  };

  const saveEdit = async (updated: {
    id: string;
    name: string;
    mealType: Meal['mealType'];
  }) => {
    try {
      const mapMealTypeToEnum = (m: Meal['mealType']) => {
        switch (m) {
          case 'breakfast':
            return t('breakfast');
          case 'lunch':
            return t('lunch');
          case 'dinner':
            return t('dinner');
          case 'snack':
            return t('snacks');
          default:
            return t('breakfast');
        }
      };
      await api.updateMeal(updated.id, {
        name: updated.name,
        meal_type: mapMealTypeToEnum(updated.mealType),
      });
      setMeals((prev) =>
        prev.map((m) =>
          m.id === updated.id
            ? { ...m, name: updated.name, mealType: updated.mealType }
            : m
        )
      );
      setEditingMeal(null);
    } catch (e) {
      console.error('Failed to update meal:', e);
      setError('Failed to update meal');
    }
  };

  const filteredMeals = meals.filter((meal) => {
    const matchesSearch = meal.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesMeal =
      selectedMeal === 'all' || meal.mealType === selectedMeal;
    return matchesSearch && matchesMeal;
  });

  const mealTotals = meals.reduce(
    (acc, meal) => {
      if (!acc[meal.mealType]) {
        acc[meal.mealType] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      acc[meal.mealType].calories += meal.calories;
      acc[meal.mealType].protein += meal.protein;
      acc[meal.mealType].carbs += meal.carbs;
      acc[meal.mealType].fat += meal.fat;
      return acc;
    },
    {} as Record<
      string,
      { calories: number; protein: number; carbs: number; fat: number }
    >
  );

  const getMealTypeLabel = (mealType: string): string => {
    switch (mealType) {
      case 'breakfast':
        return t('breakfast');
      case 'lunch':
        return t('lunch');
      case 'dinner':
        return t('dinner');
      case 'snack':
        return t('snacks');
      default:
        return mealType;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
        <button
          onClick={() => setError(null)}
          className="mt-2 text-sm text-red-500 hover:text-red-700"
        >
          Dismiss
        </button>
      </div>
    );
  }

  if (!dailyNutrition) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <div className="flex space-x-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={() => {
              // Focus on search input to encourage food search
              const searchInput = document.querySelector(
                'input[placeholder="Search foods..."]'
              ) as HTMLInputElement;
              if (searchInput) {
                searchInput.focus();
                // Scroll to search if it's below the fold
                searchInput.scrollIntoView({
                  behavior: 'smooth',
                  block: 'center',
                });
              }
              setShowAddForm(true);
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>{t('add_food_button')}</span>
          </button>
          <button
            onClick={() => {
              setShowCustomMealForm(true);
            }}
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>{t('custom_meal_button')}</span>
          </button>
        </div>
      </div>

      {/* Daily Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NutritionCard
          title={t('calories')}
          current={dailyNutrition.calories}
          goal={dailyNutrition.caloriesGoal}
          unit="kcal"
          color="blue"
          icon={<Flame className="h-5 w-5" />}
        />
        <NutritionCard
          title={t('protein')}
          current={dailyNutrition.protein}
          goal={dailyNutrition.proteinGoal}
          unit="g"
          color="green"
          icon={<Target className="h-5 w-5" />}
        />
        <NutritionCard
          title={t('carbs')}
          current={dailyNutrition.carbs}
          goal={dailyNutrition.carbsGoal}
          unit="g"
          color="orange"
          icon={<Apple className="h-5 w-5" />}
        />
        <NutritionCard
          title={t('fat')}
          current={dailyNutrition.fat}
          goal={dailyNutrition.fatGoal}
          unit="g"
          color="purple"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Contextual AI Trigger for Nutrition */}
      {dailyNutrition && (
        <ContextualAITrigger
          context={{
            type: 'nutrition',
            data: {
              dailyNutrition,
              meals: meals.filter((meal) =>
                meal.timestamp.startsWith(selectedDate)
              ),
              selectedDate,
            },
            title: t('need_help_title'),
            description: t('need_help_description'),
            suggestedQuestions: [
              'How do my macros look today?',
              'What should I eat to reach my goals?',
              'How can I improve my nutrition?',
              'What are good food substitutions?',
            ],
          }}
          askButtonText={t('ask_ai_button')}
          className="mb-6"
        />
      )}

      {/* Weekly Stats */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
          {t('last_7_days')}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
            <div className="text-gray-500 dark:text-gray-400">
              {t('calories')}
            </div>
            <div className="text-gray-900 dark:text-white text-lg font-semibold">
              {weeklyStats.calories.toFixed(2)}
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
            <div className="text-gray-500 dark:text-gray-400">
              {t('protein')}
            </div>
            <div className="text-gray-900 dark:text-white text-lg font-semibold">
              {weeklyStats.protein.toFixed(2)} g
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
            <div className="text-gray-500 dark:text-gray-400">{t('carbs')}</div>
            <div className="text-gray-900 dark:text-white text-lg font-semibold">
              {weeklyStats.carbs.toFixed(2)} g
            </div>
          </div>
          <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
            <div className="text-gray-500 dark:text-gray-400">{t('fat')}</div>
            <div className="text-gray-900 dark:text-white text-lg font-semibold">
              {weeklyStats.fat.toFixed(2)} g
            </div>
          </div>
        </div>
        {showSearchResults && searchResults.length > 0 && searchCursor && (
          <div className="mt-2">
            <button
              disabled={searching}
              onClick={() => searchFoods(searchQuery, searchCursor)}
              className="w-full px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white hover:bg-gray-50 disabled:opacity-60"
            >
              {searching ? 'Loading…' : 'Load more results'}
            </button>
          </div>
        )}
      </div>

      {/* AI Nutrition Intelligence */}
      {user?.id && <NutritionIntelligencePanel userId={user.id} />}

      {/* Water Intake */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('water_intake')}
        </h3>
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400 mb-2">
              <span>
                {dailyNutrition.water} / {dailyNutrition.waterGoal} glasses
              </span>
              <span>
                {Math.round(
                  (dailyNutrition.water / dailyNutrition.waterGoal) * 100
                )}
                %
              </span>
            </div>
            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
              <div
                className="bg-blue-500 h-3 rounded-full transition-all duration-300"
                style={{
                  width: `${Math.min((dailyNutrition.water / dailyNutrition.waterGoal) * 100, 100)}%`,
                }}
              ></div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={removeWater}
              className="bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-100 px-3 py-1 rounded-lg text-sm"
            >
              -1
            </button>
            <button
              onClick={addWater}
              className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm"
            >
              +1
            </button>
          </div>
        </div>
      </div>

      {/* Recent Foods */}
      {recentFoods.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Recent Foods
            </h3>
            <button
              className="text-sm text-blue-600 hover:text-blue-700"
              onClick={() => {
                setRecentFoods([]);
                localStorage.removeItem('recentFoods');
              }}
            >
              Clear
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto">
            {recentFoods.map((food) => (
              <button
                key={food.id}
                onClick={() => selectFood(food)}
                className="shrink-0 px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 text-sm text-gray-900 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-gray-600"
                title={`${food.brand ? food.brand + ' • ' : ''}${food.category}`}
              >
                {food.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search and Filter */}
      <div className="space-y-2">
        {/* Category chips - Temporarily commented out due to filtering issues */}
        {/* <div className="flex flex-wrap gap-2">
          {[
            'all',
            'Vegetables',
            'Fruits',
            'Grains',
            'Meat',
            'Dairy',
            'Seafood',
            'Nuts',
            'Legumes',
            'Beverages',
          ].map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full text-sm border ${
                selectedCategory === cat
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-600'
              }`}
            >
              {cat}
            </button>
          ))}
        </div> */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('search_foods')}
              value={searchQuery}
              onChange={handleSearchChange}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
            {showSearchResults && searchResults.length > 0 && (
              <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 max-h-60 overflow-y-auto">
                {/* Category filter within dropdown - Temporarily commented out */}
                {/* <div className="sticky top-0 bg-white dark:bg-gray-800 p-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400">
                    Filter:
                  </span>
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="all">All</option>
                    <option value="Vegetables">Vegetables</option>
                    <option value="Fruits">Fruits</option>
                    <option value="Grains">Grains</option>
                    <option value="Meat">Meat</option>
                    <option value="Dairy">Dairy</option>
                    <option value="Seafood">Seafood</option>
                    <option value="Nuts">Nuts</option>
                    <option value="Legumes">Legumes</option>
                    <option value="Beverages">Beverages</option>
                  </select>
                </div> */}
                {searchResults.length === 0 ? (
                  <div className="p-4 text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-3">
                      No foods found for "{searchQuery}"
                    </p>
                    <button
                      onClick={() => {
                        setShowCustomMealForm(true);
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('create_custom_meal_button')}</span>
                    </button>
                  </div>
                ) : (
                  searchResults.map((food) => (
                    <div
                      key={food.id}
                      className="border-b border-gray-200 dark:border-gray-700 last:border-b-0"
                    >
                      <div
                        onClick={() => selectFood(food)}
                        className="w-full px-4 py-3 text-left hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer"
                      >
                        <div className="flex justify-between items-center">
                          <div
                            onClick={() => selectFood(food)}
                            className="flex-1 cursor-pointer"
                          >
                            <div className="font-medium text-gray-900 dark:text-white">
                              {food.name}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {food.brand} • {food.category}
                            </div>
                            <div className="text-xs text-gray-400 dark:text-gray-500">
                              {[
                                food.nutritionFacts.calories > 0
                                  ? `${food.nutritionFacts.calories.toFixed(2)} cal`
                                  : null,
                                food.nutritionFacts.protein > 0
                                  ? `${food.nutritionFacts.protein.toFixed(2)}g protein`
                                  : null,
                                food.nutritionFacts.total_carbs > 0
                                  ? `${food.nutritionFacts.total_carbs.toFixed(2)}g carbs`
                                  : null,
                                food.nutritionFacts.total_fat > 0
                                  ? `${food.nutritionFacts.total_fat.toFixed(2)}g fat`
                                  : null,
                              ]
                                .filter(Boolean)
                                .join(' • ')}
                            </div>
                            {(food.allergens.length > 0 ||
                              food.dietaryTags.length > 0) && (
                              <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                {food.allergens.length > 0 && (
                                  <span className="text-red-500">
                                    Contains: {food.allergens.join(', ')}
                                  </span>
                                )}
                                {food.dietaryTags.length > 0 && (
                                  <span className="ml-2 text-green-600">
                                    {food.dietaryTags.slice(0, 3).join(', ')}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                          <div className="flex items-center space-x-3">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                openDetails(food);
                              }}
                              className="text-blue-600 hover:text-blue-700 text-sm"
                            >
                              Details
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleFavorite(food);
                              }}
                              className={`text-sm ${favoriteFoodIds.has(food.id) ? 'text-yellow-600 hover:text-yellow-700' : 'text-gray-600 hover:text-gray-800 dark:text-gray-300 dark:hover:text-gray-100'}`}
                              title={
                                favoriteFoodIds.has(food.id)
                                  ? 'Unfavorite'
                                  : 'Favorite'
                              }
                            >
                              {favoriteFoodIds.has(food.id) ? '★' : '☆'}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
            {/* Show message when search has been performed but no results found */}
            {showSearchResults &&
              searchResults.length === 0 &&
              searchQuery.length >= 2 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 p-4">
                  <div className="text-center">
                    <p className="text-gray-500 dark:text-gray-400 mb-3">
                      No foods found for "{searchQuery}"
                    </p>
                    <button
                      onClick={() => {
                        setShowCustomMealForm(true);
                        setShowSearchResults(false);
                        setSearchQuery('');
                      }}
                      className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2 mx-auto"
                    >
                      <Plus className="h-4 w-4" />
                      <span>{t('create_custom_meal_button')}</span>
                    </button>
                  </div>
                </div>
              )}
          </div>
          <select
            value={selectedMeal}
            onChange={(e) => setSelectedMeal(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="all">{t('meals')}</option>
            <option value="breakfast">{t('breakfast')}</option>
            <option value="lunch">{t('lunch')}</option>
            <option value="dinner">{t('dinner')}</option>
            <option value="snack">{t('snacks')}</option>
          </select>
        </div>
      </div>

      {/* Meals */}
      <div className="space-y-6">
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(
          (mealType) => {
            const mealEntries = filteredMeals.filter(
              (meal) => meal.mealType === mealType
            );
            const total = mealTotals[mealType] || {
              calories: 0,
              protein: 0,
              carbs: 0,
              fat: 0,
            };

            if (mealEntries.length === 0 && selectedMeal !== 'all') return null;

            return (
              <div
                key={mealType}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white capitalize">
                      {getMealTypeLabel(mealType)}
                    </h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {total.calories.toFixed(2)} kcal •{' '}
                      {total.protein.toFixed(2)}g protein •{' '}
                      {total.carbs.toFixed(2)}g carbs • {total.fat.toFixed(2)}g
                      fat
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {mealEntries.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      Inga {getMealTypeLabel(mealType).toLowerCase()} poster
                      ännu
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {mealEntries.map((meal) => (
                        <div
                          key={meal.id}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {meal.name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {meal.servingSize} • {meal.calories.toFixed(2)}{' '}
                              kcal
                            </p>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>{meal.protein.toFixed(2)}g protein</span>
                            <span>{meal.carbs.toFixed(2)}g carbs</span>
                            <span>{meal.fat.toFixed(2)}g fat</span>
                            <button
                              onClick={() => openEdit(meal)}
                              className="text-blue-500 hover:text-blue-700"
                              title="Edit meal"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => deleteMeal(meal.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          }
        )}
      </div>

      {/* Add Food Modal */}
      {showAddForm && (
        <AddFoodModal
          selectedFood={selectedFood}
          servingSize={servingSize}
          setServingSize={setServingSize}
          servingWeight={servingWeight}
          setServingWeight={setServingWeight}
          selectedMeal={selectedMealType}
          setSelectedMeal={setSelectedMealType}
          onClose={() => {
            setShowAddForm(false);
            setSelectedFood(null);
          }}
          onAdd={addMeal}
        />
      )}

      {/* Custom Meal Modal */}
      {showCustomMealForm && (
        <CustomMealModal
          onClose={() => setShowCustomMealForm(false)}
          onAdd={addCustomMeal}
        />
      )}

      {/* Edit Meal Modal */}
      {editingMeal && (
        <EditMealModal
          meal={editingMeal}
          onClose={() => setEditingMeal(null)}
          onSave={(name, mealType) =>
            saveEdit({ id: editingMeal.id, name, mealType: mealType as any })
          }
        />
      )}

      {/* Food Details Drawer */}
      {showDetailsDrawer && detailsFood && (
        <FoodDetailsDrawer food={detailsFood} onClose={closeDetails} />
      )}
    </div>
  );
}

function NutritionCard({
  title,
  current,
  goal,
  unit,
  color,
  icon,
}: {
  title: string;
  current: number;
  goal: number;
  unit: string;
  color: string;
  icon: React.ReactNode;
}) {
  const percentage = Math.round((current / goal) * 100);

  const colorClasses = {
    blue: 'bg-blue-600',
    green: 'bg-green-600',
    orange: 'bg-orange-600',
    purple: 'bg-purple-600',
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
      <div className="flex items-center justify-between mb-2">
        <div
          className={`p-2 rounded-lg text-white ${colorClasses[color as keyof typeof colorClasses]}`}
        >
          {icon}
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {percentage}%
        </span>
      </div>
      <div>
        <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </p>
        <p className="text-2xl font-semibold text-gray-900 dark:text-white mt-1">
          {current.toFixed(2)} / {goal.toFixed(2)} {unit}
        </p>
        <div className="mt-2">
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className={`h-2 rounded-full transition-all duration-300 ${colorClasses[color as keyof typeof colorClasses]}`}
              style={{ width: `${Math.min(percentage, 100)}%` }}
            ></div>
          </div>
        </div>
      </div>
    </div>
  );
}

function FoodDetailsDrawer({
  food,
  onClose,
}: {
  food: Food;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1" onClick={onClose} />
      <div className="w-full sm:w-[28rem] h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 shadow-xl p-6 overflow-y-auto">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {food.name}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        <div className="text-sm text-gray-600 dark:text-gray-300 mb-4">
          {food.brand ? `${food.brand} • ` : ''}
          {food.category}
        </div>
        <div className="grid grid-cols-2 gap-3 mb-6">
          {food.nutritionFacts.calories > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="text-gray-500 dark:text-gray-400">Calories</div>
              <div className="text-gray-900 dark:text-white text-lg font-semibold">
                {food.nutritionFacts.calories.toFixed(2)}
              </div>
            </div>
          )}
          {food.nutritionFacts.protein > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="text-gray-500 dark:text-gray-400">Protein</div>
              <div className="text-gray-900 dark:text-white text-lg font-semibold">
                {food.nutritionFacts.protein.toFixed(2)} g
              </div>
            </div>
          )}
          {food.nutritionFacts.total_carbs > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="text-gray-500 dark:text-gray-400">
                Total Carbs
              </div>
              <div className="text-gray-900 dark:text-white text-lg font-semibold">
                {food.nutritionFacts.total_carbs.toFixed(2)} g
              </div>
            </div>
          )}
          {food.nutritionFacts.total_fat > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="text-gray-500 dark:text-gray-400">Total Fat</div>
              <div className="text-gray-900 dark:text-white text-lg font-semibold">
                {food.nutritionFacts.total_fat.toFixed(2)} g
              </div>
            </div>
          )}
          {food.nutritionFacts.dietary_fiber > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="text-gray-500 dark:text-gray-400">
                Dietary Fiber
              </div>
              <div className="text-gray-900 dark:text-white text-lg font-semibold">
                {food.nutritionFacts.dietary_fiber.toFixed(2)} g
              </div>
            </div>
          )}
          {food.nutritionFacts.total_sugars > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="text-gray-500 dark:text-gray-400">
                Total Sugars
              </div>
              <div className="text-gray-900 dark:text-white text-lg font-semibold">
                {food.nutritionFacts.total_sugars.toFixed(2)} g
              </div>
            </div>
          )}
          {food.nutritionFacts.sodium > 0 && (
            <div className="p-3 rounded-lg bg-gray-50 dark:bg-gray-700">
              <div className="text-gray-500 dark:text-gray-400">Sodium</div>
              <div className="text-gray-900 dark:text-white text-lg font-semibold">
                {food.nutritionFacts.sodium.toFixed(2)} mg
              </div>
            </div>
          )}
        </div>
        <div className="mb-6">
          <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
            Common Servings
          </h3>
          <div className="space-y-2">
            {food.commonServings.map((s) => (
              <div
                key={s.name}
                className="flex justify-between items-center p-2 rounded-lg bg-gray-50 dark:bg-gray-700"
              >
                <div className="text-sm text-gray-800 dark:text-gray-100">
                  {s.name} • {s.weight} g
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-300">
                  {[
                    s.nutritionFacts.calories > 0
                      ? `${s.nutritionFacts.calories.toFixed(2)} cal`
                      : null,
                    s.nutritionFacts.protein > 0
                      ? `${s.nutritionFacts.protein.toFixed(2)}g protein`
                      : null,
                    s.nutritionFacts.total_carbs > 0
                      ? `${s.nutritionFacts.total_carbs.toFixed(2)}g carbs`
                      : null,
                    s.nutritionFacts.total_fat > 0
                      ? `${s.nutritionFacts.total_fat.toFixed(2)}g fat`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' • ')}
                </div>
                {[
                  s.nutritionFacts.dietary_fiber > 0
                    ? `Fiber: ${s.nutritionFacts.dietary_fiber.toFixed(2)}g`
                    : null,
                  s.nutritionFacts.total_sugars > 0
                    ? `Sugar: ${s.nutritionFacts.total_sugars.toFixed(2)}g`
                    : null,
                  s.nutritionFacts.sodium > 0
                    ? `Sodium: ${s.nutritionFacts.sodium.toFixed(2)}mg`
                    : null,
                ].filter(Boolean).length > 0 && (
                  <div className="text-xs text-gray-400 dark:text-gray-400 mt-1">
                    {[
                      s.nutritionFacts.dietary_fiber > 0
                        ? `Fiber: ${s.nutritionFacts.dietary_fiber}g`
                        : null,
                      s.nutritionFacts.total_sugars > 0
                        ? `Sugar: ${s.nutritionFacts.total_sugars}g`
                        : null,
                      s.nutritionFacts.sodium > 0
                        ? `Sodium: ${s.nutritionFacts.sodium}mg`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
        {(food.allergens?.length || 0) > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
              Allergens
            </h3>
            <div className="flex flex-wrap gap-2">
              {food.allergens.map((a) => (
                <span
                  key={a}
                  className="px-2 py-1 text-xs rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                >
                  {a}
                </span>
              ))}
            </div>
          </div>
        )}
        {(food.dietaryTags?.length || 0) > 0 && (
          <div className="mb-6">
            <h3 className="text-md font-semibold text-gray-900 dark:text-white mb-2">
              Dietary Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {food.dietaryTags.map((t) => (
                <span
                  key={t}
                  className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function AddFoodModal({
  selectedFood,
  servingSize,
  setServingSize,
  servingWeight,
  setServingWeight,
  selectedMeal,
  setSelectedMeal,
  onClose,
  onAdd,
}: {
  selectedFood: Food | null;
  servingSize: string;
  setServingSize: (size: string) => void;
  servingWeight: number;
  setServingWeight: (weight: number) => void;
  selectedMeal: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  setSelectedMeal: (meal: 'breakfast' | 'lunch' | 'dinner' | 'snack') => void;
  onClose: () => void;
  onAdd: () => void;
}) {
  const t = useTranslations('nutrition_page');
  if (!selectedFood) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6">
          <div className="text-center">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
              {t('search_for_food_first_title')}
            </h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              {t('search_for_food_first_message')}
            </p>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg"
              >
                {t('got_it_close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Ensure we have valid serving data
  const serving =
    selectedFood.commonServings?.find((s) => s.name === servingSize) ||
    selectedFood.commonServings?.[0];

  if (!serving) {
    console.error('No serving found for food:', selectedFood);
    return null;
  }

  const multiplier = servingWeight > 0 ? servingWeight / serving.weight : 1;

  const nutrition = {
    calories: Math.round((serving.nutritionFacts?.calories || 0) * multiplier),
    protein:
      Math.round((serving.nutritionFacts?.protein || 0) * multiplier * 10) / 10,
    carbs:
      Math.round((serving.nutritionFacts?.total_carbs || 0) * multiplier * 10) /
      10,
    fat:
      Math.round((serving.nutritionFacts?.total_fat || 0) * multiplier * 10) /
      10,
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('add_food_entry_title')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('food_label')}
              </label>
              <div className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="font-medium text-gray-900 dark:text-white">
                  {selectedFood.name}
                </div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedFood.brand} • {selectedFood.category}
                </div>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('serving_size_label')}
              </label>
              <select
                value={servingSize}
                onChange={(e) => {
                  setServingSize(e.target.value);
                  const newServing = selectedFood.commonServings.find(
                    (s) => s.name === e.target.value
                  );
                  if (newServing) {
                    setServingWeight(newServing.weight);
                  }
                }}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                {selectedFood.commonServings.map((serving) => (
                  <option key={serving.name} value={serving.name}>
                    {serving.name} ({serving.weight}g)
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('weight_label')}
              </label>
              <input
                type="number"
                value={servingWeight}
                onChange={(e) => setServingWeight(Number(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                min="1"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('meal_type_label')}
              </label>
              <select
                value={selectedMeal}
                onChange={(e) =>
                  setSelectedMeal(
                    e.target.value as 'breakfast' | 'lunch' | 'dinner' | 'snack'
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="breakfast">{t('breakfast')}</option>
                <option value="lunch">{t('lunch')}</option>
                <option value="dinner">{t('dinner')}</option>
                <option value="snack">{t('snacks')}</option>
              </select>
            </div>

            <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
                {t('nutrition_per_100g')}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-blue-800 dark:text-blue-200">
                {selectedFood.nutritionFacts.calories > 0 && (
                  <div>
                    <strong>{selectedFood.nutritionFacts.calories}</strong>{' '}
                    calories
                  </div>
                )}
                {selectedFood.nutritionFacts.protein > 0 && (
                  <div>
                    <strong>{selectedFood.nutritionFacts.protein}g</strong>{' '}
                    protein
                  </div>
                )}
                {selectedFood.nutritionFacts.total_carbs > 0 && (
                  <div>
                    <strong>{selectedFood.nutritionFacts.total_carbs}g</strong>{' '}
                    carbs
                  </div>
                )}
                {selectedFood.nutritionFacts.total_fat > 0 && (
                  <div>
                    <strong>{selectedFood.nutritionFacts.total_fat}g</strong>{' '}
                    fat
                  </div>
                )}
                {selectedFood.nutritionFacts.dietary_fiber > 0 && (
                  <div>
                    <strong>
                      {selectedFood.nutritionFacts.dietary_fiber}g
                    </strong>{' '}
                    fiber
                  </div>
                )}
                {selectedFood.nutritionFacts.total_sugars > 0 && (
                  <div>
                    <strong>{selectedFood.nutritionFacts.total_sugars}g</strong>{' '}
                    sugar
                  </div>
                )}
                {selectedFood.nutritionFacts.sodium > 0 && (
                  <div>
                    <strong>{selectedFood.nutritionFacts.sodium}mg</strong>{' '}
                    sodium
                  </div>
                )}
              </div>
              <div className="mt-2 text-xs text-blue-700 dark:text-blue-300">
                {t('your_portion')}: {servingWeight}g ={' '}
                {[
                  nutrition.calories > 0
                    ? `${nutrition.calories.toFixed(2)} cal`
                    : null,
                  nutrition.protein > 0
                    ? `${nutrition.protein.toFixed(2)}g protein`
                    : null,
                  nutrition.carbs > 0
                    ? `${nutrition.carbs.toFixed(2)}g carbs`
                    : null,
                  nutrition.fat > 0 ? `${nutrition.fat.toFixed(2)}g fat` : null,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={onAdd}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>{t('add_food_button')}</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('cancel_button')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditMealModal({
  meal,
  onClose,
  onSave,
}: {
  meal: Meal;
  onClose: () => void;
  onSave: (name: string, mealType: string) => void;
}) {
  const [name, setName] = useState<string>(meal.name);
  const [mealType, setMealType] = useState<string>(meal.mealType);
  const t = useTranslations('nutrition_page');
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('edit_meal_title')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('name_label')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('meal_type_label')}
              </label>
              <select
                value={mealType}
                onChange={(e) => setMealType(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="breakfast">{t('breakfast')}</option>
                <option value="lunch">{t('lunch')}</option>
                <option value="dinner">{t('dinner')}</option>
                <option value="snack">{t('snacks')}</option>
              </select>
            </div>
            <div className="flex space-x-3 pt-2">
              <button
                onClick={() => onSave(name, mealType)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>{t('save_button')}</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('cancel_button')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CustomMealModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (customMealData: {
    name: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    fiber: number;
    sugar: number;
    sodium: number;
    servingSize: string;
    servingWeight: number;
    mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  }) => void;
}) {
  const t = useTranslations('nutrition_page');
  const [name, setName] = useState('');
  const [calories, setCalories] = useState(0);
  const [protein, setProtein] = useState(0);
  const [carbs, setCarbs] = useState(0);
  const [fat, setFat] = useState(0);
  const [fiber, setFiber] = useState(0);
  const [sugar, setSugar] = useState(0);
  const [sodium, setSodium] = useState(0);
  const [servingSize, setServingSize] = useState('1 serving');
  const [servingWeight, setServingWeight] = useState(100);
  const [mealType, setMealType] = useState<
    'breakfast' | 'lunch' | 'dinner' | 'snack'
  >('breakfast');

  const handleSubmit = () => {
    if (!name.trim()) {
      alert(t('meal_name_required_alert'));
      return;
    }

    onAdd({
      name: name.trim(),
      calories,
      protein,
      carbs,
      fat,
      fiber,
      sugar,
      sodium,
      servingSize,
      servingWeight,
      mealType,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {t('create_custom_meal_button')}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('meal_name_label')}
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('meal_name_placeholder')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('calories_label')}
                </label>
                <input
                  type="number"
                  value={calories}
                  onChange={(e) => setCalories(Number(e.target.value))}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('protein_label')}
                </label>
                <input
                  type="number"
                  value={protein}
                  onChange={(e) => setProtein(Number(e.target.value))}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('carbs_label')}
                </label>
                <input
                  type="number"
                  value={carbs}
                  onChange={(e) => setCarbs(Number(e.target.value))}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('fat_label')}
                </label>
                <input
                  type="number"
                  value={fat}
                  onChange={(e) => setFat(Number(e.target.value))}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('fiber_label')}
                </label>
                <input
                  type="number"
                  value={fiber}
                  onChange={(e) => setFiber(Number(e.target.value))}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('sugar_label')}
                </label>
                <input
                  type="number"
                  value={sugar}
                  onChange={(e) => setSugar(Number(e.target.value))}
                  min="0"
                  step="0.1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('sodium_label')}
                </label>
                <input
                  type="number"
                  value={sodium}
                  onChange={(e) => setSodium(Number(e.target.value))}
                  min="0"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  {t('weight_label')}
                </label>
                <input
                  type="number"
                  value={servingWeight}
                  onChange={(e) => setServingWeight(Number(e.target.value))}
                  min="1"
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('serving_description')}
              </label>
              <input
                type="text"
                value={servingSize}
                onChange={(e) => setServingSize(e.target.value)}
                placeholder="e.g., 1 plate, 1 bowl, 2 slices"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                {t('meal_type_label')}
              </label>
              <select
                value={mealType}
                onChange={(e) =>
                  setMealType(
                    e.target.value as 'breakfast' | 'lunch' | 'dinner' | 'snack'
                  )
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="breakfast">{t('breakfast')}</option>
                <option value="lunch">{t('lunch')}</option>
                <option value="dinner">{t('dinner')}</option>
                <option value="snack">{t('snacks')}</option>
              </select>
            </div>

            <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <div className="text-sm font-medium text-green-900 dark:text-green-100 mb-2">
                {t('nutrition_summary')}
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm text-green-800 dark:text-green-200">
                <div>
                  <strong>{calories}</strong> {t('calories_label')}
                </div>
                <div>
                  <strong>{protein}g</strong> {t('protein_label')}
                </div>
                <div>
                  <strong>{carbs}g</strong> {t('carbs_label')}
                </div>
                <div>
                  <strong>{fat}g</strong> {t('fat_label')}
                </div>
              </div>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                onClick={handleSubmit}
                className="flex-1 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
              >
                <Check className="h-4 w-4" />
                <span>{t('add_custom_meal_button')}</span>
              </button>
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                {t('cancel_button')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
