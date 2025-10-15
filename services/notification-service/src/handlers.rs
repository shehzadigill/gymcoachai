use lambda_router::{Context, Request, Response, RouterError};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use tracing::{error, info};

use crate::models::*;
use crate::services::*;

// Request/Response types
#[derive(Deserialize, Debug)]
pub struct NotificationRequest {
    pub user_id: String,
    pub device_token: Option<String>,
    pub notification_type: String,
    pub title: String,
    pub body: String,
    pub data: Option<Value>,
}

#[derive(Serialize)]
pub struct NotificationResponse {
    pub success: bool,
    pub message: String,
    pub notification_id: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct DeviceRegistrationRequest {
    pub user_id: String,
    pub device_token: String,
    pub platform: String,
    pub device_name: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct NotificationPreferencesRequest {
    pub user_id: String,
    pub preferences: NotificationPreferences,
}

// Helper function to get auth context from request context
pub fn get_auth_context(ctx: &Context) -> Option<auth_layer::AuthContext> {
    ctx.custom
        .get("auth_context")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
}

// ==================== NOTIFICATION HANDLERS ====================

pub async fn send_notification(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    let payload: NotificationRequest =
        serde_json::from_str(body).map_err(|e| format!("Invalid request body: {}", e))?;

    info!("Processing notification request: {:?}", payload);

    let notification_service = match NotificationService::new().await {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize notification service: {}", e);
            return Ok(Response::internal_error("Failed to initialize service"));
        }
    };

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
            Ok(Response::ok(serde_json::json!({
                "success": true,
                "message": "Notification sent successfully",
                "notification_id": notification_id
            })))
        }
        Err(e) => {
            error!("Failed to send notification: {}", e);
            Ok(Response::internal_error(&format!(
                "Failed to send notification: {}",
                e
            )))
        }
    }
}

pub async fn get_notifications(_req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?;

    info!("Getting notifications for user: {}", user_id);

    // For now, return a placeholder response since the method doesn't exist yet
    // This would need to be implemented in the NotificationService
    Ok(Response::ok(serde_json::json!({
        "success": true,
        "notifications": [],
        "message": "Notification history retrieval not yet implemented"
    })))
}

pub async fn mark_notification_read(_req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?;
    let notification_id = _req
        .path_param("notificationId")
        .ok_or("Missing notificationId")?;

    info!("Marking notification as read: {}", notification_id);

    // For now, return a placeholder response since the method doesn't exist yet
    // This would need to be implemented in the NotificationService
    Ok(Response::ok(serde_json::json!({
        "success": true,
        "message": "Notification read status update not yet implemented"
    })))
}

// ==================== DEVICE HANDLERS ====================

pub async fn register_device(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    let payload: DeviceRegistrationRequest =
        serde_json::from_str(body).map_err(|e| format!("Invalid request body: {}", e))?;

    info!("Processing device registration: {:?}", payload);

    let device_service = match DeviceService::new().await {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize device service: {}", e);
            return Ok(Response::internal_error("Failed to initialize service"));
        }
    };

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
            Ok(Response::created(serde_json::json!({
                "success": true,
                "message": "Device registered successfully",
                "device_id": device_id
            })))
        }
        Err(e) => {
            error!("Failed to register device: {}", e);
            Ok(Response::internal_error(&format!(
                "Failed to register device: {}",
                e
            )))
        }
    }
}

pub async fn unregister_device(_req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?;
    let device_id = _req.path_param("deviceId").ok_or("Missing deviceId")?;

    info!("Deactivating device: {}", device_id);

    let device_service = match DeviceService::new().await {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize device service: {}", e);
            return Ok(Response::internal_error("Failed to initialize service"));
        }
    };

    match device_service.deactivate_device(user_id, device_id).await {
        Ok(_) => Ok(Response::ok(serde_json::json!({
            "success": true,
            "message": "Device deactivated successfully"
        }))),
        Err(e) => {
            error!("Failed to deactivate device: {}", e);
            Ok(Response::internal_error(&format!(
                "Failed to deactivate device: {}",
                e
            )))
        }
    }
}

pub async fn get_user_devices(_req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?;

    info!("Getting devices for user: {}", user_id);

    // For now, return a placeholder response since the method doesn't exist yet
    // This would need to be implemented in the DeviceService
    Ok(Response::ok(serde_json::json!({
        "success": true,
        "devices": [],
        "message": "Device listing not yet implemented"
    })))
}

// ==================== PREFERENCES HANDLERS ====================

pub async fn get_preferences(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?;

    info!("Getting notification preferences for user: {}", user_id);

    let preferences_service = match PreferencesService::new().await {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize preferences service: {}", e);
            return Ok(Response::internal_error("Failed to initialize service"));
        }
    };

    match preferences_service.get_preferences(user_id).await {
        Ok(preferences) => Ok(Response::ok(serde_json::json!({
            "success": true,
            "preferences": preferences
        }))),
        Err(e) => {
            error!("Failed to get preferences: {}", e);
            Ok(Response::internal_error(&format!(
                "Failed to get preferences: {}",
                e
            )))
        }
    }
}

pub async fn update_preferences(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?;
    let body = req.body().ok_or("Missing request body")?;

    let preferences: NotificationPreferences =
        serde_json::from_str(body).map_err(|e| format!("Invalid request body: {}", e))?;

    info!("Updating notification preferences for user: {}", user_id);

    let preferences_service = match PreferencesService::new().await {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize preferences service: {}", e);
            return Ok(Response::internal_error("Failed to initialize service"));
        }
    };

    match preferences_service
        .update_preferences(user_id, &preferences)
        .await
    {
        Ok(_) => Ok(Response::ok(serde_json::json!({
            "success": true,
            "message": "Preferences updated successfully"
        }))),
        Err(e) => {
            error!("Failed to update preferences: {}", e);
            Ok(Response::internal_error(&format!(
                "Failed to update preferences: {}",
                e
            )))
        }
    }
}

// ==================== SCHEDULED NOTIFICATIONS HANDLER ====================

pub async fn process_scheduled_notifications(
    _req: Request,
    _ctx: Context,
) -> Result<Response, RouterError> {
    info!("Processing scheduled notifications");

    let scheduler_service = match SchedulerService::new().await {
        Ok(service) => service,
        Err(e) => {
            error!("Failed to initialize scheduler service: {}", e);
            return Ok(Response::internal_error("Failed to initialize service"));
        }
    };

    match scheduler_service.process_scheduled_notifications().await {
        Ok(processed_count) => {
            info!("Processed {} scheduled notifications", processed_count);
            Ok(Response::ok(serde_json::json!({
                "success": true,
                "message": format!("Processed {} scheduled notifications", processed_count),
                "processed_count": processed_count
            })))
        }
        Err(e) => {
            error!("Failed to process scheduled notifications: {}", e);
            Ok(Response::internal_error(&format!(
                "Failed to process scheduled notifications: {}",
                e
            )))
        }
    }
}
