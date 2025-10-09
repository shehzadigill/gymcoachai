use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::service::FavoriteService;
use crate::utils::ResponseBuilder;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct FavoriteController {
    favorite_service: FavoriteService,
}

impl FavoriteController {
    pub fn new(favorite_service: FavoriteService) -> Self {
        Self { favorite_service }
    }

    pub async fn add_favorite_food(&self, user_id: &str, food_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.favorite_service.add_favorite_food(user_id, food_id, auth_context).await {
            Ok(_) => Ok(ResponseBuilder::ok(json!({
                "message": "Favorite added"
            }))),
            Err(e) => {
                error!("Error adding favorite: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else if msg.contains("not found") {
                    Ok(ResponseBuilder::not_found(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to add favorite"))
                }
            }
        }
    }

    pub async fn remove_favorite_food(&self, user_id: &str, food_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.favorite_service.remove_favorite_food(user_id, food_id, auth_context).await {
            Ok(_) => Ok(ResponseBuilder::ok(json!({
                "message": "Favorite removed"
            }))),
            Err(e) => {
                error!("Error removing favorite: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to remove favorite"))
                }
            }
        }
    }

    pub async fn list_favorite_foods(&self, user_id: &str, auth_context: &AuthContext) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.favorite_service.list_favorite_foods(user_id, auth_context).await {
            Ok(foods) => Ok(ResponseBuilder::ok(json!({
                "foods": foods,
                "count": foods.len()
            }))),
            Err(e) => {
                error!("Error listing favorite foods: {}", e);
                let msg = e.to_string();
                if msg.contains("You can only access") {
                    Ok(ResponseBuilder::forbidden(&msg))
                } else {
                    Ok(ResponseBuilder::internal_server_error("Failed to get favorites"))
                }
            }
        }
    }
}
