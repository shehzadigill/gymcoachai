use serde::{Deserialize, Serialize};
use validator::Validate;
use chrono::{DateTime, Utc};

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct User {
    #[validate(length(min = 1, max = 255))]
    pub id: String,
    
    #[validate(email)]
    pub email: String,
    
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    
    #[validate(length(min = 8, max = 20))]
    pub username: Option<String>,
    
    pub phone_number: Option<String>,
    pub date_of_birth: Option<DateTime<Utc>>,
    pub gender: Option<Gender>,
    pub profile_picture_url: Option<String>,
    
    pub is_active: bool,
    pub is_verified: bool,
    pub email_verified: bool,
    pub phone_verified: bool,
    
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
    
    pub preferences: UserPreferences,
    pub subscription: Option<Subscription>,
    pub roles: Vec<Role>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Gender {
    Male,
    Female,
    Other,
    PreferNotToSay,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct UserPreferences {
    #[validate(length(min = 1, max = 50))]
    pub units: String, // "metric" or "imperial"
    
    #[validate(length(min = 1, max = 50))]
    pub timezone: String,
    
    #[validate(length(min = 1, max = 10))]
    pub language: String,
    
    pub notifications: NotificationPreferences,
    pub privacy: PrivacyPreferences,
    pub fitness: FitnessPreferences,
    pub nutrition: NutritionPreferences,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationPreferences {
    pub email: bool,
    pub push: bool,
    pub sms: bool,
    pub workout_reminders: bool,
    pub nutrition_reminders: bool,
    pub progress_updates: bool,
    pub social_notifications: bool,
    pub marketing_emails: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PrivacyPreferences {
    pub profile_visibility: ProfileVisibility,
    pub workout_sharing: bool,
    pub progress_sharing: bool,
    pub nutrition_sharing: bool,
    pub social_features: bool,
    pub data_analytics: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ProfileVisibility {
    Public,
    Private,
    FriendsOnly,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FitnessPreferences {
    pub primary_goal: FitnessGoal,
    pub experience_level: ExperienceLevel,
    pub workout_frequency: u8, // days per week
    pub preferred_workout_times: Vec<String>, // ["morning", "afternoon", "evening"]
    pub equipment_available: Vec<String>,
    pub workout_duration: u16, // minutes
    pub injury_considerations: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FitnessGoal {
    WeightLoss,
    MuscleGain,
    Strength,
    Endurance,
    Flexibility,
    GeneralFitness,
    AthleticPerformance,
    Rehabilitation,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ExperienceLevel {
    Beginner,
    Intermediate,
    Advanced,
    Expert,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NutritionPreferences {
    pub dietary_restrictions: Vec<DietaryRestriction>,
    pub allergies: Vec<String>,
    pub preferred_cuisines: Vec<String>,
    pub meal_preferences: Vec<MealPreference>,
    pub calorie_goal: Option<u16>,
    pub macro_goals: Option<MacroGoals>,
    pub water_intake_goal: Option<f32>, // liters per day
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DietaryRestriction {
    Vegetarian,
    Vegan,
    Pescatarian,
    GlutenFree,
    DairyFree,
    NutFree,
    Keto,
    Paleo,
    Mediterranean,
    LowCarb,
    HighProtein,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum MealPreference {
    Breakfast,
    Lunch,
    Dinner,
    Snacks,
    PreWorkout,
    PostWorkout,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MacroGoals {
    pub protein_percentage: f32,
    pub carbs_percentage: f32,
    pub fat_percentage: f32,
    pub fiber_goal: f32, // grams
    pub sugar_limit: f32, // grams
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Subscription {
    pub plan: SubscriptionPlan,
    pub status: SubscriptionStatus,
    pub start_date: DateTime<Utc>,
    pub end_date: Option<DateTime<Utc>>,
    pub auto_renew: bool,
    pub payment_method: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionPlan {
    Free,
    Basic,
    Premium,
    Pro,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum SubscriptionStatus {
    Active,
    Inactive,
    Cancelled,
    Expired,
    Pending,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Role {
    User,
    Coach,
    Admin,
    Moderator,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateUserRequest {
    #[validate(email)]
    pub email: String,
    
    #[validate(length(min = 1, max = 100))]
    pub name: String,
    
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    
    #[validate(length(min = 8, max = 20))]
    pub username: Option<String>,
    
    pub phone_number: Option<String>,
    pub date_of_birth: Option<DateTime<Utc>>,
    pub gender: Option<Gender>,
    
    pub preferences: Option<UserPreferences>,
    pub subscription: Option<Subscription>,
    pub roles: Option<Vec<Role>>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct UpdateUserRequest {
    pub name: Option<String>,
    pub first_name: Option<String>,
    pub last_name: Option<String>,
    pub username: Option<String>,
    pub phone_number: Option<String>,
    pub date_of_birth: Option<DateTime<Utc>>,
    pub gender: Option<Gender>,
    pub profile_picture_url: Option<String>,
    pub preferences: Option<UserPreferences>,
    pub subscription: Option<Subscription>,
    pub roles: Option<Vec<Role>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserListResponse {
    pub users: Vec<UserSummary>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserSummary {
    pub id: String,
    pub email: String,
    pub name: String,
    pub username: Option<String>,
    pub profile_picture_url: Option<String>,
    pub is_active: bool,
    pub is_verified: bool,
    pub created_at: DateTime<Utc>,
    pub last_login_at: Option<DateTime<Utc>>,
    pub roles: Vec<Role>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PaginationInfo {
    pub page: u32,
    pub limit: u32,
    pub total: u32,
    pub total_pages: u32,
    pub has_next: bool,
    pub has_prev: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UserStats {
    pub total_users: u32,
    pub active_users: u32,
    pub verified_users: u32,
    pub new_users_today: u32,
    pub new_users_this_week: u32,
    pub new_users_this_month: u32,
    pub subscription_stats: SubscriptionStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SubscriptionStats {
    pub free_users: u32,
    pub basic_users: u32,
    pub premium_users: u32,
    pub pro_users: u32,
    pub total_revenue: f64,
    pub monthly_recurring_revenue: f64,
}

impl Default for UserPreferences {
    fn default() -> Self {
        Self {
            units: "metric".to_string(),
            timezone: "UTC".to_string(),
            language: "en".to_string(),
            notifications: NotificationPreferences::default(),
            privacy: PrivacyPreferences::default(),
            fitness: FitnessPreferences::default(),
            nutrition: NutritionPreferences::default(),
        }
    }
}

impl Default for NotificationPreferences {
    fn default() -> Self {
        Self {
            email: true,
            push: true,
            sms: false,
            workout_reminders: true,
            nutrition_reminders: true,
            progress_updates: true,
            social_notifications: false,
            marketing_emails: false,
        }
    }
}

impl Default for PrivacyPreferences {
    fn default() -> Self {
        Self {
            profile_visibility: ProfileVisibility::Private,
            workout_sharing: false,
            progress_sharing: false,
            nutrition_sharing: false,
            social_features: false,
            data_analytics: true,
        }
    }
}

impl Default for FitnessPreferences {
    fn default() -> Self {
        Self {
            primary_goal: FitnessGoal::GeneralFitness,
            experience_level: ExperienceLevel::Beginner,
            workout_frequency: 3,
            preferred_workout_times: vec!["evening".to_string()],
            equipment_available: vec![],
            workout_duration: 45,
            injury_considerations: vec![],
        }
    }
}

impl Default for NutritionPreferences {
    fn default() -> Self {
        Self {
            dietary_restrictions: vec![],
            allergies: vec![],
            preferred_cuisines: vec![],
            meal_preferences: vec![
                MealPreference::Breakfast,
                MealPreference::Lunch,
                MealPreference::Dinner,
            ],
            calorie_goal: None,
            macro_goals: None,
            water_intake_goal: Some(2.5), // 2.5 liters per day
        }
    }
}
