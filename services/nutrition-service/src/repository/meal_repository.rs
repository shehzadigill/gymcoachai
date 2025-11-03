use anyhow::Result;
use aws_sdk_dynamodb::{types::AttributeValue, types::ReturnValue, Client as DynamoDbClient};
use chrono::{DateTime, Utc};
use std::collections::HashMap;
use tracing::{error, info};

use crate::models::*;

#[derive(Clone)]
pub struct MealRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl MealRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn create_meal(&self, meal: &Meal) -> Result<Meal> {
        let mut item = HashMap::new();

        // Primary key
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", meal.user_id)),
        );
        item.insert(
            "SK".to_string(),
            AttributeValue::S(format!("MEAL#{}", meal.id)),
        );
        item.insert(
            "GSI1PK".to_string(),
            AttributeValue::S(format!("MEAL#{}", meal.id)),
        );
        item.insert(
            "GSI1SK".to_string(),
            AttributeValue::S(format!("USER#{}", meal.user_id)),
        );

        // Entity type
        item.insert(
            "EntityType".to_string(),
            AttributeValue::S("MEAL".to_string()),
        );

        // Meal data
        item.insert("MealId".to_string(), AttributeValue::S(meal.id.clone()));
        item.insert(
            "UserId".to_string(),
            AttributeValue::S(meal.user_id.clone()),
        );
        item.insert("Name".to_string(), AttributeValue::S(meal.name.clone()));

        if let Some(description) = &meal.description {
            item.insert(
                "Description".to_string(),
                AttributeValue::S(description.clone()),
            );
        }

        item.insert(
            "MealType".to_string(),
            AttributeValue::S(serde_json::to_string(&meal.meal_type)?),
        );
        item.insert(
            "MealDate".to_string(),
            AttributeValue::S(meal.meal_date.to_rfc3339()),
        );

        if let Some(meal_time) = &meal.meal_time {
            item.insert(
                "MealTime".to_string(),
                AttributeValue::S(meal_time.to_rfc3339()),
            );
        }

        item.insert(
            "TotalCalories".to_string(),
            AttributeValue::N(meal.total_calories.to_string()),
        );
        item.insert(
            "TotalProtein".to_string(),
            AttributeValue::N(meal.total_protein.to_string()),
        );
        item.insert(
            "TotalCarbs".to_string(),
            AttributeValue::N(meal.total_carbs.to_string()),
        );
        item.insert(
            "TotalFat".to_string(),
            AttributeValue::N(meal.total_fat.to_string()),
        );
        item.insert(
            "DietaryFiber".to_string(),
            AttributeValue::N(meal.dietary_fiber.to_string()),
        );
        item.insert(
            "TotalSugars".to_string(),
            AttributeValue::N(meal.total_sugars.to_string()),
        );
        item.insert(
            "Sodium".to_string(),
            AttributeValue::N(meal.sodium.to_string()),
        );

        item.insert(
            "Foods".to_string(),
            AttributeValue::S(serde_json::to_string(&meal.foods)?),
        );

        if let Some(notes) = &meal.notes {
            item.insert("Notes".to_string(), AttributeValue::S(notes.clone()));
        }

        item.insert(
            "CreatedAt".to_string(),
            AttributeValue::S(meal.created_at.to_rfc3339()),
        );
        item.insert(
            "UpdatedAt".to_string(),
            AttributeValue::S(meal.updated_at.to_rfc3339()),
        );

        let request = self
            .client
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
        let request = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("MEAL#{}", meal_id)));

        match request.send().await {
            Ok(response) => {
                if let Some(item) = response.item() {
                    Ok(Some(self.item_to_meal(item)?))
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

    pub async fn get_meals_by_date(
        &self,
        user_id: &str,
        date: &DateTime<Utc>,
    ) -> Result<Vec<Meal>> {
        let pk = format!("USER#{}", user_id);
        let date_str = date.format("%Y-%m-%d").to_string();
        info!("Querying meals for user: {} on date: {}", user_id, date_str);

        // Query using PK and filter by date in the application layer
        let request = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk_prefix)")
            .expression_attribute_values(":pk", AttributeValue::S(pk))
            .expression_attribute_values(":sk_prefix", AttributeValue::S("MEAL#".to_string()));

        match request.send().await {
            Ok(response) => {
                info!("Query successful, found {} items", response.items().len());
                let mut meals = Vec::new();
                for item in response.items() {
                    match self.item_to_meal(item) {
                        Ok(meal) => {
                            // Filter by date in application
                            if meal.meal_date.format("%Y-%m-%d").to_string() == date_str {
                                info!("Successfully parsed meal: {}", meal.id);
                                meals.push(meal);
                            }
                        }
                        Err(e) => {
                            error!("Failed to parse meal item: {}", e);
                        }
                    }
                }
                info!("Returning {} meals", meals.len());
                Ok(meals)
            }
            Err(e) => {
                error!("Failed to get meals by date: {}", e);
                error!("Error details: {:?}", e);
                Err(anyhow::anyhow!("Failed to get meals: {}", e))
            }
        }
    }

    pub async fn get_user_meals(&self, user_id: &str) -> Result<Vec<Meal>> {
        let request = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
            .expression_attribute_values(":sk", AttributeValue::S("MEAL#".to_string()));

        match request.send().await {
            Ok(response) => {
                let mut meals = Vec::new();
                for item in response.items() {
                    if let Ok(meal) = self.item_to_meal(item) {
                        meals.push(meal);
                    }
                }
                // Sort by meal date descending (most recent first)
                meals.sort_by(|a, b| b.meal_date.cmp(&a.meal_date));
                Ok(meals)
            }
            Err(e) => {
                error!("Failed to get user meals: {}", e);
                Err(anyhow::anyhow!("Failed to get user meals: {}", e))
            }
        }
    }

    pub async fn update_meal(
        &self,
        user_id: &str,
        meal_id: &str,
        updates: &UpdateMealRequest,
    ) -> Result<Meal> {
        let mut update_expression = "SET UpdatedAt = :updated_at".to_string();
        let mut expression_attribute_names = HashMap::new();
        let mut expression_attribute_values = HashMap::new();

        expression_attribute_values.insert(
            ":updated_at".to_string(),
            AttributeValue::S(Utc::now().to_rfc3339()),
        );

        if let Some(name) = &updates.name {
            update_expression.push_str(", #name = :name");
            expression_attribute_names.insert("#name".to_string(), "Name".to_string());
            expression_attribute_values
                .insert(":name".to_string(), AttributeValue::S(name.clone()));
        }

        if let Some(description) = &updates.description {
            update_expression.push_str(", Description = :description");
            expression_attribute_values.insert(
                ":description".to_string(),
                AttributeValue::S(description.clone()),
            );
        }

        if let Some(meal_type) = &updates.meal_type {
            update_expression.push_str(", MealType = :meal_type");
            expression_attribute_values.insert(
                ":meal_type".to_string(),
                AttributeValue::S(serde_json::to_string(meal_type)?),
            );
        }

        if let Some(meal_time) = &updates.meal_time {
            update_expression.push_str(", MealTime = :meal_time");
            expression_attribute_values.insert(
                ":meal_time".to_string(),
                AttributeValue::S(meal_time.to_rfc3339()),
            );
        }

        if let Some(foods) = &updates.foods {
            update_expression.push_str(", Foods = :foods");
            expression_attribute_values.insert(
                ":foods".to_string(),
                AttributeValue::S(serde_json::to_string(foods)?),
            );
        }

        if let Some(notes) = &updates.notes {
            update_expression.push_str(", Notes = :notes");
            expression_attribute_values
                .insert(":notes".to_string(), AttributeValue::S(notes.clone()));
        }

        let mut request = self
            .client
            .update_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("MEAL#{}", meal_id)))
            .update_expression(update_expression)
            .set_expression_attribute_values(Some(expression_attribute_values))
            .return_values(ReturnValue::AllNew);

        if !expression_attribute_names.is_empty() {
            request = request.set_expression_attribute_names(Some(expression_attribute_names));
        }

        match request.send().await {
            Ok(response) => {
                if let Some(attributes) = response.attributes() {
                    Ok(self.item_to_meal(attributes)?)
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
        let request = self
            .client
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

    // Helper method to convert DynamoDB item to Meal
    fn item_to_meal(&self, item: &HashMap<String, AttributeValue>) -> Result<Meal> {
        let id = item
            .get("MealId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing MealId"))?
            .clone();

        let user_id = item
            .get("UserId")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing UserId"))?
            .clone();

        let name = item
            .get("Name")
            .and_then(|v| v.as_s().ok())
            .ok_or_else(|| anyhow::anyhow!("Missing Name"))?
            .clone();

        let description = item
            .get("Description")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let meal_type = item
            .get("MealType")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<MealType>(s).ok())
            .unwrap_or(MealType::Other);

        let meal_date = item
            .get("MealDate")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

        let meal_time = item
            .get("MealTime")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc));

        let total_calories = item
            .get("TotalCalories")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_protein = item
            .get("TotalProtein")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_carbs = item
            .get("TotalCarbs")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_fat = item
            .get("TotalFat")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let dietary_fiber = item
            .get("DietaryFiber")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let total_sugars = item
            .get("TotalSugars")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let sodium = item
            .get("Sodium")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(0.0);

        let foods = item
            .get("Foods")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<FoodItem>>(s).ok())
            .unwrap_or_default();

        let notes = item
            .get("Notes")
            .and_then(|v| v.as_s().ok())
            .map(|s| s.clone());

        let created_at = item
            .get("CreatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| Utc::now());

        let updated_at = item
            .get("UpdatedAt")
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
            dietary_fiber,
            total_sugars,
            sodium,
            foods,
            notes,
            created_at,
            updated_at,
        })
    }
}
