use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserProfile {
    #[validate(length(min = 1, max = 100))]
    pub first_name: String,
    #[validate(length(min = 1, max = 100))]
    pub last_name: String,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 0, max = 500))]
    pub bio: Option<String>,
    pub date_of_birth: Option<String>,
    // Height in centimeters
    pub height: Option<i32>, // in cm
    // Weight in kilograms
    pub weight: Option<f32>, // in kg
    pub fitness_goals: Vec<String>,
    pub experience_level: String,
    pub profile_image_url: Option<String>,
    pub preferences: UserPreferences,
    pub gender: Option<String>,
    pub fitness_level: Option<String>,
    // These fields are often omitted by clients; default to empty string
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DailyGoals {
    pub calories: i32,
    pub water: i32,
    pub protein: i32,
    pub carbs: i32,
    pub fat: i32,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserPreferences {
    pub units: String, // "metric" or "imperial"
    pub timezone: String,
    pub notifications: NotificationSettings,
    pub privacy: PrivacySettings,
    pub daily_goals: Option<DailyGoals>,
    pub ai_trainer: Option<AITrainerPreferences>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct NotificationSettings {
    pub email: bool,
    pub push: bool,
    pub workout_reminders: bool,
    pub nutrition_reminders: bool,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct PrivacySettings {
    pub profile_visibility: String, // "public", "private", "friends"
    pub workout_sharing: bool,
    pub progress_sharing: bool,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AITrainerPreferences {
    pub enabled: bool,
    pub coaching_style: String, // "motivational", "strict", "balanced", "technical"
    pub communication_frequency: String, // "daily", "weekly", "on-demand"
    pub focus_areas: Vec<String>, // ["strength", "cardio", "flexibility", "nutrition"]
    pub injury_history: Vec<String>,
    pub equipment_available: Vec<String>, // ["dumbbells", "barbell", "resistance_bands", "bodyweight"]
    pub workout_duration_preference: i32, // minutes
    pub workout_days_per_week: i32,
    pub meal_preferences: Vec<String>, // ["vegetarian", "vegan", "keto", "paleo", "no_restrictions"]
    pub allergies: Vec<String>,
    pub supplement_preferences: Vec<String>,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct UserStats {
    pub total_workouts: i32,
    pub total_workout_time: i32, // in minutes
    pub current_streak: i32,     // days
    pub longest_streak: i32,     // days
    pub favorite_exercises: Vec<String>,
    pub achievements: Vec<String>,
    pub last_workout_date: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct UploadRequest {
    pub file_type: String,
    pub file_size: Option<u64>,
}

#[derive(Deserialize, Serialize, Debug)]
pub struct UploadResponse {
    pub upload_url: String,
    pub key: String,
    pub bucket_name: String,
    pub expires_in: u64,
}

#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SleepData {
    pub user_id: String,
    #[validate(length(min = 1))]
    pub date: String, // ISO date string (YYYY-MM-DD)
    #[validate(range(min = 0, max = 24))]
    pub hours: u8, // Sleep duration in hours (0-24)
    #[validate(range(min = 0, max = 59))]
    pub minutes: Option<u8>, // Additional minutes (0-59)
    #[validate(range(min = 1, max = 5))]
    pub quality: Option<u8>, // Sleep quality (1-5 scale)
    pub bed_time: Option<String>,  // Bedtime in HH:MM format
    pub wake_time: Option<String>, // Wake time in HH:MM format
    #[validate(length(max = 1000))]
    pub notes: Option<String>, // Optional sleep notes
    #[serde(default)]
    pub created_at: String,
    #[serde(default)]
    pub updated_at: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SleepStats {
    pub user_id: String,
    pub period: String, // "week", "month", "year"
    pub average_hours: f32,
    pub average_quality: f32,
    pub total_nights: u32,
    pub best_night: SleepNight,
    pub worst_night: SleepNight,
    pub consistency: f32, // percentage (0-100)
    pub trend: String,    // "improving", "declining", "stable"
    pub calculated_at: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SleepNight {
    pub date: String,
    pub hours: f32,
    pub quality: u8,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SleepHistoryRequest {
    pub user_id: Option<String>,
    pub days: Option<u32>,
    pub start_date: Option<String>,
    pub end_date: Option<String>,
}

#[derive(Deserialize, Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct SleepStatsRequest {
    pub user_id: Option<String>,
    pub period: Option<String>, // "week", "month", "year"
}
