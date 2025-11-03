# 🔔 Push Notification Backend Implementation Guide

## 📋 **Overview:**

Your nutrition service is written in Rust, which is excellent for performance. Here's how to implement push notifications:

## 🛠️ **Step 1: Add Dependencies to Cargo.toml**

Add these dependencies to your `services/nutrition-service/Cargo.toml`:

```toml
[dependencies]
# Existing dependencies...
lambda_runtime = "0.8"
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1.0", features = ["rt", "rt-multi-thread", "macros", "net", "io-util", "time"] }
aws-sdk-dynamodb = "1.0"
aws-sdk-s3 = "1.0"
aws-config = "1.0"
uuid = { version = "1.0", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
validator = { version = "0.16", features = ["derive"] }
anyhow = "1.0"
tracing = "0.1"
tracing-subscriber = "0.3"
auth-layer = { path = "../auth-layer" }
once_cell = "1.0"

# 🔥 NEW: Firebase/Push Notification Dependencies
reqwest = { version = "0.11", features = ["json", "rustls-tls"] }
base64 = "0.21"
jsonwebtoken = "8.3"
```

## 🚀 **Step 2: Create Firebase Push Notification Module**

Create `/services/nutrition-service/src/notifications.rs`:

```rust
use anyhow::{anyhow, Result};
use chrono::{Duration, Utc};
use jsonwebtoken::{encode, EncodingKey, Header};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::json;
use std::env;
use tracing::{error, info};

#[derive(Debug, Serialize, Deserialize)]
struct FirebaseMessage {
    to: String,
    notification: FirebaseNotification,
    data: Option<serde_json::Value>,
    priority: String,
    content_available: bool,
}

#[derive(Debug, Serialize, Deserialize)]
struct FirebaseNotification {
    title: String,
    body: String,
    icon: Option<String>,
    sound: String,
    badge: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FirebaseResponse {
    multicast_id: Option<i64>,
    success: Option<i32>,
    failure: Option<i32>,
    canonical_ids: Option<i32>,
    results: Option<Vec<FirebaseResult>>,
}

#[derive(Debug, Serialize, Deserialize)]
struct FirebaseResult {
    message_id: Option<String>,
    registration_id: Option<String>,
    error: Option<String>,
}

pub struct FirebaseNotificationService {
    client: Client,
    server_key: String,
    project_id: String,
}

impl FirebaseNotificationService {
    pub fn new() -> Result<Self> {
        let server_key = env::var("FIREBASE_SERVER_KEY")
            .map_err(|_| anyhow!("FIREBASE_SERVER_KEY environment variable not found"))?;

        let project_id = env::var("FIREBASE_PROJECT_ID")
            .map_err(|_| anyhow!("FIREBASE_PROJECT_ID environment variable not found"))?;

        Ok(Self {
            client: Client::new(),
            server_key,
            project_id,
        })
    }

    pub async fn send_nutrition_reminder(
        &self,
        user_token: &str,
        title: &str,
        body: &str,
        custom_data: Option<serde_json::Value>,
    ) -> Result<FirebaseResponse> {
        let message = FirebaseMessage {
            to: user_token.to_string(),
            notification: FirebaseNotification {
                title: title.to_string(),
                body: body.to_string(),
                icon: Some("https://d202qmtk8kkxra.cloudfront.net/app-icon.png".to_string()),
                sound: "default".to_string(),
                badge: Some(1),
            },
            data: custom_data,
            priority: "high".to_string(),
            content_available: true,
        };

        let response = self
            .client
            .post("https://fcm.googleapis.com/fcm/send")
            .header("Authorization", format!("key={}", self.server_key))
            .header("Content-Type", "application/json")
            .json(&message)
            .send()
            .await?;

        if response.status().is_success() {
            let firebase_response: FirebaseResponse = response.json().await?;
            info!("Push notification sent successfully: {:?}", firebase_response);
            Ok(firebase_response)
        } else {
            let error_text = response.text().await?;
            error!("Failed to send push notification: {}", error_text);
            Err(anyhow!("Firebase notification failed: {}", error_text))
        }
    }

    pub async fn send_meal_reminder(&self, user_token: &str, meal_type: &str) -> Result<FirebaseResponse> {
        let (title, body) = match meal_type {
            "breakfast" => ("🌅 Breakfast Time!", "Don't forget to log your breakfast and start your day strong!"),
            "lunch" => ("🍽️ Lunch Reminder", "Time for lunch! Remember to track your meal for better nutrition insights."),
            "dinner" => ("🌙 Dinner Time", "Log your dinner to complete your nutrition tracking for today."),
            "snack" => ("🍎 Snack Time", "Having a snack? Don't forget to log it!"),
            _ => ("🍽️ Meal Reminder", "Time to log your meal and stay on track with your nutrition goals!"),
        };

        let custom_data = json!({
            "type": "meal_reminder",
            "meal_type": meal_type,
            "timestamp": Utc::now().timestamp(),
            "action": "open_nutrition_tracking"
        });

        self.send_nutrition_reminder(user_token, title, body, Some(custom_data)).await
    }

    pub async fn send_hydration_reminder(&self, user_token: &str, glasses_remaining: i32) -> Result<FirebaseResponse> {
        let title = "💧 Hydration Reminder";
        let body = if glasses_remaining > 0 {
            format!("You need {} more glasses of water today. Stay hydrated!", glasses_remaining)
        } else {
            "Great job staying hydrated today! 🎉".to_string()
        };

        let custom_data = json!({
            "type": "hydration_reminder",
            "glasses_remaining": glasses_remaining,
            "timestamp": Utc::now().timestamp(),
            "action": "open_water_tracker"
        });

        self.send_nutrition_reminder(user_token, &title, &body, Some(custom_data)).await
    }

    pub async fn send_macro_goal_achieved(&self, user_token: &str, macro_type: &str) -> Result<FirebaseResponse> {
        let title = "🎯 Goal Achieved!";
        let body = match macro_type {
            "protein" => "Congratulations! You've hit your protein goal for today! 💪",
            "carbs" => "Great job! You've reached your carbohydrate target! ⚡",
            "fat" => "Awesome! You've met your healthy fat goal! 🥑",
            "calories" => "Perfect! You've reached your calorie goal for today! 🎉",
            _ => "Amazing! You've achieved one of your nutrition goals! 🌟",
        };

        let custom_data = json!({
            "type": "goal_achieved",
            "macro_type": macro_type,
            "timestamp": Utc::now().timestamp(),
            "action": "view_progress"
        });

        self.send_nutrition_reminder(user_token, title, body, Some(custom_data)).await
    }
}

// Helper function to schedule reminders
pub async fn schedule_daily_reminders(user_id: &str, user_token: &str, timezone: &str) -> Result<()> {
    let notification_service = FirebaseNotificationService::new()?;

    // This would integrate with your scheduling system (AWS EventBridge, CloudWatch Events, etc.)
    // For now, this is a placeholder for the reminder logic

    info!("Scheduling daily nutrition reminders for user: {}", user_id);

    // Example: Send breakfast reminder
    tokio::spawn(async move {
        // In a real implementation, you'd use a proper scheduler
        // This is just to show the concept
        tokio::time::sleep(tokio::time::Duration::from_secs(3600)).await; // 1 hour delay
        let _ = notification_service.send_meal_reminder(&user_token, "breakfast").await;
    });

    Ok(())
}
```

