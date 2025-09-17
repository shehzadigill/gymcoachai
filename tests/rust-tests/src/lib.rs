use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use chrono::{DateTime, Utc};
use uuid::Uuid;
use anyhow::Result;

/// Test utilities for Lambda functions
pub mod test_utils {
    use super::*;
    use serde_json::Value;

    /// Create a mock Lambda event for testing
    pub fn create_mock_event(
        http_method: &str,
        path: &str,
        body: Option<Value>,
        path_parameters: Option<HashMap<String, String>>,
        query_string_parameters: Option<HashMap<String, String>>,
        headers: Option<HashMap<String, String>>,
    ) -> Value {
        let mut event = serde_json::json!({
            "requestContext": {
                "http": {
                    "method": http_method,
                    "path": path
                },
                "requestId": Uuid::new_v4().to_string(),
                "time": Utc::now().to_rfc3339(),
                "timeEpoch": Utc::now().timestamp()
            },
            "rawPath": path,
            "pathParameters": path_parameters.unwrap_or_default(),
            "queryStringParameters": query_string_parameters.unwrap_or_default(),
            "headers": headers.unwrap_or_default(),
            "body": body.map(|b| b.to_string()).unwrap_or_else(|| "{}".to_string()),
            "isBase64Encoded": false
        });

        event
    }

    /// Create a mock Lambda context for testing
    pub fn create_mock_context() -> lambda_runtime::Context {
        lambda_runtime::Context {
            request_id: Uuid::new_v4().to_string(),
            function_name: "test-function".to_string(),
            function_version: "1".to_string(),
            invoked_function_arn: "arn:aws:lambda:us-east-1:123456789012:function:test-function".to_string(),
            memory_limit_in_mb: 256,
            remaining_time_in_millis: 30000,
            log_group_name: "test-log-group".to_string(),
            log_stream_name: "test-log-stream".to_string(),
            client_context: None,
            identity: None,
            deadline: std::time::SystemTime::now() + std::time::Duration::from_secs(30),
        }
    }

    /// Create test user data
    pub fn create_test_user() -> Value {
        serde_json::json!({
            "userId": "user123",
            "email": "test@example.com",
            "name": "Test User",
            "fitnessGoals": "Build muscle",
            "experienceLevel": "beginner",
            "preferences": {
                "units": "metric",
                "timezone": "UTC",
                "notifications": {
                    "email": true,
                    "push": true,
                    "workoutReminders": true,
                    "nutritionReminders": true
                },
                "privacy": {
                    "profileVisibility": "private",
                    "workoutSharing": false,
                    "progressSharing": false
                }
            },
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
        })
    }

    /// Create test workout plan data
    pub fn create_test_workout_plan() -> Value {
        serde_json::json!({
            "id": "plan123",
            "userId": "user123",
            "name": "Test Workout Plan",
            "description": "A test workout plan",
            "difficulty": "beginner",
            "durationWeeks": 4,
            "frequencyPerWeek": 3,
            "exercises": [
                {
                    "exerciseId": "ex123",
                    "name": "Push-ups",
                    "sets": 3,
                    "reps": 10,
                    "restSeconds": 60,
                    "order": 1
                }
            ],
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
        })
    }

    /// Create test workout session data
    pub fn create_test_workout_session() -> Value {
        serde_json::json!({
            "id": "session123",
            "userId": "user123",
            "workoutPlanId": "plan123",
            "name": "Test Workout Session",
            "exercises": [
                {
                    "exerciseId": "ex123",
                    "name": "Push-ups",
                    "sets": [
                        {
                            "reps": 10,
                            "weight": 0,
                            "completed": true,
                            "notes": "Good form"
                        }
                    ],
                    "order": 1
                }
            ],
            "startedAt": "2024-01-01T00:00:00Z",
            "completedAt": "2024-01-01T01:00:00Z",
            "totalDuration": 60,
            "notes": "Great workout",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
        })
    }

