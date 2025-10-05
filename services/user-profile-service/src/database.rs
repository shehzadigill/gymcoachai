use serde_json::Value;
use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use aws_sdk_s3::Client as S3Client;
use chrono::Utc;
use anyhow::Result;

use crate::models::*;

pub async fn get_user_profile_from_db(
    user_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
        .key("SK", AttributeValue::S("PROFILE".to_string()))
        .send()
        .await?;

    if let Some(item) = result.item {
        let profile = UserProfile {
            first_name: item.get("firstName").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            last_name: item.get("lastName").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            email: item.get("email").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            bio: item.get("bio").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            date_of_birth: item.get("dateOfBirth").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            height: item.get("height").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
            weight: item.get("weight").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
            fitness_goals: item.get("fitnessGoals")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.to_string())).collect())
                .unwrap_or_default(),
            experience_level: item.get("experienceLevel").and_then(|v| v.as_s().ok()).map_or("beginner", |v| v).to_string(),
            profile_image_url: item.get("profileImageUrl").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            preferences: UserPreferences {
                units: item.get("units").and_then(|v| v.as_s().ok()).map_or("metric", |v| v).to_string(),
                timezone: item.get("timezone").and_then(|v| v.as_s().ok()).map_or("UTC", |v| v).to_string(),
                notifications: NotificationSettings {
                    email: *item.get("emailNotifications").and_then(|v| v.as_bool().ok()).unwrap_or(&true),
                    push: *item.get("pushNotifications").and_then(|v| v.as_bool().ok()).unwrap_or(&true),
                    workout_reminders: *item.get("workoutReminders").and_then(|v| v.as_bool().ok()).unwrap_or(&true),
                    nutrition_reminders: *item.get("nutritionReminders").and_then(|v| v.as_bool().ok()).unwrap_or(&true),
                },
                privacy: PrivacySettings {
                    profile_visibility: item.get("profileVisibility").and_then(|v| v.as_s().ok()).map_or("private", |v| v).to_string(),
                    workout_sharing: *item.get("workoutSharing").and_then(|v| v.as_bool().ok()).unwrap_or(&false),
                    progress_sharing: *item.get("progressSharing").and_then(|v| v.as_bool().ok()).unwrap_or(&false),
                },
            },
            gender: item.get("gender").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            fitness_level: item.get("fitnessLevel").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
        };
        
        Ok(serde_json::to_value(profile)?)
    } else {
        Err("User profile not found".into())
    }
}

