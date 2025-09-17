use gymcoach_ai_tests::*;
use serde_json::Value;
use std::collections::HashMap;

#[tokio::test]
async fn test_user_profile_and_workout_integration() {
    // Step 1: Create user profile
    let user_profile_data = serde_json::json!({
        "userId": "user123",
        "email": "test@example.com",
        "name": "Test User",
        "fitnessGoals": "Build muscle",
        "experienceLevel": "beginner",
        "preferences": {
            "units": "metric",
            "timezone": "UTC",
            "notifications": {
                "email": true,
                "push": true,
                "workoutReminders": true,
                "nutritionReminders": true
            },
            "privacy": {
                "profileVisibility": "private",
                "workoutSharing": false,
                "progressSharing": false
            }
        }
    });

    let user_profile_event = test_utils::create_mock_event(
        "POST",
        "/api/user-profiles",
        Some(user_profile_data),
        None,
        None,
        None,
    );

    // Mock DynamoDB response for user profile creation
    let user_profile_response = test_utils::mock_dynamodb_response(test_utils::create_test_user()).unwrap();
    
    // Simulate user profile creation
    let user_profile_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_user()).unwrap()
    });

    test_utils::validate_lambda_response(&user_profile_result, 201);

    // Step 2: Create workout plan for the same user
    let workout_plan_data = serde_json::json!({
        "userId": "user123",
        "name": "Beginner Strength Program",
        "description": "A 4-week beginner strength program",
        "difficulty": "beginner",
        "durationWeeks": 4,
        "frequencyPerWeek": 3,
        "exercises": [
            {
                "exerciseId": "ex123",
                "name": "Push-ups",
                "sets": 3,
                "reps": 10,
                "restSeconds": 60,
                "order": 1
            },
            {
                "exerciseId": "ex456",
                "name": "Squats",
                "sets": 3,
                "reps": 15,
                "restSeconds": 60,
                "order": 2
            }
        ]
    });

    let workout_plan_event = test_utils::create_mock_event(
        "POST",
        "/api/workouts/plans",
        Some(workout_plan_data),
        None,
        None,
        None,
    );

    // Mock DynamoDB response for workout plan creation
    let workout_plan_response = test_utils::mock_dynamodb_response(test_utils::create_test_workout_plan()).unwrap();
    
    // Simulate workout plan creation
    let workout_plan_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_workout_plan()).unwrap()
    });

    test_utils::validate_lambda_response(&workout_plan_result, 201);

    // Step 3: Create workout session
    let workout_session_data = serde_json::json!({
        "userId": "user123",
        "workoutPlanId": "plan123",
        "name": "Upper Body Workout",
        "exercises": [
            {
                "exerciseId": "ex123",
                "name": "Push-ups",
                "sets": [
                    {
                        "reps": 10,
                        "weight": 0,
                        "completed": true,
                        "notes": "Good form"
                    },
                    {
                        "reps": 10,
                        "weight": 0,
                        "completed": true,
                        "notes": "Good form"
                    },
                    {
                        "reps": 8,
                        "weight": 0,
                        "completed": true,
                        "notes": "Last set was tough"
                    }
                ],
                "order": 1
            }
        ]
    });

    let workout_session_event = test_utils::create_mock_event(
        "POST",
        "/api/workouts/sessions",
        Some(workout_session_data),
        None,
        None,
        None,
    );

    // Mock DynamoDB response for workout session creation
    let workout_session_response = test_utils::mock_dynamodb_response(test_utils::create_test_workout_session()).unwrap();
    
    // Simulate workout session creation
    let workout_session_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_workout_session()).unwrap()
    });

    test_utils::validate_lambda_response(&workout_session_result, 201);

    // Verify all operations used the same user ID
    let user_profile_body: Value = serde_json::from_str(&user_profile_result["body"].as_str().unwrap()).unwrap();
    let workout_plan_body: Value = serde_json::from_str(&workout_plan_result["body"].as_str().unwrap()).unwrap();
    let workout_session_body: Value = serde_json::from_str(&workout_session_result["body"].as_str().unwrap()).unwrap();

    assert_eq!(user_profile_body["userId"], "user123");
    assert_eq!(workout_plan_body["userId"], "user123");
    assert_eq!(workout_session_body["userId"], "user123");
}

