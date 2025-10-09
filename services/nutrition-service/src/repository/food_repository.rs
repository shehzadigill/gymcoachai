use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use std::collections::HashMap;
use anyhow::Result;
use tracing::{info, error};

use crate::models::*;

#[derive(Clone)]
pub struct FoodRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl FoodRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn create_food(&self, food: &Food) -> Result<Food> {
        let mut item = HashMap::new();
        
        // Primary key
        item.insert("PK".to_string(), AttributeValue::S(format!("FOOD#{}", food.id)));
        item.insert("SK".to_string(), AttributeValue::S(format!("FOOD#{}", food.id)));
        // Name index for prefix search: fixed PK and nameLower in SK
        item.insert("GSI1PK".to_string(), AttributeValue::S("FOOD".to_string()));
        item.insert("GSI1SK".to_string(), AttributeValue::S(format!("{}#{}", food.name.to_lowercase(), food.id)));
        
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
                    Ok(Some(self.item_to_food(item)?))
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

    pub async fn search_foods(&self, query: &str, limit: u32, cursor: Option<String>) -> Result<(Vec<Food>, Option<String>)> {
        // Use GSI1 with fixed PK and nameLower prefix in SK
        let prefix = query.to_lowercase();
        info!("Querying foods on GSI1 begins_with: {}", prefix);

        let mut request = self.client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :pk AND begins_with(GSI1SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S("FOOD".to_string()))
            .expression_attribute_values(":sk", AttributeValue::S(prefix))
            .limit(limit as i32);

        // Pagination support via ExclusiveStartKey using table PK/SK
        if let Some(last_food_id) = cursor {
            let mut eks = std::collections::HashMap::new();
            eks.insert("PK".to_string(), AttributeValue::S(format!("FOOD#{}", last_food_id)));
            eks.insert("SK".to_string(), AttributeValue::S(format!("FOOD#{}", last_food_id)));
            request = request.set_exclusive_start_key(Some(eks));
        }

        match request.send().await {
            Ok(response) => {
                info!("Query (GSI1) successful, found {} items", response.count());
                let mut foods = Vec::new();
                for (i, item) in response.items().iter().enumerate() {
                    match self.item_to_food(item) {
                        Ok(food) => foods.push(food),
                        Err(e) => error!("Failed to parse food item {}: {}", i, e),
                    }
                }
                // Build next cursor from LastEvaluatedKey (derive FoodId from PK)
                let next_cursor = response.last_evaluated_key().and_then(|k|
                    k.get("PK")
                        .and_then(|v| v.as_s().ok())
                        .and_then(|s| s.strip_prefix("FOOD#").map(|v| v.to_string()))
                );
                Ok((foods, next_cursor))
            }
            Err(e) => {
                error!("Failed to search foods (query GSI1): {:?}", e);
                Ok((Vec::new(), None))
            }
        }
    }

    // Helper method to convert DynamoDB item to Food
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
            .unwrap_or_else(|| NutritionFacts {
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
            });

        let serving_size = item.get("ServingSize")
            .and_then(|v| v.as_n().ok())
            .and_then(|s| s.parse::<f32>().ok())
            .unwrap_or(1.0);

        let serving_unit = item.get("ServingUnit")
            .and_then(|v| v.as_s().ok())
            .map_or("serving", |v| v)
            .to_string();

        let common_servings = item.get("CommonServings")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<CommonServing>>(s).ok())
            .unwrap_or_else(|| vec![]);

        let allergens = item.get("Allergens")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
            .unwrap_or_else(|| vec![]);

        let dietary_tags = item.get("DietaryTags")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
            .unwrap_or_else(|| vec![]);

        let verified = item.get("Verified")
            .and_then(|v| v.as_bool().ok())
            .copied()
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
            .unwrap_or_else(|| chrono::Utc::now());

        let updated_at = item.get("UpdatedAt")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| chrono::DateTime::parse_from_rfc3339(s).ok())
            .map(|dt| dt.with_timezone(&chrono::Utc))
            .unwrap_or_else(|| chrono::Utc::now());

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
}
