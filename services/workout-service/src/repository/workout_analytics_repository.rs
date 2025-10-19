use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use serde_json::Value;
use anyhow::Result;
use tracing::{info, error};
use chrono::Utc;

use crate::models::*;

#[derive(Clone)]
pub struct WorkoutAnalyticsRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl WorkoutAnalyticsRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_workout_analytics(&self, user_id: Option<String>) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let user_id = user_id.unwrap_or_else(|| "unknown".to_string());
        
        // Fetch all workout sessions for the user
        let sessions_result = self.client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk_prefix)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
            .expression_attribute_values(":sk_prefix", AttributeValue::S("SESSION#".to_string()))
            .send()
            .await?;

        let sessions = sessions_result.items.unwrap_or_default();
        
        // Calculate analytics from sessions
        let total_workouts = sessions.len() as i32;
        let mut total_duration_minutes = 0;
        let mut workouts_this_week = 0;
        let mut workouts_this_month = 0;
        let mut duration_this_week = 0; // Track duration for calorie calculation
        let mut last_workout_date: Option<String> = None;
        let mut exercise_counts = std::collections::HashMap::new();
        
        let now = chrono::Utc::now();
        let week_ago = now - chrono::Duration::days(7);
        let month_ago = now - chrono::Duration::days(30);
        
        for session in &sessions {
            // Extract duration
            if let Some(duration) = session.get("DurationMinutes").and_then(|v| v.as_n().ok()).and_then(|n| n.parse::<i32>().ok()) {
                total_duration_minutes += duration;
                
                // Check if session is within last week for calorie calculation
                if let Some(started_at) = session.get("StartedAt").and_then(|v| v.as_s().ok()) {
                    if let Ok(session_date) = chrono::DateTime::parse_from_rfc3339(started_at) {
                        let session_utc = session_date.with_timezone(&chrono::Utc);
                        if session_utc > week_ago {
                            duration_this_week += duration;
                        }
                    }
                }
            }
            
            // Check date for weekly/monthly counts
            if let Some(started_at) = session.get("StartedAt").and_then(|v| v.as_s().ok()) {
                if let Ok(session_date) = chrono::DateTime::parse_from_rfc3339(started_at) {
                    let session_utc = session_date.with_timezone(&chrono::Utc);
                    
                    if session_utc > week_ago {
                        workouts_this_week += 1;
                    }
                    if session_utc > month_ago {
                        workouts_this_month += 1;
                    }
                    
                    // Track latest workout date
                    if last_workout_date.is_none() || session_utc > chrono::DateTime::parse_from_rfc3339(last_workout_date.as_ref().unwrap()).unwrap().with_timezone(&chrono::Utc) {
                        last_workout_date = Some(started_at.clone());
                    }
                }
            }
            
            // Count exercise frequency (simplified - would need to parse exercises from session)
            if let Some(name) = session.get("Name").and_then(|v| v.as_s().ok()) {
                *exercise_counts.entry(name.clone()).or_insert(0) += 1;
            }
        }
        
        // Calculate average duration
        let average_workout_duration = if total_workouts > 0 {
            total_duration_minutes as f32 / total_workouts as f32
        } else {
            0.0
        };
        
        // Get top favorite exercises
        let mut exercise_vec: Vec<(String, i32)> = exercise_counts
            .into_iter()
            .collect::<Vec<_>>();
        exercise_vec.sort_by(|a, b| b.1.cmp(&a.1));
        let favorite_exercises: Vec<String> = exercise_vec
            .into_iter()
            .take(5)
            .map(|(name, _)| name)
            .collect();
        
        // Calculate streak (simplified - would need proper date sequence analysis)
        let current_streak = if workouts_this_week > 0 { workouts_this_week } else { 0 };
        let longest_streak = current_streak; // Simplified - would need historical analysis
        
        // Calculate calories burned
        // Average calories per minute for strength training: ~6 calories/min
        let calories_per_minute = 6.0;
        let calories_burned_this_week = (duration_this_week as f32 * calories_per_minute) as i32;
        let calories_burned_total = (total_duration_minutes as f32 * calories_per_minute) as i32;
        
        // Fetch strength progress data
        let strength_result = self.client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk_prefix)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
            .expression_attribute_values(":sk_prefix", AttributeValue::S("STRENGTH#".to_string()))
            .send()
            .await?;

        let strength_items = strength_result.items.unwrap_or_default();
        let mut strength_progress = Vec::new();
        
        for item in strength_items {
            if let (Some(exercise_id), Some(exercise_name), Some(one_rep_max), Some(last_updated)) = (
                item.get("ExerciseId").and_then(|v| v.as_s().ok()),
                item.get("ExerciseName").and_then(|v| v.as_s().ok()),
                item.get("OneRepMax").and_then(|v| v.as_n().ok()).and_then(|n| n.parse::<f32>().ok()),
                item.get("LastUpdated").and_then(|v| v.as_s().ok()),
            ) {
                strength_progress.push(StrengthProgress {
                    exercise_id: exercise_id.clone(),
                    exercise_name: exercise_name.clone(),
                    one_rep_max,
                    last_updated: last_updated.clone(),
                    progress_percentage: 5.0, // Simplified - would calculate from historical data
                });
            }
        }
        
        // Fetch body measurements
        let measurements_result = self.client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk_prefix)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
            .expression_attribute_values(":sk_prefix", AttributeValue::S("MEASUREMENT#".to_string()))
            .send()
            .await?;

        let measurement_items = measurements_result.items.unwrap_or_default();
        let mut body_measurements = Vec::new();
        
        for item in measurement_items {
            if let (Some(measurement_type), Some(value), Some(unit), Some(measured_at)) = (
                item.get("MeasurementType").and_then(|v| v.as_s().ok()),
                item.get("Value").and_then(|v| v.as_n().ok()).and_then(|n| n.parse::<f32>().ok()),
                item.get("Unit").and_then(|v| v.as_s().ok()),
                item.get("MeasuredAt").and_then(|v| v.as_s().ok()),
            ) {
                body_measurements.push(BodyMeasurement {
                    measurement_type: measurement_type.clone(),
                    value,
                    unit: unit.clone(),
                    measured_at: measured_at.clone(),
                });
            }
        }
        
        let analytics = WorkoutAnalytics {
            user_id,
            total_workouts,
            total_duration_minutes,
            current_streak,
            longest_streak,
            favorite_exercises,
            average_workout_duration,
            workouts_this_week,
            workouts_this_month,
            last_workout_date,
            strength_progress,
            body_measurements,
            calories_burned_this_week,
            calories_burned_total,
        };
        
        Ok(serde_json::to_value(analytics)?)
    }

    pub async fn get_workout_insights(&self, user_id: &str, time_range: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        // Get actual analytics data first
        let analytics_result = self.get_workout_analytics(Some(user_id.to_string())).await?;
        let analytics: WorkoutAnalytics = serde_json::from_value(analytics_result)?;
        
        // Generate insights based on actual data
        let mut insights = Vec::new();
        let mut recommendations = Vec::new();
        let mut achievements = Vec::new();
        let mut risk_factors = Vec::new();
        let mut risk_recommendations = Vec::new();
        
        // Consistency insights
        if analytics.workouts_this_week >= 3 {
            insights.push("Excellent workout consistency this week!".to_string());
            achievements.push(format!("Completed {} workouts this week", analytics.workouts_this_week));
        } else if analytics.workouts_this_week >= 1 {
            insights.push("Good start this week, consider adding one more workout.".to_string());
            recommendations.push("Try to maintain at least 3 workouts per week for optimal results".to_string());
        } else {
            insights.push("Let's get back into a consistent routine.".to_string());
            recommendations.push("Start with 2-3 workouts this week to rebuild momentum".to_string());
            risk_factors.push("Low workout frequency".to_string());
            risk_recommendations.push("Increase workout frequency gradually".to_string());
        }
        
        // Duration insights
        if analytics.average_workout_duration > 90.0 {
            insights.push("Your workouts are quite long - consider if you're maintaining intensity throughout.".to_string());
            recommendations.push("Try shorter, more intense sessions (45-75 minutes)".to_string());
        } else if analytics.average_workout_duration < 30.0 && analytics.total_workouts > 0 {
            insights.push("Your workouts are quite short - you might benefit from longer sessions.".to_string());
            recommendations.push("Aim for 45-60 minute sessions for optimal muscle growth".to_string());
        } else if analytics.average_workout_duration >= 45.0 && analytics.average_workout_duration <= 75.0 {
            insights.push("Great workout duration! You're hitting the sweet spot.".to_string());
        }
        
        // Strength progress insights
        if !analytics.strength_progress.is_empty() {
            insights.push("You're tracking strength progress - keep it up!".to_string());
            achievements.push(format!("Tracking {} exercises for strength progress", analytics.strength_progress.len()));
        } else {
            recommendations.push("Consider tracking your strength progress to see improvements over time".to_string());
        }
        
        // Body measurements insights
        if !analytics.body_measurements.is_empty() {
            insights.push("Great job tracking body measurements!".to_string());
            achievements.push(format!("Tracking {} body measurements", analytics.body_measurements.len()));
        } else {
            recommendations.push("Consider tracking body measurements to monitor your progress".to_string());
        }
        
        // Streak insights
        if analytics.current_streak >= 7 {
            insights.push("Amazing streak! You're on fire!".to_string());
            achievements.push(format!("{} day workout streak", analytics.current_streak));
        } else if analytics.current_streak >= 3 {
            insights.push("Good streak! Keep the momentum going.".to_string());
        } else if analytics.current_streak == 0 && analytics.total_workouts > 0 {
            insights.push("Time to start a new streak!".to_string());
            recommendations.push("Try to work out today to start building consistency".to_string());
        }
        
        // Favorite exercises insights
        if !analytics.favorite_exercises.is_empty() {
            insights.push(format!("Your favorite exercises are: {}", analytics.favorite_exercises.join(", ")));
            recommendations.push("Consider adding variety to your routine to work different muscle groups".to_string());
        }
        
        // Overall assessment
        let overall_score = self.calculate_overall_score(&analytics);
        let overall_assessment = if overall_score >= 80 {
            "Excellent! You're doing great with your fitness routine."
        } else if overall_score >= 60 {
            "Good progress! There's room for improvement."
        } else if overall_score >= 40 {
            "You're on the right track, but consistency could be better."
        } else {
            "Let's work on building a more consistent routine."
        };
        
        insights.push(overall_assessment.to_string());
        
        let insights_data = WorkoutInsights {
            user_id: user_id.to_string(),
            time_range: time_range.to_string(),
            overall_score,
            insights,
            recommendations,
            achievements,
            risk_factors,
            risk_recommendations,
            generated_at: Utc::now().to_rfc3339(),
        };
        
        Ok(serde_json::to_value(insights_data)?)
    }

    pub async fn get_workout_history(&self, user_id: &str, limit: Option<i32>) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let limit = limit.unwrap_or(50);
        
        let sessions_result = self.client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk_prefix)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
            .expression_attribute_values(":sk_prefix", AttributeValue::S("SESSION#".to_string()))
            .limit(limit)
            .scan_index_forward(false) // Most recent first
            .send()
            .await?;

        let sessions = sessions_result.items.unwrap_or_default();
        
        let history: Vec<WorkoutSession> = sessions
            .into_iter()
            .filter_map(|item| {
                Some(WorkoutSession {
                    id: item.get("SessionId").or_else(|| item.get("id")).and_then(|v| v.as_s().ok())?.clone(),
                    user_id: item.get("UserId").or_else(|| item.get("userId")).and_then(|v| v.as_s().ok())?.clone(),
                    workout_plan_id: item.get("WorkoutPlanId").or_else(|| item.get("workoutPlanId")).and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    name: item.get("Name").or_else(|| item.get("name")).and_then(|v| v.as_s().ok())?.clone(),
                    started_at: item.get("StartedAt").or_else(|| item.get("startedAt")).and_then(|v| v.as_s().ok())?.clone(),
                    completed_at: item.get("CompletedAt").or_else(|| item.get("completedAt")).and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    duration_minutes: item.get("DurationMinutes").or_else(|| item.get("durationMinutes")).and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                    notes: item.get("Notes").or_else(|| item.get("notes")).and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    rating: item.get("Rating").or_else(|| item.get("rating")).and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                    created_at: item.get("CreatedAt").or_else(|| item.get("createdAt")).and_then(|v| v.as_s().ok())?.clone(),
                    updated_at: item.get("UpdatedAt").or_else(|| item.get("updatedAt")).and_then(|v| v.as_s().ok())?.clone(),
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
        
        Ok(serde_json::to_value(history)?)
    }

    fn calculate_overall_score(&self, analytics: &WorkoutAnalytics) -> i32 {
        let mut score = 0;
        
        // Consistency score (40 points max)
        if analytics.workouts_this_week >= 4 {
            score += 40;
        } else if analytics.workouts_this_week >= 3 {
            score += 30;
        } else if analytics.workouts_this_week >= 2 {
            score += 20;
        } else if analytics.workouts_this_week >= 1 {
            score += 10;
        }
        
        // Duration score (20 points max)
        if analytics.average_workout_duration >= 45.0 && analytics.average_workout_duration <= 75.0 {
            score += 20;
        } else if analytics.average_workout_duration >= 30.0 && analytics.average_workout_duration <= 90.0 {
            score += 15;
        } else if analytics.average_workout_duration > 0.0 {
            score += 10;
        }
        
        // Progress tracking score (20 points max)
        if !analytics.strength_progress.is_empty() {
            score += 10;
        }
        if !analytics.body_measurements.is_empty() {
            score += 10;
        }
        
        // Streak score (20 points max)
        if analytics.current_streak >= 7 {
            score += 20;
        } else if analytics.current_streak >= 3 {
            score += 15;
        } else if analytics.current_streak >= 1 {
            score += 10;
        }
        
        score
    }
}
