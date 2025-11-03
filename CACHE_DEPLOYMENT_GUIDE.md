# AI Service Caching - Quick Deployment Guide

## 🚀 Quick Start

This guide helps you deploy the caching optimization to your AI service.

## Prerequisites

- AWS CLI configured
- Access to Lambda function
- DynamoDB table: `gymcoach-ai-main`
- Python 3.11 runtime

## Deployment Steps

### Step 1: Review Changes

Three files were modified/created:

1. **NEW**: `services/ai-service-python/cache_service.py` (550 lines)
2. **MODIFIED**: `services/ai-service-python/bedrock_service.py` (+50 lines)
3. **MODIFIED**: `services/ai-service-python/lambda_function.py` (+100 lines)

### Step 2: Test Locally (Optional)

```bash
cd services/ai-service-python

# Install dependencies (if not already installed)
pip install boto3 botocore

# Run basic syntax check
python3 -m py_compile cache_service.py
python3 -m py_compile bedrock_service.py
python3 -m py_compile lambda_function.py
```

### Step 3: Deploy to Lambda

#### Option A: AWS Console

1. Go to Lambda Console
2. Find your AI service Lambda function
3. Upload the modified files:
   - `cache_service.py` (new file)
   - `bedrock_service.py` (updated)
   - `lambda_function.py` (updated)
4. Click "Deploy"

#### Option B: AWS CLI

```bash
cd services/ai-service-python

# Create deployment package
zip -r deployment.zip *.py

# Update Lambda function
aws lambda update-function-code \
  --function-name gymcoach-ai-service \
  --zip-file fileb://deployment.zip \
  --region us-east-1

# Wait for update to complete
aws lambda wait function-updated \
  --function-name gymcoach-ai-service \
  --region us-east-1
```

#### Option C: Infrastructure as Code (CDK)

If using CDK, the infrastructure stack should already include the Lambda function. Just redeploy:

```bash
cd infrastructure
npm run build
cdk deploy GymCoachAIStack
```

### Step 4: Set Environment Variables

Ensure these environment variables are set in your Lambda function:

```bash
CACHE_ENABLED=true
DYNAMODB_TABLE=gymcoach-ai-main
AWS_REGION=us-east-1
```

**Via AWS Console:**

1. Lambda → Configuration → Environment variables
2. Add/update the above variables

**Via AWS CLI:**

```bash
aws lambda update-function-configuration \
  --function-name gymcoach-ai-service \
  --environment "Variables={CACHE_ENABLED=true,DYNAMODB_TABLE=gymcoach-ai-main,AWS_REGION=us-east-1}" \
  --region us-east-1
```

### Step 5: Verify DynamoDB Permissions

Ensure Lambda execution role has these permissions:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "dynamodb:GetItem",
        "dynamodb:PutItem",
        "dynamodb:UpdateItem",
        "dynamodb:DeleteItem",
        "dynamodb:Query"
      ],
      "Resource": ["arn:aws:dynamodb:us-east-1:*:table/gymcoach-ai-main"]
    }
  ]
}
```

### Step 6: Test the Deployment

#### Test 1: Basic Chat Request

```bash
curl -X POST https://your-api-gateway-url/api/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What should I eat before a workout?",
    "conversationId": "test-123"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "response": "...",
    ...
  },
  "cached": false,
  "cacheSource": "bedrock",
  "cacheAge": 0,
  ...
}
```

#### Test 2: Same Request Again (Should Hit Cache)

```bash
# Run the same request again
curl -X POST https://your-api-gateway-url/api/ai/chat \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What should I eat before a workout?",
    "conversationId": "test-123"
  }'
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "response": "...",
    ...
  },
  "cached": true,
  "cacheSource": "hot",
  "cacheAge": 5,
  ...
}
```

#### Test 3: Check Cache Stats

```bash
curl -X GET https://your-api-gateway-url/api/ai/cache/stats \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**

```json
{
  "success": true,
  "data": {
    "enabled": true,
    "hits": 1,
    "misses": 1,
    "hit_rate_percent": 50.0,
    "hot_cache_size": 1,
    ...
  }
}
```

#### Test 4: Invalidate Cache

```bash
curl -X POST https://your-api-gateway-url/api/ai/cache/invalidate \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "invalidateAll": true
  }'
```

### Step 7: Monitor in CloudWatch

1. Go to CloudWatch Console
2. Navigate to Metrics → Custom Namespaces → GymCoachAI/AI
3. Look for these metrics:
   - `CacheHits`
   - `CacheMisses`
   - `CacheHitRate`
   - `CostSaved`
   - `CacheInvalidations`

### Step 8: Create CloudWatch Dashboard