pub async fn update_user_profile_in_db(
    user_id: &str,
    profile: &UserProfile,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let now = Utc::now().to_rfc3339();
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", user_id)));
    item.insert("SK".to_string(), AttributeValue::S("PROFILE".to_string()));
    item.insert("firstName".to_string(), AttributeValue::S(profile.first_name.clone()));
    item.insert("lastName".to_string(), AttributeValue::S(profile.last_name.clone()));
    item.insert("email".to_string(), AttributeValue::S(profile.email.clone()));
    item.insert("experienceLevel".to_string(), AttributeValue::S(profile.experience_level.clone()));
    item.insert("units".to_string(), AttributeValue::S(profile.preferences.units.clone()));
    item.insert("timezone".to_string(), AttributeValue::S(profile.preferences.timezone.clone()));
    item.insert("updatedAt".to_string(), AttributeValue::S(now.clone()));
    
    if let Some(bio) = &profile.bio {
        item.insert("bio".to_string(), AttributeValue::S(bio.clone()));
    }
    if let Some(dob) = &profile.date_of_birth {
        item.insert("dateOfBirth".to_string(), AttributeValue::S(dob.clone()));
    }
    if let Some(height) = profile.height {
        item.insert("height".to_string(), AttributeValue::N(height.to_string()));
    }
    if let Some(weight) = profile.weight {
        item.insert("weight".to_string(), AttributeValue::N(weight.to_string()));
    }
    if let Some(image_url) = &profile.profile_image_url {
        item.insert("profileImageUrl".to_string(), AttributeValue::S(image_url.clone()));
    }
    if let Some(gender) = &profile.gender {
        item.insert("gender".to_string(), AttributeValue::S(gender.clone()));
    }
    if let Some(fitness_level) = &profile.fitness_level {
        item.insert("fitnessLevel".to_string(), AttributeValue::S(fitness_level.clone()));
    }
    
    // Add fitness goals as a list
    let fitness_goals: Vec<AttributeValue> = profile.fitness_goals
        .iter()
        .map(|goal| AttributeValue::S(goal.clone()))
        .collect();
    item.insert("fitnessGoals".to_string(), AttributeValue::L(fitness_goals));
    
    // Add notification settings
    item.insert("emailNotifications".to_string(), AttributeValue::Bool(profile.preferences.notifications.email));
    item.insert("pushNotifications".to_string(), AttributeValue::Bool(profile.preferences.notifications.push));
    item.insert("workoutReminders".to_string(), AttributeValue::Bool(profile.preferences.notifications.workout_reminders));
    item.insert("nutritionReminders".to_string(), AttributeValue::Bool(profile.preferences.notifications.nutrition_reminders));
    
    // Add privacy settings
    item.insert("profileVisibility".to_string(), AttributeValue::S(profile.preferences.privacy.profile_visibility.clone()));
    item.insert("workoutSharing".to_string(), AttributeValue::Bool(profile.preferences.privacy.workout_sharing));
    item.insert("progressSharing".to_string(), AttributeValue::Bool(profile.preferences.privacy.progress_sharing));
    
    // Set created_at if this is a new profile
    if profile.created_at.is_empty() {
        item.insert("createdAt".to_string(), AttributeValue::S(now.clone()));
    } else {
        item.insert("createdAt".to_string(), AttributeValue::S(profile.created_at.clone()));
    }
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(profile)?)
}

pub async fn get_user_stats_from_db(
    user_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
        .key("SK", AttributeValue::S("STATS".to_string()))
        .send()
        .await?;

    if let Some(item) = result.item {
        let stats = UserStats {
            total_workouts: item.get("totalWorkouts").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            total_workout_time: item.get("totalWorkoutTime").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            current_streak: item.get("currentStreak").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            longest_streak: item.get("longestStreak").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            favorite_exercises: item.get("favoriteExercises")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.to_string())).collect())
                .unwrap_or_default(),
            achievements: item.get("achievements")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.to_string())).collect())
                .unwrap_or_default(),
            last_workout_date: item.get("lastWorkoutDate").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
        };
        
        Ok(serde_json::to_value(stats)?)
    } else {
        // Return default stats if not found
        let default_stats = UserStats {
            total_workouts: 0,
            total_workout_time: 0,
            current_streak: 0,
            longest_streak: 0,
            favorite_exercises: vec![],
            achievements: vec![],
            last_workout_date: None,
        };
        Ok(serde_json::to_value(default_stats)?)
    }
}

pub async fn get_user_preferences_from_db(
    user_id: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
        .key("SK", AttributeValue::S("PREFERENCES".to_string()))
        .send()
        .await?;

    if let Some(item) = result.item {
        let preferences = UserPreferences {
            units: item.get("units").and_then(|v| v.as_s().ok()).map_or("metric", |v| v).to_string(),
            timezone: item.get("timezone").and_then(|v| v.as_s().ok()).map_or("UTC", |v| v).to_string(),
            notifications: NotificationSettings {
                email: *item.get("emailNotifications").and_then(|v| v.as_bool().ok()).unwrap_or(&true),
                push: *item.get("pushNotifications").and_then(|v| v.as_bool().ok()).unwrap_or(&true),
                workout_reminders: *item.get("workoutReminders").and_then(|v| v.as_bool().ok()).unwrap_or(&true),
                nutrition_reminders: *item.get("nutritionReminders").and_then(|v| v.as_bool().ok()).unwrap_or(&true),
            },
            privacy: PrivacySettings {
                profile_visibility: item.get("profileVisibility").and_then(|v| v.as_s().ok()).map_or("private", |v| v).to_string(),
                workout_sharing: *item.get("workoutSharing").and_then(|v| v.as_bool().ok()).unwrap_or(&false),
                progress_sharing: *item.get("progressSharing").and_then(|v| v.as_bool().ok()).unwrap_or(&false),
            },
        };
        
        Ok(serde_json::to_value(preferences)?)
    } else {
        // Return default preferences if not found
        let default_preferences = UserPreferences {
            units: "metric".to_string(),
            timezone: "UTC".to_string(),
            notifications: NotificationSettings {
                email: true,
                push: true,
                workout_reminders: true,
                nutrition_reminders: true,
            },
            privacy: PrivacySettings {
                profile_visibility: "private".to_string(),
                workout_sharing: false,
                progress_sharing: false,
            },
        };
        Ok(serde_json::to_value(default_preferences)?)
    }
}

