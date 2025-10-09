use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use std::collections::HashMap;
use anyhow::Result;
use tracing::{info, error};

use crate::models::*;

#[derive(Clone)]
pub struct NutritionPlanRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl NutritionPlanRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn create_nutrition_plan(&self, plan: &NutritionPlan) -> Result<NutritionPlan> {
        let mut item = HashMap::new();
        
        // Primary key
        item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", plan.user_id)));
        item.insert("SK".to_string(), AttributeValue::S(format!("NUTRITION_PLAN#{}", plan.id)));
        item.insert("GSI1PK".to_string(), AttributeValue::S(format!("NUTRITION_PLAN#{}", plan.id)));
        item.insert("GSI1SK".to_string(), AttributeValue::S(format!("USER#{}", plan.user_id)));
        
        // Entity type
        item.insert("EntityType".to_string(), AttributeValue::S("NUTRITION_PLAN".to_string()));
        
        // Plan data
        item.insert("PlanId".to_string(), AttributeValue::S(plan.id.clone()));
        item.insert("UserId".to_string(), AttributeValue::S(plan.user_id.clone()));
        item.insert("Name".to_string(), AttributeValue::S(plan.name.clone()));
        
        if let Some(description) = &plan.description {
            item.insert("Description".to_string(), AttributeValue::S(description.clone()));
        }
        
        item.insert("PlanType".to_string(), AttributeValue::S(serde_json::to_string(&plan.plan_type)?));
        item.insert("Goal".to_string(), AttributeValue::S(serde_json::to_string(&plan.goal)?));
        
        item.insert("DailyCalories".to_string(), AttributeValue::N(plan.daily_calories.to_string()));
        item.insert("DailyProtein".to_string(), AttributeValue::N(plan.daily_protein.to_string()));
        item.insert("DailyCarbs".to_string(), AttributeValue::N(plan.daily_carbs.to_string()));
        item.insert("DailyFat".to_string(), AttributeValue::N(plan.daily_fat.to_string()));
        item.insert("DietaryFiber".to_string(), AttributeValue::N(plan.dietary_fiber.to_string()));
        item.insert("TotalSugars".to_string(), AttributeValue::N(plan.total_sugars.to_string()));
        item.insert("Sodium".to_string(), AttributeValue::N(plan.sodium.to_string()));
        
        item.insert("MealPlans".to_string(), AttributeValue::S(serde_json::to_string(&plan.meal_plans)?));
        item.insert("Restrictions".to_string(), AttributeValue::S(serde_json::to_string(&plan.restrictions)?));
        item.insert("Preferences".to_string(), AttributeValue::S(serde_json::to_string(&plan.preferences)?));
        
        item.insert("StartDate".to_string(), AttributeValue::S(plan.start_date.to_rfc3339()));
        
        if let Some(end_date) = &plan.end_date {
            item.insert("EndDate".to_string(), AttributeValue::S(end_date.to_rfc3339()));
        }
        
        item.insert("IsActive".to_string(), AttributeValue::Bool(plan.is_active));
        item.insert("CreatedAt".to_string(), AttributeValue::S(plan.created_at.to_rfc3339()));
        item.insert("UpdatedAt".to_string(), AttributeValue::S(plan.updated_at.to_rfc3339()));

        let request = self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(PK)");

        match request.send().await {
            Ok(_) => {
                info!("Nutrition plan created successfully: {}", plan.id);
                Ok(plan.clone())
            }
            Err(e) => {
                error!("Failed to create nutrition plan: {}", e);
                Err(anyhow::anyhow!("Failed to create nutrition plan: {}", e))
            }
        }
    }

    pub async fn get_nutrition_plan_by_id(&self, user_id: &str, plan_id: &str) -> Result<Option<NutritionPlan>> {
        let request = self.client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("NUTRITION_PLAN#{}", plan_id)));

        match request.send().await {
            Ok(response) => {
                if let Some(item) = response.item() {
                    Ok(Some(self.item_to_nutrition_plan(item)?))
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to get nutrition plan by ID: {}", e);
                Err(anyhow::anyhow!("Failed to get nutrition plan: {}", e))
            }
        }
    }

    // Helper method to convert DynamoDB item to NutritionPlan
    fn item_to_nutrition_plan(&self, item: &HashMap<String, AttributeValue>) -> Result<NutritionPlan> {
        let id = item.get("PlanId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing PlanId"))?
            .clone();

        let user_id = item.get("UserId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing UserId"))?
            .clone();

        let name = item.get("Name")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing Name"))?
            .clone();

        let description = item.get("Description")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let plan_type = item.get("PlanType")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<NutritionPlanType>(s).ok())
            .unwrap_or(NutritionPlanType::Custom);

        let goal = item.get("Goal")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<NutritionGoal>(s).ok())
            .unwrap_or(NutritionGoal::Other);

        let daily_calories = item.get("DailyCalories")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<u16>().ok())
            .unwrap_or(2000);

        let daily_protein = item.get("DailyProtein")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(150.0);

        let daily_carbs = item.get("DailyCarbs")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(250.0);

        let daily_fat = item.get("DailyFat")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(65.0);

        let dietary_fiber = item.get("DietaryFiber")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(25.0);

        let total_sugars = item.get("TotalSugars")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(50.0);

        let sodium = item.get("Sodium")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(2300.0);

        let meal_plans = item.get("MealPlans")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<MealPlan>>(s).ok())
            .unwrap_or_default();

        let restrictions = item.get("Restrictions")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<DietaryRestriction>>(s).ok())
            .unwrap_or_default();

        let preferences = item.get("Preferences")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<DietaryPreference>>(s).ok())
            .unwrap_or_default();

        let start_date = item.get("StartDate")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| chrono::Utc::now());

        let end_date = item.get("EndDate")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let is_active = item.get("IsActive")
            .and_then(|v| v.as_bool().ok())
            .copied()
            .unwrap_or(true);

        let created_at = item.get("CreatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| chrono::Utc::now());

        let updated_at = item.get("UpdatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| chrono::Utc::now());

        Ok(NutritionPlan {
            id,
            user_id,
            name,
            description,
            plan_type,
            goal,
            daily_calories,
            daily_protein,
            daily_carbs,
            daily_fat,
            dietary_fiber,
            total_sugars,
            sodium,
            meal_plans,
            restrictions,
            preferences,
            start_date,
            end_date,
            is_active,
            created_at,
            updated_at,
        })
    }
}
