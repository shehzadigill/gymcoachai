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
    
    // Use GSI1 to query all workout plans
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S(format!("WORKOUT_PLAN#{}", user_id.unwrap_or_default())));
    
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
                description: item.get("Description").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                difficulty: item.get("Difficulty")?.as_s().ok()?.clone(),
                duration_weeks: item.get("DurationWeeks")?.as_n().ok()?.parse().ok()?,
                frequency_per_week: item.get("FrequencyPerWeek")?.as_n().ok()?.parse().ok()?,
                exercises: item.get("Exercises")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<WorkoutExercise>>(s).ok())
                    .unwrap_or_default(),
                created_at: item.get("CreatedAt")?.as_s().ok()?.clone(),
                updated_at: item.get("UpdatedAt")?.as_s().ok()?.clone(),
                is_active: item.get("IsActive").and_then(|v| v.as_bool().ok()).copied().unwrap_or(true),
                // Enhanced features
                tags: item.get("Tags")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok()),
                rating: item.get("Rating").and_then(|v| v.as_n().ok()).and_then(|n| n.parse().ok()),
                is_template: item.get("IsTemplate").and_then(|v| v.as_bool().ok()).copied(),
                total_sessions: item.get("TotalSessions").and_then(|v| v.as_n().ok()).and_then(|n| n.parse().ok()),
                completed_sessions: item.get("CompletedSessions").and_then(|v| v.as_n().ok()).and_then(|n| n.parse().ok()),
                next_scheduled_date: item.get("NextScheduledDate").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
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
    item.insert("PK".to_string(), AttributeValue::S(format!("WORKOUT_PLAN#{}", plan.user_id)));
    item.insert("SK".to_string(), AttributeValue::S(format!("WORKOUT_PLAN#{}", plan.id)));
    item.insert("GSI1PK".to_string(), AttributeValue::S("WORKOUT_PLAN".to_string()));
    item.insert("GSI1SK".to_string(), AttributeValue::S(format!("{}#{}", plan.name.to_lowercase(), plan.id)));
    item.insert("EntityType".to_string(), AttributeValue::S("WORKOUT_PLAN".to_string()));
    item.insert("WorkoutPlanId".to_string(), AttributeValue::S(plan.id.clone()));
    item.insert("UserId".to_string(), AttributeValue::S(plan.user_id.clone()));
    item.insert("Name".to_string(), AttributeValue::S(plan.name.clone()));
    item.insert("NameLower".to_string(), AttributeValue::S(plan.name.to_lowercase()));
    item.insert("Difficulty".to_string(), AttributeValue::S(plan.difficulty.clone()));
    item.insert("DurationWeeks".to_string(), AttributeValue::N(plan.duration_weeks.to_string()));
    item.insert("FrequencyPerWeek".to_string(), AttributeValue::N(plan.frequency_per_week.to_string()));
    item.insert("IsActive".to_string(), AttributeValue::Bool(plan.is_active));
    item.insert("CreatedAt".to_string(), AttributeValue::S(plan.created_at.clone()));
    item.insert("UpdatedAt".to_string(), AttributeValue::S(plan.updated_at.clone()));
    
    if let Some(description) = &plan.description {
        item.insert("Description".to_string(), AttributeValue::S(description.clone()));
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
        item.insert("TotalSessions".to_string(), AttributeValue::N(total_sessions.to_string()));
    }
    
    if let Some(completed_sessions) = plan.completed_sessions {
        item.insert("CompletedSessions".to_string(), AttributeValue::N(completed_sessions.to_string()));
    }
    
    if let Some(next_scheduled_date) = &plan.next_scheduled_date {
        item.insert("NextScheduledDate".to_string(), AttributeValue::S(next_scheduled_date.clone()));
    }
    
    // Add exercises as JSON string to match populate script
    let exercises_json = serde_json::to_string(&plan.exercises).unwrap_or_default();
    item.insert("Exercises".to_string(), AttributeValue::S(exercises_json));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(plan)?)
}

