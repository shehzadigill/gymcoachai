use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{info, error};
use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use aws_sdk_lambda::{Client as LambdaClient};
use std::collections::HashMap;
use chrono::{DateTime, Utc, Timelike, Datelike};
use chrono_tz::Tz;

#[derive(Deserialize)]
struct EventBridgeEvent {
    #[serde(rename = "source")]
    source: String,
    #[serde(rename = "detail-type")]
    detail_type: String,
    detail: Value,
}

#[derive(Serialize)]
struct NotificationRequest {
    user_id: String,
    notification_type: String,
    title: String,
    body: String,
    data: Option<Value>,
}

struct SchedulerService {
    dynamodb: DynamoDbClient,
    lambda: LambdaClient,
    table_name: String,
    notification_service_function_arn: String,
}

impl SchedulerService {
    async fn new() -> Result<Self, Error> {
        let config = aws_config::load_from_env().await;
        let dynamodb = DynamoDbClient::new(&config);
        let lambda = LambdaClient::new(&config);
        
        let table_name = std::env::var("TABLE_NAME")
            .map_err(|e| Error::from(format!("TABLE_NAME environment variable not set: {}", e)))?;
        
        let notification_service_function_arn = std::env::var("NOTIFICATION_SERVICE_FUNCTION_ARN")
            .map_err(|e| Error::from(format!("NOTIFICATION_SERVICE_FUNCTION_ARN environment variable not set: {}", e)))?;
        
        Ok(Self {
            dynamodb,
            lambda,
            table_name,
            notification_service_function_arn,
        })
    }
    
    async fn process_scheduled_notifications(&self) -> Result<usize, Error> {
        let now = Utc::now();
        let mut processed_count = 0;
        
        info!("Processing scheduled notifications at: {}", now);
        
        // Get all users with notification preferences
        let users = self.get_users_with_preferences().await?;
        
        for user in users {
            let preferences = self.get_user_preferences(&user.user_id).await?;
            
            // Check if it's time for workout reminders
            if preferences.workout_reminders {
                if let Some(reminder_time) = &preferences.workout_reminder_time {
                    if self.is_time_for_reminder(&now, reminder_time, &preferences.timezone) {
                        self.send_workout_reminder(&user.user_id).await?;
                        processed_count += 1;
                    }
                }
            }
            
            // Check if it's time for nutrition reminders
            if preferences.nutrition_reminders {
                if let Some(reminder_times) = &preferences.nutrition_reminder_times {
                    for reminder_time in reminder_times {
                        if self.is_time_for_reminder(&now, reminder_time, &preferences.timezone) {
                            self.send_nutrition_reminder(&user.user_id, reminder_time).await?;
                            processed_count += 1;
                        }
                    }
                }
            }
            
            // Check if it's time for water reminders (every 2 hours)
            if preferences.water_reminders {
                if self.is_time_for_water_reminder(&now, &preferences.timezone) {
                    self.send_water_reminder(&user.user_id).await?;
                    processed_count += 1;
                }
            }
            
            // Check if it's time for progress photo reminders (weekly)
            if preferences.progress_photos {
                if self.is_time_for_progress_photo(&now, &preferences.timezone) {
                    self.send_progress_photo_reminder(&user.user_id).await?;
                    processed_count += 1;
                }
            }
        }
        
        info!("Processed {} scheduled notifications", processed_count);
        Ok(processed_count)
    }
    
    async fn get_users_with_preferences(&self) -> Result<Vec<User>, Error> {
        // Query all users who have notification preferences
        let result = self.dynamodb
            .scan()
            .table_name(&self.table_name)
            .filter_expression("SK = :sk")
            .expression_attribute_values(":sk", AttributeValue::S("NOTIFICATION_PREFERENCES".to_string()))
            .send()
            .await?;
        
        let mut users = Vec::new();
        if let Some(items) = result.items {
            for item in items {
                if let Some(user_id) = item.get("userId").and_then(|v| v.as_s().ok()) {
                    users.push(User {
                        user_id: user_id.to_string(),
                    });
                }
            }
        }
        
        info!("Found {} users with notification preferences", users.len());
        Ok(users)
    }
    
