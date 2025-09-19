use serde_json::Value;
use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use chrono::Utc;
use anyhow::Result;

use crate::models::*;

// Workout Recommendation Database Operations
pub async fn get_workout_recommendations_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("WORKOUT_RECOMMENDATIONS".to_string()));
    
    if let Some(uid) = user_id {
        query = query
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(uid));
    }
    
    let result = query.send().await?;
    
    let recommendations: Vec<WorkoutRecommendation> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(WorkoutRecommendation {
                id: item.get("id")?.as_s().ok()?.clone(),
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                recommendation_type: item.get("recommendationType")?.as_s().ok()?.clone(),
                title: item.get("title")?.as_s().ok()?.clone(),
                description: item.get("description")?.as_s().ok()?.clone(),
                reasoning: item.get("reasoning")?.as_s().ok()?.clone(),
                priority: item.get("priority")?.as_n().ok()?.parse().ok()?,
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                expires_at: item.get("expiresAt").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                is_applied: *item.get("isApplied")?.as_bool().ok()?,
                metadata: serde_json::Value::Null,
            })
        })
        .collect();
    
    Ok(serde_json::to_value(recommendations)?)
}

pub async fn create_workout_recommendation_in_db(
    recommendation: &WorkoutRecommendation,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("WORKOUT_RECOMMENDATIONS".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("RECOMMENDATION#{}", recommendation.id)));
    item.insert("id".to_string(), AttributeValue::S(recommendation.id.clone()));
    item.insert("userId".to_string(), AttributeValue::S(recommendation.user_id.clone()));
    item.insert("recommendationType".to_string(), AttributeValue::S(recommendation.recommendation_type.clone()));
    item.insert("title".to_string(), AttributeValue::S(recommendation.title.clone()));
    item.insert("description".to_string(), AttributeValue::S(recommendation.description.clone()));
    item.insert("reasoning".to_string(), AttributeValue::S(recommendation.reasoning.clone()));
    item.insert("priority".to_string(), AttributeValue::N(recommendation.priority.to_string()));
    item.insert("createdAt".to_string(), AttributeValue::S(recommendation.created_at.clone()));
    item.insert("isApplied".to_string(), AttributeValue::Bool(recommendation.is_applied));
    item.insert("metadata".to_string(), AttributeValue::S(serde_json::to_string(&recommendation.metadata)?));
    
    if let Some(expires_at) = &recommendation.expires_at {
        item.insert("expiresAt".to_string(), AttributeValue::S(expires_at.clone()));
    }
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(recommendation)?)
}

// Adaptive Plan Database Operations
pub async fn get_adaptive_plans_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("ADAPTIVE_PLANS".to_string()));
    
    if let Some(uid) = user_id {
        query = query
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(uid));
    }
    
    let result = query.send().await?;
    
    let plans: Vec<AdaptivePlan> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(AdaptivePlan {
                id: item.get("id")?.as_s().ok()?.clone(),
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                base_plan_id: item.get("basePlanId")?.as_s().ok()?.clone(),
                adaptations: item.get("adaptations")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| {
                        let obj = v.as_m().ok()?;
                        Some(PlanAdaptation {
                            exercise_id: obj.get("exerciseId")?.as_s().ok()?.clone(),
                            adaptation_type: obj.get("adaptationType")?.as_s().ok()?.clone(),
                            original_exercise: None,
                            new_exercise: None,
                            modifications: None,
                            reason: obj.get("reason")?.as_s().ok()?.clone(),
                        })
                    }).collect())
                    .unwrap_or_default(),
                adaptation_reason: item.get("adaptationReason")?.as_s().ok()?.clone(),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
                is_active: *item.get("isActive")?.as_bool().ok()?,
            })
        })
        .collect();
    
    Ok(serde_json::to_value(plans)?)
}

