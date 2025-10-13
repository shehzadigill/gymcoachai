use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::collections::HashMap;

/// Request context from Lambda event
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Context {
    pub request_id: String,
    pub user_id: Option<String>,
    pub email: Option<String>,
    pub auth_token: Option<String>,
    pub custom: HashMap<String, Value>,
}

impl Context {
    pub fn new(request_id: String) -> Self {
        Self {
            request_id,
            user_id: None,
            email: None,
            auth_token: None,
            custom: HashMap::new(),
        }
    }
    
    pub fn with_user(mut self, user_id: String, email: Option<String>) -> Self {
        self.user_id = Some(user_id);
        self.email = email;
        self
    }
    
    pub fn with_custom(mut self, key: String, value: Value) -> Self {
        self.custom.insert(key, value);
        self
    }
}

/// HTTP Request representation
#[derive(Debug, Clone)]
pub struct Request {
    pub method: String,
    pub path: String,
    pub headers: HashMap<String, String>,
    pub query_params: HashMap<String, String>,
    pub path_params: HashMap<String, String>,
    pub body: Option<String>,
    pub context: Context,
    raw_event: Value,
}

impl Request {
    /// Create a new Request from Lambda event
    pub fn from_lambda_event(event: Value) -> Self {
        let method = event["requestContext"]["http"]["method"]
            .as_str()
            .unwrap_or("GET")
            .to_string();
        
        let path = event["rawPath"]
            .as_str()
            .unwrap_or("/")
            .to_string();
        
        let headers = event.get("headers")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            })
            .unwrap_or_default();
        
        let query_params = event.get("queryStringParameters")
            .and_then(|v| v.as_object())
            .map(|obj| {
                obj.iter()
                    .map(|(k, v)| (k.clone(), v.as_str().unwrap_or("").to_string()))
                    .collect()
            })
            .unwrap_or_default();
        
        let body = event.get("body")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string());
        
        let request_id = event["requestContext"]["requestId"]
            .as_str()
            .unwrap_or("unknown")
            .to_string();
        
        Self {
            method,
            path,
            headers,
            query_params,
            path_params: HashMap::new(),
            body,
            context: Context::new(request_id),
            raw_event: event,
        }
    }
    
    /// Get header value
    pub fn header(&self, name: &str) -> Option<&String> {
        self.headers.get(name)
            .or_else(|| self.headers.get(&name.to_lowercase()))
    }
    
    /// Get query parameter
    pub fn query(&self, name: &str) -> Option<&String> {
        self.query_params.get(name)
    }
    
    /// Get path parameter
    pub fn path_param(&self, name: &str) -> Option<&String> {
        self.path_params.get(name)
    }
    
    /// Parse JSON body
    pub fn json<T: for<'de> Deserialize<'de>>(&self) -> Result<T, serde_json::Error> {
        match &self.body {
            Some(body) => serde_json::from_str(body),
            None => serde_json::from_str("{}"),
        }
    }
    
    /// Get raw body
    pub fn body(&self) -> Option<&str> {
        self.body.as_deref()
    }
    
    /// Get raw Lambda event
    pub fn raw_event(&self) -> &Value {
        &self.raw_event
    }
    
    /// Check if request is CORS preflight
    pub fn is_preflight(&self) -> bool {
        self.method == "OPTIONS"
    }
    
    /// Set path parameters (used internally by router)
    pub(crate) fn set_path_params(&mut self, params: HashMap<String, String>) {
        self.path_params = params;
    }
    
    /// Set context (used internally by middleware)
    pub fn set_context(&mut self, context: Context) {
        self.context = context;
    }
}
