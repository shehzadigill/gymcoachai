use serde_json::{json, Value};
use lambda_runtime::Error;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_s3::Client as S3Client;
use chrono::Utc;
use uuid::Uuid;

use crate::models::*;
use crate::database::*;

// Helper to create a standard JSON response
fn create_response(status_code: u16, body: Value) -> Result<Value, Error> {
    Ok(json!({
        "statusCode": status_code,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
            "Access-Control-Allow-Methods": "OPTIONS,POST,GET,PUT,DELETE"
        },
        "body": body.to_string(),
    }))
}

// Workout Plan Handlers
pub async fn get_workout_plans_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_workout_plans_from_db(user_id, dynamodb_client).await {
        Ok(plans) => create_response(200, plans),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve workout plans: {}", e)})),
    }
}

pub async fn create_workout_plan_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let plan_id = Uuid::new_v4().to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let name = payload["body"]["name"].as_str().unwrap_or("").to_string();
    let difficulty = payload["body"]["difficulty"].as_str().unwrap_or("beginner").to_string();
    let duration_weeks = payload["body"]["durationWeeks"].as_u64().unwrap_or(4) as u32;
    let frequency_per_week = payload["body"]["frequencyPerWeek"].as_u64().unwrap_or(3) as u32;

    if user_id.is_empty() || name.is_empty() {
        return create_response(400, json!({"message": "User ID and name are required"}));
    }

    let exercises: Vec<WorkoutExercise> = payload["body"]["exercises"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .enumerate()
        .filter_map(|(index, exercise)| {
            Some(WorkoutExercise {
                exercise_id: exercise["exerciseId"].as_str()?.to_string(),
                name: exercise["name"].as_str()?.to_string(),
                sets: exercise["sets"].as_u64()? as i32,
                reps: exercise["reps"].as_u64().map(|r| r as i32),
                duration_seconds: exercise["durationSeconds"].as_u64().map(|d| d as i32),
                weight: exercise["weight"].as_f64().map(|w| w as f32),
                rest_seconds: exercise["restSeconds"].as_u64().map(|r| r as i32),
                notes: exercise["notes"].as_str().map(|s| s.to_string()),
                order: index as i32,
            })
        })
        .collect();

    let new_plan = WorkoutPlan {
        id: plan_id.clone(),
        user_id,
        name,
        description: payload["body"]["description"].as_str().map(|s| s.to_string()),
        difficulty,
        duration_weeks: duration_weeks as i32,
        frequency_per_week: frequency_per_week as i32,
        exercises,
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
        is_active: true,
    };

    match create_workout_plan_in_db(&new_plan, dynamodb_client).await {
        Ok(plan) => create_response(201, plan),
        Err(e) => create_response(500, json!({"message": format!("Failed to create workout plan: {}", e)})),
    }
}

pub async fn get_workout_plan_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let plan_id = payload["pathParameters"]["planId"].as_str().unwrap_or("");

    if plan_id.is_empty() {
        return create_response(400, json!({"message": "Plan ID is required"}));
    }

    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    match get_workout_plan_from_db(user_id, plan_id, dynamodb_client).await {
        Ok(plan) => create_response(200, plan),
        Err(e) => create_response(404, json!({"message": format!("Workout plan not found: {}", e)})),
    }
}

