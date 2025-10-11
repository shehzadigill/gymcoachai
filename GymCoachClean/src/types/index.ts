// Global types for the app
export interface User {
  id: string;
  email: string;
  profile?: UserProfile;
}

export interface UserProfile {
  id: string;
  userId: string;
  firstName?: string;
  lastName?: string;
  bio?: string;
  birthDate?: string;
  gender?: 'male' | 'female' | 'other';
  height?: number;
  weight?: number;
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  goals?: string[];
  preferences?: UserPreferences;
  createdAt: string;
  updatedAt: string;
}

export interface DailyGoals {
  calories: number;
  water: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface UserPreferences {
  units?: 'metric' | 'imperial';
  notifications?: NotificationSettings;
  privacy?: PrivacySettings;
  dailyGoals?: DailyGoals;
  aiTrainer?: AITrainerPreferences;
}

export interface AITrainerPreferences {
  enabled: boolean;
  coachingStyle: 'motivational' | 'strict' | 'balanced' | 'technical';
  communicationFrequency: 'daily' | 'weekly' | 'on-demand';
  focusAreas: string[];
  injuryHistory: string[];
  equipmentAvailable: string[];
  workoutDurationPreference: number; // minutes
  workoutDaysPerWeek: number;
  mealPreferences: string[];
  allergies: string[];
  supplementPreferences: string[];
}

export interface NotificationSettings {
  workoutReminders?: boolean;
  nutritionReminders?: boolean;
  progressUpdates?: boolean;
  socialUpdates?: boolean;
}

export interface PrivacySettings {
  shareProgress?: boolean;
  shareWorkouts?: boolean;
  publicProfile?: boolean;
}

export interface Workout {
  id: string;
  userId: string;
  name: string;
  description?: string;
  exercises: Exercise[];
  duration?: number;
  difficulty?: 'easy' | 'medium' | 'hard';
  category?: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface Exercise {
  id: string;
  name: string;
  description?: string;
  category: string;
  muscleGroups: string[];
  equipment?: string[];
  instructions: string[];
  sets?: ExerciseSet[];
  imageUrl?: string;
  videoUrl?: string;
}

export interface ExerciseSet {
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  restTime?: number;
}

export interface WorkoutSession {
  id: string;
  userId: string;
  workoutId?: string;
  workout?: Workout;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled';
  startTime?: string;
  endTime?: string;
  exercises: SessionExercise[];
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

export interface SessionExercise {
  exerciseId: string;
  exercise: Exercise;
  sets: CompletedSet[];
  notes?: string;
}

export interface CompletedSet {
  reps?: number;
  weight?: number;
  duration?: number;
  distance?: number;
  completed: boolean;
  restTime?: number;
}

export interface NutritionEntry {
  id: string;
  userId: string;
  date: string;
  meals: Meal[];
  totalCalories: number;
  totalProtein: number;
  totalCarbs: number;
  totalFat: number;
  waterIntake: number;
  createdAt: string;
  updatedAt: string;
}

export interface Meal {
  id: string;
  type: 'breakfast' | 'lunch' | 'dinner' | 'snack';
  foods: FoodEntry[];
  totalCalories: number;
  timestamp: string;
}

export interface FoodEntry {
  id: string;
  foodId: string;
  food: Food;
  quantity: number;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Food {
  id: string;
  name: string;
  brand?: string;
  category: string;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber?: number;
  sugar?: number;
  sodium?: number;
  imageUrl?: string;
  barcode?: string;
}

export interface Analytics {
  strengthProgress: StrengthProgress[];
  bodyMeasurements: BodyMeasurement[];
  milestones: Milestone[];
  achievements: Achievement[];
}

export interface StrengthProgress {
  id: string;
  userId: string;
  exerciseId: string;
  exercise: Exercise;
  date: string;
  weight: number;
  reps: number;
  oneRepMax: number;
  volume: number;
  createdAt: string;
}

export interface BodyMeasurement {
  id: string;
  userId: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    bicep?: number;
    thigh?: number;
  };
  createdAt: string;
}

export interface Milestone {
  id: string;
  userId: string;
  title: string;
  description?: string;
  category: 'strength' | 'endurance' | 'weight' | 'body_composition' | 'other';
  targetValue: number;
  currentValue: number;
  unit: string;
  achieved: boolean;
  achievedAt?: string;
  targetDate?: string;
  createdAt: string;
}

export interface Achievement {
  id: string;
  userId: string;
  title: string;
  description: string;
  category: string;
  badgeUrl?: string;
  unlockedAt: string;
  progress: number;
  maxProgress: number;
}

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
}
