use serde_json::{json, Value};
use lambda_runtime::Error;
use aws_sdk_dynamodb::Client as DynamoDbClient;
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

// Strength Progress Handlers
pub async fn get_strength_progress_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");
    let start_date = payload["queryStringParameters"]["startDate"].as_str().unwrap_or("");
    let end_date = payload["queryStringParameters"]["endDate"].as_str().unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    let start = if start_date.is_empty() {
        (Utc::now() - chrono::Duration::days(30)).to_rfc3339()
    } else {
        start_date.to_string()
    };

    let end = if end_date.is_empty() {
        Utc::now().to_rfc3339()
    } else {
        end_date.to_string()
    };

    match get_strength_progress_from_db(user_id, &start, &end, dynamodb_client).await {
        Ok(progress) => create_response(200, progress),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve strength progress: {}", e)})),
    }
}

pub async fn create_strength_progress_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let exercise_id = payload["body"]["exerciseId"].as_str().unwrap_or("").to_string();
    let exercise_name = payload["body"]["exerciseName"].as_str().unwrap_or("").to_string();
    let current_max_weight = payload["body"]["currentMaxWeight"].as_f64().unwrap_or(0.0) as f32;
    let previous_max_weight = payload["body"]["previousMaxWeight"].as_f64().unwrap_or(0.0) as f32;

    if user_id.is_empty() || exercise_id.is_empty() || exercise_name.is_empty() {
        return create_response(400, json!({"message": "User ID, exercise ID, and exercise name are required"}));
    }

    let weight_increase = current_max_weight - previous_max_weight;
    let percentage_increase = if previous_max_weight > 0.0 {
        (weight_increase / previous_max_weight) * 100.0
    } else {
        0.0
    };

    let trend = if percentage_increase > 5.0 {
        "increasing".to_string()
    } else if percentage_increase < -5.0 {
        "decreasing".to_string()
    } else {
        "stable".to_string()
    };

    let new_progress = StrengthProgress {
        user_id,
        exercise_id,
        exercise_name,
        current_max_weight,
        previous_max_weight,
        weight_increase,
        percentage_increase,
        period: payload["body"]["period"].as_str().unwrap_or("week").to_string(),
        measurement_date: Utc::now().to_rfc3339(),
        trend,
    };

    match create_strength_progress_in_db(&new_progress, dynamodb_client).await {
        Ok(progress) => create_response(201, progress),
        Err(e) => create_response(500, json!({"message": format!("Failed to create strength progress: {}", e)})),
    }
}

// Body Measurements Handlers
pub async fn get_body_measurements_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");
    let start_date = payload["queryStringParameters"]["startDate"].as_str().unwrap_or("");
    let end_date = payload["queryStringParameters"]["endDate"].as_str().unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    let start = if start_date.is_empty() {
        (Utc::now() - chrono::Duration::days(30)).to_rfc3339()
    } else {
        start_date.to_string()
    };

    let end = if end_date.is_empty() {
        Utc::now().to_rfc3339()
    } else {
        end_date.to_string()
    };

    match get_body_measurements_from_db(user_id, &start, &end, dynamodb_client).await {
        Ok(measurements) => create_response(200, measurements),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve body measurements: {}", e)})),
    }
}

pub async fn create_body_measurement_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let measurement_id = Uuid::new_v4().to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let measurement_type = payload["body"]["measurementType"].as_str().unwrap_or("").to_string();
    let value = payload["body"]["value"].as_f64().unwrap_or(0.0) as f32;
    let unit = payload["body"]["unit"].as_str().unwrap_or("").to_string();

    if user_id.is_empty() || measurement_type.is_empty() || unit.is_empty() {
        return create_response(400, json!({"message": "User ID, measurement type, and unit are required"}));
    }

    let new_measurement = BodyMeasurement {
        id: measurement_id,
        user_id,
        measurement_type,
        value,
        unit,
        measured_at: Utc::now().to_rfc3339(),
        notes: payload["body"]["notes"].as_str().map(|s| s.to_string()),
    };

    match create_body_measurement_in_db(&new_measurement, dynamodb_client).await {
        Ok(measurement) => create_response(201, measurement),
        Err(e) => create_response(500, json!({"message": format!("Failed to create body measurement: {}", e)})),
    }
}

