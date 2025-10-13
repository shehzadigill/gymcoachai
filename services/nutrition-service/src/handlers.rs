use lambda_router::{Request, Response, Context, RouterError};
use tracing::error;
use auth_layer::AuthContext;

use crate::{
    MEAL_CONTROLLER, FOOD_CONTROLLER, NUTRITION_PLAN_CONTROLLER,
    WATER_CONTROLLER, FAVORITE_CONTROLLER, NUTRITION_STATS_CONTROLLER,
};

// Helper function to get auth context from request context
pub fn get_auth_context(ctx: &Context) -> AuthContext {
    ctx.custom.get("auth_context")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_else(|| {
            AuthContext {
                user_id: ctx.user_id.clone().unwrap_or_default(),
                email: ctx.email.clone().unwrap_or_default(),
                roles: vec![],
                permissions: vec![],
                exp: 0,
                iat: 0,
            }
        })
}

// ==================== MEAL HANDLERS ====================

pub async fn create_meal(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.create_meal(user_id, body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_meal handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn create_meal_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?.clone();
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.create_meal(&user_id, body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_meal_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_meal(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let meal_id = req.path_param("mealId").ok_or("Missing mealId")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_meal(user_id, meal_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_meal handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_meals_by_date(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let date = req.path_param("date").ok_or("Missing date")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_meals_by_date(user_id, date, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_meals_by_date handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_user_meals(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_user_meals(user_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_user_meals handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_user_meals_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?.clone();
    let auth_context = get_auth_context(&ctx);
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_user_meals(&user_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_user_meals_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_meals_by_date_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = ctx.user_id.as_ref().ok_or("Unauthorized")?.clone();
    let date = req.path_param("date").ok_or("Missing date")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_meals_by_date(&user_id, date, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_meals_by_date_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn update_meal(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let meal_id = req.path_param("mealId").ok_or("Missing mealId")?;
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.update_meal(user_id, meal_id, body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in update_meal handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn delete_meal(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let meal_id = req.path_param("mealId").ok_or("Missing mealId")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = MEAL_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.delete_meal(user_id, meal_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in delete_meal handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== FOOD HANDLERS ====================

pub async fn create_food(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let body = req.body().ok_or("Missing request body")?;
    
    let controller = FOOD_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.create_food(body).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_food handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_food(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let food_id = req.path_param("foodId").ok_or("Missing foodId")?;
    
    let controller = FOOD_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_food(food_id).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_food handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn search_foods(req: Request, _ctx: Context) -> Result<Response, RouterError> {
    let query = req.query("q").ok_or("Missing query parameter 'q'")?;
    let limit = req.query("limit").and_then(|s| s.parse::<u32>().ok());
    let cursor = req.query("cursor").cloned();
    
    let controller = FOOD_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.search_foods(query, limit, cursor).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in search_foods handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== FAVORITE HANDLERS ====================

pub async fn add_favorite_food(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let food_id = req.path_param("foodId").ok_or("Missing foodId")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = FAVORITE_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.add_favorite_food(user_id, food_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in add_favorite_food handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn remove_favorite_food(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let food_id = req.path_param("foodId").ok_or("Missing foodId")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = FAVORITE_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.remove_favorite_food(user_id, food_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in remove_favorite_food handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn list_favorite_foods(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = FAVORITE_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.list_favorite_foods(user_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in list_favorite_foods handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn list_favorite_foods_me(_req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let user_id = &auth_context.user_id;
    
    let controller = FAVORITE_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.list_favorite_foods(user_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in list_favorite_foods_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn add_favorite_food_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let user_id = &auth_context.user_id;
    let food_id = req.path_param("foodId").ok_or("Missing foodId")?;
    
    let controller = FAVORITE_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.add_favorite_food(user_id, food_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in add_favorite_food_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn remove_favorite_food_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let auth_context = get_auth_context(&ctx);
    let user_id = &auth_context.user_id;
    let food_id = req.path_param("foodId").ok_or("Missing foodId")?;
    
    let controller = FAVORITE_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.remove_favorite_food(user_id, food_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in remove_favorite_food_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== NUTRITION PLAN HANDLERS ====================

pub async fn create_nutrition_plan(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;
    
    let controller = NUTRITION_PLAN_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.create_nutrition_plan(user_id, body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in create_nutrition_plan handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_nutrition_plan(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let plan_id = req.path_param("planId").ok_or("Missing planId")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = NUTRITION_PLAN_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_nutrition_plan(user_id, plan_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_nutrition_plan handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== NUTRITION STATS HANDLERS ====================

pub async fn get_nutrition_stats(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = NUTRITION_STATS_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_nutrition_stats(user_id, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_nutrition_stats handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

// ==================== WATER HANDLERS ====================

pub async fn get_water(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let date = req.path_param("date").ok_or("Missing date")?;
    let auth_context = get_auth_context(&ctx);
    
    let controller = WATER_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_water(user_id, date, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_water handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn set_water(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let user_id = req.path_param("userId").ok_or("Missing userId")?;
    let date = req.path_param("date").ok_or("Missing date")?;
    let auth_context = get_auth_context(&ctx);
    let body = req.body().ok_or("Missing request body")?;
    
    let controller = WATER_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.set_water(user_id, date, body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in set_water handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn get_water_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let date = req.path_param("date").ok_or("Missing date")?;
    let auth_context = get_auth_context(&ctx);
    let user_id = &auth_context.user_id;
    
    let controller = WATER_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.get_water(user_id, date, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in get_water_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}

pub async fn set_water_me(req: Request, ctx: Context) -> Result<Response, RouterError> {
    let date = req.path_param("date").ok_or("Missing date")?;
    let auth_context = get_auth_context(&ctx);
    let user_id = &auth_context.user_id;
    let body = req.body().ok_or("Missing request body")?;
    
    let controller = WATER_CONTROLLER.get().ok_or("Controller not initialized")?;
    
    match controller.set_water(user_id, date, body, &auth_context).await {
        Ok(response_value) => Ok(Response::from_json_value(response_value)),
        Err(e) => {
            error!("Error in set_water_me handler: {}", e);
            Ok(Response::internal_error("Failed to process request"))
        }
    }
}