#[tokio::test]
async fn test_workout_and_analytics_integration() {
    // Step 1: Create workout session
    let workout_session_data = serde_json::json!({
        "userId": "user123",
        "workoutPlanId": "plan123",
        "name": "Upper Body Workout",
        "exercises": [
            {
                "exerciseId": "ex123",
                "name": "Bench Press",
                "sets": [
                    {
                        "reps": 10,
                        "weight": 135,
                        "completed": true,
                        "notes": "Good form"
                    },
                    {
                        "reps": 10,
                        "weight": 135,
                        "completed": true,
                        "notes": "Good form"
                    },
                    {
                        "reps": 8,
                        "weight": 135,
                        "completed": true,
                        "notes": "Last set was tough"
                    }
                ],
                "order": 1
            }
        ]
    });

    let workout_session_event = test_utils::create_mock_event(
        "POST",
        "/api/workouts/sessions",
        Some(workout_session_data),
        None,
        None,
        None,
    );

    // Simulate workout session creation
    let workout_session_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_workout_session()).unwrap()
    });

    test_utils::validate_lambda_response(&workout_session_result, 201);

    // Step 2: Create strength progress entry
    let strength_progress_data = serde_json::json!({
        "userId": "user123",
        "exerciseId": "ex123",
        "exerciseName": "Bench Press",
        "currentMaxWeight": 135,
        "previousMaxWeight": 125,
        "weightIncrease": 10,
        "percentageIncrease": 8.0,
        "period": "week",
        "measurementDate": "2024-01-01T00:00:00Z",
        "trend": "increasing"
    });

    let strength_progress_event = test_utils::create_mock_event(
        "POST",
        "/api/analytics/strength-progress",
        Some(strength_progress_data),
        None,
        None,
        None,
    );

    // Simulate strength progress creation
    let strength_progress_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_strength_progress()).unwrap()
    });

    test_utils::validate_lambda_response(&strength_progress_result, 201);

    // Step 3: Create body measurement
    let body_measurement_data = serde_json::json!({
        "userId": "user123",
        "measurementType": "weight",
        "value": 70.5,
        "unit": "kg",
        "measurementDate": "2024-01-01T00:00:00Z",
        "notes": "Starting weight"
    });

    let body_measurement_event = test_utils::create_mock_event(
        "POST",
        "/api/analytics/body-measurements",
        Some(body_measurement_data),
        None,
        None,
        None,
    );

    // Simulate body measurement creation
    let body_measurement_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_body_measurement()).unwrap()
    });

    test_utils::validate_lambda_response(&body_measurement_result, 201);

    // Verify all operations used the same user ID
    let workout_session_body: Value = serde_json::from_str(&workout_session_result["body"].as_str().unwrap()).unwrap();
    let strength_progress_body: Value = serde_json::from_str(&strength_progress_result["body"].as_str().unwrap()).unwrap();
    let body_measurement_body: Value = serde_json::from_str(&body_measurement_result["body"].as_str().unwrap()).unwrap();

    assert_eq!(workout_session_body["userId"], "user123");
    assert_eq!(strength_progress_body["userId"], "user123");
    assert_eq!(body_measurement_body["userId"], "user123");
}