    async fn get_user_preferences(&self, user_id: &str) -> Result<NotificationPreferences, Error> {
        let result = self.dynamodb
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S("NOTIFICATION_PREFERENCES".to_string()))
            .send()
            .await?;
        
        if let Some(item) = result.item {
            Ok(self.deserialize_preferences(item)?)
        } else {
            Ok(NotificationPreferences::default())
        }
    }
    
    fn is_time_for_reminder(&self, now: &DateTime<Utc>, reminder_time: &str, timezone: &Option<String>) -> bool {
        let user_tz = timezone.as_deref().unwrap_or("UTC");
        
        if let Ok(tz) = user_tz.parse::<Tz>() {
            let user_time = now.with_timezone(&tz);
            let current_hour = user_time.hour();
            let current_minute = user_time.minute();
            
            if let Some(time_str) = reminder_time.split(':').collect::<Vec<&str>>().get(0..2) {
                if let (Ok(hour), Ok(minute)) = (time_str[0].parse::<u32>(), time_str[1].parse::<u32>()) {
                    return current_hour == hour && current_minute == minute;
                }
            }
        }
        
        false
    }
    
    fn is_time_for_water_reminder(&self, now: &DateTime<Utc>, timezone: &Option<String>) -> bool {
        let user_tz = timezone.as_deref().unwrap_or("UTC");
        
        if let Ok(tz) = user_tz.parse::<Tz>() {
            let user_time = now.with_timezone(&tz);
            let hour = user_time.hour();
            // Every 2 hours during waking hours (6 AM to 10 PM)
            return hour >= 6 && hour <= 22 && hour % 2 == 0;
        }
        
        false
    }
    
    fn is_time_for_progress_photo(&self, now: &DateTime<Utc>, timezone: &Option<String>) -> bool {
        let user_tz = timezone.as_deref().unwrap_or("UTC");
        
        if let Ok(tz) = user_tz.parse::<Tz>() {
            let user_time = now.with_timezone(&tz);
            // Weekly on Sundays at 6 PM
            return user_time.weekday() == chrono::Weekday::Sun && user_time.hour() == 18;
        }
        
        false
    }
    
    async fn send_workout_reminder(&self, user_id: &str) -> Result<(), Error> {
        let request = NotificationRequest {
            user_id: user_id.to_string(),
            notification_type: "workout_reminder".to_string(),
            title: "Time for your workout! 💪".to_string(),
            body: "Your scheduled workout is ready. Let's get moving!".to_string(),
            data: Some(json!({
                "action": "start_workout",
                "category": "workout"
            })),
        };
        
        self.invoke_notification_service(request).await
    }
    
    async fn send_nutrition_reminder(&self, user_id: &str, reminder_time: &str) -> Result<(), Error> {
        let meal_type = match reminder_time {
            "08:00" => "breakfast",
            "13:00" => "lunch",
            "19:00" => "dinner",
            _ => "meal",
        };
        
        let request = NotificationRequest {
            user_id: user_id.to_string(),
            notification_type: "nutrition_reminder".to_string(),
            title: "Time to log your meal! 🍽️".to_string(),
            body: format!("Don't forget to log your {} to track your nutrition goals.", meal_type),
            data: Some(json!({
                "action": "log_meal",
                "category": "nutrition",
                "meal_type": meal_type
            })),
        };
        
        self.invoke_notification_service(request).await
    }
    
    async fn send_water_reminder(&self, user_id: &str) -> Result<(), Error> {
        let request = NotificationRequest {
            user_id: user_id.to_string(),
            notification_type: "water_reminder".to_string(),
            title: "Stay hydrated! 💧".to_string(),
            body: "Time for a glass of water. Keep up the great work!".to_string(),
            data: Some(json!({
                "action": "log_water",
                "category": "hydration"
            })),
        };
        
        self.invoke_notification_service(request).await
    }
    
    async fn send_progress_photo_reminder(&self, user_id: &str) -> Result<(), Error> {
        let request = NotificationRequest {
            user_id: user_id.to_string(),
            notification_type: "progress_photo".to_string(),
            title: "Weekly Progress Check! 📸".to_string(),
            body: "Time to take your weekly progress photo and track your transformation!".to_string(),
            data: Some(json!({
                "action": "take_progress_photo",
                "category": "progress"
            })),
        };
        
        self.invoke_notification_service(request).await
    }
    
    async fn invoke_notification_service(&self, request: NotificationRequest) -> Result<(), Error> {
        let payload = serde_json::to_string(&request)
            .map_err(|e| Error::from(format!("Failed to serialize request: {}", e)))?;
        
        self.lambda
            .invoke()
            .function_name(&self.notification_service_function_arn)
            .payload(payload.as_bytes().into())
            .send()
            .await?;
        
        info!("Invoked notification service for user: {}", request.user_id);
        Ok(())
    }
    
    fn deserialize_preferences(&self, item: HashMap<String, AttributeValue>) -> Result<NotificationPreferences, Error> {
        let workout_reminders = item.get("workoutReminders")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);
        
        let nutrition_reminders = item.get("nutritionReminders")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);
        
        let water_reminders = item.get("waterReminders")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);
        
        let progress_photos = item.get("progressPhotos")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);
        
        let achievements = item.get("achievements")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);
        
        let ai_suggestions = item.get("aiSuggestions")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);
        
        let workout_reminder_time = item.get("workoutReminderTime")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.to_string());
        
        let nutrition_reminder_times = item.get("nutritionReminderTimes")
            .and_then(|v| v.as_l().ok())
            .map(|list| list.iter()
                .filter_map(|v| v.as_s().ok())
                .map(|s| s.to_string())
                .collect());
        
        let timezone = item.get("timezone")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.to_string());
        
        Ok(NotificationPreferences {
            workout_reminders: *workout_reminders,
            nutrition_reminders: *nutrition_reminders,
            water_reminders: *water_reminders,
            progress_photos: *progress_photos,
            achievements: *achievements,
            ai_suggestions: *ai_suggestions,
            workout_reminder_time,
            nutrition_reminder_times,
            timezone,
        })
    }
}

