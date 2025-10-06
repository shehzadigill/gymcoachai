import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
} from 'react-native';
import { Card, LoadingSpinner, Button } from '../components/common/UI';
import apiClient from '../services/api';
import notificationService from '../services/safeNotifications';

export default function NutritionScreen({ navigation }: any) {
  const [todaysMeals, setTodaysMeals] = useState<any>(null);
  const [nutritionStats, setNutritionStats] = useState<any>(null);
  const [waterIntake, setWaterIntake] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const today = new Date().toISOString().split('T')[0];

  useEffect(() => {
    loadNutritionData();
  }, []);

  const loadNutritionData = async () => {
    try {
      setLoading(true);

      const [mealsData, statsData, waterData] = await Promise.allSettled([
        apiClient.getMealsByDate(today),
        apiClient.getNutritionStats(),
        apiClient.getWater(today),
      ]);

      setTodaysMeals(mealsData.status === 'fulfilled' ? mealsData.value : null);
      setNutritionStats(
        statsData.status === 'fulfilled' ? statsData.value : null
      );
      setWaterIntake(waterData.status === 'fulfilled' ? waterData.value : null);
    } catch (error) {
      console.error('Error loading nutrition data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
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

  const addWater = async () => {
    try {
      const currentGlasses = waterIntake?.glasses || 0;
      const newGlasses = currentGlasses + 1;

      await apiClient.setWater(today, newGlasses);
      setWaterIntake({ ...waterIntake, glasses: newGlasses });

      // Send progress notification
      if (newGlasses === 8) {
        notificationService.sendProgressNotification(
          '💧 Hydration Goal Achieved!',
          "Great job! You've reached your daily water intake goal."
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
        ]
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
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Nutrition</Text>
          <Text style={styles.subtitle}>{new Date().toLocaleDateString()}</Text>
        </View>

        {/* Daily Summary */}
        {nutritionStats && (
          <Card style={styles.summaryCard}>
            <Text style={styles.cardTitle}>Today's Summary</Text>
            <View style={styles.macroRow}>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>
                  {nutritionStats.todayCalories || 0}
                </Text>
                <Text style={styles.macroLabel}>Calories</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>
                  {nutritionStats.todayProtein || 0}g
                </Text>
                <Text style={styles.macroLabel}>Protein</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>
                  {nutritionStats.todayCarbs || 0}g
                </Text>
                <Text style={styles.macroLabel}>Carbs</Text>
              </View>
              <View style={styles.macroItem}>
                <Text style={styles.macroValue}>
                  {nutritionStats.todayFat || 0}g
                </Text>
                <Text style={styles.macroLabel}>Fat</Text>
              </View>
            </View>
          </Card>
        )}

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
              {waterIntake?.glasses || 0} / 8 glasses today
            </Text>
            <View style={styles.waterGlasses}>
              {Array.from({ length: 8 }).map((_, index) => (
                <Text
                  key={index}
                  style={[
                    styles.waterGlass,
                    index < (waterIntake?.glasses || 0) &&
                      styles.waterGlassFilled,
                  ]}
                >
                  💧
                </Text>
              ))}
            </View>
          </View>
        </Card>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <Button
            title="🔔 Setup Meal Reminders"
            onPress={configureNotifications}
            variant="outline"
            style={styles.reminderButton}
          />
        </View>

        {/* Meals */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Today's Meals</Text>

          {['breakfast', 'lunch', 'dinner', 'snack'].map((mealType) => {
            const meal = todaysMeals?.meals?.find(
              (m: any) => m.type === mealType
            );

            return (
              <Card key={mealType} style={styles.mealCard}>
                <View style={styles.mealHeader}>
                  <View style={styles.mealTitleContainer}>
                    <Text style={styles.mealEmoji}>
                      {getMealTypeEmoji(mealType)}
                    </Text>
                    <Text style={styles.mealTitle}>
                      {mealType.charAt(0).toUpperCase() + mealType.slice(1)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => addMeal(mealType)}
                    style={styles.addMealButton}
                  >
                    <Text style={styles.addMealText}>
                      {meal ? 'Edit' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {meal ? (
                  <View style={styles.mealContent}>
                    <Text style={styles.mealCalories}>
                      {meal.totalCalories || 0} calories
                    </Text>
                    {meal.foods && meal.foods.length > 0 && (
                      <View style={styles.foodList}>
                        {meal.foods
                          .slice(0, 3)
                          .map((food: any, index: number) => (
                            <Text key={index} style={styles.foodItem}>
                              • {food.food?.name} ({food.quantity} {food.unit})
                            </Text>
                          ))}
                        {meal.foods.length > 3 && (
                          <Text style={styles.moreFoods}>
                            +{meal.foods.length - 3} more items
                          </Text>
                        )}
                      </View>
                    )}
                  </View>
                ) : (
                  <Text style={styles.emptyMeal}>No {mealType} logged yet</Text>
                )}
              </Card>
            );
          })}
        </View>
      </ScrollView>
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
});
