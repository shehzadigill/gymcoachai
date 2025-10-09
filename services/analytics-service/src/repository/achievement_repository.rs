use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::types::AttributeValue;
use anyhow::Result;
use std::collections::HashMap;

use crate::models::Achievement;

#[derive(Clone)]
pub struct AchievementRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl AchievementRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_achievements(&self, user_id: &str) -> Result<Vec<Achievement>> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S("ACHIEVEMENT".to_string()))
            .expression_attribute_values(":sk", AttributeValue::S(format!("USER#{}", user_id)))
            .send()
            .await?;
        
        let achievements: Vec<Achievement> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(Achievement {
                    id: item.get("id")?.as_s().ok()?.clone(),
                    user_id: item.get("userId")?.as_s().ok()?.clone(),
                    title: item.get("title")?.as_s().ok()?.clone(),
                    description: item.get("description")?.as_s().ok()?.clone(),
                    achievement_type: item.get("achievementType")?.as_s().ok()?.clone(),
                    category: item.get("category")?.as_s().ok()?.clone(),
                    icon: item.get("icon").and_then(|v| v.as_s().ok()).map_or("🏆", |v| v).to_string(),
                    rarity: item.get("rarity").and_then(|v| v.as_s().ok()).map_or("common", |v| v).to_string(),
                    points: item.get("points")?.as_n().ok()?.parse().ok()?,
                    earned_date: item.get("earnedDate")?.as_s().ok()?.clone(),
                    achieved_at: item.get("achievedAt")?.as_s().ok()?.clone(),
                    created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                    requirements: serde_json::Value::Null,
                    metadata: None,
                })
            })
            .collect();
        
        Ok(achievements)
    }

    pub async fn create_achievement(&self, achievement: &Achievement) -> Result<Achievement> {
        let item = HashMap::from([
            ("PK".to_string(), AttributeValue::S("ACHIEVEMENT".to_string())),
            ("SK".to_string(), AttributeValue::S(format!("USER#{}#{}", achievement.user_id, achievement.id))),
            ("id".to_string(), AttributeValue::S(achievement.id.clone())),
            ("userId".to_string(), AttributeValue::S(achievement.user_id.clone())),
            ("title".to_string(), AttributeValue::S(achievement.title.clone())),
            ("description".to_string(), AttributeValue::S(achievement.description.clone())),
            ("category".to_string(), AttributeValue::S(achievement.category.clone())),
            ("points".to_string(), AttributeValue::N(achievement.points.to_string())),
            ("achievedAt".to_string(), AttributeValue::S(achievement.achieved_at.clone())),
            ("createdAt".to_string(), AttributeValue::S(achievement.created_at.clone())),
        ]);
        
        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(achievement.clone())
    }
}
