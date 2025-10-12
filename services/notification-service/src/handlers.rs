use lambda_runtime::{LambdaEvent, Error};
use serde_json::Value;
use tracing::{info, error};

use crate::models::*;
use crate::services::*;

pub async fn handle_notification_request(event: LambdaEvent<NotificationRequest>) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();
    
    info!("Processing notification request: {:?}", payload);
    
    let notification_service = NotificationService::new().await?;
    
    let result = notification_service.send_notification(
        &payload.user_id,
        &payload.notification_type,
        &payload.title,
        &payload.body,
        payload.data.as_ref(),
        payload.device_token.as_deref(),
    ).await;
    
    match result {
        Ok(notification_id) => {
            info!("Notification sent successfully: {}", notification_id);
            Ok(serde_json::json!({
                "statusCode": 200,
                "body": serde_json::json!({
                    "success": true,
                    "message": "Notification sent successfully",
                    "notification_id": notification_id
                }).to_string()
            }))
        },
        Err(e) => {
            error!("Failed to send notification: {}", e);
            Ok(serde_json::json!({
                "statusCode": 500,
                "body": serde_json::json!({
                    "success": false,
                    "message": format!("Failed to send notification: {}", e)
                }).to_string()
            }))
        }
    }
}

pub async fn handle_device_registration(event: LambdaEvent<DeviceRegistrationRequest>) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();
    
    info!("Processing device registration: {:?}", payload);
    
    let device_service = DeviceService::new().await?;
    
    let result = device_service.register_device(
        &payload.user_id,
        &payload.device_token,
        &payload.platform,
        payload.device_name.as_deref(),
    ).await;
    
    match result {
        Ok(device_id) => {
            info!("Device registered successfully: {}", device_id);
            Ok(serde_json::json!({
                "statusCode": 200,
                "body": serde_json::json!({
                    "success": true,
                    "message": "Device registered successfully",
                    "device_id": device_id
                }).to_string()
            }))
        },
        Err(e) => {
            error!("Failed to register device: {}", e);
            Ok(serde_json::json!({
                "statusCode": 500,
                "body": serde_json::json!({
                    "success": false,
                    "message": format!("Failed to register device: {}", e)
                }).to_string()
            }))
        }
    }
}

pub async fn handle_preferences_update(event: LambdaEvent<NotificationPreferencesRequest>) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();
    
    info!("Processing preferences update: {:?}", payload);
    
    let preferences_service = PreferencesService::new().await?;
    
    let result = preferences_service.update_preferences(
        &payload.user_id,
        &payload.preferences,
    ).await;
    
    match result {
        Ok(_) => {
            info!("Preferences updated successfully");
            Ok(serde_json::json!({
                "statusCode": 200,
                "body": serde_json::json!({
                    "success": true,
                    "message": "Preferences updated successfully"
                }).to_string()
            }))
        },
        Err(e) => {
            error!("Failed to update preferences: {}", e);
            Ok(serde_json::json!({
                "statusCode": 500,
                "body": serde_json::json!({
                    "success": false,
                    "message": format!("Failed to update preferences: {}", e)
                }).to_string()
            }))
        }
    }
}

pub async fn handle_scheduled_notifications(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let (payload, _context) = event.into_parts();
    
    info!("Processing scheduled notifications: {:?}", payload);
    
    let scheduler_service = SchedulerService::new().await?;
    
    let result = scheduler_service.process_scheduled_notifications().await;
    
    match result {
        Ok(processed_count) => {
            info!("Processed {} scheduled notifications", processed_count);
            Ok(serde_json::json!({
                "statusCode": 200,
                "body": serde_json::json!({
                    "success": true,
                    "message": format!("Processed {} scheduled notifications", processed_count),
                    "processed_count": processed_count
                }).to_string()
            }))
        },
        Err(e) => {
            error!("Failed to process scheduled notifications: {}", e);
            Ok(serde_json::json!({
                "statusCode": 500,
                "body": serde_json::json!({
                    "success": false,
                    "message": format!("Failed to process scheduled notifications: {}", e)
                }).to_string()
            }))
        }
    }
}

#[derive(serde::Deserialize, Debug)]
struct NotificationRequest {
    user_id: String,
    device_token: Option<String>,
    notification_type: String,
    title: String,
    body: String,
    data: Option<Value>,
}

#[derive(serde::Deserialize, Debug)]
struct DeviceRegistrationRequest {
    user_id: String,
    device_token: String,
    platform: String,
    device_name: Option<String>,
}

#[derive(serde::Deserialize, Debug)]
struct NotificationPreferencesRequest {
    user_id: String,
    preferences: NotificationPreferences,
}
