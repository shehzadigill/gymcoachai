use lambda_runtime::{service_fn, Error, LambdaEvent};
use serde_json::{json, Value};
use auth_layer::{AuthLayer, LambdaEvent as AuthLambdaEvent};

#[tokio::main]
async fn main() -> Result<(), Error> {
    lambda_runtime::run(service_fn(handler)).await
}

async fn handler(event: LambdaEvent<Value>) -> Result<Value, Error> {
    let auth_layer = AuthLayer::new();
    
    // Convert the Lambda event to our auth event format
    let auth_event = AuthLambdaEvent {
        headers: event.payload.get("headers")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        request_context: event.payload.get("requestContext")
            .and_then(|v| serde_json::from_value(v.clone()).ok()),
        path_parameters: event.payload.get("pathParameters")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        query_string_parameters: event.payload.get("queryStringParameters")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            }),
        body: event.payload.get("body")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    };
    
    match auth_layer.authenticate(&auth_event).await {
        Ok(auth_result) => {
            if auth_result.is_authorized {
                Ok(json!({
                    "isAuthorized": true,
                    "context": auth_result.context,
                    "principalId": auth_result.context.as_ref().map(|c| &c.user_id).unwrap_or(""),
                    "policyDocument": {
                        "Version": "2012-10-17",
                        "Statement": [
                            {
                                "Action": "execute-api:Invoke",
                                "Effect": "Allow",
                                "Resource": "*"
                            }
                        ]
                    }
                }))
            } else {
                Ok(json!({
                    "isAuthorized": false,
                    "error": auth_result.error.unwrap_or("Access denied".to_string())
                }))
            }
        }
        Err(e) => {
            Ok(json!({
                "isAuthorized": false,
                "error": e.to_string()
            }))
        }
    }
}
