/// CORS configuration
#[derive(Debug, Clone)]
pub struct CorsConfig {
    pub allow_origin: String,
    pub allow_methods: Vec<String>,
    pub allow_headers: Vec<String>,
    pub max_age: u32,
    pub allow_credentials: bool,
}

impl CorsConfig {
    pub fn new() -> Self {
        Self {
            allow_origin: "*".to_string(),
            allow_methods: vec![
                "GET".to_string(),
                "POST".to_string(),
                "PUT".to_string(),
                "DELETE".to_string(),
                "OPTIONS".to_string(),
            ],
            allow_headers: vec![
                "Content-Type".to_string(),
                "Authorization".to_string(),
            ],
            max_age: 3600,
            allow_credentials: false,
        }
    }
    
    pub fn allow_origin(mut self, origin: impl Into<String>) -> Self {
        self.allow_origin = origin.into();
        self
    }
    
    pub fn allow_methods(mut self, methods: Vec<String>) -> Self {
        self.allow_methods = methods;
        self
    }
    
    pub fn allow_headers(mut self, headers: Vec<String>) -> Self {
        self.allow_headers = headers;
        self
    }
    
    pub fn max_age(mut self, max_age: u32) -> Self {
        self.max_age = max_age;
        self
    }
    
    pub fn allow_credentials(mut self, allow: bool) -> Self {
        self.allow_credentials = allow;
        self
    }
}

impl Default for CorsConfig {
    fn default() -> Self {
        Self::new()
    }
}
