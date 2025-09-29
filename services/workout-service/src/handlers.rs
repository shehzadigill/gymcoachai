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
        // Enhanced features with defaults
        tags: payload["body"]["tags"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()),
        rating: payload["body"]["rating"].as_f64().map(|r| r as f32),
        is_template: payload["body"]["isTemplate"].as_bool(),
        total_sessions: Some((duration_weeks * frequency_per_week) as i32),
        completed_sessions: Some(0),
        next_scheduled_date: None,
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
        // Enhanced features with defaults or from payload
        tags: payload["body"]["tags"]
            .as_array()
            .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect()),
        rating: payload["body"]["rating"].as_f64().map(|r| r as f32),
        is_template: payload["body"]["isTemplate"].as_bool(),
        total_sessions: payload["body"]["totalSessions"].as_i64().map(|t| t as i32),
        completed_sessions: payload["body"]["completedSessions"].as_i64().map(|c| c as i32),
        next_scheduled_date: payload["body"]["nextScheduledDate"].as_str().map(|s| s.to_string()),
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
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_exercises_from_db_with_user(user_id, dynamodb_client).await {
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
    let user_id = payload["body"]["userId"].as_str().map(|s| s.to_string());

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

    let tags: Vec<String> = payload["body"]["tags"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let is_system = user_id.is_none() || tags.contains(&"system".to_string());

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
        created_by: user_id,
        is_system,
        tags,
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

    // Check if it's a system exercise - prevent editing
    match get_exercise_from_db(&exercise_id, dynamodb_client).await {
        Ok(exercise_data) => {
            if let Ok(exercise) = serde_json::from_value::<Exercise>(exercise_data) {
                if exercise.is_system {
                    return create_response(403, json!({"message": "Cannot edit system exercises. You can clone them to create a custom version."}));
                }
            }
        }
        Err(_) => return create_response(404, json!({"message": "Exercise not found"})),
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

    let tags: Vec<String> = payload["body"]["tags"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let user_id = payload["body"]["userId"].as_str().map(|s| s.to_string());
    let is_system = user_id.is_none() || tags.contains(&"system".to_string());

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
        created_by: user_id,
        is_system,
        tags,
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

    // Check if it's a system exercise - prevent deletion
    match get_exercise_from_db(exercise_id, dynamodb_client).await {
        Ok(exercise_data) => {
            if let Ok(exercise) = serde_json::from_value::<Exercise>(exercise_data) {
                if exercise.is_system {
                    return create_response(403, json!({"message": "Cannot delete system exercises. You can clone them instead."}));
                }
            }
        }
        Err(_) => return create_response(404, json!({"message": "Exercise not found"})),
    }

    match delete_exercise_from_db(exercise_id, dynamodb_client).await {
        Ok(_) => create_response(200, json!({"message": "Exercise deleted successfully"})),
        Err(e) => create_response(500, json!({"message": format!("Failed to delete exercise: {}", e)})),
    }
}

pub async fn clone_exercise_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let exercise_id = payload["pathParameters"]["exerciseId"].as_str().unwrap_or("");
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();

    if exercise_id.is_empty() || user_id.is_empty() {
        return create_response(400, json!({"message": "Exercise ID and User ID are required"}));
    }

    // Get the original exercise
    match get_exercise_from_db(exercise_id, dynamodb_client).await {
        Ok(exercise_data) => {
            if let Ok(original_exercise) = serde_json::from_value::<Exercise>(exercise_data) {
                // Create a new exercise based on the original
                let cloned_exercise = Exercise {
                    id: Uuid::new_v4().to_string(),
                    name: format!("{} (Custom)", original_exercise.name),
                    description: original_exercise.description.map(|d| format!("{} (Modified)", d)),
                    category: original_exercise.category,
                    muscle_groups: original_exercise.muscle_groups,
                    equipment: original_exercise.equipment,
                    difficulty: original_exercise.difficulty,
                    instructions: original_exercise.instructions,
                    tips: original_exercise.tips,
                    video_url: original_exercise.video_url,
                    image_url: original_exercise.image_url,
                    created_by: Some(user_id),
                    is_system: false,
                    tags: vec!["custom".to_string(), "cloned".to_string()],
                    created_at: Utc::now().to_rfc3339(),
                    updated_at: Utc::now().to_rfc3339(),
                };

                match create_exercise_in_db(&cloned_exercise, dynamodb_client).await {
                    Ok(exercise) => create_response(201, exercise),
                    Err(e) => create_response(500, json!({"message": format!("Failed to clone exercise: {}", e)})),
                }
            } else {
                create_response(500, json!({"message": "Failed to parse exercise data"}))
            }
        }
        Err(e) => create_response(404, json!({"message": format!("Exercise not found: {}", e)})),
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

// Scheduling Handlers
pub async fn schedule_workout_plan_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let plan_id = payload["pathParameters"]["planId"].as_str().unwrap_or("");
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let start_date = payload["body"]["startDate"].as_str().unwrap_or("").to_string();
    let times = payload["body"]["times"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|t| t.as_str())
        .map(|s| s.to_string())
        .collect::<Vec<String>>();

    if user_id.is_empty() || plan_id.is_empty() || start_date.is_empty() || times.is_empty() {
        return create_response(400, json!({"message": "Missing required fields: userId, planId, startDate, and times"}));
    }

    // Get the workout plan to extract duration and frequency
    let plan_response = get_workout_plan_from_db(&user_id, plan_id, dynamodb_client).await;
    let plan_data = match plan_response {
        Ok(data) => data,
        Err(e) => return create_response(404, json!({"message": format!("Workout plan not found: {}", e)})),
    };

    let duration_weeks = plan_data["duration_weeks"].as_i64().unwrap_or(4) as i32;
    let frequency_per_week = plan_data["frequency_per_week"].as_i64().unwrap_or(3) as i32;
    let plan_name = plan_data["name"].as_str().unwrap_or("Workout Plan").to_string();

    // Generate scheduled workouts
    let mut scheduled_workouts = Vec::new();
    let start_date_parsed = chrono::NaiveDate::parse_from_str(&start_date, "%Y-%m-%d")
        .map_err(|_| lambda_runtime::Error::from("Invalid start date format"))?;

    for week in 1..=duration_weeks {
        for day in 0..frequency_per_week {
            let schedule_id = Uuid::new_v4().to_string();
            let workout_date = start_date_parsed + chrono::Duration::days((week - 1) as i64 * 7 + day as i64 * (7 / frequency_per_week.max(1)) as i64);
            let time_index = (day as usize) % times.len();
            
            let scheduled_workout = ScheduledWorkout {
                id: schedule_id,
                plan_id: plan_id.to_string(),
                user_id: user_id.clone(),
                plan_name: format!("{} - Week {} Day {}", plan_name, week, day + 1),
                scheduled_date: workout_date.format("%Y-%m-%d").to_string(),
                scheduled_time: times[time_index].clone(),
                status: "scheduled".to_string(),
                week,
                day: day + 1,
                notes: None,
                completed_at: None,
                created_at: Utc::now().to_rfc3339(),
                updated_at: Utc::now().to_rfc3339(),
            };

            match create_scheduled_workout_in_db(&scheduled_workout, dynamodb_client).await {
                Ok(_) => scheduled_workouts.push(scheduled_workout),
                Err(e) => {
                    return create_response(500, json!({"message": format!("Failed to create scheduled workout: {}", e)}));
                }
            }
        }
    }

    create_response(201, json!({
        "message": "Workout plan scheduled successfully",
        "scheduledWorkouts": scheduled_workouts
    }))
}

pub async fn get_scheduled_workouts_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_scheduled_workouts_from_db(user_id, dynamodb_client).await {
        Ok(scheduled_workouts) => create_response(200, scheduled_workouts),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve scheduled workouts: {}", e)})),
    }
}

pub async fn update_scheduled_workout_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let schedule_id = payload["pathParameters"]["scheduleId"].as_str().unwrap_or("");
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let status = payload["body"]["status"].as_str().unwrap_or("scheduled").to_string();
    let notes = payload["body"]["notes"].as_str().map(|s| s.to_string());
    let completed_at = if status == "completed" {
        Some(Utc::now().to_rfc3339())
    } else {
        None
    };

    if user_id.is_empty() || schedule_id.is_empty() {
        return create_response(400, json!({"message": "Missing required fields: userId and scheduleId"}));
    }

    // Create updated scheduled workout object
    let updated_scheduled_workout = ScheduledWorkout {
        id: schedule_id.to_string(),
        plan_id: "".to_string(), // Will be filled from existing record
        user_id: user_id.clone(),
        plan_name: "".to_string(), // Will be filled from existing record
        scheduled_date: "".to_string(), // Will be filled from existing record
        scheduled_time: "".to_string(), // Will be filled from existing record
        status,
        week: 0, // Will be filled from existing record
        day: 0, // Will be filled from existing record
        notes,
        completed_at,
        created_at: "".to_string(), // Will be filled from existing record
        updated_at: Utc::now().to_rfc3339(),
    };

    match update_scheduled_workout_in_db(&updated_scheduled_workout, dynamodb_client).await {
        Ok(result) => create_response(200, result),
        Err(e) => create_response(500, json!({"message": format!("Failed to update scheduled workout: {}", e)})),
    }
}

pub async fn delete_scheduled_workout_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let schedule_id = payload["pathParameters"]["scheduleId"].as_str().unwrap_or("");
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .unwrap_or("");

    if user_id.is_empty() || schedule_id.is_empty() {
        return create_response(400, json!({"message": "Missing required fields: userId and scheduleId"}));
    }

    match delete_scheduled_workout_from_db(user_id, schedule_id, dynamodb_client).await {
        Ok(result) => create_response(200, result),
        Err(e) => create_response(500, json!({"message": format!("Failed to delete scheduled workout: {}", e)})),
    }
}