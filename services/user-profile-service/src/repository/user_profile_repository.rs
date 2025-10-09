use serde_json::Value;
use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use aws_sdk_s3::Client as S3Client;
use chrono::Utc;
use anyhow::Result;

use crate::models::*;

#[derive(Clone)]
pub struct UserProfileRepository {
    dynamodb_client: DynamoDbClient,
    s3_client: S3Client,
    table_name: String,
}

impl UserProfileRepository {
    pub fn new(dynamodb_client: DynamoDbClient, s3_client: S3Client) -> Self {
        let table_name = std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
        Self {
            dynamodb_client,
            s3_client,
            table_name,
        }
    }

    pub async fn get_user_profile(&self, user_id: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self.dynamodb_client
            .get_item()
            .table_name(&self.table_name)
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
                    daily_goals: item.get("dailyGoals").and_then(|v| v.as_m().ok()).and_then(|goals_map| {
                        Some(DailyGoals {
                            calories: goals_map.get("calories").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(2000),
                            water: goals_map.get("water").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(8),
                            protein: goals_map.get("protein").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(150),
                            carbs: goals_map.get("carbs").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(200),
                            fat: goals_map.get("fat").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(65),
                        })
                    }),
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

    pub async fn update_user_profile(&self, user_id: &str, profile: &UserProfile) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
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
        
        // Add daily goals if present
        if let Some(daily_goals) = &profile.preferences.daily_goals {
            let mut goals_map = std::collections::HashMap::new();
            goals_map.insert("calories".to_string(), AttributeValue::N(daily_goals.calories.to_string()));
            goals_map.insert("water".to_string(), AttributeValue::N(daily_goals.water.to_string()));
            goals_map.insert("protein".to_string(), AttributeValue::N(daily_goals.protein.to_string()));
            goals_map.insert("carbs".to_string(), AttributeValue::N(daily_goals.carbs.to_string()));
            goals_map.insert("fat".to_string(), AttributeValue::N(daily_goals.fat.to_string()));
            item.insert("dailyGoals".to_string(), AttributeValue::M(goals_map));
        }
        
        // Set created_at if this is a new profile
        if profile.created_at.is_empty() {
            item.insert("createdAt".to_string(), AttributeValue::S(now.clone()));
        } else {
            item.insert("createdAt".to_string(), AttributeValue::S(profile.created_at.clone()));
        }
        
        self.dynamodb_client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(serde_json::to_value(profile)?)
    }

    pub async fn partial_update_user_profile(&self, user_id: &str, update_data: &Value) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let _now = Utc::now().to_rfc3339();
        
        // First, get the current profile
        let current_profile = self.get_user_profile(user_id).await?;
        let mut profile: UserProfile = serde_json::from_value(current_profile)?;
        
        // Update only the fields that are provided in the update_data
        if let Some(preferences_obj) = update_data.get("preferences") {
            if let Some(daily_goals_obj) = preferences_obj.get("dailyGoals") {
                let daily_goals = DailyGoals {
                    calories: daily_goals_obj.get("calories").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(2000),
                    water: daily_goals_obj.get("water").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(8),
                    protein: daily_goals_obj.get("protein").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(150),
                    carbs: daily_goals_obj.get("carbs").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(200),
                    fat: daily_goals_obj.get("fat").and_then(|v| v.as_i64()).map(|v| v as i32).unwrap_or(65),
                };
                profile.preferences.daily_goals = Some(daily_goals);
            }
        }
        
        // Update goals if provided
        if let Some(goals_arr) = update_data.get("goals").and_then(|v| v.as_array()) {
            profile.fitness_goals = goals_arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
        }
        
        // Update other fields if provided
        if let Some(first_name) = update_data.get("firstName").and_then(|v| v.as_str()) {
            profile.first_name = first_name.to_string();
        }
        if let Some(last_name) = update_data.get("lastName").and_then(|v| v.as_str()) {
            profile.last_name = last_name.to_string();
        }
        if let Some(bio) = update_data.get("bio").and_then(|v| v.as_str()) {
            profile.bio = Some(bio.to_string());
        }
        if let Some(gender) = update_data.get("gender").and_then(|v| v.as_str()) {
            profile.gender = Some(gender.to_string());
        }
        if let Some(fitness_level) = update_data.get("fitnessLevel").and_then(|v| v.as_str()) {
            profile.fitness_level = Some(fitness_level.to_string());
        }
        if let Some(height) = update_data.get("height").and_then(|v| v.as_i64()) {
            profile.height = Some(height as i32);
        }
        if let Some(weight) = update_data.get("weight").and_then(|v| v.as_f64()) {
            profile.weight = Some(weight as f32);
        }
        if let Some(birth_date) = update_data.get("birthDate").and_then(|v| v.as_str()) {
            profile.date_of_birth = Some(birth_date.to_string());
        }
        
        // Save the updated profile
        self.update_user_profile(user_id, &profile).await
    }

    pub async fn get_user_stats(&self, user_id: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self.dynamodb_client
            .get_item()
            .table_name(&self.table_name)
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

    pub async fn get_user_preferences(&self, user_id: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self.dynamodb_client
            .get_item()
            .table_name(&self.table_name)
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
                daily_goals: item.get("dailyGoals").and_then(|v| v.as_m().ok()).and_then(|goals_map| {
                    Some(DailyGoals {
                        calories: goals_map.get("calories").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(2000),
                        water: goals_map.get("water").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(8),
                        protein: goals_map.get("protein").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(150),
                        carbs: goals_map.get("carbs").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(200),
                        fat: goals_map.get("fat").and_then(|v| v.as_n().ok()).and_then(|s| s.parse().ok()).unwrap_or(65),
                    })
                }),
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
                daily_goals: None,
            };
            Ok(serde_json::to_value(default_preferences)?)
        }
    }

    pub async fn update_user_preferences(&self, user_id: &str, preferences: &UserPreferences) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
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
        
        self.dynamodb_client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(serde_json::to_value(preferences)?)
    }

    pub async fn delete_user_profile(&self, user_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Delete profile from DynamoDB
        self.dynamodb_client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S("PROFILE".to_string()))
            .send()
            .await?;
        
        // Delete preferences
        self.dynamodb_client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S("PREFERENCES".to_string()))
            .send()
            .await?;
        
        // Delete stats
        self.dynamodb_client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S("STATS".to_string()))
            .send()
            .await?;
        
        // Delete user's S3 objects (profile images, etc.)
        let bucket_name = "gymcoach-ai-user-uploads";
        let prefix = format!("user-profiles/{}/", user_id);
        
        let list_result = self.s3_client
            .list_objects_v2()
            .bucket(bucket_name)
            .prefix(&prefix)
            .send()
            .await?;
        
        if let Some(objects) = list_result.contents {
            for object in objects {
                if let Some(key) = object.key {
                    let _ = self.s3_client
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
}
