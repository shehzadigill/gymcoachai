use aws_sdk_dynamodb::Client as DynamoDbClient;
use aws_sdk_dynamodb::types::AttributeValue;
use aws_sdk_s3::Client as S3Client;
use aws_sdk_s3::presigning::PresigningConfig;
use anyhow::Result;
use base64::Engine;
use std::collections::HashMap;

use crate::models::ProgressPhoto;

#[derive(Clone)]
pub struct ProgressPhotoRepository {
    dynamodb_client: DynamoDbClient,
    s3_client: S3Client,
    table_name: String,
    bucket_name: String,
}

impl ProgressPhotoRepository {
    pub fn new(dynamodb_client: DynamoDbClient, s3_client: S3Client, table_name: String, bucket_name: String) -> Self {
        Self { 
            dynamodb_client, 
            s3_client, 
            table_name, 
            bucket_name 
        }
    }

    pub async fn get_progress_photos(
        &self,
        user_id: &str,
        photo_type: Option<&str>,
        start_date: Option<&str>,
        end_date: Option<&str>,
        limit: Option<u32>,
    ) -> Result<Vec<ProgressPhoto>> {
        let mut query = self
            .dynamodb_client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk")
            .expression_attribute_values(":pk", AttributeValue::S("PROGRESS_PHOTOS".to_string()))
            .filter_expression("userId = :userId")
            .expression_attribute_values(":userId", AttributeValue::S(user_id.to_string()));

        if let Some(photo_type) = photo_type {
            query = query
                .filter_expression("photoType = :photoType")
                .expression_attribute_values(":photoType", AttributeValue::S(photo_type.to_string()));
        }

        if let Some(limit) = limit {
            query = query.limit(limit as i32);
        }

        let result = query.send().await?;
        
        let photos: Vec<ProgressPhoto> = result
            .items
            .unwrap_or_default()
            .into_iter()
            .filter_map(|item| {
                Some(ProgressPhoto {
                    id: item.get("id")?.as_s().ok()?.clone(),
                    user_id: item.get("userId")?.as_s().ok()?.clone(),
                    photo_type: item.get("photoType")?.as_s().ok()?.clone(),
                    photo_url: item.get("photoUrl")?.as_s().ok()?.clone(),
                    s3_key: item.get("s3Key")?.as_s().ok()?.clone(),
                    taken_at: item.get("takenAt")?.as_s().ok()?.clone(),
                    notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    workout_session_id: item.get("workoutSessionId").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
                    tags: item.get("tags")
                        .and_then(|v| v.as_l().ok())
                        .map(|list| list.iter().filter_map(|v| v.as_s().ok()).map(|s| s.clone()).collect())
                        .unwrap_or_default(),
                    metadata: item.get("metadata")
                        .and_then(|v| v.as_s().ok())
                        .and_then(|s| serde_json::from_str(s).ok()),
                    created_at: item.get("createdAt")?.as_s().ok()?.clone(),
                    updated_at: item.get("updatedAt")?.as_s().ok()?.clone(),
                })
            })
            .collect();
        
        Ok(photos)
    }

    pub async fn create_progress_photo(&self, photo: &ProgressPhoto) -> Result<ProgressPhoto> {
        let mut item = HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S("PROGRESS_PHOTOS".to_string()));
        item.insert("SK".to_string(), AttributeValue::S(format!("USER#{}#{}", photo.user_id, photo.taken_at)));
        item.insert("id".to_string(), AttributeValue::S(photo.id.clone()));
        item.insert("userId".to_string(), AttributeValue::S(photo.user_id.clone()));
        item.insert("photoType".to_string(), AttributeValue::S(photo.photo_type.clone()));
        item.insert("photoUrl".to_string(), AttributeValue::S(photo.photo_url.clone()));
        item.insert("s3Key".to_string(), AttributeValue::S(photo.s3_key.clone()));
        item.insert("takenAt".to_string(), AttributeValue::S(photo.taken_at.clone()));
        item.insert("createdAt".to_string(), AttributeValue::S(photo.created_at.clone()));
        item.insert("updatedAt".to_string(), AttributeValue::S(photo.updated_at.clone()));
        
