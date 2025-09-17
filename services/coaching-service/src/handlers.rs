use serde_json::{json, Value};
use lambda_runtime::Error;
use aws_sdk_dynamodb::Client as DynamoDbClient;
use chrono::Utc;
use uuid::Uuid;

use crate::models::*;
use crate::database::*;
use auth_layer::AuthContext;

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

// Workout Recommendation Handlers
pub async fn get_workout_recommendations_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
    auth_context: &AuthContext,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_workout_recommendations_from_db(user_id, dynamodb_client).await {
        Ok(recommendations) => create_response(200, recommendations),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve workout recommendations: {}", e)})),
    }
}

pub async fn create_workout_recommendation_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let recommendation_id = Uuid::new_v4().to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let recommendation_type = payload["body"]["recommendationType"].as_str().unwrap_or("").to_string();
    let title = payload["body"]["title"].as_str().unwrap_or("").to_string();
    let description = payload["body"]["description"].as_str().unwrap_or("").to_string();
    let reasoning = payload["body"]["reasoning"].as_str().unwrap_or("").to_string();
    let priority = payload["body"]["priority"].as_u64().unwrap_or(3) as u32;

    if user_id.is_empty() || recommendation_type.is_empty() || title.is_empty() {
        return create_response(400, json!({"message": "User ID, recommendation type, and title are required"}));
    }

    let new_recommendation = WorkoutRecommendation {
        id: recommendation_id.clone(),
        user_id,
        recommendation_type,
        title,
        description,
        reasoning,
        priority,
        created_at: Utc::now().to_rfc3339(),
        expires_at: payload["body"]["expiresAt"].as_str().map(|s| s.to_string()),
        is_applied: false,
        metadata: payload["body"]["metadata"].clone(),
    };

    match create_workout_recommendation_in_db(&new_recommendation, dynamodb_client).await {
        Ok(recommendation) => create_response(201, recommendation),
        Err(e) => create_response(500, json!({"message": format!("Failed to create workout recommendation: {}", e)})),
    }
}

// Adaptive Plan Handlers
pub async fn get_adaptive_plans_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_adaptive_plans_from_db(user_id, dynamodb_client).await {
        Ok(plans) => create_response(200, plans),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve adaptive plans: {}", e)})),
    }
}

pub async fn create_adaptive_plan_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let plan_id = Uuid::new_v4().to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let base_plan_id = payload["body"]["basePlanId"].as_str().unwrap_or("").to_string();
    let adaptation_reason = payload["body"]["adaptationReason"].as_str().unwrap_or("").to_string();

    if user_id.is_empty() || base_plan_id.is_empty() {
        return create_response(400, json!({"message": "User ID and base plan ID are required"}));
    }

    let adaptations: Vec<PlanAdaptation> = payload["body"]["adaptations"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|adaptation| {
            Some(PlanAdaptation {
                exercise_id: adaptation["exerciseId"].as_str()?.to_string(),
                adaptation_type: adaptation["adaptationType"].as_str()?.to_string(),
                original_exercise: adaptation["originalExercise"].as_object().and_then(|_| serde_json::from_value(adaptation["originalExercise"].clone()).ok()),
                new_exercise: adaptation["newExercise"].as_object().and_then(|_| serde_json::from_value(adaptation["newExercise"].clone()).ok()),
                modifications: adaptation["modifications"].as_object().and_then(|_| serde_json::from_value(adaptation["modifications"].clone()).ok()),
                reason: adaptation["reason"].as_str()?.to_string(),
            })
        })
        .collect();

    let new_plan = AdaptivePlan {
        id: plan_id.clone(),
        user_id,
        base_plan_id,
        adaptations,
        adaptation_reason,
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
        is_active: true,
    };

    match create_adaptive_plan_in_db(&new_plan, dynamodb_client).await {
        Ok(plan) => create_response(201, plan),
        Err(e) => create_response(500, json!({"message": format!("Failed to create adaptive plan: {}", e)})),
    }
}

// Exercise Substitution Handlers
pub async fn get_exercise_substitutions_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_exercise_substitutions_from_db(user_id, dynamodb_client).await {
        Ok(substitutions) => create_response(200, substitutions),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve exercise substitutions: {}", e)})),
    }
}