pub async fn update_workout_plan_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let plan_id = payload["body"]["id"].as_str().unwrap_or("").to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let name = payload["body"]["name"].as_str().unwrap_or("").to_string();
    let difficulty = payload["body"]["difficulty"].as_str().unwrap_or("beginner").to_string();
    let duration_weeks = payload["body"]["durationWeeks"].as_u64().unwrap_or(4) as u32;
    let frequency_per_week = payload["body"]["frequencyPerWeek"].as_u64().unwrap_or(3) as u32;

    if plan_id.is_empty() || user_id.is_empty() || name.is_empty() {
        return create_response(400, json!({"message": "Plan ID, User ID, and name are required"}));
    }

    let exercises: Vec<WorkoutExercise> = payload["body"]["exercises"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .enumerate()
        .filter_map(|(index, exercise)| {
            Some(WorkoutExercise {
                exercise_id: exercise["exerciseId"].as_str()?.to_string(),
                name: exercise["name"].as_str()?.to_string(),
                sets: exercise["sets"].as_u64()? as i32,
                reps: exercise["reps"].as_u64().map(|r| r as i32),
                duration_seconds: exercise["durationSeconds"].as_u64().map(|d| d as i32),
                weight: exercise["weight"].as_f64().map(|w| w as f32),
                rest_seconds: exercise["restSeconds"].as_u64().map(|r| r as i32),
                notes: exercise["notes"].as_str().map(|s| s.to_string()),
                order: index as i32,
            })
        })
        .collect();

    let updated_plan = WorkoutPlan {
        id: plan_id,
        user_id,
        name,
        description: payload["body"]["description"].as_str().map(|s| s.to_string()),
        difficulty,
        duration_weeks: duration_weeks as i32,
        frequency_per_week: frequency_per_week as i32,
        exercises,
        created_at: payload["body"]["createdAt"].as_str().unwrap_or("").to_string(),
        updated_at: Utc::now().to_rfc3339(),
        is_active: payload["body"]["isActive"].as_bool().unwrap_or(true),
    };

    match update_workout_plan_in_db(&updated_plan, dynamodb_client).await {
        Ok(plan) => create_response(200, plan),
        Err(e) => create_response(500, json!({"message": format!("Failed to update workout plan: {}", e)})),
    }
}

pub async fn delete_workout_plan_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let plan_id = payload["pathParameters"]["planId"].as_str().unwrap_or("");

    if plan_id.is_empty() {
        return create_response(400, json!({"message": "Plan ID is required"}));
    }

    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    match delete_workout_plan_from_db(user_id, plan_id, dynamodb_client).await {
        Ok(_) => create_response(200, json!({"message": "Workout plan deleted successfully"})),
        Err(e) => create_response(500, json!({"message": format!("Failed to delete workout plan: {}", e)})),
    }
}

// Workout Session Handlers
pub async fn get_workout_sessions_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_workout_sessions_from_db(user_id, dynamodb_client).await {
        Ok(sessions) => create_response(200, sessions),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve workout sessions: {}", e)})),
    }
}

pub async fn create_workout_session_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let session_id = Uuid::new_v4().to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let name = payload["body"]["name"].as_str().unwrap_or("").to_string();

    if user_id.is_empty() || name.is_empty() {
        return create_response(400, json!({"message": "User ID and name are required"}));
    }

    let exercises: Vec<SessionExercise> = payload["body"]["exercises"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .enumerate()
        .filter_map(|(index, exercise)| {
            let sets: Vec<ExerciseSet> = exercise["sets"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .enumerate()
                .filter_map(|(set_index, set)| {
                    Some(ExerciseSet {
                        set_number: (set_index + 1) as i32,
                        reps: set["reps"].as_u64().map(|r| r as i32),
                        weight: set["weight"].as_f64().map(|w| w as f32),
                        duration_seconds: set["durationSeconds"].as_u64().map(|d| d as i32),
                        rest_seconds: set["restSeconds"].as_u64().map(|r| r as i32),
                        completed: set["completed"].as_bool().unwrap_or(false),
                        notes: set["notes"].as_str().map(|s| s.to_string()),
                    })
                })
                .collect();

            Some(SessionExercise {
                exercise_id: exercise["exerciseId"].as_str()?.to_string(),
                name: exercise["name"].as_str()?.to_string(),
                sets,
                notes: exercise["notes"].as_str().map(|s| s.to_string()),
                order: index as i32,
            })
        })
        .collect();

    let new_session = WorkoutSession {
        id: session_id.clone(),
        user_id,
        workout_plan_id: payload["body"]["workoutPlanId"].as_str().map(|s| s.to_string()),
        name,
        started_at: Utc::now().to_rfc3339(),
        completed_at: None,
        duration_minutes: None,
        notes: payload["body"]["notes"].as_str().map(|s| s.to_string()),
        rating: None,
        exercises,
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
    };

    match create_workout_session_in_db(&new_session, dynamodb_client).await {
        Ok(session) => create_response(201, session),
        Err(e) => create_response(500, json!({"message": format!("Failed to create workout session: {}", e)})),
    }
}

pub async fn get_workout_session_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let session_id = payload["pathParameters"]["sessionId"].as_str().unwrap_or("");

    if session_id.is_empty() {
        return create_response(400, json!({"message": "Session ID is required"}));
    }

    match get_workout_session_from_db(session_id, dynamodb_client).await {
        Ok(session) => create_response(200, session),
        Err(e) => create_response(404, json!({"message": format!("Workout session not found: {}", e)})),
    }
}

