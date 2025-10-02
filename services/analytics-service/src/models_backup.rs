use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};
use std::collections::HashMap;

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
pub struct WorkoutDistribution {
    pub category: String, // "strength", "cardio", "flexibility", "sports"
    pub count: u32,
    pub percentage: f32,
    pub avg_duration: f32,
    pub total_volume: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersonalRecord {
    pub id: String,
    pub user_id: String,
    pub exercise_id: String,
    pub exercise_name: String,
    pub record_type: String, // "1RM", "Volume", "Duration", "Reps", "Distance"
    pub value: f32,
    pub unit: String,
    pub previous_record: Option<f32>,
    pub improvement_percentage: f32,
    pub achieved_date: String,
    pub workout_session_id: String,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Achievement {
    pub id: String,
    pub user_id: String,
    pub achievement_type: String, // "milestone", "streak", "pr", "consistency", "volume"
    pub title: String,
    pub description: String,
    pub icon: String,
    pub category: String,
    pub rarity: String, // "common", "rare", "epic", "legendary"
    pub points: u32,
    pub earned_date: String,
    pub requirements: serde_json::Value,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutInsights {
    pub user_id: String,
    pub period: String,
    pub generated_at: String,
    
    // Performance insights
    pub strength_trend: String, // "improving", "declining", "stable"
    pub consistency_trend: String,
    pub volume_trend: String,
    pub weakness_areas: Vec<String>,
    pub strength_areas: Vec<String>,
    
    // Behavioral insights
    pub best_workout_days: Vec<String>,
    pub best_workout_times: Vec<String>,
    pub workout_patterns: Vec<WorkoutPattern>,
    
    // Predictive analytics
    pub predicted_1rm: Vec<PredictedMax>,
    pub injury_risk_score: f32, // 0.0 - 1.0
    pub recovery_recommendation: String,
    
    // Comparative insights
    pub vs_previous_period: PeriodComparison,
    pub vs_similar_users: Option<PeerComparison>,
    
    // Recommendations
    pub training_recommendations: Vec<String>,
    pub nutrition_recommendations: Vec<String>,
    pub recovery_recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutPattern {
    pub pattern_type: String, // "frequency", "intensity", "volume", "duration"
    pub description: String,
    pub strength: f32, // 0.0 - 1.0
    pub trend: String,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PredictedMax {
    pub exercise_id: String,
    pub exercise_name: String,
    pub current_max: f32,
    pub predicted_max: f32,
    pub confidence: f32, // 0.0 - 1.0
    pub timeframe_days: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeriodComparison {
    pub workouts_change: f32, // percentage
    pub duration_change: f32,
    pub volume_change: f32,
    pub intensity_change: f32,
    pub consistency_change: f32,
    pub strength_change: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeerComparison {
    pub percentile: f32, // 0.0 - 100.0
    pub comparison_group: String, // "age_group", "experience_level", "goals"
    pub metrics: serde_json::Value,
    pub insights: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdvancedMetrics {
    pub user_id: String,
    pub calculated_at: String,
    
    // Volume metrics
    pub total_volume_load: u64,
    pub volume_per_muscle_group: serde_json::Value,
    pub volume_trend_7d: f32,
    pub volume_trend_30d: f32,
    
    // Intensity metrics
    pub avg_rpe: f32, // Rate of Perceived Exertion
    pub intensity_load: f32,
    pub intensity_distribution: serde_json::Value,
    
    // Recovery metrics
    pub recovery_score: f32, // 0.0 - 100.0
    pub sleep_quality_impact: f32,
    pub hrv_trend: Option<f32>, // Heart Rate Variability
    
    // Progression metrics
    pub strength_velocity: f32, // Rate of strength gain
    pub skill_acquisition_rate: f32,
    pub adaptation_score: f32,
    
    // Efficiency metrics
    pub training_efficiency: f32,
    pub time_under_tension: f32,
    pub movement_quality_score: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutAnalytics {
    pub user_id: String,
    pub period: String,
    pub total_workouts: u32,
    pub total_duration_minutes: u32,
    pub average_workout_duration: f32,
    pub consistency_score: f32, // 0.0 - 1.0
    pub intensity_score: f32, // 0.0 - 100.0
    pub calories_burned_total: u32,
    pub calories_burned_this_week: u32,
    pub volume_load_total: u64,
    pub volume_load_trend: f32,
    pub improvement_rate: f32,
    pub current_streak: u32,
    pub longest_streak: u32,
    pub workouts_this_week: u32,
    pub workouts_this_month: u32,
    pub last_workout_date: Option<String>,
    pub favorite_exercises: Vec<ExerciseStats>,
    pub strength_gains: Vec<StrengthProgress>,
    pub body_measurements: Vec<BodyMeasurement>,
    pub milestones_achieved: Vec<Milestone>,
    pub performance_trends: Vec<PerformanceTrend>,
    pub workout_distribution: Vec<WorkoutDistribution>,
    pub peak_performance_times: Vec<String>,
    pub personal_records: Vec<PersonalRecord>,
    pub achievements: Vec<Achievement>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseStats {
    pub exercise_id: String,
    pub exercise_name: String,
    pub frequency: u32,
    pub total_sets: u32,
    pub total_reps: u32,
    pub total_volume: u64,
    pub avg_weight: f32,
    pub max_weight: f32,
    pub progression_rate: f32,
    pub last_performed: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutDistribution {
    pub workout_type: String,
    pub count: u32,
    pub percentage: f32,
    pub avg_duration: u32,
    pub total_volume: u64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PersonalRecord {
    pub exercise_name: String,
    pub record_type: String, // "weight", "reps", "volume", "duration"
    pub value: f32,
    pub unit: String,
    pub date_achieved: String,
    pub previous_record: Option<f32>,
    pub improvement_percentage: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Achievement {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub date_earned: String,
    pub rarity: String, // "common", "rare", "epic", "legendary"
    pub criteria_met: HashMap<String, f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutInsights {
    pub user_id: String,
    pub insights: Vec<Insight>,
    pub recommendations: Vec<Recommendation>,
    pub predictions: Vec<Prediction>,
    pub trends: Vec<Trend>,
    pub patterns: Vec<WorkoutPattern>,
    pub advanced_metrics: AdvancedMetrics,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Insight {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub severity: String, // "info", "warning", "success", "error"
    pub data_points: Vec<DataPoint>,
    pub confidence_score: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Recommendation {
    pub id: String,
    pub title: String,
    pub description: String,
    pub category: String,
    pub priority: String, // "low", "medium", "high", "critical"
    pub action_items: Vec<String>,
    pub expected_outcome: String,
    pub confidence_score: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Prediction {
    pub id: String,
    pub title: String,
    pub predicted_value: f32,
    pub unit: String,
    pub target_date: String,
    pub confidence_interval: (f32, f32),
    pub factors: Vec<String>,
    pub model_accuracy: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Trend {
    pub metric: String,
    pub direction: String, // "increasing", "decreasing", "stable", "volatile"
    pub strength: f32, // 0-1 scale
    pub duration_days: u32,
    pub slope: f32,
    pub r_squared: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutPattern {
    pub pattern_type: String,
    pub description: String,
    pub frequency: String,
    pub strength: f32,
    pub last_occurrence: String,
    pub predicted_next: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DataPoint {
    pub metric: String,
    pub value: f32,
    pub date: String,
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdvancedMetrics {
    pub volume_load: VolumeMetrics,
    pub intensity_metrics: IntensityMetrics,
    pub recovery_metrics: RecoveryMetrics,
    pub adaptation_metrics: AdaptationMetrics,
    pub efficiency_metrics: EfficiencyMetrics,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct VolumeMetrics {
    pub total_volume: u64,
    pub average_volume_per_workout: f32,
    pub volume_trend: f32,
    pub volume_consistency: f32,
    pub peak_volume_week: u64,
    pub volume_distribution: HashMap<String, f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct IntensityMetrics {
    pub average_intensity: f32,
    pub peak_intensity: f32,
    pub intensity_variance: f32,
    pub high_intensity_percentage: f32,
    pub intensity_trend: f32,
    pub rpe_distribution: HashMap<u8, u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecoveryMetrics {
    pub average_rest_between_workouts: f32,
    pub optimal_rest_days: u8,
    pub recovery_trend: f32,
    pub overtraining_risk: f32,
    pub fatigue_index: f32,
    pub recovery_quality_score: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdaptationMetrics {
    pub strength_adaptation_rate: f32,
    pub endurance_adaptation_rate: f32,
    pub skill_progression_rate: f32,
    pub plateau_risk: f32,
    pub adaptation_efficiency: f32,
    pub time_to_adaptation: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EfficiencyMetrics {
    pub workout_efficiency: f32,
    pub time_under_tension_ratio: f32,
    pub rest_efficiency: f32,
    pub exercise_variety_score: f32,
    pub progression_efficiency: f32,
    pub goal_achievement_rate: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PredictedMax {
    pub exercise_name: String,
    pub current_max: f32,
    pub predicted_max: f32,
    pub target_date: String,
    pub confidence: f32,
    pub training_weeks_required: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeriodComparison {
    pub metric: String,
    pub current_period: PeriodData,
    pub comparison_period: PeriodData,
    pub change_percentage: f32,
    pub change_direction: String,
    pub significance: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeriodData {
    pub start_date: String,
    pub end_date: String,
    pub value: f32,
    pub sample_size: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeerComparison {
    pub metric: String,
    pub user_value: f32,
    pub peer_average: f32,
    pub peer_percentile: f32,
    pub comparison_group: String,
    pub ranking: u32,
    pub total_peers: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutSessionDetail {
    pub session_id: String,
    pub user_id: String,
    pub date: String,
    pub start_time: String,
    pub end_time: String,
    pub duration_minutes: u32,
    pub workout_type: String,
    pub exercises: Vec<ExerciseDetail>,
    pub total_volume: u64,
    pub avg_rest_time: u32,
    pub intensity_score: f32,
    pub rpe_score: Option<u8>,
    pub notes: Option<String>,
    pub tags: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseDetail {
    pub exercise_id: String,
    pub exercise_name: String,
    pub sets: Vec<SetDetail>,
    pub total_volume: u64,
    pub rest_time: u32,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SetDetail {
    pub set_number: u32,
    pub weight: f32,
    pub reps: u32,
    pub rpe: Option<u8>,
    pub rest_after: Option<u32>,
    pub completed: bool,
}

// Request/Response models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GetAnalyticsRequest {
    pub user_id: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub include_predictions: Option<bool>,
    pub include_comparisons: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GetWorkoutHistoryRequest {
    pub user_id: String,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
    pub workout_type: Option<String>,
    pub limit: Option<u32>,
    pub offset: Option<u32>,
    pub sort_by: Option<String>,
    pub sort_order: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportDataRequest {
    pub user_id: String,
    pub data_types: Vec<String>,
    pub format: String, // "json", "csv", "pdf"
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExportDataResponse {
    pub download_url: String,
    pub file_size: u64,
    pub expires_at: String,
    pub format: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CreateMilestoneRequest {
    pub user_id: String,
    pub title: String,
    pub description: String,
    pub target_value: f32,
    pub target_unit: String,
    pub target_date: String,
    pub category: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Milestone {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub description: String,
    pub target_value: f32,
    pub current_value: f32,
    pub target_unit: String,
    pub target_date: String,
    pub created_date: String,
    pub completed_date: Option<String>,
    pub category: String,
    pub progress_percentage: f32,
    pub is_completed: bool,
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

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Achievement {
    pub id: String,
    pub user_id: String,
    pub title: String,
    pub description: String,
    pub category: String, // "strength", "endurance", "consistency", "milestone", "special"
    pub points: i32,
    pub achieved_at: String,
    pub created_at: String,
}
