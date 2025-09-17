use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutRecommendation {
    pub id: String,
    pub user_id: String,
    pub recommendation_type: String, // "workout_plan", "exercise_substitution", "difficulty_adjustment", "recovery_plan"
    pub title: String,
    pub description: String,
    pub reasoning: String,
    pub priority: u32, // 1-5, 5 being highest
    pub created_at: String,
    pub expires_at: Option<String>,
    pub is_applied: bool,
    pub metadata: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdaptivePlan {
    pub id: String,
    pub user_id: String,
    pub base_plan_id: String,
    pub adaptations: Vec<PlanAdaptation>,
    pub adaptation_reason: String,
    pub created_at: String,
    pub updated_at: String,
    pub is_active: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PlanAdaptation {
    pub exercise_id: String,
    pub adaptation_type: String, // "substitute", "modify", "remove", "add"
    pub original_exercise: Option<ExerciseInfo>,
    pub new_exercise: Option<ExerciseInfo>,
    pub modifications: Option<ExerciseModifications>,
    pub reason: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseInfo {
    pub id: String,
    pub name: String,
    pub category: String,
    pub muscle_groups: Vec<String>,
    pub equipment: Vec<String>,
    pub difficulty: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseModifications {
    pub sets: Option<u32>,
    pub reps: Option<u32>,
    pub duration_seconds: Option<u32>,
    pub weight: Option<f32>,
    pub rest_seconds: Option<u32>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExerciseSubstitution {
    pub original_exercise_id: String,
    pub substitute_exercise_id: String,
    pub reason: String,
    pub confidence_score: f32, // 0.0 - 1.0
    pub muscle_groups_match: Vec<String>,
    pub equipment_available: bool,
    pub difficulty_match: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecoveryPlan {
    pub id: String,
    pub user_id: String,
    pub plan_type: String, // "deload", "rest_day", "active_recovery", "injury_prevention"
    pub duration_days: u32,
    pub activities: Vec<RecoveryActivity>,
    pub created_at: String,
    pub starts_at: String,
    pub ends_at: String,
    pub is_completed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RecoveryActivity {
    pub id: String,
    pub name: String,
    pub activity_type: String, // "stretching", "light_cardio", "mobility", "massage", "rest"
    pub duration_minutes: u32,
    pub intensity: String, // "low", "moderate", "high"
    pub instructions: Vec<String>,
    pub equipment_needed: Vec<String>,
    pub order: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DifficultyAdjustment {
    pub id: String,
    pub user_id: String,
    pub workout_plan_id: String,
    pub adjustment_type: String, // "increase", "decrease", "maintain"
    pub adjustment_factor: f32, // 0.1 - 2.0
    pub affected_exercises: Vec<String>,
    pub reason: String,
    pub confidence_score: f32,
    pub created_at: String,
    pub applied_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserFitnessProfile {
    pub user_id: String,
    pub experience_level: String, // "beginner", "intermediate", "advanced"
    pub fitness_goals: Vec<String>,
    pub current_strength_levels: std::collections::HashMap<String, f32>, // exercise_id -> max_weight
    pub recent_performance: Vec<WorkoutPerformance>,
    pub injury_history: Vec<InjuryRecord>,
    pub preferences: UserPreferences,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutPerformance {
    pub workout_id: String,
    pub date: String,
    pub exercises: Vec<ExercisePerformance>,
    pub overall_rating: u32, // 1-5
    pub difficulty_perceived: u32, // 1-5
    pub completion_rate: f32, // 0.0 - 1.0
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExercisePerformance {
    pub exercise_id: String,
    pub sets_completed: u32,
    pub total_sets: u32,
    pub average_weight: f32,
    pub average_reps: f32,
    pub perceived_difficulty: u32, // 1-5
    pub form_rating: u32, // 1-5
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct InjuryRecord {
    pub id: String,
    pub body_part: String,
    pub injury_type: String,
    pub severity: String, // "mild", "moderate", "severe"
    pub date_occurred: String,
    pub date_recovered: Option<String>,
    pub restrictions: Vec<String>,
    pub notes: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserPreferences {
    pub workout_duration_preference: u32, // minutes
    pub frequency_preference: u32, // days per week
    pub intensity_preference: String, // "low", "moderate", "high"
    pub equipment_available: Vec<String>,
    pub time_of_day_preference: String, // "morning", "afternoon", "evening"
    pub workout_types: Vec<String>, // "strength", "cardio", "flexibility", "sports"
    pub avoid_exercises: Vec<String>,
    pub preferred_exercises: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoachingRule {
    pub id: String,
    pub rule_type: String, // "progression", "substitution", "recovery", "safety"
    pub condition: RuleCondition,
    pub action: RuleAction,
    pub priority: u32,
    pub is_active: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuleCondition {
    pub field: String, // "completion_rate", "perceived_difficulty", "injury_risk", "time_since_last_workout"
    pub operator: String, // ">", "<", ">=", "<=", "==", "!="
    pub value: serde_json::Value,
    pub time_window: Option<u32>, // days
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RuleAction {
    pub action_type: String, // "increase_difficulty", "decrease_difficulty", "substitute_exercise", "add_recovery", "modify_plan"
    pub parameters: std::collections::HashMap<String, serde_json::Value>,
    pub message: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CoachingSession {
    pub id: String,
    pub user_id: String,
    pub session_type: String, // "workout_review", "plan_adaptation", "recovery_assessment", "goal_check"
    pub recommendations: Vec<WorkoutRecommendation>,
    pub adaptations: Vec<PlanAdaptation>,
    pub created_at: String,
    pub completed_at: Option<String>,
    pub status: String, // "pending", "in_progress", "completed", "cancelled"
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProgressMetrics {
    pub user_id: String,
    pub period: String, // "week", "month", "quarter", "year"
    pub start_date: String,
    pub end_date: String,
    pub strength_gains: std::collections::HashMap<String, f32>, // exercise_id -> weight_increase
    pub volume_increase: f32, // total volume increase
    pub consistency_score: f32, // 0.0 - 1.0
    pub improvement_areas: Vec<String>,
    pub recommendations: Vec<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorkoutPlanTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub target_audience: String, // "beginner", "intermediate", "advanced"
    pub goals: Vec<String>,
    pub duration_weeks: u32,
    pub frequency_per_week: u32,
    pub exercises: Vec<TemplateExercise>,
    pub progression_rules: Vec<CoachingRule>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateExercise {
    pub exercise_id: String,
    pub name: String,
    pub category: String,
    pub muscle_groups: Vec<String>,
    pub equipment: Vec<String>,
    pub difficulty: String,
    pub sets: u32,
    pub reps: Option<u32>,
    pub duration_seconds: Option<u32>,
    pub rest_seconds: u32,
    pub order: u32,
    pub notes: Option<String>,
}
