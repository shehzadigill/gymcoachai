use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::types::AttributeValue;
use serde_json::Value;
use anyhow::Result;
use std::collections::HashMap;

use crate::models::StrengthProgress;

pub struct StrengthProgressRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl StrengthProgressRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_strength_progress(
        &self,
        user_id: &str,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<StrengthProgress>> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND SK BETWEEN :start AND :end")
            .expression_attribute_values(":pk", AttributeValue::S("STRENGTH_PROGRESS".to_string()))
            .expression_attribute_values(":start", AttributeValue::S(format!("USER#{}#{}", user_id, start_date)))
            .expression_attribute_values(":end", AttributeValue::S(format!("USER#{}#{}", user_id, end_date)))
            .send()
            .await?;
        
        let progress: Vec<StrengthProgress> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(StrengthProgress {
                    user_id: item.get("userId")?.as_s().ok()?.clone(),
                    exercise_id: item.get("exerciseId")?.as_s().ok()?.clone(),
                    exercise_name: item.get("exerciseName")?.as_s().ok()?.clone(),
                    current_max_weight: item.get("currentMaxWeight")?.as_n().ok()?.parse().ok()?,
                    previous_max_weight: item.get("previousMaxWeight")?.as_n().ok()?.parse().ok()?,
                    weight_increase: item.get("weightIncrease")?.as_n().ok()?.parse().ok()?,
                    percentage_increase: item.get("percentageIncrease")?.as_n().ok()?.parse().ok()?,
                    period: item.get("period")?.as_s().ok()?.clone(),
                    measurement_date: item.get("measurementDate")?.as_s().ok()?.clone(),
                    trend: item.get("trend")?.as_s().ok()?.clone(),
                })
            })
            .collect();
        
        Ok(progress)
    }

    pub async fn create_strength_progress(&self, progress: &StrengthProgress) -> Result<StrengthProgress> {
        let mut item = HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S("STRENGTH_PROGRESS".to_string()));
        item.insert("SK".to_string(), AttributeValue::S(format!("USER#{}#{}", progress.user_id, progress.measurement_date)));
        item.insert("userId".to_string(), AttributeValue::S(progress.user_id.clone()));
        item.insert("exerciseId".to_string(), AttributeValue::S(progress.exercise_id.clone()));
        item.insert("exerciseName".to_string(), AttributeValue::S(progress.exercise_name.clone()));
        item.insert("currentMaxWeight".to_string(), AttributeValue::N(progress.current_max_weight.to_string()));
        item.insert("previousMaxWeight".to_string(), AttributeValue::N(progress.previous_max_weight.to_string()));
        item.insert("weightIncrease".to_string(), AttributeValue::N(progress.weight_increase.to_string()));
        item.insert("percentageIncrease".to_string(), AttributeValue::N(progress.percentage_increase.to_string()));
        item.insert("period".to_string(), AttributeValue::S(progress.period.clone()));
        item.insert("measurementDate".to_string(), AttributeValue::S(progress.measurement_date.clone()));
        item.insert("trend".to_string(), AttributeValue::S(progress.trend.clone()));
        
        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(progress.clone())
    }
}