pub async fn update_user_preferences_in_db(
    user_id: &str,
    preferences: &UserPreferences,
    dynamodb_client: &DynamoDbClient,
) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let now = Utc::now().to_rfc3339();
    
    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", user_id)));
    item.insert("SK".to_string(), AttributeValue::S("PREFERENCES".to_string()));
    item.insert("units".to_string(), AttributeValue::S(preferences.units.clone()));
    item.insert("timezone".to_string(), AttributeValue::S(preferences.timezone.clone()));
    item.insert("emailNotifications".to_string(), AttributeValue::Bool(preferences.notifications.email));
    item.insert("pushNotifications".to_string(), AttributeValue::Bool(preferences.notifications.push));
    item.insert("workoutReminders".to_string(), AttributeValue::Bool(preferences.notifications.workout_reminders));
    item.insert("nutritionReminders".to_string(), AttributeValue::Bool(preferences.notifications.nutrition_reminders));
    item.insert("profileVisibility".to_string(), AttributeValue::S(preferences.privacy.profile_visibility.clone()));
    item.insert("workoutSharing".to_string(), AttributeValue::Bool(preferences.privacy.workout_sharing));
    item.insert("progressSharing".to_string(), AttributeValue::Bool(preferences.privacy.progress_sharing));
    item.insert("updatedAt".to_string(), AttributeValue::S(now));
    
    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;
    
    Ok(serde_json::to_value(preferences)?)
}

pub async fn delete_user_profile_from_db(
    user_id: &str,
    dynamodb_client: &DynamoDbClient,
    s3_client: &S3Client,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    // Delete profile from DynamoDB
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
        .key("SK", AttributeValue::S("PROFILE".to_string()))
        .send()
        .await?;
    
    // Delete preferences
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
        .key("SK", AttributeValue::S("PREFERENCES".to_string()))
        .send()
        .await?;
    
    // Delete stats
    dynamodb_client
        .delete_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
        .key("SK", AttributeValue::S("STATS".to_string()))
        .send()
        .await?;
    
    // Delete user's S3 objects (profile images, etc.)
    let bucket_name = "gymcoach-ai-user-uploads";
    let prefix = format!("user-profiles/{}/", user_id);
    
    let list_result = s3_client
        .list_objects_v2()
        .bucket(bucket_name)
        .prefix(&prefix)
        .send()
        .await?;
    
    if let Some(objects) = list_result.contents {
        for object in objects {
            if let Some(key) = object.key {
                let _ = s3_client
                    .delete_object()
                    .bucket(bucket_name)
                    .key(&key)
                    .send()
                    .await;
            }
        }
    }
    
    Ok(())
}

// Sleep tracking database functions
pub async fn get_sleep_data_from_db(
    user_id: &str,
    date: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<Option<SleepData>, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .get_item()
        .table_name(&table_name)
        .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
        .key("SK", AttributeValue::S(format!("SLEEP#{}", date)))
        .send()
        .await?;

    if let Some(item) = result.item {
        let sleep_data = SleepData {
            user_id: user_id.to_string(),
            date: date.to_string(),
            hours: item.get("hours").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(0),
            minutes: item.get("minutes").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
            quality: item.get("quality").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
            bed_time: item.get("bedTime").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            wake_time: item.get("wakeTime").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
            created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).map_or_else(|| Utc::now().to_rfc3339(), |v| v.to_string()),
            updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).map_or_else(|| Utc::now().to_rfc3339(), |v| v.to_string()),
        };
        Ok(Some(sleep_data))
    } else {
        Ok(None)
    }
}