```bash
# Create dashboard JSON
cat > cache-dashboard.json << 'EOF'
{
  "widgets": [
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["GymCoachAI/AI", "CacheHits"],
          [".", "CacheMisses"]
        ],
        "period": 300,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Cache Performance"
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["GymCoachAI/AI", "CacheHitRate"]
        ],
        "period": 300,
        "stat": "Average",
        "region": "us-east-1",
        "title": "Cache Hit Rate %",
        "yAxis": {
          "left": {
            "min": 0,
            "max": 100
          }
        }
      }
    },
    {
      "type": "metric",
      "properties": {
        "metrics": [
          ["GymCoachAI/AI", "CostSaved"]
        ],
        "period": 3600,
        "stat": "Sum",
        "region": "us-east-1",
        "title": "Cost Savings ($)"
      }
    }
  ]
}
EOF

# Create dashboard
aws cloudwatch put-dashboard \
  --dashboard-name GymCoachAI-Cache-Performance \
  --dashboard-body file://cache-dashboard.json
```

## 🔧 Configuration Options

### Adjust Cache TTL

Edit `cache_service.py` line ~35:

```python
self.ttl_config = {
    'chat': 3600,              # Change to 7200 for 2 hours
    'workout-plan': 86400,     # Keep at 24 hours
    'meal-plan': 86400,        # Keep at 24 hours
    ...
}
```

### Disable Caching

Set environment variable:

```bash
CACHE_ENABLED=false
```

### Change Hot Cache Size

Edit `cache_service.py` line ~54:

```python
self.hot_cache_max_size = 50  # Change to 100 for more memory
```

## 📊 Monitoring Checklist

**First Hour:**

- [ ] No Lambda errors
- [ ] Cache hits > 0
- [ ] Cache stats endpoint working
- [ ] Response times improved

**First Day:**

- [ ] Cache hit rate >30%
- [ ] No stale response complaints
- [ ] DynamoDB not throttling
- [ ] Costs trending down

**First Week:**

- [ ] Cache hit rate >60%
- [ ] Cost reduction >40%
- [ ] User experience maintained
- [ ] Cache size stable

## ⚠️ Troubleshooting

### Issue: Cache not working

**Symptoms:** cached=false in all responses

**Solution:**

1. Check `CACHE_ENABLED=true` in Lambda env vars
2. Check Lambda logs for cache errors
3. Verify DynamoDB permissions

### Issue: High cache miss rate

**Symptoms:** Hit rate <20% after 24 hours

**Solution:**

1. Check cache key generation (logs)
2. Verify context normalization
3. Increase TTL values
4. Check for frequent invalidations

### Issue: Stale responses

**Symptoms:** Users report outdated information

**Solution:**

1. Reduce TTL for affected endpoints
2. Implement auto-invalidation triggers
3. Add bypass_cache parameter for sensitive queries

### Issue: DynamoDB throttling

**Symptoms:** ProvisionedThroughputExceededException

**Solution:**

1. Switch to PAY_PER_REQUEST billing (already set)
2. Check cache size growth
3. Implement cache cleanup
4. Add compression threshold

## 🔄 Rollback Plan

If issues occur, rollback is simple:

### Option 1: Disable via Environment Variable

```bash
aws lambda update-function-configuration \
  --function-name gymcoach-ai-service \
  --environment "Variables={CACHE_ENABLED=false}" \
  --region us-east-1
```

### Option 2: Redeploy Previous Version

```bash
# List versions
aws lambda list-versions-by-function \
  --function-name gymcoach-ai-service

# Rollback to previous version
aws lambda update-function-configuration \
  --function-name gymcoach-ai-service \
  --revision-id <previous-revision-id>
```

## 📈 Success Metrics

Track these metrics to measure success:

| Metric                 | Target     | Timeline  |
| ---------------------- | ---------- | --------- |
| Cache Hit Rate         | >60%       | 1 week    |
| Cost Reduction         | >50%       | 1 month   |
| Response Time (cached) | <200ms     | Immediate |
| Error Rate             | <0.1%      | Ongoing   |
| User Satisfaction      | Maintained | Ongoing   |

## 🎉 Post-Deployment

After successful deployment:

1. **Update frontend** to use cache metadata:

   ```typescript
   // Show cache indicator in UI
   if (response.cached) {
     console.log(`Fast response from cache (${response.cacheAge}s old)`);
   }
   ```

2. **Implement invalidation hooks** in user profile updates:

   ```typescript
   // After profile update
   await invalidateCache({ invalidateAll: true });
   ```

3. **Set up alerts** for cache performance:
   - Hit rate <40% for 6 hours
   - Error rate >1%
   - Cost trending up

4. **Schedule weekly reviews** of:
   - Cache metrics
   - Cost savings
   - User feedback
   - Optimization opportunities

## 📞 Support

If you encounter issues:

1. Check CloudWatch Logs for errors
2. Review cache stats via `/cache/stats` endpoint
3. Test with `CACHE_ENABLED=false` to isolate issues
4. Check DynamoDB for cache items

---

**Deployment Date:** **********\_**********
**Deployed By:** **********\_**********
**Status:** [ ] Success [ ] Issues [ ] Rollback

**Notes:**

---

---
