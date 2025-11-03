const express = require('express');
const cors = require('cors');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();
const PORT = process.env.PORT || 3001;

// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);

    const allowedOrigins = [
      'http://localhost:3000',
      'http://127.0.0.1:3000',
      'http://localhost:3001',
      'http://127.0.0.1:3001',
    ];

    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log(`[CORS] Blocked origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers',
    'Accept-Language',
    'Connection',
    'Referer',
    'Sec-Fetch-Dest',
    'Sec-Fetch-Mode',
    'Sec-Fetch-Site',
    'User-Agent',
    'sec-ch-ua',
    'sec-ch-ua-mobile',
    'sec-ch-ua-platform',
  ],
  exposedHeaders: [
    'Access-Control-Allow-Origin',
    'Access-Control-Allow-Credentials',
    'Access-Control-Allow-Methods',
    'Access-Control-Allow-Headers',
  ],
  optionsSuccessStatus: 200, // Some legacy browsers choke on 204
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    message: 'GymCoach AI Proxy Server is running',
    timestamp: new Date().toISOString(),
  });
});

// Proxy configuration for CloudFront API
const proxyOptions = {
  target: 'https://d202qmtk8kkxra.cloudfront.net',
  changeOrigin: true,
  secure: true,
  logLevel: 'debug',
  onProxyReq: (proxyReq, req, res) => {
    console.log(
      `[PROXY] ${req.method} ${req.url} -> ${proxyOptions.target}${req.url}`
    );

    // Forward all headers from the original request
    Object.keys(req.headers).forEach((key) => {
      if (key !== 'host') {
        proxyReq.setHeader(key, req.headers[key]);
      }
    });
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(
      `[PROXY] Response: ${proxyRes.statusCode} for ${req.method} ${req.url}`
    );

    // Remove any existing CORS headers from the proxied response
    delete proxyRes.headers['access-control-allow-origin'];
    delete proxyRes.headers['access-control-allow-credentials'];
    delete proxyRes.headers['access-control-allow-methods'];
    delete proxyRes.headers['access-control-allow-headers'];
    delete proxyRes.headers['access-control-expose-headers'];

    // Add our own CORS headers
    const origin = req.headers.origin;
    if (origin) {
      res.setHeader('Access-Control-Allow-Origin', origin);
    }
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, DELETE, PATCH, OPTIONS'
    );
    res.setHeader(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-Requested-With, Accept, Origin, Accept-Language, Connection, Referer, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site, User-Agent, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform'
    );
    res.setHeader(
      'Access-Control-Expose-Headers',
      'Access-Control-Allow-Origin, Access-Control-Allow-Credentials, Access-Control-Allow-Methods, Access-Control-Allow-Headers'
    );
  },
  onError: (err, req, res) => {
    console.error(`[PROXY ERROR] ${err.message} for ${req.method} ${req.url}`);
    res.status(500).json({
      error: 'Proxy Error',
      message: err.message,
      timestamp: new Date().toISOString(),
    });
  },
};

// Create proxy middleware
const apiProxy = createProxyMiddleware(proxyOptions);

// Apply proxy to all API routes
app.use('/api', apiProxy);

// Handle preflight requests
app.options('*', (req, res) => {
  console.log(
    `[CORS] Preflight request for ${req.method} ${req.url} from origin: ${req.headers.origin}`
  );

  const origin = req.headers.origin;
  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
  }
  res.header('Access-Control-Allow-Credentials', 'true');
  res.header(
    'Access-Control-Allow-Methods',
    'GET, POST, PUT, DELETE, PATCH, OPTIONS'
  );
  res.header(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, X-Requested-With, Accept, Origin, Accept-Language, Connection, Referer, Sec-Fetch-Dest, Sec-Fetch-Mode, Sec-Fetch-Site, User-Agent, sec-ch-ua, sec-ch-ua-mobile, sec-ch-ua-platform'
  );
  res.header(
    'Access-Control-Expose-Headers',
    'Access-Control-Allow-Origin, Access-Control-Allow-Credentials, Access-Control-Allow-Methods, Access-Control-Allow-Headers'
  );
  res.header('Access-Control-Max-Age', '86400'); // 24 hours
  res.sendStatus(200);
});

// Catch-all handler for unmatched routes
app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.originalUrl} not found`,
    availableRoutes: [
      'GET /health - Health check',
      'ALL /api/* - Proxy to CloudFront API',
    ],
    timestamp: new Date().toISOString(),
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[SERVER ERROR]', err);
  res.status(500).json({
    error: 'Internal Server Error',
    message: err.message,
    timestamp: new Date().toISOString(),
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 GymCoach AI Proxy Server running on port ${PORT}`);
  console.log(
    `📡 Proxying API requests to: https://d202qmtk8kkxra.cloudfront.net`
  );
  console.log(`🌐 CORS enabled for: http://localhost:3000`);
  console.log(`💚 Health check: http://localhost:${PORT}/health`);
  console.log(`🔗 API proxy: http://localhost:${PORT}/api/*`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  process.exit(0);
});