// Progress Charts Handlers
pub async fn get_progress_charts_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    match get_progress_charts_from_db(user_id, dynamodb_client).await {
        Ok(charts) => create_response(200, charts),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve progress charts: {}", e)})),
    }
}

pub async fn create_progress_chart_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let chart_id = Uuid::new_v4().to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let chart_type = payload["body"]["chartType"].as_str().unwrap_or("").to_string();
    let title = payload["body"]["title"].as_str().unwrap_or("").to_string();
    let description = payload["body"]["description"].as_str().unwrap_or("").to_string();

    if user_id.is_empty() || chart_type.is_empty() || title.is_empty() {
        return create_response(400, json!({"message": "User ID, chart type, and title are required"}));
    }

    let data_points: Vec<ChartDataPoint> = payload["body"]["dataPoints"]
        .as_array()
        .unwrap_or(&vec![])
        .iter()
        .filter_map(|point| {
            Some(ChartDataPoint {
                x_value: point["xValue"].as_str()?.to_string(),
                y_value: point["yValue"].as_f64()? as f32,
                label: point["label"].as_str().map(|s| s.to_string()),
                metadata: point["metadata"].as_object().and_then(|_| serde_json::from_value(point["metadata"].clone()).ok()),
            })
        })
        .collect();

    let new_chart = ProgressChart {
        chart_id: chart_id.clone(),
        user_id,
        chart_type,
        title,
        description,
        data_points,
        x_axis_label: payload["body"]["xAxisLabel"].as_str().unwrap_or("Date").to_string(),
        y_axis_label: payload["body"]["yAxisLabel"].as_str().unwrap_or("Value").to_string(),
        created_at: Utc::now().to_rfc3339(),
        updated_at: Utc::now().to_rfc3339(),
    };

    match create_progress_chart_in_db(&new_chart, dynamodb_client).await {
        Ok(chart) => create_response(201, chart),
        Err(e) => create_response(500, json!({"message": format!("Failed to create progress chart: {}", e)})),
    }
}

// Milestones Handlers
pub async fn get_milestones_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    match get_milestones_from_db(user_id, dynamodb_client).await {
        Ok(milestones) => create_response(200, milestones),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve milestones: {}", e)})),
    }
}

pub async fn create_milestone_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let milestone_id = Uuid::new_v4().to_string();
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let milestone_type = payload["body"]["milestoneType"].as_str().unwrap_or("").to_string();
    let title = payload["body"]["title"].as_str().unwrap_or("").to_string();
    let description = payload["body"]["description"].as_str().unwrap_or("").to_string();
    let target_value = payload["body"]["targetValue"].as_f64().unwrap_or(0.0) as f32;
    let current_value = payload["body"]["currentValue"].as_f64().unwrap_or(0.0) as f32;

    if user_id.is_empty() || milestone_type.is_empty() || title.is_empty() {
        return create_response(400, json!({"message": "User ID, milestone type, and title are required"}));
    }

    let progress_percentage = if target_value > 0.0 {
        (current_value / target_value) * 100.0
    } else {
        0.0
    };

    let achieved = progress_percentage >= 100.0;
    let achieved_at = if achieved { Some(Utc::now().to_rfc3339()) } else { None };

    let new_milestone = Milestone {
        id: milestone_id,
        user_id,
        milestone_type,
        title,
        description,
        target_value,
        current_value,
        progress_percentage,
        achieved,
        achieved_at,
        created_at: Utc::now().to_rfc3339(),
        target_date: payload["body"]["targetDate"].as_str().map(|s| s.to_string()),
    };

    match create_milestone_in_db(&new_milestone, dynamodb_client).await {
        Ok(milestone) => create_response(201, milestone),
        Err(e) => create_response(500, json!({"message": format!("Failed to create milestone: {}", e)})),
    }
}

// Performance Trends Handlers
pub async fn get_performance_trends_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");
    let start_date = payload["queryStringParameters"]["startDate"].as_str().unwrap_or("");
    let end_date = payload["queryStringParameters"]["endDate"].as_str().unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    let start = if start_date.is_empty() {
        (Utc::now() - chrono::Duration::days(30)).to_rfc3339()
    } else {
        start_date.to_string()
    };

    let end = if end_date.is_empty() {
        Utc::now().to_rfc3339()
    } else {
        end_date.to_string()
    };

    match get_performance_trends_from_db(user_id, &start, &end, dynamodb_client).await {
        Ok(trends) => create_response(200, trends),
        Err(e) => create_response(500, json!({"message": format!("Failed to retrieve performance trends: {}", e)})),
    }
}

