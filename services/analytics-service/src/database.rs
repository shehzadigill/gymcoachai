use serde_json::Value;
use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use chrono::Utc;
use anyhow::Result;

use crate::models::*;

// Strength Progress Database Operations
pub async fn get_strength_progress_from_db(
    user_id: &str,
    start_date: &str,
    end_date: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk AND SK BETWEEN :start AND :end")
        .expression_attribute_values(":pk", AttributeValue::S("STRENGTH_PROGRESS".to_string()))
        .expression_attribute_values(":start", AttributeValue::S(format!("USER#{}#{}", user_id, start_date)))
        .expression_attribute_values(":end", AttributeValue::S(format!("USER#{}#{}", user_id, end_date)))
        .send()
        .await?;
    
    let progress: Vec<StrengthProgress> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(StrengthProgress {
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                exercise_id: item.get("exerciseId")?.as_s().ok()?.clone(),
                exercise_name: item.get("exerciseName")?.as_s().ok()?.clone(),
                current_max_weight: item.get("currentMaxWeight")?.as_n().ok()?.parse().ok()?,
                previous_max_weight: item.get("previousMaxWeight")?.as_n().ok()?.parse().ok()?,
                weight_increase: item.get("weightIncrease")?.as_n().ok()?.parse().ok()?,
                percentage_increase: item.get("percentageIncrease")?.as_n().ok()?.parse().ok()?,
                period: item.get("period")?.as_s().ok()?.clone(),
                measurement_date: item.get("measurementDate")?.as_s().ok()?.clone(),
                trend: item.get("trend")?.as_s().ok()?.clone(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(progress)?)
}

pub async fn create_strength_progress_in_db(
    progress: &StrengthProgress,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("STRENGTH_PROGRESS".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("USER#{}#{}", progress.user_id, progress.measurement_date)));
    item.insert("userId".to_string(), AttributeValue::S(progress.user_id.clone()));
    item.insert("exerciseId".to_string(), AttributeValue::S(progress.exercise_id.clone()));
    item.insert("exerciseName".to_string(), AttributeValue::S(progress.exercise_name.clone()));
    item.insert("currentMaxWeight".to_string(), AttributeValue::N(progress.current_max_weight.to_string()));
    item.insert("previousMaxWeight".to_string(), AttributeValue::N(progress.previous_max_weight.to_string()));
    item.insert("weightIncrease".to_string(), AttributeValue::N(progress.weight_increase.to_string()));
    item.insert("percentageIncrease".to_string(), AttributeValue::N(progress.percentage_increase.to_string()));
    item.insert("period".to_string(), AttributeValue::S(progress.period.clone()));
    item.insert("measurementDate".to_string(), AttributeValue::S(progress.measurement_date.clone()));
    item.insert("trend".to_string(), AttributeValue::S(progress.trend.clone()));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(progress)?)
}

// Body Measurements Database Operations
pub async fn get_body_measurements_from_db(
    user_id: &str,
    start_date: &str,
    end_date: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk AND SK BETWEEN :start AND :end")
        .expression_attribute_values(":pk", AttributeValue::S("BODY_MEASUREMENTS".to_string()))
        .expression_attribute_values(":start", AttributeValue::S(format!("USER#{}#{}", user_id, start_date)))
        .expression_attribute_values(":end", AttributeValue::S(format!("USER#{}#{}", user_id, end_date)))
        .send()
        .await?;
    
    let measurements: Vec<BodyMeasurement> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(BodyMeasurement {
                id: item.get("id")?.as_s().ok()?.clone(),
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                measurement_type: item.get("measurementType")?.as_s().ok()?.clone(),
                value: item.get("value")?.as_n().ok()?.parse().ok()?,
                unit: item.get("unit")?.as_s().ok()?.clone(),
                measured_at: item.get("measuredAt")?.as_s().ok()?.clone(),
                notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(measurements)?)
}

pub async fn create_body_measurement_in_db(
    measurement: &BodyMeasurement,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("BODY_MEASUREMENTS".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("USER#{}#{}", measurement.user_id, measurement.measured_at)));
    item.insert("id".to_string(), AttributeValue::S(measurement.id.clone()));
    item.insert("userId".to_string(), AttributeValue::S(measurement.user_id.clone()));
    item.insert("measurementType".to_string(), AttributeValue::S(measurement.measurement_type.clone()));
    item.insert("value".to_string(), AttributeValue::N(measurement.value.to_string()));
    item.insert("unit".to_string(), AttributeValue::S(measurement.unit.clone()));
    item.insert("measuredAt".to_string(), AttributeValue::S(measurement.measured_at.clone()));
    
    if let Some(notes) = &measurement.notes {
        item.insert("notes".to_string(), AttributeValue::S(notes.clone()));
    }
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(measurement)?)
}

