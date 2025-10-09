use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
pub struct WorkoutPlan {
    pub id: String,
    pub user_id: String,
    pub name: String,
    pub description: Option<String>,
    pub difficulty: String, // "beginner", "intermediate", "advanced"
    pub duration_weeks: i32,
    pub frequency_per_week: i32,
    pub exercises: Vec<WorkoutExercise>,
    pub created_at: String,
    pub updated_at: String,
    pub is_active: bool,
    // Enhanced features
    pub tags: Option<Vec<String>>,           // Plan tags for categorization
    pub rating: Option<f32>,                 // User rating (1-5)
    pub is_template: Option<bool>,           // Template flag
    pub total_sessions: Option<i32>,         // Calculated field
    pub completed_sessions: Option<i32>,     // Progress tracking
    pub next_scheduled_date: Option<String>, // Next workout date
}

#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
pub struct WorkoutExercise {
    pub exercise_id: String,
    pub name: String,
    pub sets: i32,
    pub reps: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub weight: Option<f32>,
    pub rest_seconds: Option<i32>,
    pub notes: Option<String>,
    pub order: i32,
}

#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
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

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct SessionExercise {
    pub exercise_id: String,
    pub name: String,
    pub sets: Vec<ExerciseSet>,
    pub notes: Option<String>,
    pub order: i32,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct ExerciseSet {
    pub set_number: i32,
    pub reps: Option<i32>,
    pub weight: Option<f32>,
    pub duration_seconds: Option<i32>,
    pub rest_seconds: Option<i32>,
    pub completed: bool,
    pub notes: Option<String>,
}

#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
pub struct Exercise {
    pub id: String,
    pub name: String,
    pub description: Option<String>,
    pub category: String, // "strength", "cardio", "flexibility", "sports"
    pub muscle_groups: Vec<String>,
    pub equipment: Vec<String>,
    pub difficulty: String, // "beginner", "intermediate", "advanced"
    pub instructions: Vec<String>,
    pub tips: Option<String>,
    pub video_url: Option<String>,
    pub image_url: Option<String>,
    pub created_by: Option<String>, // user_id if user-created, None for system exercises
    pub is_system: bool, // true for system exercises, false for user-created
    pub tags: Vec<String>, // additional tags like "system", "favorite", "custom"
    pub created_at: String,
    pub updated_at: String,
}



#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
pub struct ScheduledWorkout {
    pub id: String,
    pub plan_id: String,
    pub user_id: String,
    pub plan_name: String,
    pub scheduled_date: String,      // ISO date string (YYYY-MM-DD)
    pub scheduled_time: String,      // Time in HH:MM format
    pub status: String,              // "scheduled", "completed", "missed", "cancelled"
    pub week: i32,                   // Week number in plan
    pub day: i32,                    // Day number in week
    pub notes: Option<String>,
    pub completed_at: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct WorkoutAnalytics {
    pub user_id: String,
    pub total_workouts: i32,
    pub total_duration_minutes: i32,
    pub current_streak: i32,
    pub longest_streak: i32,
    pub favorite_exercises: Vec<String>,
    pub average_workout_duration: f32,
    pub workouts_this_week: i32,
    pub workouts_this_month: i32,
    pub last_workout_date: Option<String>,
    pub strength_progress: Vec<StrengthProgress>,
    pub body_measurements: Vec<BodyMeasurement>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct StrengthProgress {
    pub exercise_id: String,
    pub exercise_name: String,
    pub one_rep_max: f32,
    pub last_updated: String,
    pub progress_percentage: f32,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct BodyMeasurement {
    pub measurement_type: String, // "weight", "body_fat", "muscle_mass", "chest", "waist", etc.
    pub value: f32,
    pub unit: String,
    pub measured_at: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct WorkoutHistory {
    pub sessions: Vec<WorkoutSession>,
    pub pagination: Pagination,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct Pagination {
    pub page: i32,
    pub limit: i32,
    pub total: i32,
    pub total_pages: i32,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct UploadRequest {
    pub file_type: String,
    pub file_size: Option<u64>,
    pub photo_type: String,
    pub workout_session_id: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct WorkoutInsights {
    pub user_id: String,
    pub time_range: String,
    pub overall_score: i32,
    pub insights: Vec<String>,
    pub recommendations: Vec<String>,
    pub achievements: Vec<String>,
    pub risk_factors: Vec<String>,
    pub risk_recommendations: Vec<String>,
    pub generated_at: String,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct UploadResponse {
    pub upload_url: String,
    pub key: String,
    pub expires_in: u64,
}