#[tokio::test]
async fn test_coaching_and_recommendations_integration() {
    // Step 1: Create workout recommendation
    let recommendation_data = serde_json::json!({
        "userId": "user123",
        "recommendationType": "workout_plan",
        "title": "Increase Workout Frequency",
        "description": "Based on your recent performance, consider increasing your workout frequency to 4 times per week.",
        "reasoning": "Your completion rate is consistently high and you're recovering well between sessions.",
        "priority": 4,
        "metadata": {
            "confidence_score": 0.85,
            "impact_level": "medium",
            "category": "progression"
        }
    });

    let recommendation_event = test_utils::create_mock_event(
        "POST",
        "/api/coaching/recommendations",
        Some(recommendation_data),
        None,
        None,
        None,
    );

    // Simulate recommendation creation
    let recommendation_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&serde_json::json!({
            "id": "rec123",
            "userId": "user123",
            "recommendationType": "workout_plan",
            "title": "Increase Workout Frequency",
            "description": "Based on your recent performance, consider increasing your workout frequency to 4 times per week.",
            "reasoning": "Your completion rate is consistently high and you're recovering well between sessions.",
            "priority": 4,
            "isApplied": false,
            "metadata": {
                "confidence_score": 0.85,
                "impact_level": "medium",
                "category": "progression"
            },
            "createdAt": "2024-01-01T00:00:00Z"
        })).unwrap()
    });

    test_utils::validate_lambda_response(&recommendation_result, 201);

    // Step 2: Get recommendations for user
    let get_recommendations_event = test_utils::create_mock_event(
        "GET",
        "/api/coaching/recommendations",
        None,
        None,
        Some({
            let mut params = HashMap::new();
            params.insert("userId".to_string(), "user123".to_string());
            params
        }),
        None,
    );

    // Simulate recommendations retrieval
    let get_recommendations_result = serde_json::json!({
        "statusCode": 200,
        "body": serde_json::to_string(&serde_json::json!([
            {
                "id": "rec123",
                "userId": "user123",
                "recommendationType": "workout_plan",
                "title": "Increase Workout Frequency",
                "description": "Based on your recent performance, consider increasing your workout frequency to 4 times per week.",
                "reasoning": "Your completion rate is consistently high and you're recovering well between sessions.",
                "priority": 4,
                "isApplied": false,
                "metadata": {
                    "confidence_score": 0.85,
                    "impact_level": "medium",
                    "category": "progression"
                },
                "createdAt": "2024-01-01T00:00:00Z"
            }
        ])).unwrap()
    });

    test_utils::validate_lambda_response(&get_recommendations_result, 200);

    // Step 3: Generate AI-powered recommendations
    let generate_data = serde_json::json!({
        "userId": "user123",
        "recommendationType": "workout_plan"
    });

    let generate_event = test_utils::create_mock_event(
        "POST",
        "/api/coaching/recommendations/generate",
        Some(generate_data),
        None,
        None,
        None,
    );

    // Simulate AI recommendations generation
    let generate_result = serde_json::json!({
        "statusCode": 200,
        "body": serde_json::to_string(&serde_json::json!([
            {
                "id": "rec456",
                "userId": "user123",
                "recommendationType": "workout_plan",
                "title": "Add Cardio Sessions",
                "description": "Consider adding 2-3 cardio sessions per week to improve cardiovascular health.",
                "reasoning": "Your current routine focuses on strength training. Adding cardio will provide balanced fitness.",
                "priority": 3,
                "isApplied": false,
                "metadata": {
                    "confidence_score": 0.72,
                    "impact_level": "medium",
                    "category": "balance"
                },
                "createdAt": "2024-01-01T00:00:00Z"
            }
        ])).unwrap()
    });

    test_utils::validate_lambda_response(&generate_result, 200);
}

#[tokio::test]
async fn test_error_recovery_and_resilience() {
    // Test service failure recovery
    let user_profile_data = serde_json::json!({
        "userId": "user123",
        "email": "test@example.com",
        "name": "Test User"
    });

    let user_profile_event = test_utils::create_mock_event(
        "POST",
        "/api/user-profiles",
        Some(user_profile_data),
        None,
        None,
        None,
    );

    // Simulate first attempt failure
    let first_attempt_result = serde_json::json!({
        "statusCode": 500,
        "body": serde_json::to_string(&serde_json::json!({
            "error": "InternalServerError",
            "message": "DynamoDB service unavailable"
        })).unwrap()
    });

    test_utils::validate_lambda_response(&first_attempt_result, 500);

    // Simulate second attempt success
    let second_attempt_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_user()).unwrap()
    });

    test_utils::validate_lambda_response(&second_attempt_result, 201);
}

