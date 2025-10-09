use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// Types from workout-service for compatibility
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutSession {
    pub id: String,
    pub user_id: String,
    pub workout_plan_id: Option<String>,
    pub name: String,
    pub started_at: String,
    pub completed_at: Option<String>,
    pub duration_minutes: Option<i32>,
    pub exercises: Vec<SessionExercise>,
    pub notes: Option<String>,
    pub rating: Option<i32>, // 1-5 scale
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SessionExercise {
    pub exercise_id: String,
    pub name: String,
    pub sets: Vec<ExerciseSet>,
    pub notes: Option<String>,
    pub order: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseSet {
    pub set_number: i32,
    pub reps: Option<i32>,
    pub weight: Option<f32>,
    pub duration_seconds: Option<i32>,
    pub rest_seconds: Option<i32>,
    pub completed: bool,
    pub notes: Option<String>,
}

// Analytics-specific types
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PerformanceTrend {
    pub metric: String,
    pub trend_type: String,
    pub period: String,
    pub data_points: Vec<TrendDataPoint>,
    pub slope: f32,
    pub r_squared: f32,
    pub prediction: Option<f32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TrendDataPoint {
    pub date: String,
    pub value: f32,
    pub context: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressSummary {
    pub total_workouts: u32,
    pub total_exercises: u32,
    pub total_volume: u64,
    pub strength_improvement: f32,
    pub consistency_score: f32,
    pub achievements_count: u32,
}

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
pub struct WorkoutAnalytics {
    pub user_id: String,
    pub period: String, // "7d", "30d", "90d", "1y", "all"
    pub total_workouts: u32,
    pub total_exercises: u32,
    pub total_sets: u32,
    pub total_reps: u32,
    pub total_volume: u64,         // weight * reps for all exercises
    pub avg_workout_duration: u32, // in minutes
    pub total_duration_minutes: u32,
    pub average_workout_duration: f32,
    pub consistency_score: f32, // 0.0 to 1.0
    pub strength_trend: Vec<StrengthProgress>,
    pub strength_gains: Vec<StrengthProgress>,
    pub most_trained_muscle_groups: Vec<String>,
    pub favorite_exercises: Vec<String>,
    pub weekly_frequency: f32,
    pub personal_records_count: u32,
    pub achievement_count: u32,
    pub body_measurements: Vec<BodyMeasurement>,
    pub milestones_achieved: Vec<Milestone>,
    pub performance_trends: Vec<PerformanceTrend>,
    pub generated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutInsights {
    pub user_id: String,
    pub period: String,
    pub generated_at: String,
    pub strength_trend: String,
    pub consistency_trend: String,
    pub volume_trend: String,
    pub recovery_analysis: String,
    pub recommendations: Vec<String>,
    pub warnings: Vec<String>,
    pub achievements_unlocked: Vec<String>,
    pub next_milestones: Vec<String>,
    pub plateau_risk: f32,      // 0.0 to 1.0
    pub overtraining_risk: f32, // 0.0 to 1.0
    pub improvement_areas: Vec<String>,
    pub strength_predictions: Vec<PredictedMax>,
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
    pub points: i32,
    pub earned_date: String,
    pub achieved_at: String,
    pub created_at: String,
    pub requirements: serde_json::Value,
    pub metadata: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutPattern {
    pub pattern_type: String, // "weekly_schedule", "exercise_preference", "volume_pattern", "intensity_cycle"
    pub description: String,
    pub strength: f32, // 0.0 to 1.0 - how strong this pattern is
    pub trend: String, // "increasing", "decreasing", "stable"
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PredictedMax {
    pub exercise_id: String,
    pub exercise_name: String,
    pub current_max: f32,
    pub predicted_max: f32,
    pub confidence: f32, // 0.0 to 1.0
    pub timeframe_days: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdvancedMetrics {
    pub user_id: String,
    pub calculated_at: String,
    pub total_volume_load: u64,
    pub volume_per_muscle_group: HashMap<String, u32>,
    pub volume_trend_7d: f32, // percentage change
    pub volume_trend_30d: f32,
    pub intensity_score: f32,         // average relative intensity (0.0-1.0)
    pub frequency_score: f32,         // workouts per week normalized
    pub consistency_score: f32,       // regularity of workouts (0.0-1.0)
    pub progression_rate: f32,        // strength gains per week (%)
    pub recovery_score: f32,          // based on rest days and volume (0.0-1.0)
    pub variety_score: f32,           // exercise variety (0.0-1.0)
    pub balance_score: f32,           // muscle group balance (0.0-1.0)
    pub efficiency_score: f32,        // results per time invested (0.0-1.0)
    pub adaptation_score: f32,        // how well user is adapting to training (0.0-1.0)
    pub fatigue_index: f32,           // estimated fatigue level (0.0-1.0)
    pub peak_performance_day: String, // day of week with best performance
    pub optimal_rest_days: f32,       // recommended rest days between sessions
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeriodComparison {
    pub workouts_change: f32, // percentage change
    pub duration_change: f32,
    pub volume_change: f32,
    pub intensity_change: f32,
    pub consistency_change: f32,
    pub strength_change: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeerComparison {
    pub percentile: u8,                // 0-100, where user ranks among peers
    pub comparison_group: String,      // "similar_experience", "same_age", "same_goals"
    pub metrics: HashMap<String, f32>, // metric_name -> user_vs_peer_ratio
    pub insights: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Milestone {
    pub id: String,
    pub user_id: String,
    pub milestone_type: String, // "strength", "endurance", "consistency", "body_composition"
    pub title: String,
    pub description: String,
    pub target_value: f32,
    pub current_value: f32,
    pub unit: String,
    pub target_date: Option<String>,
    pub created_at: String,
    pub status: String, // "active", "completed", "paused", "failed"
    pub progress_percentage: f32,
    pub achieved: bool,
    pub achieved_at: Option<String>,
    pub metadata: Option<serde_json::Value>,
}

// Enhanced models for comprehensive analytics
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DateRange {
    pub start_date: String,
    pub end_date: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WeeklyVolume {
    pub week_start: String,
    pub volume: u64,
    pub workouts: u32,
    pub avg_intensity: f32,
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
pub struct ExerciseStats {
    pub exercise_id: String,
    pub exercise_name: String,
    pub frequency: u32,
    pub total_sets: u32,
    pub total_reps: u32,
    pub total_volume: u64,
    pub avg_weight: f32,
    pub average_weight: f32,
    pub max_weight: f32,
    pub progression_rate: f32,
    pub improvement_rate: f32,
    pub last_performed: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressReport {
    pub report_id: String,
    pub user_id: String,
    pub report_type: String, // "weekly", "monthly", "quarterly", "yearly"
    pub period_start: String,
    pub period_end: String,
    pub generated_at: String,
    pub summary: ProgressSummary,
    pub detailed_analytics: WorkoutAnalytics,
    pub key_achievements: Vec<Achievement>,
    pub strength_progress: Vec<StrengthProgress>,
    pub body_measurements: Vec<BodyMeasurement>,
    pub workout_analytics: WorkoutAnalytics,
    pub insights: WorkoutInsights,
    pub milestones: Vec<Milestone>,
    pub recommendations: Vec<String>,
    pub charts: Vec<ProgressChart>,
    pub export_formats: Vec<String>, // "pdf", "json", "csv"
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
    pub unit: String,
    pub target_date: Option<String>,
    pub milestone_type: String,
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

// Advanced analytics models
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
    pub strength: f32,     // 0-1 scale
    pub duration_days: u32,
    pub slope: f32,
    pub r_squared: f32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DataPoint {
    pub metric: String,
    pub value: f32,
    pub date: String,
    pub context: Option<String>,
}

// Comprehensive metrics structures
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
pub struct PeriodData {
    pub start_date: String,
    pub end_date: String,
    pub value: f32,
    pub sample_size: u32,
}

// Progress Photos Models
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressPhoto {
    pub id: String,
    pub user_id: String,
    pub photo_type: String, // 'before', 'after', 'progress', 'front', 'side', 'back'
    pub photo_url: String,
    pub s3_key: String,
    pub taken_at: String,
    pub notes: Option<String>,
    pub workout_session_id: Option<String>,
    pub tags: Vec<String>,
    pub metadata: Option<PhotoMetadata>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhotoMetadata {
    pub file_size: Option<u64>,
    pub dimensions: Option<PhotoDimensions>,
    pub device_info: Option<String>,
    pub location: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhotoDimensions {
    pub width: u32,
    pub height: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressPhotoAnalytics {
    pub total_photos: u32,
    pub photos_by_type: HashMap<String, u32>,
    pub photos_by_month: Vec<MonthlyPhotoCount>,
    pub upload_frequency: PhotoUploadFrequency,
    pub consistency_score: f32, // 0-100 based on regularity of uploads
    pub transformation_insights: TransformationInsights,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MonthlyPhotoCount {
    pub month: String,
    pub count: u32,
    pub types: HashMap<String, u32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhotoUploadFrequency {
    pub daily_average: f32,
    pub weekly_average: f32,
    pub monthly_average: f32,
    pub longest_streak: u32,
    pub current_streak: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TransformationInsights {
    pub total_duration_days: u32,
    pub milestone_photos: Vec<MilestonePhoto>,
    pub progress_indicators: Vec<ProgressIndicator>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MilestonePhoto {
    pub photo_id: String,
    pub milestone_type: String, // 'first', '30_days', '90_days', '6_months', '1_year'
    pub date: String,
    pub significance: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressIndicator {
    pub indicator_type: String, // 'visual_change', 'consistency', 'milestone'
    pub value: f32,
    pub description: String,
    pub trend: String, // 'improving', 'stable', 'declining'
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhotoComparison {
    pub comparison_id: String,
    pub photos: Vec<ProgressPhoto>,
    pub time_span_days: u32,
    pub comparison_type: String, // 'before_after', 'progress_timeline', 'side_by_side'
    pub insights: Vec<ComparisonInsight>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ComparisonInsight {
    pub insight_type: String,
    pub confidence: f32,
    pub description: String,
    pub supporting_data: Option<serde_json::Value>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PhotoTimelineEntry {
    pub date: String,
    pub photos: Vec<ProgressPhoto>,
    pub week_number: u32,
    pub month_name: String,
    pub days_since_start: u32,
    pub workout_context: Option<WorkoutContext>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutContext {
    pub sessions_that_week: u32,
    pub primary_focus: Option<String>,
    pub achievements: Vec<String>,
}
