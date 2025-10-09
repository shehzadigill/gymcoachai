use serde_json::Value;
use anyhow::Result;
use tracing::error;

use crate::models::*;
use crate::service::UploadService;
use crate::utils::{ResponseBuilder, response_helpers, DataHelper};

#[derive(Clone)]
pub struct UploadController {
    upload_service: UploadService,
}

impl UploadController {
    pub fn new(upload_service: UploadService) -> Self {
        Self {
            upload_service,
        }
    }

    pub async fn generate_upload_url(&self, body: &str) -> Result<Value, Box<dyn std::error::Error + Send + Sync>> {
        let upload_request: Result<UploadRequest, _> = DataHelper::parse_json_to_type(body);
        
        match upload_request {
            Ok(request) => {
                match self.upload_service.generate_upload_url(&request).await {
                    Ok(response) => Ok(ResponseBuilder::ok(response)),
                    Err(e) => {
                        error!("Error generating presigned URL: {}", e);
                        Ok(ResponseBuilder::internal_server_error("Failed to generate upload URL"))
                    }
                }
            }
            Err(_) => {
                error!("Error parsing upload request");
                Ok(response_helpers::invalid_data("Invalid upload request"))
            }
        }
    }

}
