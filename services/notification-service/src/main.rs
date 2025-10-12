use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::collections::HashMap;
use tracing::{error, info};

mod handlers;
mod models;
mod services;
mod utils;

use handlers::*;
use models::*;

#[derive(Deserialize, Debug)]
struct NotificationRequest {
    user_id: String,
    device_token: Option<String>,
    notification_type: String,
    title: String,
    body: String,
    data: Option<Value>,
}

#[derive(Serialize)]
struct NotificationResponse {
    success: bool,
    message: String,
    notification_id: Option<String>,
}

#[derive(Deserialize, Debug)]
struct DeviceRegistrationRequest {
    user_id: String,
    device_token: String,
    platform: String,
    device_name: Option<String>,
}

#[derive(Deserialize, Debug)]
struct NotificationPreferencesRequest {
    user_id: String,
    preferences: models::NotificationPreferences,
}

#[derive(Serialize, Deserialize)]
struct NotificationPreferences {
    workout_reminders: bool,
    nutrition_reminders: bool,
    water_reminders: bool,
    progress_photos: bool,
    achievements: bool,
    ai_suggestions: bool,
    workout_reminder_time: Option<String>, // HH:MM format
    nutrition_reminder_times: Option<Vec<String>>, // ["08:00", "13:00", "19:00"]
    timezone: Option<String>,
}

async fn handle_notification_request(
    event: LambdaEvent<NotificationRequest>,
) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();

    info!("Processing notification request: {:?}", payload);

    let notification_service = services::NotificationService::new().await?;

    let result = notification_service
        .send_notification(
            &payload.user_id,
            &payload.notification_type,
            &payload.title,
            &payload.body,
            payload.data.as_ref(),
            payload.device_token.as_deref(),
        )
        .await;

    match result {
        Ok(notification_id) => {
            info!("Notification sent successfully: {}", notification_id);
            Ok(json!({
                "statusCode": 200,
                "body": json!({
                    "success": true,
                    "message": "Notification sent successfully",
                    "notification_id": notification_id
                }).to_string()
            }))
        }
        Err(e) => {
            error!("Failed to send notification: {}", e);
            Ok(json!({
                "statusCode": 500,
                "body": json!({
                    "success": false,
                    "message": format!("Failed to send notification: {}", e)
                }).to_string()
            }))
        }
    }
}

async fn handle_device_registration(
    event: LambdaEvent<DeviceRegistrationRequest>,
) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();

    info!("Processing device registration: {:?}", payload);

    let device_service = services::DeviceService::new().await?;

    let result = device_service
        .register_device(
            &payload.user_id,
            &payload.device_token,
            &payload.platform,
            payload.device_name.as_deref(),
        )
        .await;

    match result {
        Ok(device_id) => {
            info!("Device registered successfully: {}", device_id);
            Ok(json!({
                "statusCode": 200,
                "body": json!({
                    "success": true,
                    "message": "Device registered successfully",
                    "device_id": device_id
                }).to_string()
            }))
        }
        Err(e) => {
            error!("Failed to register device: {}", e);
            Ok(json!({
                "statusCode": 500,
                "body": json!({
                    "success": false,
                    "message": format!("Failed to register device: {}", e)
                }).to_string()
            }))
        }
    }
}

async fn handle_preferences_update(
    event: LambdaEvent<NotificationPreferencesRequest>,
) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();

    info!("Processing preferences update: {:?}", payload);

    let preferences_service = services::PreferencesService::new().await?;

    let result = preferences_service
        .update_preferences(&payload.user_id, &payload.preferences)
        .await;

    match result {
        Ok(_) => {
            info!("Preferences updated successfully");
            Ok(json!({
                "statusCode": 200,
                "body": json!({
                    "success": true,
                    "message": "Preferences updated successfully"
                }).to_string()
            }))
        }
        Err(e) => {
            error!("Failed to update preferences: {}", e);
            Ok(json!({
                "statusCode": 500,
                "body": json!({
                    "success": false,
                    "message": format!("Failed to update preferences: {}", e)
                }).to_string()
            }))
        }
    }
}

async fn handle_scheduled_notifications(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();

    info!("Processing scheduled notifications: {:?}", payload);

    let scheduler_service = services::SchedulerService::new().await?;

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
        }
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

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .without_time()
        .init();

    let (payload, context) = event.into_parts();

    info!("Received event: {:?}", payload);
    info!("Context: {:?}", context);

    // Route based on the event structure
    if let Some(path) = payload.get("path").and_then(|p| p.as_str()) {
        match path {
            "/api/notifications/send" => {
                if let Ok(notification_request) =
                    serde_json::from_value::<NotificationRequest>(payload.clone())
                {
                    return handle_notification_request(LambdaEvent::new(
                        notification_request,
                        context,
                    ))
                    .await;
                }
            }
            "/api/notifications/devices/register" => {
                if let Ok(device_request) =
                    serde_json::from_value::<DeviceRegistrationRequest>(payload.clone())
                {
                    return handle_device_registration(LambdaEvent::new(device_request, context))
                        .await;
                }
            }
            "/api/notifications/preferences" => {
                if let Ok(preferences_request) =
                    serde_json::from_value::<NotificationPreferencesRequest>(payload.clone())
                {
                    return handle_preferences_update(LambdaEvent::new(
                        preferences_request,
                        context,
                    ))
                    .await;
                }
            }
            _ => {}
        }
    }

    // Check if this is a scheduled event from EventBridge
    if payload.get("source").and_then(|s| s.as_str()) == Some("aws.events") {
        return handle_scheduled_notifications(LambdaEvent::new(payload, context)).await;
    }

    // Default response for unknown routes
    Ok(json!({
        "statusCode": 404,
        "body": json!({
            "success": false,
            "message": "Route not found"
        }).to_string()
    }))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