pub async fn update_workout_session_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let session_id = payload["body"]["id"].as_str().unwrap_or("").to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let name = payload["body"]["name"].as_str().unwrap_or("").to_string();

    if session_id.is_empty() || user_id.is_empty() || name.is_empty() {
        return create_response(400, json!({"message": "Session ID, User ID, and name are required"}));
    }

    let exercises: Vec<SessionExercise> = payload["body"]["exercises"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .enumerate()
        .filter_map(|(index, exercise)| {
            let sets: Vec<ExerciseSet> = exercise["sets"]
                .as_array()
                .unwrap_or(&vec![])
                .iter()
                .enumerate()
                .filter_map(|(set_index, set)| {
                    Some(ExerciseSet {
                        set_number: (set_index + 1) as i32,
                        reps: set["reps"].as_u64().map(|r| r as i32),
                        weight: set["weight"].as_f64().map(|w| w as f32),
                        duration_seconds: set["durationSeconds"].as_u64().map(|d| d as i32),
                        rest_seconds: set["restSeconds"].as_u64().map(|r| r as i32),
                        completed: set["completed"].as_bool().unwrap_or(false),
                        notes: set["notes"].as_str().map(|s| s.to_string()),
                    })
                })
                .collect();

            Some(SessionExercise {
                exercise_id: exercise["exerciseId"].as_str()?.to_string(),
                name: exercise["name"].as_str()?.to_string(),
                sets,
                notes: exercise["notes"].as_str().map(|s| s.to_string()),
                order: index as i32,
            })
        })
        .collect();

    let updated_session = WorkoutSession {
        id: session_id,
        user_id,
        workout_plan_id: payload["body"]["workoutPlanId"].as_str().map(|s| s.to_string()),
        name,
        started_at: payload["body"]["startedAt"].as_str().unwrap_or("").to_string(),
        completed_at: payload["body"]["completedAt"].as_str().map(|s| s.to_string()),
        duration_minutes: payload["body"]["durationMinutes"].as_u64().map(|d| d as i32),
        notes: payload["body"]["notes"].as_str().map(|s| s.to_string()),
        rating: payload["body"]["rating"].as_u64().map(|r| r as i32),
        exercises,
        created_at: payload["body"]["createdAt"].as_str().unwrap_or("").to_string(),
        updated_at: Utc::now().to_rfc3339(),
    };

    match update_workout_session_in_db(&updated_session, dynamodb_client).await {
        Ok(session) => create_response(200, session),
        Err(e) => create_response(500, json!({"message": format!("Failed to update workout session: {}", e)})),
    }
}

pub async fn delete_workout_session_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let session_id = payload["pathParameters"]["sessionId"].as_str().unwrap_or("");

    if session_id.is_empty() {
        return create_response(400, json!({"message": "Session ID is required"}));
    }

    match delete_workout_session_from_db(session_id, dynamodb_client).await {
        Ok(_) => create_response(200, json!({"message": "Workout session deleted successfully"})),
        Err(e) => create_response(500, json!({"message": format!("Failed to delete workout session: {}", e)})),
    }
}

// Exercise Handlers
pub async fn get_exercises_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    match get_exercises_from_db(dynamodb_client).await {
        Ok(exercises) => create_response(200, exercises),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve exercises: {}", e)})),
    }
}