        if let Some(notes) = &photo.notes {
            item.insert("notes".to_string(), AttributeValue::S(notes.clone()));
        }
        if let Some(workout_session_id) = &photo.workout_session_id {
            item.insert("workoutSessionId".to_string(), AttributeValue::S(workout_session_id.clone()));
        }
        if !photo.tags.is_empty() {
            let tags: Vec<AttributeValue> = photo.tags.iter()
                .map(|tag| AttributeValue::S(tag.clone()))
                .collect();
            item.insert("tags".to_string(), AttributeValue::L(tags));
        }
        if let Some(metadata) = &photo.metadata {
            item.insert("metadata".to_string(), AttributeValue::S(serde_json::to_string(metadata).unwrap_or_default()));
        }
        
        self.dynamodb_client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(photo.clone())
    }

    pub async fn upload_progress_photo_to_s3(
        &self,
        user_id: &str,
        photo_id: &str,
        content_type: &str,
        image_data: &str,
    ) -> Result<String> {
        let key = format!("users/{}/progress-photos/{}", user_id, photo_id);
        
        // Decode base64 image data
        let file_data = base64::engine::general_purpose::STANDARD
            .decode(image_data)
            .map_err(|e| anyhow::anyhow!("Invalid base64 image data: {}", e))?;
        
        self.s3_client
            .put_object()
            .bucket(&self.bucket_name)
            .key(&key)
            .body(file_data.into())
            .content_type(content_type)
            .send()
            .await?;
        
        // Generate presigned URL for the uploaded image
        let presigned_url = self.s3_client
            .get_object()
            .bucket(&self.bucket_name)
            .key(&key)
            .presigned(PresigningConfig::expires_in(std::time::Duration::from_secs(3600))?)
            .await?;
        
        Ok(presigned_url.uri().to_string())
    }

    pub async fn get_progress_photo_by_id(&self, photo_id: &str) -> Result<ProgressPhoto> {
        let result = self
            .dynamodb_client
            .query()
            .table_name(&self.table_name)
            .key_condition_expression("PK = :pk")
            .expression_attribute_values(":pk", AttributeValue::S("PROGRESS_PHOTOS".to_string()))
            .filter_expression("id = :id")
            .expression_attribute_values(":id", AttributeValue::S(photo_id.to_string()))
            .send()
            .await?;

        let items = result.items.unwrap_or_default();
        if items.is_empty() {
            return Err(anyhow::anyhow!("Progress photo not found"));
        }

        let item = &items[0];
        let photo = ProgressPhoto {
            id: item.get("id").ok_or_else(|| anyhow::anyhow!("Missing id"))?.as_s().map_err(|_| anyhow::anyhow!("Invalid id"))?.clone(),
            user_id: item.get("userId").ok_or_else(|| anyhow::anyhow!("Missing userId"))?.as_s().map_err(|_| anyhow::anyhow!("Invalid userId"))?.clone(),
            photo_type: item.get("photoType").ok_or_else(|| anyhow::anyhow!("Missing photoType"))?.as_s().map_err(|_| anyhow::anyhow!("Invalid photoType"))?.clone(),
            photo_url: item.get("photoUrl").ok_or_else(|| anyhow::anyhow!("Missing photoUrl"))?.as_s().map_err(|_| anyhow::anyhow!("Invalid photoUrl"))?.clone(),
            s3_key: item.get("s3Key").ok_or_else(|| anyhow::anyhow!("Missing s3Key"))?.as_s().map_err(|_| anyhow::anyhow!("Invalid s3Key"))?.clone(),
            taken_at: item.get("takenAt").ok_or_else(|| anyhow::anyhow!("Missing takenAt"))?.as_s().map_err(|_| anyhow::anyhow!("Invalid takenAt"))?.clone(),
            notes: item.get("notes").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            workout_session_id: item.get("workoutSessionId").and_then(|v| v.as_s().ok()).map(|s| s.clone()),
            tags: item.get("tags")
                .and_then(|v| v.as_l().ok())
                .map(|list| list.iter().filter_map(|v| v.as_s().ok()).map(|s| s.clone()).collect())
                .unwrap_or_default(),
            metadata: item.get("metadata")
                .and_then(|v| v.as_s().ok())
                .and_then(|s| serde_json::from_str(s).ok()),
            created_at: item.get("createdAt").ok_or_else(|| anyhow::anyhow!("Missing createdAt"))?.as_s().map_err(|_| anyhow::anyhow!("Invalid createdAt"))?.clone(),
            updated_at: item.get("updatedAt").ok_or_else(|| anyhow::anyhow!("Missing updatedAt"))?.as_s().map_err(|_| anyhow::anyhow!("Invalid updatedAt"))?.clone(),
        };

        Ok(photo)
    }

    pub async fn update_progress_photo(&self, photo: &ProgressPhoto) -> Result<ProgressPhoto> {
        let mut item = HashMap::new();
        item.insert("PK".to_string(), AttributeValue::S("PROGRESS_PHOTOS".to_string()));
        item.insert("SK".to_string(), AttributeValue::S(format!("USER#{}#{}", photo.user_id, photo.taken_at)));
        item.insert("id".to_string(), AttributeValue::S(photo.id.clone()));
        item.insert("userId".to_string(), AttributeValue::S(photo.user_id.clone()));
        item.insert("photoType".to_string(), AttributeValue::S(photo.photo_type.clone()));
        item.insert("photoUrl".to_string(), AttributeValue::S(photo.photo_url.clone()));
        item.insert("s3Key".to_string(), AttributeValue::S(photo.s3_key.clone()));
        item.insert("takenAt".to_string(), AttributeValue::S(photo.taken_at.clone()));
        item.insert("createdAt".to_string(), AttributeValue::S(photo.created_at.clone()));
        item.insert("updatedAt".to_string(), AttributeValue::S(photo.updated_at.clone()));
        
        if let Some(notes) = &photo.notes {
            item.insert("notes".to_string(), AttributeValue::S(notes.clone()));
        }
        if let Some(workout_session_id) = &photo.workout_session_id {
            item.insert("workoutSessionId".to_string(), AttributeValue::S(workout_session_id.clone()));
        }
        if !photo.tags.is_empty() {
            let tags: Vec<AttributeValue> = photo.tags.iter()
                .map(|tag| AttributeValue::S(tag.clone()))
                .collect();
            item.insert("tags".to_string(), AttributeValue::L(tags));
        }
        if let Some(metadata) = &photo.metadata {
            item.insert("metadata".to_string(), AttributeValue::S(serde_json::to_string(metadata).unwrap_or_default()));
        }
        
        self.dynamodb_client
            .put_item()
            .table_name(&self.table_name)
            .set_item(Some(item))
            .send()
            .await?;
        
        Ok(photo.clone())
    }

    pub async fn delete_progress_photo(&self, photo_id: &str) -> Result<()> {
        // First get the photo to get the SK
        let photo = self.get_progress_photo_by_id(photo_id).await?;
        
        self.dynamodb_client
            .delete_item()
            .table_name(&self.table_name)
            .key("PK", AttributeValue::S("PROGRESS_PHOTOS".to_string()))
            .key("SK", AttributeValue::S(format!("USER#{}#{}", photo.user_id, photo.taken_at)))
            .send()
            .await?;
        
        Ok(())
    }

    pub async fn delete_progress_photo_from_s3(&self, s3_key: &str) -> Result<()> {
        self.s3_client
            .delete_object()
            .bucket(&self.bucket_name)
            .key(s3_key)
            .send()
            .await?;
        
        Ok(())
    }
}
