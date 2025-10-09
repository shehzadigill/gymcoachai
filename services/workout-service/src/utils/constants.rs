// HTTP Headers
pub const HEADER_CONTENT_TYPE: &str = "Content-Type";
pub const HEADER_ACCESS_CONTROL_ALLOW_ORIGIN: &str = "Access-Control-Allow-Origin";
pub const HEADER_ACCESS_CONTROL_ALLOW_HEADERS: &str = "Access-Control-Allow-Headers";
pub const HEADER_ACCESS_CONTROL_ALLOW_METHODS: &str = "Access-Control-Allow-Methods";

// HTTP Methods
pub const METHOD_OPTIONS: &str = "OPTIONS";
pub const METHOD_POST: &str = "POST";
pub const METHOD_GET: &str = "GET";
pub const METHOD_PUT: &str = "PUT";
pub const METHOD_DELETE: &str = "DELETE";

// Common Messages
pub const MESSAGE_FORBIDDEN: &str = "Forbidden";
pub const MESSAGE_UNAUTHORIZED: &str = "Unauthorized";
pub const MESSAGE_INTERNAL_SERVER_ERROR: &str = "Internal Server Error";
pub const MESSAGE_BAD_REQUEST: &str = "Bad Request";
pub const MESSAGE_VALIDATION_ERROR: &str = "Validation Error";
pub const MESSAGE_ACCESS_DENIED: &str = "Access denied";
pub const MESSAGE_ENDPOINT_NOT_FOUND: &str = "Endpoint not found";
pub const MESSAGE_INVALID_JSON: &str = "Invalid JSON in request body";
pub const MESSAGE_INVALID_DATA: &str = "Invalid data provided";
pub const MESSAGE_DELETED_SUCCESSFULLY: &str = " deleted successfully";

// Default Values
pub const DEFAULT_SLEEP_DAYS: u32 = 7;
pub const DEFAULT_SLEEP_PERIOD: &str = "month";
pub const DEFAULT_PROFILE_VISIBILITY: &str = "private";
pub const DEFAULT_UNITS: &str = "metric";
pub const DEFAULT_TIMEZONE: &str = "UTC";
pub const DEFAULT_TABLE_NAME: &str = "gymcoach-ai-main";
pub const DEFAULT_S3_BUCKET: &str = "gymcoach-ai-user-uploads";
