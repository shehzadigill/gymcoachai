// Analytics type definitions matching the backend models

export interface StrengthProgress {
  id: string;
  user_id: string;
  exercise_id: string;
  exercise_name: string;
  date: string;
  weight: number;
  reps: number;
  sets: number;
  one_rep_max: number;
  volume: number;
  created_at: string;
}

export interface BodyMeasurement {
  id: string;
  user_id: string;
  measurement_type: string;
  value: number;
  unit: string;
  date: string;
  notes?: string;
  created_at: string;
}

export interface Milestone {
  id: string;
  user_id: string;
  title: string;
  description: string;
  target_value: number;
  current_value: number;
  unit: string;
  category: string;
  status: string;
  achieved_at?: string;
  created_at: string;
}

export interface PredictedMax {
  exercise_id: string;
  exercise_name: string;
  current_max: number;
  predicted_max: number;
  timeframe: string;
  confidence: number;
}

export interface PerformanceTrend {
  id: string;
  user_id: string;
  metric_type: string;
  period: string;
  trend_direction: string;
  percentage_change: number;
  data_points: number;
  calculated_at: string;
}

export interface WorkoutAnalytics {
  user_id: string;
  period: string;
  total_workouts: number;
  total_exercises: number;
  total_sets: number;
  total_reps: number;
  total_volume: number;
  avg_workout_duration: number;
  total_duration_minutes: number;
  average_workout_duration: number;
  consistency_score: number;
  strength_trend: StrengthProgress[];
  strength_gains: StrengthProgress[];
  most_trained_muscle_groups: string[];
  favorite_exercises: string[];
  weekly_frequency: number;
  personal_records_count: number;
  achievement_count: number;
  body_measurements: BodyMeasurement[];
  milestones_achieved: Milestone[];
  performance_trends: PerformanceTrend[];
  generated_at: string;
}

export interface WorkoutInsights {
  user_id: string;
  period: string;
  generated_at: string;
  strength_trend?: string;
  consistency_trend?: string;
  volume_trend?: string;
  recovery_analysis?: string;
  recommendations?: string[];
  warnings?: string[];
  achievements_unlocked?: string[];
  next_milestones?: string[];
  plateau_risk?: number;
  overtraining_risk?: number;
  improvement_areas?: string[];
  strength_predictions?: PredictedMax[];
}

export interface WorkoutSessionDetail {
  id: string;
  user_id: string;
  workout_plan_id?: string;
  date: string;
  duration_minutes: number;
  total_sets: number;
  total_reps: number;
  total_volume: number;
  exercises_performed: number;
  notes?: string;
  rating?: number;
  created_at: string;
}

// UI-specific types for charts and displays
export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface TrendData {
  current: number;
  previous: number;
  change: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MetricCard {
  title: string;
  value: string | number;
  unit?: string;
  trend?: TrendData;
  icon: string;
  color: string;
}