// Progress Charts Database Operations
pub async fn get_progress_charts_from_db(
    user_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("PROGRESS_CHARTS".to_string()))
        .filter_expression("userId = :userId")
        .expression_attribute_values(":userId", AttributeValue::S(user_id.to_string()))
        .send()
        .await?;
    
    let charts: Vec<ProgressChart> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(ProgressChart {
                chart_id: item.get("chartId")?.as_s().ok()?.clone(),
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                chart_type: item.get("chartType")?.as_s().ok()?.clone(),
                title: item.get("title")?.as_s().ok()?.clone(),
                description: item.get("description")?.as_s().ok()?.clone(),
                data_points: item.get("dataPoints")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| {
                        let obj = v.as_m().ok()?;
                        Some(ChartDataPoint {
                            x_value: obj.get("xValue")?.as_s().ok()?.clone(),
                            y_value: obj.get("yValue")?.as_n().ok()?.parse().ok()?,
                            label: obj.get("label").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                            metadata: obj.get("metadata").and_then(|v| serde_json::from_value(v.clone()).ok()),
                        })
                    }).collect())
                    .unwrap_or_default(),
                x_axis_label: item.get("xAxisLabel")?.as_s().ok()?.clone(),
                y_axis_label: item.get("yAxisLabel")?.as_s().ok()?.clone(),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(charts)?)
}

pub async fn create_progress_chart_in_db(
    chart: &ProgressChart,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("PROGRESS_CHARTS".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("CHART#{}", chart.chart_id)));
    item.insert("chartId".to_string(), AttributeValue::S(chart.chart_id.clone()));
    item.insert("userId".to_string(), AttributeValue::S(chart.user_id.clone()));
    item.insert("chartType".to_string(), AttributeValue::S(chart.chart_type.clone()));
    item.insert("title".to_string(), AttributeValue::S(chart.title.clone()));
    item.insert("description".to_string(), AttributeValue::S(chart.description.clone()));
    item.insert("xAxisLabel".to_string(), AttributeValue::S(chart.x_axis_label.clone()));
    item.insert("yAxisLabel".to_string(), AttributeValue::S(chart.y_axis_label.clone()));
    item.insert("createdAt".to_string(), AttributeValue::S(chart.created_at.clone()));
    item.insert("updatedAt".to_string(), AttributeValue::S(chart.updated_at.clone()));
    
    // Add data points as a list of maps
    let data_points: Vec<AttributeValue> = chart.data_points
        .iter()
        .map(|point| {
            let mut point_map = std::collections::HashMap::new();
            point_map.insert("xValue".to_string(), AttributeValue::S(point.x_value.clone()));
            point_map.insert("yValue".to_string(), AttributeValue::N(point.y_value.to_string()));
            
            if let Some(label) = &point.label {
                point_map.insert("label".to_string(), AttributeValue::S(label.clone()));
            }
            if let Some(metadata) = &point.metadata {
                point_map.insert("metadata".to_string(), AttributeValue::S(serde_json::to_string(metadata).unwrap_or_default()));
            }
            
            AttributeValue::M(point_map)
        })
        .collect();
    item.insert("dataPoints".to_string(), AttributeValue::L(data_points));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(chart)?)
}

