use anyhow::{anyhow, Result};
use aws_sdk_dynamodb::{types::AttributeValue, Client as DynamoDbClient};
use aws_sdk_sns::{types::MessageAttributeValue, Client as SnsClient};
use chrono::{Datelike, Duration, Timelike, Utc};
use jsonwebtoken::{encode, Algorithm, EncodingKey, Header};
use reqwest::Client as HttpClient;
use serde_json::Value;
use std::collections::HashMap;
use tracing::{error, info, warn};
use uuid::Uuid;

use crate::models::*;

pub struct NotificationService {
    dynamodb: DynamoDbClient,
    sns: SnsClient,
    http_client: HttpClient,
    table_name: String,
    workout_topic_arn: String,
    nutrition_topic_arn: String,
    achievement_topic_arn: String,
    ai_suggestions_topic_arn: String,
    fcm_server_key: Option<String>,
    firebase_project_id: String,
}

impl NotificationService {
    pub async fn new() -> Result<Self> {
        let config = aws_config::load_from_env().await;
        let dynamodb = DynamoDbClient::new(&config);
        let sns = SnsClient::new(&config);
        let http_client = HttpClient::new();

        let table_name = std::env::var("TABLE_NAME")
            .map_err(|_| anyhow!("TABLE_NAME environment variable not set"))?;

        let workout_topic_arn = std::env::var("WORKOUT_REMINDERS_TOPIC_ARN")
            .map_err(|_| anyhow!("WORKOUT_REMINDERS_TOPIC_ARN environment variable not set"))?;

        let nutrition_topic_arn = std::env::var("NUTRITION_REMINDERS_TOPIC_ARN")
            .map_err(|_| anyhow!("NUTRITION_REMINDERS_TOPIC_ARN environment variable not set"))?;

        let achievement_topic_arn = std::env::var("ACHIEVEMENT_TOPIC_ARN")
            .map_err(|_| anyhow!("ACHIEVEMENT_TOPIC_ARN environment variable not set"))?;

        let ai_suggestions_topic_arn = std::env::var("AI_SUGGESTIONS_TOPIC_ARN")
            .map_err(|_| anyhow!("AI_SUGGESTIONS_TOPIC_ARN environment variable not set"))?;

        let fcm_server_key = std::env::var("FCM_SERVER_KEY").ok();
        let firebase_project_id =
            std::env::var("FIREBASE_PROJECT_ID").unwrap_or_else(|_| "gymcoach-73528".to_string());

        Ok(Self {
            dynamodb,
            sns,
            http_client,
            table_name,
            workout_topic_arn,
            nutrition_topic_arn,
            achievement_topic_arn,
            ai_suggestions_topic_arn,
            fcm_server_key,
            firebase_project_id,
        })
    }

    pub async fn send_notification(
        &self,
        user_id: &str,
        notification_type: &str,
        title: &str,
        body: &str,
        data: Option<&Value>,
        device_token: Option<&str>,
    ) -> Result<String> {
        let notification_id = Uuid::new_v4().to_string();

        // Get user's active devices
        let devices = self.get_user_devices(user_id).await?;

        if devices.is_empty() {
            warn!("No active devices found for user: {}", user_id);
            return Ok(notification_id);
        }

        // Send notification to each device
        let mut success_count = 0;
        for device in devices {
            if let Some(token) = device_token {
                if device.device_token != token {
                    continue; // Skip if specific device token was requested
                }
            }

            match self
                .send_to_device(&device, notification_type, title, body, data)
                .await
            {
                Ok(_) => {
                    success_count += 1;
                    info!("Notification sent to device: {}", device.device_id);
                }
                Err(e) => {
                    error!(
                        "Failed to send notification to device {}: {}",
                        device.device_id, e
                    );
                }
            }
        }

        // Store notification record
        self.store_notification(
            &notification_id,
            user_id,
            notification_type,
            title,
            body,
            data,
        )
        .await?;

        info!(
            "Notification {} sent to {} devices",
            notification_id, success_count
        );
        Ok(notification_id)
    }

    async fn send_to_device(
        &self,
        device: &Device,
        notification_type: &str,
        title: &str,
        body: &str,
        data: Option<&Value>,
    ) -> Result<()> {
        // Use FCM if available, otherwise fall back to SNS
        if let Some(fcm_key) = &self.fcm_server_key {
            self.send_fcm_notification(device, title, body, data, fcm_key)
                .await?;
        } else {
            self.send_sns_notification(device, notification_type, title, body, data)
                .await?;
        }

        Ok(())
    }