pub async fn suggest_exercise_substitution_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let original_exercise_id = payload["body"]["originalExerciseId"].as_str().unwrap_or("").to_string();
    let reason = payload["body"]["reason"].as_str().unwrap_or("").to_string();

    if user_id.is_empty() || original_exercise_id.is_empty() {
        return create_response(400, json!({"message": "User ID and original exercise ID are required"}));
    }

    // This is a simplified version - in a real implementation, you would:
    // 1. Analyze the user's fitness profile
    // 2. Find exercises that target similar muscle groups
    // 3. Check equipment availability
    // 4. Consider difficulty level
    // 5. Calculate confidence score based on various factors

    let substitution = ExerciseSubstitution {
        original_exercise_id: original_exercise_id.clone(),
        substitute_exercise_id: "substitute_exercise_123".to_string(), // This would be determined by the algorithm
        reason: reason.clone(),
        confidence_score: 0.85, // This would be calculated by the algorithm
        muscle_groups_match: vec!["chest".to_string(), "shoulders".to_string()],
        equipment_available: true,
        difficulty_match: true,
    };

    create_response(200, json!(substitution))
}

// Recovery Plan Handlers
pub async fn get_recovery_plans_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_recovery_plans_from_db(user_id, dynamodb_client).await {
        Ok(plans) => create_response(200, plans),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve recovery plans: {}", e)})),
    }
}

pub async fn create_recovery_plan_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let plan_id = Uuid::new_v4().to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let plan_type = payload["body"]["planType"].as_str().unwrap_or("").to_string();
    let duration_days = payload["body"]["durationDays"].as_u64().unwrap_or(1) as u32;

    if user_id.is_empty() || plan_type.is_empty() {
        return create_response(400, json!({"message": "User ID and plan type are required"}));
    }

    let activities: Vec<RecoveryActivity> = payload["body"]["activities"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .enumerate()
        .filter_map(|(index, activity)| {
            Some(RecoveryActivity {
                id: Uuid::new_v4().to_string(),
                name: activity["name"].as_str()?.to_string(),
                activity_type: activity["activityType"].as_str()?.to_string(),
                duration_minutes: activity["durationMinutes"].as_u64()? as u32,
                intensity: activity["intensity"].as_str()?.to_string(),
                instructions: activity["instructions"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect(),
                equipment_needed: activity["equipmentNeeded"]
                    .as_array()
                    .unwrap_or(&vec![])
                    .iter()
                    .filter_map(|v| v.as_str().map(|s| s.to_string()))
                    .collect(),
                order: index as u32,
            })
        })
        .collect();

    let starts_at = Utc::now().to_rfc3339();
    let ends_at = (Utc::now() + chrono::Duration::days(duration_days as i64)).to_rfc3339();

    let new_plan = RecoveryPlan {
        id: plan_id.clone(),
        user_id,
        plan_type,
        duration_days,
        activities,
        created_at: Utc::now().to_rfc3339(),
        starts_at,
        ends_at,
        is_completed: false,
    };

    // Store in database (simplified - would need proper database operations)
    create_response(201, json!(new_plan))
}

// User Fitness Profile Handlers
pub async fn get_user_fitness_profile_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    match get_user_fitness_profile_from_db(user_id, dynamodb_client).await {
        Ok(profile) => create_response(200, profile),
        Err(e) => create_response(404, json!({"message": format!("User fitness profile not found: {}", e)})),
    }
}

