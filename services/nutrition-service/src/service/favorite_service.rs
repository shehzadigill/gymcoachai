use anyhow::Result;

use crate::models::*;
use crate::repository::{FavoriteRepository, FoodRepository};
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct FavoriteService {
    favorite_repository: FavoriteRepository,
    food_repository: FoodRepository,
}

impl FavoriteService {
    pub fn new(favorite_repository: FavoriteRepository, food_repository: FoodRepository) -> Self {
        Self {
            favorite_repository,
            food_repository,
        }
    }

    pub async fn add_favorite_food(&self, user_id: &str, food_id: &str, auth_context: &AuthContext) -> Result<()> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only manage your own favorites"));
        }

        // Ensure food exists
        let exists = self.food_repository.get_food_by_id(food_id).await?.is_some();
        if !exists {
            return Err(anyhow::anyhow!("Food not found"));
        }

        self.favorite_repository.add_favorite_food(user_id, food_id).await
    }

    pub async fn remove_favorite_food(&self, user_id: &str, food_id: &str, auth_context: &AuthContext) -> Result<()> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only manage your own favorites"));
        }

        self.favorite_repository.remove_favorite_food(user_id, food_id).await
    }

    pub async fn list_favorite_foods(&self, user_id: &str, auth_context: &AuthContext) -> Result<Vec<Food>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own favorites"));
        }

        let ids = self.favorite_repository.list_favorite_food_ids(user_id).await?;
        let mut foods = Vec::new();
        for food_id in ids {
            if let Some(food) = self.food_repository.get_food_by_id(&food_id).await? {
                foods.push(food);
            }
        }
        Ok(foods)
    }
}
