use lambda_runtime::{run, service_fn, Error, LambdaEvent};
use serde::{Deserialize, Serialize};
use serde_json::json;
use aws_sdk_dynamodb::{Client as DynamoDbClient, types::AttributeValue};
use std::collections::HashMap;

#[derive(Deserialize)]
struct NotificationRequest {
    user_id: String,
    notification_type: String,
    title: String,
    body: String,
    data: Option<serde_json::Value>,
}

#[derive(Serialize)]
struct FcmMessage {
    token: String,
    notification: FcmNotification,
    data: Option<HashMap<String, String>>,
}

#[derive(Serialize)]
struct FcmNotification {
    title: String,
    body: String,
}

async fn send_notification(
    event: NotificationRequest,
    dynamodb: &DynamoDbClient,
    fcm_key: &str,
) -> Result<(), Error> {
    // Get user's device tokens from DynamoDB
    let tokens = get_user_device_tokens(dynamodb, &event.user_id).await?;
    
    if tokens.is_empty() {
        tracing::warn!("No device tokens found for user: {}", event.user_id);
        return Ok(());
    }
    
    // Send to each device
    for token in tokens {
        send_fcm_notification(&token, &event.title, &event.body, event.data.clone(), fcm_key).await?;
    }
    
    Ok(())
}

async fn get_user_device_tokens(
    dynamodb: &DynamoDbClient,
    user_id: &str,
) -> Result<Vec<String>, Error> {
    let table_name = std::env::var("TABLE_NAME")?;
    
    let result = dynamodb
        .query()
        .table_name(table_name)
        .key_condition_expression("PK = :pk AND begins_with(SK, :sk)")
        .expression_attribute_values(":pk", AttributeValue::S(format!("USER#{}", user_id)))
        .expression_attribute_values(":sk", AttributeValue::S("DEVICE#".to_string()))
        .send()
        .await?;
    
    let mut tokens = Vec::new();
    if let Some(items) = result.items {
        for item in items {
            if let Some(token) = item.get("fcmToken").and_then(|v| v.as_s().ok()) {
                tokens.push(token.to_string());
            }
        }
    }
    
    Ok(tokens)
}

async fn send_fcm_notification(
    token: &str,
    title: &str,
    body: &str,
    data: Option<serde_json::Value>,
    fcm_key: &str,
) -> Result<(), Error> {
    let client = reqwest::Client::new();
    
    let mut data_map = HashMap::new();
    if let Some(d) = data {
        if let serde_json::Value::Object(obj) = d {
            for (k, v) in obj {
                data_map.insert(k, v.to_string());
            }
        }
    }
    
    let payload = json!({
        "to": token,
        "notification": {
            "title": title,
            "body": body,
        },
        "data": data_map,
        "priority": "high",
    });
    
    let response = client
        .post("https://fcm.googleapis.com/fcm/send")
        .header("Authorization", format!("key={}", fcm_key))
        .header("Content-Type", "application/json")
        .json(&payload)
        .send()
        .await?;
    
    if !response.status().is_success() {
        tracing::error!("FCM request failed: {:?}", response.text().await?);
    }
    
    Ok(())
}

async fn handler(event: LambdaEvent<NotificationRequest>) -> Result<serde_json::Value, Error> {
    tracing_subscriber::fmt()
        .with_max_level(tracing::Level::INFO)
        .json()
        .with_target(false)
        .without_time()
        .init();
    
    let (payload, _context) = event.into_parts();
    let config = aws_config::load_from_env().await;
    let dynamodb = DynamoDbClient::new(&config);
    let fcm_key = std::env::var("FCM_SERVER_KEY")?;
    
    send_notification(payload, &dynamodb, &fcm_key).await?;
    
    Ok(json!({ "success": true }))
}

#[tokio::main]
async fn main() -> Result<(), Error> {
    run(service_fn(handler)).await
}
