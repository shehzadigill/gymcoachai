use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use aws_sdk_dynamodb::types::ReturnValue;
use serde_json::Value;
use std::collections::HashMap;
use anyhow::Result;
use tracing::{info, error, warn};
use chrono::{DateTime, Utc};

use crate::models::*;

pub struct NutritionRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl NutritionRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    // Meal operations
    pub async fn create_meal(&self, meal: &Meal) -> Result<Meal> {
        let mut item = HashMap::new();
        
        // Primary key
        item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", meal.user_id)));
        item.insert("SK".to_string(), AttributeValue::S(format!("MEAL#{}", meal.id)));
        item.insert("GSI1PK".to_string(), AttributeValue::S(format!("MEAL#{}", meal.id)));
        item.insert("GSI1SK".to_string(), AttributeValue::S(format!("USER#{}", meal.user_id)));
        item.insert("GSI2PK".to_string(), AttributeValue::S(format!("USER#{}#{}", meal.user_id, meal.meal_date.format("%Y-%m-%d"))));
        item.insert("GSI2SK".to_string(), AttributeValue::S(format!("MEAL#{}", meal.id)));
        
        // Entity type
        item.insert("EntityType".to_string(), AttributeValue::S("MEAL".to_string()));
        
        // Meal data
        item.insert("MealId".to_string(), AttributeValue::S(meal.id.clone()));
        item.insert("UserId".to_string(), AttributeValue::S(meal.user_id.clone()));
        item.insert("Name".to_string(), AttributeValue::S(meal.name.clone()));
        
        if let Some(description) = &meal.description {
            item.insert("Description".to_string(), AttributeValue::S(description.clone()));
        }
        
        item.insert("MealType".to_string(), AttributeValue::S(serde_json::to_string(&meal.meal_type)?));
        item.insert("MealDate".to_string(), AttributeValue::S(meal.meal_date.to_rfc3339()));
        
        if let Some(meal_time) = &meal.meal_time {
            item.insert("MealTime".to_string(), AttributeValue::S(meal_time.to_rfc3339()));
        }
        
        item.insert("TotalCalories".to_string(), AttributeValue::N(meal.total_calories.to_string()));
        item.insert("TotalProtein".to_string(), AttributeValue::N(meal.total_protein.to_string()));
        item.insert("TotalCarbs".to_string(), AttributeValue::N(meal.total_carbs.to_string()));
        item.insert("TotalFat".to_string(), AttributeValue::N(meal.total_fat.to_string()));
        item.insert("TotalFiber".to_string(), AttributeValue::N(meal.total_fiber.to_string()));
        item.insert("TotalSugar".to_string(), AttributeValue::N(meal.total_sugar.to_string()));
        item.insert("TotalSodium".to_string(), AttributeValue::N(meal.total_sodium.to_string()));
        
        item.insert("Foods".to_string(), AttributeValue::S(serde_json::to_string(&meal.foods)?));
        
        if let Some(notes) = &meal.notes {
            item.insert("Notes".to_string(), AttributeValue::S(notes.clone()));
        }
        
        item.insert("CreatedAt".to_string(), AttributeValue::S(meal.created_at.to_rfc3339()));
        item.insert("UpdatedAt".to_string(), AttributeValue::S(meal.updated_at.to_rfc3339()));

        let request = self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(PK)");

        match request.send().await {
            Ok(_) => {
                info!("Meal created successfully: {}", meal.id);
                Ok(meal.clone())
            }
            Err(e) => {
                error!("Failed to create meal: {}", e);
                Err(anyhow::anyhow!("Failed to create meal: {}", e))
            }
        }
    }

    pub async fn get_meal_by_id(&self, user_id: &str, meal_id: &str) -> Result<Option<Meal>> {
        let request = self.client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("MEAL#{}", meal_id)));

        match request.send().await {
            Ok(response) => {
                if let Some(item) = response.item() {
                    self.item_to_meal(item)
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to get meal by ID: {}", e);
                Err(anyhow::anyhow!("Failed to get meal: {}", e))
            }
        }
    }

    pub async fn get_meals_by_date(&self, user_id: &str, date: &DateTime<Utc>) -> Result<Vec<Meal>> {
        let request = self.client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI2")
            .key_condition_expression("GSI2PK = :gsi2pk")
            .expression_attribute_values(":gsi2pk", AttributeValue::S(format!("USER#{}#{}", user_id, date.format("%Y-%m-%d"))));

        match request.send().await {
            Ok(response) => {
                let mut meals = Vec::new();
                
                if let Some(items) = response.items() {
                    for item in items {
                        if let Ok(meal) = self.item_to_meal(item) {
                            meals.push(meal);
                        }
                    }
                }
                
                Ok(meals)
            }
            Err(e) => {
                error!("Failed to get meals by date: {}", e);
                Err(anyhow::anyhow!("Failed to get meals: {}", e))
            }
        }
    }

    pub async fn update_meal(&self, user_id: &str, meal_id: &str, updates: &UpdateMealRequest) -> Result<Meal> {
        let mut update_expression = "SET UpdatedAt = :updated_at".to_string();
        let mut expression_attribute_names = HashMap::new();
        let mut expression_attribute_values = HashMap::new();

        expression_attribute_values.insert(":updated_at".to_string(), 
            AttributeValue::S(Utc::now().to_rfc3339()));

        if let Some(name) = &updates.name {
            update_expression.push_str(", #name = :name");
            expression_attribute_names.insert("#name".to_string(), "Name".to_string());
            expression_attribute_values.insert(":name".to_string(), AttributeValue::S(name.clone()));
        }

        if let Some(description) = &updates.description {
            update_expression.push_str(", Description = :description");
            expression_attribute_values.insert(":description".to_string(), AttributeValue::S(description.clone()));
        }

        if let Some(meal_type) = &updates.meal_type {
            update_expression.push_str(", MealType = :meal_type");
            expression_attribute_values.insert(":meal_type".to_string(), AttributeValue::S(serde_json::to_string(meal_type)?));
        }

        if let Some(meal_time) = &updates.meal_time {
            update_expression.push_str(", MealTime = :meal_time");
            expression_attribute_values.insert(":meal_time".to_string(), AttributeValue::S(meal_time.to_rfc3339()));
        }

        if let Some(foods) = &updates.foods {
            update_expression.push_str(", Foods = :foods");
            expression_attribute_values.insert(":foods".to_string(), AttributeValue::S(serde_json::to_string(foods)?));
        }

        if let Some(notes) = &updates.notes {
            update_expression.push_str(", Notes = :notes");
            expression_attribute_values.insert(":notes".to_string(), AttributeValue::S(notes.clone()));
        }

        let mut request = self.client
            .update_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("MEAL#{}", meal_id)))
            .update_expression(update_expression)
            .expression_attribute_values(expression_attribute_values)
            .return_values(ReturnValue::AllNew);

        if !expression_attribute_names.is_empty() {
            request = request.expression_attribute_names(expression_attribute_names);
        }

        match request.send().await {
            Ok(response) => {
                if let Some(attributes) = response.attributes() {
                    self.item_to_meal(attributes)
                } else {
                    Err(anyhow::anyhow!("No attributes returned from update"))
                }
            }
            Err(e) => {
                error!("Failed to update meal: {}", e);
                Err(anyhow::anyhow!("Failed to update meal: {}", e))
            }
        }
    }

    pub async fn delete_meal(&self, user_id: &str, meal_id: &str) -> Result<()> {
        let request = self.client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("MEAL#{}", meal_id)));

        match request.send().await {
            Ok(_) => {
                info!("Meal deleted successfully: {}", meal_id);
                Ok(())
            }
            Err(e) => {
                error!("Failed to delete meal: {}", e);
                Err(anyhow::anyhow!("Failed to delete meal: {}", e))
            }
        }
    }

    // Food operations
    pub async fn create_food(&self, food: &Food) -> Result<Food> {
        let mut item = HashMap::new();
        
        // Primary key
        item.insert("PK".to_string(), AttributeValue::S(format!("FOOD#{}", food.id)));
        item.insert("SK".to_string(), AttributeValue::S(format!("FOOD#{}", food.id)));
        item.insert("GSI1PK".to_string(), AttributeValue::S(format!("FOOD#{}", food.name.to_lowercase())));
        item.insert("GSI1SK".to_string(), AttributeValue::S(format!("FOOD#{}", food.id)));
        
        if let Some(barcode) = &food.barcode {
            item.insert("GSI2PK".to_string(), AttributeValue::S(format!("BARCODE#{}", barcode)));
            item.insert("GSI2SK".to_string(), AttributeValue::S(format!("FOOD#{}", food.id)));
        }
        
        // Entity type
        item.insert("EntityType".to_string(), AttributeValue::S("FOOD".to_string()));
        
        // Food data
        item.insert("FoodId".to_string(), AttributeValue::S(food.id.clone()));
        item.insert("Name".to_string(), AttributeValue::S(food.name.clone()));
        
        if let Some(brand) = &food.brand {
            item.insert("Brand".to_string(), AttributeValue::S(brand.clone()));
        }
        
        item.insert("Category".to_string(), AttributeValue::S(serde_json::to_string(&food.category)?));
        
        if let Some(subcategory) = &food.subcategory {
            item.insert("Subcategory".to_string(), AttributeValue::S(subcategory.clone()));
        }
        
        if let Some(description) = &food.description {
            item.insert("Description".to_string(), AttributeValue::S(description.clone()));
        }
        
        if let Some(barcode) = &food.barcode {
            item.insert("Barcode".to_string(), AttributeValue::S(barcode.clone()));
        }
        
        if let Some(upc) = &food.upc {
            item.insert("UPC".to_string(), AttributeValue::S(upc.clone()));
        }
        
        item.insert("NutritionFacts".to_string(), AttributeValue::S(serde_json::to_string(&food.nutrition_facts)?));
        item.insert("ServingSize".to_string(), AttributeValue::N(food.serving_size.to_string()));
        item.insert("ServingUnit".to_string(), AttributeValue::S(food.serving_unit.clone()));
        
        item.insert("CommonServings".to_string(), AttributeValue::S(serde_json::to_string(&food.common_servings)?));
        item.insert("Allergens".to_string(), AttributeValue::S(serde_json::to_string(&food.allergens)?));
        item.insert("DietaryTags".to_string(), AttributeValue::S(serde_json::to_string(&food.dietary_tags)?));
        
        item.insert("Verified".to_string(), AttributeValue::Bool(food.verified));
        
        if let Some(verified_by) = &food.verified_by {
            item.insert("VerifiedBy".to_string(), AttributeValue::S(verified_by.clone()));
        }
        
        if let Some(verified_at) = &food.verified_at {
            item.insert("VerifiedAt".to_string(), AttributeValue::S(verified_at.to_rfc3339()));
        }
        
        item.insert("CreatedAt".to_string(), AttributeValue::S(food.created_at.to_rfc3339()));
        item.insert("UpdatedAt".to_string(), AttributeValue::S(food.updated_at.to_rfc3339()));

        let request = self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(PK)");

        match request.send().await {
            Ok(_) => {
                info!("Food created successfully: {}", food.id);
                Ok(food.clone())
            }
            Err(e) => {
                error!("Failed to create food: {}", e);
                Err(anyhow::anyhow!("Failed to create food: {}", e))
            }
        }
    }

    pub async fn get_food_by_id(&self, food_id: &str) -> Result<Option<Food>> {
        let request = self.client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("FOOD#{}", food_id)))
            .key("SK", AttributeValue::S(format!("FOOD#{}", food_id)));

        match request.send().await {
            Ok(response) => {
                if let Some(item) = response.item() {
                    self.item_to_food(item)
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to get food by ID: {}", e);
                Err(anyhow::anyhow!("Failed to get food: {}", e))
            }
        }
    }

    pub async fn search_foods(&self, query: &str, limit: u32) -> Result<Vec<Food>> {
        let request = self.client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :gsi1pk")
            .expression_attribute_values(":gsi1pk", AttributeValue::S(format!("FOOD#{}", query.to_lowercase())))
            .limit(limit as i32);

        match request.send().await {
            Ok(response) => {
                let mut foods = Vec::new();
                
                if let Some(items) = response.items() {
                    for item in items {
                        if let Ok(food) = self.item_to_food(item) {
                            foods.push(food);
                        }
                    }
                }
                
                Ok(foods)
            }
            Err(e) => {
                error!("Failed to search foods: {}", e);
                Err(anyhow::anyhow!("Failed to search foods: {}", e))
            }
        }
    }

    // Nutrition plan operations
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
        item.insert("DailyFiber".to_string(), AttributeValue::N(plan.daily_fiber.to_string()));
        item.insert("DailySugar".to_string(), AttributeValue::N(plan.daily_sugar.to_string()));
        item.insert("DailySodium".to_string(), AttributeValue::N(plan.daily_sodium.to_string()));
        
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
                    self.item_to_nutrition_plan(item)
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

    // Helper methods to convert DynamoDB items to models
    fn item_to_meal(&self, item: &HashMap<String, AttributeValue>) -> Result<Meal> {
        let id = item.get("MealId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing MealId"))?
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

        let meal_type = item.get("MealType")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<MealType>(s).ok())
            .unwrap_or(MealType::Other);

        let meal_date = item.get("MealDate")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

        let meal_time = item.get("MealTime")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let total_calories = item.get("TotalCalories")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_protein = item.get("TotalProtein")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_carbs = item.get("TotalCarbs")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_fat = item.get("TotalFat")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_fiber = item.get("TotalFiber")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_sugar = item.get("TotalSugar")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_sodium = item.get("TotalSodium")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let foods = item.get("Foods")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<FoodItem>>(s).ok())
            .unwrap_or_default();

        let notes = item.get("Notes")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let created_at = item.get("CreatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

        let updated_at = item.get("UpdatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

        Ok(Meal {
            id,
            user_id,
            name,
            description,
            meal_type,
            meal_date,
            meal_time,
            total_calories,
            total_protein,
            total_carbs,
            total_fat,
            total_fiber,
            total_sugar,
            total_sodium,
            foods,
            notes,
            created_at,
            updated_at,
        })
    }

    fn item_to_food(&self, item: &HashMap<String, AttributeValue>) -> Result<Food> {
        let id = item.get("FoodId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing FoodId"))?
            .clone();

        let name = item.get("Name")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing Name"))?
            .clone();

        let brand = item.get("Brand")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let category = item.get("Category")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<FoodCategory>(s).ok())
            .unwrap_or(FoodCategory::Other);

        let subcategory = item.get("Subcategory")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let description = item.get("Description")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let barcode = item.get("Barcode")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let upc = item.get("UPC")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let nutrition_facts = item.get("NutritionFacts")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<NutritionFacts>(s).ok())
            .unwrap_or_default();

        let serving_size = item.get("ServingSize")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(1.0);

        let serving_unit = item.get("ServingUnit")
            .and_then(|v| v.as_s().ok())
            .unwrap_or("serving")
            .to_string();

        let common_servings = item.get("CommonServings")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<CommonServing>>(s).ok())
            .unwrap_or_default();

        let allergens = item.get("Allergens")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<Allergen>>(s).ok())
            .unwrap_or_default();

        let dietary_tags = item.get("DietaryTags")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<DietaryTag>>(s).ok())
            .unwrap_or_default();

        let verified = item.get("Verified")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(false);

        let verified_by = item.get("VerifiedBy")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let verified_at = item.get("VerifiedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let created_at = item.get("CreatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

        let updated_at = item.get("UpdatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

        Ok(Food {
            id,
            name,
            brand,
            category,
            subcategory,
            description,
            barcode,
            upc,
            nutrition_facts,
            serving_size,
            serving_unit,
            common_servings,
            allergens,
            dietary_tags,
            verified,
            verified_by,
            verified_at,
            created_at,
            updated_at,
        })
    }

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

        let daily_fiber = item.get("DailyFiber")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(25.0);

        let daily_sugar = item.get("DailySugar")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(50.0);

        let daily_sodium = item.get("DailySodium")
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
            .unwrap_or_else(|| Utc::now());

        let end_date = item.get("EndDate")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let is_active = item.get("IsActive")
            .and_then(|v| v.as_bool().ok())
            .unwrap_or(true);

        let created_at = item.get("CreatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

        let updated_at = item.get("UpdatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

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
            daily_fiber,
            daily_sugar,
            daily_sodium,
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

impl Default for NutritionFacts {
    fn default() -> Self {
        Self {
            calories: 0.0,
            protein: 0.0,
            total_carbs: 0.0,
            dietary_fiber: 0.0,
            total_sugars: 0.0,
            added_sugars: 0.0,
            total_fat: 0.0,
            saturated_fat: 0.0,
            trans_fat: 0.0,
            cholesterol: 0.0,
            sodium: 0.0,
            potassium: 0.0,
            calcium: 0.0,
            iron: 0.0,
            vitamin_a: 0.0,
            vitamin_c: 0.0,
            vitamin_d: 0.0,
            vitamin_e: 0.0,
            vitamin_k: 0.0,
            thiamin: 0.0,
            riboflavin: 0.0,
            niacin: 0.0,
            vitamin_b6: 0.0,
            folate: 0.0,
            vitamin_b12: 0.0,
            biotin: 0.0,
            pantothenic_acid: 0.0,
            phosphorus: 0.0,
            iodine: 0.0,
            magnesium: 0.0,
            zinc: 0.0,
            selenium: 0.0,
            copper: 0.0,
            manganese: 0.0,
            chromium: 0.0,
            molybdenum: 0.0,
        }
    }
}
