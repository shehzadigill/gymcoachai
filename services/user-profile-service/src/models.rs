use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Deserialize, Serialize, Validate, Debug, Clone)]
pub struct UserProfile {
    #[validate(length(min = 1, max = 100))]
    #[serde(alias = "firstName")]
    pub first_name: String,
    #[validate(length(min = 1, max = 100))]
    #[serde(alias = "lastName")]
    pub last_name: String,
    #[validate(email)]
    pub email: String,
    #[validate(length(min = 0, max = 500))]
    pub bio: Option<String>,
    #[serde(alias = "dateOfBirth")]
    pub date_of_birth: Option<String>,
    // Height in centimeters; accept multiple input key variants from clients
    #[serde(alias = "height_cm", alias = "heightCm")]
    pub height: Option<i32>, // in cm
    // Weight in kilograms; accept multiple input key variants from clients
    #[serde(alias = "weight_kg", alias = "weightKg")]
    pub weight: Option<f32>, // in kg
    #[serde(alias = "fitnessGoals")]
    pub fitness_goals: Vec<String>,
    #[serde(alias = "experienceLevel")]
    pub experience_level: String,
    #[serde(alias = "profileImageUrl")]
    pub profile_image_url: Option<String>,
    pub preferences: UserPreferences,
    // These fields are often omitted by clients; default to empty string
    #[serde(default, alias = "createdAt")]
    pub created_at: String,
    #[serde(default, alias = "updatedAt")]
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
    #[serde(alias = "workoutReminders")]
    pub workout_reminders: bool,
    #[serde(alias = "nutritionReminders")]
    pub nutrition_reminders: bool,
}

#[derive(Deserialize, Serialize, Debug, Clone)]
pub struct PrivacySettings {
    #[serde(alias = "profileVisibility")]
    pub profile_visibility: String, // "public", "private", "friends"
    #[serde(alias = "workoutSharing")]
    pub workout_sharing: bool,
    #[serde(alias = "progressSharing")]
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
