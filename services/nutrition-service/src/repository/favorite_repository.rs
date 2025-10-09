use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use anyhow::Result;
use tracing::error;
use chrono::Utc;


#[derive(Clone)]
pub struct FavoriteRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl FavoriteRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn add_favorite_food(&self, user_id: &str, food_id: &str) -> Result<()> {
        let mut item = std::collections::HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", user_id)));
        item.insert("SK".to_string(), AttributeValue::S(format!("FAVORITE#FOOD#{}", food_id)));
        item.insert("EntityType".to_string(), AttributeValue::S("FAVORITE".to_string()));
        item.insert("UserId".to_string(), AttributeValue::S(user_id.to_string()));
        item.insert("FoodId".to_string(), AttributeValue::S(food_id.to_string()));
        item.insert("CreatedAt".to_string(), AttributeValue::S(Utc::now().to_rfc3339()));

        let request = self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .condition_expression("attribute_not_exists(PK) AND attribute_not_exists(SK)");

        match request.send().await {
            Ok(_) => Ok(()),
            Err(e) => {
                error!("Failed to add favorite: {}", e);
                Err(anyhow::anyhow!("Failed to add favorite: {}", e))
            }
        }
    }

    pub async fn remove_favorite_food(&self, user_id: &str, food_id: &str) -> Result<()> {
        let request = self.client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("FAVORITE#FOOD#{}", food_id)));

        match request.send().await {
            Ok(_) => Ok(()),
            Err(e) => {
                error!("Failed to remove favorite: {}", e);
                Err(anyhow::anyhow!("Failed to remove favorite: {}", e))
            }
        }
    }

    pub async fn list_favorite_food_ids(&self, user_id: &str) -> Result<Vec<String>> {
        let request = self.client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
            .expression_attribute_values(":sk", AttributeValue::S("FAVORITE#FOOD#".to_string()));

        match request.send().await {
            Ok(response) => {
                let mut ids = Vec::new();
                for item in response.items() {
                    if let Some(fid) = item.get("FoodId").and_then(|v| v.as_s().ok()) {
                        ids.push(fid.to_string());
                    } else if let Some(sk) = item.get("SK").and_then(|v| v.as_s().ok()) {
                        if let Some(fid) = sk.strip_prefix("FAVORITE#FOOD#") { 
                            ids.push(fid.to_string()); 
                        }
                    }
                }
                Ok(ids)
            }
            Err(e) => {
                error!("Failed to list favorite ids: {}", e);
                Err(anyhow::anyhow!("Failed to list favorites: {}", e))
            }
        }
    }
}
