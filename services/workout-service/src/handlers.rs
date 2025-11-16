use auth_layer::AuthContext;
use lambda_router::{Context, Request, Response, RouterError};
use tracing::error;

use crate::{
    EXERCISE_CONTROLLER, SCHEDULED_WORKOUT_CONTROLLER, WORKOUT_ANALYTICS_CONTROLLER,
    WORKOUT_PLAN_CONTROLLER, WORKOUT_SESSION_CONTROLLER,
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

// ==================== WORKOUT PLAN HANDLERS ====================

pub async fn get_workout_plans(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let user_id = req.query("userId").map(|s| s.to_string());

    let controller = WORKOUT_PLAN_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.get_workout_plans(user_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_workout_plans handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_workout_plan(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = WORKOUT_PLAN_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.create_workout_plan(body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_workout_plan handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_workout_plan(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let plan_id = req.path_param("planId").ok_or("Missing planId parameter")?;
    let user_id = req.query("userId").unwrap_or(&auth_context.user_id);

    let controller = WORKOUT_PLAN_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_workout_plan(user_id, plan_id, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_workout_plan handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_workout_plan(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = WORKOUT_PLAN_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.update_workout_plan(body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_workout_plan handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn delete_workout_plan(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let plan_id = req.path_param("planId").ok_or("Missing planId parameter")?;
    let user_id = req.query("userId").unwrap_or(&auth_context.user_id);

    let controller = WORKOUT_PLAN_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .delete_workout_plan(user_id, plan_id, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in delete_workout_plan handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== WORKOUT SESSION HANDLERS ====================

pub async fn get_workout_sessions(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let user_id = req.query("userId").map(|s| s.to_string());
    let workout_plan_id = req.query("workoutPlanId").map(|s| s.to_string());

    let controller = WORKOUT_SESSION_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_workout_sessions(user_id, workout_plan_id, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_workout_sessions handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_workout_session(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = WORKOUT_SESSION_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.create_workout_session(body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_workout_session handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_workout_session(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let session_id = req
        .path_param("sessionId")
        .ok_or("Missing sessionId parameter")?;

    let controller = WORKOUT_SESSION_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_workout_session(session_id, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_workout_session handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_workout_session(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = WORKOUT_SESSION_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.update_workout_session(body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_workout_session handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn delete_workout_session(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let session_id = req
        .path_param("sessionId")
        .ok_or("Missing sessionId parameter")?;

    let controller = WORKOUT_SESSION_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .delete_workout_session(session_id, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in delete_workout_session handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== EXERCISE HANDLERS ====================

pub async fn get_exercises(_req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);

    let controller = EXERCISE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.get_exercises(&auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_exercises handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_exercise(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = EXERCISE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.create_exercise(body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_exercise handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_exercise(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let exercise_id = req
        .path_param("exerciseId")
        .ok_or("Missing exerciseId parameter")?;

    let controller = EXERCISE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.get_exercise(exercise_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_exercise handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_exercise(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = EXERCISE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.update_exercise(body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_exercise handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn clone_exercise(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let exercise_id = req
        .path_param("exerciseId")
        .ok_or("Missing exerciseId parameter")?;

    let controller = EXERCISE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.clone_exercise(exercise_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in clone_exercise handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn delete_exercise(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let exercise_id = req
        .path_param("exerciseId")
        .ok_or("Missing exerciseId parameter")?;

    let controller = EXERCISE_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller.delete_exercise(exercise_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in delete_exercise handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== ANALYTICS HANDLERS ====================

pub async fn get_workout_analytics(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let user_id = req.query("userId").map(|s| s.to_string());

    let controller = WORKOUT_ANALYTICS_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_workout_analytics(user_id, &auth_context)
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
    let auth_context = get_auth_context(&ctx);
    let user_id = req.query("userId").unwrap_or(&auth_context.user_id);
    let default_time_range = "week".to_string();
    let time_range = req.query("timeRange").unwrap_or(&default_time_range);

    let controller = WORKOUT_ANALYTICS_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_workout_insights(user_id, time_range, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_workout_insights handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_workout_history(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let user_id = req.query("userId").unwrap_or(&auth_context.user_id);
    let limit = req.query("limit").and_then(|s| s.parse::<i32>().ok());

    let controller = WORKOUT_ANALYTICS_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_workout_history(user_id, limit, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_workout_history handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn log_activity(_req: Request, _ctx: Context) -> Result<Response, RouterError> {
    // Return 501 Not Implemented
    Ok(Response::new(501)
        .json(serde_json::json!({
            "error": "Not Implemented",
            "message": "Log activity endpoint not yet implemented"
        }))
        .with_cors())
}

// ==================== SCHEDULED WORKOUT HANDLERS ====================

pub async fn schedule_workout_plan(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = SCHEDULED_WORKOUT_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .create_scheduled_workout(body, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in schedule_workout_plan handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_scheduled_workouts(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let user_id = req.query("userId").map(|s| s.to_string());

    let controller = SCHEDULED_WORKOUT_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .get_scheduled_workouts(user_id, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_scheduled_workouts handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_scheduled_workout(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;

    let controller = SCHEDULED_WORKOUT_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .update_scheduled_workout(body, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_scheduled_workout handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn delete_scheduled_workout(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let schedule_id = req
        .path_param("scheduleId")
        .ok_or("Missing scheduleId parameter")?;
    let user_id = req.query("userId").unwrap_or(&auth_context.user_id);

    let controller = SCHEDULED_WORKOUT_CONTROLLER
        .get()
        .ok_or("Controller not initialized")?;

    match controller
        .delete_scheduled_workout(user_id, schedule_id, &auth_context)
        .await
    {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in delete_scheduled_workout handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}
