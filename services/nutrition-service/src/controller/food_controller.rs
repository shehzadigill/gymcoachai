use serde_json::{json, Value};
use anyhow::Result;
use tracing::error;

use crate::models::*;
use crate::service::FoodService;
use crate::utils::{ResponseBuilder, DataHelper};

#[derive(Clone)]
pub struct FoodController {
    food_service: FoodService,
}

impl FoodController {
    pub fn new(food_service: FoodService) -> Self {
        Self { food_service }
    }

    pub async fn create_food(&self, body: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let create_request: Result<CreateFoodRequest, _> = DataHelper::parse_json_to_type(body);
        
        match create_request {
            Ok(request) => {
                match self.food_service.create_food(&request).await {
                    Ok(food) => Ok(ResponseBuilder::created(json!({
                        "id": food.id,
                        "name": food.name,
                        "brand": food.brand,
                        "category": food.category,
                        "nutrition_facts": food.nutrition_facts,
                        "serving_size": food.serving_size,
                        "serving_unit": food.serving_unit,
                        "created_at": food.created_at,
                        "message": "Food created successfully"
                    }))),
                    Err(e) => {
                        error!("Error creating food: {}", e);
                        Ok(ResponseBuilder::internal_server_error("Failed to create food"))
                    }
                }
            }
            Err(_) => {
                error!("Error parsing create food request");
                Ok(ResponseBuilder::bad_request("Invalid JSON in request body"))
            }
        }
    }

    pub async fn get_food(&self, food_id: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.food_service.get_food(food_id).await {
            Ok(Some(food)) => Ok(ResponseBuilder::ok(food)),
            Ok(None) => Ok(ResponseBuilder::not_found("Food not found")),
            Err(e) => {
                error!("Error fetching food: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to retrieve food"))
            }
        }
    }

    pub async fn search_foods(&self, query: &str, limit: Option<u32>, cursor: Option<String>) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        match self.food_service.search_foods(query, limit, cursor).await {
            Ok((foods, next_cursor)) => Ok(ResponseBuilder::ok(json!({
                "foods": foods,
                "query": query,
                "count": foods.len(),
                "limit": limit.unwrap_or(20),
                "next_cursor": next_cursor
            }))),
            Err(e) => {
                error!("Error searching foods: {}", e);
                Ok(ResponseBuilder::internal_server_error("Failed to search foods"))
            }
        }
    }
}
