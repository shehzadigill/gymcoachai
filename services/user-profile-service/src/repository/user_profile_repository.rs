use anyhow::Result;
use aws_sdk_dynamodb::{types::AttributeValue, Client as DynamoDbClient};
use aws_sdk_s3::Client as S3Client;
use chrono::Utc;
use serde_json::Value;

use crate::models::*;

#[derive(Clone)]
pub struct UserProfileRepository {
    dynamodb_client: DynamoDbClient,
    s3_client: S3Client,
    table_name: String,
}

impl UserProfileRepository {
    pub fn new(dynamodb_client: DynamoDbClient, s3_client: S3Client) -> Self {
        let table_name =
            std::env::var("TABLE_NAME").unwrap_or_else(|_| "gymcoach-ai-main".to_string());
        Self {
            dynamodb_client,
            s3_client,
            table_name,
        }
    }

    pub async fn get_user_profile(
        &self,
        user_id: &str,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self
            .dynamodb_client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S("PROFILE".to_string()))
            .send()
            .await?;

        if let Some(item) = result.item {
            let profile = UserProfile {
                first_name: item
                    .get("firstName")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                last_name: item
                    .get("lastName")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                email: item
                    .get("email")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                bio: item
                    .get("bio")
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                date_of_birth: item
                    .get("dateOfBirth")
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                height: item
                    .get("height")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok()),
                weight: item
                    .get("weight")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok()),
                fitness_goals: item
                    .get("fitnessGoals")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| {
                        list.iter()
                            .filter_map(|v| v.as_s().ok().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
                experience_level: item
                    .get("experienceLevel")
                    .and_then(|v| v.as_s().ok())
                    .map_or("beginner", |v| v)
                    .to_string(),
                profile_image_url: item
                    .get("profileImageUrl")
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                preferences: UserPreferences {
                    units: item
                        .get("units")
                        .and_then(|v| v.as_s().ok())
                        .map_or("metric", |v| v)
                        .to_string(),
                    timezone: item
                        .get("timezone")
                        .and_then(|v| v.as_s().ok())
                        .map_or("UTC", |v| v)
                        .to_string(),
                    notifications: NotificationSettings {
                        email: *item
                            .get("emailNotifications")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&true),
                        push: *item
                            .get("pushNotifications")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&true),
                        workout_reminders: *item
                            .get("workoutReminders")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&true),
                        nutrition_reminders: *item
                            .get("nutritionReminders")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&true),
                        water_reminders: *item
                            .get("waterReminders")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&true),
                        progress_photos: *item
                            .get("progressPhotos")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&true),
                        achievements: *item
                            .get("achievements")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&true),
                        ai_suggestions: *item
                            .get("aiSuggestions")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&true),
                        workout_reminder_time: item
                            .get("workoutReminderTime")
                            .and_then(|v| v.as_s().ok())
                            .map(|s| s.to_string()),
                        nutrition_reminder_times: item
                            .get("nutritionReminderTimes")
                            .and_then(|v| v.as_l().ok())
                            .map(|list| {
                                list.iter()
                                    .filter_map(|v| v.as_s().ok())
                                    .map(|s| s.to_string())
                                    .collect()
                            }),
                    },
                    privacy: PrivacySettings {
                        profile_visibility: item
                            .get("profileVisibility")
                            .and_then(|v| v.as_s().ok())
                            .map_or("private", |v| v)
                            .to_string(),
                        workout_sharing: *item
                            .get("workoutSharing")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&false),
                        progress_sharing: *item
                            .get("progressSharing")
                            .and_then(|v| v.as_bool().ok())
                            .unwrap_or(&false),
                    },
                    ai_trainer: item.get("aiTrainer").and_then(|v| v.as_m().ok()).and_then(
                        |ai_map| {
                            Some(AITrainerPreferences {
                                enabled: *ai_map
                                    .get("enabled")
                                    .and_then(|v| v.as_bool().ok())
                                    .unwrap_or(&false),
                                coaching_style: ai_map
                                    .get("coachingStyle")
                                    .and_then(|v| v.as_s().ok())
                                    .map_or("balanced", |v| v)
                                    .to_string(),
                                communication_frequency: ai_map
                                    .get("communicationFrequency")
                                    .and_then(|v| v.as_s().ok())
                                    .map_or("on-demand", |v| v)
                                    .to_string(),
                                focus_areas: ai_map
                                    .get("focusAreas")
                                    .and_then(|v| v.as_l().ok())
                                    .map(|list| {
                                        list.iter()
                                            .filter_map(|v| v.as_s().ok())
                                            .map(|s| s.to_string())
                                            .collect()
                                    })
                                    .unwrap_or_default(),
                                injury_history: ai_map
                                    .get("injuryHistory")
                                    .and_then(|v| v.as_l().ok())
                                    .map(|list| {
                                        list.iter()
                                            .filter_map(|v| v.as_s().ok())
                                            .map(|s| s.to_string())
                                            .collect()
                                    })
                                    .unwrap_or_default(),
                                equipment_available: ai_map
                                    .get("equipmentAvailable")
                                    .and_then(|v| v.as_l().ok())
                                    .map(|list| {
                                        list.iter()
                                            .filter_map(|v| v.as_s().ok())
                                            .map(|s| s.to_string())
                                            .collect()
                                    })
                                    .unwrap_or_default(),
                                workout_duration_preference: ai_map
                                    .get("workoutDurationPreference")
                                    .and_then(|v| v.as_n().ok())
                                    .and_then(|s| s.parse().ok())
                                    .unwrap_or(60),
                                workout_days_per_week: ai_map
                                    .get("workoutDaysPerWeek")
                                    .and_then(|v| v.as_n().ok())
                                    .and_then(|s| s.parse().ok())
                                    .unwrap_or(3),
                                meal_preferences: ai_map
                                    .get("mealPreferences")
                                    .and_then(|v| v.as_l().ok())
                                    .map(|list| {
                                        list.iter()
                                            .filter_map(|v| v.as_s().ok())
                                            .map(|s| s.to_string())
                                            .collect()
                                    })
                                    .unwrap_or_default(),
                                allergies: ai_map
                                    .get("allergies")
                                    .and_then(|v| v.as_l().ok())
                                    .map(|list| {
                                        list.iter()
                                            .filter_map(|v| v.as_s().ok())
                                            .map(|s| s.to_string())
                                            .collect()
                                    })
                                    .unwrap_or_default(),
                                supplement_preferences: ai_map
                                    .get("supplementPreferences")
                                    .and_then(|v| v.as_l().ok())
                                    .map(|list| {
                                        list.iter()
                                            .filter_map(|v| v.as_s().ok())
                                            .map(|s| s.to_string())
                                            .collect()
                                    })
                                    .unwrap_or_default(),
                            })
                        },
                    ),
                    daily_goals: item.get("dailyGoals").and_then(|v| v.as_m().ok()).and_then(
                        |goals_map| {
                            Some(DailyGoals {
                                calories: goals_map
                                    .get("calories")
                                    .and_then(|v| v.as_n().ok())
                                    .and_then(|s| s.parse().ok())
                                    .unwrap_or(2000),
                                water: goals_map
                                    .get("water")
                                    .and_then(|v| v.as_n().ok())
                                    .and_then(|s| s.parse().ok())
                                    .unwrap_or(8),
                                protein: goals_map
                                    .get("protein")
                                    .and_then(|v| v.as_n().ok())
                                    .and_then(|s| s.parse().ok())
                                    .unwrap_or(150),
                                carbs: goals_map
                                    .get("carbs")
                                    .and_then(|v| v.as_n().ok())
                                    .and_then(|s| s.parse().ok())
                                    .unwrap_or(200),
                                fat: goals_map
                                    .get("fat")
                                    .and_then(|v| v.as_n().ok())
                                    .and_then(|s| s.parse().ok())
                                    .unwrap_or(65),
                            })
                        },
                    ),
                },
                gender: item
                    .get("gender")
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                fitness_level: item
                    .get("fitnessLevel")
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
                created_at: item
                    .get("createdAt")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
                updated_at: item
                    .get("updatedAt")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v)
                    .to_string(),
            };

            Ok(serde_json::to_value(profile)?)
        } else {
            Err("User profile not found".into())
        }
    }

    pub async fn update_user_profile(
        &self,
        user_id: &str,
        profile: &UserProfile,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let now = Utc::now().to_rfc3339();

        let mut item = std::collections::HashMap::new();
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", user_id)),
        );
        item.insert("SK".to_string(), AttributeValue::S("PROFILE".to_string()));
        item.insert(
            "firstName".to_string(),
            AttributeValue::S(profile.first_name.clone()),
        );
        item.insert(
            "lastName".to_string(),
            AttributeValue::S(profile.last_name.clone()),
        );
        item.insert(
            "email".to_string(),
            AttributeValue::S(profile.email.clone()),
        );
        item.insert(
            "experienceLevel".to_string(),
            AttributeValue::S(profile.experience_level.clone()),
        );
        item.insert(
            "units".to_string(),
            AttributeValue::S(profile.preferences.units.clone()),
        );
        item.insert(
            "timezone".to_string(),
            AttributeValue::S(profile.preferences.timezone.clone()),
        );
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
            item.insert(
                "profileImageUrl".to_string(),
                AttributeValue::S(image_url.clone()),
            );
        }
        if let Some(gender) = &profile.gender {
            item.insert("gender".to_string(), AttributeValue::S(gender.clone()));
        }
        if let Some(fitness_level) = &profile.fitness_level {
            item.insert(
                "fitnessLevel".to_string(),
                AttributeValue::S(fitness_level.clone()),
            );
        }

        // Add fitness goals as a list
        let fitness_goals: Vec<AttributeValue> = profile
            .fitness_goals
            .iter()
            .map(|goal| AttributeValue::S(goal.clone()))
            .collect();
        item.insert("fitnessGoals".to_string(), AttributeValue::L(fitness_goals));

        // Add notification settings
        item.insert(
            "emailNotifications".to_string(),
            AttributeValue::Bool(profile.preferences.notifications.email),
        );
        item.insert(
            "pushNotifications".to_string(),
            AttributeValue::Bool(profile.preferences.notifications.push),
        );
        item.insert(
            "workoutReminders".to_string(),
            AttributeValue::Bool(profile.preferences.notifications.workout_reminders),
        );
        item.insert(
            "nutritionReminders".to_string(),
            AttributeValue::Bool(profile.preferences.notifications.nutrition_reminders),
        );
        item.insert(
            "waterReminders".to_string(),
            AttributeValue::Bool(profile.preferences.notifications.water_reminders),
        );
        item.insert(
            "progressPhotos".to_string(),
            AttributeValue::Bool(profile.preferences.notifications.progress_photos),
        );
        item.insert(
            "achievements".to_string(),
            AttributeValue::Bool(profile.preferences.notifications.achievements),
        );
        item.insert(
            "aiSuggestions".to_string(),
            AttributeValue::Bool(profile.preferences.notifications.ai_suggestions),
        );

        if let Some(workout_time) = &profile.preferences.notifications.workout_reminder_time {
            item.insert(
                "workoutReminderTime".to_string(),
                AttributeValue::S(workout_time.clone()),
            );
        }

        if let Some(nutrition_times) = &profile.preferences.notifications.nutrition_reminder_times {
            let times: Vec<AttributeValue> = nutrition_times
                .iter()
                .map(|time| AttributeValue::S(time.clone()))
                .collect();
            item.insert(
                "nutritionReminderTimes".to_string(),
                AttributeValue::L(times),
            );
        }

        // Add privacy settings
        item.insert(
            "profileVisibility".to_string(),
            AttributeValue::S(profile.preferences.privacy.profile_visibility.clone()),
        );
        item.insert(
            "workoutSharing".to_string(),
            AttributeValue::Bool(profile.preferences.privacy.workout_sharing),
        );
        item.insert(
            "progressSharing".to_string(),
            AttributeValue::Bool(profile.preferences.privacy.progress_sharing),
        );

        // Add daily goals if present
        if let Some(daily_goals) = &profile.preferences.daily_goals {
            let mut goals_map = std::collections::HashMap::new();
            goals_map.insert(
                "calories".to_string(),
                AttributeValue::N(daily_goals.calories.to_string()),
            );
            goals_map.insert(
                "water".to_string(),
                AttributeValue::N(daily_goals.water.to_string()),
            );
            goals_map.insert(
                "protein".to_string(),
                AttributeValue::N(daily_goals.protein.to_string()),
            );
            goals_map.insert(
                "carbs".to_string(),
                AttributeValue::N(daily_goals.carbs.to_string()),
            );
            goals_map.insert(
                "fat".to_string(),
                AttributeValue::N(daily_goals.fat.to_string()),
            );
            item.insert("dailyGoals".to_string(), AttributeValue::M(goals_map));
        }

        // Add AI trainer preferences if present
        if let Some(ai_trainer) = &profile.preferences.ai_trainer {
            let mut ai_map = std::collections::HashMap::new();
            ai_map.insert(
                "enabled".to_string(),
                AttributeValue::Bool(ai_trainer.enabled),
            );
            ai_map.insert(
                "coachingStyle".to_string(),
                AttributeValue::S(ai_trainer.coaching_style.clone()),
            );
            ai_map.insert(
                "communicationFrequency".to_string(),
                AttributeValue::S(ai_trainer.communication_frequency.clone()),
            );
            ai_map.insert(
                "workoutDurationPreference".to_string(),
                AttributeValue::N(ai_trainer.workout_duration_preference.to_string()),
            );
            ai_map.insert(
                "workoutDaysPerWeek".to_string(),
                AttributeValue::N(ai_trainer.workout_days_per_week.to_string()),
            );

            // Add arrays
            let focus_areas: Vec<AttributeValue> = ai_trainer
                .focus_areas
                .iter()
                .map(|area| AttributeValue::S(area.clone()))
                .collect();
            ai_map.insert("focusAreas".to_string(), AttributeValue::L(focus_areas));

            let injury_history: Vec<AttributeValue> = ai_trainer
                .injury_history
                .iter()
                .map(|injury| AttributeValue::S(injury.clone()))
                .collect();
            ai_map.insert(
                "injuryHistory".to_string(),
                AttributeValue::L(injury_history),
            );

            let equipment_available: Vec<AttributeValue> = ai_trainer
                .equipment_available
                .iter()
                .map(|equipment| AttributeValue::S(equipment.clone()))
                .collect();
            ai_map.insert(
                "equipmentAvailable".to_string(),
                AttributeValue::L(equipment_available),
            );

            let meal_preferences: Vec<AttributeValue> = ai_trainer
                .meal_preferences
                .iter()
                .map(|pref| AttributeValue::S(pref.clone()))
                .collect();
            ai_map.insert(
                "mealPreferences".to_string(),
                AttributeValue::L(meal_preferences),
            );

            let allergies: Vec<AttributeValue> = ai_trainer
                .allergies
                .iter()
                .map(|allergy| AttributeValue::S(allergy.clone()))
                .collect();
            ai_map.insert("allergies".to_string(), AttributeValue::L(allergies));

            let supplement_preferences: Vec<AttributeValue> = ai_trainer
                .supplement_preferences
                .iter()
                .map(|supplement| AttributeValue::S(supplement.clone()))
                .collect();
            ai_map.insert(
                "supplementPreferences".to_string(),
                AttributeValue::L(supplement_preferences),
            );

            item.insert("aiTrainer".to_string(), AttributeValue::M(ai_map));
        }

        // Set created_at if this is a new profile
        if profile.created_at.is_empty() {
            item.insert("createdAt".to_string(), AttributeValue::S(now.clone()));
        } else {
            item.insert(
                "createdAt".to_string(),
                AttributeValue::S(profile.created_at.clone()),
            );
        }

        self.dynamodb_client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(serde_json::to_value(profile)?)
    }

    pub async fn partial_update_user_profile(
        &self,
        user_id: &str,
        update_data: &Value,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let _now = Utc::now().to_rfc3339();

        // First, get the current profile
        let current_profile = self.get_user_profile(user_id).await?;
        let mut profile: UserProfile = serde_json::from_value(current_profile)?;

        // Update only the fields that are provided in the update_data
        if let Some(preferences_obj) = update_data.get("preferences") {
            if let Some(daily_goals_obj) = preferences_obj.get("dailyGoals") {
                let daily_goals = DailyGoals {
                    calories: daily_goals_obj
                        .get("calories")
                        .and_then(|v| v.as_i64())
                        .map(|v| v as i32)
                        .unwrap_or(2000),
                    water: daily_goals_obj
                        .get("water")
                        .and_then(|v| v.as_i64())
                        .map(|v| v as i32)
                        .unwrap_or(8),
                    protein: daily_goals_obj
                        .get("protein")
                        .and_then(|v| v.as_i64())
                        .map(|v| v as i32)
                        .unwrap_or(150),
                    carbs: daily_goals_obj
                        .get("carbs")
                        .and_then(|v| v.as_i64())
                        .map(|v| v as i32)
                        .unwrap_or(200),
                    fat: daily_goals_obj
                        .get("fat")
                        .and_then(|v| v.as_i64())
                        .map(|v| v as i32)
                        .unwrap_or(65),
                };
                profile.preferences.daily_goals = Some(daily_goals);
            }
        }

        // Update goals if provided
        if let Some(goals_arr) = update_data.get("goals").and_then(|v| v.as_array()) {
            profile.fitness_goals = goals_arr
                .iter()
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

        // Handle profileImageUrl - convert S3 key to full S3 URL if needed
        if let Some(profile_image) = update_data.get("profileImageUrl").and_then(|v| v.as_str()) {
            // Skip empty strings
            if !profile_image.is_empty() {
                // If it's an S3 key (not a full URL), convert to full S3 URL
                let image_url = if profile_image.starts_with("http://")
                    || profile_image.starts_with("https://")
                {
                    // Already a full URL, use as-is
                    profile_image.to_string()
                } else {
                    // It's an S3 key, convert to full S3 URL
                    let bucket_name = std::env::var("USER_UPLOADS_BUCKET")
                        .unwrap_or_else(|_| "gymcoach-ai-user-uploads".to_string());
                    let region =
                        std::env::var("AWS_REGION").unwrap_or_else(|_| "us-east-1".to_string());
                    format!(
                        "https://{}.s3.{}.amazonaws.com/{}",
                        bucket_name, region, profile_image
                    )
                };
                profile.profile_image_url = Some(image_url);

                // Log for debugging
                tracing::info!(
                    "Updated profile image URL for user {}: {}",
                    user_id,
                    profile_image,
                );
            }
        }

        // Save the updated profile
        self.update_user_profile(user_id, &profile).await
    }

    pub async fn get_user_stats(
        &self,
        user_id: &str,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self
            .dynamodb_client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S("STATS".to_string()))
            .send()
            .await?;

        if let Some(item) = result.item {
            let stats = UserStats {
                total_workouts: item
                    .get("totalWorkouts")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                total_workout_time: item
                    .get("totalWorkoutTime")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                current_streak: item
                    .get("currentStreak")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                longest_streak: item
                    .get("longestStreak")
                    .and_then(|v| v.as_n().ok())
                    .and_then(|s| s.parse().ok())
                    .unwrap_or(0),
                favorite_exercises: item
                    .get("favoriteExercises")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| {
                        list.iter()
                            .filter_map(|v| v.as_s().ok().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
                achievements: item
                    .get("achievements")
                    .and_then(|v| v.as_l().ok())
                    .map(|list| {
                        list.iter()
                            .filter_map(|v| v.as_s().ok().map(|s| s.to_string()))
                            .collect()
                    })
                    .unwrap_or_default(),
                last_workout_date: item
                    .get("lastWorkoutDate")
                    .and_then(|v| v.as_s().ok())
                    .map(|s| s.to_string()),
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

    pub async fn get_user_preferences(
        &self,
        user_id: &str,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self
            .dynamodb_client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S("PREFERENCES".to_string()))
            .send()
            .await?;

        if let Some(item) = result.item {
            let preferences = UserPreferences {
                ai_trainer: None,
                units: item
                    .get("units")
                    .and_then(|v| v.as_s().ok())
                    .map_or("metric", |v| v)
                    .to_string(),
                timezone: item
                    .get("timezone")
                    .and_then(|v| v.as_s().ok())
                    .map_or("UTC", |v| v)
                    .to_string(),
                notifications: NotificationSettings {
                    email: *item
                        .get("emailNotifications")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&true),
                    push: *item
                        .get("pushNotifications")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&true),
                    workout_reminders: *item
                        .get("workoutReminders")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&true),
                    nutrition_reminders: *item
                        .get("nutritionReminders")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&true),
                    water_reminders: *item
                        .get("waterReminders")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&true),
                    progress_photos: *item
                        .get("progressPhotos")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&true),
                    achievements: *item
                        .get("achievements")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&true),
                    ai_suggestions: *item
                        .get("aiSuggestions")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&true),
                    workout_reminder_time: item
                        .get("workoutReminderTime")
                        .and_then(|v| v.as_s().ok())
                        .map(|s| s.to_string()),
                    nutrition_reminder_times: item
                        .get("nutritionReminderTimes")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| {
                            list.iter()
                                .filter_map(|v| v.as_s().ok())
                                .map(|s| s.to_string())
                                .collect()
                        }),
                },
                privacy: PrivacySettings {
                    profile_visibility: item
                        .get("profileVisibility")
                        .and_then(|v| v.as_s().ok())
                        .map_or("private", |v| v)
                        .to_string(),
                    workout_sharing: *item
                        .get("workoutSharing")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&false),
                    progress_sharing: *item
                        .get("progressSharing")
                        .and_then(|v| v.as_bool().ok())
                        .unwrap_or(&false),
                },
                daily_goals: item.get("dailyGoals").and_then(|v| v.as_m().ok()).and_then(
                    |goals_map| {
                        Some(DailyGoals {
                            calories: goals_map
                                .get("calories")
                                .and_then(|v| v.as_n().ok())
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(2000),
                            water: goals_map
                                .get("water")
                                .and_then(|v| v.as_n().ok())
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(8),
                            protein: goals_map
                                .get("protein")
                                .and_then(|v| v.as_n().ok())
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(150),
                            carbs: goals_map
                                .get("carbs")
                                .and_then(|v| v.as_n().ok())
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(200),
                            fat: goals_map
                                .get("fat")
                                .and_then(|v| v.as_n().ok())
                                .and_then(|s| s.parse().ok())
                                .unwrap_or(65),
                        })
                    },
                ),
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
                    water_reminders: true,
                    progress_photos: true,
                    achievements: true,
                    ai_suggestions: true,
                    workout_reminder_time: Some("08:00".to_string()),
                    nutrition_reminder_times: Some(vec![
                        "08:00".to_string(),
                        "13:00".to_string(),
                        "19:00".to_string(),
                    ]),
                },
                privacy: PrivacySettings {
                    profile_visibility: "private".to_string(),
                    workout_sharing: false,
                    progress_sharing: false,
                },
                daily_goals: None,
                ai_trainer: None,
            };
            Ok(serde_json::to_value(default_preferences)?)
        }
    }

    pub async fn update_user_preferences(
        &self,
        user_id: &str,
        preferences: &UserPreferences,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let now = Utc::now().to_rfc3339();

        let mut item = std::collections::HashMap::new();
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", user_id)),
        );
        item.insert(
            "SK".to_string(),
            AttributeValue::S("PREFERENCES".to_string()),
        );
        item.insert(
            "units".to_string(),
            AttributeValue::S(preferences.units.clone()),
        );
        item.insert(
            "timezone".to_string(),
            AttributeValue::S(preferences.timezone.clone()),
        );
        item.insert(
            "emailNotifications".to_string(),
            AttributeValue::Bool(preferences.notifications.email),
        );
        item.insert(
            "pushNotifications".to_string(),
            AttributeValue::Bool(preferences.notifications.push),
        );
        item.insert(
            "workoutReminders".to_string(),
            AttributeValue::Bool(preferences.notifications.workout_reminders),
        );
        item.insert(
            "nutritionReminders".to_string(),
            AttributeValue::Bool(preferences.notifications.nutrition_reminders),
        );
        item.insert(
            "waterReminders".to_string(),
            AttributeValue::Bool(preferences.notifications.water_reminders),
        );
        item.insert(
            "progressPhotos".to_string(),
            AttributeValue::Bool(preferences.notifications.progress_photos),
        );
        item.insert(
            "achievements".to_string(),
            AttributeValue::Bool(preferences.notifications.achievements),
        );
        item.insert(
            "aiSuggestions".to_string(),
            AttributeValue::Bool(preferences.notifications.ai_suggestions),
        );

        if let Some(workout_time) = &preferences.notifications.workout_reminder_time {
            item.insert(
                "workoutReminderTime".to_string(),
                AttributeValue::S(workout_time.clone()),
            );
        }

        if let Some(nutrition_times) = &preferences.notifications.nutrition_reminder_times {
            let times: Vec<AttributeValue> = nutrition_times
                .iter()
                .map(|time| AttributeValue::S(time.clone()))
                .collect();
            item.insert(
                "nutritionReminderTimes".to_string(),
                AttributeValue::L(times),
            );
        }
        item.insert(
            "profileVisibility".to_string(),
            AttributeValue::S(preferences.privacy.profile_visibility.clone()),
        );
        item.insert(
            "workoutSharing".to_string(),
            AttributeValue::Bool(preferences.privacy.workout_sharing),
        );
        item.insert(
            "progressSharing".to_string(),
            AttributeValue::Bool(preferences.privacy.progress_sharing),
        );
        item.insert("updatedAt".to_string(), AttributeValue::S(now));

        self.dynamodb_client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(serde_json::to_value(preferences)?)
    }

    pub async fn delete_user_profile(
        &self,
        user_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
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

        let list_result = self
            .s3_client
            .list_objects_v2()
            .bucket(bucket_name)
            .prefix(&prefix)
            .send()
            .await?;

        if let Some(objects) = list_result.contents {
            for object in objects {
                if let Some(key) = object.key {
                    let _ = self
                        .s3_client
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

    pub async fn save_device_token(
        &self,
        user_id: &str,
        token: &str,
        platform: &str,
    ) -> Result<String, Box<dyn std::error::Error + Send + Sync>> {
        use uuid::Uuid;

        let device_id = Uuid::new_v4().to_string();
        let now = Utc::now();

        let mut item = std::collections::HashMap::new();
        item.insert(
            "PK".to_string(),
            AttributeValue::S(format!("USER#{}", user_id)),
        );
        item.insert(
            "SK".to_string(),
            AttributeValue::S(format!("DEVICE#{}", device_id)),
        );
        item.insert("deviceId".to_string(), AttributeValue::S(device_id.clone()));
        item.insert("userId".to_string(), AttributeValue::S(user_id.to_string()));
        item.insert(
            "deviceToken".to_string(),
            AttributeValue::S(token.to_string()),
        );
        item.insert(
            "platform".to_string(),
            AttributeValue::S(platform.to_string()),
        );
        item.insert("isActive".to_string(), AttributeValue::Bool(true));
        item.insert("createdAt".to_string(), AttributeValue::S(now.to_rfc3339()));
        item.insert(
            "lastUsedAt".to_string(),
            AttributeValue::S(now.to_rfc3339()),
        );

        self.dynamodb_client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;

        Ok(device_id)
    }

    pub async fn get_device_tokens(
        &self,
        user_id: &str,
    ) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self
            .dynamodb_client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
            .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
            .expression_attribute_values(":sk", AttributeValue::S("DEVICE#".to_string()))
            .send()
            .await?;

        let mut devices = Vec::new();
        if let Some(items) = result.items {
            for item in items {
                let device_id = item
                    .get("deviceId")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v);
                let platform = item
                    .get("platform")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v);
                let is_active = item
                    .get("isActive")
                    .and_then(|v| v.as_bool().ok())
                    .map_or(false, |v| *v);
                let created_at = item
                    .get("createdAt")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v);
                let last_used_at = item
                    .get("lastUsedAt")
                    .and_then(|v| v.as_s().ok())
                    .map_or("", |v| v);

                let device = serde_json::json!({
                    "device_id": device_id,
                    "platform": platform,
                    "is_active": is_active,
                    "created_at": created_at,
                    "last_used_at": last_used_at
                });
                devices.push(device);
            }
        }

        Ok(serde_json::json!({
            "devices": devices
        }))
    }

    pub async fn delete_device_token(
        &self,
        user_id: &str,
        device_id: &str,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.dynamodb_client
            .update_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S(format!("USER#{}", user_id)))
            .key("SK", AttributeValue::S(format!("DEVICE#{}", device_id)))
            .update_expression("SET isActive = :active")
            .expression_attribute_values(":active", AttributeValue::Bool(false))
            .send()
            .await?;

        Ok(())
    }
}
