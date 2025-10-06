// User related types
export interface User {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
}

export interface DailyGoals {
  calories: number;
  water: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserPreferences {
  units: 'metric' | 'imperial';
  timezone: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
  dailyGoals?: DailyGoals;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  workoutReminders: boolean;
  nutritionReminders: boolean;
}

export interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  workoutSharing: boolean;
  progressSharing: boolean;
}

// Workout related types
export interface Workout {
  id: string;
  userId: string;
  name: string;
  description?: string;
  exercises: Exercise[];
  duration: number; // in minutes
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  createdAt: string;
  updatedAt: string;
  completedAt?: string;
}

export interface Exercise {
  id: string;
  name: string;
  category: ExerciseCategory;
  muscleGroups: MuscleGroup[];
  equipment: Equipment[];
  instructions: string[];
  sets: Set[];
  restTime: number; // in seconds
}

export interface Set {
  reps?: number;
  weight?: number; // in kg
  duration?: number; // in seconds for time-based exercises
  distance?: number; // in meters for cardio
  restTime?: number; // in seconds
}

export type ExerciseCategory =
  | 'strength'
  | 'cardio'
  | 'flexibility'
  | 'balance'
  | 'sports'
  | 'functional';

export type MuscleGroup =
  | 'chest'
  | 'back'
  | 'shoulders'
  | 'biceps'
  | 'triceps'
  | 'forearms'
  | 'abs'
  | 'obliques'
  | 'quadriceps'
  | 'hamstrings'
  | 'glutes'
  | 'calves'
  | 'full-body';

export type Equipment =
  | 'bodyweight'
  | 'dumbbells'
  | 'barbell'
  | 'kettlebell'
  | 'resistance-bands'
  | 'treadmill'
  | 'bike'
  | 'rower'
  | 'yoga-mat'
  | 'bench'
  | 'pull-up-bar';

// Nutrition related types
export interface NutritionPlan {
  id: string;
  userId: string;
  name: string;
  description?: string;
  dailyCalories: number;
  macronutrients: Macronutrients;
  meals: Meal[];
  createdAt: string;
  updatedAt: string;
}

export interface Macronutrients {
  protein: number; // in grams
  carbohydrates: number; // in grams
  fats: number; // in grams
  fiber: number; // in grams
}

export interface Meal {
  id: string;
  name: string;
  type: MealType;
  foods: Food[];
  calories: number;
  macronutrients: Macronutrients;
  scheduledTime: string; // ISO time string
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  macronutrients: Macronutrients;
  micronutrients?: Micronutrients;
}

export interface Micronutrients {
  vitamins: Record<string, number>; // vitamin name to amount in mg/mcg
  minerals: Record<string, number>; // mineral name to amount in mg/mcg
}

export type MealType = 'breakfast' | 'lunch' | 'dinner' | 'snack';

// AI related types
export interface AIRecommendation {
  id: string;
  userId: string;
  type: RecommendationType;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high';
  data: Record<string, any>;
  createdAt: string;
  expiresAt?: string;
  isRead: boolean;
}

export type RecommendationType =
  | 'workout'
  | 'nutrition'
  | 'recovery'
  | 'form'
  | 'progression'
  | 'motivation';

// Progress tracking types
export interface ProgressEntry {
  id: string;
  userId: string;
  type: ProgressType;
  value: number;
  unit: string;
  date: string;
  notes?: string;
  metadata?: Record<string, any>;
}

export type ProgressType =
  | 'weight'
  | 'body-fat'
  | 'muscle-mass'
  | 'strength'
  | 'endurance'
  | 'flexibility'
  | 'mood'
  | 'energy';

// API response types
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T = any> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

// Form types
export interface LoginForm {
  email: string;
  password: string;
}

export interface RegisterForm {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
}

export interface WorkoutForm {
  name: string;
  description?: string;
  exercises: Omit<Exercise, 'id'>[];
  difficulty: Workout['difficulty'];
}

export interface NutritionForm {
  name: string;
  description?: string;
  dailyCalories: number;
  macronutrients: Macronutrients;
}

// Utility types
export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type Optional<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export type RequiredFields<T, K extends keyof T> = T & Required<Pick<T, K>>;