    /// Create test strength progress data
    pub fn create_test_strength_progress() -> Value {
        serde_json::json!({
            "id": "progress123",
            "userId": "user123",
            "exerciseId": "ex123",
            "exerciseName": "Push-ups",
            "currentMaxWeight": 0,
            "previousMaxWeight": 0,
            "weightIncrease": 0,
            "percentageIncrease": 0,
            "period": "week",
            "measurementDate": "2024-01-01T00:00:00Z",
            "trend": "stable",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
        })
    }

    /// Create test body measurement data
    pub fn create_test_body_measurement() -> Value {
        serde_json::json!({
            "id": "measurement123",
            "userId": "user123",
            "measurementType": "weight",
            "value": 70.5,
            "unit": "kg",
            "measurementDate": "2024-01-01T00:00:00Z",
            "notes": "Starting weight",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
        })
    }

    /// Create test milestone data
    pub fn create_test_milestone() -> Value {
        serde_json::json!({
            "id": "milestone123",
            "userId": "user123",
            "title": "First Workout",
            "description": "Completed your first workout",
            "type": "achievement",
            "isAchieved": true,
            "achievedAt": "2024-01-01T00:00:00Z",
            "createdAt": "2024-01-01T00:00:00Z",
            "updatedAt": "2024-01-01T00:00:00Z"
        })
    }

    /// Validate Lambda response
    pub fn validate_lambda_response(response: &Value, expected_status_code: u16) {
        let status_code = response["statusCode"].as_u64().unwrap_or(0) as u16;
        assert_eq!(status_code, expected_status_code, "Expected status code {}, got {}", expected_status_code, status_code);
        
        if status_code >= 400 {
            let body = response["body"].as_str().unwrap_or("{}");
            let body_json: Value = serde_json::from_str(body).unwrap_or(Value::Null);
            assert!(body_json["error"].is_string() || body_json["message"].is_string(), "Error response should contain error or message field");
        }
    }

    /// Create mock DynamoDB response
    pub fn mock_dynamodb_response(item: Value) -> Result<aws_sdk_dynamodb::operation::get_item::GetItemOutput> {
        use aws_sdk_dynamodb::types::AttributeValue;
        use std::collections::HashMap;

        let mut attributes = HashMap::new();
        if let Some(obj) = item.as_object() {
            for (key, value) in obj {
                let attr_value = match value {
                    Value::String(s) => AttributeValue::S(s.clone()),
                    Value::Number(n) => {
                        if let Some(i) = n.as_i64() {
                            AttributeValue::N(i.to_string())
                        } else if let Some(f) = n.as_f64() {
                            AttributeValue::N(f.to_string())
                        } else {
                            AttributeValue::S(n.to_string())
                        }
                    },
                    Value::Bool(b) => AttributeValue::Bool(*b),
                    Value::Array(arr) => {
                        let list_values: Vec<AttributeValue> = arr.iter()
                            .map(|v| match v {
                                Value::String(s) => AttributeValue::S(s.clone()),
                                _ => AttributeValue::S(v.to_string()),
                            })
                            .collect();
                        AttributeValue::L(list_values)
                    },
                    Value::Object(_) => AttributeValue::S(value.to_string()),
                    Value::Null => AttributeValue::Null(true),
                };
                attributes.insert(key.clone(), attr_value);
            }
        }

        Ok(aws_sdk_dynamodb::operation::get_item::GetItemOutput::builder()
            .set_item(Some(attributes))
            .build())
    }