    async fn generate_oauth_token(&self, fcm_key: &str) -> Result<String> {
        // For HTTP v1 API, we need to use the service account private key
        // This is a simplified implementation using the service account key from environment

        // Parse the service account JSON (assuming it's stored in FCM_SERVER_KEY)
        let service_account: Value =
            serde_json::from_str(fcm_key).map_err(|_| anyhow!("Invalid service account JSON"))?;

        let private_key = service_account["private_key"]
            .as_str()
            .ok_or_else(|| anyhow!("Missing private_key in service account"))?;

        let client_email = service_account["client_email"]
            .as_str()
            .ok_or_else(|| anyhow!("Missing client_email in service account"))?;

        // Create JWT claims
        let now = Utc::now().timestamp();
        let claims = serde_json::json!({
            "iss": client_email,
            "scope": "https://www.googleapis.com/auth/firebase.messaging",
            "aud": "https://oauth2.googleapis.com/token",
            "iat": now,
            "exp": now + 3600, // 1 hour
            "sub": client_email
        });

        // Generate JWT token
        let header = Header::new(Algorithm::RS256);
        let encoding_key = EncodingKey::from_rsa_pem(private_key.as_bytes())
            .map_err(|e| anyhow!("Failed to create encoding key: {}", e))?;
        let token = encode(&header, &claims, &encoding_key)
            .map_err(|e| anyhow!("Failed to generate JWT: {}", e))?;

        Ok(token)
    }

    async fn send_fcm_notification(
        &self,
        device: &Device,
        title: &str,
        body: &str,
        data: Option<&Value>,
        fcm_key: &str,
    ) -> Result<()> {
        let mut data_map = HashMap::new();
        if let Some(d) = data {
            if let serde_json::Value::Object(obj) = d {
                for (k, v) in obj {
                    data_map.insert(k.clone(), v.to_string());
                }
            }
        }

        // Use HTTP v1 API endpoint
        let url = format!(
            "https://fcm.googleapis.com/v1/projects/{}/messages:send",
            self.firebase_project_id
        );

        let payload = serde_json::json!({
            "message": {
                "token": device.device_token,
                "notification": {
                    "title": title,
                    "body": body,
                },
                "data": data_map,
                "android": {
                    "priority": "high"
                },
                "apns": {
                    "headers": {
                        "apns-priority": "10"
                    }
                }
            }
        });

        // Generate OAuth token for HTTP v1 API
        let oauth_token = self.generate_oauth_token(fcm_key).await?;

        let response = self
            .http_client
            .post(&url)
            .header("Authorization", format!("Bearer {}", oauth_token))
            .header("Content-Type", "application/json")
            .json(&payload)
            .send()
            .await?;

        if !response.status().is_success() {
            let error_text = response.text().await.unwrap_or_default();
            error!("FCM HTTP v1 request failed: {}", error_text);
            return Err(anyhow!("FCM HTTP v1 request failed: {}", error_text));
        }

        info!(
            "FCM HTTP v1 notification sent successfully to device: {}",
            device.device_id
        );
        Ok(())
    }

    async fn send_sns_notification(
        &self,
        device: &Device,
        notification_type: &str,
        title: &str,
        body: &str,
        data: Option<&Value>,
    ) -> Result<()> {
        let topic_arn = match notification_type {
            "workout_reminder" => &self.workout_topic_arn,
            "nutrition_reminder" | "water_reminder" => &self.nutrition_topic_arn,
            "achievement" => &self.achievement_topic_arn,
            "ai_suggestion" => &self.ai_suggestions_topic_arn,
            _ => &self.workout_topic_arn, // Default fallback
        };

        let mut message_attributes = HashMap::new();
        message_attributes.insert(
            "platform".to_string(),
            MessageAttributeValue::builder()
                .data_type("String")
                .string_value(&device.platform)
                .build()?,
        );

        message_attributes.insert(
            "device_token".to_string(),
            MessageAttributeValue::builder()
                .data_type("String")
                .string_value(&device.device_token)
                .build()?,
        );

        let message = serde_json::json!({
            "default": body,
            "APNS": {
                "aps": {
                    "alert": {
                        "title": title,
                        "body": body
                    },
                    "badge": 1,
                    "sound": "default"
                },
                "data": data
            },
            "GCM": {
                "notification": {
                    "title": title,
                    "body": body,
                    "sound": "default"
                },
                "data": data
            }
        });

        self.sns
            .publish()
            .topic_arn(topic_arn)
            .message(message.to_string())
            .set_message_attributes(Some(message_attributes))
            .send()
            .await?;

        info!(
            "SNS notification sent successfully to device: {}",
            device.device_id
        );
        Ok(())
    }

