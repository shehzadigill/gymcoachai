use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::types::AttributeValue;
use anyhow::Result;

use crate::models::{WorkoutSession, SessionExercise, ExerciseSet};

pub struct WorkoutSessionRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl WorkoutSessionRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_workout_sessions_for_analytics(
        &self,
        user_id: &str,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<WorkoutSession>> {
        let result = self
            .client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk")
            .expression_attribute_values(":pk", AttributeValue::S("WORKOUT_SESSIONS".to_string()))
            .filter_expression("userId = :userId AND startedAt BETWEEN :start AND :end")
            .expression_attribute_values(":userId", AttributeValue::S(user_id.to_string()))
            .expression_attribute_values(":start", AttributeValue::S(start_date.to_string()))
            .expression_attribute_values(":end", AttributeValue::S(end_date.to_string()))
            .send()
            .await?;
        
        let sessions: Vec<WorkoutSession> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(WorkoutSession {
                    id: item.get("id")?.as_s().ok()?.clone(),
                    user_id: item.get("userId")?.as_s().ok()?.clone(),
                    workout_plan_id: item.get("workoutPlanId").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    name: item.get("name")?.as_s().ok()?.clone(),
                    started_at: item.get("startedAt")?.as_s().ok()?.clone(),
                    completed_at: item.get("completedAt").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    duration_minutes: item.get("durationMinutes").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                    created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                    updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
                    exercises: item.get("exercises")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| list.iter().filter_map(|v| {
                            let obj = v.as_m().ok()?;
                            Some(SessionExercise {
                                exercise_id: obj.get("exerciseId")?.as_s().ok()?.clone(),
                                name: obj.get("name")?.as_s().ok()?.clone(),
                                order: obj.get("order").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
                                sets: obj.get("sets")
                                    .and_then(|v| v.as_l().ok())
                                    .map(|sets| sets.iter().filter_map(|set| {
                                        let set_obj = set.as_m().ok()?;
                                        Some(ExerciseSet {
                                            set_number: set_obj.get("setNumber")?.as_n().ok()?.parse().ok()?,
                                            reps: set_obj.get("reps").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                                            weight: set_obj.get("weight").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                                            duration_seconds: set_obj.get("durationSeconds").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                                            rest_seconds: set_obj.get("restSeconds").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                                            completed: *set_obj.get("completed")?.as_bool().ok()?,
                                            notes: set_obj.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                                        })
                                    }).collect())
                                    .unwrap_or_default(),
                                notes: obj.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                            })
                        }).collect())
                        .unwrap_or_default(),
                    rating: item.get("rating").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                    notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                })
            })
            .collect();
        
        Ok(sessions)
    }
}
