import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Platform } from 'react-native';

// Import screens
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SplashScreen from '../screens/auth/SplashScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';
import DashboardScreen from '../screens/DashboardScreen';
import WorkoutsScreen from '../screens/WorkoutsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import NutritionScreen from '../screens/NutritionScreen';
import ProfileScreen from '../screens/ProfileScreen';
import WorkoutDetailScreen from '../screens/workout/WorkoutDetailScreen';
import ExerciseDetailScreen from '../screens/workout/ExerciseDetailScreen';
import SessionScreen from '../screens/workout/SessionScreen';
import NutritionEntryScreen from '../screens/nutrition/NutritionEntryScreen';
import FoodSearchScreen from '../screens/nutrition/FoodSearchScreen';

// Import icons (using simple text icons for now, can be replaced with vector icons)
import TabBarIcon from '../components/common/TabBarIcon';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
  WorkoutDetail: { workoutId: string };
  ExerciseDetail: { exerciseId: string };
  Session: { sessionId?: string; workoutId?: string };
  NutritionEntry: { date: string; mealType?: string };
  FoodSearch: { onSelectFood: (food: any) => void };
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Workouts: undefined;
  Nutrition: undefined;
  Analytics: undefined;
  Profile: undefined;
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const MainTab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      initialRouteName="Welcome"
      screenOptions={{
        headerShown: false,
        gestureEnabled: true,
        animation: 'slide_from_right',
      }}
    >
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

function MainTabNavigator() {
  return (
    <MainTab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => (
          <TabBarIcon
            name={getTabBarIconName(route.name)}
            focused={focused}
            color={color}
            size={size}
          />
        ),
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e7eb',
          borderTopWidth: 1,
          height: Platform.OS === 'ios' ? 85 : 60,
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          paddingTop: 5,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerShown: false,
      })}
    >
      <MainTab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <MainTab.Screen
        name="Workouts"
        component={WorkoutsScreen}
        options={{ tabBarLabel: 'Workouts' }}
      />
      <MainTab.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{ tabBarLabel: 'Nutrition' }}
      />
      <MainTab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{ tabBarLabel: 'Analytics' }}
      />
      <MainTab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarLabel: 'Profile' }}
      />
    </MainTab.Navigator>
  );
}

function getTabBarIconName(routeName: string): string {
  switch (routeName) {
    case 'Dashboard':
      return 'home';
    case 'Workouts':
      return 'fitness';
    case 'Nutrition':
      return 'nutrition';
    case 'Analytics':
      return 'analytics';
    case 'Profile':
      return 'profile';
    default:
      return 'unknown';
  }
}

interface AppNavigatorProps {
  isAuthenticated: boolean;
}

export default function AppNavigator({ isAuthenticated }: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <RootStack.Navigator
        screenOptions={{
          headerShown: false,
          gestureEnabled: true,
          animation: 'fade',
        }}
      >
        {isAuthenticated ? (
          <>
            <RootStack.Screen name="Main" component={MainTabNavigator} />
            <RootStack.Screen
              name="WorkoutDetail"
              component={WorkoutDetailScreen}
              options={{
                headerShown: true,
                title: 'Workout Details',
                animation: 'slide_from_right',
              }}
            />
            <RootStack.Screen
              name="ExerciseDetail"
              component={ExerciseDetailScreen}
              options={{
                headerShown: true,
                title: 'Exercise Details',
                animation: 'slide_from_right',
              }}
            />
            <RootStack.Screen
              name="Session"
              component={SessionScreen}
              options={{
                headerShown: true,
                title: 'Workout Session',
                animation: 'slide_from_bottom',
              }}
            />
            <RootStack.Screen
              name="NutritionEntry"
              component={NutritionEntryScreen}
              options={{
                headerShown: true,
                title: 'Log Meal',
                animation: 'slide_from_right',
              }}
            />
            <RootStack.Screen
              name="FoodSearch"
              component={FoodSearchScreen}
              options={{
                headerShown: true,
                title: 'Search Foods',
                animation: 'slide_from_right',
              }}
            />
          </>
        ) : (
          <RootStack.Screen name="Auth" component={AuthNavigator} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