pub async fn create_exercise_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let exercise_id = Uuid::new_v4().to_string();
    let name = payload["body"]["name"].as_str().unwrap_or("").to_string();
    let category = payload["body"]["category"].as_str().unwrap_or("").to_string();
    let difficulty = payload["body"]["difficulty"].as_str().unwrap_or("beginner").to_string();

    if name.is_empty() || category.is_empty() {
        return create_response(400, json!({"message": "Name and category are required"}));
    }

    let muscle_groups: Vec<String> = payload["body"]["muscleGroups"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let equipment: Vec<String> = payload["body"]["equipment"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let instructions: Vec<String> = payload["body"]["instructions"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let new_exercise = Exercise {
        id: exercise_id.clone(),
        name,
        description: payload["body"]["description"].as_str().map(|s| s.to_string()),
        category,
        muscle_groups,
        equipment,
        difficulty,
        instructions,
        tips: payload["body"]["tips"].as_str().map(|s| s.to_string()),
        video_url: payload["body"]["videoUrl"].as_str().map(|s| s.to_string()),
        image_url: payload["body"]["imageUrl"].as_str().map(|s| s.to_string()),
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
    };

    match create_exercise_in_db(&new_exercise, dynamodb_client).await {
        Ok(exercise) => create_response(201, exercise),
        Err(e) => create_response(500, json!({"message": format!("Failed to create exercise: {}", e)})),
    }
}

pub async fn get_exercise_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let exercise_id = payload["pathParameters"]["exerciseId"].as_str().unwrap_or("");

    if exercise_id.is_empty() {
        return create_response(400, json!({"message": "Exercise ID is required"}));
    }

    match get_exercise_from_db(exercise_id, dynamodb_client).await {
        Ok(exercise) => create_response(200, exercise),
        Err(e) => create_response(404, json!({"message": format!("Exercise not found: {}", e)})),
    }
}

pub async fn update_exercise_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let exercise_id = payload["body"]["id"].as_str().unwrap_or("").to_string();
    let name = payload["body"]["name"].as_str().unwrap_or("").to_string();
    let category = payload["body"]["category"].as_str().unwrap_or("").to_string();
    let difficulty = payload["body"]["difficulty"].as_str().unwrap_or("beginner").to_string();

    if exercise_id.is_empty() || name.is_empty() || category.is_empty() {
        return create_response(400, json!({"message": "Exercise ID, name, and category are required"}));
    }

    let muscle_groups: Vec<String> = payload["body"]["muscleGroups"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let equipment: Vec<String> = payload["body"]["equipment"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let instructions: Vec<String> = payload["body"]["instructions"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let updated_exercise = Exercise {
        id: exercise_id,
        name,
        description: payload["body"]["description"].as_str().map(|s| s.to_string()),
        category,
        muscle_groups,
        equipment,
        difficulty,
        instructions,
        tips: payload["body"]["tips"].as_str().map(|s| s.to_string()),
        video_url: payload["body"]["videoUrl"].as_str().map(|s| s.to_string()),
        image_url: payload["body"]["imageUrl"].as_str().map(|s| s.to_string()),
        created_at: payload["body"]["createdAt"].as_str().unwrap_or("").to_string(),
        updated_at: Utc::now().to_rfc3339(),
    };

    match update_exercise_in_db(&updated_exercise, dynamodb_client).await {
        Ok(exercise) => create_response(200, exercise),
        Err(e) => create_response(500, json!({"message": format!("Failed to update exercise: {}", e)})),
    }
}

pub async fn delete_exercise_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let exercise_id = payload["pathParameters"]["exerciseId"].as_str().unwrap_or("");

    if exercise_id.is_empty() {
        return create_response(400, json!({"message": "Exercise ID is required"}));
    }

    match delete_exercise_from_db(exercise_id, dynamodb_client).await {
        Ok(_) => create_response(200, json!({"message": "Exercise deleted successfully"})),
        Err(e) => create_response(500, json!({"message": format!("Failed to delete exercise: {}", e)})),
    }
}

// Progress Photo Handlers
pub async fn get_progress_photos_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_progress_photos_from_db(user_id, dynamodb_client).await {
        Ok(photos) => create_response(200, photos),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve progress photos: {}", e)})),
    }
}

pub async fn delete_progress_photo_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
    s3_client: &S3Client,
) -> Result<Value, Error> {
    let photo_id = payload["pathParameters"]["photoId"].as_str().unwrap_or("");

    if photo_id.is_empty() {
        return create_response(400, json!({"message": "Photo ID is required"}));
    }

    match delete_progress_photo_from_db(photo_id, dynamodb_client, s3_client).await {
        Ok(_) => create_response(200, json!({"message": "Progress photo deleted successfully"})),
        Err(e) => create_response(500, json!({"message": format!("Failed to delete progress photo: {}", e)})),
    }
}

