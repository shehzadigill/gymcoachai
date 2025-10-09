use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::types::AttributeValue;
use anyhow::Result;
use std::collections::HashMap;

use crate::models::Milestone;

#[derive(Clone)]
pub struct MilestoneRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl MilestoneRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_milestones(&self, user_id: &str) -> Result<Vec<Milestone>> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk")
            .expression_attribute_values(":pk", AttributeValue::S("MILESTONES".to_string()))
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(user_id.to_string()))
            .send()
            .await?;
        
        let milestones: Vec<Milestone> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(Milestone {
                    id: item.get("id")?.as_s().ok()?.clone(),
                    user_id: item.get("userId")?.as_s().ok()?.clone(),
                    milestone_type: item.get("milestoneType")?.as_s().ok()?.clone(),
                    title: item.get("title")?.as_s().ok()?.clone(),
                    description: item.get("description")?.as_s().ok()?.clone(),
                    target_value: item.get("targetValue")?.as_n().ok()?.parse().ok()?,
                    current_value: item.get("currentValue")?.as_n().ok()?.parse().ok()?,
                    unit: item.get("unit").and_then(|v| v.as_s().ok()).map_or("kg", |v| v).to_string(),
                    target_date: item.get("targetDate").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                    status: item.get("status").and_then(|v| v.as_s().ok()).map_or("active", |v| v).to_string(),
                    progress_percentage: item.get("progressPercentage")?.as_n().ok()?.parse().ok()?,
                    achieved: *item.get("achieved")?.as_bool().ok()?,
                    achieved_at: item.get("achievedAt").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    metadata: None,
                })
            })
            .collect();
        
        Ok(milestones)
    }

    pub async fn create_milestone(&self, milestone: &Milestone) -> Result<Milestone> {
        let mut item = HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S("MILESTONES".to_string()));
        item.insert("SK".to_string(), AttributeValue::S(format!("MILESTONE#{}", milestone.id)));
        item.insert("id".to_string(), AttributeValue::S(milestone.id.clone()));
        item.insert("userId".to_string(), AttributeValue::S(milestone.user_id.clone()));
        item.insert("milestoneType".to_string(), AttributeValue::S(milestone.milestone_type.clone()));
        item.insert("title".to_string(), AttributeValue::S(milestone.title.clone()));
        item.insert("description".to_string(), AttributeValue::S(milestone.description.clone()));
        item.insert("targetValue".to_string(), AttributeValue::N(milestone.target_value.to_string()));
        item.insert("currentValue".to_string(), AttributeValue::N(milestone.current_value.to_string()));
        item.insert("progressPercentage".to_string(), AttributeValue::N(milestone.progress_percentage.to_string()));
        item.insert("achieved".to_string(), AttributeValue::Bool(milestone.achieved));
        item.insert("createdAt".to_string(), AttributeValue::S(milestone.created_at.clone()));
        
        if let Some(achieved_at) = &milestone.achieved_at {
            item.insert("achievedAt".to_string(), AttributeValue::S(achieved_at.clone()));
        }
        if let Some(target_date) = &milestone.target_date {
            item.insert("targetDate".to_string(), AttributeValue::S(target_date.clone()));
        }
        
        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(milestone.clone())
    }
}
