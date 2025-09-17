use serde_json::Value;
use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use aws_sdk_s3::Client as S3Client;
use chrono::Utc;
use anyhow::Result;

use crate::models::*;

// Workout Plan Database Operations
pub async fn get_workout_plans_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("WORKOUT_PLANS".to_string()));
    
    if let Some(uid) = user_id {
        query = query
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(uid));
    }
    
    let result = query.send().await?;
    
    let plans: Vec<WorkoutPlan> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(WorkoutPlan {
                id: item.get("id")?.as_s().ok()?.clone(),
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                name: item.get("name")?.as_s().ok()?.clone(),
                description: item.get("description").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                difficulty: item.get("difficulty")?.as_s().ok()?.clone(),
                duration_weeks: item.get("durationWeeks")?.as_n().ok()?.parse().ok()?,
                frequency_per_week: item.get("frequencyPerWeek")?.as_n().ok()?.parse().ok()?,
                exercises: item.get("exercises")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| {
                        let obj = v.as_m().ok()?;
                        Some(WorkoutExercise {
                            exercise_id: obj.get("exerciseId")?.as_s().ok()?.clone(),
                            name: obj.get("name")?.as_s().ok()?.clone(),
                            sets: obj.get("sets")?.as_n().ok()?.parse().ok()?,
                            reps: obj.get("reps").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                            duration_seconds: obj.get("durationSeconds").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                            weight: obj.get("weight").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                            rest_seconds: obj.get("restSeconds").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                            notes: obj.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                            order: obj.get("order")?.as_n().ok()?.parse().ok()?,
                        })
                    }).collect())
                    .unwrap_or_default(),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
                is_active: item.get("isActive")?.as_bool().ok()?,
            })
        })
        .collect();
    
    Ok(serde_json::to_value(plans)?)
}

pub async fn create_workout_plan_in_db(
    plan: &WorkoutPlan,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("WORKOUT_PLANS".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("PLAN#{}", plan.id)));
    item.insert("id".to_string(), AttributeValue::S(plan.id.clone()));
    item.insert("userId".to_string(), AttributeValue::S(plan.user_id.clone()));
    item.insert("name".to_string(), AttributeValue::S(plan.name.clone()));
    item.insert("difficulty".to_string(), AttributeValue::S(plan.difficulty.clone()));
    item.insert("durationWeeks".to_string(), AttributeValue::N(plan.duration_weeks.to_string()));
    item.insert("frequencyPerWeek".to_string(), AttributeValue::N(plan.frequency_per_week.to_string()));
    item.insert("isActive".to_string(), AttributeValue::Bool(plan.is_active));
    item.insert("createdAt".to_string(), AttributeValue::S(plan.created_at.clone()));
    item.insert("updatedAt".to_string(), AttributeValue::S(plan.updated_at.clone()));
    
    if let Some(description) = &plan.description {
        item.insert("description".to_string(), AttributeValue::S(description.clone()));
    }
    
    // Add exercises as a list of maps
    let exercises: Vec<AttributeValue> = plan.exercises
        .iter()
        .map(|exercise| {
            let mut exercise_map = std::collections::HashMap::new();
            exercise_map.insert("exerciseId".to_string(), AttributeValue::S(exercise.exercise_id.clone()));
            exercise_map.insert("name".to_string(), AttributeValue::S(exercise.name.clone()));
            exercise_map.insert("sets".to_string(), AttributeValue::N(exercise.sets.to_string()));
            exercise_map.insert("order".to_string(), AttributeValue::N(exercise.order.to_string()));
            
            if let Some(reps) = exercise.reps {
                exercise_map.insert("reps".to_string(), AttributeValue::N(reps.to_string()));
            }
            if let Some(duration) = exercise.duration_seconds {
                exercise_map.insert("durationSeconds".to_string(), AttributeValue::N(duration.to_string()));
            }
            if let Some(weight) = exercise.weight {
                exercise_map.insert("weight".to_string(), AttributeValue::N(weight.to_string()));
            }
            if let Some(rest) = exercise.rest_seconds {
                exercise_map.insert("restSeconds".to_string(), AttributeValue::N(rest.to_string()));
            }
            if let Some(notes) = &exercise.notes {
                exercise_map.insert("notes".to_string(), AttributeValue::S(notes.clone()));
            }
            
            AttributeValue::M(exercise_map)
        })
        .collect();
    item.insert("exercises".to_string(), AttributeValue::L(exercises));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(plan)?)
}