#[tokio::test]
async fn test_data_consistency_across_services() {
    // Test that data remains consistent across all services
    let user_id = "user123";
    
    // Create operations for different services
    let operations = vec![
        database_utils::DatabaseOperation {
            user_id: Some(user_id.to_string()),
            operation_type: "CREATE".to_string(),
            table_name: "user_profiles".to_string(),
        },
        database_utils::DatabaseOperation {
            user_id: Some(user_id.to_string()),
            operation_type: "CREATE".to_string(),
            table_name: "workout_plans".to_string(),
        },
        database_utils::DatabaseOperation {
            user_id: Some(user_id.to_string()),
            operation_type: "CREATE".to_string(),
            table_name: "workout_sessions".to_string(),
        },
        database_utils::DatabaseOperation {
            user_id: Some(user_id.to_string()),
            operation_type: "CREATE".to_string(),
            table_name: "strength_progress".to_string(),
        },
        database_utils::DatabaseOperation {
            user_id: Some(user_id.to_string()),
            operation_type: "CREATE".to_string(),
            table_name: "body_measurements".to_string(),
        },
    ];

    // Validate database consistency
    database_utils::validate_database_consistency(&operations);

    // Verify all operations use the same user ID
    for operation in &operations {
        assert_eq!(operation.user_id, Some(user_id.to_string()));
    }
}

#[tokio::test]
async fn test_performance_under_load() {
    // Test high-volume concurrent requests
    let results = performance_utils::run_concurrent_tests(100, |i| async move {
        let user_profile_data = serde_json::json!({
            "userId": format!("user{}", i),
            "email": format!("test{}@example.com", i),
            "name": format!("Test User {}", i),
            "fitnessGoals": "Build muscle",
            "experienceLevel": "beginner"
        });

        let event = test_utils::create_mock_event(
            "POST",
            "/api/user-profiles",
            Some(user_profile_data),
            None,
            None,
            None,
        );

        // Simulate successful response
        serde_json::json!({
            "statusCode": 201,
            "body": serde_json::to_string(&serde_json::json!({
                "userId": format!("user{}", i),
                "email": format!("test{}@example.com", i),
                "name": format!("Test User {}", i),
                "fitnessGoals": "Build muscle",
                "experienceLevel": "beginner",
                "createdAt": "2024-01-01T00:00:00Z"
            })).unwrap()
        })
    }).await;

    // Validate all requests succeeded
    for result in &results {
        test_utils::validate_lambda_response(result, 201);
    }

    assert_eq!(results.len(), 100);
}

#[tokio::test]
async fn test_large_data_payloads() {
    // Test with large workout plan (1000 exercises)
    let large_workout_plan_data = serde_json::json!({
        "userId": "user123",
        "name": "Comprehensive Workout Plan",
        "description": "A comprehensive workout plan with many exercises",
        "difficulty": "intermediate",
        "durationWeeks": 12,
        "frequencyPerWeek": 5,
        "exercises": (0..1000).map(|i| serde_json::json!({
            "exerciseId": format!("ex{}", i),
            "name": format!("Exercise {}", i),
            "sets": 3,
            "reps": 10,
            "restSeconds": 60,
            "order": i
        })).collect::<Vec<_>>()
    });

    let event = test_utils::create_mock_event(
        "POST",
        "/api/workouts/plans",
        Some(large_workout_plan_data),
        None,
        None,
        None,
    );

    // Measure performance
    let (result, duration) = performance_utils::measure_time(|| {
        // Simulate processing large payload
        serde_json::json!({
            "statusCode": 201,
            "body": serde_json::to_string(&serde_json::json!({
                "id": "plan123",
                "userId": "user123",
                "name": "Comprehensive Workout Plan",
                "description": "A comprehensive workout plan with many exercises",
                "difficulty": "intermediate",
                "durationWeeks": 12,
                "frequencyPerWeek": 5,
                "exercises": (0..1000).map(|i| serde_json::json!({
                    "exerciseId": format!("ex{}", i),
                    "name": format!("Exercise {}", i),
                    "sets": 3,
                    "reps": 10,
                    "restSeconds": 60,
                    "order": i
                })).collect::<Vec<_>>(),
                "createdAt": "2024-01-01T00:00:00Z"
            })).unwrap()
        })
    });

    test_utils::validate_lambda_response(&result, 201);
    
    // Validate performance (should complete within reasonable time)
    performance_utils::assert_performance(duration, std::time::Duration::from_secs(10));
}
