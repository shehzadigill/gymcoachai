use auth_layer::AuthContext;
use lambda_router::{Context, Request, Response, RouterError};
use serde::{Deserialize, Serialize};
use tracing::error;

use crate::{SLEEP_CONTROLLER, UPLOAD_CONTROLLER, USER_PROFILE_CONTROLLER};

// Helper function to get auth context from request context
pub fn get_auth_context(ctx: &Context) -> AuthContext {
    ctx.custom
        .get("auth_context")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(|| AuthContext {
            user_id: ctx.user_id.clone().unwrap_or_default(),
            email: ctx.email.clone().unwrap_or_default(),
            roles: vec![],
            permissions: vec![],
            exp: 0,
            iat: 0,
        })
}

// Helper function to extract user_id from path or use authenticated user
fn get_user_id(req: &Request, ctx: &Context) -> Result<String, RouterError> {
    if let Some(user_id) = req.path_param("userId") {
        Ok(user_id.to_string())
    } else {
        ctx.user_id
            .clone()
            .ok_or_else(|| RouterError::from("Unauthorized"))
    }
}

// ==================== USER PROFILE HANDLERS ====================

pub async fn get_user_profile(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let auth_context = get_auth_context(&ctx);

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    // Construct path for controller (legacy compatibility)
    let path = format!("/api/user-profiles/profile/{}", user_id);

    match controller.get_user_profile(&path, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_user_profile handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_user_profile_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?.clone();
    let auth_context = get_auth_context(&ctx);

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    let path = "/api/user-profiles/profile";

    match controller.get_user_profile(path, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_user_profile_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_user_profile(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    let path = format!("/api/user-profiles/profile/{}", user_id);

    match controller
        .partial_update_user_profile(&path, body, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_user_profile handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_user_profile_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?.clone();
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    let path = "/api/user-profiles/profile";

    match controller
        .partial_update_user_profile(path, body, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_user_profile_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn delete_user_profile(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let auth_context = get_auth_context(&ctx);

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    let path = format!("/api/user-profiles/profile/{}", user_id);

    match controller.delete_user_profile(&path, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in delete_user_profile handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_user_stats(_req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    let path = "/api/user-profiles/profile/stats";

    match controller.get_user_stats(path, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_user_stats handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_user_preferences(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);

    // Try to get userId from path parameter, otherwise use authenticated user
    let user_id = if let Some(user_id) = req.path_param("userId") {
        user_id.to_string()
    } else {
        ctx.user_id.clone().ok_or("Unauthorized")?
    };

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    let path = format!("/api/user-profiles/profile/preferences/{}", user_id);

    match controller.get_user_preferences(&path, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_user_preferences handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_user_preferences(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    // Try to get userId from path parameter, otherwise use authenticated user
    let user_id = if let Some(user_id) = req.path_param("userId") {
        user_id.to_string()
    } else {
        ctx.user_id.clone().ok_or("Unauthorized")?
    };

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    let path = format!("/api/user-profiles/profile/preferences/{}", user_id);

    match controller
        .update_user_preferences(&path, body, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_user_preferences handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== UPLOAD HANDLERS ====================

pub async fn generate_upload_url(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    let controller = UPLOAD_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.generate_upload_url(body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in generate_upload_url handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== SLEEP HANDLERS ====================

pub async fn get_sleep_data(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);

    // Extract query parameters
    let mut query_params = std::collections::HashMap::new();
    if let Some(user_id) = req.query("userId") {
        query_params.insert("userId".to_string(), user_id.to_string());
    } else if let Some(user_id) = &ctx.user_id {
        query_params.insert("userId".to_string(), user_id.clone());
    }
    if let Some(date) = req.query("date") {
        query_params.insert("date".to_string(), date.to_string());
    }

    let controller = SLEEP_CONTROLLER.get().ok_or("Controller not initialized")?;

    match controller
        .get_sleep_data(&query_params, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_sleep_data handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn save_sleep_data(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = SLEEP_CONTROLLER.get().ok_or("Controller not initialized")?;

    match controller.save_sleep_data(body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in save_sleep_data handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_sleep_data(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = SLEEP_CONTROLLER.get().ok_or("Controller not initialized")?;

    match controller.update_sleep_data(body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_sleep_data handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_sleep_history(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);

    // Extract query parameters
    let mut query_params = std::collections::HashMap::new();
    if let Some(user_id) = req.query("userId") {
        query_params.insert("userId".to_string(), user_id.to_string());
    } else if let Some(user_id) = &ctx.user_id {
        query_params.insert("userId".to_string(), user_id.clone());
    }
    if let Some(start_date) = req.query("startDate") {
        query_params.insert("startDate".to_string(), start_date.to_string());
    }
    if let Some(end_date) = req.query("endDate") {
        query_params.insert("endDate".to_string(), end_date.to_string());
    }

    let controller = SLEEP_CONTROLLER.get().ok_or("Controller not initialized")?;

    match controller
        .get_sleep_history(&query_params, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_sleep_history handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_sleep_stats(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);

    // Extract query parameters
    let mut query_params = std::collections::HashMap::new();
    if let Some(user_id) = req.query("userId") {
        query_params.insert("userId".to_string(), user_id.to_string());
    } else if let Some(user_id) = &ctx.user_id {
        query_params.insert("userId".to_string(), user_id.clone());
    }
    if let Some(period) = req.query("period") {
        query_params.insert("period".to_string(), period.to_string());
    }

    let controller = SLEEP_CONTROLLER.get().ok_or("Controller not initialized")?;

    match controller
        .get_sleep_stats(&query_params, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_sleep_stats handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== DEVICE TOKEN HANDLERS ====================

#[derive(Deserialize)]
pub struct DeviceTokenRequest {
    pub token: String,
    pub platform: String,
}

#[derive(Serialize)]
pub struct DeviceTokenResponse {
    pub success: bool,
    pub message: String,
    pub device_id: Option<String>,
}

pub async fn save_device_token(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let auth_context = get_auth_context(&ctx);

    let body = req.body().ok_or("Missing request body")?;
    let payload: DeviceTokenRequest =
        serde_json::from_str(body).map_err(|e| format!("Invalid request body: {}", e))?;

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    // Construct path for controller
    let path = format!("/api/user-profiles/device-token");

    let request_body = serde_json::json!({
        "user_id": user_id,
        "token": payload.token,
        "platform": payload.platform
    });

    match controller
        .save_device_token(&path, &auth_context, &request_body)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in save_device_token handler: {}", e);
            Ok(Response::internal_error("Failed to save device token"))
        }
    }
}

pub async fn get_device_tokens(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let auth_context = get_auth_context(&ctx);

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    // Construct path for controller
    let path = format!("/api/user-profiles/device-tokens/{}", user_id);

    match controller.get_device_tokens(&path, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_device_tokens handler: {}", e);
            Ok(Response::internal_error("Failed to get device tokens"))
        }
    }
}

pub async fn delete_device_token(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let device_id = req.path_param("deviceId").ok_or("Missing deviceId")?;
    let auth_context = get_auth_context(&ctx);

    let controller = USER_PROFILE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    // Construct path for controller
    let path = format!("/api/user-profiles/device-token/{}/{}", user_id, device_id);

    match controller.delete_device_token(&path, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in delete_device_token handler: {}", e);
            Ok(Response::internal_error("Failed to delete device token"))
        }
    }
}
