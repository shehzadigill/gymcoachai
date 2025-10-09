use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use serde_json::Value;
use anyhow::Result;
use tracing::{info, error};

use crate::models::*;

#[derive(Clone)]
pub struct ExerciseRepository {
    client: DynamoDbClient,
    table_name: String,
}

impl ExerciseRepository {
    pub fn new(client: DynamoDbClient, table_name: String) -> Self {
        Self { client, table_name }
    }

    pub async fn get_exercises(&self) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self.client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :gsi1pk")
            .expression_attribute_values(":gsi1pk", AttributeValue::S("EXERCISE".to_string()))
            .send()
            .await?;
        
        let exercises: Vec<Exercise> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| self.parse_exercise_item(item))
            .collect();
        
        Ok(serde_json::to_value(exercises)?)
    }

    pub async fn get_exercises_with_user(&self, user_id: Option<String>) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let mut all_exercises: Vec<Exercise> = Vec::new();
        
        // Query 1: Get system exercises using GSI1SK = "SYSTEM"
        let system_result = self.client
            .query()
            .table_name(&self.table_name)
            .index_name("GSI1")
            .key_condition_expression("GSI1PK = :gsi1pk AND begins_with(GSI1SK, :system_prefix)")
            .expression_attribute_values(":gsi1pk", AttributeValue::S("EXERCISE".to_string()))
            .expression_attribute_values(":system_prefix", AttributeValue::S("SYSTEM#".to_string()))
            .send()
            .await?;
        
        // Query 2: Get user's exercises if user_id is provided
        if let Some(ref user_id) = user_id {
            let user_result = self.client
                .query()
                .table_name(&self.table_name)
                .index_name("GSI1")
                .key_condition_expression("GSI1PK = :gsi1pk AND begins_with(GSI1SK, :user_prefix)")
                .expression_attribute_values(":gsi1pk", AttributeValue::S("EXERCISE".to_string()))
                .expression_attribute_values(":user_prefix", AttributeValue::S(format!("USER#{}#", user_id)))
                .send()
                .await?;
            
            // Process user exercises
            let user_exercises: Vec<Exercise> = user_result
                .items
                .unwrap_or_default()
                .into_iter()
                .filter_map(|item| self.parse_exercise_item(item))
                .collect();
            
            all_exercises.extend(user_exercises);
        }
        
        // Process system exercises
        let system_exercises: Vec<Exercise> = system_result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| self.parse_exercise_item(item))
            .collect();
        
        all_exercises.extend(system_exercises);
        
        Ok(serde_json::to_value(all_exercises)?)
    }

    pub async fn create_exercise(&self, exercise: &Exercise) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let mut item = std::collections::HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S("EXERCISES".to_string()));
        item.insert("SK".to_string(), AttributeValue::S(format!("EXERCISE#{}", exercise.id)));
        item.insert("id".to_string(), AttributeValue::S(exercise.id.clone()));
        item.insert("name".to_string(), AttributeValue::S(exercise.name.clone()));
        item.insert("category".to_string(), AttributeValue::S(exercise.category.clone()));
        item.insert("difficulty".to_string(), AttributeValue::S(exercise.difficulty.clone()));
        item.insert("createdAt".to_string(), AttributeValue::S(exercise.created_at.clone()));
        item.insert("updatedAt".to_string(), AttributeValue::S(exercise.updated_at.clone()));
        
        if let Some(description) = &exercise.description {
            item.insert("description".to_string(), AttributeValue::S(description.clone()));
        }
        if let Some(tips) = &exercise.tips {
            item.insert("tips".to_string(), AttributeValue::S(tips.clone()));
        }
        if let Some(video_url) = &exercise.video_url {
            item.insert("videoUrl".to_string(), AttributeValue::S(video_url.clone()));
        }
        if let Some(image_url) = &exercise.image_url {
            item.insert("imageUrl".to_string(), AttributeValue::S(image_url.clone()));
        }
        
        // Add muscle groups as a list
        let muscle_groups: Vec<AttributeValue> = exercise.muscle_groups
            .iter()
            .map(|group| AttributeValue::S(group.clone()))
            .collect();
        item.insert("muscleGroups".to_string(), AttributeValue::L(muscle_groups));
        
        // Add equipment as a list
        let equipment: Vec<AttributeValue> = exercise.equipment
            .iter()
            .map(|eq| AttributeValue::S(eq.clone()))
            .collect();
        item.insert("equipment".to_string(), AttributeValue::L(equipment));
        
        // Add instructions as a list
        let instructions: Vec<AttributeValue> = exercise.instructions
            .iter()
            .map(|instruction| AttributeValue::S(instruction.clone()))
            .collect();
        item.insert("instructions".to_string(), AttributeValue::L(instructions));
        
        // Add new fields
        if let Some(created_by) = &exercise.created_by {
            item.insert("CreatedBy".to_string(), AttributeValue::S(created_by.clone()));
        }
        item.insert("IsSystem".to_string(), AttributeValue::Bool(exercise.is_system));
        
        let tags_json = serde_json::to_string(&exercise.tags).unwrap_or_default();
        item.insert("Tags".to_string(), AttributeValue::S(tags_json));
        
        // Add GSI attributes for querying with proper key structure
        item.insert("GSI1PK".to_string(), AttributeValue::S("EXERCISE".to_string()));
        
        // Use different GSI1SK patterns for system vs user exercises
        let gsi1_sk = if exercise.is_system {
            format!("SYSTEM#{}", exercise.name.to_lowercase())
        } else if let Some(ref created_by) = exercise.created_by {
            format!("USER#{}#{}", created_by, exercise.name.to_lowercase())
        } else {
            format!("SYSTEM#{}", exercise.name.to_lowercase()) // fallback to system
        };
        
        item.insert("GSI1SK".to_string(), AttributeValue::S(gsi1_sk));
        item.insert("EntityType".to_string(), AttributeValue::S("EXERCISE".to_string()));
        item.insert("ExerciseId".to_string(), AttributeValue::S(exercise.id.clone()));
        item.insert("Name".to_string(), AttributeValue::S(exercise.name.clone()));
        item.insert("Category".to_string(), AttributeValue::S(exercise.category.clone()));
        item.insert("Difficulty".to_string(), AttributeValue::S(exercise.difficulty.clone()));
        
        // Store as JSON strings for consistency with query functions
        let muscle_groups_json = serde_json::to_string(&exercise.muscle_groups).unwrap_or_default();
        item.insert("MuscleGroups".to_string(), AttributeValue::S(muscle_groups_json));
        
        let equipment_json = serde_json::to_string(&exercise.equipment).unwrap_or_default();
        item.insert("Equipment".to_string(), AttributeValue::S(equipment_json));
        
        let instructions_json = serde_json::to_string(&exercise.instructions).unwrap_or_default();
        item.insert("Instructions".to_string(), AttributeValue::S(instructions_json));
        
        if let Some(description) = &exercise.description {
            item.insert("Description".to_string(), AttributeValue::S(description.clone()));
        }
        if let Some(tips) = &exercise.tips {
            item.insert("Tips".to_string(), AttributeValue::S(tips.clone()));
        }
        if let Some(video_url) = &exercise.video_url {
            item.insert("VideoUrl".to_string(), AttributeValue::S(video_url.clone()));
        }
        if let Some(image_url) = &exercise.image_url {
            item.insert("ImageUrl".to_string(), AttributeValue::S(image_url.clone()));
        }
        
        item.insert("CreatedAt".to_string(), AttributeValue::S(exercise.created_at.clone()));
        item.insert("UpdatedAt".to_string(), AttributeValue::S(exercise.updated_at.clone()));
        
        self.client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(serde_json::to_value(exercise)?)
    }

    pub async fn get_exercise(&self, exercise_id: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let result = self.client
            .get_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S("EXERCISES".to_string()))
            .key("SK", AttributeValue::S(format!("EXERCISE#{}", exercise_id)))
            .send()
            .await?;

        if let Some(item) = result.item {
            let exercise = Exercise {
                id: item.get("ExerciseId").or_else(|| item.get("id")).and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
                name: item.get("Name").or_else(|| item.get("name")).and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
                description: item.get("Description").or_else(|| item.get("description")).and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                category: item.get("Category").or_else(|| item.get("category")).and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
                muscle_groups: item.get("MuscleGroups")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .or_else(|| {
                        item.get("muscleGroups")
                            .and_then(|v| v.as_l().ok())
                            .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    })
                    .unwrap_or_default(),
                equipment: item.get("Equipment")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .or_else(|| {
                        item.get("equipment")
                            .and_then(|v| v.as_l().ok())
                            .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    })
                    .unwrap_or_default(),
                difficulty: item.get("Difficulty").or_else(|| item.get("difficulty")).and_then(|v| v.as_s().ok()).map_or("beginner", |v| v).to_string(),
                instructions: item.get("Instructions")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .or_else(|| {
                        item.get("instructions")
                            .and_then(|v| v.as_l().ok())
                            .map(|list| list.iter().filter_map(|v| v.as_s().ok().map(|s| s.clone())).collect())
                    })
                    .unwrap_or_default(),
                tips: item.get("Tips").or_else(|| item.get("tips")).and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                video_url: item.get("VideoUrl").or_else(|| item.get("videoUrl")).and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                image_url: item.get("ImageUrl").or_else(|| item.get("imageUrl")).and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                created_by: item.get("CreatedBy").and_then(|v| v.as_s().ok()).map(|s| s.to_string()),
                is_system: item.get("IsSystem").and_then(|v| v.as_bool().ok()).copied().unwrap_or(false),
                tags: item.get("Tags")
                    .and_then(|v| v.as_s().ok())
                    .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                    .unwrap_or_default(),
                created_at: item.get("CreatedAt").or_else(|| item.get("createdAt")).and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
                updated_at: item.get("updatedAt").and_then(|v| v.as_s().ok()).map_or("", |v| v).to_string(),
            };
            
            Ok(serde_json::to_value(exercise)?)
        } else {
            Err("Exercise not found".into())
        }
    }

    pub async fn update_exercise(&self, exercise: &Exercise) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        self.create_exercise(exercise).await
    }

    pub async fn delete_exercise(&self, exercise_id: &str) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        self.client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S("EXERCISES".to_string()))
            .key("SK", AttributeValue::S(format!("EXERCISE#{}", exercise_id)))
            .send()
            .await?;
        
        Ok(())
    }

    // Helper function to parse exercise items from DynamoDB
    fn parse_exercise_item(&self, item: std::collections::HashMap<String, AttributeValue>) -> Option<Exercise> {
        Some(Exercise {
            id: item.get("ExerciseId")?.as_s().ok()?.clone(),
            name: item.get("Name")?.as_s().ok()?.clone(),
            description: item.get("Description").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            category: item.get("Category")?.as_s().ok()?.clone(),
            muscle_groups: item.get("MuscleGroups")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .unwrap_or_default(),
            equipment: item.get("Equipment")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .unwrap_or_default(),
            difficulty: item.get("Difficulty")?.as_s().ok()?.clone(),
            instructions: item.get("Instructions")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .unwrap_or_default(),
            tips: item.get("Tips").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            video_url: item.get("VideoUrl").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            image_url: item.get("ImageUrl").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            created_by: item.get("CreatedBy").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            is_system: item.get("IsSystem").and_then(|v| v.as_bool().ok()).copied().unwrap_or(false),
            tags: item.get("Tags")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str::<Vec<String>>(s).ok())
                .unwrap_or_default(),
            created_at: item.get("CreatedAt")?.as_s().ok()?.clone(),
            updated_at: item.get("UpdatedAt")?.as_s().ok()?.clone(),
        })
    }
}
