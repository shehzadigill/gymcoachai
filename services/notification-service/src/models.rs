use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct Device {
    #[validate(length(min = 1, max = 255))]
    pub device_id: String,

    #[validate(length(min = 1, max = 255))]
    pub user_id: String,

    #[validate(length(min = 1, max = 1000))]
    pub device_token: String,

    #[validate(length(min = 1, max = 50))]
    pub platform: String, // "ios", "android", "web"

    pub device_name: Option<String>,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
    pub last_used_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct Notification {
    #[validate(length(min = 1, max = 255))]
    pub notification_id: String,

    #[validate(length(min = 1, max = 255))]
    pub user_id: String,

    #[validate(length(min = 1, max = 100))]
    pub notification_type: String,

    #[validate(length(min = 1, max = 200))]
    pub title: String,

    #[validate(length(min = 1, max = 500))]
    pub body: String,

    pub data: Option<serde_json::Value>,
    pub sent_at: DateTime<Utc>,
    pub delivery_status: DeliveryStatus,
    pub ttl: i64, // Unix timestamp for TTL
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum DeliveryStatus {
    Pending,
    Sent,
    Delivered,
    Failed,
    Bounced,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct NotificationPreferences {
    pub workout_reminders: bool,
    pub nutrition_reminders: bool,
    pub water_reminders: bool,
    pub progress_photos: bool,
    pub achievements: bool,
    pub ai_suggestions: bool,

    #[validate(length(min = 1, max = 10))]
    pub workout_reminder_time: Option<String>, // HH:MM format

    pub nutrition_reminder_times: Option<Vec<String>>, // ["08:00", "13:00", "19:00"]

    #[validate(length(min = 1, max = 50))]
    pub timezone: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScheduledNotification {
    pub user_id: String,
    pub notification_type: String,
    pub title: String,
    pub body: String,
    pub data: Option<serde_json::Value>,
    pub scheduled_time: DateTime<Utc>,
    pub timezone: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NotificationTemplate {
    pub notification_type: String,
    pub title_template: String,
    pub body_template: String,
    pub default_data: Option<serde_json::Value>,
}

impl Default for NotificationPreferences {
    fn default() -> Self {
        Self {
            workout_reminders: true,
            nutrition_reminders: true,
            water_reminders: true,
            progress_photos: true,
            achievements: true,
            ai_suggestions: true,
            workout_reminder_time: Some("08:00".to_string()),
            nutrition_reminder_times: Some(vec![
                "08:00".to_string(),
                "13:00".to_string(),
                "19:00".to_string(),
            ]),
            timezone: Some("UTC".to_string()),
        }
    }
}

impl NotificationTemplate {
    pub fn workout_reminder() -> Self {
        Self {
            notification_type: "workout_reminder".to_string(),
            title_template: "Time for your workout! 💪".to_string(),
            body_template: "Your scheduled workout is ready. Let's get moving!".to_string(),
            default_data: Some(serde_json::json!({
                "action": "start_workout",
                "category": "workout"
            })),
        }
    }

    pub fn nutrition_reminder() -> Self {
        Self {
            notification_type: "nutrition_reminder".to_string(),
            title_template: "Time to log your meal! 🍽️".to_string(),
            body_template: "Don't forget to log your {meal_type} to track your nutrition goals."
                .to_string(),
            default_data: Some(serde_json::json!({
                "action": "log_meal",
                "category": "nutrition"
            })),
        }
    }

    pub fn water_reminder() -> Self {
        Self {
            notification_type: "water_reminder".to_string(),
            title_template: "Stay hydrated! 💧".to_string(),
            body_template:
                "Time for a glass of water. You've had {glasses_consumed} glasses today."
                    .to_string(),
            default_data: Some(serde_json::json!({
                "action": "log_water",
                "category": "hydration"
            })),
        }
    }

    pub fn achievement() -> Self {
        Self {
            notification_type: "achievement".to_string(),
            title_template: "Achievement Unlocked! 🏆".to_string(),
            body_template: "Congratulations! You've achieved: {achievement_name}".to_string(),
            default_data: Some(serde_json::json!({
                "action": "view_achievement",
                "category": "achievement"
            })),
        }
    }

    pub fn ai_suggestion() -> Self {
        Self {
            notification_type: "ai_suggestion".to_string(),
            title_template: "AI Trainer Suggestion 🤖".to_string(),
            body_template: "{suggestion_text}".to_string(),
            default_data: Some(serde_json::json!({
                "action": "view_suggestion",
                "category": "ai_suggestion"
            })),
        }
    }

    pub fn progress_photo() -> Self {
        Self {
            notification_type: "progress_photo".to_string(),
            title_template: "Weekly Progress Check! 📸".to_string(),
            body_template: "Time to take your weekly progress photo and track your transformation!"
                .to_string(),
            default_data: Some(serde_json::json!({
                "action": "take_progress_photo",
                "category": "progress"
            })),
        }
    }
}