pub async fn get_workout_plan_from_db(
    plan_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("WORKOUT_PLANS".to_string()))
        .key("SK", AttributeValue::S(format!("PLAN#{}", plan_id)))
        .send()
        .await?;

    if let Some(item) = result.item {
        let plan = WorkoutPlan {
            id: item.get("id").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            user_id: item.get("userId").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            name: item.get("name").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            description: item.get("description").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            difficulty: item.get("difficulty").and_then(|v| v.as_s().ok()).unwrap_or("beginner").to_string(),
            duration_weeks: item.get("durationWeeks").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            frequency_per_week: item.get("frequencyPerWeek").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            exercises: item.get("exercises")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| {
                    let obj = v.as_m().ok()?;
                    Some(WorkoutExercise {
                        exercise_id: obj.get("exerciseId")?.as_s().ok()?.clone(),
                        name: obj.get("name")?.as_s().ok()?.clone(),
                        sets: obj.get("sets")?.as_n().ok()?.parse().ok()?,
                        reps: obj.get("reps").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                        duration_seconds: obj.get("durationSeconds").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                        weight: obj.get("weight").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                        rest_seconds: obj.get("restSeconds").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                        notes: obj.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                        order: obj.get("order")?.as_n().ok()?.parse().ok()?,
                    })
                }).collect())
                .unwrap_or_default(),
            created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            is_active: item.get("isActive").and_then(|v| v.as_bool().ok()).unwrap_or(false),
        };
        
        Ok(serde_json::to_value(plan)?)
    } else {
        Err("Workout plan not found".into())
    }
}

pub async fn update_workout_plan_in_db(
    plan: &WorkoutPlan,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    // Similar to create but with updated timestamp
    create_workout_plan_in_db(plan, dynamodb_client).await
}

pub async fn delete_workout_plan_from_db(
    plan_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("WORKOUT_PLANS".to_string()))
        .key("SK", AttributeValue::S(format!("PLAN#{}", plan_id)))
        .send()
        .await?;
    
    Ok(())
}

// Workout Session Database Operations
pub async fn get_workout_sessions_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("WORKOUT_SESSIONS".to_string()));
    
    if let Some(uid) = user_id {
        query = query
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(uid));
    }
    
    let result = query.send().await?;
    
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
                notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                rating: item.get("rating").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
                exercises: item.get("exercises")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| {
                        let obj = v.as_m().ok()?;
                        Some(SessionExercise {
                            exercise_id: obj.get("exerciseId")?.as_s().ok()?.clone(),
                            name: obj.get("name")?.as_s().ok()?.clone(),
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
                                        completed: set_obj.get("completed")?.as_bool().ok()?,
                                        notes: set_obj.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                                    })
                                }).collect())
                                .unwrap_or_default(),
                            notes: obj.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                            order: obj.get("order")?.as_n().ok()?.parse().ok()?,
                        })
                    }).collect())
                    .unwrap_or_default(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(sessions)?)
}

pub async fn create_workout_session_in_db(
    session: &WorkoutSession,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("WORKOUT_SESSIONS".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("SESSION#{}", session.id)));
    item.insert("id".to_string(), AttributeValue::S(session.id.clone()));
    item.insert("userId".to_string(), AttributeValue::S(session.user_id.clone()));
    item.insert("name".to_string(), AttributeValue::S(session.name.clone()));
    item.insert("startedAt".to_string(), AttributeValue::S(session.started_at.clone()));
    item.insert("createdAt".to_string(), AttributeValue::S(session.created_at.clone()));
    item.insert("updatedAt".to_string(), AttributeValue::S(session.updated_at.clone()));
    
    if let Some(plan_id) = &session.workout_plan_id {
        item.insert("workoutPlanId".to_string(), AttributeValue::S(plan_id.clone()));
    }
    if let Some(completed_at) = &session.completed_at {
        item.insert("completedAt".to_string(), AttributeValue::S(completed_at.clone()));
    }
    if let Some(duration) = session.duration_minutes {
        item.insert("durationMinutes".to_string(), AttributeValue::N(duration.to_string()));
    }
    if let Some(notes) = &session.notes {
        item.insert("notes".to_string(), AttributeValue::S(notes.clone()));
    }
    if let Some(rating) = session.rating {
        item.insert("rating".to_string(), AttributeValue::N(rating.to_string()));
    }
    
    // Add exercises as a list of maps
    let exercises: Vec<AttributeValue> = session.exercises
        .iter()
        .map(|exercise| {
            let mut exercise_map = std::collections::HashMap::new();
            exercise_map.insert("exerciseId".to_string(), AttributeValue::S(exercise.exercise_id.clone()));
            exercise_map.insert("name".to_string(), AttributeValue::S(exercise.name.clone()));
            exercise_map.insert("order".to_string(), AttributeValue::N(exercise.order.to_string()));
            
            if let Some(notes) = &exercise.notes {
                exercise_map.insert("notes".to_string(), AttributeValue::S(notes.clone()));
            }
            
            // Add sets
            let sets: Vec<AttributeValue> = exercise.sets
                .iter()
                .map(|set| {
                    let mut set_map = std::collections::HashMap::new();
                    set_map.insert("setNumber".to_string(), AttributeValue::N(set.set_number.to_string()));
                    set_map.insert("completed".to_string(), AttributeValue::Bool(set.completed));
                    
                    if let Some(reps) = set.reps {
                        set_map.insert("reps".to_string(), AttributeValue::N(reps.to_string()));
                    }
                    if let Some(weight) = set.weight {
                        set_map.insert("weight".to_string(), AttributeValue::N(weight.to_string()));
                    }
                    if let Some(duration) = set.duration_seconds {
                        set_map.insert("durationSeconds".to_string(), AttributeValue::N(duration.to_string()));
                    }
                    if let Some(rest) = set.rest_seconds {
                        set_map.insert("restSeconds".to_string(), AttributeValue::N(rest.to_string()));
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
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(session)?)
}

pub async fn get_workout_session_from_db(
    session_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("WORKOUT_SESSIONS".to_string()))
        .key("SK", AttributeValue::S(format!("SESSION#{}", session_id)))
        .send()
        .await?;

    if let Some(item) = result.item {
        let session = WorkoutSession {
            id: item.get("id").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            user_id: item.get("userId").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            workout_plan_id: item.get("workoutPlanId").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            name: item.get("name").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            started_at: item.get("startedAt").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            completed_at: item.get("completedAt").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            duration_minutes: item.get("durationMinutes").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
            notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            rating: item.get("rating").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
            created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            exercises: item.get("exercises")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| {
                    let obj = v.as_m().ok()?;
                    Some(SessionExercise {
                        exercise_id: obj.get("exerciseId")?.as_s().ok()?.clone(),
                        name: obj.get("name")?.as_s().ok()?.clone(),
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
                                    completed: set_obj.get("completed")?.as_bool().ok()?,
                                    notes: set_obj.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                                })
                            }).collect())
                            .unwrap_or_default(),
                        notes: obj.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                        order: obj.get("order")?.as_n().ok()?.parse().ok()?,
                    })
                }).collect())
                .unwrap_or_default(),
        };
        
        Ok(serde_json::to_value(session)?)
    } else {
        Err("Workout session not found".into())
    }
}

