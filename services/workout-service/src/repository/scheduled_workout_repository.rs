use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use serde_json::Value;
use anyhow::Result;
use tracing::{info, error};

use crate::models::*;

#[derive(Clone)]
pub struct ScheduledWorkoutRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl ScheduledWorkoutRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn create_scheduled_workout(&self, scheduled_workout: &ScheduledWorkout) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let item = [
            ("PK".to_string(), AttributeValue::S(format!("USER#{}", scheduled_workout.user_id))),
            ("SK".to_string(), AttributeValue::S(format!("SCHEDULE#{}", scheduled_workout.id))),
            ("GSI1PK".to_string(), AttributeValue::S(format!("SCHEDULE_DATE#{}", scheduled_workout.scheduled_date))),
            ("GSI1SK".to_string(), AttributeValue::S(format!("USER#{}", scheduled_workout.user_id))),
            ("ScheduleId".to_string(), AttributeValue::S(scheduled_workout.id.clone())),
            ("PlanId".to_string(), AttributeValue::S(scheduled_workout.plan_id.clone())),
            ("UserId".to_string(), AttributeValue::S(scheduled_workout.user_id.clone())),
            ("PlanName".to_string(), AttributeValue::S(scheduled_workout.plan_name.clone())),
            ("ScheduledDate".to_string(), AttributeValue::S(scheduled_workout.scheduled_date.clone())),
            ("ScheduledTime".to_string(), AttributeValue::S(scheduled_workout.scheduled_time.clone())),
            ("Status".to_string(), AttributeValue::S(scheduled_workout.status.clone())),
            ("Week".to_string(), AttributeValue::N(scheduled_workout.week.to_string())),
            ("Day".to_string(), AttributeValue::N(scheduled_workout.day.to_string())),
            ("CreatedAt".to_string(), AttributeValue::S(scheduled_workout.created_at.clone())),
            ("UpdatedAt".to_string(), AttributeValue::S(scheduled_workout.updated_at.clone())),
        ].into_iter().collect();
        
        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(serde_json::to_value(scheduled_workout)?)
    }

    pub async fn get_scheduled_workouts(&self, user_id: Option<String>) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let query = self.client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id.unwrap_or_default())))
            .expression_attribute_values(":sk", AttributeValue::S("SCHEDULE#".to_string()));
        
        let result = query.send().await?;
        
        let scheduled_workouts: Vec<ScheduledWorkout> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(ScheduledWorkout {
                    id: item.get("ScheduleId")?.as_s().ok()?.clone(),
                    plan_id: item.get("PlanId")?.as_s().ok()?.clone(),
                    user_id: item.get("UserId")?.as_s().ok()?.clone(),
                    plan_name: item.get("PlanName")?.as_s().ok()?.clone(),
                    scheduled_date: item.get("ScheduledDate")?.as_s().ok()?.clone(),
                    scheduled_time: item.get("ScheduledTime")?.as_s().ok()?.clone(),
                    status: item.get("Status")?.as_s().ok()?.clone(),
                    week: item.get("Week")?.as_n().ok()?.parse().ok()?,
                    day: item.get("Day")?.as_n().ok()?.parse().ok()?,
                    notes: item.get("Notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    completed_at: item.get("CompletedAt").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    created_at: item.get("CreatedAt")?.as_s().ok()?.clone(),
                    updated_at: item.get("UpdatedAt")?.as_s().ok()?.clone(),
                })
            })
            .collect();
        
        Ok(serde_json::to_value(scheduled_workouts)?)
    }

    pub async fn update_scheduled_workout(&self, scheduled_workout: &ScheduledWorkout) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let update_expression = "SET #status = :status, #updated_at = :updated_at, #notes = :notes, #completed_at = :completed_at";
        let expression_attribute_names = [
            ("#status".to_string(), "Status".to_string()),
            ("#updated_at".to_string(), "UpdatedAt".to_string()),
            ("#notes".to_string(), "Notes".to_string()),
            ("#completed_at".to_string(), "CompletedAt".to_string()),
        ].into_iter().collect();
        
        let mut expression_attribute_values = [
            (":status".to_string(), AttributeValue::S(scheduled_workout.status.clone())),
            (":updated_at".to_string(), AttributeValue::S(scheduled_workout.updated_at.clone())),
        ].into_iter().collect::<std::collections::HashMap<String, AttributeValue>>();
        
        if let Some(notes) = &scheduled_workout.notes {
            expression_attribute_values.insert(":notes".to_string(), AttributeValue::S(notes.clone()));
        } else {
            expression_attribute_values.insert(":notes".to_string(), AttributeValue::Null(true));
        }
        
        if let Some(completed_at) = &scheduled_workout.completed_at {
            expression_attribute_values.insert(":completed_at".to_string(), AttributeValue::S(completed_at.clone()));
        } else {
            expression_attribute_values.insert(":completed_at".to_string(), AttributeValue::Null(true));
        }
        
        self.client
            .update_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", scheduled_workout.user_id)))
            .key("SK", AttributeValue::S(format!("SCHEDULE#{}", scheduled_workout.id)))
            .update_expression(update_expression)
            .set_expression_attribute_names(Some(expression_attribute_names))
            .set_expression_attribute_values(Some(expression_attribute_values))
            .send()
            .await?;
        
        Ok(serde_json::to_value(scheduled_workout)?)
    }

    pub async fn delete_scheduled_workout(&self, user_id: &str, schedule_id: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("SCHEDULE#{}", schedule_id)))
            .send()
            .await?;
        
        Ok(serde_json::json!({"message": "Scheduled workout deleted successfully"}))
    }
}
