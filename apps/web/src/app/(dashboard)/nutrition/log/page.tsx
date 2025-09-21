'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '../../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  Search,
  Plus,
  Minus,
  Save,
  ArrowLeft,
  Apple,
  Clock,
  Target,
  Flame,
  Zap,
  Droplets,
} from 'lucide-react';

interface Food {
  id: string;
  name: string;
  brand?: string;
  category: string;
  servingSize: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  sodium: number;
  commonServings: Array<{
    name: string;
    amount: number;
    unit: string;
  }>;
}

interface LoggedFood {
  food: Food;
  amount: number;
  unit: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  timestamp: string;
}

export default function LogNutritionPage() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Food[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedFood, setSelectedFood] = useState<Food | null>(null);
  const [loggedFoods, setLoggedFoods] = useState<LoggedFood[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [logForm, setLogForm] = useState({
    amount: 1,
    unit: 'serving',
    mealType: 'breakfast' as const,
  });

  const [dailyTotals, setDailyTotals] = useState({
    calories: 0,
    protein: 0,
    carbs: 0,
    fat: 0,
    fiber: 0,
    sugar: 0,
    sodium: 0,
  });

  useEffect(() => {
    if (searchQuery.length > 2) {
      searchFoods();
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  useEffect(() => {
    calculateTotals();
  }, [loggedFoods]);

  const searchFoods = async () => {
    try {
      setSearching(true);
      const response = await api.searchFoods(searchQuery);
      if (response.statusCode === 200) {
        setSearchResults(response.body);
      } else {
        // Mock data for demonstration
        setSearchResults([
          {
            id: '1',
            name: 'Chicken Breast',
            brand: 'Generic',
            category: 'Protein',
            servingSize: '100g',
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6,
            fiber: 0,
            sugar: 0,
            sodium: 74,
            commonServings: [
              { name: '100g', amount: 1, unit: 'serving' },
              { name: '1 piece', amount: 1, unit: 'piece' },
              { name: '1 cup', amount: 1, unit: 'cup' },
            ],
          },
          {
            id: '2',
            name: 'Brown Rice',
            brand: 'Generic',
            category: 'Grains',
            servingSize: '100g',
            calories: 111,
            protein: 2.6,
            carbs: 23,
            fat: 0.9,
            fiber: 1.8,
            sugar: 0.4,
            sodium: 5,
            commonServings: [
              { name: '100g', amount: 1, unit: 'serving' },
              { name: '1 cup', amount: 1, unit: 'cup' },
              { name: '1/2 cup', amount: 0.5, unit: 'cup' },
            ],
          },
          {
            id: '3',
            name: 'Greek Yogurt',
            brand: 'Chobani',
            category: 'Dairy',
            servingSize: '170g',
            calories: 100,
            protein: 17,
            carbs: 6,
            fat: 0.4,
            fiber: 0,
            sugar: 6,
            sodium: 50,
            commonServings: [
              { name: '170g', amount: 1, unit: 'container' },
              { name: '1 cup', amount: 1, unit: 'cup' },
              { name: '1/2 cup', amount: 0.5, unit: 'cup' },
            ],
          },
        ]);
      }
    } catch (e: any) {
      console.error('Failed to search foods:', e);
      setError(e?.message || 'Failed to search foods');
    } finally {
      setSearching(false);
    }
  };

  const calculateTotals = () => {
    const totals = loggedFoods.reduce(
      (acc, loggedFood) => {
        const multiplier = loggedFood.amount;
        return {
          calories: acc.calories + loggedFood.food.calories * multiplier,
          protein: acc.protein + loggedFood.food.protein * multiplier,
          carbs: acc.carbs + loggedFood.food.carbs * multiplier,
          fat: acc.fat + loggedFood.food.fat * multiplier,
          fiber: acc.fiber + loggedFood.food.fiber * multiplier,
          sugar: acc.sugar + loggedFood.food.sugar * multiplier,
          sodium: acc.sodium + loggedFood.food.sodium * multiplier,
        };
      },
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
    setDailyTotals(totals);
  };

  const addFood = () => {
    if (selectedFood) {
      const loggedFood: LoggedFood = {
        food: selectedFood,
        amount: logForm.amount,
        unit: logForm.unit,
        mealType: logForm.mealType,
        timestamp: new Date().toISOString(),
      };
      setLoggedFoods([...loggedFoods, loggedFood]);
      setSelectedFood(null);
      setLogForm({ amount: 1, unit: 'serving', mealType: 'breakfast' });
    }
  };

  const removeFood = (index: number) => {
    setLoggedFoods(loggedFoods.filter((_, i) => i !== index));
  };

  const saveLog = async () => {
    if (loggedFoods.length === 0) {
      setError('No foods to log');
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      const userId = user?.id || 'current-user';

      // Create meals for each logged food
      const promises = loggedFoods.map((loggedFood) =>
        api.createMeal(
          {
            food_name: loggedFood.food.name,
            calories: Math.round(loggedFood.food.calories * loggedFood.amount),
            protein:
              Math.round(loggedFood.food.protein * loggedFood.amount * 10) / 10,
            carbs:
              Math.round(loggedFood.food.carbs * loggedFood.amount * 10) / 10,
            fat: Math.round(loggedFood.food.fat * loggedFood.amount * 10) / 10,
            fiber:
              Math.round(loggedFood.food.fiber * loggedFood.amount * 10) / 10,
            sugar:
              Math.round(loggedFood.food.sugar * loggedFood.amount * 10) / 10,
            sodium: Math.round(loggedFood.food.sodium * loggedFood.amount),
            serving_size: `${loggedFood.amount} ${loggedFood.unit}`,
            meal_type: loggedFood.mealType,
          },
          userId
        )
      );

      await Promise.all(promises);
      setSuccess('Nutrition logged successfully!');
      setTimeout(() => {
        router.push('/nutrition');
      }, 1500);
    } catch (e: any) {
      console.error('Failed to save nutrition log:', e);
      setError(e?.message || 'Failed to save nutrition log');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => router.back()}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Log Nutrition
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your daily food intake
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-green-600 dark:text-green-400">{success}</div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Food Search */}
        <div className="lg:col-span-1 space-y-6">
          {/* Search */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Search Foods
            </h3>

            <div className="relative mb-4">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for foods..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>

            {searching && (
              <div className="text-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto"></div>
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {searchResults.map((food) => (
                  <button
                    key={food.id}
                    onClick={() => setSelectedFood(food)}
                    className="w-full text-left p-3 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                  >
                    <div className="font-medium text-gray-900 dark:text-white">
                      {food.name}
                    </div>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {food.calories} cal • {food.protein}g protein •{' '}
                      {food.carbs}g carbs
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Food Details */}
          {selectedFood && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {selectedFood.name}
              </h3>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Amount
                  </label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={logForm.amount}
                    onChange={(e) =>
                      setLogForm({ ...logForm, amount: Number(e.target.value) })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Unit
                  </label>
                  <select
                    value={logForm.unit}
                    onChange={(e) =>
                      setLogForm({ ...logForm, unit: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    {selectedFood.commonServings.map((serving, index) => (
                      <option key={index} value={serving.unit}>
                        {serving.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Meal Type
                  </label>
                  <select
                    value={logForm.mealType}
                    onChange={(e) =>
                      setLogForm({
                        ...logForm,
                        mealType: e.target.value as any,
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="breakfast">Breakfast</option>
                    <option value="lunch">Lunch</option>
                    <option value="dinner">Dinner</option>
                    <option value="snack">Snack</option>
                  </select>
                </div>

                <button
                  onClick={addFood}
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center justify-center space-x-2"
                >
                  <Plus className="h-4 w-4" />
                  <span>Add to Log</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Logged Foods & Totals */}
        <div className="lg:col-span-2 space-y-6">
          {/* Daily Totals */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Daily Totals
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg mx-auto mb-2">
                  <Flame className="h-6 w-6 text-red-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(dailyTotals.calories)}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Calories
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg mx-auto mb-2">
                  <Target className="h-6 w-6 text-blue-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(dailyTotals.protein * 10) / 10}g
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Protein
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg mx-auto mb-2">
                  <Apple className="h-6 w-6 text-orange-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(dailyTotals.carbs * 10) / 10}g
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Carbs
                </div>
              </div>

              <div className="text-center">
                <div className="flex items-center justify-center w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-lg mx-auto mb-2">
                  <Zap className="h-6 w-6 text-purple-600" />
                </div>
                <div className="text-2xl font-bold text-gray-900 dark:text-white">
                  {Math.round(dailyTotals.fat * 10) / 10}g
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Fat
                </div>
              </div>
            </div>
          </div>

          {/* Logged Foods */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Logged Foods ({loggedFoods.length})
            </h3>

            {loggedFoods.length === 0 ? (
              <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                <Apple className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                <p>No foods logged yet</p>
                <p className="text-sm">Search and add foods to get started</p>
              </div>
            ) : (
              <div className="space-y-3">
                {loggedFoods.map((loggedFood, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                  >
                    <div className="flex-1">
                      <div className="font-medium text-gray-900 dark:text-white">
                        {loggedFood.food.name}
                      </div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        {loggedFood.amount} {loggedFood.unit} •{' '}
                        {loggedFood.mealType} •{' '}
                        {Math.round(
                          loggedFood.food.calories * loggedFood.amount
                        )}{' '}
                        cal
                      </div>
                    </div>
                    <button
                      onClick={() => removeFood(index)}
                      className="text-red-500 hover:text-red-700 p-1"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex justify-end space-x-4">
        <button
          onClick={() => router.back()}
          className="px-6 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          Cancel
        </button>
        <button
          onClick={saveLog}
          disabled={saving || loggedFoods.length === 0}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-6 py-2 rounded-lg flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save Log'}</span>
        </button>
      </div>
    </div>
  );
}