pub async fn update_workout_session_in_db(
    session: &WorkoutSession,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    create_workout_session_in_db(session, dynamodb_client).await
}

pub async fn delete_workout_session_from_db(
    session_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("WORKOUT_SESSIONS".to_string()))
        .key("SK", AttributeValue::S(format!("SESSION#{}", session_id)))
        .send()
        .await?;
    
    Ok(())
}

// Exercise Database Operations
pub async fn get_exercises_from_db(
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("EXERCISES".to_string()))
        .send()
        .await?;
    
    let exercises: Vec<Exercise> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(Exercise {
                id: item.get("id")?.as_s().ok()?.clone(),
                name: item.get("name")?.as_s().ok()?.clone(),
                description: item.get("description").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                category: item.get("category")?.as_s().ok()?.clone(),
                muscle_groups: item.get("muscleGroups")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    .unwrap_or_default(),
                equipment: item.get("equipment")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    .unwrap_or_default(),
                difficulty: item.get("difficulty")?.as_s().ok()?.clone(),
                instructions: item.get("instructions")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    .unwrap_or_default(),
                tips: item.get("tips").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                video_url: item.get("videoUrl").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                image_url: item.get("imageUrl").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(exercises)?)
}

pub async fn create_exercise_in_db(
    exercise: &Exercise,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("EXERCISES".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("EXERCISE#{}", exercise.id)));
    item.insert("id".to_string(), AttributeValue::S(exercise.id.clone()));
    item.insert("name".to_string(), AttributeValue::S(exercise.name.clone()));
    item.insert("category".to_string(), AttributeValue::S(exercise.category.clone()));
    item.insert("difficulty".to_string(), AttributeValue::S(exercise.difficulty.clone()));
    item.insert("createdAt".to_string(), AttributeValue::S(exercise.created_at.clone()));
    item.insert("updatedAt".to_string(), AttributeValue::S(exercise.updated_at.clone()));
    
    if let Some(description) = &exercise.description {
        item.insert("description".to_string(), AttributeValue::S(description.clone()));
    }
    if let Some(tips) = &exercise.tips {
        item.insert("tips".to_string(), AttributeValue::S(tips.clone()));
    }
    if let Some(video_url) = &exercise.video_url {
        item.insert("videoUrl".to_string(), AttributeValue::S(video_url.clone()));
    }
    if let Some(image_url) = &exercise.image_url {
        item.insert("imageUrl".to_string(), AttributeValue::S(image_url.clone()));
    }
    
    // Add muscle groups as a list
    let muscle_groups: Vec<AttributeValue> = exercise.muscle_groups
        .iter()
        .map(|group| AttributeValue::S(group.clone()))
        .collect();
    item.insert("muscleGroups".to_string(), AttributeValue::L(muscle_groups));
    
    // Add equipment as a list
    let equipment: Vec<AttributeValue> = exercise.equipment
        .iter()
        .map(|eq| AttributeValue::S(eq.clone()))
        .collect();
    item.insert("equipment".to_string(), AttributeValue::L(equipment));
    
    // Add instructions as a list
    let instructions: Vec<AttributeValue> = exercise.instructions
        .iter()
        .map(|instruction| AttributeValue::S(instruction.clone()))
        .collect();
    item.insert("instructions".to_string(), AttributeValue::L(instructions));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(exercise)?)
}

