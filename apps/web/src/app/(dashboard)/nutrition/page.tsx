'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
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
} from 'lucide-react';

interface NutritionEntry {
  id: string;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  sugar: number;
  servingSize: string;
  timestamp: string;
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack';
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
  const { user } = useCurrentUser();
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
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

  useEffect(() => {
    fetchNutritionData();
  }, [selectedDate]);

  const fetchNutritionData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch meals for today
      const today = new Date().toISOString().split('T')[0];
      const response = await api.getMealsByDate(today);

      if (response.statusCode === 200) {
        // Transform API response to frontend format
        const apiEntries: NutritionEntry[] = response.body.map((meal: any) => ({
          id: meal.id,
          name: meal.food?.name || meal.name,
          calories: meal.calories || 0,
          protein: meal.protein || 0,
          carbs: meal.carbs || 0,
          fat: meal.fat || 0,
          fiber: meal.fiber || 0,
          sugar: meal.sugar || 0,
          servingSize: meal.serving_size || '1 serving',
          timestamp: meal.created_at || new Date().toISOString(),
          mealType: meal.meal_type || 'breakfast',
        }));
        setEntries(apiEntries);
      } else {
        // Fallback to mock data if API fails
        const mockEntries: NutritionEntry[] = [
          {
            id: '1',
            name: 'Grilled Chicken Breast',
            calories: 165,
            protein: 31,
            carbs: 0,
            fat: 3.6,
            fiber: 0,
            sugar: 0,
            servingSize: '100g',
            timestamp: '2024-01-20T08:00:00Z',
            mealType: 'breakfast',
          },
          {
            id: '2',
            name: 'Brown Rice',
            calories: 111,
            protein: 2.6,
            carbs: 23,
            fat: 0.9,
            fiber: 1.8,
            sugar: 0.4,
            servingSize: '100g',
            timestamp: '2024-01-20T08:00:00Z',
            mealType: 'breakfast',
          },
          {
            id: '3',
            name: 'Greek Yogurt',
            calories: 100,
            protein: 17,
            carbs: 6,
            fat: 0.4,
            fiber: 0,
            sugar: 6,
            servingSize: '170g',
            timestamp: '2024-01-20T12:00:00Z',
            mealType: 'lunch',
          },
          {
            id: '4',
            name: 'Salmon Fillet',
            calories: 208,
            protein: 22,
            carbs: 0,
            fat: 12,
            fiber: 0,
            sugar: 0,
            servingSize: '100g',
            timestamp: '2024-01-20T19:00:00Z',
            mealType: 'dinner',
          },
        ];

        const mockDailyNutrition: DailyNutrition = {
          calories: 584,
          caloriesGoal: 2000,
          protein: 72.6,
          proteinGoal: 150,
          carbs: 29,
          carbsGoal: 250,
          fat: 16.9,
          fatGoal: 67,
          fiber: 1.8,
          fiberGoal: 25,
          water: 6,
          waterGoal: 8,
        };

        setEntries(mockEntries);
        setDailyNutrition(mockDailyNutrition);
      }
    } catch (e: any) {
      console.error('Failed to fetch nutrition data:', e);
      // Use mock data as fallback
      const mockEntries: NutritionEntry[] = [
        {
          id: '1',
          name: 'Grilled Chicken Breast',
          calories: 165,
          protein: 31,
          carbs: 0,
          fat: 3.6,
          fiber: 0,
          sugar: 0,
          servingSize: '100g',
          timestamp: '2024-01-20T08:00:00Z',
          mealType: 'breakfast',
        },
        {
          id: '2',
          name: 'Brown Rice',
          calories: 111,
          protein: 2.6,
          carbs: 23,
          fat: 0.9,
          fiber: 1.8,
          sugar: 0.4,
          servingSize: '100g',
          timestamp: '2024-01-20T08:00:00Z',
          mealType: 'breakfast',
        },
        {
          id: '3',
          name: 'Greek Yogurt',
          calories: 100,
          protein: 17,
          carbs: 6,
          fat: 0.4,
          fiber: 0,
          sugar: 6,
          servingSize: '170g',
          timestamp: '2024-01-20T12:00:00Z',
          mealType: 'lunch',
        },
        {
          id: '4',
          name: 'Salmon Fillet',
          calories: 208,
          protein: 22,
          carbs: 0,
          fat: 12,
          fiber: 0,
          sugar: 0,
          servingSize: '100g',
          timestamp: '2024-01-20T19:00:00Z',
          mealType: 'dinner',
        },
      ];

      const mockDailyNutrition: DailyNutrition = {
        calories: 584,
        caloriesGoal: 2000,
        protein: 72.6,
        proteinGoal: 150,
        carbs: 29,
        carbsGoal: 250,
        fat: 16.9,
        fatGoal: 67,
        fiber: 1.8,
        fiberGoal: 25,
        water: 6,
        waterGoal: 8,
      };

      setEntries(mockEntries);
      setDailyNutrition(mockDailyNutrition);
    } finally {
      setLoading(false);
    }
  };

  const addNutritionEntry = async (
    entry: Omit<NutritionEntry, 'id' | 'timestamp'>
  ) => {
    try {
      const userId = user?.id || 'current-user';

      // Create meal via API
      const response = await api.createMeal(
        {
          food_name: entry.name,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          fiber: entry.fiber,
          sugar: entry.sugar,
          serving_size: entry.servingSize,
          meal_type: entry.mealType,
        },
        userId
      );

      if (response.statusCode === 200 || response.statusCode === 201) {
        // Add to local state
        const newEntry: NutritionEntry = {
          ...entry,
          id: response.body?.id || Date.now().toString(),
          timestamp: new Date().toISOString(),
        };
        setEntries((prev) => [...prev, newEntry]);
        setShowAddForm(false);
      }
    } catch (e: any) {
      console.error('Failed to add nutrition entry:', e);
      // Still add to local state for immediate UI update
      const newEntry: NutritionEntry = {
        ...entry,
        id: Date.now().toString(),
        timestamp: new Date().toISOString(),
      };
      setEntries((prev) => [...prev, newEntry]);
      setShowAddForm(false);
    }
  };

  const deleteEntry = async (id: string) => {
    try {
      const userId = user?.id || 'current-user';

      // Delete meal via API
      await api.deleteMeal(id, userId);

      // Remove from local state
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (e: any) {
      console.error('Failed to delete nutrition entry:', e);
      // Still remove from local state for immediate UI update
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    }
  };

  const filteredEntries = entries.filter((entry) => {
    const matchesSearch = entry.name
      .toLowerCase()
      .includes(searchQuery.toLowerCase());
    const matchesMeal =
      selectedMeal === 'all' || entry.mealType === selectedMeal;
    return matchesSearch && matchesMeal;
  });

  const mealTotals = entries.reduce(
    (acc, entry) => {
      if (!acc[entry.mealType]) {
        acc[entry.mealType] = { calories: 0, protein: 0, carbs: 0, fat: 0 };
      }
      acc[entry.mealType].calories += entry.calories;
      acc[entry.mealType].protein += entry.protein;
      acc[entry.mealType].carbs += entry.carbs;
      acc[entry.mealType].fat += entry.fat;
      return acc;
    },
    {} as Record<
      string,
      { calories: number; protein: number; carbs: number; fat: number }
    >
  );

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
            Nutrition
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your daily nutrition intake
          </p>
        </div>
        <div className="flex space-x-2">
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
          <button
            onClick={() => (window.location.href = '/nutrition/log')}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
          >
            <Plus className="h-4 w-4" />
            <span>Log Food</span>
          </button>
        </div>
      </div>

      {/* Daily Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <NutritionCard
          title="Calories"
          current={dailyNutrition.calories}
          goal={dailyNutrition.caloriesGoal}
          unit="kcal"
          color="blue"
          icon={<Flame className="h-5 w-5" />}
        />
        <NutritionCard
          title="Protein"
          current={dailyNutrition.protein}
          goal={dailyNutrition.proteinGoal}
          unit="g"
          color="green"
          icon={<Target className="h-5 w-5" />}
        />
        <NutritionCard
          title="Carbs"
          current={dailyNutrition.carbs}
          goal={dailyNutrition.carbsGoal}
          unit="g"
          color="orange"
          icon={<Apple className="h-5 w-5" />}
        />
        <NutritionCard
          title="Fat"
          current={dailyNutrition.fat}
          goal={dailyNutrition.fatGoal}
          unit="g"
          color="purple"
          icon={<TrendingUp className="h-5 w-5" />}
        />
      </div>

      {/* Water Intake */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Water Intake
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
          <button className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded-lg text-sm">
            +1 Glass
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="flex space-x-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search foods..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <select
          value={selectedMeal}
          onChange={(e) => setSelectedMeal(e.target.value)}
          className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
        >
          <option value="all">All Meals</option>
          <option value="breakfast">Breakfast</option>
          <option value="lunch">Lunch</option>
          <option value="dinner">Dinner</option>
          <option value="snack">Snack</option>
        </select>
      </div>

      {/* Meals */}
      <div className="space-y-6">
        {(['breakfast', 'lunch', 'dinner', 'snack'] as const).map(
          (mealType) => {
            const mealEntries = filteredEntries.filter(
              (entry) => entry.mealType === mealType
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
                      {mealType}
                    </h3>
                    <div className="text-sm text-gray-600 dark:text-gray-400">
                      {total.calories} kcal • {total.protein}g protein •{' '}
                      {total.carbs}g carbs • {total.fat}g fat
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {mealEntries.length === 0 ? (
                    <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                      No {mealType} entries yet
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {mealEntries.map((entry) => (
                        <div
                          key={entry.id}
                          className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
                        >
                          <div className="flex-1">
                            <h4 className="font-medium text-gray-900 dark:text-white">
                              {entry.name}
                            </h4>
                            <p className="text-sm text-gray-600 dark:text-gray-400">
                              {entry.servingSize} • {entry.calories} kcal
                            </p>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
                            <span>{entry.protein}g protein</span>
                            <span>{entry.carbs}g carbs</span>
                            <span>{entry.fat}g fat</span>
                            <button
                              onClick={() => deleteEntry(entry.id)}
                              className="text-red-500 hover:text-red-700"
                            >
                              Remove
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
          onClose={() => setShowAddForm(false)}
          onAdd={addNutritionEntry}
        />
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
          {current} / {goal} {unit}
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

function AddFoodModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (entry: Omit<NutritionEntry, 'id' | 'timestamp'>) => void;
}) {
  const [formData, setFormData] = useState({
    name: '',
    calories: '',
    protein: '',
    carbs: '',
    fat: '',
    fiber: '',
    sugar: '',
    servingSize: '',
    mealType: 'breakfast' as const,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAdd({
      name: formData.name,
      calories: Number(formData.calories),
      protein: Number(formData.protein),
      carbs: Number(formData.carbs),
      fat: Number(formData.fat),
      fiber: Number(formData.fiber),
      sugar: Number(formData.sugar),
      servingSize: formData.servingSize,
      mealType: formData.mealType,
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full">
        <div className="p-6">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
            Add Food Entry
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Food Name
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, name: e.target.value }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Calories
                </label>
                <input
                  type="number"
                  value={formData.calories}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      calories: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Protein (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.protein}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      protein: e.target.value,
                    }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Carbs (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.carbs}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, carbs: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Fat (g)
                </label>
                <input
                  type="number"
                  step="0.1"
                  value={formData.fat}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, fat: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Serving Size
              </label>
              <input
                type="text"
                value={formData.servingSize}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    servingSize: e.target.value,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                placeholder="e.g., 100g, 1 cup, 1 slice"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Meal Type
              </label>
              <select
                value={formData.mealType}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    mealType: e.target.value as any,
                  }))
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
            </div>

            <div className="flex space-x-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
              >
                Add Food
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