## 🔧 **Step 3: Update Main Module**

Update your `services/nutrition-service/src/main.rs`:

```rust
mod notifications;

use notifications::{FirebaseNotificationService, schedule_daily_reminders};
use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tracing::{info, error};

// Your existing imports and code...

#[derive(Deserialize)]
struct NotificationRequest {
    user_id: String,
    user_token: String,
    notification_type: String,
    data: Option<Value>,
}

async fn handle_notification_request(event: LambdaEvent<NotificationRequest>) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();

    let notification_service = FirebaseNotificationService::new()
        .map_err(|e| {
            error!("Failed to initialize Firebase service: {}", e);
            Error::from(e.to_string().as_str())
        })?;

    let result = match payload.notification_type.as_str() {
        "meal_reminder" => {
            let meal_type = payload.data
                .and_then(|d| d.get("meal_type"))
                .and_then(|mt| mt.as_str())
                .unwrap_or("general");

            notification_service.send_meal_reminder(&payload.user_token, meal_type).await
        },
        "hydration_reminder" => {
            let glasses_remaining = payload.data
                .and_then(|d| d.get("glasses_remaining"))
                .and_then(|gr| gr.as_i64())
                .unwrap_or(0) as i32;

            notification_service.send_hydration_reminder(&payload.user_token, glasses_remaining).await
        },
        "goal_achieved" => {
            let macro_type = payload.data
                .and_then(|d| d.get("macro_type"))
                .and_then(|mt| mt.as_str())
                .unwrap_or("general");

            notification_service.send_macro_goal_achieved(&payload.user_token, macro_type).await
        },
        _ => {
            return Err(Error::from(format!("Unknown notification type: {}", payload.notification_type).as_str()));
        }
    };

    match result {
        Ok(response) => {
            info!("Notification sent successfully: {:?}", response);
            Ok(json!({
                "statusCode": 200,
                "body": json!({
                    "message": "Notification sent successfully",
                    "response": response
                }).to_string()
            }))
        },
        Err(e) => {
            error!("Failed to send notification: {}", e);
            Ok(json!({
                "statusCode": 500,
                "body": json!({
                    "error": "Failed to send notification",
                    "details": e.to_string()
                }).to_string()
            }))
        }
    }
}

// Add this to your existing Lambda handler routing logic
```

