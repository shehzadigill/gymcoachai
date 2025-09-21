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
pub struct UserPreferences {
    pub units: String, // "metric" or "imperial"
    pub timezone: String,
    pub notifications: NotificationSettings,
    pub privacy: PrivacySettings,
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
    pub bucket_name: String,
    pub expires_in: u64,
}
