# Build Configuration Guide ✅ RESOLVED

This document explains the different build modes available for the GymCoach AI web application and how the static export vs API routes conflict was resolved.

## ✅ SOLUTION SUMMARY

**Problem**: `export const dynamic = "force-dynamic" cannot be used with "output: export"`

**Root Cause**: API routes with dynamic configuration are incompatible with Next.js static export mode.

**Solution**: Implemented intelligent build system that temporarily removes API routes during static export builds while preserving them for development and server deployments.

## Build Modes (All Working ✅)

### 1. Development Build

```bash
npm run dev
```

- ✅ Uses `NODE_ENV=development`
- ✅ Enables API proxy routes for CORS handling
- ✅ Uses `dynamic = 'force-dynamic'` for API routes
- ✅ **Does NOT use static export**

### 2. Production Build (Server-Side)

```bash
npm run build
```

- ✅ Standard Next.js build for server deployment
- ✅ Includes API routes functionality (`ƒ Dynamic` routes)
- ✅ **Does NOT use static export**
- ✅ Can be deployed to Vercel, AWS Lambda, etc.

### 3. Static Export Build (Static Files)

```bash
npm run build:static
```

- ✅ Temporarily moves `/api` directory during build
- ✅ Sets `NEXT_EXPORT=true` to enable static export
- ✅ Generates static HTML/CSS/JS files only (`○ Static` routes)
- ✅ **Removes all API routes** during build (automatically restored after)
- ✅ Perfect for deployment to S3, CloudFront, GitHub Pages, etc.

## Environment Configuration

### .env.local (Development)

```bash
NODE_ENV=development          # ✅ Enable API routes and proxy
# NEXT_EXPORT=true           # ✅ Commented out for development
```

### .env.production (Server Build)

```bash
# NEXT_EXPORT=true           # ✅ Disabled for server deployment with API routes
NODE_ENV=production          # ✅ Production optimizations
```

### .env.static (Static Export Template)

```bash
NEXT_EXPORT=true             # ✅ Enable static export mode
NODE_ENV=production          # ✅ Production optimizations
```

## Technical Implementation

### API Route Smart Configuration

**Proxy Route** (`/api/proxy/[...path]/route.ts`):

- ✅ `dynamic = 'force-dynamic'` for CORS proxy functionality
- ✅ Conditional handlers return 404 when `NEXT_EXPORT=true`
- ✅ Full HTTP methods support (GET, POST, PUT, DELETE, PATCH, OPTIONS)

**Health Route** (`/api/proxy/health/route.ts`):

- ✅ `dynamic = 'force-static'` for static export compatibility
- ✅ Conditional response based on export mode

### Build Script Intelligence

The `npm run build:static` script:

1. ✅ Copies `.env.static` to `.env.production.local`
2. ✅ Temporarily moves `src/app/api` to `../api.bak`
3. ✅ Runs static export build without API routes
4. ✅ Restores `api.bak` back to `src/app/api`
5. ✅ Handles errors gracefully and always restores API directory

## Build Results ✅

### Standard Build Output:

```
├ ƒ /api/proxy/[...path]     0 B    0 B     # ✅ Dynamic API route
├ ○ /api/proxy/health        0 B    0 B     # ✅ Static health check
└ ○ /dashboard              16.5 kB 177 kB  # ✅ Static page

ƒ (Dynamic)  server-rendered on demand       # ✅ API routes working
○ (Static)   prerendered as static content   # ✅ Pages optimized
```

### Static Export Output:

```
├ ○ /dashboard              16.5 kB 177 kB  # ✅ Static page
└ ○ /nutrition              12.6 kB 173 kB  # ✅ Static page

○ (Static)  prerendered as static content    # ✅ All routes static
# ✅ No API routes (temporarily removed)
```

## Troubleshooting Guide

### ✅ RESOLVED: "export const dynamic = 'force-dynamic' cannot be used with output: export"

**Previous Issue**: API routes prevented static export builds

**Solution Applied**:

- Smart build system that excludes API routes during static export
- Conditional API route handlers for graceful degradation
- Separate environment configurations for different deployment targets

### When to Use Each Mode ✅

- **Development** (`npm run dev`): ✅ Full API proxy for CORS handling
- **Server Deployment** (`npm run build`): ✅ Complete app with API routes
- **Static Deployment** (`npm run build:static`): ✅ Static files only for CDN

## Deployment Examples ✅

### Static Deployment to S3/CloudFront

```bash
npm run build:static    # ✅ Creates /out folder with static files
# Deploy the 'out' folder to S3
```

### Server Deployment to Vercel/Lambda

```bash
npm run build          # ✅ Creates .next folder with API routes
# Deploy the '.next' folder
```

## Current Status: FULLY WORKING ✅

- ✅ **Development**: API proxy enabled, CORS issues resolved
- ✅ **Production Build**: Standard Next.js build with functional API routes
- ✅ **Static Build**: Clean static export without API route conflicts
- ✅ **Environment Management**: Proper separation of dev/prod/static configs
- ✅ **Error Resolution**: Original build error completely resolved

**Next Steps**: Choose the appropriate build command based on your deployment target!
