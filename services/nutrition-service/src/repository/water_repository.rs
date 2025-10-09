use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use std::collections::HashMap;
use anyhow::Result;
use tracing::error;
use chrono::Utc;

#[derive(Clone)]
pub struct WaterRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl WaterRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_water_by_date(&self, user_id: &str, date: &str) -> Result<Option<u32>> {
        let request = self.client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("WATER#{}", date)));

        match request.send().await {
            Ok(response) => {
                if let Some(item) = response.item() {
                    let glasses = item.get("WaterGlasses")
                        .and_then(|v| v.as_n().ok())
                        .and_then(|s| s.parse::<u32>().ok())
                        .unwrap_or(0);
                    Ok(Some(glasses))
                } else {
                    Ok(None)
                }
            }
            Err(e) => {
                error!("Failed to get water by date: {}", e);
                Err(anyhow::anyhow!("Failed to get water: {}", e))
            }
        }
    }

    pub async fn set_water_by_date(&self, user_id: &str, date: &str, glasses: u32) -> Result<()> {
        let mut item = HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", user_id)));
        item.insert("SK".to_string(), AttributeValue::S(format!("WATER#{}", date)));
        item.insert("EntityType".to_string(), AttributeValue::S("WATER".to_string()));
        item.insert("UserId".to_string(), AttributeValue::S(user_id.to_string()));
        item.insert("WaterDate".to_string(), AttributeValue::S(date.to_string()));
        item.insert("WaterGlasses".to_string(), AttributeValue::N(glasses.to_string()));
        item.insert("UpdatedAt".to_string(), AttributeValue::S(Utc::now().to_rfc3339()));

        let request = self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item));

        match request.send().await {
            Ok(_) => Ok(()),
            Err(e) => {
                error!("Failed to set water by date: {}", e);
                Err(anyhow::anyhow!("Failed to set water: {}", e))
            }
        }
    }
}
