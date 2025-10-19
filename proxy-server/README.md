# GymCoach AI Proxy Server

A simple Express.js proxy server to handle CORS issues when calling the GymCoach AI CloudFront API from localhost during development.

## Features

- ✅ CORS handling for localhost development
- ✅ Request/response logging
- ✅ Error handling
- ✅ Health check endpoint
- ✅ Automatic header forwarding
- ✅ Support for all HTTP methods (GET, POST, PUT, DELETE, PATCH, OPTIONS)

## Quick Start

1. **Install dependencies:**

   ```bash
   cd proxy-server
   npm install
   ```

2. **Start the server:**

   ```bash
   npm start
   # or for development with auto-restart:
   npm run dev
   ```

3. **Update your frontend API calls:**

   ```javascript
   // Instead of calling CloudFront directly:
   // const response = await fetch('https://d12pveuxxq3vvn.cloudfront.net/api/users');

   // Call the proxy server:
   const response = await fetch('http://localhost:3001/api/users');
   ```

## API Endpoints

### Health Check

- **GET** `/health` - Server health status

### Proxy Routes

- **ALL** `/api/*` - Proxies to `https://d12pveuxxq3vvn.cloudfront.net/api/*`

## Configuration

The server runs on port 3001 by default. You can change this by setting the `PORT` environment variable:

```bash
PORT=3002 npm start
```

## CORS Configuration

The server is configured to allow requests from:

- `http://localhost:3000`
- `http://127.0.0.1:3000`
- `http://localhost:3001`
- `http://127.0.0.1:3001`

## Usage Examples

### Frontend API Client Update

Update your API client to use the proxy server:

```javascript
// In your frontend code (e.g., apps/web/src/lib/api-client.ts)
const API_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:3001/api' // Use proxy in development
    : 'https://d12pveuxxq3vvn.cloudfront.net/api'; // Use CloudFront in production

export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  // ... rest of your API client code
};
```

### Testing the Proxy

```bash
# Health check
curl http://localhost:3001/health

# Test API call through proxy
curl http://localhost:3001/api/user-profiles/health
```

## Troubleshooting

### Common Issues

1. **Port already in use:**

   ```bash
   # Kill process using port 3001
   lsof -ti:3001 | xargs kill -9
   ```

2. **CORS still not working:**
   - Check that your frontend is running on one of the allowed origins
   - Verify the proxy server is running
   - Check browser console for specific CORS errors

3. **API calls failing:**
   - Check proxy server logs for error details
   - Verify the target CloudFront URL is accessible
   - Check network tab in browser dev tools

### Logs

The server provides detailed logging:

- Request/response information
- CORS handling
- Error details
- Proxy status

## Development

For development with auto-restart:

```bash
npm run dev
```

This uses `nodemon` to automatically restart the server when files change.

## Production

For production deployment, consider:

1. **Environment variables:**

   ```bash
   PORT=3001
   TARGET_URL=https://d12pveuxxq3vvn.cloudfront.net
   ```

2. **Process management:**

   ```bash
   # Using PM2
   pm2 start server.js --name gymcoach-proxy
   ```

3. **Reverse proxy:**
   - Use nginx or similar to handle SSL termination
   - Configure proper CORS origins for production domains