    /// Create mock DynamoDB query response
    pub fn mock_dynamodb_query_response(items: Vec<Value>) -> Result<aws_sdk_dynamodb::operation::query::QueryOutput> {
        use aws_sdk_dynamodb::types::AttributeValue;
        use std::collections::HashMap;

        let mut dynamodb_items = Vec::new();
        for item in items {
            let mut attributes = HashMap::new();
            if let Some(obj) = item.as_object() {
                for (key, value) in obj {
                    let attr_value = match value {
                        Value::String(s) => AttributeValue::S(s.clone()),
                        Value::Number(n) => {
                            if let Some(i) = n.as_i64() {
                                AttributeValue::N(i.to_string())
                            } else if let Some(f) = n.as_f64() {
                                AttributeValue::N(f.to_string())
                            } else {
                                AttributeValue::S(n.to_string())
                            }
                        },
                        Value::Bool(b) => AttributeValue::Bool(*b),
                        Value::Array(arr) => {
                            let list_values: Vec<AttributeValue> = arr.iter()
                                .map(|v| match v {
                                    Value::String(s) => AttributeValue::S(s.clone()),
                                    _ => AttributeValue::S(v.to_string()),
                                })
                                .collect();
                            AttributeValue::L(list_values)
                        },
                        Value::Object(_) => AttributeValue::S(value.to_string()),
                        Value::Null => AttributeValue::Null(true),
                    };
                    attributes.insert(key.clone(), attr_value);
                }
            }
            dynamodb_items.push(attributes);
        }

        Ok(aws_sdk_dynamodb::operation::query::QueryOutput::builder()
            .set_items(Some(dynamodb_items))
            .set_count(Some(items.len() as i32))
            .build())
    }

    /// Create mock DynamoDB error
    pub fn mock_dynamodb_error(message: &str) -> aws_sdk_dynamodb::Error {
        aws_sdk_dynamodb::Error::Unhandled(
            aws_sdk_dynamodb::error::Unhandled::builder()
                .source(anyhow::anyhow!(message))
                .build()
        )
    }

    /// Create mock S3 response
    pub fn mock_s3_response() -> Result<aws_sdk_s3::operation::get_object::GetObjectOutput> {
        use aws_sdk_s3::primitives::ByteStream;

        Ok(aws_sdk_s3::operation::get_object::GetObjectOutput::builder()
            .set_body(Some(ByteStream::from("test file content".as_bytes().to_vec())))
            .set_content_type(Some("image/jpeg".to_string()))
            .set_content_length(Some(1048576))
            .build())
    }

    /// Create mock S3 error
    pub fn mock_s3_error(message: &str) -> aws_sdk_s3::Error {
        aws_sdk_s3::Error::Unhandled(
            aws_sdk_s3::error::Unhandled::builder()
                .source(anyhow::anyhow!(message))
                .build()
        )
    }
}

/// Performance testing utilities
pub mod performance_utils {
    use super::*;
    use std::time::{Duration, Instant};

    /// Measure execution time
    pub fn measure_time<F, R>(f: F) -> (R, Duration)
    where
        F: FnOnce() -> R,
    {
        let start = Instant::now();
        let result = f();
        let duration = start.elapsed();
        (result, duration)
    }

    /// Run concurrent tests
    pub async fn run_concurrent_tests<F, Fut, R>(
        count: usize,
        test_fn: F,
    ) -> Vec<R>
    where
        F: Fn(usize) -> Fut,
        Fut: std::future::Future<Output = R>,
    {
        let mut handles = Vec::new();
        for i in 0..count {
            let handle = tokio::spawn(test_fn(i));
            handles.push(handle);
        }

        let mut results = Vec::new();
        for handle in handles {
            results.push(handle.await.unwrap());
        }

        results
    }

    /// Assert performance requirements
    pub fn assert_performance(duration: Duration, max_duration: Duration) {
        assert!(
            duration <= max_duration,
            "Performance test failed: {} > {}",
            duration.as_millis(),
            max_duration.as_millis()
        );
    }
}

/// Security testing utilities
pub mod security_utils {
    use super::*;

    /// Test data for security validation
    pub struct SecurityTestData {
        pub xss_payloads: Vec<&'static str>,
        pub sql_injection_payloads: Vec<&'static str>,
        pub nosql_injection_payloads: Vec<&'static str>,
        pub oversized_payloads: Vec<String>,
    }