pub async fn update_user_fitness_profile_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let experience_level = payload["body"]["experienceLevel"].as_str().unwrap_or("beginner").to_string();

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    let fitness_goals: Vec<String> = payload["body"]["fitnessGoals"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|v| v.as_str().map(|s| s.to_string()))
        .collect();

    let preferences = UserPreferences {
        workout_duration_preference: payload["body"]["preferences"]["workoutDurationPreference"].as_u64().unwrap_or(60) as u32,
        frequency_preference: payload["body"]["preferences"]["frequencyPreference"].as_u64().unwrap_or(3) as u32,
        intensity_preference: payload["body"]["preferences"]["intensityPreference"].as_str().unwrap_or("moderate").to_string(),
        equipment_available: payload["body"]["preferences"]["equipmentAvailable"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        time_of_day_preference: payload["body"]["preferences"]["timeOfDayPreference"].as_str().unwrap_or("evening").to_string(),
        workout_types: payload["body"]["preferences"]["workoutTypes"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        avoid_exercises: payload["body"]["preferences"]["avoidExercises"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        preferred_exercises: payload["body"]["preferences"]["preferredExercises"]
            .as_array()
            .unwrap_or(&vec![])
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
    };

    let updated_profile = UserFitnessProfile {
        user_id: user_id.clone(),
        experience_level,
        fitness_goals,
        current_strength_levels: std::collections::HashMap::new(), // Would be populated from actual data
        recent_performance: vec![],
        injury_history: vec![],
        preferences,
        last_updated: Utc::now().to_rfc3339(),
    };

    match update_user_fitness_profile_in_db(&updated_profile, dynamodb_client).await {
        Ok(profile) => create_response(200, profile),
        Err(e) => create_response(500, json!({"message": format!("Failed to update user fitness profile: {}", e)})),
    }
}

// Coaching Rules Handlers
pub async fn get_coaching_rules_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    match get_coaching_rules_from_db(dynamodb_client).await {
        Ok(rules) => create_response(200, rules),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve coaching rules: {}", e)})),
    }
}

// Progress Metrics Handlers
pub async fn get_progress_metrics_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["queryStringParameters"]["userId"]
        .as_str()
        .map(|s| s.to_string());

    match get_progress_metrics_from_db(user_id, dynamodb_client).await {
        Ok(metrics) => create_response(200, metrics),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve progress metrics: {}", e)})),
    }
}

// AI-Powered Recommendation Handlers
pub async fn generate_workout_recommendations_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let recommendation_type = payload["body"]["recommendationType"].as_str().unwrap_or("workout_plan").to_string();

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    // This is a simplified version - in a real implementation, you would:
    // 1. Analyze user's fitness profile
    // 2. Consider recent workout performance
    // 3. Apply coaching rules
    // 4. Generate personalized recommendations
    // 5. Calculate confidence scores

    let recommendations = vec![
        WorkoutRecommendation {
            id: Uuid::new_v4().to_string(),
            user_id: user_id.clone(),
            recommendation_type: recommendation_type.clone(),
            title: "Increase Workout Frequency".to_string(),
            description: "Based on your recent performance, consider increasing your workout frequency to 4 times per week.".to_string(),
            reasoning: "Your completion rate is consistently high and you're recovering well between sessions.".to_string(),
            priority: 4,
            created_at: Utc::now().to_rfc3339(),
            expires_at: Some((Utc::now() + chrono::Duration::days(7)).to_rfc3339()),
            is_applied: false,
            metadata: json!({
                "confidence_score": 0.85,
                "impact_level": "medium",
                "category": "progression"
            }),
        },
        WorkoutRecommendation {
            id: Uuid::new_v4().to_string(),
            user_id: user_id.clone(),
            recommendation_type: "exercise_substitution".to_string(),
            title: "Substitute Barbell Bench Press".to_string(),
            description: "Consider substituting barbell bench press with dumbbell bench press to improve muscle balance.".to_string(),
            reasoning: "Your form analysis shows slight asymmetry in barbell movements.".to_string(),
            priority: 3,
            created_at: Utc::now().to_rfc3339(),
            expires_at: Some((Utc::now() + chrono::Duration::days(14)).to_rfc3339()),
            is_applied: false,
            metadata: json!({
                "confidence_score": 0.72,
                "impact_level": "low",
                "category": "form_improvement"
            }),
        },
    ];

    create_response(200, json!(recommendations))
}

pub async fn analyze_workout_performance_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let workout_data = &payload["body"]["workoutData"];

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    // This is a simplified version - in a real implementation, you would:
    // 1. Analyze workout completion rates
    // 2. Check form ratings
    // 3. Compare to previous workouts
    // 4. Identify patterns and trends
    // 5. Generate insights and recommendations

    let analysis = json!({
        "user_id": user_id,
        "workout_id": workout_data["workoutId"],
        "completion_rate": 0.95,
        "form_score": 4.2,
        "difficulty_rating": 3.8,
        "strength_progress": 0.05,
        "insights": [
            "Excellent completion rate - consider increasing difficulty",
            "Form is good but could be improved on squats",
            "Strong progress on upper body exercises"
        ],
        "recommendations": [
            "Increase weight by 5% on deadlifts",
            "Focus on squat form during warm-up",
            "Add one more set to bicep exercises"
        ],
        "next_workout_adjustments": {
            "difficulty_increase": 0.05,
            "exercise_modifications": [
                {
                    "exercise_id": "squats",
                    "modification": "add_form_cues",
                    "priority": "high"
                }
            ]
        }
    });

    create_response(200, analysis)
}
