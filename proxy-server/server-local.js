const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration for local development - allow all localhost origins
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    // Allow all localhost and 127.0.0.1 on any port for local development
    if (
      origin.startsWith('http://localhost') ||
      origin.startsWith('http://127.0.0.1')
    ) {
      return callback(null, true);
    }

    // Log and allow other origins in development
    console.log(`[CORS] Allowing origin: ${origin}`);
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
  ],
  exposedHeaders: [
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
  ],
  optionsSuccessStatus: 200,
};

// Apply CORS middleware
app.use(cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'GymCoach AI Local Proxy Server',
    timestamp: new Date().toISOString(),
    mode: 'local-development',
  });
});

// Local Lambda service mapping
const SERVICE_MAP = {
  '/api/auth': { port: 9000, name: 'auth-layer' },
  '/api/user-profiles': { port: 9002, name: 'user-profile-service' },
  '/api/workouts': { port: 9003, name: 'workout-service' },
  '/api/coaching': { port: 9004, name: 'coaching-service' },
  '/api/analytics': { port: 9005, name: 'analytics-service' },
  '/api/nutrition': { port: 9006, name: 'nutrition-service' },
  '/api/notifications': { port: 9007, name: 'notification-service' },
  '/api/ai': { port: 9001, name: 'ai-service-python' },
  // Legacy routes without /api prefix (for direct access)
  '/auth': { port: 9000, name: 'auth-layer' },
  '/profile': { port: 9002, name: 'user-profile-service' },
  '/workouts': { port: 9003, name: 'workout-service' },
  '/coaching': { port: 9004, name: 'coaching-service' },
  '/analytics': { port: 9005, name: 'analytics-service' },
  '/nutrition': { port: 9006, name: 'nutrition-service' },
  '/notifications': { port: 9007, name: 'notification-service' },
  '/chat': { port: 9001, name: 'ai-service-python' },
  '/ai': { port: 9001, name: 'ai-service-python' },
};

// Transform API Gateway event for local Lambda
function transformToLambdaEvent(req) {
  // Build rawQueryString from req.query object
  const rawQueryString = Object.keys(req.query || {})
    .map((key) => `${key}=${encodeURIComponent(req.query[key])}`)
    .join('&');

  return {
    version: '2.0',
    httpMethod: req.method, // Legacy format
    rawPath: req.path,
    rawQueryString: rawQueryString,
    path: req.path,
    pathParameters: req.params,
    queryStringParameters: req.query,
    headers: req.headers,
    body: req.body ? JSON.stringify(req.body) : null,
    isBase64Encoded: false,
    requestContext: {
      http: {
        method: req.method,
        path: req.path,
      },
      authorizer: {
        claims: req.headers.authorization
          ? {
              sub: 'local-dev-user',
              email: 'dev@localhost',
            }
          : {},
      },
    },
  };
}

// Transform Lambda response to HTTP response
function transformFromLambdaResponse(lambdaResponse, res) {
  try {
    const response = JSON.parse(lambdaResponse);

    // Handle Lambda response format
    if (response?.statusCode) {
      res.status(response.statusCode);

      // Set headers if present
      if (response?.headers) {
        Object.keys(response.headers).forEach((key) => {
          res.set(key, response.headers[key]);
        });
      }

      // Send body
      const body = response?.isBase64Encoded
        ? Buffer.from(response.body, 'base64')
        : response?.body;

      if (typeof body === 'string') {
        try {
          res.json(JSON.parse(body));
        } catch {
          res.send(body);
        }
      } else {
        res.json(body);
      }
    } else {
      // Direct response
      res.json(response);
    }
  } catch (error) {
    console.error(
      '[ERROR] Failed to transform Lambda response:',
      error.message
    );
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to process Lambda response',
    });
  }
}

// Dynamic route handler for all services
Object.keys(SERVICE_MAP).forEach((path) => {
  const service = SERVICE_MAP[path];

  app.all(`${path}/*`, async (req, res) => {
    // All Rust services expect full path with /api prefix
    // Only AI service (Python) and legacy routes need path stripping
    const shouldStripPath = path.includes('/ai') || !path.startsWith('/api');
    const forwardPath = shouldStripPath ? req.path.replace(path, '') : req.path;

    console.log(
      `[PROXY] ${req.method} ${req.path} -> localhost:${service.port} (${service.name}) [forwarded: ${forwardPath}]`
    );

    // Create Lambda event with appropriate path
    const lambdaEvent = {
      ...transformToLambdaEvent(req),
      path: forwardPath,
      rawPath: forwardPath,
      requestContext: {
        ...transformToLambdaEvent(req).requestContext,
        http: {
          method: req.method,
          path: forwardPath,
        },
      },
    };

    // Debug: Log lambda event for workout service
    if (service.name === 'workout-service') {
      console.log(
        '[DEBUG] Lambda event:',
        JSON.stringify(lambdaEvent, null, 2)
      );
    }

    try {
      // Add timeout for fetch request (30 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // Use service name in the invocation URL for Rust services
      const invocationPath = service.name.includes('python')
        ? '/2015-03-31/functions/function/invocations'
        : `/2015-03-31/functions/${service.name}/invocations`;

      const response = await fetch(
        `http://localhost:${service.port}${invocationPath}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(lambdaEvent),
          signal: controller.signal,
        }
      );

      clearTimeout(timeoutId);

      if (!response.ok) {
        console.error(`[ERROR] ${service.name} returned ${response.status}`);
      }

      const text = await response.text();
      transformFromLambdaResponse(text, res);
    } catch (error) {
      if (error.name === 'AbortError') {
        console.error(`[TIMEOUT] ${service.name} request timed out`);
        res.status(504).json({
          error: 'Gateway Timeout',
          message: `${service.name} request timed out`,
        });
      } else {
        console.error(`[ERROR] ${service.name}:`, error.message);
        res.status(503).json({
          error: 'Service Unavailable',
          message: `${service.name} is not running on port ${service.port}`,
          hint: 'Make sure all services are started with ./scripts/dev-local.sh',
        });
      }
    }
  });
});

// Fallback for CloudFront (production) proxying
const cloudFrontProxy = createProxyMiddleware({
  target: 'https://d202qmtk8kkxra.cloudfront.net',
  changeOrigin: true,
  secure: true,
  logLevel: 'warn',
});

app.use('/', cloudFrontProxy);

// Global error handler
app.use((err, req, res, next) => {
  console.error('[ERROR] Unhandled error:', err.message);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('[UNCAUGHT EXCEPTION]', err);
  // Don't exit in development - just log it
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('[UNHANDLED REJECTION]', reason);
  // Don't exit in development - just log it
});

app.listen(PORT, () => {
  console.log('');
  console.log('🚀 GymCoach AI Local Development Proxy');
  console.log('='.repeat(50));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('');
  console.log('Local Lambda Services:');
  Object.keys(SERVICE_MAP).forEach((path) => {
    const service = SERVICE_MAP[path];
    console.log(
      `  ${path.padEnd(20)} -> localhost:${service.port} (${service.name})`
    );
  });
  console.log('');
  console.log('Other requests proxied to CloudFront');
  console.log('='.repeat(50));
});
