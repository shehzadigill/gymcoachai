import React, {useEffect, useState} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  TextInput,
  Modal,
} from 'react-native';
import {useFocusEffect} from '@react-navigation/native';
import {Card, LoadingSpinner, Button} from '../components/common/UI';
import {useAuth} from '../contexts/AuthContext';
import apiClient from '../services/api';
import notificationService from '../services/notifications';
import {useTranslation} from 'react-i18next';
import FloatingSettingsButton from '../components/common/FloatingSettingsButton';

export default function NutritionScreen({navigation}: any) {
  const {t} = useTranslation();
  const {user} = useAuth();
  const [todaysMeals, setTodaysMeals] = useState<any>(null);
  const [nutritionStats, setNutritionStats] = useState<any>(null);
  const [waterIntake, setWaterIntake] = useState<any>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Custom meal modal state
  const [showCustomMealModal, setShowCustomMealModal] = useState(false);
  const [customMealName, setCustomMealName] = useState('');
  const [customMealCalories, setCustomMealCalories] = useState('');
  const [customMealProtein, setCustomMealProtein] = useState('');
  const [customMealCarbs, setCustomMealCarbs] = useState('');
  const [customMealFat, setCustomMealFat] = useState('');
  const [customMealType, setCustomMealType] = useState('breakfast');
  const [savingCustomMeal, setSavingCustomMeal] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadNutritionData();
  }, []);

  // Reload data when screen comes into focus (e.g., returning from meal entry)
  useFocusEffect(
    React.useCallback(() => {
      loadNutritionData();
    }, []),
  );
  console.log('NutritionScreen: Rendering with state:', {
    nutritionStats,
  });
  const loadNutritionData = async () => {
    try {
      setLoading(true);

      const [mealsData, statsData, waterData, profileData] =
        await Promise.allSettled([
          apiClient.getMealsByDate(today),
          apiClient.getNutritionStats(),
          apiClient.getWater(today),
          apiClient.getUserProfile(user?.id || ''),
        ]);

      console.log('NutritionScreen: Meals data response:', mealsData);
      console.log('NutritionScreen: Nutrition stats response:', statsData);
      console.log('NutritionScreen: Water intake response:', waterData);
      if (mealsData.status === 'fulfilled') {
        console.log('NutritionScreen: Meals value:', mealsData.value);
        setTodaysMeals(mealsData.value);
      } else {
        console.log('NutritionScreen: Meals request failed:', mealsData.reason);
        setTodaysMeals(null);
      }

      if (statsData.status === 'fulfilled') {
        console.log('NutritionScreen: Nutrition stats value:', statsData.value);
        setNutritionStats(statsData.value);
      } else {
        console.log(
          'NutritionScreen: Nutrition stats request failed:',
          statsData.reason,
        );
        // Calculate stats from meal data if API stats are not available
        if (mealsData.status === 'fulfilled' && mealsData.value?.meals) {
          const calculatedStats = calculateStatsFromMeals(
            mealsData.value.meals,
          );
          console.log(
            'NutritionScreen: Calculated stats from meals:',
            calculatedStats,
          );
          setNutritionStats(calculatedStats);
        } else {
          setNutritionStats(null);
        }
      }

      if (waterData.status === 'fulfilled') {
        console.log('NutritionScreen: Water intake value:', waterData.value);
        setWaterIntake(waterData.value);
      } else {
        console.log(
          'NutritionScreen: Water intake request failed:',
          waterData.reason,
        );
        setWaterIntake(null);
      }

      if (profileData.status === 'fulfilled') {
        console.log('NutritionScreen: User profile value:', profileData.value);
        setUserProfile(profileData.value);
      } else {
        console.log(
          'NutritionScreen: User profile request failed (this is expected if API is not implemented):',
          profileData.reason,
        );
        setUserProfile(null);
      }
    } catch (error) {
      console.error('Error loading nutrition data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const calculateStatsFromMeals = (meals: any[]) => {
    if (!meals || meals.length === 0) {
      return {
        today_calories: 0,
        today_protein: 0,
        today_carbs: 0,
        today_fat: 0,
      };
    }

    const totals = meals.reduce(
      (acc, meal) => {
        acc.today_calories += meal.total_calories || 0;
        acc.today_protein += meal.total_protein || 0;
        acc.today_carbs += meal.total_carbs || 0;
        acc.today_fat += meal.total_fat || 0;
        return acc;
      },
      {
        today_calories: 0,
        today_protein: 0,
        today_carbs: 0,
        today_fat: 0,
      },
    );

    return totals;
  };

  // Helper functions to get goals from user profile preferences
  const getCalorieGoal = () => {
    const profileData = (userProfile as any)?.body || userProfile || {};
    return profileData?.preferences?.dailyGoals?.calories || 2000;
  };

  const getProteinGoal = () => {
    const profileData = (userProfile as any)?.body || userProfile || {};
    return profileData?.preferences?.dailyGoals?.protein || 150;
  };

  const getCarbsGoal = () => {
    const profileData = (userProfile as any)?.body || userProfile || {};
    return profileData?.preferences?.dailyGoals?.carbs || 200;
  };

  const getFatGoal = () => {
    const profileData = (userProfile as any)?.body || userProfile || {};
    return profileData?.preferences?.dailyGoals?.fat || 67;
  };

  const getWaterGoal = () => {
    const profileData = (userProfile as any)?.body || userProfile || {};
    return profileData?.preferences?.dailyGoals?.water || 8;
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadNutritionData();
  };

  const addMeal = (mealType: string) => {
    navigation.navigate('NutritionEntry', {
      date: today,
      mealType,
    });
  };

  const openCustomMealModal = (mealType: string) => {
    setCustomMealType(mealType);
    setCustomMealName('');
    setCustomMealCalories('');
    setCustomMealProtein('');
    setCustomMealCarbs('');
    setCustomMealFat('');
    setShowCustomMealModal(true);
  };

  const saveCustomMeal = async () => {
    if (!customMealName.trim()) {
      Alert.alert('Error', 'Please enter a meal name');
      return;
    }

    if (!customMealCalories.trim()) {
      Alert.alert('Error', 'Please enter calories');
      return;
    }

    setSavingCustomMeal(true);

    try {
      // Map meal type to proper capitalization like the web app
      const mapMealTypeToEnum = (m: string) => {
        switch (m) {
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

      const mealData = {
        name: customMealName.trim(),
        meal_type: mapMealTypeToEnum(customMealType),
        meal_date: today + 'T00:00:00Z',
        foods: [], // Empty foods array for custom meals
        notes: 'Custom meal entry',
        // Custom nutrition values for when foods is empty
        custom_nutrition: {
          calories: parseFloat(customMealCalories) || 0,
          protein: parseFloat(customMealProtein) || 0,
          total_carbs: parseFloat(customMealCarbs) || 0,
          total_fat: parseFloat(customMealFat) || 0,
          dietary_fiber: 0, // Not collected in mobile form
          total_sugars: 0, // Not collected in mobile form
          sodium: 0, // Not collected in mobile form
        },
      };

      await apiClient.createMeal(mealData);

      Alert.alert('Success', 'Custom meal added successfully!', [
        {
          text: 'OK',
          onPress: () => {
            setShowCustomMealModal(false);
            loadNutritionData(); // Refresh the data
          },
        },
      ]);
    } catch (error) {
      console.error('Error saving custom meal:', error);
      Alert.alert('Error', 'Failed to save custom meal. Please try again.');
    } finally {
      setSavingCustomMeal(false);
    }
  };

  const editMeal = (meal: any) => {
    navigation.navigate('NutritionEntry', {
      date: today,
      mealType: meal.meal_type,
      mealId: meal.id,
      editMode: true,
      mealData: meal,
    });
  };

  const deleteMeal = async (mealId: string) => {
    Alert.alert('Delete Meal', 'Are you sure you want to delete this meal?', [
      {
        text: 'Cancel',
        style: 'cancel',
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await apiClient.deleteMeal(mealId);
            // Reload the nutrition data to reflect the changes
            loadNutritionData();
          } catch (error) {
            console.error('Error deleting meal:', error);
            Alert.alert('Error', 'Failed to delete meal. Please try again.');
          }
        },
      },
    ]);
  };

  const addWater = async () => {
    try {
      const currentGlasses = waterIntake?.glasses || 0;
      const newGlasses = currentGlasses + 1;

      await apiClient.setWater(today, newGlasses);
      setWaterIntake({...waterIntake, glasses: newGlasses});

      // Send progress notification
      if (newGlasses >= getWaterGoal()) {
        notificationService.sendProgressNotification(
          '💧 Hydration Goal Achieved!',
          "Great job! You've reached your daily water intake goal.",
        );
      }
    } catch (error) {
      console.error('Error updating water intake:', error);
      Alert.alert('Error', 'Failed to update water intake');
    }
  };

  const configureNotifications = async () => {
    try {
      const settings = await notificationService.getNotificationSettings();

      Alert.alert(
        'Nutrition Reminders',
        'Would you like to receive reminders to log your meals?',
        [
          {
            text: 'No',
            style: 'cancel',
          },
          {
            text: 'Yes',
            onPress: async () => {
              const newSettings = {
                ...settings,
                nutritionReminders: true,
                nutritionTimes: ['08:00', '13:00', '19:00'], // Default meal times
              };

              await notificationService.saveNotificationSettings(newSettings);
              Alert.alert('Success', 'Nutrition reminders have been enabled!');
            },
          },
        ],
      );
    } catch (error) {
      console.error('Error configuring notifications:', error);
    }
  };

  const getMealTypeEmoji = (type: string) => {
    const emojis: Record<string, string> = {
      breakfast: '🌅',
      lunch: '☀️',
      dinner: '🌙',
      snack: '🍎',
    };
    return emojis[type] || '🍽️';
  };

  if (loading && !todaysMeals) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FloatingSettingsButton />
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Nutrition</Text>
          <Text style={styles.subtitle}>{new Date().toLocaleDateString()}</Text>
        </View>

        {/* Daily Summary */}
        <Card style={styles.summaryCard}>
          <Text style={styles.cardTitle}>Today's Summary</Text>

          {/* Nutrition Cards with Progress Bars */}
          <View style={styles.nutritionGrid}>
            {/* Calories */}
            <View style={[styles.nutritionCard, styles.caloriesCard]}>
              <View style={styles.nutritionCardHeader}>
                <Text style={styles.nutritionIcon}>🔥</Text>
                <Text style={styles.nutritionPercentage}>
                  {Math.round(
                    ((nutritionStats?.today_calories ||
                      nutritionStats?.consumed?.calories ||
                      0) /
                      getCalorieGoal()) *
                      100,
                  )}
                  %
                </Text>
              </View>
              <Text style={styles.nutritionLabel}>
                {t('nutrition.calories')}
              </Text>
              <Text style={styles.nutritionValue}>
                {Math.round(
                  nutritionStats?.today_calories ||
                    nutritionStats?.consumed?.calories ||
                    0,
                )}{' '}
                / {getCalorieGoal()} kcal
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    styles.caloriesProgress,
                    {
                      width: `${Math.min(
                        ((nutritionStats?.today_calories ||
                          nutritionStats?.consumed?.calories ||
                          0) /
                          getCalorieGoal()) *
                          100,
                        100,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Protein */}
            <View style={[styles.nutritionCard, styles.proteinCard]}>
              <View style={styles.nutritionCardHeader}>
                <Text style={styles.nutritionIcon}>🎯</Text>
                <Text style={styles.nutritionPercentage}>
                  {Math.round(
                    ((nutritionStats?.today_protein ||
                      nutritionStats?.consumed?.protein ||
                      0) /
                      getProteinGoal()) *
                      100,
                  )}
                  %
                </Text>
              </View>
              <Text style={styles.nutritionLabel}>
                {t('nutrition.protein')}
              </Text>
              <Text style={styles.nutritionValue}>
                {Math.round(
                  nutritionStats?.today_protein ||
                    nutritionStats?.consumed?.protein ||
                    0,
                )}{' '}
                / {getProteinGoal()} g
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    styles.proteinProgress,
                    {
                      width: `${Math.min(
                        ((nutritionStats?.today_protein ||
                          nutritionStats?.consumed?.protein ||
                          0) /
                          getProteinGoal()) *
                          100,
                        100,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Carbs */}
            <View style={[styles.nutritionCard, styles.carbsCard]}>
              <View style={styles.nutritionCardHeader}>
                <Text style={styles.nutritionIcon}>🍎</Text>
                <Text style={styles.nutritionPercentage}>
                  {Math.round(
                    ((nutritionStats?.today_carbs ||
                      nutritionStats?.consumed?.carbs ||
                      0) /
                      getCarbsGoal()) *
                      100,
                  )}
                  %
                </Text>
              </View>
              <Text style={styles.nutritionLabel}>{t('nutrition.carbs')}</Text>
              <Text style={styles.nutritionValue}>
                {Math.round(
                  nutritionStats?.today_carbs ||
                    nutritionStats?.consumed?.carbs ||
                    0,
                )}{' '}
                / {getCarbsGoal()} g
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    styles.carbsProgress,
                    {
                      width: `${Math.min(
                        ((nutritionStats?.today_carbs ||
                          nutritionStats?.consumed?.carbs ||
                          0) /
                          getCarbsGoal()) *
                          100,
                        100,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>

            {/* Fat */}
            <View style={[styles.nutritionCard, styles.fatCard]}>
              <View style={styles.nutritionCardHeader}>
                <Text style={styles.nutritionIcon}>📈</Text>
                <Text style={styles.nutritionPercentage}>
                  {Math.round(
                    ((nutritionStats?.today_fat ||
                      nutritionStats?.consumed?.fat ||
                      0) /
                      getFatGoal()) *
                      100,
                  )}
                  %
                </Text>
              </View>
              <Text style={styles.nutritionLabel}>{t('nutrition.fat')}</Text>
              <Text style={styles.nutritionValue}>
                {Math.round(
                  nutritionStats?.today_fat ||
                    nutritionStats?.consumed?.fat ||
                    0,
                )}{' '}
                / {getFatGoal()} g
              </Text>
              <View style={styles.progressBarContainer}>
                <View
                  style={[
                    styles.progressBar,
                    styles.fatProgress,
                    {
                      width: `${Math.min(
                        ((nutritionStats?.today_fat ||
                          nutritionStats?.consumed?.fat ||
                          0) /
                          getFatGoal()) *
                          100,
                        100,
                      )}%`,
                    },
                  ]}
                />
              </View>
            </View>
          </View>
        </Card>

        {/* Water Intake */}
        <Card style={styles.waterCard}>
          <View style={styles.waterHeader}>
            <Text style={styles.cardTitle}>💧 Water Intake</Text>
            <TouchableOpacity onPress={addWater} style={styles.addWaterButton}>
              <Text style={styles.addWaterText}>+1 Glass</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.waterProgress}>
            <Text style={styles.waterText}>
              {waterIntake?.glasses || 0} / {getWaterGoal()} glasses today
            </Text>
            <View style={styles.waterGlasses}>
              {Array.from({length: getWaterGoal()}).map((_, index) => (
                <Text
                  key={index}
                  style={[
                    styles.waterGlass,
                    index < (waterIntake?.glasses || 0) &&
                      styles.waterGlassFilled,
                  ]}>
                  💧
                </Text>
              ))}
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title={t('nutrition.setup_meal_reminders')}
            onPress={configureNotifications}
            variant="outline"
            style={styles.reminderButton}
          />
        </View>

        {/* Meals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('nutrition.todays_meals')}</Text>

          {['breakfast', 'lunch', 'dinner', 'snack'].map(mealType => {
            const mealsForType =
              todaysMeals?.meals?.filter(
                (m: any) =>
                  m.meal_type?.toLowerCase() === mealType.toLowerCase(),
              ) || [];

            return (
              <Card key={mealType} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <View style={styles.mealTitleContainer}>
                    <Text style={styles.mealEmoji}>
                      {getMealTypeEmoji(mealType)}
                    </Text>
                    <Text style={styles.mealTitle}>
                      {t(`nutrition.meal_types.${mealType}`)}
                    </Text>
                    {mealsForType.length > 0 && (
                      <Text style={styles.mealCount}>
                        ({mealsForType.length})
                      </Text>
                    )}
                  </View>
                  <View style={styles.mealActions}>
                    <TouchableOpacity
                      onPress={() => openCustomMealModal(mealType)}
                      style={styles.addCustomMealButton}>
                      <Text style={styles.addCustomMealText}>
                        {t('nutrition.custom')}
                      </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => addMeal(mealType)}
                      style={styles.addMealButton}>
                      <Text style={styles.addMealText}>
                        {t('nutrition.add')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {mealsForType.length > 0 ? (
                  <View style={styles.mealContent}>
                    {mealsForType.map((meal: any, index: number) => (
                      <TouchableOpacity
                        key={meal.id}
                        style={[
                          styles.mealItem,
                          index > 0 && styles.mealItemBorder,
                        ]}
                        onPress={() => editMeal(meal)}>
                        <View style={styles.mealItemHeader}>
                          <Text style={styles.mealName}>{meal.name}</Text>
                          <View style={styles.mealActions}>
                            <Text style={styles.mealCalories}>
                              {Math.round(meal.total_calories || 0)} cal
                            </Text>
                            <TouchableOpacity
                              onPress={e => {
                                e.stopPropagation();
                                deleteMeal(meal.id);
                              }}
                              style={styles.deleteButton}>
                              <Text style={styles.deleteButtonText}>×</Text>
                            </TouchableOpacity>
                          </View>
                        </View>
                        {meal.foods && meal.foods.length > 0 && (
                          <View style={styles.foodList}>
                            {meal.foods
                              .slice(0, 2)
                              .map((food: any, foodIndex: number) => (
                                <Text key={foodIndex} style={styles.foodItem}>
                                  • {food.food?.name} ({food.quantity}{' '}
                                  {food.unit})
                                </Text>
                              ))}
                            {meal.foods.length > 2 && (
                              <Text style={styles.moreFoods}>
                                +{meal.foods.length - 2} more items
                              </Text>
                            )}
                          </View>
                        )}
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.emptyMeal}>
                    {t('nutrition.no_meal_logged', {
                      mealType: t(`nutrition.meal_types.${mealType}`),
                    })}
                  </Text>
                )}
              </Card>
            );
          })}
        </View>
      </ScrollView>

      {/* Custom Meal Modal */}
      <Modal
        visible={showCustomMealModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCustomMealModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {t('nutrition.add_custom_meal')}
              </Text>
              <TouchableOpacity
                onPress={() => setShowCustomMealModal(false)}
                style={styles.closeButton}>
                <Text style={styles.closeButtonText}>×</Text>
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.modalContent}>
              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('nutrition.meal_name')} *</Text>
                <TextInput
                  style={styles.textInput}
                  value={customMealName}
                  onChangeText={setCustomMealName}
                  placeholder={t('nutrition.enter_meal_name')}
                  placeholderTextColor="#9ca3af"
                />
              </View>

              <View style={styles.formGroup}>
                <Text style={styles.label}>{t('nutrition.meal_type')}</Text>
                <View style={styles.mealTypeContainer}>
                  {['breakfast', 'lunch', 'dinner', 'snack'].map(type => (
                    <TouchableOpacity
                      key={type}
                      style={[
                        styles.mealTypeButton,
                        customMealType === type && styles.selectedMealType,
                      ]}
                      onPress={() => setCustomMealType(type)}>
                      <Text
                        style={[
                          styles.mealTypeText,
                          customMealType === type &&
                            styles.selectedMealTypeText,
                        ]}>
                        {getMealTypeEmoji(type)}{' '}
                        {t(`nutrition.meal_types.${type}`)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <View style={styles.nutritionInputs}>
                <View style={styles.nutritionInputRow}>
                  <View style={styles.nutritionInput}>
                    <Text style={styles.label}>
                      {t('nutrition.calories')} *
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={customMealCalories}
                      onChangeText={setCustomMealCalories}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.nutritionInput}>
                    <Text style={styles.label}>
                      {t('nutrition.protein')} (g)
                    </Text>
                    <TextInput
                      style={styles.textInput}
                      value={customMealProtein}
                      onChangeText={setCustomMealProtein}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <View style={styles.nutritionInputRow}>
                  <View style={styles.nutritionInput}>
                    <Text style={styles.label}>{t('nutrition.carbs')} (g)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customMealCarbs}
                      onChangeText={setCustomMealCarbs}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                  <View style={styles.nutritionInput}>
                    <Text style={styles.label}>{t('nutrition.fat')} (g)</Text>
                    <TextInput
                      style={styles.textInput}
                      value={customMealFat}
                      onChangeText={setCustomMealFat}
                      placeholder="0"
                      placeholderTextColor="#9ca3af"
                      keyboardType="numeric"
                    />
                  </View>
                </View>
              </View>
            </ScrollView>

            <View style={styles.modalActions}>
              <Button
                title={t('common.cancel')}
                variant="outline"
                onPress={() => setShowCustomMealModal(false)}
                style={styles.cancelButton}
              />
              <Button
                title={
                  savingCustomMeal
                    ? t('common.saving')
                    : t('nutrition.add_meal')
                }
                onPress={saveCustomMeal}
                disabled={savingCustomMeal}
                style={styles.saveButton}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  summaryCard: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  macroRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  macroItem: {
    alignItems: 'center',
  },
  macroValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  macroLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  waterCard: {
    marginHorizontal: 20,
    marginBottom: 16,
  },
  waterHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addWaterButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addWaterText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  waterProgress: {
    alignItems: 'center',
  },
  waterText: {
    fontSize: 16,
    color: '#374151',
    marginBottom: 8,
  },
  waterGlasses: {
    flexDirection: 'row',
    gap: 4,
  },
  waterGlass: {
    fontSize: 20,
    opacity: 0.3,
  },
  waterGlassFilled: {
    opacity: 1,
  },
  quickActions: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  reminderButton: {
    borderColor: '#f59e0b',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  mealCard: {
    marginBottom: 12,
  },
  mealHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  mealTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  mealEmoji: {
    fontSize: 20,
    marginRight: 8,
  },
  mealTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
  },
  addMealButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addMealText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  mealContent: {
    paddingLeft: 28,
  },
  mealCalories: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  foodList: {
    gap: 4,
  },
  foodItem: {
    fontSize: 14,
    color: '#6b7280',
  },
  moreFoods: {
    fontSize: 14,
    color: '#3b82f6',
    fontStyle: 'italic',
  },
  emptyMeal: {
    fontSize: 14,
    color: '#9ca3af',
    paddingLeft: 28,
    fontStyle: 'italic',
  },
  mealCount: {
    fontSize: 16,
    color: '#6b7280',
    marginLeft: 4,
    fontWeight: '500',
  },
  mealItem: {
    padding: 12,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    marginBottom: 8,
  },
  mealItemBorder: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    marginTop: 8,
    paddingTop: 12,
  },
  mealItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  mealName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
    marginRight: 8,
  },
  mealActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  deleteButton: {
    backgroundColor: '#ef4444',
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  deleteButtonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: 'bold',
    lineHeight: 20,
  },
  goalsRow: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  goalsTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  goalValue: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    textAlign: 'center',
  },
  goalLabel: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  nutritionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    justifyContent: 'space-between',
  },
  nutritionCard: {
    width: '48%',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 1,
    },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  nutritionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  nutritionIcon: {
    fontSize: 20,
  },
  nutritionPercentage: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  nutritionLabel: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
    marginBottom: 4,
  },
  nutritionValue: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 12,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: '#e5e7eb',
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 3,
  },
  caloriesCard: {
    borderColor: '#dbeafe',
  },
  caloriesProgress: {
    backgroundColor: '#3b82f6',
  },
  proteinCard: {
    borderColor: '#dcfce7',
  },
  proteinProgress: {
    backgroundColor: '#10b981',
  },
  carbsCard: {
    borderColor: '#fed7aa',
  },
  carbsProgress: {
    backgroundColor: '#f59e0b',
  },
  fatCard: {
    borderColor: '#e9d5ff',
  },
  fatProgress: {
    backgroundColor: '#8b5cf6',
  },
  // Custom meal modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  modalContainer: {
    backgroundColor: '#ffffff',
    margin: 16,
    borderRadius: 12,
    padding: 20,
    maxHeight: '85%',
    width: '95%',
    alignSelf: 'center',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
    width: '100%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  closeButton: {
    padding: 4,
  },
  closeButtonText: {
    fontSize: 24,
    color: '#6b7280',
  },
  modalContent: {
    maxHeight: 400,
  },
  formGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 6,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  mealTypeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  mealTypeButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  selectedMealType: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  mealTypeText: {
    fontSize: 12,
    color: '#6b7280',
    fontWeight: '500',
  },
  selectedMealTypeText: {
    color: '#ffffff',
  },
  nutritionInputs: {
    gap: 12,
  },
  nutritionInputRow: {
    flexDirection: 'row',
    gap: 12,
  },
  nutritionInput: {
    flex: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10b981',
  },
  // Meal actions styles
  // mealActions: {
  //   flexDirection: 'row',
  //   gap: 8,
  // },
  addCustomMealButton: {
    backgroundColor: '#f59e0b',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  addCustomMealText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
});