// Analytics Handlers
pub async fn get_workout_analytics_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_workout_analytics_from_db(user_id, dynamodb_client).await {
        Ok(analytics) => create_response(200, analytics),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve workout analytics: {}", e)})),
    }
}

pub async fn get_workout_history_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_workout_history_from_db(user_id, dynamodb_client).await {
        Ok(history) => create_response(200, history),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve workout history: {}", e)})),
    }
}

// Log Activity Handler
pub async fn log_activity_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let body: Value = serde_json::from_str(
        payload.get("body")
            .ok_or("Missing body")?
            .as_str()
            .ok_or("Body is not a string")?,
    )?;

    let activity_type = body.get("activityType")
        .and_then(|v| v.as_str())
        .ok_or("Missing activityType")?;
    let duration = body.get("duration")
        .and_then(|v| v.as_u64())
        .ok_or("Missing duration")?;
    let calories_burned = body.get("caloriesBurned")
        .and_then(|v| v.as_u64())
        .ok_or("Missing caloriesBurned")?;
    let notes = body.get("notes")
        .and_then(|v| v.as_str())
        .unwrap_or("");

    // Create a new workout session for the logged activity
    let session_id = format!("activity_{}", chrono::Utc::now().timestamp_millis());
    let user_id = payload["requestContext"]["authorizer"]["userId"]
        .as_str()
        .ok_or("Missing userId in auth context")?;

    let workout_session = WorkoutSession {
        id: session_id.clone(),
        user_id: user_id.to_string(),
        workout_plan_id: None,
        name: format!("{} Activity", activity_type),
        started_at: chrono::Utc::now().to_rfc3339(),
        completed_at: Some(chrono::Utc::now().to_rfc3339()),
        duration_minutes: Some(duration as i32),
        notes: Some(format!("Activity: {} | Calories: {} | Notes: {}", activity_type, calories_burned, notes)),
        exercises: vec![],
        rating: None,
        created_at: chrono::Utc::now().to_rfc3339(),
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    // Save to database using the existing database function
    let table_name = std::env::var("WORKOUTS_TABLE_NAME")
        .expect("WORKOUTS_TABLE_NAME environment variable not set");
    
    // Create a simple item for DynamoDB
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(format!("USER#{}", user_id)));
    item.insert("SK".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(format!("SESSION#{}", session_id)));
    item.insert("id".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(session_id.clone()));
    item.insert("user_id".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(user_id.to_string()));
    item.insert("name".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(format!("{} Activity", activity_type)));
    item.insert("started_at".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(chrono::Utc::now().to_rfc3339()));
    item.insert("completed_at".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(chrono::Utc::now().to_rfc3339()));
    item.insert("duration_minutes".to_string(), aws_sdk_dynamodb::types::AttributeValue::N(duration.to_string()));
    item.insert("notes".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(format!("Activity: {} | Calories: {} | Notes: {}", activity_type, calories_burned, notes)));
    item.insert("created_at".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(chrono::Utc::now().to_rfc3339()));
    item.insert("updated_at".to_string(), aws_sdk_dynamodb::types::AttributeValue::S(chrono::Utc::now().to_rfc3339()));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;

    let response = json!({
        "id": session_id,
        "message": "Activity logged successfully",
        "activityType": activity_type,
        "duration": duration,
        "caloriesBurned": calories_burned
    });

    create_response(201, response)
}