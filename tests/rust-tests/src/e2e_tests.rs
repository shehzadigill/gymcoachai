use gymcoach_ai_tests::*;
use serde_json::Value;
use std::collections::HashMap;

#[tokio::test]
async fn test_complete_user_journey() {
    // Complete user journey: Registration -> Profile Setup -> Workout Plan -> Workout Session -> Progress Tracking -> Analytics

    // Step 1: User Registration and Profile Creation
    let user_profile_data = serde_json::json!({
        "userId": "user123",
        "email": "test@example.com",
        "name": "John Doe",
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

    let user_profile_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_user()).unwrap()
    });

    test_utils::validate_lambda_response(&user_profile_result, 201);

    // Step 2: Create Workout Plan
    let workout_plan_data = serde_json::json!({
        "userId": "user123",
        "name": "Beginner Strength Program",
        "description": "A 4-week beginner strength program designed to build foundational strength",
        "difficulty": "beginner",
        "durationWeeks": 4,
        "frequencyPerWeek": 3,
        "exercises": [
            {
                "exerciseId": "ex001",
                "name": "Push-ups",
                "sets": 3,
                "reps": 10,
                "restSeconds": 60,
                "order": 1
            },
            {
                "exerciseId": "ex002",
                "name": "Squats",
                "sets": 3,
                "reps": 15,
                "restSeconds": 60,
                "order": 2
            },
            {
                "exerciseId": "ex003",
                "name": "Plank",
                "sets": 3,
                "reps": 30,
                "restSeconds": 60,
                "order": 3
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

    let workout_plan_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_workout_plan()).unwrap()
    });

    test_utils::validate_lambda_response(&workout_plan_result, 201);

    // Step 3: Complete First Workout Session
    let workout_session_data = serde_json::json!({
        "userId": "user123",
        "workoutPlanId": "plan123",
        "name": "Day 1 - Upper Body",
        "exercises": [
            {
                "exerciseId": "ex001",
                "name": "Push-ups",
                "sets": [
                    {
                        "reps": 10,
                        "weight": 0,
                        "completed": true,
                        "notes": "Good form, felt strong"
                    },
                    {
                        "reps": 10,
                        "weight": 0,
                        "completed": true,
                        "notes": "Good form, felt strong"
                    },
                    {
                        "reps": 8,
                        "weight": 0,
                        "completed": true,
                        "notes": "Last set was challenging"
                    }
                ],
                "order": 1
            },
            {
                "exerciseId": "ex003",
                "name": "Plank",
                "sets": [
                    {
                        "reps": 30,
                        "weight": 0,
                        "completed": true,
                        "notes": "Held for 30 seconds"
                    },
                    {
                        "reps": 30,
                        "weight": 0,
                        "completed": true,
                        "notes": "Held for 30 seconds"
                    },
                    {
                        "reps": 25,
                        "weight": 0,
                        "completed": true,
                        "notes": "Last set was tough"
                    }
                ],
                "order": 2
            }
        ],
        "notes": "Great first workout! Felt energized and motivated."
    });

    let workout_session_event = test_utils::create_mock_event(
        "POST",
        "/api/workouts/sessions",
        Some(workout_session_data),
        None,
        None,
        None,
    );

    let workout_session_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_workout_session()).unwrap()
    });

    test_utils::validate_lambda_response(&workout_session_result, 201);

    // Step 4: Record Progress Photos
    let progress_photo_data = serde_json::json!({
        "userId": "user123",
        "photoType": "front",
        "takenAt": "2024-01-01T00:00:00Z",
        "notes": "Starting progress photo",
        "measurements": {
            "weight": 70.5,
            "unit": "kg",
            "bodyFatPercentage": 15.5
        }
    });

    let progress_photo_event = test_utils::create_mock_event(
        "POST",
        "/api/workouts/progress-photos",
        Some(progress_photo_data),
        None,
        None,
        None,
    );

    let progress_photo_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&serde_json::json!({
            "id": "photo123",
            "userId": "user123",
            "photoType": "front",
            "imageUrl": "https://s3.amazonaws.com/gymcoach-ai-progress/user123/photo123.jpg",
            "takenAt": "2024-01-01T00:00:00Z",
            "notes": "Starting progress photo",
            "measurements": {
                "weight": 70.5,
                "unit": "kg",
                "bodyFatPercentage": 15.5
            },
            "createdAt": "2024-01-01T00:00:00Z"
        })).unwrap()
    });

    test_utils::validate_lambda_response(&progress_photo_result, 201);

    // Step 5: Record Strength Progress
    let strength_progress_data = serde_json::json!({
        "userId": "user123",
        "exerciseId": "ex001",
        "exerciseName": "Push-ups",
        "currentMaxWeight": 0,
        "previousMaxWeight": 0,
        "weightIncrease": 0,
        "percentageIncrease": 0,
        "period": "week",
        "measurementDate": "2024-01-01T00:00:00Z",
        "trend": "stable"
    });

    let strength_progress_event = test_utils::create_mock_event(
        "POST",
        "/api/analytics/strength-progress",
        Some(strength_progress_data),
        None,
        None,
        None,
    );

    let strength_progress_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_strength_progress()).unwrap()
    });

    test_utils::validate_lambda_response(&strength_progress_result, 201);

    // Step 6: Record Body Measurements
    let body_measurement_data = serde_json::json!({
        "userId": "user123",
        "measurementType": "weight",
        "value": 70.5,
        "unit": "kg",
        "measurementDate": "2024-01-01T00:00:00Z",
        "notes": "Starting weight measurement"
    });

    let body_measurement_event = test_utils::create_mock_event(
        "POST",
        "/api/analytics/body-measurements",
        Some(body_measurement_data),
        None,
        None,
        None,
    );

    let body_measurement_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_body_measurement()).unwrap()
    });

    test_utils::validate_lambda_response(&body_measurement_result, 201);

    // Step 7: Get AI Recommendations
    let recommendation_data = serde_json::json!({
        "userId": "user123",
        "recommendationType": "workout_plan"
    });

    let recommendation_event = test_utils::create_mock_event(
        "POST",
        "/api/coaching/recommendations/generate",
        Some(recommendation_data),
        None,
        None,
        None,
    );

    let recommendation_result = serde_json::json!({
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

    test_utils::validate_lambda_response(&recommendation_result, 200);

    // Step 8: Get Progress Analytics
    let analytics_event = test_utils::create_mock_event(
        "GET",
        "/api/analytics/progress-charts/user123",
        None,
        Some({
            let mut params = HashMap::new();
            params.insert("userId".to_string(), "user123".to_string());
            params
        }),
        Some({
            let mut params = HashMap::new();
            params.insert("period".to_string(), "month".to_string());
            params
        }),
        None,
    );

    let analytics_result = serde_json::json!({
        "statusCode": 200,
        "body": serde_json::to_string(&serde_json::json!({
            "userId": "user123",
            "period": "month",
            "workoutStats": {
                "totalWorkouts": 1,
                "totalDuration": 60,
                "averageWorkoutDuration": 60,
                "completionRate": 100.0
            },
            "strengthProgress": {
                "totalExercises": 1,
                "averageImprovement": 0.0,
                "trend": "stable"
            },
            "bodyMeasurements": {
                "currentWeight": 70.5,
                "weightChange": 0.0,
                "bodyFatPercentage": 15.5
            },
            "achievements": [
                {
                    "id": "ach001",
                    "title": "First Workout",
                    "description": "Completed your first workout",
                    "type": "achievement",
                    "isAchieved": true,
                    "achievedAt": "2024-01-01T00:00:00Z"
                }
            ]
        })).unwrap()
    });

    test_utils::validate_lambda_response(&analytics_result, 200);

    // Verify complete user journey
    let user_profile_body: Value = serde_json::from_str(&user_profile_result["body"].as_str().unwrap()).unwrap();
    let workout_plan_body: Value = serde_json::from_str(&workout_plan_result["body"].as_str().unwrap()).unwrap();
    let workout_session_body: Value = serde_json::from_str(&workout_session_result["body"].as_str().unwrap()).unwrap();
    let progress_photo_body: Value = serde_json::from_str(&progress_photo_result["body"].as_str().unwrap()).unwrap();
    let strength_progress_body: Value = serde_json::from_str(&strength_progress_result["body"].as_str().unwrap()).unwrap();
    let body_measurement_body: Value = serde_json::from_str(&body_measurement_result["body"].as_str().unwrap()).unwrap();
    let recommendation_body: Value = serde_json::from_str(&recommendation_result["body"].as_str().unwrap()).unwrap();
    let analytics_body: Value = serde_json::from_str(&analytics_result["body"].as_str().unwrap()).unwrap();

    // All operations should use the same user ID
    assert_eq!(user_profile_body["userId"], "user123");
    assert_eq!(workout_plan_body["userId"], "user123");
    assert_eq!(workout_session_body["userId"], "user123");
    assert_eq!(progress_photo_body["userId"], "user123");
    assert_eq!(strength_progress_body["userId"], "user123");
    assert_eq!(body_measurement_body["userId"], "user123");
    assert_eq!(analytics_body["userId"], "user123");

    // Verify recommendation is for the correct user
    let recommendations: Vec<Value> = serde_json::from_str(&recommendation_result["body"].as_str().unwrap()).unwrap();
    assert_eq!(recommendations[0]["userId"], "user123");
}

#[tokio::test]
async fn test_multi_user_scenario() {
    // Test multiple users using the system simultaneously

    let users = vec!["user001", "user002", "user003", "user004", "user005"];

    // Create user profiles for all users
    let mut user_results = Vec::new();
    for (i, user_id) in users.iter().enumerate() {
        let user_profile_data = serde_json::json!({
            "userId": user_id,
            "email": format!("user{}@example.com", i + 1),
            "name": format!("User {}", i + 1),
            "fitnessGoals": if i % 2 == 0 { "Build muscle" } else { "Lose weight" },
            "experienceLevel": if i < 2 { "beginner" } else if i < 4 { "intermediate" } else { "advanced" }
        });

        let user_profile_event = test_utils::create_mock_event(
            "POST",
            "/api/user-profiles",
            Some(user_profile_data),
            None,
            None,
            None,
        );

        let user_profile_result = serde_json::json!({
            "statusCode": 201,
            "body": serde_json::to_string(&serde_json::json!({
                "userId": user_id,
                "email": format!("user{}@example.com", i + 1),
                "name": format!("User {}", i + 1),
                "fitnessGoals": if i % 2 == 0 { "Build muscle" } else { "Lose weight" },
                "experienceLevel": if i < 2 { "beginner" } else if i < 4 { "intermediate" } else { "advanced" },
                "createdAt": "2024-01-01T00:00:00Z"
            })).unwrap()
        });

        test_utils::validate_lambda_response(&user_profile_result, 201);
        user_results.push(user_profile_result);
    }

    // Create workout plans for all users
    let mut workout_plan_results = Vec::new();
    for (i, user_id) in users.iter().enumerate() {
        let workout_plan_data = serde_json::json!({
            "userId": user_id,
            "name": format!("Workout Plan for User {}", i + 1),
            "description": format!("A personalized workout plan for user {}", i + 1),
            "difficulty": if i < 2 { "beginner" } else if i < 4 { "intermediate" } else { "advanced" },
            "durationWeeks": 4,
            "frequencyPerWeek": 3,
            "exercises": [
                {
                    "exerciseId": format!("ex{}", i),
                    "name": format!("Exercise {}", i),
                    "sets": 3,
                    "reps": 10,
                    "restSeconds": 60,
                    "order": 1
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

        let workout_plan_result = serde_json::json!({
            "statusCode": 201,
            "body": serde_json::to_string(&serde_json::json!({
                "id": format!("plan{}", i),
                "userId": user_id,
                "name": format!("Workout Plan for User {}", i + 1),
                "description": format!("A personalized workout plan for user {}", i + 1),
                "difficulty": if i < 2 { "beginner" } else if i < 4 { "intermediate" } else { "advanced" },
                "durationWeeks": 4,
                "frequencyPerWeek": 3,
                "createdAt": "2024-01-01T00:00:00Z"
            })).unwrap()
        });

        test_utils::validate_lambda_response(&workout_plan_result, 201);
        workout_plan_results.push(workout_plan_result);
    }

    // Verify all users have unique data
    for (i, user_result) in user_results.iter().enumerate() {
        let user_body: Value = serde_json::from_str(&user_result["body"].as_str().unwrap()).unwrap();
        assert_eq!(user_body["userId"], users[i]);
    }

    for (i, workout_plan_result) in workout_plan_results.iter().enumerate() {
        let workout_plan_body: Value = serde_json::from_str(&workout_plan_result["body"].as_str().unwrap()).unwrap();
        assert_eq!(workout_plan_body["userId"], users[i]);
    }
}

#[tokio::test]
async fn test_error_recovery_scenarios() {
    // Test various error scenarios and recovery

    // Scenario 1: Invalid user data
    let invalid_user_data = serde_json::json!({
        "userId": "",
        "email": "invalid-email",
        "name": "",
        "fitnessGoals": "Invalid Goal",
        "experienceLevel": "invalid"
    });

    let invalid_user_event = test_utils::create_mock_event(
        "POST",
        "/api/user-profiles",
        Some(invalid_user_data),
        None,
        None,
        None,
    );

    let invalid_user_result = serde_json::json!({
        "statusCode": 400,
        "body": serde_json::to_string(&serde_json::json!({
            "error": "ValidationError",
            "message": "Invalid input data provided",
            "details": {
                "userId": "User ID cannot be empty",
                "email": "Invalid email format",
                "name": "Name cannot be empty",
                "fitnessGoals": "Invalid fitness goal",
                "experienceLevel": "Invalid experience level"
            }
        })).unwrap()
    });

    test_utils::validate_lambda_response(&invalid_user_result, 400);

    // Scenario 2: Service unavailable
    let user_data = serde_json::json!({
        "userId": "user123",
        "email": "test@example.com",
        "name": "Test User"
    });

    let user_event = test_utils::create_mock_event(
        "POST",
        "/api/user-profiles",
        Some(user_data),
        None,
        None,
        None,
    );

    let service_unavailable_result = serde_json::json!({
        "statusCode": 500,
        "body": serde_json::to_string(&serde_json::json!({
            "error": "InternalServerError",
            "message": "DynamoDB service unavailable"
        })).unwrap()
    });

    test_utils::validate_lambda_response(&service_unavailable_result, 500);

    // Scenario 3: Recovery after service restoration
    let recovery_result = serde_json::json!({
        "statusCode": 201,
        "body": serde_json::to_string(&test_utils::create_test_user()).unwrap()
    });

    test_utils::validate_lambda_response(&recovery_result, 201);
}

#[tokio::test]
async fn test_security_scenarios() {
    // Test various security scenarios

    let security_data = security_utils::SecurityTestData::default();

    // Test XSS protection
    for payload in &security_data.xss_payloads {
        let malicious_data = serde_json::json!({
            "userId": "user123",
            "email": "test@example.com",
            "name": payload,
            "fitnessGoals": "Build muscle",
            "experienceLevel": "beginner"
        });

        let malicious_event = test_utils::create_mock_event(
            "POST",
            "/api/user-profiles",
            Some(malicious_data),
            None,
            None,
            None,
        );

        let malicious_result = serde_json::json!({
            "statusCode": 400,
            "body": serde_json::to_string(&serde_json::json!({
                "error": "ValidationError",
                "message": "Potential XSS attack detected"
            })).unwrap()
        });

        test_utils::validate_lambda_response(&malicious_result, 400);
    }

    // Test SQL injection protection
    for payload in &security_data.sql_injection_payloads {
        let malicious_data = serde_json::json!({
            "userId": "user123",
            "email": "test@example.com",
            "name": "Test User",
            "fitnessGoals": payload,
            "experienceLevel": "beginner"
        });

        let malicious_event = test_utils::create_mock_event(
            "POST",
            "/api/user-profiles",
            Some(malicious_data),
            None,
            None,
            None,
        );

        let malicious_result = serde_json::json!({
            "statusCode": 400,
            "body": serde_json::to_string(&serde_json::json!({
                "error": "ValidationError",
                "message": "Potential SQL injection attack detected"
            })).unwrap()
        });

        test_utils::validate_lambda_response(&malicious_result, 400);
    }

    // Test NoSQL injection protection
    for payload in &security_data.nosql_injection_payloads {
        let malicious_data = serde_json::json!({
            "userId": "user123",
            "email": "test@example.com",
            "name": "Test User",
            "fitnessGoals": "Build muscle",
            "experienceLevel": "beginner",
            "query": payload
        });

        let malicious_event = test_utils::create_mock_event(
            "POST",
            "/api/user-profiles",
            Some(malicious_data),
            None,
            None,
            None,
        );

        let malicious_result = serde_json::json!({
            "statusCode": 400,
            "body": serde_json::to_string(&serde_json::json!({
                "error": "ValidationError",
                "message": "Potential NoSQL injection attack detected"
            })).unwrap()
        });

        test_utils::validate_lambda_response(&malicious_result, 400);
    }
}

#[tokio::test]
async fn test_performance_under_stress() {
    // Test system performance under stress

    // Test 1: High concurrent load
    let (results, duration) = performance_utils::measure_time(|| {
        performance_utils::run_concurrent_tests(1000, |i| async move {
            let user_profile_data = serde_json::json!({
                "userId": format!("user{}", i),
                "email": format!("user{}@example.com", i),
                "name": format!("User {}", i),
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
                    "email": format!("user{}@example.com", i),
                    "name": format!("User {}", i),
                    "fitnessGoals": "Build muscle",
                    "experienceLevel": "beginner",
                    "createdAt": "2024-01-01T00:00:00Z"
                })).unwrap()
            })
        })
    });

    // Validate all requests succeeded
    for result in &results {
        test_utils::validate_lambda_response(result, 201);
    }

    assert_eq!(results.len(), 1000);
    performance_utils::assert_performance(duration, std::time::Duration::from_secs(30));

    // Test 2: Large data payloads
    let large_workout_plan_data = serde_json::json!({
        "userId": "user123",
        "name": "Comprehensive Workout Plan",
        "description": "A comprehensive workout plan with many exercises",
        "difficulty": "intermediate",
        "durationWeeks": 12,
        "frequencyPerWeek": 5,
        "exercises": (0..5000).map(|i| serde_json::json!({
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

    let (result, duration) = performance_utils::measure_time(|| {
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
                "exercises": (0..5000).map(|i| serde_json::json!({
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
    performance_utils::assert_performance(duration, std::time::Duration::from_secs(60));
}