pub async fn get_exercise_from_db(
    exercise_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("EXERCISES".to_string()))
        .key("SK", AttributeValue::S(format!("EXERCISE#{}", exercise_id)))
        .send()
        .await?;

    if let Some(item) = result.item {
        let exercise = Exercise {
            id: item.get("id").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            name: item.get("name").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            description: item.get("description").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            category: item.get("category").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            muscle_groups: item.get("muscleGroups")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                .unwrap_or_default(),
            equipment: item.get("equipment")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                .unwrap_or_default(),
            difficulty: item.get("difficulty").and_then(|v| v.as_s().ok()).unwrap_or("beginner").to_string(),
            instructions: item.get("instructions")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                .unwrap_or_default(),
            tips: item.get("tips").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            video_url: item.get("videoUrl").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            image_url: item.get("imageUrl").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
            updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).unwrap_or("").to_string(),
        };
        
        Ok(serde_json::to_value(exercise)?)
    } else {
        Err("Exercise not found".into())
    }
}

pub async fn update_exercise_in_db(
    exercise: &Exercise,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    create_exercise_in_db(exercise, dynamodb_client).await
}

pub async fn delete_exercise_from_db(
    exercise_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("EXERCISES".to_string()))
        .key("SK", AttributeValue::S(format!("EXERCISE#{}", exercise_id)))
        .send()
        .await?;
    
    Ok(())
}

// Progress Photo Database Operations
pub async fn get_progress_photos_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("PROGRESS_PHOTOS".to_string()));
    
    if let Some(uid) = user_id {
        query = query
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(uid));
    }
    
    let result = query.send().await?;
    
    let photos: Vec<ProgressPhoto> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(ProgressPhoto {
                id: item.get("id")?.as_s().ok()?.clone(),
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                workout_session_id: item.get("workoutSessionId").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                photo_type: item.get("photoType")?.as_s().ok()?.clone(),
                photo_url: item.get("photoUrl")?.as_s().ok()?.clone(),
                s3_key: item.get("s3Key")?.as_s().ok()?.clone(),
                taken_at: item.get("takenAt")?.as_s().ok()?.clone(),
                notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(photos)?)
}

pub async fn delete_progress_photo_from_db(
    photo_id: &str,
    dynamodb_client: &DynamoDbClient,
    s3_client: &S3Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    // First get the photo to get the S3 key
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("PROGRESS_PHOTOS".to_string()))
        .key("SK", AttributeValue::S(format!("PHOTO#{}", photo_id)))
        .send()
        .await?;

    if let Some(item) = result.item {
        if let Some(s3_key) = item.get("s3Key").and_then(|v| v.as_s().ok()) {
            // Delete from S3
            let _ = s3_client
                .delete_object()
                .bucket("gymcoach-ai-user-uploads")
                .key(s3_key)
                .send()
                .await;
        }
    }
    
    // Delete from DynamoDB
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("PROGRESS_PHOTOS".to_string()))
        .key("SK", AttributeValue::S(format!("PHOTO#{}", photo_id)))
        .send()
        .await?;
    
    Ok(())
}

// Analytics Database Operations
pub async fn get_workout_analytics_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    // This would typically aggregate data from multiple tables
    // For now, return a basic analytics structure
    let analytics = WorkoutAnalytics {
        user_id: user_id.unwrap_or_else(|| "unknown".to_string()),
        total_workouts: 0,
        total_duration_minutes: 0,
        current_streak: 0,
        longest_streak: 0,
        favorite_exercises: vec![],
        average_workout_duration: 0.0,
        workouts_this_week: 0,
        workouts_this_month: 0,
        last_workout_date: None,
        strength_progress: vec![],
        body_measurements: vec![],
    };
    
    Ok(serde_json::to_value(analytics)?)
}

pub async fn get_workout_history_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let sessions = get_workout_sessions_from_db(user_id, dynamodb_client).await?;
    
    let history = WorkoutHistory {
        sessions: serde_json::from_value(sessions)?,
        pagination: Pagination {
            page: 1,
            limit: 20,
            total: 0,
            total_pages: 0,
        },
    };
    
    Ok(serde_json::to_value(history)?)
}