// Milestones Database Operations
pub async fn get_milestones_from_db(
    user_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("MILESTONES".to_string()))
        .filter_expression("userId = :userId")
        .expression_attribute_values(":userId", AttributeValue::S(user_id.to_string()))
        .send()
        .await?;
    
    let milestones: Vec<Milestone> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(Milestone {
                id: item.get("id")?.as_s().ok()?.clone(),
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                milestone_type: item.get("milestoneType")?.as_s().ok()?.clone(),
                title: item.get("title")?.as_s().ok()?.clone(),
                description: item.get("description")?.as_s().ok()?.clone(),
                target_value: item.get("targetValue")?.as_n().ok()?.parse().ok()?,
                current_value: item.get("currentValue")?.as_n().ok()?.parse().ok()?,
                progress_percentage: item.get("progressPercentage")?.as_n().ok()?.parse().ok()?,
                achieved: item.get("achieved")?.as_bool().ok()?,
                achieved_at: item.get("achievedAt").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                target_date: item.get("targetDate").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(milestones)?)
}

pub async fn create_milestone_in_db(
    milestone: &Milestone,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("MILESTONES".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("MILESTONE#{}", milestone.id)));
    item.insert("id".to_string(), AttributeValue::S(milestone.id.clone()));
    item.insert("userId".to_string(), AttributeValue::S(milestone.user_id.clone()));
    item.insert("milestoneType".to_string(), AttributeValue::S(milestone.milestone_type.clone()));
    item.insert("title".to_string(), AttributeValue::S(milestone.title.clone()));
    item.insert("description".to_string(), AttributeValue::S(milestone.description.clone()));
    item.insert("targetValue".to_string(), AttributeValue::N(milestone.target_value.to_string()));
    item.insert("currentValue".to_string(), AttributeValue::N(milestone.current_value.to_string()));
    item.insert("progressPercentage".to_string(), AttributeValue::N(milestone.progress_percentage.to_string()));
    item.insert("achieved".to_string(), AttributeValue::Bool(milestone.achieved));
    item.insert("createdAt".to_string(), AttributeValue::S(milestone.created_at.clone()));
    
    if let Some(achieved_at) = &milestone.achieved_at {
        item.insert("achievedAt".to_string(), AttributeValue::S(achieved_at.clone()));
    }
    if let Some(target_date) = &milestone.target_date {
        item.insert("targetDate".to_string(), AttributeValue::S(target_date.clone()));
    }
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(milestone)?)
}

// Performance Trends Database Operations
pub async fn get_performance_trends_from_db(
    user_id: &str,
    start_date: &str,
    end_date: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk AND SK BETWEEN :start AND :end")
        .expression_attribute_values(":pk", AttributeValue::S("PERFORMANCE_TRENDS".to_string()))
        .expression_attribute_values(":start", AttributeValue::S(format!("USER#{}#{}", user_id, start_date)))
        .expression_attribute_values(":end", AttributeValue::S(format!("USER#{}#{}", user_id, end_date)))
        .send()
        .await?;
    
    let trends: Vec<PerformanceTrend> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(PerformanceTrend {
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                metric_type: item.get("metricType")?.as_s().ok()?.clone(),
                period: item.get("period")?.as_s().ok()?.clone(),
                start_date: item.get("startDate")?.as_s().ok()?.clone(),
                end_date: item.get("endDate")?.as_s().ok()?.clone(),
                trend_direction: item.get("trendDirection")?.as_s().ok()?.clone(),
                trend_strength: item.get("trendStrength")?.as_n().ok()?.parse().ok()?,
                data_points: item.get("dataPoints")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| {
                        let obj = v.as_m().ok()?;
                        Some(TrendDataPoint {
                            date: obj.get("date")?.as_s().ok()?.clone(),
                            value: obj.get("value")?.as_n().ok()?.parse().ok()?,
                            context: obj.get("context").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                        })
                    }).collect())
                    .unwrap_or_default(),
                insights: item.get("insights")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    .unwrap_or_default(),
                recommendations: item.get("recommendations")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    .unwrap_or_default(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(trends)?)
}

// Workout Sessions Database Operations (for analytics)
pub async fn get_workout_sessions_for_analytics(
    user_id: &str,
    start_date: &str,
    end_date: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
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
                                        completed: set_obj.get("completed")?.as_bool().ok()?,
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
    
    Ok(serde_json::to_value(sessions)?)
}