pub async fn save_sleep_data_to_db(
    sleep_data: &SleepData,
    dynamodb_client: &DynamoDbClient,
) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    let now = Utc::now().to_rfc3339();

    let mut item = std::collections::HashMap::new();
    item.insert("PK".to_string(), AttributeValue::S(format!("USER#{}", sleep_data.user_id)));
    item.insert("SK".to_string(), AttributeValue::S(format!("SLEEP#{}", sleep_data.date)));
    item.insert("hours".to_string(), AttributeValue::N(sleep_data.hours.to_string()));
    item.insert("updatedAt".to_string(), AttributeValue::S(now.clone()));

    if let Some(minutes) = sleep_data.minutes {
        item.insert("minutes".to_string(), AttributeValue::N(minutes.to_string()));
    }
    if let Some(quality) = sleep_data.quality {
        item.insert("quality".to_string(), AttributeValue::N(quality.to_string()));
    }
    if let Some(bed_time) = &sleep_data.bed_time {
        item.insert("bedTime".to_string(), AttributeValue::S(bed_time.clone()));
    }
    if let Some(wake_time) = &sleep_data.wake_time {
        item.insert("wakeTime".to_string(), AttributeValue::S(wake_time.clone()));
    }
    if let Some(notes) = &sleep_data.notes {
        item.insert("notes".to_string(), AttributeValue::S(notes.clone()));
    }

    // Set createdAt only if it's a new record
    if sleep_data.created_at.is_empty() {
        item.insert("createdAt".to_string(), AttributeValue::S(now));
    } else {
        item.insert("createdAt".to_string(), AttributeValue::S(sleep_data.created_at.clone()));
    }

    dynamodb_client
        .put_item()
        .table_name(&table_name)
        .set_item(Some(item))
        .send()
        .await?;

    Ok(())
}

pub async fn get_sleep_history_from_db(
    user_id: &str,
    days: u32,
    dynamodb_client: &DynamoDbClient,
) -> Result<Vec<SleepData>, Box<dyn std::error::Error + Send + Sync>> {
    let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
    
    let result = dynamodb_client
        .query()
        .table_name(&table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
        .expression_attribute_values(":sk", AttributeValue::S("SLEEP#".to_string()))
        .scan_index_forward(false) // Most recent first
        .limit(days as i32)
        .send()
        .await?;

    let mut sleep_history = Vec::new();
    
    if let Some(items) = result.items {
        for item in items {
            if let (Some(date_sk), Some(hours)) = (
                item.get("SK").and_then(|v| v.as_s().ok()),
                item.get("hours").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok())
            ) {
                // Extract date from SK (format: "SLEEP#YYYY-MM-DD")
                if let Some(date) = date_sk.strip_prefix("SLEEP#") {
                    let sleep_data = SleepData {
                        user_id: user_id.to_string(),
                        date: date.to_string(),
                        hours,
                        minutes: item.get("minutes").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                        quality: item.get("quality").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()),
                        bed_time: item.get("bedTime").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                        wake_time: item.get("wakeTime").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                        notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                        created_at: item.get("createdAt").and_then(|v| v.as_s().ok()).map_or_else(|| Utc::now().to_rfc3339(), |v| v.to_string()),
                        updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).map_or_else(|| Utc::now().to_rfc3339(), |v| v.to_string()),
                    };
                    sleep_history.push(sleep_data);
                }
            }
        }
    }

    Ok(sleep_history)
}