pub async fn create_adaptive_plan_in_db(
    plan: &AdaptivePlan,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("ADAPTIVE_PLANS".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("PLAN#{}", plan.id)));
    item.insert("id".to_string(), AttributeValue::S(plan.id.clone()));
    item.insert("userId".to_string(), AttributeValue::S(plan.user_id.clone()));
    item.insert("basePlanId".to_string(), AttributeValue::S(plan.base_plan_id.clone()));
    item.insert("adaptationReason".to_string(), AttributeValue::S(plan.adaptation_reason.clone()));
    item.insert("createdAt".to_string(), AttributeValue::S(plan.created_at.clone()));
    item.insert("updatedAt".to_string(), AttributeValue::S(plan.updated_at.clone()));
    item.insert("isActive".to_string(), AttributeValue::Bool(plan.is_active));
    
    // Add adaptations as a list of maps
    let adaptations: Vec<AttributeValue> = plan.adaptations
        .iter()
        .map(|adaptation| {
            let mut adaptation_map = std::collections::HashMap::new();
            adaptation_map.insert("exerciseId".to_string(), AttributeValue::S(adaptation.exercise_id.clone()));
            adaptation_map.insert("adaptationType".to_string(), AttributeValue::S(adaptation.adaptation_type.clone()));
            adaptation_map.insert("reason".to_string(), AttributeValue::S(adaptation.reason.clone()));
            
            if let Some(original) = &adaptation.original_exercise {
                adaptation_map.insert("originalExercise".to_string(), AttributeValue::S(serde_json::to_string(original).unwrap_or_default()));
            }
            if let Some(new) = &adaptation.new_exercise {
                adaptation_map.insert("newExercise".to_string(), AttributeValue::S(serde_json::to_string(new).unwrap_or_default()));
            }
            if let Some(modifications) = &adaptation.modifications {
                adaptation_map.insert("modifications".to_string(), AttributeValue::S(serde_json::to_string(modifications).unwrap_or_default()));
            }
            
            AttributeValue::M(adaptation_map)
        })
        .collect();
    item.insert("adaptations".to_string(), AttributeValue::L(adaptations));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(plan)?)
}

// Exercise Substitution Database Operations
pub async fn get_exercise_substitutions_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("EXERCISE_SUBSTITUTIONS".to_string()));
    
    if let Some(uid) = user_id {
        query = query
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(uid));
    }
    
    let result = query.send().await?;
    
    let substitutions: Vec<ExerciseSubstitution> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(ExerciseSubstitution {
                original_exercise_id: item.get("originalExerciseId")?.as_s().ok()?.clone(),
                substitute_exercise_id: item.get("substituteExerciseId")?.as_s().ok()?.clone(),
                reason: item.get("reason")?.as_s().ok()?.clone(),
                confidence_score: item.get("confidenceScore")?.as_n().ok()?.parse().ok()?,
                muscle_groups_match: item.get("muscleGroupsMatch")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    .unwrap_or_default(),
                equipment_available: *item.get("equipmentAvailable")?.as_bool().ok()?,
                difficulty_match: *item.get("difficultyMatch")?.as_bool().ok()?,
            })
        })
        .collect();
    
    Ok(serde_json::to_value(substitutions)?)
}

// Recovery Plan Database Operations
pub async fn get_recovery_plans_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("RECOVERY_PLANS".to_string()));
    
    if let Some(uid) = user_id {
        query = query
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(uid));
    }
    
    let result = query.send().await?;
    
    let plans: Vec<RecoveryPlan> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(RecoveryPlan {
                id: item.get("id")?.as_s().ok()?.clone(),
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                plan_type: item.get("planType")?.as_s().ok()?.clone(),
                duration_days: item.get("durationDays")?.as_n().ok()?.parse().ok()?,
                activities: item.get("activities")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| {
                        let obj = v.as_m().ok()?;
                        Some(RecoveryActivity {
                            id: obj.get("id")?.as_s().ok()?.clone(),
                            name: obj.get("name")?.as_s().ok()?.clone(),
                            activity_type: obj.get("activityType")?.as_s().ok()?.clone(),
                            duration_minutes: obj.get("durationMinutes")?.as_n().ok()?.parse().ok()?,
                            intensity: obj.get("intensity")?.as_s().ok()?.clone(),
                            instructions: obj.get("instructions")
                                .and_then(|v| v.as_l().ok())
                                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                                .unwrap_or_default(),
                            equipment_needed: obj.get("equipmentNeeded")
                                .and_then(|v| v.as_l().ok())
                                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                                .unwrap_or_default(),
                            order: obj.get("order")?.as_n().ok()?.parse().ok()?,
                        })
                    }).collect())
                    .unwrap_or_default(),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                starts_at: item.get("startsAt")?.as_s().ok()?.clone(),
                ends_at: item.get("endsAt")?.as_s().ok()?.clone(),
                is_completed: *item.get("isCompleted")?.as_bool().ok()?,
            })
        })
        .collect();
    
    Ok(serde_json::to_value(plans)?)
}

// User Fitness Profile Database Operations
pub async fn get_user_fitness_profile_from_db(
    user_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S("USER_FITNESS_PROFILES".to_string()))
        .key("SK", AttributeValue::S(format!("PROFILE#{}", user_id)))
        .send()
        .await?;

    if let Some(item) = result.item {
        let profile = UserFitnessProfile {
            user_id: item.get("userId").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            experience_level: item.get("experienceLevel").and_then(|v| v.as_s().ok()).map_or("beginner", |v| v).to_string(),
            fitness_goals: item.get("fitnessGoals")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                .unwrap_or_default(),
            current_strength_levels: std::collections::HashMap::new(),
            recent_performance: vec![],
            injury_history: vec![],
            preferences: UserPreferences {
                workout_duration_preference: 60,
                frequency_preference: 3,
                intensity_preference: "moderate".to_string(),
                equipment_available: vec![],
                time_of_day_preference: "evening".to_string(),
                workout_types: vec!["strength".to_string()],
                avoid_exercises: vec![],
                preferred_exercises: vec![],
            },
            last_updated: item.get("lastUpdated").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
        };
        
        Ok(serde_json::to_value(profile)?)
    } else {
        Err("User fitness profile not found".into())
    }
}

