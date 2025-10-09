use validator::Validate;
use anyhow::Result;
use uuid::Uuid;
use chrono::Utc;

use crate::models::*;
use crate::repository::FoodRepository;

#[derive(Clone)]
pub struct FoodService {
    food_repository: FoodRepository,
}

impl FoodService {
    pub fn new(food_repository: FoodRepository) -> Self {
        Self { food_repository }
    }

    pub async fn create_food(&self, create_request: &CreateFoodRequest) -> Result<Food> {
        // Validate the request
        create_request.validate()?;

        let food_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let food = Food {
            id: food_id.clone(),
            name: create_request.name.clone(),
            brand: create_request.brand.clone(),
            category: create_request.category.clone(),
            subcategory: create_request.subcategory.clone(),
            description: create_request.description.clone(),
            barcode: create_request.barcode.clone(),
            upc: create_request.upc.clone(),
            nutrition_facts: create_request.nutrition_facts.clone(),
            serving_size: create_request.serving_size,
            serving_unit: create_request.serving_unit.clone(),
            common_servings: create_request.common_servings.clone().unwrap_or_default(),
            allergens: create_request.allergens.clone().unwrap_or_default().into_iter().map(|a| a.to_string()).collect(),
            dietary_tags: create_request.dietary_tags.clone().unwrap_or_default().into_iter().map(|d| d.to_string()).collect(),
            verified: false,
            verified_by: None,
            verified_at: None,
            created_at: now,
            updated_at: now,
        };

        self.food_repository.create_food(&food).await
    }

    pub async fn get_food(&self, food_id: &str) -> Result<Option<Food>> {
        self.food_repository.get_food_by_id(food_id).await
    }

    pub async fn search_foods(&self, query: &str, limit: Option<u32>, cursor: Option<String>) -> Result<(Vec<Food>, Option<String>)> {
        let limit = limit.unwrap_or(20).min(100); // Max 100 results
        self.food_repository.search_foods(query, limit, cursor).await
    }
}
