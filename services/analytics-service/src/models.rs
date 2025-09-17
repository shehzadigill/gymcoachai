use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StrengthProgress {
    pub user_id: String,
    pub exercise_id: String,
    pub exercise_name: String,
    pub current_max_weight: f32,
    pub previous_max_weight: f32,
    pub weight_increase: f32,
    pub percentage_increase: f32,
    pub period: String, // "week", "month", "quarter", "year"
    pub measurement_date: String,
    pub trend: String, // "increasing", "decreasing", "stable"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BodyMeasurement {
    pub id: String,
    pub user_id: String,
    pub measurement_type: String, // "weight", "height", "body_fat", "muscle_mass", "waist", "chest", "arms", "thighs"
    pub value: f32,
    pub unit: String, // "kg", "lbs", "cm", "inches", "%"
    pub measured_at: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressChart {
    pub chart_id: String,
    pub user_id: String,
    pub chart_type: String, // "strength_progress", "body_measurements", "workout_frequency", "volume_trends"
    pub title: String,
    pub description: String,
    pub data_points: Vec<ChartDataPoint>,
    pub x_axis_label: String,
    pub y_axis_label: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ChartDataPoint {
    pub x_value: String, // date or period
    pub y_value: f32,
    pub label: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Milestone {
    pub id: String,
    pub user_id: String,
    pub milestone_type: String, // "strength", "endurance", "consistency", "weight_loss", "muscle_gain"
    pub title: String,
    pub description: String,
    pub target_value: f32,
    pub current_value: f32,
    pub progress_percentage: f32,
    pub achieved: bool,
    pub achieved_at: Option<String>,
    pub created_at: String,
    pub target_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerformanceTrend {
    pub user_id: String,
    pub metric_type: String, // "strength", "endurance", "consistency", "volume"
    pub period: String,
    pub start_date: String,
    pub end_date: String,
    pub trend_direction: String, // "upward", "downward", "stable"
    pub trend_strength: f32, // 0.0 - 1.0
    pub data_points: Vec<TrendDataPoint>,
    pub insights: Vec<String>,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrendDataPoint {
    pub date: String,
    pub value: f32,
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutAnalytics {
    pub user_id: String,
    pub period: String,
    pub total_workouts: u32,
    pub total_duration_minutes: u32,
    pub average_workout_duration: f32,
    pub consistency_score: f32, // 0.0 - 1.0
    pub favorite_exercises: Vec<ExerciseStats>,
    pub strength_gains: Vec<StrengthProgress>,
    pub body_measurements: Vec<BodyMeasurement>,
    pub milestones_achieved: Vec<Milestone>,
    pub performance_trends: Vec<PerformanceTrend>,
    pub generated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseStats {
    pub exercise_id: String,
    pub exercise_name: String,
    pub total_sets: u32,
    pub total_reps: u32,
    pub total_volume: f32, // weight * reps
    pub average_weight: f32,
    pub max_weight: f32,
    pub frequency: u32, // number of times performed
    pub improvement_rate: f32, // percentage improvement over period
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressReport {
    pub report_id: String,
    pub user_id: String,
    pub report_type: String, // "weekly", "monthly", "quarterly", "annual"
    pub period_start: String,
    pub period_end: String,
    pub summary: ProgressSummary,
    pub detailed_analytics: WorkoutAnalytics,
    pub charts: Vec<ProgressChart>,
    pub milestones: Vec<Milestone>,
    pub recommendations: Vec<String>,
    pub generated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressSummary {
    pub total_workouts: u32,
    pub total_hours: f32,
    pub strength_improvements: u32,
    pub body_measurement_changes: u32,
    pub milestones_achieved: u32,
    pub consistency_rating: String, // "excellent", "good", "fair", "poor"
    pub overall_progress: String, // "excellent", "good", "fair", "needs_improvement"
    pub key_achievements: Vec<String>,
    pub areas_for_improvement: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoalProgress {
    pub goal_id: String,
    pub user_id: String,
    pub goal_type: String, // "strength", "weight_loss", "muscle_gain", "endurance", "consistency"
    pub goal_title: String,
    pub target_value: f32,
    pub current_value: f32,
    pub progress_percentage: f32,
    pub target_date: String,
    pub created_at: String,
    pub updated_at: String,
    pub status: String, // "on_track", "ahead", "behind", "completed", "paused"
    pub milestones: Vec<GoalMilestone>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GoalMilestone {
    pub milestone_id: String,
    pub title: String,
    pub target_value: f32,
    pub achieved: bool,
    pub achieved_at: Option<String>,
    pub order: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComparisonData {
    pub user_id: String,
    pub comparison_type: String, // "previous_period", "peer_group", "personal_best"
    pub period: String,
    pub metrics: Vec<ComparisonMetric>,
    pub insights: Vec<String>,
    pub generated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComparisonMetric {
    pub metric_name: String,
    pub current_value: f32,
    pub comparison_value: f32,
    pub difference: f32,
    pub percentage_change: f32,
    pub trend: String, // "improving", "declining", "stable"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutSession {
    pub id: String,
    pub user_id: String,
    pub workout_plan_id: Option<String>,
    pub name: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_minutes: Option<u32>,
    pub exercises: Vec<SessionExercise>,
    pub rating: Option<u32>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionExercise {
    pub exercise_id: String,
    pub name: String,
    pub sets: Vec<ExerciseSet>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseSet {
    pub set_number: u32,
    pub reps: Option<u32>,
    pub weight: Option<f32>,
    pub duration_seconds: Option<u32>,
    pub completed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalyticsQuery {
    pub user_id: String,
    pub start_date: String,
    pub end_date: String,
    pub metrics: Vec<String>, // specific metrics to include
    pub chart_types: Vec<String>, // types of charts to generate
    pub include_comparisons: bool,
    pub include_recommendations: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalyticsResponse {
    pub query: AnalyticsQuery,
    pub analytics: WorkoutAnalytics,
    pub charts: Vec<ProgressChart>,
    pub trends: Vec<PerformanceTrend>,
    pub milestones: Vec<Milestone>,
    pub recommendations: Vec<String>,
    pub generated_at: String,
}