// Comprehensive Analytics Handlers
pub async fn get_workout_analytics_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");
    let period = payload["queryStringParameters"]["period"].as_str().unwrap_or("month");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    // Calculate date range based on period
    let (start_date, end_date) = match period {
        "week" => (
            (Utc::now() - chrono::Duration::days(7)).to_rfc3339(),
            Utc::now().to_rfc3339(),
        ),
        "month" => (
            (Utc::now() - chrono::Duration::days(30)).to_rfc3339(),
            Utc::now().to_rfc3339(),
        ),
        "quarter" => (
            (Utc::now() - chrono::Duration::days(90)).to_rfc3339(),
            Utc::now().to_rfc3339(),
        ),
        "year" => (
            (Utc::now() - chrono::Duration::days(365)).to_rfc3339(),
            Utc::now().to_rfc3339(),
        ),
        _ => (
            (Utc::now() - chrono::Duration::days(30)).to_rfc3339(),
            Utc::now().to_rfc3339(),
        ),
    };

    // Get all analytics data
    let sessions_result = get_workout_sessions_for_analytics(user_id, &start_date, &end_date, dynamodb_client).await;
    let strength_progress_result = get_strength_progress_from_db(user_id, &start_date, &end_date, dynamodb_client).await;
    let body_measurements_result = get_body_measurements_from_db(user_id, &start_date, &end_date, dynamodb_client).await;
    let milestones_result = get_milestones_from_db(user_id, dynamodb_client).await;
    let trends_result = get_performance_trends_from_db(user_id, &start_date, &end_date, dynamodb_client).await;

    let sessions: Vec<WorkoutSession> = sessions_result
        .and_then(|v| serde_json::from_value(v).map_err(|e| e.into()))
        .unwrap_or_default();

    let strength_progress: Vec<StrengthProgress> = strength_progress_result
        .and_then(|v| serde_json::from_value(v).map_err(|e| e.into()))
        .unwrap_or_default();

    let body_measurements: Vec<BodyMeasurement> = body_measurements_result
        .and_then(|v| serde_json::from_value(v).map_err(|e| e.into()))
        .unwrap_or_default();

    let milestones: Vec<Milestone> = milestones_result
        .and_then(|v| serde_json::from_value(v).map_err(|e| e.into()))
        .unwrap_or_default();

    let trends: Vec<PerformanceTrend> = trends_result
        .and_then(|v| serde_json::from_value(v).map_err(|e| e.into()))
        .unwrap_or_default();

    // Calculate analytics
    let total_workouts = sessions.len() as u32;
    let total_duration_minutes: u32 = sessions
        .iter()
        .filter_map(|s| s.duration_minutes)
        .sum();
    let average_workout_duration = if total_workouts > 0 {
        total_duration_minutes as f32 / total_workouts as f32
    } else {
        0.0
    };

    // Calculate consistency score (simplified)
    let consistency_score = if period == "week" {
        (total_workouts as f32 / 7.0).min(1.0)
    } else if period == "month" {
        (total_workouts as f32 / 30.0).min(1.0)
    } else {
        0.8 // Default value
    };

    // Calculate exercise stats
    let mut exercise_stats = std::collections::HashMap::new();
    for session in &sessions {
        for exercise in &session.exercises {
            let stats = exercise_stats.entry(exercise.exercise_id.clone()).or_insert(ExerciseStats {
                exercise_id: exercise.exercise_id.clone(),
                exercise_name: exercise.name.clone(),
                total_sets: 0,
                total_reps: 0,
                total_volume: 0.0,
                average_weight: 0.0,
                max_weight: 0.0,
                frequency: 0,
                improvement_rate: 0.0,
            });

            stats.frequency += 1;
            stats.total_sets += exercise.sets.len() as u32;
            
            for set in &exercise.sets {
                if let Some(reps) = set.reps {
                    stats.total_reps += reps;
                }
                if let Some(weight) = set.weight {
                    stats.total_volume += weight * stats.total_reps as f32;
                    stats.max_weight = stats.max_weight.max(weight);
                }
            }
        }
    }

    let favorite_exercises: Vec<ExerciseStats> = exercise_stats
        .into_values()
        .collect();

    let analytics = WorkoutAnalytics {
        user_id: user_id.to_string(),
        period: period.to_string(),
        total_workouts,
        total_duration_minutes,
        average_workout_duration,
        consistency_score,
        favorite_exercises,
        strength_gains: strength_progress,
        body_measurements,
        milestones_achieved: milestones.into_iter().filter(|m| m.achieved).collect(),
        performance_trends: trends,
        generated_at: Utc::now().to_rfc3339(),
    };

    create_response(200, json!(analytics))
}

