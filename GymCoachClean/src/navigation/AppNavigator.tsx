import React from 'react';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';

// Import screens - simplified versions for now
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import SignInScreen from '../screens/auth/SignInScreen';
import SignUpScreen from '../screens/auth/SignUpScreen';

// Import actual main screens
import DashboardScreen from '../screens/DashboardScreen';
import WorkoutsScreen from '../screens/WorkoutsScreen';
import NutritionScreen from '../screens/NutritionScreen';
import NutritionEntryScreen from '../screens/nutrition/NutritionEntryScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import ProfileScreen from '../screens/ProfileScreen';
import AITrainerScreen from '../screens/AITrainerScreen';

// Import workout-related screens
import SessionScreen from '../screens/workout/SessionScreen';
import WorkoutDetailScreen from '../screens/workout/WorkoutDetailScreen';
import CreatePlanScreen from '../screens/workout/CreatePlanScreen';
import CreateExerciseScreen from '../screens/workout/CreateExerciseScreen';

export type RootStackParamList = {
  Auth: undefined;
  Main: undefined;
};

export type AuthStackParamList = {
  Welcome: undefined;
  SignIn: undefined;
  SignUp: undefined;
};

export type MainTabParamList = {
  Dashboard: undefined;
  Workouts: undefined;
  AITrainer: undefined;
  Nutrition: undefined;
  Analytics: undefined;
  Profile: undefined;
};

export type WorkoutStackParamList = {
  WorkoutMain: undefined;
  Session: {
    workoutId?: string;
    sessionId?: string;
  };
  WorkoutDetail: {
    workoutId: string;
  };
  CreatePlan: undefined;
  CreateExercise: undefined;
};

export type NutritionStackParamList = {
  NutritionMain: undefined;
  NutritionEntry: {
    date: string;
    mealType: string;
    mealId?: string;
    editMode?: boolean;
    mealData?: any;
  };
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();
const NutritionStack = createNativeStackNavigator<NutritionStackParamList>();
const WorkoutStack = createNativeStackNavigator<WorkoutStackParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <AuthStack.Screen name="Welcome" component={WelcomeScreen} />
      <AuthStack.Screen name="SignIn" component={SignInScreen} />
      <AuthStack.Screen name="SignUp" component={SignUpScreen} />
    </AuthStack.Navigator>
  );
}

// Import React Native components for icons
import {View, Text, StyleSheet} from 'react-native';
import TabBarIcon from '../components/common/TabBarIcon';

function NutritionNavigator() {
  return (
    <NutritionStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <NutritionStack.Screen name="NutritionMain" component={NutritionScreen} />
      <NutritionStack.Screen
        name="NutritionEntry"
        component={NutritionEntryScreen}
        options={{
          headerShown: true,
          title: 'Log Meal',
          headerBackTitle: 'Back',
        }}
      />
    </NutritionStack.Navigator>
  );
}

function WorkoutNavigator() {
  return (
    <WorkoutStack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}>
      <WorkoutStack.Screen name="WorkoutMain" component={WorkoutsScreen} />
      <WorkoutStack.Screen
        name="Session"
        component={SessionScreen}
        options={{
          headerShown: true,
          title: 'Workout Session',
          headerBackTitle: 'Back',
        }}
      />
      <WorkoutStack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{
          headerShown: true,
          title: 'Workout Details',
          headerBackTitle: 'Back',
        }}
      />
      <WorkoutStack.Screen
        name="CreatePlan"
        component={CreatePlanScreen}
        options={{
          headerShown: true,
          title: 'Create Workout Plan',
          headerBackTitle: 'Back',
        }}
      />
      <WorkoutStack.Screen
        name="CreateExercise"
        component={CreateExerciseScreen}
        options={{
          headerShown: true,
          title: 'Create Exercise',
          headerBackTitle: 'Back',
        }}
      />
    </WorkoutStack.Navigator>
  );
}

function MainNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopWidth: 1,
          borderTopColor: '#e5e5e5',
          paddingBottom: 5,
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#9ca3af',
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({focused, color, size}) => (
            <TabBarIcon
              name="home"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Workouts"
        component={WorkoutNavigator}
        options={{
          tabBarLabel: 'Workouts',
          tabBarIcon: ({focused, color, size}) => (
            <TabBarIcon
              name="fitness"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="AITrainer"
        component={AITrainerScreen}
        options={{
          tabBarLabel: 'AI Trainer',
          tabBarIcon: ({focused, color, size}) => (
            <TabBarIcon
              name="smart-toy"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Nutrition"
        component={NutritionNavigator}
        options={{
          tabBarLabel: 'Nutrition',
          tabBarIcon: ({focused, color, size}) => (
            <TabBarIcon
              name="nutrition"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarLabel: 'Analytics',
          tabBarIcon: ({focused, color, size}) => (
            <TabBarIcon
              name="analytics"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({focused, color, size}) => (
            <TabBarIcon
              name="profile"
              focused={focused}
              color={color}
              size={size}
            />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

interface AppNavigatorProps {
  isAuthenticated: boolean;
}

export default function AppNavigator({isAuthenticated}: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{headerShown: false}}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
