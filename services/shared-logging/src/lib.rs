use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use tracing::{debug, error, info, instrument, warn};

#[derive(Debug, Serialize, Deserialize)]
pub struct LogContext {
    pub request_id: String,
    pub user_id: Option<String>,
    pub service: String,
    pub operation: String,
    pub timestamp: DateTime<Utc>,
    pub duration_ms: Option<u64>,
    pub status_code: Option<u16>,
    pub error_message: Option<String>,
    pub metadata: HashMap<String, serde_json::Value>,
}

impl LogContext {
    pub fn new(request_id: String, service: String, operation: String) -> Self {
        Self {
            request_id,
            user_id: None,
            service,
            operation,
            timestamp: Utc::now(),
            duration_ms: None,
            status_code: None,
            error_message: None,
            metadata: HashMap::new(),
        }
    }

    pub fn with_user_id(mut self, user_id: String) -> Self {
        self.user_id = Some(user_id);
        self
    }

    pub fn with_duration(mut self, duration_ms: u64) -> Self {
        self.duration_ms = Some(duration_ms);
        self
    }

    pub fn with_status_code(mut self, status_code: u16) -> Self {
        self.status_code = Some(status_code);
        self
    }

    pub fn with_error(mut self, error_message: String) -> Self {
        self.error_message = Some(error_message);
        self
    }

    pub fn with_metadata(mut self, key: String, value: serde_json::Value) -> Self {
        self.metadata.insert(key, value);
        self
    }

    pub fn log_info(&self, message: &str) {
        info!(
            request_id = %self.request_id,
            user_id = %self.user_id.as_deref().unwrap_or("unknown"),
            service = %self.service,
            operation = %self.operation,
            duration_ms = self.duration_ms,
            status_code = self.status_code,
            metadata = ?self.metadata,
            "{}", message
        );
    }

    pub fn log_error(&self, message: &str) {
        error!(
            request_id = %self.request_id,
            user_id = %self.user_id.as_deref().unwrap_or("unknown"),
            service = %self.service,
            operation = %self.operation,
            duration_ms = self.duration_ms,
            status_code = self.status_code,
            error_message = %self.error_message.as_deref().unwrap_or(""),
            metadata = ?self.metadata,
            "{}", message
        );
    }

    pub fn log_warn(&self, message: &str) {
        warn!(
            request_id = %self.request_id,
            user_id = %self.user_id.as_deref().unwrap_or("unknown"),
            service = %self.service,
            operation = %self.operation,
            duration_ms = self.duration_ms,
            status_code = self.status_code,
            metadata = ?self.metadata,
            "{}", message
        );
    }

    pub fn log_debug(&self, message: &str) {
        debug!(
            request_id = %self.request_id,
            user_id = %self.user_id.as_deref().unwrap_or("unknown"),
            service = %self.service,
            operation = %self.operation,
            duration_ms = self.duration_ms,
            status_code = self.status_code,
            metadata = ?self.metadata,
            "{}", message
        );
    }
}

#[derive(Debug)]
pub struct Logger {
    service_name: String,
}

impl Logger {
    pub fn new(service_name: String) -> Self {
        Self { service_name }
    }

    #[instrument]
    pub fn start_request(&self, request_id: String, operation: String) -> LogContext {
        let context = LogContext::new(request_id, self.service_name.clone(), operation);
        context.log_info("Request started");
        context
    }

    #[instrument]
    pub fn end_request(&self, mut context: LogContext, status_code: u16, duration_ms: u64) {
        context = context
            .with_status_code(status_code)
            .with_duration(duration_ms);
        context.log_info("Request completed");
    }

    #[instrument]
    pub fn log_error(&self, mut context: LogContext, error_message: String, status_code: u16) {
        context = context
            .with_error(error_message)
            .with_status_code(status_code);
        context.log_error("Request failed");
    }

    #[instrument]
    pub fn log_warning(&self, context: &LogContext, message: String) {
        context.log_warn(&message);
    }

    #[instrument]
    pub fn log_debug(&self, context: &LogContext, message: String) {
        context.log_debug(&message);
    }
}

pub fn init_logging() {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .with_target(false)
        .with_thread_ids(true)
        .with_thread_names(true)
        .with_file(true)
        .with_line_number(true)
        .json()
        .init();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_log_context_creation() {
        let context = LogContext::new(
            "req123".to_string(),
            "user-service".to_string(),
            "get_user".to_string(),
        );

        assert_eq!(context.request_id, "req123");
        assert_eq!(context.operation, "get_user");
        assert!(context.user_id.is_none());
    }

    #[test]
    fn test_log_context_with_user_id() {
        let context = LogContext::new(
            "req123".to_string(),
            "user-service".to_string(),
            "get_user".to_string(),
        )
        .with_user_id("user456".to_string());

        assert_eq!(context.user_id, Some("user456".to_string()));
    }

    #[test]
    fn test_log_context_with_metadata() {
        let context = LogContext::new(
            "req123".to_string(),
            "user-service".to_string(),
            "get_user".to_string(),
        )
        .with_metadata("key".to_string(), serde_json::json!("value"));

        assert_eq!(
            context.metadata.get("key"),
            Some(&serde_json::json!("value"))
        );
    }
}