pub async fn generate_progress_report_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["body"]["userId"].as_str().unwrap_or("").to_string();
    let report_type = payload["body"]["reportType"].as_str().unwrap_or("monthly").to_string();
    let period_start = payload["body"]["periodStart"].as_str().unwrap_or("").to_string();
    let period_end = payload["body"]["periodEnd"].as_str().unwrap_or("").to_string();

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    // This is a simplified version - in a real implementation, you would:
    // 1. Generate comprehensive analytics
    // 2. Create progress charts
    // 3. Identify milestones
    // 4. Generate recommendations
    // 5. Create a formatted report

    let report = ProgressReport {
        report_id: Uuid::new_v4().to_string(),
        user_id: user_id.clone(),
        report_type: report_type.clone(),
        period_start: period_start.clone(),
        period_end: period_end.clone(),
        summary: ProgressSummary {
            total_workouts: 12,
            total_hours: 24.5,
            strength_improvements: 3,
            body_measurement_changes: 2,
            milestones_achieved: 1,
            consistency_rating: "good".to_string(),
            overall_progress: "good".to_string(),
            key_achievements: vec![
                "Increased bench press by 20 lbs".to_string(),
                "Completed 4 weeks of consistent training".to_string(),
            ],
            areas_for_improvement: vec![
                "Focus on leg day consistency".to_string(),
                "Improve form on squats".to_string(),
            ],
        },
        detailed_analytics: WorkoutAnalytics {
            user_id: user_id.clone(),
            period: report_type,
            total_workouts: 12,
            total_duration_minutes: 1470,
            average_workout_duration: 122.5,
            consistency_score: 0.8,
            favorite_exercises: vec![],
            strength_gains: vec![],
            body_measurements: vec![],
            milestones_achieved: vec![],
            performance_trends: vec![],
            generated_at: Utc::now().to_rfc3339(),
        },
        charts: vec![],
        milestones: vec![],
        recommendations: vec![
            "Continue current training program".to_string(),
            "Add more leg exercises".to_string(),
            "Focus on proper form".to_string(),
        ],
        generated_at: Utc::now().to_rfc3339(),
    };

    create_response(200, json!(report))
}

// Achievements Handlers
pub async fn get_achievements_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");

    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    match get_achievements_from_db(user_id, dynamodb_client).await {
        Ok(achievements) => create_response(200, achievements),
        Err(e) => {
            eprintln!("Error fetching achievements: {}", e);
            create_response(500, json!({"message": "Failed to fetch achievements"}))
        }
    }
}

pub async fn create_achievement_handler(
    payload: Value,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Error> {
    let user_id = payload["pathParameters"]["userId"].as_str().unwrap_or("");
    
    if user_id.is_empty() {
        return create_response(400, json!({"message": "User ID is required"}));
    }

    let body: Value = serde_json::from_str(
        payload.get("body")
            .ok_or("Missing body")?
            .as_str()
            .ok_or("Body is not a string")?,
    )?;

    let achievement = Achievement {
        id: Uuid::new_v4().to_string(),
        user_id: user_id.to_string(),
        title: body.get("title")
            .and_then(|v| v.as_str())
            .unwrap_or("New Achievement")
            .to_string(),
        description: body.get("description")
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string(),
        category: body.get("category")
            .and_then(|v| v.as_str())
            .unwrap_or("general")
            .to_string(),
        points: body.get("points")
            .and_then(|v| v.as_u64())
            .unwrap_or(10) as i32,
        achieved_at: Utc::now().to_rfc3339(),
        created_at: Utc::now().to_rfc3339(),
    };

    match create_achievement_in_db(&achievement, dynamodb_client).await {
        Ok(_) => create_response(201, json!(achievement)),
        Err(e) => {
            eprintln!("Error creating achievement: {}", e);
            create_response(500, json!({"message": "Failed to create achievement"}))
        }
    }
}