#[derive(Debug, Clone)]
struct User {
    user_id: String,
}

#[derive(Debug, Clone)]
struct NotificationPreferences {
    workout_reminders: bool,
    nutrition_reminders: bool,
    water_reminders: bool,
    progress_photos: bool,
    achievements: bool,
    ai_suggestions: bool,
    workout_reminder_time: Option<String>,
    nutrition_reminder_times: Option<Vec<String>>,
    timezone: Option<String>,
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
            nutrition_reminder_times: Some(vec!["08:00".to_string(), "13:00".to_string(), "19:00".to_string()]),
            timezone: Some("UTC".to_string()),
        }
    }
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();
    
    let (payload, context) = event.into_parts();
    
    info!("Received event: {:?}", payload);
    info!("Context: {:?}", context);
    
    let scheduler_service = SchedulerService::new().await?;
    
    let result = scheduler_service.process_scheduled_notifications().await;
    
    match result {
        Ok(processed_count) => {
            info!("Processed {} scheduled notifications", processed_count);
            Ok(json!({
                "statusCode": 200,
                "body": json!({
                    "success": true,
                    "message": format!("Processed {} scheduled notifications", processed_count),
                    "processed_count": processed_count
                }).to_string()
            }))
        },
        Err(e) => {
            error!("Failed to process scheduled notifications: {}", e);
            Ok(json!({
                "statusCode": 500,
                "body": json!({
                    "success": false,
                    "message": format!("Failed to process scheduled notifications: {}", e)
                }).to_string()
            }))
        }
    }
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
