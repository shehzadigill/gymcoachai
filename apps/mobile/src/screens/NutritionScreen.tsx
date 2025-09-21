import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, RefreshControl, TextInput, Modal } from 'react-native';
import { getCurrentUser } from 'aws-amplify/auth';
import { useApi, apiFetch } from '../hooks/useApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

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

export function NutritionScreen() {
  const [user, setUser] = useState<any>(null);
  const [entries, setEntries] = useState<NutritionEntry[]>([]);
  const [dailyNutrition, setDailyNutrition] = useState<DailyNutrition | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMeal, setSelectedMeal] = useState<string>('all');

  useEffect(() => {
    loadUser();
    fetchNutritionData();
  }, [selectedDate]);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const fetchNutritionData = async () => {
    try {
      const userId = user?.userId || 'current-user';
      const today = new Date().toISOString().split('T')[0];
      const response = await apiFetch<{ statusCode: number; body: any[] }>(`/api/users/${userId}/meals/date/${today}`);
      
      if (response.statusCode === 200) {
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
        // Fallback to mock data
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
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchNutritionData();
    setRefreshing(false);
  };

  const addNutritionEntry = async (entry: Omit<NutritionEntry, 'id' | 'timestamp'>) => {
    try {
      const userId = user?.userId || 'current-user';
      
      const response = await apiFetch(`/api/users/${userId}/meals`, {
        method: 'POST',
        body: JSON.stringify({
          food_name: entry.name,
          calories: entry.calories,
          protein: entry.protein,
          carbs: entry.carbs,
          fat: entry.fat,
          fiber: entry.fiber,
          sugar: entry.sugar,
          serving_size: entry.servingSize,
          meal_type: entry.mealType,
        }),
      });

      if (response.statusCode === 200 || response.statusCode === 201) {
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
      const userId = user?.userId || 'current-user';
      
      await apiFetch(`/api/users/${userId}/meals/${id}`, {
        method: 'DELETE',
      });
      
      setEntries((prev) => prev.filter((entry) => entry.id !== id));
    } catch (e: any) {
      console.error('Failed to delete nutrition entry:', e);
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

  if (!dailyNutrition) {
    return <LoadingSpinner message="Loading nutrition data..." />;
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Nutrition</Text>
            <Text className="text-gray-600">Track your daily nutrition intake</Text>
          </View>
          <View className="flex-row space-x-2">
            <TouchableOpacity
              onPress={() => setShowAddForm(true)}
              className="bg-blue-600 rounded-lg px-4 py-2"
            >
              <Text className="text-white font-semibold">+ Add Food</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Daily Overview */}
        <View className="flex-row flex-wrap -mx-2 mb-6">
          <View className="w-1/2 px-2">
            <View className="bg-white rounded-lg border border-gray-200 p-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">🔥</Text>
                  <View>
                    <Text className="text-sm font-medium text-gray-600">Calories</Text>
                    <Text className="text-2xl font-semibold text-gray-900">
                      {dailyNutrition.calories} / {dailyNutrition.caloriesGoal}
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-600">
                  {Math.round((dailyNutrition.calories / dailyNutrition.caloriesGoal) * 100)}%
                </Text>
              </View>
              <View className="w-full bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-blue-600 h-2 rounded-full"
                  style={{ width: `${Math.min((dailyNutrition.calories / dailyNutrition.caloriesGoal) * 100, 100)}%` }}
                />
              </View>
            </View>
          </View>
          <View className="w-1/2 px-2">
            <View className="bg-white rounded-lg border border-gray-200 p-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">🥩</Text>
                  <View>
                    <Text className="text-sm font-medium text-gray-600">Protein</Text>
                    <Text className="text-2xl font-semibold text-gray-900">
                      {dailyNutrition.protein}g
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-600">
                  {Math.round((dailyNutrition.protein / dailyNutrition.proteinGoal) * 100)}%
                </Text>
              </View>
              <View className="w-full bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-green-600 h-2 rounded-full"
                  style={{ width: `${Math.min((dailyNutrition.protein / dailyNutrition.proteinGoal) * 100, 100)}%` }}
                />
              </View>
            </View>
          </View>
          <View className="w-1/2 px-2">
            <View className="bg-white rounded-lg border border-gray-200 p-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">🍞</Text>
                  <View>
                    <Text className="text-sm font-medium text-gray-600">Carbs</Text>
                    <Text className="text-2xl font-semibold text-gray-900">
                      {dailyNutrition.carbs}g
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-600">
                  {Math.round((dailyNutrition.carbs / dailyNutrition.carbsGoal) * 100)}%
                </Text>
              </View>
              <View className="w-full bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-orange-600 h-2 rounded-full"
                  style={{ width: `${Math.min((dailyNutrition.carbs / dailyNutrition.carbsGoal) * 100, 100)}%` }}
                />
              </View>
            </View>
          </View>
          <View className="w-1/2 px-2">
            <View className="bg-white rounded-lg border border-gray-200 p-4">
              <View className="flex-row items-center justify-between mb-2">
                <View className="flex-row items-center">
                  <Text className="text-2xl mr-3">🥑</Text>
                  <View>
                    <Text className="text-sm font-medium text-gray-600">Fat</Text>
                    <Text className="text-2xl font-semibold text-gray-900">
                      {dailyNutrition.fat}g
                    </Text>
                  </View>
                </View>
                <Text className="text-sm text-gray-600">
                  {Math.round((dailyNutrition.fat / dailyNutrition.fatGoal) * 100)}%
                </Text>
              </View>
              <View className="w-full bg-gray-200 rounded-full h-2">
                <View 
                  className="bg-purple-600 h-2 rounded-full"
                  style={{ width: `${Math.min((dailyNutrition.fat / dailyNutrition.fatGoal) * 100, 100)}%` }}
                />
              </View>
            </View>
          </View>
        </View>

        {/* Water Intake */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Water Intake
          </Text>
          <View className="flex-row items-center space-x-4">
            <View className="flex-1">
              <View className="flex-row justify-between text-sm text-gray-600 mb-2">
                <Text className="text-sm text-gray-600">
                  {dailyNutrition.water} / {dailyNutrition.waterGoal} glasses
                </Text>
                <Text className="text-sm text-gray-600">
                  {Math.round((dailyNutrition.water / dailyNutrition.waterGoal) * 100)}%
                </Text>
              </View>
              <View className="w-full bg-gray-200 rounded-full h-3">
                <View 
                  className="bg-blue-500 h-3 rounded-full"
                  style={{
                    width: `${Math.min((dailyNutrition.water / dailyNutrition.waterGoal) * 100, 100)}%`,
                  }}
                />
              </View>
            </View>
            <TouchableOpacity className="bg-blue-500 rounded-lg px-3 py-1">
              <Text className="text-white text-sm font-medium">+1 Glass</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Search and Filter */}
        <View className="flex-row space-x-4 mb-6">
          <View className="flex-1">
            <TextInput
              placeholder="Search foods..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
            />
          </View>
          <TouchableOpacity className="px-3 py-2 border border-gray-300 rounded-lg bg-white">
            <Text className="text-gray-700">Filter</Text>
          </TouchableOpacity>
        </View>

        {/* Meals */}
        <View className="space-y-6">
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
                <View
                  key={mealType}
                  className="bg-white rounded-lg border border-gray-200"
                >
                  <View className="p-4 border-b border-gray-200">
                    <View className="flex-row justify-between items-center">
                      <Text className="text-lg font-semibold text-gray-900 capitalize">
                        {mealType}
                      </Text>
                      <Text className="text-sm text-gray-600">
                        {total.calories} kcal • {total.protein}g protein •{' '}
                        {total.carbs}g carbs • {total.fat}g fat
                      </Text>
                    </View>
                  </View>
                  <View className="p-4">
                    {mealEntries.length === 0 ? (
                      <Text className="text-gray-500 text-center py-4">
                        No {mealType} entries yet
                      </Text>
                    ) : (
                      <View className="space-y-3">
                        {mealEntries.map((entry) => (
                          <View
                            key={entry.id}
                            className="flex-row justify-between items-center p-3 bg-gray-50 rounded-lg"
                          >
                            <View className="flex-1">
                              <Text className="font-medium text-gray-900">
                                {entry.name}
                              </Text>
                              <Text className="text-sm text-gray-600">
                                {entry.servingSize} • {entry.calories} kcal
                              </Text>
                            </View>
                            <View className="flex-row items-center space-x-4">
                              <Text className="text-sm text-gray-600">{entry.protein}g protein</Text>
                              <Text className="text-sm text-gray-600">{entry.carbs}g carbs</Text>
                              <Text className="text-sm text-gray-600">{entry.fat}g fat</Text>
                              <TouchableOpacity
                                onPress={() => deleteEntry(entry.id)}
                                className="text-red-500"
                              >
                                <Text className="text-red-500">Remove</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </View>
                </View>
              );
            }
          )}
        </View>

        {/* Add Food Modal */}
        <Modal
          visible={showAddForm}
          animationType="slide"
          presentationStyle="pageSheet"
        >
          <AddFoodModal
            onClose={() => setShowAddForm(false)}
            onAdd={addNutritionEntry}
          />
        </Modal>
      </View>
    </ScrollView>
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

  const handleSubmit = () => {
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
    <View className="flex-1 bg-white">
      <View className="p-6 border-b border-gray-200">
        <View className="flex-row justify-between items-center">
          <Text className="text-xl font-semibold text-gray-900">
            Add Food Entry
          </Text>
          <TouchableOpacity onPress={onClose}>
            <Text className="text-2xl">✕</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView className="flex-1 p-6">
        <View className="space-y-4">
          <View>
            <Text className="block text-sm font-medium text-gray-700 mb-1">
              Food Name
            </Text>
            <TextInput
              placeholder="Enter food name"
              value={formData.name}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, name: text }))}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
            />
          </View>

          <View className="flex-row space-x-4">
            <View className="flex-1">
              <Text className="block text-sm font-medium text-gray-700 mb-1">
                Calories
              </Text>
              <TextInput
                placeholder="0"
                value={formData.calories}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, calories: text }))}
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
            </View>
            <View className="flex-1">
              <Text className="block text-sm font-medium text-gray-700 mb-1">
                Protein (g)
              </Text>
              <TextInput
                placeholder="0"
                value={formData.protein}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, protein: text }))}
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
            </View>
          </View>

          <View className="flex-row space-x-4">
            <View className="flex-1">
              <Text className="block text-sm font-medium text-gray-700 mb-1">
                Carbs (g)
              </Text>
              <TextInput
                placeholder="0"
                value={formData.carbs}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, carbs: text }))}
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
            </View>
            <View className="flex-1">
              <Text className="block text-sm font-medium text-gray-700 mb-1">
                Fat (g)
              </Text>
              <TextInput
                placeholder="0"
                value={formData.fat}
                onChangeText={(text) => setFormData((prev) => ({ ...prev, fat: text }))}
                keyboardType="numeric"
                className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
              />
            </View>
          </View>

          <View>
            <Text className="block text-sm font-medium text-gray-700 mb-1">
              Serving Size
            </Text>
            <TextInput
              placeholder="e.g., 100g, 1 cup, 1 slice"
              value={formData.servingSize}
              onChangeText={(text) => setFormData((prev) => ({ ...prev, servingSize: text }))}
              className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
            />
          </View>

          <View>
            <Text className="block text-sm font-medium text-gray-700 mb-1">
              Meal Type
            </Text>
            <View className="flex-row space-x-2">
              {['breakfast', 'lunch', 'dinner', 'snack'].map((meal) => (
                <TouchableOpacity
                  key={meal}
                  onPress={() => setFormData((prev) => ({ ...prev, mealType: meal as any }))}
                  className={`px-3 py-2 rounded-lg ${
                    formData.mealType === meal ? 'bg-blue-600' : 'bg-gray-100'
                  }`}
                >
                  <Text className={`text-sm font-medium ${
                    formData.mealType === meal ? 'text-white' : 'text-gray-700'
                  }`}>
                    {meal.charAt(0).toUpperCase() + meal.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        <View className="flex-row space-x-3 mt-6">
          <TouchableOpacity
            onPress={handleSubmit}
            className="flex-1 bg-blue-600 rounded-lg py-3"
          >
            <Text className="text-white font-semibold text-center">Add Food</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={onClose}
            className="px-4 py-3 border border-gray-300 rounded-lg"
          >
            <Text className="text-gray-700 font-semibold">Cancel</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}
