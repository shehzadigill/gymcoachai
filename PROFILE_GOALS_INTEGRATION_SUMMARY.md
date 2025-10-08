# Profile Goals Integration Summary

## ✅ **Implementation Complete**

I have successfully updated both the Enhanced Dashboard and Nutrition pages to pull daily goals from user profile preferences instead of using hardcoded values.

## 🔄 **Changes Made**

### **1. Enhanced Dashboard (`apps/web/src/app/(dashboard)/enhanced-dashboard.tsx`)**

#### **Before:**

```typescript
const dailyGoals = [
  {
    name: 'Calories',
    current: Math.round(todaysCalories),
    target:
      userProfile?.body?.dailyCalorieGoal ||
      userProfile?.dailyCalorieGoal ||
      nutritionData.daily_goal ||
      2000,
    unit: 'kcal',
  },
  {
    name: 'Water',
    current: waterIntake?.glasses || 0,
    target:
      userProfile?.body?.dailyWaterGoal || userProfile?.dailyWaterGoal || 8,
    unit: 'glasses',
  },
];
```

#### **After:**

```typescript
// Extract daily goals from user profile preferences
const profileData = userProfile?.body || userProfile || {};
const dailyGoalsFromPrefs = profileData?.preferences?.dailyGoals;

const dailyGoals = [
  {
    name: 'Calories',
    current: Math.round(todaysCalories),
    target: dailyGoalsFromPrefs?.calories || 2000,
    unit: 'kcal',
  },
  {
    name: 'Protein',
    current: Math.round(todaysProtein),
    target: dailyGoalsFromPrefs?.protein || 150,
    unit: 'g',
  },
  {
    name: 'Carbs',
    current: Math.round(todaysCarbs),
    target: dailyGoalsFromPrefs?.carbs || 200,
    unit: 'g',
  },
  {
    name: 'Fat',
    current: Math.round(todaysFat),
    target: dailyGoalsFromPrefs?.fat || 67,
    unit: 'g',
  },
  {
    name: 'Water',
    current: waterIntake?.glasses || 0,
    target: dailyGoalsFromPrefs?.water || 8,
    unit: 'glasses',
  },
];

// Also updated the main data object
calorieGoal: dailyGoalsFromPrefs?.calories || 2000,
waterGoal: dailyGoalsFromPrefs?.water || 8,
```

### **2. Nutrition Page (`apps/web/src/app/(dashboard)/nutrition/page.tsx`)**

#### **Enhanced `getDefaultNutrition` function:**

```typescript
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
```

#### **Enhanced `calculateDailyNutrition` function:**

```typescript
const calculateDailyNutrition = (
  meals: Meal[],
  currentWater: number = 0,
  userProfile?: any
) => {
  // ... existing calculation logic ...

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
```

#### **Enhanced data fetching:**

```typescript
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

    // ... rest of the function uses userProfile for goals
  } catch (e: any) {
    // ... error handling
  }
};
```

## 🎯 **Profile Preferences Structure**

The implementation expects the user profile to have the following structure:

```typescript
interface UserProfile {
  preferences: {
    dailyGoals?: {
      calories: number; // Default: 2000
      water: number; // Default: 8 (glasses)
      protein: number; // Default: 150g
      carbs: number; // Default: 200g
      fat: number; // Default: 67g
    };
  };
}
```

## 🔧 **API Integration**

Both pages now call `api.getUserProfile()` to fetch the user's profile and extract daily goals from `preferences.dailyGoals`. If the profile is unavailable or preferences are not set, sensible defaults are used.

## ✅ **Benefits**

1. **Personalized Goals**: Users can set custom daily nutrition goals in their profile
2. **Consistent Experience**: Both dashboard and nutrition page show the same personalized goals
3. **Graceful Fallbacks**: If profile preferences aren't available, default values are used
4. **Enhanced Dashboard**: Now shows protein, carbs, and fat goals alongside calories and water
5. **Real-time Updates**: Goals update when user profile preferences change

## 🔄 **Next Steps**

1. **Profile Page Enhancement**: Ensure the profile page allows users to edit their daily goals
2. **Fiber Goal**: Add fiber goal to the profile preferences structure
3. **Validation**: Add validation to ensure goals are within reasonable ranges
4. **Unit Support**: Consider adding support for different units (metric/imperial)

## 🎉 **Result**

Users will now see their personalized daily goals throughout the app instead of hardcoded values, creating a more tailored fitness tracking experience!
