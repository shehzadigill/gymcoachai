use anyhow::Result;
use aws_sdk_dynamodb::{types::AttributeValue, Client as DynamoDbClient};
use serde_json::Value;
use std::collections::HashMap;
use tracing::{error, info};

use crate::models::*;

#[derive(Clone)]
pub struct WorkoutPlanRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl WorkoutPlanRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_workout_plans(
        &self,
        user_id: Option<String>,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Use GSI1 to query all workout plans
        let mut query = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk")
            .expression_attribute_values(
                ":pk",
                AttributeValue::S(format!("USER#{}", user_id.unwrap_or_default())),
            );

        let result = query.send().await?;

        let plans: Vec<WorkoutPlan> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(WorkoutPlan {
                    id: item.get("WorkoutPlanId")?.as_s().ok()?.clone(),
                    user_id: item.get("UserId")?.as_s().ok()?.clone(),
                    name: item.get("Name")?.as_s().ok()?.clone(),
                    description: item
                        .get("Description")
                        .and_then(|v| v.as_s().ok())
                        .map(|s| s.clone()),
                    difficulty: item.get("Difficulty")?.as_s().ok()?.clone(),
                    duration_weeks: item.get("DurationWeeks")?.as_n().ok()?.parse().ok()?,
                    frequency_per_week: item.get("FrequencyPerWeek")?.as_n().ok()?.parse().ok()?,
                    exercises: item
                        .get("Exercises")
                        .and_then(|v| v.as_s().ok())
                        .and_then(|s| serde_json::from_str::<Vec<WorkoutExercise>>(s).ok())
                        .unwrap_or_default(),
                    created_at: item.get("CreatedAt")?.as_s().ok()?.clone(),
                    updated_at: item.get("UpdatedAt")?.as_s().ok()?.clone(),
                    is_active: item
                        .get("IsActive")
                        .and_then(|v| v.as_bool().ok())
                        .copied()
                        .unwrap_or(true),
                    // Enhanced features
                    tags: item
                        .get("Tags")
                        .and_then(|v| v.as_s().ok())
                        .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok()),
                    rating: item
                        .get("Rating")
                        .and_then(|v| v.as_n().ok())
                        .and_then(|n| n.parse().ok()),
                    is_template: item
                        .get("IsTemplate")
                        .and_then(|v| v.as_bool().ok())
                        .copied(),
                    total_sessions: item
                        .get("TotalSessions")
                        .and_then(|v| v.as_n().ok())
                        .and_then(|n| n.parse().ok()),
                    completed_sessions: item
                        .get("CompletedSessions")
                        .and_then(|v| v.as_n().ok())
                        .and_then(|n| n.parse().ok()),
                    next_scheduled_date: item
                        .get("NextScheduledDate")
                        .and_then(|v| v.as_s().ok())
                        .map(|s| s.clone()),
                })
            })
            .collect();

        Ok(serde_json::to_value(plans)?)
    }

    pub async fn create_workout_plan(
        &self,
        plan: &WorkoutPlan,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let mut item = std::collections::HashMap::new();
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", plan.user_id)),
        );
        item.insert(
            "SK".to_string(),
            AttributeValue::S(format!("WORKOUT_PLAN#{}", plan.id)),
        );
        item.insert(
            "GSI1PK".to_string(),
            AttributeValue::S("WORKOUT_PLAN".to_string()),
        );
        item.insert(
            "GSI1SK".to_string(),
            AttributeValue::S(format!("{}#{}", plan.name.to_lowercase(), plan.id)),
        );
        item.insert(
            "EntityType".to_string(),
            AttributeValue::S("WORKOUT_PLAN".to_string()),
        );
        item.insert(
            "WorkoutPlanId".to_string(),
            AttributeValue::S(plan.id.clone()),
        );
        item.insert(
            "UserId".to_string(),
            AttributeValue::S(plan.user_id.clone()),
        );
        item.insert("Name".to_string(), AttributeValue::S(plan.name.clone()));
        item.insert(
            "NameLower".to_string(),
            AttributeValue::S(plan.name.to_lowercase()),
        );
        item.insert(
            "Difficulty".to_string(),
            AttributeValue::S(plan.difficulty.clone()),
        );
        item.insert(
            "DurationWeeks".to_string(),
            AttributeValue::N(plan.duration_weeks.to_string()),
        );
        item.insert(
            "FrequencyPerWeek".to_string(),
            AttributeValue::N(plan.frequency_per_week.to_string()),
        );
        item.insert("IsActive".to_string(), AttributeValue::Bool(plan.is_active));
        item.insert(
            "CreatedAt".to_string(),
            AttributeValue::S(plan.created_at.clone()),
        );
        item.insert(
            "UpdatedAt".to_string(),
            AttributeValue::S(plan.updated_at.clone()),
        );

        if let Some(description) = &plan.description {
            item.insert(
                "Description".to_string(),
                AttributeValue::S(description.clone()),
            );
        }

        // Enhanced features
        if let Some(tags) = &plan.tags {
            let tags_json = serde_json::to_string(tags).unwrap_or_default();
            item.insert("Tags".to_string(), AttributeValue::S(tags_json));
        }

        if let Some(rating) = plan.rating {
            item.insert("Rating".to_string(), AttributeValue::N(rating.to_string()));
        }

        if let Some(is_template) = plan.is_template {
            item.insert("IsTemplate".to_string(), AttributeValue::Bool(is_template));
        }

        if let Some(total_sessions) = plan.total_sessions {
            item.insert(
                "TotalSessions".to_string(),
                AttributeValue::N(total_sessions.to_string()),
            );
        }

        if let Some(completed_sessions) = plan.completed_sessions {
            item.insert(
                "CompletedSessions".to_string(),
                AttributeValue::N(completed_sessions.to_string()),
            );
        }

        if let Some(next_scheduled_date) = &plan.next_scheduled_date {
            item.insert(
                "NextScheduledDate".to_string(),
                AttributeValue::S(next_scheduled_date.clone()),
            );
        }

        // Add exercises as JSON string to match populate script
        let exercises_json = serde_json::to_string(&plan.exercises).unwrap_or_default();
        item.insert("Exercises".to_string(), AttributeValue::S(exercises_json));

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(serde_json::to_value(plan)?)
    }

    pub async fn get_workout_plan(
        &self,
        user_id: &str,
        plan_id: &str,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self
            .client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("WORKOUT_PLAN#{}", plan_id)))
            .send()
            .await?;

        if let Some(item) = result.item {
            let plan = WorkoutPlan {
                id: item
                    .get("WorkoutPlanId")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                user_id: item
                    .get("UserId")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                name: item
                    .get("Name")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                description: item
                    .get("Description")
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                difficulty: item
                    .get("Difficulty")
                    .and_then(|v| v.as_s().ok())
                    .map_or("beginner", |v| v)
                    .to_string(),
                duration_weeks: item
                    .get("DurationWeeks")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                frequency_per_week: item
                    .get("FrequencyPerWeek")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                exercises: item
                    .get("Exercises")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<WorkoutExercise>>(s).ok())
                    .unwrap_or_default(),
                created_at: item
                    .get("CreatedAt")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                updated_at: item
                    .get("UpdatedAt")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                is_active: item
                    .get("IsActive")
                    .and_then(|v| v.as_bool().ok())
                    .copied()
                    .unwrap_or(true),
                // Enhanced features
                tags: item
                    .get("Tags")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok()),
                rating: item
                    .get("Rating")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|n| n.parse().ok()),
                is_template: item
                    .get("IsTemplate")
                    .and_then(|v| v.as_bool().ok())
                    .copied(),
                total_sessions: item
                    .get("TotalSessions")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|n| n.parse().ok()),
                completed_sessions: item
                    .get("CompletedSessions")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|n| n.parse().ok()),
                next_scheduled_date: item
                    .get("NextScheduledDate")
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.clone()),
            };

            Ok(serde_json::to_value(plan)?)
        } else {
            Err("Workout plan not found".into())
        }
    }

    pub async fn update_workout_plan(
        &self,
        plan: &WorkoutPlan,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Similar to create but with updated timestamp
        self.create_workout_plan(plan).await
    }

    pub async fn delete_workout_plan(
        &self,
        user_id: &str,
        plan_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("WORKOUT_PLAN#{}", plan_id)))
            .send()
            .await?;

        Ok(())
    }
}