    async fn get_user_devices(&self, user_id: &str) -> Result<Vec<Device>> {
        let pk = format!("USER#{}", user_id);

        let result = self
            .dynamodb
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(pk))
            .expression_attribute_values(":sk", AttributeValue::S("DEVICE#".to_string()))
            .send()
            .await?;

        let mut devices = Vec::new();
        if let Some(items) = result.items {
            for item in items {
                if let Ok(device) = self.deserialize_device(item) {
                    if device.is_active {
                        devices.push(device);
                    }
                }
            }
        }

        Ok(devices)
    }

    async fn store_notification(
        &self,
        notification_id: &str,
        user_id: &str,
        notification_type: &str,
        title: &str,
        body: &str,
        data: Option<&Value>,
    ) -> Result<()> {
        let now = Utc::now();
        let ttl = (now + Duration::days(7)).timestamp();

        let mut item = HashMap::new();
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("NOTIFICATION#{}", notification_id)),
        );
        item.insert(
            "SK".to_string(),
            AttributeValue::S(format!("USER#{}", user_id)),
        );
        item.insert(
            "notificationId".to_string(),
            AttributeValue::S(notification_id.to_string()),
        );
        item.insert("userId".to_string(), AttributeValue::S(user_id.to_string()));
        item.insert(
            "notificationType".to_string(),
            AttributeValue::S(notification_type.to_string()),
        );
        item.insert("title".to_string(), AttributeValue::S(title.to_string()));
        item.insert("body".to_string(), AttributeValue::S(body.to_string()));
        item.insert("sentAt".to_string(), AttributeValue::S(now.to_rfc3339()));
        item.insert(
            "deliveryStatus".to_string(),
            AttributeValue::S("Sent".to_string()),
        );
        item.insert("ttl".to_string(), AttributeValue::N(ttl.to_string()));

        if let Some(data) = data {
            item.insert("data".to_string(), AttributeValue::S(data.to_string()));
        }

        self.dynamodb
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(())
    }

    fn deserialize_device(&self, item: HashMap<String, AttributeValue>) -> Result<Device> {
        let device_id = item
            .get("deviceId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow!("Missing deviceId"))?;

        let user_id = item
            .get("userId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow!("Missing userId"))?;

        let device_token = item
            .get("deviceToken")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow!("Missing deviceToken"))?;

        let platform = item
            .get("platform")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow!("Missing platform"))?;

        let device_name = item
            .get("deviceName")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.to_string());

        let is_active = item
            .get("isActive")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);

        let created_at = item
            .get("createdAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

        let last_used_at = item
            .get("lastUsedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(Utc::now);

        Ok(Device {
            device_id: device_id.to_string(),
            user_id: user_id.to_string(),
            device_token: device_token.to_string(),
            platform: platform.to_string(),
            device_name,
            is_active: *is_active,
            created_at,
            last_used_at,
        })
    }
}

pub struct DeviceService {
    dynamodb: DynamoDbClient,
    table_name: String,
}

impl DeviceService {
    pub async fn new() -> Result<Self> {
        let config = aws_config::load_from_env().await;
        let dynamodb = DynamoDbClient::new(&config);

        let table_name = std::env::var("TABLE_NAME")
            .map_err(|_| anyhow!("TABLE_NAME environment variable not set"))?;

        Ok(Self {
            dynamodb,
            table_name,
        })
    }

    pub async fn register_device(
        &self,
        user_id: &str,
        device_token: &str,
        platform: &str,
        device_name: Option<&str>,
    ) -> Result<String> {
        let device_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let mut item = HashMap::new();
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", user_id)),
        );
        item.insert(
            "SK".to_string(),
            AttributeValue::S(format!("DEVICE#{}", device_id)),
        );
        item.insert("deviceId".to_string(), AttributeValue::S(device_id.clone()));
        item.insert("userId".to_string(), AttributeValue::S(user_id.to_string()));
        item.insert(
            "deviceToken".to_string(),
            AttributeValue::S(device_token.to_string()),
        );
        item.insert(
            "platform".to_string(),
            AttributeValue::S(platform.to_string()),
        );
        item.insert("isActive".to_string(), AttributeValue::Bool(true));
        item.insert("createdAt".to_string(), AttributeValue::S(now.to_rfc3339()));
        item.insert(
            "lastUsedAt".to_string(),
            AttributeValue::S(now.to_rfc3339()),
        );

        if let Some(name) = device_name {
            item.insert(
                "deviceName".to_string(),
                AttributeValue::S(name.to_string()),
            );
        }