## 🌐 **Step 4: Environment Variables for Lambda**

Update your Lambda environment variables (in CDK or manually):

```typescript
// In your CDK stack (infrastructure/src/gymcoach-ai-stack.ts)
// Add to your nutrition service Lambda function:

environment: {
  // Your existing environment variables...
  FIREBASE_SERVER_KEY: 'your_firebase_server_key_here',
  FIREBASE_PROJECT_ID: 'your_firebase_project_id',
  FIREBASE_MESSAGING_SENDER_ID: 'your_sender_id',
},
```

## 📱 **Step 5: Mobile App Integration**

Your React Native app will need to:

1. **Request notification permissions**
2. **Get FCM token**
3. **Send token to your backend**
4. **Handle incoming notifications**

This is already partially set up with your Firebase dependencies in package.json.

## 🔄 **Step 6: API Endpoints for Notifications**

Add these endpoints to your nutrition service:

```rust
// In your main handler function, add routes like:
"/nutrition/notifications/send" => handle_notification_request(event).await,
"/nutrition/notifications/schedule" => handle_schedule_reminders(event).await,
"/nutrition/notifications/unsubscribe" => handle_unsubscribe(event).await,
```

## 🎯 **Step 7: Testing Push Notifications**

Once you have Firebase keys:

1. **Update your mobile .env file**
2. **Build and deploy nutrition service**
3. **Test with curl:**

```bash
curl -X POST https://q4tzbydpzvguvoaxj6x7nwscii0rpktw.lambda-url.eu-west-1.on.aws/nutrition/notifications/send \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test-user",
    "user_token": "your_fcm_token_here",
    "notification_type": "meal_reminder",
    "data": {
      "meal_type": "breakfast"
    }
  }'
```

## 📊 **Expected Implementation Results:**

After implementation, your nutrition service will support:

- ✅ **Meal reminders** (breakfast, lunch, dinner, snacks)
- ✅ **Hydration reminders** with progress tracking
- ✅ **Goal achievement notifications** for macros/calories
- ✅ **Custom nutrition alerts**
- ✅ **Scheduling system integration**

## 🚨 **Important Notes:**

1. **Security:** Store Firebase server key in AWS Secrets Manager
2. **Rate Limiting:** Implement to avoid spam
3. **User Preferences:** Let users control notification types
4. **Error Handling:** Graceful degradation if Firebase is down
5. **Analytics:** Track notification delivery and engagement

---

## 🎉 **Next Steps:**

1. **Get Firebase keys from setup guide**
2. **Update mobile .env file**
3. **Add Rust dependencies to Cargo.toml**
4. **Implement notification module**
5. **Test push notifications**
6. **Deploy updated nutrition service**

**Let me know when you have your Firebase keys ready, and I'll help you implement and test the push notification system!** 🚀
