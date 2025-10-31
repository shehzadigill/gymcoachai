import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TextInput,
  Pressable,
  FlatList,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import {Card, Button} from '../../components/common/UI';
import apiClient from '../../services/api';
import {Food} from '../../types';
import {useTranslation} from 'react-i18next';
import FloatingSettingsButton from '../../components/common/FloatingSettingsButton';

interface ServingOption {
  name: string;
  weight: number;
  nutritionFacts: {
    calories: number;
    protein: number;
    total_carbs: number;
    total_fat: number;
    dietary_fiber?: number;
    total_sugars?: number;
    sodium?: number;
  };
}

interface ExtendedFood extends Food {
  brand?: string;
  commonServings?: ServingOption[];
  nutritionFacts?: {
    calories: number;
    protein: number;
    total_carbs: number;
    total_fat: number;
    dietary_fiber?: number;
    total_sugars?: number;
    sodium?: number;
  };
}

export default function NutritionEntryScreen({route, navigation}: any) {
  const {t} = useTranslation();
  const {date, mealType, mealId, editMode, mealData} = route.params || {};

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ExtendedFood[]>([]);
  const [selectedFood, setSelectedFood] = useState<ExtendedFood | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const [servingSize, setServingSize] = useState('');
  const [servingWeight, setServingWeight] = useState(100);
  const [customName, setCustomName] = useState('');

  // Load existing meal data when in edit mode
  useEffect(() => {
    if (editMode && mealId) {
      loadMealData();
    }
  }, [editMode, mealId]);

  const loadMealData = async () => {
    try {
      setLoading(true);
      console.log('loadMealData called with:', {
        editMode,
        mealId,
        mealData: !!mealData,
      });

      // Use meal data passed from navigation params
      if (mealData) {
        console.log(
          'Loading meal data for editing:',
          JSON.stringify(mealData, null, 2),
        );

        // Check if foods array exists and has items
        if (mealData.foods && mealData.foods.length > 0) {
          const firstFood = mealData.foods[0];
          console.log(
            'First food from meal:',
            JSON.stringify(firstFood, null, 2),
          );

          if (firstFood.food) {
            setSelectedFood(firstFood.food);
            setServingSize(firstFood.quantity?.toString() || '100');
            setServingWeight(firstFood.quantity || 100);
            console.log('Set selected food:', firstFood.food.name);
          } else {
            console.log('No food object found in first food item');
          }
        } else {
          console.log('No foods array or empty foods array in meal data');
        }

        setCustomName(mealData.name || '');
        console.log('Set custom name:', mealData.name);
      } else if (mealId) {
        // Fallback: try to get meal data via API if not passed
        console.log('No meal data passed, trying API call for mealId:', mealId);
        try {
          const meal = await apiClient.getMeal(mealId);
          console.log('Loaded meal data from API:', meal);

          if (meal && meal.foods?.length > 0) {
            const firstFood = meal.foods[0];
            if (firstFood.food) {
              setSelectedFood(firstFood.food);
              setServingSize(firstFood.quantity?.toString() || '100');
              setServingWeight(firstFood.quantity || 100);
            }
            setCustomName(meal.name || '');
          }
        } catch (apiError) {
          console.error('Error loading meal from API:', apiError);
          Alert.alert(
            'Error',
            'Failed to load meal data. The meal might not exist or there might be a network issue.',
          );
        }
      } else {
        console.log('No meal data or meal ID provided for edit mode');
      }
    } catch (error) {
      console.error('Error loading meal data:', error);
      Alert.alert(
        t('common.error'),
        t('common.errors.failed_to_load_meal_data'),
      );
    } finally {
      setLoading(false);
      console.log('loadMealData completed, loading set to false');
    }
  };

  const searchFoods = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      setSearching(true);
      const response = await apiClient.searchFoods(query);

      // The response might be wrapped in different structures
      const foods = response?.foods || response?.data || response || [];
      setSearchResults(foods);
    } catch (error) {
      console.error('Error searching foods:', error);
      Alert.alert(t('common.error'), t('common.errors.failed_to_search_foods'));
    } finally {
      setSearching(false);
    }
  };

  const selectFood = (food: ExtendedFood) => {
    setSelectedFood(food);
    setCustomName(food.name);

    // Set default serving size
    if (food.commonServings && food.commonServings.length > 0) {
      setServingSize(food.commonServings[0].name);
      setServingWeight(food.commonServings[0].weight);
    } else {
      setServingSize('100g');
      setServingWeight(100);
    }

    setSearchQuery('');
    setSearchResults([]);
  };

  const calculateNutrition = () => {
    if (!selectedFood) return null;

    let baseNutrition;

    if (selectedFood.commonServings && selectedFood.commonServings.length > 0) {
      const serving =
        selectedFood.commonServings.find(s => s.name === servingSize) ||
        selectedFood.commonServings[0];
      const multiplier = servingWeight / serving.weight;

      baseNutrition = {
        calories: Math.round(serving.nutritionFacts.calories * multiplier),
        protein:
          Math.round(serving.nutritionFacts.protein * multiplier * 10) / 10,
        carbs:
          Math.round(serving.nutritionFacts.total_carbs * multiplier * 10) / 10,
        fat:
          Math.round(serving.nutritionFacts.total_fat * multiplier * 10) / 10,
        fiber: serving.nutritionFacts.dietary_fiber
          ? Math.round(serving.nutritionFacts.dietary_fiber * multiplier * 10) /
            10
          : 0,
        sugar: serving.nutritionFacts.total_sugars
          ? Math.round(serving.nutritionFacts.total_sugars * multiplier * 10) /
            10
          : 0,
        sodium: serving.nutritionFacts.sodium
          ? Math.round(serving.nutritionFacts.sodium * multiplier * 10) / 10
          : 0,
      };
    } else {
      // Use food's base nutrition and calculate per gram
      const multiplier = servingWeight / (selectedFood.servingSize || 100);

      baseNutrition = {
        calories: Math.round(selectedFood.calories * multiplier),
        protein: Math.round((selectedFood.protein || 0) * multiplier * 10) / 10,
        carbs: Math.round((selectedFood.carbs || 0) * multiplier * 10) / 10,
        fat: Math.round((selectedFood.fat || 0) * multiplier * 10) / 10,
        fiber: selectedFood.fiber
          ? Math.round(selectedFood.fiber * multiplier * 10) / 10
          : 0,
        sugar: selectedFood.sugar
          ? Math.round(selectedFood.sugar * multiplier * 10) / 10
          : 0,
        sodium: selectedFood.sodium
          ? Math.round(selectedFood.sodium * multiplier * 10) / 10
          : 0,
      };
    }

    return baseNutrition;
  };

  const addMeal = async () => {
    if (!selectedFood || !customName.trim()) {
      Alert.alert(
        t('nutrition.errors.error'),
        t('nutrition.errors.select_food_and_name'),
      );
      return;
    }

    try {
      setLoading(true);

      const nutrition = calculateNutrition();
      if (!nutrition) {
        Alert.alert(
          t('nutrition.errors.error'),
          t('nutrition.errors.calculate_nutrition'),
        );
        return;
      }

      // Map meal types to backend format
      const mapMealTypeToEnum = (m: string) => {
        switch (m.toLowerCase()) {
          case 'breakfast':
            return 'Breakfast';
          case 'lunch':
            return 'Lunch';
          case 'dinner':
            return 'Dinner';
          case 'snack':
            return 'Snack';
          default:
            return 'Breakfast';
        }
      };

      const payload = {
        name: customName,
        meal_type: mapMealTypeToEnum(mealType),
        meal_date: date + 'T00:00:00Z',
        foods: [
          {
            food_id: selectedFood.id,
            quantity: servingWeight,
            unit: 'g',
          },
        ],
        notes: null,
      };

      let response;
      if (editMode && mealId) {
        console.log('Updating meal with payload:', payload);
        response = await apiClient.updateMeal(mealId, payload);
        console.log('Meal updated successfully:', response);
      } else {
        console.log('Creating meal with payload:', payload);
        response = await apiClient.createMeal(payload);
        console.log('Meal created successfully:', response);
      }

      Alert.alert(
        t('nutrition.success'),
        editMode ? t('nutrition.meal_updated') : t('nutrition.meal_added'),
        [
          {
            text: t('common.ok'),
            onPress: () => navigation.goBack(),
          },
        ],
      );
    } catch (error) {
      console.error('Error adding meal:', error);
      Alert.alert(
        t('nutrition.errors.error'),
        t('nutrition.errors.failed_to_add'),
      );
    } finally {
      setLoading(false);
    }
  };

  const nutrition = calculateNutrition();

  return (
    <SafeAreaView style={styles.container}>
      <FloatingSettingsButton />
      <ScrollView style={styles.content}>
        <Text style={styles.title}>
          {editMode ? t('nutrition.edit_meal') : t('nutrition.log_meal')}
        </Text>
        <Text style={styles.subtitle}>
          {t(`nutrition.meal_types.${mealType.toLowerCase()}`)} • {date}
        </Text>

        {!selectedFood && !editMode ? (
          <>
            <Card style={styles.searchCard}>
              <Text style={styles.sectionTitle}>
                {t('nutrition.search_food')}
              </Text>
              <TextInput
                style={styles.searchInput}
                placeholder={t('nutrition.search_placeholder')}
                value={searchQuery}
                onChangeText={setSearchQuery}
                onSubmitEditing={() => searchFoods(searchQuery)}
                returnKeyType="search"
              />
              <Button
                title={t('nutrition.search')}
                onPress={() => searchFoods(searchQuery)}
                loading={searching}
                disabled={!searchQuery.trim()}
              />
            </Card>

            {searching && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#3b82f6" />
                <Text style={styles.loadingText}>
                  {t('nutrition.searching_foods')}
                </Text>
              </View>
            )}

            {searchResults.length > 0 && (
              <Card style={styles.resultsCard}>
                <Text style={styles.sectionTitle}>
                  {t('nutrition.search_results')}
                </Text>
                <FlatList
                  data={searchResults}
                  keyExtractor={item => item.id}
                  renderItem={({item}) => (
                    <Pressable
                      style={styles.foodItem}
                      onPress={() => selectFood(item)}>
                      <Text style={styles.foodName}>{item.name}</Text>
                      {item.brand && (
                        <Text style={styles.foodBrand}>{item.brand}</Text>
                      )}
                      <Text style={styles.foodCalories}>
                        {item.calories || item.nutritionFacts?.calories || 0}{' '}
                        cal
                      </Text>
                    </Pressable>
                  )}
                  style={styles.foodList}
                />
              </Card>
            )}
          </>
        ) : selectedFood ? (
          <>
            <Card style={styles.selectedFoodCard}>
              <Text style={styles.sectionTitle}>
                {t('nutrition.selected_food')}
              </Text>
              <Text style={styles.selectedFoodName}>{selectedFood.name}</Text>
              {selectedFood.brand && (
                <Text style={styles.selectedFoodBrand}>
                  {selectedFood.brand}
                </Text>
              )}

              {!editMode && (
                <Pressable
                  style={styles.changeButton}
                  onPress={() => {
                    setSelectedFood(null);
                    setCustomName('');
                  }}>
                  <Text style={styles.changeButtonText}>
                    {t('nutrition.change_food')}
                  </Text>
                </Pressable>
              )}
            </Card>

            <Card style={styles.servingCard}>
              <Text style={styles.sectionTitle}>
                {t('nutrition.serving_size')}
              </Text>

              {selectedFood.commonServings &&
              selectedFood.commonServings.length > 0 ? (
                <View style={styles.servingOptions}>
                  {selectedFood.commonServings.map(serving => (
                    <Pressable
                      key={serving.name}
                      style={[
                        styles.servingOption,
                        servingSize === serving.name &&
                          styles.selectedServingOption,
                      ]}
                      onPress={() => {
                        setServingSize(serving.name);
                        setServingWeight(serving.weight);
                      }}>
                      <Text
                        style={[
                          styles.servingOptionText,
                          servingSize === serving.name &&
                            styles.selectedServingOptionText,
                        ]}>
                        {serving.name}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              ) : null}

              <View style={styles.customServing}>
                <Text style={styles.customServingLabel}>
                  {t('nutrition.custom_weight')}:
                </Text>
                <TextInput
                  style={styles.customServingInput}
                  value={servingWeight.toString()}
                  onChangeText={text => {
                    const weight = parseFloat(text) || 0;
                    setServingWeight(weight);
                  }}
                  keyboardType="numeric"
                  placeholder="100"
                />
              </View>
            </Card>

            <Card style={styles.mealNameCard}>
              <Text style={styles.sectionTitle}>
                {t('nutrition.meal_name')}
              </Text>
              <TextInput
                style={styles.mealNameInput}
                value={customName}
                onChangeText={setCustomName}
                placeholder={t('nutrition.enter_meal_name')}
              />
            </Card>

            {nutrition && (
              <Card style={styles.nutritionCard}>
                <Text style={styles.sectionTitle}>
                  {t('nutrition.nutrition_information')}
                </Text>
                <View style={styles.nutritionGrid}>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>
                      {nutrition.calories}
                    </Text>
                    <Text style={styles.nutritionLabel}>
                      {t('nutrition.calories')}
                    </Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>
                      {nutrition.protein}g
                    </Text>
                    <Text style={styles.nutritionLabel}>
                      {t('nutrition.protein')}
                    </Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>
                      {nutrition.carbs}g
                    </Text>
                    <Text style={styles.nutritionLabel}>
                      {t('nutrition.carbs')}
                    </Text>
                  </View>
                  <View style={styles.nutritionItem}>
                    <Text style={styles.nutritionValue}>{nutrition.fat}g</Text>
                    <Text style={styles.nutritionLabel}>
                      {t('nutrition.fat')}
                    </Text>
                  </View>
                  {nutrition.fiber > 0 && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>
                        {nutrition.fiber}g
                      </Text>
                      <Text style={styles.nutritionLabel}>
                        {t('nutrition.fiber')}
                      </Text>
                    </View>
                  )}
                  {nutrition.sugar > 0 && (
                    <View style={styles.nutritionItem}>
                      <Text style={styles.nutritionValue}>
                        {nutrition.sugar}g
                      </Text>
                      <Text style={styles.nutritionLabel}>
                        {t('nutrition.sugar')}
                      </Text>
                    </View>
                  )}
                </View>
              </Card>
            )}

            <View style={styles.actionButtons}>
              <Button
                title={
                  editMode
                    ? t('nutrition.update_meal')
                    : t('nutrition.add_meal')
                }
                onPress={addMeal}
                loading={loading}
                disabled={!customName.trim()}
                style={styles.addButton}
              />
            </View>
          </>
        ) : (
          // Edit mode loading state
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#3b82f6" />
            <Text style={styles.loadingText}>Loading meal data...</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 20,
    textAlign: 'center',
    textTransform: 'capitalize',
  },
  searchCard: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  loadingText: {
    marginTop: 8,
    fontSize: 16,
    color: '#666',
  },
  resultsCard: {
    marginBottom: 16,
    maxHeight: 300,
  },
  foodList: {
    maxHeight: 250,
  },
  foodItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  foodName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  foodBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  foodCalories: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '500',
  },
  selectedFoodCard: {
    marginBottom: 16,
  },
  selectedFoodName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  selectedFoodBrand: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  changeButton: {
    backgroundColor: '#f3f4f6',
    padding: 8,
    borderRadius: 6,
    alignSelf: 'flex-start',
  },
  changeButtonText: {
    color: '#3b82f6',
    fontSize: 14,
    fontWeight: '500',
  },
  servingCard: {
    marginBottom: 16,
  },
  servingOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 16,
  },
  servingOption: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    backgroundColor: '#f3f4f6',
    marginRight: 8,
    marginBottom: 8,
  },
  selectedServingOption: {
    backgroundColor: '#3b82f6',
  },
  servingOptionText: {
    fontSize: 14,
    color: '#333',
  },
  selectedServingOptionText: {
    color: '#fff',
  },
  customServing: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  customServingLabel: {
    fontSize: 16,
    color: '#333',
    marginRight: 12,
  },
  customServingInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 6,
    padding: 8,
    fontSize: 16,
    width: 80,
    textAlign: 'center',
    backgroundColor: '#fff',
  },
  mealNameCard: {
    marginBottom: 16,
  },
  mealNameInput: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: '#fff',
  },
  nutritionCard: {
    marginBottom: 20,
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  nutritionItem: {
    alignItems: 'center',
    width: '30%',
    marginBottom: 12,
  },
  nutritionValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  actionButtons: {
    paddingBottom: 20,
  },
  addButton: {
    backgroundColor: '#10b981',
  },
});