        self.dynamodb
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        info!("Device registered: {} for user: {}", device_id, user_id);
        Ok(device_id)
    }

    pub async fn update_device_token(
        &self,
        user_id: &str,
        device_id: &str,
        new_token: &str,
    ) -> Result<()> {
        let now = Utc::now();

        self.dynamodb
            .update_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("DEVICE#{}", device_id)))
            .update_expression("SET deviceToken = :token, lastUsedAt = :timestamp")
            .expression_attribute_values(":token", AttributeValue::S(new_token.to_string()))
            .expression_attribute_values(":timestamp", AttributeValue::S(now.to_rfc3339()))
            .send()
            .await?;

        info!("Device token updated for device: {}", device_id);
        Ok(())
    }

    pub async fn deactivate_device(&self, user_id: &str, device_id: &str) -> Result<()> {
        self.dynamodb
            .update_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("DEVICE#{}", device_id)))
            .update_expression("SET isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(false))
            .send()
            .await?;

        info!("Device deactivated: {}", device_id);
        Ok(())
    }
}

pub struct PreferencesService {
    dynamodb: DynamoDbClient,
    table_name: String,
}

impl PreferencesService {
    pub async fn new() -> Result<Self> {
        let config = aws_config::load_from_env().await;
        let dynamodb = DynamoDbClient::new(&config);

        let table_name = std::env::var("TABLE_NAME")
            .map_err(|_| anyhow!("TABLE_NAME environment variable not set"))?;

        Ok(Self {
            dynamodb,
            table_name,
        })
    }

    pub async fn update_preferences(
        &self,
        user_id: &str,
        preferences: &NotificationPreferences,
    ) -> Result<()> {
        let now = Utc::now();

        let mut item = HashMap::new();
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", user_id)),
        );
        item.insert(
            "SK".to_string(),
            AttributeValue::S("NOTIFICATION_PREFERENCES".to_string()),
        );
        item.insert("userId".to_string(), AttributeValue::S(user_id.to_string()));
        item.insert(
            "workoutReminders".to_string(),
            AttributeValue::Bool(preferences.workout_reminders),
        );
        item.insert(
            "nutritionReminders".to_string(),
            AttributeValue::Bool(preferences.nutrition_reminders),
        );
        item.insert(
            "waterReminders".to_string(),
            AttributeValue::Bool(preferences.water_reminders),
        );
        item.insert(
            "progressPhotos".to_string(),
            AttributeValue::Bool(preferences.progress_photos),
        );
        item.insert(
            "achievements".to_string(),
            AttributeValue::Bool(preferences.achievements),
        );
        item.insert(
            "aiSuggestions".to_string(),
            AttributeValue::Bool(preferences.ai_suggestions),
        );
        item.insert("updatedAt".to_string(), AttributeValue::S(now.to_rfc3339()));

        if let Some(time) = &preferences.workout_reminder_time {
            item.insert(
                "workoutReminderTime".to_string(),
                AttributeValue::S(time.clone()),
            );
        }

        if let Some(times) = &preferences.nutrition_reminder_times {
            let times_attr: Vec<AttributeValue> =
                times.iter().map(|t| AttributeValue::S(t.clone())).collect();
            item.insert(
                "nutritionReminderTimes".to_string(),
                AttributeValue::L(times_attr),
            );
        }

        if let Some(tz) = &preferences.timezone {
            item.insert("timezone".to_string(), AttributeValue::S(tz.clone()));
        }

        self.dynamodb
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        info!("Notification preferences updated for user: {}", user_id);
        Ok(())
    }

    pub async fn get_preferences(&self, user_id: &str) -> Result<NotificationPreferences> {
        let result = self
            .dynamodb
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key(
                "SK",
                AttributeValue::S("NOTIFICATION_PREFERENCES".to_string()),
            )
            .send()
            .await?;

        if let Some(item) = result.item {
            Ok(self.deserialize_preferences(item)?)
        } else {
            Ok(NotificationPreferences::default())
        }
    }

    fn deserialize_preferences(
        &self,
        item: HashMap<String, AttributeValue>,
    ) -> Result<NotificationPreferences> {
        let workout_reminders = item
            .get("workoutReminders")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);

        let nutrition_reminders = item
            .get("nutritionReminders")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);

        let water_reminders = item
            .get("waterReminders")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);

        let progress_photos = item
            .get("progressPhotos")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);

        let achievements = item
            .get("achievements")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);

        let ai_suggestions = item
            .get("aiSuggestions")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(&true);

        let workout_reminder_time = item
            .get("workoutReminderTime")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.to_string());

        let nutrition_reminder_times = item
            .get("nutritionReminderTimes")
            .and_then(|v| v.as_l().ok())
            .map(|list| {
                list.iter()
                    .filter_map(|v| v.as_s().ok())
                    .map(|s| s.to_string())
                    .collect()
            });

        let timezone = item
            .get("timezone")
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