pub async fn get_workout_plan_from_db(
    user_id: &str,
    plan_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("WORKOUT_PLAN#{}", user_id)))
        .key("SK", AttributeValue::S(format!("WORKOUT_PLAN#{}", plan_id)))
        .send()
        .await?;

    if let Some(item) = result.item {
        let plan = WorkoutPlan {
            id: item.get("WorkoutPlanId").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            user_id: item.get("UserId").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            name: item.get("Name").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            description: item.get("Description").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            difficulty: item.get("Difficulty").and_then(|v| v.as_s().ok()).map_or("beginner", |v| v).to_string(),
            duration_weeks: item.get("DurationWeeks").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            frequency_per_week: item.get("FrequencyPerWeek").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            exercises: item.get("Exercises")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<WorkoutExercise>>(s).ok())
                .unwrap_or_default(),
            created_at: item.get("CreatedAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            updated_at: item.get("UpdatedAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            is_active: item.get("IsActive").and_then(|v| v.as_bool().ok()).copied().unwrap_or(true),
            // Enhanced features
            tags: item.get("Tags")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok()),
            rating: item.get("Rating").and_then(|v| v.as_n().ok()).and_then(|n| n.parse().ok()),
            is_template: item.get("IsTemplate").and_then(|v| v.as_bool().ok()).copied(),
            total_sessions: item.get("TotalSessions").and_then(|v| v.as_n().ok()).and_then(|n| n.parse().ok()),
            completed_sessions: item.get("CompletedSessions").and_then(|v| v.as_n().ok()).and_then(|n| n.parse().ok()),
            next_scheduled_date: item.get("NextScheduledDate").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
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
    user_id: &str,
    plan_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("WORKOUT_PLAN#{}", user_id)))
        .key("SK", AttributeValue::S(format!("WORKOUT_PLAN#{}", plan_id)))
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
                                        completed: *set_obj.get("completed")?.as_bool().ok()?,
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
            id: item.get("id").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            user_id: item.get("userId").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            workout_plan_id: item.get("workoutPlanId").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            name: item.get("name").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            started_at: item.get("startedAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            completed_at: item.get("completedAt").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            duration_minutes: item.get("durationMinutes").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
            notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            rating: item.get("rating").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
            created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
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
                                    completed: *set_obj.get("completed")?.as_bool().ok()?,
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
        .index_name("GSI1")
        .key_condition_expression("GSI1PK = :gsi1pk")
        .expression_attribute_values(":gsi1pk", AttributeValue::S("EXERCISE".to_string()))
        .send()
        .await?;
    
    let exercises: Vec<Exercise> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(Exercise {
                id: item.get("ExerciseId")?.as_s().ok()?.clone(),
                name: item.get("Name")?.as_s().ok()?.clone(),
                description: item.get("Description").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                category: item.get("Category")?.as_s().ok()?.clone(),
                muscle_groups: item.get("MuscleGroups")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .unwrap_or_default(),
                equipment: item.get("Equipment")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .unwrap_or_default(),
                difficulty: item.get("Difficulty")?.as_s().ok()?.clone(),
                instructions: item.get("Instructions")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .unwrap_or_default(),
                tips: item.get("Tips").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                video_url: item.get("VideoUrl").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                image_url: item.get("ImageUrl").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                created_by: item.get("CreatedBy").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                is_system: item.get("IsSystem").and_then(|v| v.as_bool().ok()).copied().unwrap_or(false),
                tags: item.get("Tags")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .unwrap_or_default(),
                created_at: item.get("CreatedAt")?.as_s().ok()?.clone(),
                updated_at: item.get("UpdatedAt")?.as_s().ok()?.clone(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(exercises)?)
}

pub async fn get_exercises_from_db_with_user(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut all_exercises: Vec<Exercise> = Vec::new();
    
    // Query 1: Get system exercises using GSI1SK = "SYSTEM"
    let system_result = dynamodb_client
        .query()
        .table_name(&table_name)
        .index_name("GSI1")
        .key_condition_expression("GSI1PK = :gsi1pk AND begins_with(GSI1SK, :system_prefix)")
        .expression_attribute_values(":gsi1pk", AttributeValue::S("EXERCISE".to_string()))
        .expression_attribute_values(":system_prefix", AttributeValue::S("SYSTEM#".to_string()))
        .send()
        .await?;
    
    // Query 2: Get user's exercises if user_id is provided
    if let Some(ref user_id) = user_id {
        let user_result = dynamodb_client
            .query()
            .table_name(&table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :gsi1pk AND begins_with(GSI1SK, :user_prefix)")
            .expression_attribute_values(":gsi1pk", AttributeValue::S("EXERCISE".to_string()))
            .expression_attribute_values(":user_prefix", AttributeValue::S(format!("USER#{}#", user_id)))
            .send()
            .await?;
        
        // Process user exercises
        let user_exercises: Vec<Exercise> = user_result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| parse_exercise_item(item))
            .collect();
        
        all_exercises.extend(user_exercises);
    }
    
    // Process system exercises
    let system_exercises: Vec<Exercise> = system_result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| parse_exercise_item(item))
        .collect();
    
    all_exercises.extend(system_exercises);
    
    Ok(serde_json::to_value(all_exercises)?)
}

// Helper function to parse exercise items from DynamoDB
fn parse_exercise_item(item: std::collections::HashMap<String, AttributeValue>) -> Option<Exercise> {
    Some(Exercise {
        id: item.get("ExerciseId")?.as_s().ok()?.clone(),
        name: item.get("Name")?.as_s().ok()?.clone(),
        description: item.get("Description").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
        category: item.get("Category")?.as_s().ok()?.clone(),
        muscle_groups: item.get("MuscleGroups")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
            .unwrap_or_default(),
        equipment: item.get("Equipment")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
            .unwrap_or_default(),
        difficulty: item.get("Difficulty")?.as_s().ok()?.clone(),
        instructions: item.get("Instructions")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
            .unwrap_or_default(),
        tips: item.get("Tips").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
        video_url: item.get("VideoUrl").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
        image_url: item.get("ImageUrl").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
        created_by: item.get("CreatedBy").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
        is_system: item.get("IsSystem").and_then(|v| v.as_bool().ok()).copied().unwrap_or(false),
        tags: item.get("Tags")
            .and_then(|v| v.as_s().ok())
            .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
            .unwrap_or_default(),
        created_at: item.get("CreatedAt")?.as_s().ok()?.clone(),
        updated_at: item.get("UpdatedAt")?.as_s().ok()?.clone(),
    })
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
    
    // Add new fields
    if let Some(created_by) = &exercise.created_by {
        item.insert("CreatedBy".to_string(), AttributeValue::S(created_by.clone()));
    }
    item.insert("IsSystem".to_string(), AttributeValue::Bool(exercise.is_system));
    
    let tags_json = serde_json::to_string(&exercise.tags).unwrap_or_default();
    item.insert("Tags".to_string(), AttributeValue::S(tags_json));
    
    // Add GSI attributes for querying with proper key structure
    item.insert("GSI1PK".to_string(), AttributeValue::S("EXERCISE".to_string()));
    
    // Use different GSI1SK patterns for system vs user exercises
    let gsi1_sk = if exercise.is_system {
        format!("SYSTEM#{}", exercise.name.to_lowercase())
    } else if let Some(ref created_by) = exercise.created_by {
        format!("USER#{}#{}", created_by, exercise.name.to_lowercase())
    } else {
        format!("SYSTEM#{}", exercise.name.to_lowercase()) // fallback to system
    };
    
    item.insert("GSI1SK".to_string(), AttributeValue::S(gsi1_sk));
    item.insert("EntityType".to_string(), AttributeValue::S("EXERCISE".to_string()));
    item.insert("ExerciseId".to_string(), AttributeValue::S(exercise.id.clone()));
    item.insert("Name".to_string(), AttributeValue::S(exercise.name.clone()));
    item.insert("Category".to_string(), AttributeValue::S(exercise.category.clone()));
    item.insert("Difficulty".to_string(), AttributeValue::S(exercise.difficulty.clone()));
    
    // Store as JSON strings for consistency with query functions
    let muscle_groups_json = serde_json::to_string(&exercise.muscle_groups).unwrap_or_default();
    item.insert("MuscleGroups".to_string(), AttributeValue::S(muscle_groups_json));
    
    let equipment_json = serde_json::to_string(&exercise.equipment).unwrap_or_default();
    item.insert("Equipment".to_string(), AttributeValue::S(equipment_json));
    
    let instructions_json = serde_json::to_string(&exercise.instructions).unwrap_or_default();
    item.insert("Instructions".to_string(), AttributeValue::S(instructions_json));
    
    if let Some(description) = &exercise.description {
        item.insert("Description".to_string(), AttributeValue::S(description.clone()));
    }
    if let Some(tips) = &exercise.tips {
        item.insert("Tips".to_string(), AttributeValue::S(tips.clone()));
    }
    if let Some(video_url) = &exercise.video_url {
        item.insert("VideoUrl".to_string(), AttributeValue::S(video_url.clone()));
    }
    if let Some(image_url) = &exercise.image_url {
        item.insert("ImageUrl".to_string(), AttributeValue::S(image_url.clone()));
    }
    
    item.insert("CreatedAt".to_string(), AttributeValue::S(exercise.created_at.clone()));
    item.insert("UpdatedAt".to_string(), AttributeValue::S(exercise.updated_at.clone()));
    
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
            id: item.get("ExerciseId").or_else(|| item.get("id")).and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            name: item.get("Name").or_else(|| item.get("name")).and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            description: item.get("Description").or_else(|| item.get("description")).and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            category: item.get("Category").or_else(|| item.get("category")).and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            muscle_groups: item.get("MuscleGroups")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .or_else(|| {
                    item.get("muscleGroups")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                })
                .unwrap_or_default(),
            equipment: item.get("Equipment")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .or_else(|| {
                    item.get("equipment")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                })
                .unwrap_or_default(),
            difficulty: item.get("Difficulty").or_else(|| item.get("difficulty")).and_then(|v| v.as_s().ok()).map_or("beginner", |v| v).to_string(),
            instructions: item.get("Instructions")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .or_else(|| {
                    item.get("instructions")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                })
                .unwrap_or_default(),
            tips: item.get("Tips").or_else(|| item.get("tips")).and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            video_url: item.get("VideoUrl").or_else(|| item.get("videoUrl")).and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            image_url: item.get("ImageUrl").or_else(|| item.get("imageUrl")).and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            created_by: item.get("CreatedBy").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            is_system: item.get("IsSystem").and_then(|v| v.as_bool().ok()).copied().unwrap_or(false),
            tags: item.get("Tags")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .unwrap_or_default(),
            created_at: item.get("CreatedAt").or_else(|| item.get("createdAt")).and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
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

// Scheduled Workout Database Operations
pub async fn create_scheduled_workout_in_db(
    scheduled_workout: &ScheduledWorkout,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
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
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(scheduled_workout)?)
}

pub async fn get_scheduled_workouts_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let query = dynamodb_client
        .query()
        .table_name(&table_name)
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

pub async fn update_scheduled_workout_in_db(
    scheduled_workout: &ScheduledWorkout,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
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
    
    dynamodb_client
        .update_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", scheduled_workout.user_id)))
        .key("SK", AttributeValue::S(format!("SCHEDULE#{}", scheduled_workout.id)))
        .update_expression(update_expression)
        .set_expression_attribute_names(Some(expression_attribute_names))
        .set_expression_attribute_values(Some(expression_attribute_values))
        .send()
        .await?;
    
    Ok(serde_json::to_value(scheduled_workout)?)
}

pub async fn delete_scheduled_workout_from_db(
    user_id: &str,
    schedule_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
        .key("SK", AttributeValue::S(format!("SCHEDULE#{}", schedule_id)))
        .send()
        .await?;
    
    Ok(serde_json::json!({"message": "Scheduled workout deleted successfully"}))
}
