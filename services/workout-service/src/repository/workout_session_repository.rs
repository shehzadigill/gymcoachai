use anyhow::Result;
use aws_sdk_dynamodb::{types::AttributeValue, Client as DynamoDbClient};
use serde_json::Value;
use tracing::{error, info};

use crate::models::*;

#[derive(Clone)]
pub struct WorkoutSessionRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl WorkoutSessionRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_workout_sessions(
        &self,
        user_id: Option<String>,
        workout_plan_id: Option<String>,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let mut query = if let Some(uid) = user_id {
            self.client
                .query()
                .table_name(&self.table_name)
                .key_condition_expression("PK = :pk AND begins_with(SK, :sk_prefix)")
                .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", uid)))
                .expression_attribute_values(
                    ":sk_prefix",
                    AttributeValue::S("SESSION#".to_string()),
                )
        } else {
            // If no user_id provided, scan all users' sessions - this is expensive and should be avoided
            return Ok(serde_json::to_value(Vec::<WorkoutSession>::new())?);
        };

        // Add filter expression if workout_plan_id is provided
        if let Some(plan_id) = workout_plan_id {
            query = query
                .filter_expression("WorkoutPlanId = :planId")
                .expression_attribute_values(":planId", AttributeValue::S(plan_id));
        }

        let result = query.send().await?;

        let sessions: Vec<WorkoutSession> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(WorkoutSession {
                    id: item
                        .get("SessionId")
                        .or_else(|| item.get("id"))
                        .and_then(|v| v.as_s().ok())?
                        .clone(),
                    user_id: item
                        .get("UserId")
                        .or_else(|| item.get("userId"))
                        .and_then(|v| v.as_s().ok())?
                        .clone(),
                    workout_plan_id: item
                        .get("WorkoutPlanId")
                        .or_else(|| item.get("workoutPlanId"))
                        .and_then(|v| v.as_s().ok())
                        .map(|s| s.clone()),
                    name: item
                        .get("Name")
                        .or_else(|| item.get("name"))
                        .and_then(|v| v.as_s().ok())?
                        .clone(),
                    started_at: item
                        .get("StartedAt")
                        .or_else(|| item.get("startedAt"))
                        .and_then(|v| v.as_s().ok())?
                        .clone(),
                    completed_at: item
                        .get("CompletedAt")
                        .or_else(|| item.get("completedAt"))
                        .and_then(|v| v.as_s().ok())
                        .map(|s| s.clone()),
                    duration_minutes: item
                        .get("DurationMinutes")
                        .or_else(|| item.get("durationMinutes"))
                        .and_then(|v| v.as_n().ok())
                        .and_then(|s| s.parse().ok()),
                    notes: item
                        .get("Notes")
                        .or_else(|| item.get("notes"))
                        .and_then(|v| v.as_s().ok())
                        .map(|s| s.clone()),
                    rating: item
                        .get("Rating")
                        .or_else(|| item.get("rating"))
                        .and_then(|v| v.as_n().ok())
                        .and_then(|s| s.parse().ok()),
                    created_at: item
                        .get("CreatedAt")
                        .or_else(|| item.get("createdAt"))
                        .and_then(|v| v.as_s().ok())?
                        .clone(),
                    updated_at: item
                        .get("UpdatedAt")
                        .or_else(|| item.get("updatedAt"))
                        .and_then(|v| v.as_s().ok())?
                        .clone(),
                    exercises: item
                        .get("exercises")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| {
                            list.iter()
                                .filter_map(|v| {
                                    let obj = v.as_m().ok()?;
                                    Some(SessionExercise {
                                        exercise_id: obj.get("exerciseId")?.as_s().ok()?.clone(),
                                        name: obj.get("name")?.as_s().ok()?.clone(),
                                        sets: obj
                                            .get("sets")
                                            .and_then(|v| v.as_l().ok())
                                            .map(|sets| {
                                                sets.iter()
                                                    .filter_map(|set| {
                                                        let set_obj = set.as_m().ok()?;
                                                        Some(ExerciseSet {
                                                            set_number: set_obj
                                                                .get("setNumber")?
                                                                .as_n()
                                                                .ok()?
                                                                .parse()
                                                                .ok()?,
                                                            reps: set_obj
                                                                .get("reps")
                                                                .and_then(|v| v.as_n().ok())
                                                                .and_then(|s| s.parse().ok()),
                                                            weight: set_obj
                                                                .get("weight")
                                                                .and_then(|v| v.as_n().ok())
                                                                .and_then(|s| s.parse().ok()),
                                                            duration_seconds: set_obj
                                                                .get("durationSeconds")
                                                                .and_then(|v| v.as_n().ok())
                                                                .and_then(|s| s.parse().ok()),
                                                            rest_seconds: set_obj
                                                                .get("restSeconds")
                                                                .and_then(|v| v.as_n().ok())
                                                                .and_then(|s| s.parse().ok()),
                                                            completed: *set_obj
                                                                .get("completed")?
                                                                .as_bool()
                                                                .ok()?,
                                                            notes: set_obj
                                                                .get("notes")
                                                                .and_then(|v| v.as_s().ok())
                                                                .map(|s| s.clone()),
                                                        })
                                                    })
                                                    .collect()
                                            })
                                            .unwrap_or_default(),
                                        notes: obj
                                            .get("notes")
                                            .and_then(|v| v.as_s().ok())
                                            .map(|s| s.clone()),
                                        order: obj.get("order")?.as_n().ok()?.parse().ok()?,
                                    })
                                })
                                .collect()
                        })
                        .unwrap_or_default(),
                })
            })
            .collect();

        Ok(serde_json::to_value(sessions)?)
    }

    pub async fn create_workout_session(
        &self,
        session: &WorkoutSession,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let mut item = std::collections::HashMap::new();
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", session.user_id)),
        );
        item.insert(
            "SK".to_string(),
            AttributeValue::S(format!("SESSION#{}", session.id)),
        );
        item.insert(
            "SessionId".to_string(),
            AttributeValue::S(session.id.clone()),
        );
        item.insert(
            "UserId".to_string(),
            AttributeValue::S(session.user_id.clone()),
        );
        item.insert("Name".to_string(), AttributeValue::S(session.name.clone()));
        item.insert(
            "StartedAt".to_string(),
            AttributeValue::S(session.started_at.clone()),
        );
        item.insert(
            "CreatedAt".to_string(),
            AttributeValue::S(session.created_at.clone()),
        );
        item.insert(
            "UpdatedAt".to_string(),
            AttributeValue::S(session.updated_at.clone()),
        );

        if let Some(plan_id) = &session.workout_plan_id {
            item.insert(
                "WorkoutPlanId".to_string(),
                AttributeValue::S(plan_id.clone()),
            );
        }
        if let Some(completed_at) = &session.completed_at {
            item.insert(
                "CompletedAt".to_string(),
                AttributeValue::S(completed_at.clone()),
            );
        }
        if let Some(duration) = session.duration_minutes {
            item.insert(
                "DurationMinutes".to_string(),
                AttributeValue::N(duration.to_string()),
            );
        }
        if let Some(notes) = &session.notes {
            item.insert("Notes".to_string(), AttributeValue::S(notes.clone()));
        }
        if let Some(rating) = session.rating {
            item.insert("Rating".to_string(), AttributeValue::N(rating.to_string()));
        }

        // Add exercises as a list of maps
        let exercises: Vec<AttributeValue> = session
            .exercises
            .iter()
            .map(|exercise| {
                let mut exercise_map = std::collections::HashMap::new();
                exercise_map.insert(
                    "exerciseId".to_string(),
                    AttributeValue::S(exercise.exercise_id.clone()),
                );
                exercise_map.insert("name".to_string(), AttributeValue::S(exercise.name.clone()));
                exercise_map.insert(
                    "order".to_string(),
                    AttributeValue::N(exercise.order.to_string()),
                );

                if let Some(notes) = &exercise.notes {
                    exercise_map.insert("notes".to_string(), AttributeValue::S(notes.clone()));
                }

                // Add sets
                let sets: Vec<AttributeValue> = exercise
                    .sets
                    .iter()
                    .map(|set| {
                        let mut set_map = std::collections::HashMap::new();
                        set_map.insert(
                            "setNumber".to_string(),
                            AttributeValue::N(set.set_number.to_string()),
                        );
                        set_map
                            .insert("completed".to_string(), AttributeValue::Bool(set.completed));

                        if let Some(reps) = set.reps {
                            set_map.insert("reps".to_string(), AttributeValue::N(reps.to_string()));
                        }
                        if let Some(weight) = set.weight {
                            set_map.insert(
                                "weight".to_string(),
                                AttributeValue::N(weight.to_string()),
                            );
                        }
                        if let Some(duration) = set.duration_seconds {
                            set_map.insert(
                                "durationSeconds".to_string(),
                                AttributeValue::N(duration.to_string()),
                            );
                        }
                        if let Some(rest) = set.rest_seconds {
                            set_map.insert(
                                "restSeconds".to_string(),
                                AttributeValue::N(rest.to_string()),
                            );
                        }
                        if let Some(notes) = &set.notes {
                            set_map.insert("notes".to_string(), AttributeValue::S(notes.clone()));
                        }

                        AttributeValue::M(set_map)
                    })
                    .collect();
                exercise_map.insert("sets".to_string(), AttributeValue::L(sets));

                AttributeValue::M(exercise_map)
            })
            .collect();
        item.insert("exercises".to_string(), AttributeValue::L(exercises));

        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(serde_json::to_value(session)?)
    }

    pub async fn get_workout_session(
        &self,
        session_id: &str,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Since we changed to USER#{user_id} pattern but don't have user_id here,
        // we need to scan for the session. This is less efficient but necessary.
        let result = self
            .client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("SK = :sk")
            .expression_attribute_values(
                ":sk",
                AttributeValue::S(format!("SESSION#{}", session_id)),
            )
            .send()
            .await?;

        let item = result.items.and_then(|items| items.into_iter().next());

        if let Some(item) = item {
            let session = WorkoutSession {
                id: item
                    .get("SessionId")
                    .or_else(|| item.get("id"))
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                user_id: item
                    .get("UserId")
                    .or_else(|| item.get("userId"))
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                workout_plan_id: item
                    .get("WorkoutPlanId")
                    .or_else(|| item.get("workoutPlanId"))
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                name: item
                    .get("Name")
                    .or_else(|| item.get("name"))
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                started_at: item
                    .get("StartedAt")
                    .or_else(|| item.get("startedAt"))
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                completed_at: item
                    .get("CompletedAt")
                    .or_else(|| item.get("completedAt"))
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                duration_minutes: item
                    .get("DurationMinutes")
                    .or_else(|| item.get("durationMinutes"))
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok()),
                notes: item
                    .get("Notes")
                    .or_else(|| item.get("notes"))
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                rating: item
                    .get("Rating")
                    .or_else(|| item.get("rating"))
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok()),
                created_at: item
                    .get("CreatedAt")
                    .or_else(|| item.get("createdAt"))
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                updated_at: item
                    .get("UpdatedAt")
                    .or_else(|| item.get("updatedAt"))
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                exercises: item
                    .get("exercises")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| {
                        list.iter()
                            .filter_map(|v| {
                                let obj = v.as_m().ok()?;
                                Some(SessionExercise {
                                    exercise_id: obj.get("exerciseId")?.as_s().ok()?.clone(),
                                    name: obj.get("name")?.as_s().ok()?.clone(),
                                    sets: obj
                                        .get("sets")
                                        .and_then(|v| v.as_l().ok())
                                        .map(|sets| {
                                            sets.iter()
                                                .filter_map(|set| {
                                                    let set_obj = set.as_m().ok()?;
                                                    Some(ExerciseSet {
                                                        set_number: set_obj
                                                            .get("setNumber")?
                                                            .as_n()
                                                            .ok()?
                                                            .parse()
                                                            .ok()?,
                                                        reps: set_obj
                                                            .get("reps")
                                                            .and_then(|v| v.as_n().ok())
                                                            .and_then(|s| s.parse().ok()),
                                                        weight: set_obj
                                                            .get("weight")
                                                            .and_then(|v| v.as_n().ok())
                                                            .and_then(|s| s.parse().ok()),
                                                        duration_seconds: set_obj
                                                            .get("durationSeconds")
                                                            .and_then(|v| v.as_n().ok())
                                                            .and_then(|s| s.parse().ok()),
                                                        rest_seconds: set_obj
                                                            .get("restSeconds")
                                                            .and_then(|v| v.as_n().ok())
                                                            .and_then(|s| s.parse().ok()),
                                                        completed: *set_obj
                                                            .get("completed")?
                                                            .as_bool()
                                                            .ok()?,
                                                        notes: set_obj
                                                            .get("notes")
                                                            .and_then(|v| v.as_s().ok())
                                                            .map(|s| s.clone()),
                                                    })
                                                })
                                                .collect()
                                        })
                                        .unwrap_or_default(),
                                    notes: obj
                                        .get("notes")
                                        .and_then(|v| v.as_s().ok())
                                        .map(|s| s.clone()),
                                    order: obj.get("order")?.as_n().ok()?.parse().ok()?,
                                })
                            })
                            .collect()
                    })
                    .unwrap_or_default(),
            };

            Ok(serde_json::to_value(session)?)
        } else {
            Err("Workout session not found".into())
        }
    }

    pub async fn update_workout_session(
        &self,
        session: &WorkoutSession,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        self.create_workout_session(session).await
    }

    pub async fn delete_workout_session(
        &self,
        session_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // First, find the session to get the user_id
        let scan_result = self
            .client
            .scan()
            .table_name(&self.table_name)
            .filter_expression("SK = :sk")
            .expression_attribute_values(
                ":sk",
                AttributeValue::S(format!("SESSION#{}", session_id)),
            )
            .send()
            .await?;

        if let Some(items) = scan_result.items {
            if let Some(item) = items.into_iter().next() {
                if let Some(user_id) = item
                    .get("UserId")
                    .or_else(|| item.get("userId"))
                    .and_then(|v| v.as_s().ok())
                {
                    self.client
                        .delete_item()
                        .table_name(&self.table_name)
                        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
                        .key("SK", AttributeValue::S(format!("SESSION#{}", session_id)))
                        .send()
                        .await?;
                }
            }
        }

        Ok(())
    }
}