pub struct SchedulerService {
    dynamodb: DynamoDbClient,
    table_name: String,
}

impl SchedulerService {
    pub async fn new() -> Result<Self> {
        let config = aws_config::load_from_env().await;
        let dynamodb = DynamoDbClient::new(&config);

        let table_name = std::env::var("TABLE_NAME")
            .map_err(|_| anyhow!("TABLE_NAME environment variable not set"))?;

        Ok(Self {
            dynamodb,
            table_name,
        })
    }

    pub async fn process_scheduled_notifications(&self) -> Result<usize> {
        let now = Utc::now();
        let mut processed_count = 0;

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
                            self.send_nutrition_reminder(&user.user_id, reminder_time)
                                .await?;
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

        Ok(processed_count)
    }

    async fn get_users_with_preferences(&self) -> Result<Vec<User>> {
        // This would typically query all users, but for now we'll return empty
        // In a real implementation, you'd query the user table
        Ok(vec![])
    }

    async fn get_user_preferences(&self, user_id: &str) -> Result<NotificationPreferences> {
        let preferences_service = PreferencesService::new().await?;
        preferences_service.get_preferences(user_id).await
    }

    fn is_time_for_reminder(
        &self,
        now: &chrono::DateTime<Utc>,
        reminder_time: &str,
        timezone: &Option<String>,
    ) -> bool {
        // Simplified time checking - in a real implementation, you'd handle timezones properly
        let current_hour = now.hour();
        let current_minute = now.minute();

        if let Some(time_str) = reminder_time.split(':').collect::<Vec<&str>>().get(0..2) {
            if let (Ok(hour), Ok(minute)) = (time_str[0].parse::<u32>(), time_str[1].parse::<u32>())
            {
                return current_hour == hour && current_minute == minute;
            }
        }

        false
    }

    fn is_time_for_water_reminder(
        &self,
        now: &chrono::DateTime<Utc>,
        timezone: &Option<String>,
    ) -> bool {
        // Every 2 hours during waking hours (6 AM to 10 PM)
        let hour = now.hour();
        hour >= 6 && hour <= 22 && hour % 2 == 0
    }

    fn is_time_for_progress_photo(
        &self,
        now: &chrono::DateTime<Utc>,
        timezone: &Option<String>,
    ) -> bool {
        // Weekly on Sundays at 6 PM
        now.weekday() == chrono::Weekday::Sun && now.hour() == 18
    }

    async fn send_workout_reminder(&self, user_id: &str) -> Result<()> {
        let notification_service = NotificationService::new().await?;
        let template = NotificationTemplate::workout_reminder();

        notification_service
            .send_notification(
                user_id,
                &template.notification_type,
                &template.title_template,
                &template.body_template,
                template.default_data.as_ref(),
                None,
            )
            .await?;

        Ok(())
    }

    async fn send_nutrition_reminder(&self, user_id: &str, reminder_time: &str) -> Result<()> {
        let notification_service = NotificationService::new().await?;
        let template = NotificationTemplate::nutrition_reminder();

        let meal_type = match reminder_time {
            "08:00" => "breakfast",
            "13:00" => "lunch",
            "19:00" => "dinner",
            _ => "meal",
        };

        let body = template.body_template.replace("{meal_type}", meal_type);

        notification_service
            .send_notification(
                user_id,
                &template.notification_type,
                &template.title_template,
                &body,
                template.default_data.as_ref(),
                None,
            )
            .await?;

        Ok(())
    }

    async fn send_water_reminder(&self, user_id: &str) -> Result<()> {
        let notification_service = NotificationService::new().await?;
        let template = NotificationTemplate::water_reminder();

        // In a real implementation, you'd get the actual water consumption from the database
        let body = template.body_template.replace("{glasses_consumed}", "0");

        notification_service
            .send_notification(
                user_id,
                &template.notification_type,
                &template.title_template,
                &body,
                template.default_data.as_ref(),
                None,
            )
            .await?;

        Ok(())
    }

    async fn send_progress_photo_reminder(&self, user_id: &str) -> Result<()> {
        let notification_service = NotificationService::new().await?;
        let template = NotificationTemplate::progress_photo();

        notification_service
            .send_notification(
                user_id,
                &template.notification_type,
                &template.title_template,
                &template.body_template,
                template.default_data.as_ref(),
                None,
            )
            .await?;

        Ok(())
    }
}

#[derive(Debug, Clone)]
struct User {
    user_id: String,
}
