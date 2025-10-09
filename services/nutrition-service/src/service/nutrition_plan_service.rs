use validator::Validate;
use anyhow::Result;
use uuid::Uuid;
use chrono::Utc;

use crate::models::*;
use crate::repository::NutritionPlanRepository;
use auth_layer::AuthContext;

#[derive(Clone)]
pub struct NutritionPlanService {
    nutrition_plan_repository: NutritionPlanRepository,
}

impl NutritionPlanService {
    pub fn new(nutrition_plan_repository: NutritionPlanRepository) -> Self {
        Self { nutrition_plan_repository }
    }

    pub async fn create_nutrition_plan(&self, user_id: &str, create_request: &CreateNutritionPlanRequest, auth_context: &AuthContext) -> Result<NutritionPlan> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only create nutrition plans for yourself"));
        }

        // Validate the request
        create_request.validate()?;

        let plan_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let plan = NutritionPlan {
            id: plan_id.clone(),
            user_id: user_id.to_string(),
            name: create_request.name.clone(),
            description: create_request.description.clone(),
            plan_type: create_request.plan_type.clone(),
            goal: create_request.goal.clone(),
            daily_calories: create_request.daily_calories,
            daily_protein: create_request.daily_protein,
            daily_carbs: create_request.daily_carbs,
            daily_fat: create_request.daily_fat,
            dietary_fiber: create_request.dietary_fiber,
            total_sugars: create_request.total_sugars,
            sodium: create_request.sodium,
            meal_plans: create_request.meal_plans.clone(),
            restrictions: create_request.restrictions.clone().unwrap_or_default(),
            preferences: create_request.preferences.clone().unwrap_or_default(),
            start_date: create_request.start_date,
            end_date: create_request.end_date,
            is_active: true,
            created_at: now,
            updated_at: now,
        };

        self.nutrition_plan_repository.create_nutrition_plan(&plan).await
    }

    pub async fn get_nutrition_plan(&self, user_id: &str, plan_id: &str, auth_context: &AuthContext) -> Result<Option<NutritionPlan>> {
        // Authorization check
        if auth_context.user_id != user_id {
            return Err(anyhow::anyhow!("You can only access your own nutrition plans"));
        }

        self.nutrition_plan_repository.get_nutrition_plan_by_id(user_id, plan_id).await
    }
}