pub async fn update_user_fitness_profile_in_db(
    profile: &UserFitnessProfile,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S("USER_FITNESS_PROFILES".to_string()));
    item.insert("SK".to_string(), AttributeValue::S(format!("PROFILE#{}", profile.user_id)));
    item.insert("userId".to_string(), AttributeValue::S(profile.user_id.clone()));
    item.insert("experienceLevel".to_string(), AttributeValue::S(profile.experience_level.clone()));
    item.insert("lastUpdated".to_string(), AttributeValue::S(profile.last_updated.clone()));
    
    // Add fitness goals as a list
    let fitness_goals: Vec<AttributeValue> = profile.fitness_goals
        .iter()
        .map(|goal| AttributeValue::S(goal.clone()))
        .collect();
    item.insert("fitnessGoals".to_string(), AttributeValue::L(fitness_goals));
    
    // Add strength levels as a map
    let strength_levels = serde_json::to_string(&profile.current_strength_levels)?;
    item.insert("currentStrengthLevels".to_string(), AttributeValue::S(strength_levels));
    
    // Add recent performance as a list
    let recent_performance: Vec<AttributeValue> = profile.recent_performance
        .iter()
        .map(|perf| AttributeValue::S(serde_json::to_string(perf).unwrap_or_default()))
        .collect();
    item.insert("recentPerformance".to_string(), AttributeValue::L(recent_performance));
    
    // Add injury history as a list
    let injury_history: Vec<AttributeValue> = profile.injury_history
        .iter()
        .map(|injury| AttributeValue::S(serde_json::to_string(injury).unwrap_or_default()))
        .collect();
    item.insert("injuryHistory".to_string(), AttributeValue::L(injury_history));
    
    // Add preferences as a map
    let preferences = serde_json::to_string(&profile.preferences)?;
    item.insert("preferences".to_string(), AttributeValue::S(preferences));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(profile)?)
}

// Coaching Rules Database Operations
pub async fn get_coaching_rules_from_db(
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("COACHING_RULES".to_string()))
        .send()
        .await?;
    
    let rules: Vec<CoachingRule> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(CoachingRule {
                id: item.get("id")?.as_s().ok()?.clone(),
                rule_type: item.get("ruleType")?.as_s().ok()?.clone(),
                condition: RuleCondition {
                    field: "completion_rate".to_string(),
                    operator: ">=".to_string(),
                    value: serde_json::Value::Number(serde_json::Number::from(0)),
                    time_window: Some(7),
                },
                action: RuleAction {
                    action_type: "modify_plan".to_string(),
                    parameters: std::collections::HashMap::new(),
                    message: "Default action".to_string(),
                },
                priority: item.get("priority")?.as_n().ok()?.parse().ok()?,
                is_active: *item.get("isActive")?.as_bool().ok()?,
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(rules)?)
}

// Progress Metrics Database Operations
pub async fn get_progress_metrics_from_db(
    user_id: Option<String>,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let mut query = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk")
        .expression_attribute_values(":pk", AttributeValue::S("PROGRESS_METRICS".to_string()));
    
    if let Some(uid) = user_id {
        query = query
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(uid));
    }
    
    let result = query.send().await?;
    
    let metrics: Vec<ProgressMetrics> = result
        .items
        .unwrap_or_default()
        .into_iter()
        .filter_map(|item| {
            Some(ProgressMetrics {
                user_id: item.get("userId")?.as_s().ok()?.clone(),
                period: item.get("period")?.as_s().ok()?.clone(),
                start_date: item.get("startDate")?.as_s().ok()?.clone(),
                end_date: item.get("endDate")?.as_s().ok()?.clone(),
                strength_gains: std::collections::HashMap::new(),
                volume_increase: item.get("volumeIncrease")?.as_n().ok()?.parse().ok()?,
                consistency_score: item.get("consistencyScore")?.as_n().ok()?.parse().ok()?,
                improvement_areas: item.get("improvementAreas")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    .unwrap_or_default(),
                recommendations: item.get("recommendations")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    .unwrap_or_default(),
                created_at: item.get("createdAt")?.as_s().ok()?.clone(),
            })
        })
        .collect();
    
    Ok(serde_json::to_value(metrics)?)
}