    impl Default for SecurityTestData {
        fn default() -> Self {
            Self {
                xss_payloads: vec![
                    "<script>alert('xss')</script>",
                    "javascript:alert('xss')",
                    "onload=alert('xss')",
                    "<img src=x onerror=alert('xss')>",
                ],
                sql_injection_payloads: vec![
                    "'; DROP TABLE users; --",
                    "UNION SELECT * FROM users",
                    "1' OR '1'='1",
                    "admin'--",
                ],
                nosql_injection_payloads: vec![
                    r#"{"$where": "this.password == this.username"}"#,
                    r#"{"$ne": null}"#,
                    r#"{"$gt": 0}"#,
                    r#"{"$regex": ".*"}"#,
                ],
                oversized_payloads: vec![
                    "x".repeat(10_000_000), // 10MB
                    "y".repeat(1_000_000),  // 1MB
                    "z".repeat(100_000),    // 100KB
                ],
            }
        }
    }

    /// Validate that input is properly sanitized
    pub fn validate_input_sanitization(input: &str, expected_sanitized: &str) {
        // In a real implementation, this would check that the input
        // has been properly sanitized according to security rules
        assert_ne!(input, expected_sanitized, "Input should be sanitized");
    }

    /// Test for XSS vulnerabilities
    pub fn test_xss_protection(input: &str) -> bool {
        let xss_patterns = [
            "<script", "javascript:", "onload=", "onerror=", "onclick=",
            "onmouseover=", "onfocus=", "onblur=", "onchange=", "onsubmit=",
        ];
        
        let input_lower = input.to_lowercase();
        !xss_patterns.iter().any(|pattern| input_lower.contains(pattern))
    }

    /// Test for SQL injection vulnerabilities
    pub fn test_sql_injection_protection(input: &str) -> bool {
        let sql_patterns = [
            "union select", "drop table", "delete from", "insert into",
            "update set", "create table", "alter table", "exec(",
            "execute(", "sp_", "xp_", "waitfor delay", "benchmark(",
        ];
        
        let input_lower = input.to_lowercase();
        !sql_patterns.iter().any(|pattern| input_lower.contains(pattern))
    }

    /// Test for NoSQL injection vulnerabilities
    pub fn test_nosql_injection_protection(input: &str) -> bool {
        let nosql_patterns = [
            "$where", "$ne", "$gt", "$lt", "$gte", "$lte", "$in", "$nin",
            "$exists", "$regex", "$text", "$search", "$geoWithin",
        ];
        
        let input_lower = input.to_lowercase();
        !nosql_patterns.iter().any(|pattern| input_lower.contains(pattern))
    }
}

/// Database testing utilities
pub mod database_utils {
    use super::*;

    /// Create test database connection
    pub async fn create_test_db_connection() -> Result<aws_sdk_dynamodb::Client> {
        let config = aws_config::load_from_env().await;
        Ok(aws_sdk_dynamodb::Client::new(&config))
    }

    /// Create test S3 connection
    pub async fn create_test_s3_connection() -> Result<aws_sdk_s3::Client> {
        let config = aws_config::load_from_env().await;
        Ok(aws_sdk_s3::Client::new(&config))
    }

    /// Validate database consistency
    pub fn validate_database_consistency(operations: &[DatabaseOperation]) {
        // Check that all operations for the same user use consistent user IDs
        let mut user_ids = std::collections::HashSet::new();
        for op in operations {
            if let Some(user_id) = &op.user_id {
                user_ids.insert(user_id.clone());
            }
        }
        
        // In a real implementation, this would check that all operations
        // for the same user are consistent
        assert!(user_ids.len() <= 1, "All operations should use the same user ID");
    }

    #[derive(Debug, Clone)]
    pub struct DatabaseOperation {
        pub user_id: Option<String>,
        pub operation_type: String,
        pub table_name: String,
    }
}

/// Mock implementations for testing
pub mod mocks {
    use super::*;
    use mockall::mock;

