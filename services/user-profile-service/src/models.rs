use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
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
    pub height: Option<i32>, // in cm
    pub weight: Option<f32>, // in kg
    pub fitness_goals: Vec<String>,
    pub experience_level: String,
    pub profile_image_url: Option<String>,
    pub preferences: UserPreferences,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UserPreferences {
    pub units: String, // "metric" or "imperial"
    pub timezone: String,
    pub notifications: NotificationSettings,
    pub privacy: PrivacySettings,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct NotificationSettings {
    pub email: bool,
    pub push: bool,
    pub workout_reminders: bool,
    pub nutrition_reminders: bool,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PrivacySettings {
    pub profile_visibility: String, // "public", "private", "friends"
    pub workout_sharing: bool,
    pub progress_sharing: bool,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct UserStats {
    pub total_workouts: i32,
    pub total_workout_time: i32, // in minutes
    pub current_streak: i32, // days
    pub longest_streak: i32, // days
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
    pub expires_in: u64,
}
