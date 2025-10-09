use aws_sdk_s3::{Client as S3Client, presigning::PresigningConfig};
use uuid::Uuid;
use anyhow::Result;

use crate::models::*;

#[derive(Clone)]
pub struct UploadService {
    s3_client: S3Client,
}

impl UploadService {
    pub fn new(s3_client: S3Client) -> Self {
        Self { s3_client }
    }

    pub async fn generate_upload_url(&self, request: &UploadRequest) -> Result<UploadResponse, Box<dyn std::error::Error + Send + Sync>> {
        let file_type = &request.file_type;
        let file_extension = match file_type.as_str() {
            "image/jpeg" => "jpg",
            "image/png" => "png",
            "image/gif" => "gif",
            "image/webp" => "webp",
            _ => "jpg",
        };
        
        let file_name = format!("{}.{}", Uuid::new_v4(), file_extension);
        let key = format!("user-profiles/{}", file_name);
        
        let presigning_config = PresigningConfig::expires_in(std::time::Duration::from_secs(300))?;
        
        let bucket_name = std::env::var("USER_UPLOADS_BUCKET").unwrap_or_else(|_| "gymcoach-ai-user-uploads".to_string());
        
        let presigned_url = self.s3_client
            .put_object()
            .bucket(&bucket_name)
            .key(&key)
            .content_type(file_type)
            .presigned(presigning_config)
            .await?;
        
        Ok(UploadResponse {
            upload_url: presigned_url.uri().to_string(),
            key,
            bucket_name: bucket_name.clone(),
            expires_in: 300,
        })
    }
}