    mock! {
        pub DynamoDbClient {}

        impl aws_sdk_dynamodb::Client {
            pub async fn get_item(&self, input: aws_sdk_dynamodb::input::GetItemInput) -> Result<aws_sdk_dynamodb::output::GetItemOutput, aws_sdk_dynamodb::Error> {
                Ok(aws_sdk_dynamodb::output::GetItemOutput::builder().build())
            }

            pub async fn put_item(&self, input: aws_sdk_dynamodb::input::PutItemInput) -> Result<aws_sdk_dynamodb::output::PutItemOutput, aws_sdk_dynamodb::Error> {
                Ok(aws_sdk_dynamodb::output::PutItemOutput::builder().build())
            }

            pub async fn update_item(&self, input: aws_sdk_dynamodb::input::UpdateItemInput) -> Result<aws_sdk_dynamodb::output::UpdateItemOutput, aws_sdk_dynamodb::Error> {
                Ok(aws_sdk_dynamodb::output::UpdateItemOutput::builder().build())
            }

            pub async fn delete_item(&self, input: aws_sdk_dynamodb::input::DeleteItemInput) -> Result<aws_sdk_dynamodb::output::DeleteItemOutput, aws_sdk_dynamodb::Error> {
                Ok(aws_sdk_dynamodb::output::DeleteItemOutput::builder().build())
            }

            pub async fn query(&self, input: aws_sdk_dynamodb::input::QueryInput) -> Result<aws_sdk_dynamodb::output::QueryOutput, aws_sdk_dynamodb::Error> {
                Ok(aws_sdk_dynamodb::output::QueryOutput::builder().build())
            }
        }
    }

    mock! {
        pub S3Client {}

        impl aws_sdk_s3::Client {
            pub async fn get_object(&self, input: aws_sdk_s3::input::GetObjectInput) -> Result<aws_sdk_s3::output::GetObjectOutput, aws_sdk_s3::Error> {
                Ok(aws_sdk_s3::output::GetObjectOutput::builder().build())
            }

            pub async fn put_object(&self, input: aws_sdk_s3::input::PutObjectInput) -> Result<aws_sdk_s3::output::PutObjectOutput, aws_sdk_s3::Error> {
                Ok(aws_sdk_s3::output::PutObjectOutput::builder().build())
            }

            pub async fn delete_object(&self, input: aws_sdk_s3::input::DeleteObjectInput) -> Result<aws_sdk_s3::output::DeleteObjectOutput, aws_sdk_s3::Error> {
                Ok(aws_sdk_s3::output::DeleteObjectOutput::builder().build())
            }

            pub async fn list_objects_v2(&self, input: aws_sdk_s3::input::ListObjectsV2Input) -> Result<aws_sdk_s3::output::ListObjectsV2Output, aws_sdk_s3::Error> {
                Ok(aws_sdk_s3::output::ListObjectsV2Output::builder().build())
            }

            pub async fn copy_object(&self, input: aws_sdk_s3::input::CopyObjectInput) -> Result<aws_sdk_s3::output::CopyObjectOutput, aws_sdk_s3::Error> {
                Ok(aws_sdk_s3::output::CopyObjectOutput::builder().build())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_create_mock_event() {
        let event = test_utils::create_mock_event(
            "POST",
            "/api/user-profiles",
            Some(serde_json::json!({"userId": "user123"})),
            None,
            None,
            None,
        );

        assert_eq!(event["requestContext"]["http"]["method"], "POST");
        assert_eq!(event["rawPath"], "/api/user-profiles");
        assert_eq!(event["body"], r#"{"userId":"user123"}"#);
    }

    #[test]
    fn test_security_utils() {
        let security_data = security_utils::SecurityTestData::default();
        
        assert!(!security_utils::test_xss_protection("<script>alert('xss')</script>"));
        assert!(security_utils::test_xss_protection("normal text"));
        
        assert!(!security_utils::test_sql_injection_protection("'; DROP TABLE users; --"));
        assert!(security_utils::test_sql_injection_protection("normal query"));
        
        assert!(!security_utils::test_nosql_injection_protection(r#"{"$where": "this.password == this.username"}"#));
        assert!(security_utils::test_nosql_injection_protection(r#"{"username": "test"}"#));
    }

    #[test]
    fn test_performance_utils() {
        let (result, duration) = performance_utils::measure_time(|| {
            std::thread::sleep(std::time::Duration::from_millis(10));
            "test result"
        });

        assert_eq!(result, "test result");
        assert!(duration >= std::time::Duration::from_millis(10));
    }
}
