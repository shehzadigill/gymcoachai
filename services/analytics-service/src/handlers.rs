use auth_layer::AuthContext;
use lambda_router::{Context, Request, Response, RouterError};
use tracing::error;

use crate::{
    ACHIEVEMENT_CONTROLLER, BODY_MEASUREMENT_CONTROLLER, MILESTONE_CONTROLLER,
    PERFORMANCE_TREND_CONTROLLER, PROGRESS_CHART_CONTROLLER, PROGRESS_PHOTO_CONTROLLER,
    STRENGTH_PROGRESS_CONTROLLER, WORKOUT_ANALYTICS_CONTROLLER,
};

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

// ==================== STRENGTH PROGRESS HANDLERS ====================

pub async fn get_strength_progress(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let start_date = req.query("startDate").map(|s| s.to_string());
    let end_date = req.query("endDate").map(|s| s.to_string());

    let controller = STRENGTH_PROGRESS_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_strength_progress(&user_id, start_date.as_deref(), end_date.as_deref())
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_strength_progress handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_strength_progress(
    req: Request,
    _ctx: Context,
) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    let controller = STRENGTH_PROGRESS_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.create_strength_progress(body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_strength_progress handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== BODY MEASUREMENT HANDLERS ====================

pub async fn get_body_measurements(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let start_date = req.query("startDate").map(|s| s.to_string());
    let end_date = req.query("endDate").map(|s| s.to_string());

    let controller = BODY_MEASUREMENT_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_body_measurements(&user_id, start_date.as_deref(), end_date.as_deref())
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_body_measurements handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_body_measurement(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    let controller = BODY_MEASUREMENT_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.create_body_measurement(body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_body_measurement handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== PROGRESS CHART HANDLERS ====================

pub async fn get_progress_charts(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;

    let controller = PROGRESS_CHART_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.get_progress_charts(&user_id).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_progress_charts handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_progress_chart(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    let controller = PROGRESS_CHART_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.create_progress_chart(body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_progress_chart handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== MILESTONE HANDLERS ====================

pub async fn get_milestones(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;

    let controller = MILESTONE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.get_milestones(&user_id).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_milestones handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_milestone(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    let controller = MILESTONE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.create_milestone(body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_milestone handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== ACHIEVEMENT HANDLERS ====================

pub async fn get_achievements(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;

    let controller = ACHIEVEMENT_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.get_achievements(&user_id).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_achievements handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_achievement(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    let controller = ACHIEVEMENT_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.create_achievement(body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_achievement handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== PERFORMANCE TREND HANDLERS ====================

pub async fn get_performance_trends(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let start_date = req.query("startDate").map(|s| s.to_string());
    let end_date = req.query("endDate").map(|s| s.to_string());

    let controller = PERFORMANCE_TREND_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_performance_trends(&user_id, start_date.as_deref(), end_date.as_deref())
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_performance_trends handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== WORKOUT ANALYTICS HANDLERS ====================

pub async fn get_workout_analytics(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let period = req.query("period").map(|s| s.to_string());

    let controller = WORKOUT_ANALYTICS_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_workout_analytics(&user_id, period.as_deref())
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_workout_analytics handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_workout_insights(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let period = req.query("period").map(|s| s.to_string());

    let controller = WORKOUT_ANALYTICS_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_workout_insights(&user_id, period.as_deref())
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_workout_insights handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== PROGRESS PHOTO HANDLERS ====================

pub async fn get_progress_photos(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;
    let photo_type = req.query("photoType").map(|s| s.to_string());
    let start_date = req.query("startDate").map(|s| s.to_string());
    let end_date = req.query("endDate").map(|s| s.to_string());
    let limit = req.query("limit").and_then(|s| s.parse::<u32>().ok());

    let controller = PROGRESS_PHOTO_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_progress_photos(
            &user_id,
            photo_type.as_deref(),
            start_date.as_deref(),
            end_date.as_deref(),
            limit,
        )
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_progress_photos handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn upload_progress_photo(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;

    // Get user_id from path parameter or authenticated context
    let user_id = if let Some(user_id_param) = req.path_param("userId") {
        user_id_param.to_string()
    } else {
        ctx.user_id.clone().ok_or("Unauthorized")?
    };

    // Parse the body and inject userId if not present
    let mut body_json: serde_json::Value =
        serde_json::from_str(body).map_err(|_| RouterError::from("Invalid JSON body"))?;

    // Ensure userId is in the body
    if body_json["userId"].is_null() || body_json["userId"].as_str().unwrap_or("").is_empty() {
        body_json["userId"] = serde_json::Value::String(user_id);
    }

    let updated_body = serde_json::to_string(&body_json)
        .map_err(|_| RouterError::from("Failed to serialize body"))?;

    let controller = PROGRESS_PHOTO_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.upload_progress_photo(&updated_body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in upload_progress_photo handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_progress_photo(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let photo_id = req.path_param("photoId").ok_or("Missing photoId")?;
    let body = req.body().ok_or("Missing request body")?;

    let controller = PROGRESS_PHOTO_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.update_progress_photo(photo_id, body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_progress_photo handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn delete_progress_photo(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let photo_id = req.path_param("photoId").ok_or("Missing photoId")?;

    let controller = PROGRESS_PHOTO_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.delete_progress_photo(photo_id).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in delete_progress_photo handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_progress_photo_analytics(
    req: Request,
    ctx: Context,
) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;

    // Handle both time_range and startDate/endDate parameters
    let (start_date, end_date) = if let Some(time_range) = req.query("time_range") {
        time_range_to_dates(time_range)
    } else {
        let start_date = req
            .query("startDate")
            .map(|s| s.to_string())
            .unwrap_or_else(|| (chrono::Utc::now() - chrono::Duration::days(30)).to_rfc3339());
        let end_date = req
            .query("endDate")
            .map(|s| s.to_string())
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
        (start_date, end_date)
    };

    let controller = PROGRESS_PHOTO_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_progress_photo_analytics(&user_id, Some(&start_date), Some(&end_date))
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_progress_photo_analytics handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_progress_photo_timeline(
    req: Request,
    ctx: Context,
) -> Result<Response, RouterError> {
    let user_id = get_user_id(&req, &ctx)?;

    // Handle both time_range and startDate/endDate parameters
    let (start_date, end_date) = if let Some(time_range) = req.query("time_range") {
        time_range_to_dates(time_range)
    } else {
        let start_date = req
            .query("startDate")
            .map(|s| s.to_string())
            .unwrap_or_else(|| (chrono::Utc::now() - chrono::Duration::days(30)).to_rfc3339());
        let end_date = req
            .query("endDate")
            .map(|s| s.to_string())
            .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());
        (start_date, end_date)
    };

    let controller = PROGRESS_PHOTO_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_progress_photo_timeline(&user_id, Some(&start_date), Some(&end_date))
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_progress_photo_timeline handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// Helper function to convert time range to dates
fn time_range_to_dates(time_range: &str) -> (String, String) {
    let now = chrono::Utc::now();
    let start_date = match time_range {
        "7d" => now - chrono::Duration::days(7),
        "30d" => now - chrono::Duration::days(30),
        "90d" => now - chrono::Duration::days(90),
        "1y" => now - chrono::Duration::days(365),
        _ => now - chrono::Duration::days(30), // default to 30 days
    };
    (start_date.to_rfc3339(), now.to_rfc3339())
}