pub async fn calculate_sleep_stats(
    user_id: &str,
    period: &str,
    dynamodb_client: &DynamoDbClient,
) -> Result<SleepStats, Box<dyn std::error::Error + Send + Sync>> {
    let days = match period {
        "week" => 7,
        "month" => 30,
        "year" => 365,
        _ => 30, // default to month
    };

    let sleep_history = get_sleep_history_from_db(user_id, days, dynamodb_client).await?;
    
    if sleep_history.is_empty() {
        return Ok(SleepStats {
            user_id: user_id.to_string(),
            period: period.to_string(),
            average_hours: 0.0,
            average_quality: 0.0,
            total_nights: 0,
            best_night: SleepNight {
                date: "".to_string(),
                hours: 0.0,
                quality: 0,
            },
            worst_night: SleepNight {
                date: "".to_string(),
                hours: 0.0,
                quality: 0,
            },
            consistency: 0.0,
            trend: "stable".to_string(),
            calculated_at: Utc::now().to_rfc3339(),
        });
    }

    // Calculate statistics
    let total_nights = sleep_history.len() as u32;
    let total_hours: f32 = sleep_history.iter()
        .map(|s| s.hours as f32 + (s.minutes.unwrap_or(0) as f32 / 60.0))
        .sum();
    let average_hours = total_hours / total_nights as f32;

    let qualities: Vec<u8> = sleep_history.iter()
        .filter_map(|s| s.quality)
        .collect();
    let average_quality = if qualities.is_empty() {
        0.0
    } else {
        qualities.iter().sum::<u8>() as f32 / qualities.len() as f32
    };

    // Find best and worst nights
    let mut best_night = SleepNight {
        date: sleep_history[0].date.clone(),
        hours: sleep_history[0].hours as f32 + (sleep_history[0].minutes.unwrap_or(0) as f32 / 60.0),
        quality: sleep_history[0].quality.unwrap_or(3),
    };
    let mut worst_night = best_night.clone();

    for sleep in &sleep_history {
        let total_sleep = sleep.hours as f32 + (sleep.minutes.unwrap_or(0) as f32 / 60.0);
        let quality = sleep.quality.unwrap_or(3);
        
        // Best night: highest quality, then highest duration
        if quality > best_night.quality || (quality == best_night.quality && total_sleep > best_night.hours) {
            best_night = SleepNight {
                date: sleep.date.clone(),
                hours: total_sleep,
                quality,
            };
        }
        
        // Worst night: lowest quality, then lowest duration
        if quality < worst_night.quality || (quality == worst_night.quality && total_sleep < worst_night.hours) {
            worst_night = SleepNight {
                date: sleep.date.clone(),
                hours: total_sleep,
                quality,
            };
        }
    }

    // Calculate consistency (how close to average)
    let variance: f32 = sleep_history.iter()
        .map(|s| {
            let total_sleep = s.hours as f32 + (s.minutes.unwrap_or(0) as f32 / 60.0);
            (total_sleep - average_hours).powi(2)
        })
        .sum::<f32>() / total_nights as f32;
    let std_deviation = variance.sqrt();
    let consistency = ((1.0 - (std_deviation / average_hours).min(1.0)) * 100.0).max(0.0);

    // Simple trend analysis (compare first half to second half)
    let trend = if sleep_history.len() >= 4 {
        let mid_point = sleep_history.len() / 2;
        let first_half_avg: f32 = sleep_history[mid_point..].iter()
            .map(|s| s.hours as f32 + (s.minutes.unwrap_or(0) as f32 / 60.0))
            .sum::<f32>() / (sleep_history.len() - mid_point) as f32;
        let second_half_avg: f32 = sleep_history[..mid_point].iter()
            .map(|s| s.hours as f32 + (s.minutes.unwrap_or(0) as f32 / 60.0))
            .sum::<f32>() / mid_point as f32;
        
        let diff = second_half_avg - first_half_avg;
        if diff > 0.5 {
            "improving"
        } else if diff < -0.5 {
            "declining"
        } else {
            "stable"
        }
    } else {
        "stable"
    };

    Ok(SleepStats {
        user_id: user_id.to_string(),
        period: period.to_string(),
        average_hours,
        average_quality,
        total_nights,
        best_night,
        worst_night,
        consistency,
        trend: trend.to_string(),
        calculated_at: Utc::now().to_rfc3339(),
    })
}
