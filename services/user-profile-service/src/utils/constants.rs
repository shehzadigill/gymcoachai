// HTTP Status Codes
pub const HTTP_OK: u16 = 200;
pub const HTTP_CREATED: u16 = 201;
pub const HTTP_BAD_REQUEST: u16 = 400;
pub const HTTP_UNAUTHORIZED: u16 = 401;
pub const HTTP_FORBIDDEN: u16 = 403;
pub const HTTP_NOT_FOUND: u16 = 404;
pub const HTTP_INTERNAL_SERVER_ERROR: u16 = 500;

// Error Messages
pub const ERROR_UNAUTHORIZED: &str = "Unauthorized";
pub const ERROR_FORBIDDEN: &str = "Forbidden";
pub const ERROR_NOT_FOUND: &str = "Not Found";
pub const ERROR_BAD_REQUEST: &str = "Bad Request";
pub const ERROR_VALIDATION_ERROR: &str = "Validation Error";
pub const ERROR_INTERNAL_SERVER_ERROR: &str = "Internal Server Error";

// Common Messages
pub const MESSAGE_AUTHENTICATION_FAILED: &str = "Authentication failed";
pub const MESSAGE_ACCESS_DENIED: &str = "Access denied";
pub const MESSAGE_ENDPOINT_NOT_FOUND: &str = "Endpoint not found";
pub const MESSAGE_INVALID_JSON: &str = "Invalid JSON in request body";
pub const MESSAGE_INVALID_DATA: &str = "Invalid data provided";

// CORS Headers
pub const CORS_ORIGIN: &str = "*";
pub const CORS_HEADERS: &str = "Content-Type, Authorization";
pub const CORS_METHODS: &str = "OPTIONS,POST,GET,PUT,DELETE";
pub const CONTENT_TYPE_JSON: &str = "application/json";

// Default Values
pub const DEFAULT_SLEEP_DAYS: u32 = 7;
pub const DEFAULT_SLEEP_PERIOD: &str = "month";
pub const DEFAULT_DATE_FORMAT: &str = "%Y-%m-%d";

// Table Names
pub const DEFAULT_TABLE_NAME: &str = "gymcoach-ai-main";
pub const DEFAULT_S3_BUCKET: &str = "gymcoach-ai-user-uploads";
