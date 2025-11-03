# AI Service Optimization Plan: Intelligent Response Caching

## Executive Summary

Current issue: Every page refresh triggers a new Bedrock API call, resulting in unnecessary costs and latency. This plan implements an intelligent caching layer using DynamoDB to cache AI responses while maintaining personalization and freshness.

## Current Architecture Analysis

### Identified Issues

1. **No Response Caching**: Each request, even identical ones, hits Bedrock
2. **High Cost**: DeepSeek v3 costs $0.27 per 1M input tokens + $1.10 per 1M output tokens
3. **Increased Latency**: Every request requires Bedrock invocation (500ms-2s)
4. **Redundant Calls**: Same context + prompt combinations called multiple times
5. **Page Refresh Problem**: User profile/dashboard loads trigger same queries repeatedly

### Current Data Flow

```
User Request → Lambda → Auth → User Context Builder → Bedrock API → Response → DynamoDB (conversation only)
```

### Cost Impact Analysis

- Average chat request: ~800 input tokens + 300 output tokens
- Cost per request: ~$0.00053
- With 1000 requests/day: ~$0.53/day = $16/month
- **With 50% cache hit rate: Save $8/month per 1000 requests**
- **With 80% cache hit rate: Save $12.8/month per 1000 requests**

## Proposed Solution: Multi-Layer Intelligent Caching

### 1. Cache Architecture

#### Cache Key Strategy

```python
cache_key = hash(
    user_id +
    prompt_normalized +
    context_hash +
    model_version +
    endpoint_type
)
```

#### Cache Layers

1. **Hot Cache (In-Memory)**: Most recent 100 responses per Lambda instance
2. **Warm Cache (DynamoDB)**: Recent responses with smart TTL
3. **Cold Cache (DynamoDB)**: Historical responses for analytics

#### TTL Strategy by Endpoint Type

```javascript
{
  "chat": 3600,              // 1 hour - conversations change frequently
  "workout-plan": 86400,     // 24 hours - plans are more stable
  "meal-plan": 86400,        // 24 hours - meal plans are stable
  "progress-analysis": 1800, // 30 min - progress changes often
  "form-check": 7200,        // 2 hours - form check results stable
  "motivation": 3600,        // 1 hour - motivational messages can repeat
  "nutrition-analysis": 3600,// 1 hour - nutrition analysis stable
  "macro-calculation": 86400 // 24 hours - macros rarely change
}
```

### 2. Cache Invalidation Strategy

#### Automatic Invalidation Triggers

- User profile update
- New workout logged
- Weight/measurement change
- Goal modification
- AI preferences change
- Equipment availability change

#### Manual Invalidation

- User-triggered refresh
- Admin cache clear
- API endpoint for selective invalidation

### 3. Context-Aware Caching

#### What to Cache

✅ Static responses (workout plans, meal plans)
✅ Frequently asked questions
✅ Form check responses (same exercise)
✅ Macro calculations (same parameters)
✅ Motivation messages (context-independent)
✅ General fitness advice

#### What NOT to Cache

❌ Real-time progress analysis
❌ Responses with current date/time references
❌ Personalized insights based on today's data
❌ Conversational context with recent history
❌ Proactive coaching insights

### 4. Implementation Plan

#### Phase 1: Core Cache Service (High Priority)

- Create `cache_service.py` with DynamoDB integration
- Implement cache key generation
- Add cache hit/miss tracking
- Basic TTL management

#### Phase 2: Bedrock Integration (High Priority)

- Modify `bedrock_service.py` to check cache first
- Implement cache write-through strategy
- Add cache bypass for specific scenarios
- Handle cache failures gracefully

#### Phase 3: Smart Invalidation (Medium Priority)

- Hook into user profile updates
- Monitor workout/nutrition data changes
- Implement selective cache clearing
- Add cache warming for common queries

#### Phase 4: Monitoring & Optimization (Medium Priority)

- CloudWatch metrics for cache performance
- Cost tracking and savings reports
- Cache efficiency analytics
- A/B testing for TTL optimization

#### Phase 5: Advanced Features (Low Priority)

- Predictive cache warming
- User-specific cache tuning
- Response quality scoring
- Automated cache cleanup

### 5. DynamoDB Schema for Cache

```javascript
{
  PK: "CACHE#{cache_key}",
  SK: "RESPONSE#{timestamp}",
  userId: "user123",
  endpoint: "chat",
  prompt: "hashed_prompt",
  context: "hashed_context",
  response: "AI response text",
  tokens: {
    input: 800,
    output: 300,
    total: 1100
  },
  model: "deepseek-v3",
  createdAt: "2025-11-02T10:00:00Z",
  expiresAt: "2025-11-02T11:00:00Z",
  ttl: 1730545200,
  hits: 5,
  lastAccessedAt: "2025-11-02T10:30:00Z",
  metadata: {
    userTier: "premium",
    cacheable: true,
    version: 1
  }
}
```

### 6. Cache Configuration

```python
CACHE_CONFIG = {
    "enabled": True,
    "default_ttl": 3600,  # 1 hour
    "max_cache_size_mb": 100,
    "compression_enabled": True,
    "cache_negative_responses": False,
    "min_prompt_length": 10,
    "max_prompt_length": 2000,
    "similarity_threshold": 0.95,  # For fuzzy matching
    "warm_cache_on_startup": True,
    "cache_analytics_enabled": True
}
```

### 7. Expected Performance Improvements

#### Metrics

- **Latency Reduction**: 80-95% for cached responses
- **Cost Reduction**: 50-80% depending on usage patterns
- **Cache Hit Rate Target**: 60-70% within 2 weeks
- **Response Time**: <100ms for cache hits vs 1-2s for Bedrock

#### Business Impact

- Better user experience (faster responses)
- Reduced AWS costs (less Bedrock invocations)
- Improved scalability (less API throttling)
- Better resource utilization

### 8. Risk Mitigation

#### Risks

1. **Stale Data**: Cached responses may be outdated
   - **Mitigation**: Smart TTL + invalidation triggers

2. **Cache Misses**: Cold start or rare queries
   - **Mitigation**: Cache warming + graceful fallback

3. **Storage Costs**: DynamoDB storage increase
   - **Mitigation**: TTL-based cleanup + compression

4. **Complexity**: Added code complexity
   - **Mitigation**: Comprehensive testing + monitoring

5. **Personalization Loss**: Generic cached responses
   - **Mitigation**: Context-aware cache keys + user-specific caching

### 9. Testing Strategy

#### Unit Tests

- Cache key generation
- TTL calculation
- Cache hit/miss logic
- Invalidation triggers

#### Integration Tests

- End-to-end caching flow
- Cache invalidation scenarios
- Failure handling
- Performance benchmarks

#### A/B Testing

- Cache enabled vs disabled
- Different TTL strategies
- Cost/performance tradeoffs

### 10. Monitoring & Metrics

#### CloudWatch Metrics

- `CacheHitRate` (target: >60%)
- `CacheMissRate`
- `CacheSize` (MB)
- `CacheLatency` (ms)
- `BedrockCallsSaved` (count)
- `CostSavings` (USD)
- `InvalidationEvents` (count)

#### Dashboards

- Real-time cache performance
- Cost savings tracking
- User experience metrics
- Error rates and failures

## Implementation Timeline

### Week 1: Core Implementation

- Day 1-2: Cache service development
- Day 3-4: Bedrock integration
- Day 5: Testing and validation

### Week 2: Optimization & Monitoring

- Day 1-2: Invalidation logic
- Day 3-4: Monitoring setup
- Day 5: Performance tuning

### Week 3: Advanced Features

- Day 1-3: Cache warming strategies
- Day 4-5: Analytics and reporting

## Success Criteria

✅ Cache hit rate >60% within 2 weeks
✅ Average response time <200ms for cached responses
✅ Cost reduction >50% for AI service
✅ No degradation in response quality
✅ Zero cache-related bugs in production
✅ Comprehensive monitoring dashboard

## Rollout Strategy

### Phase 1: Canary Deployment (10% traffic)

- Monitor for issues
- Validate cache correctness
- Measure performance impact

### Phase 2: Gradual Rollout (50% traffic)

- Expand monitoring
- Fine-tune TTL values
- Optimize cache keys

### Phase 3: Full Deployment (100% traffic)

- Enable all features
- Activate cache warming
- Continuous optimization

## Cost-Benefit Analysis

### Current Monthly Cost (1000 requests/day)

- Bedrock API: ~$16/month
- DynamoDB (conversations): ~$2/month
- **Total: ~$18/month**

### With Caching (60% hit rate)

- Bedrock API: ~$6.40/month (60% reduction)
- DynamoDB (cache + conversations): ~$4/month
- **Total: ~$10.40/month**
- **Savings: ~$7.60/month (42%)**

### With Caching (80% hit rate)

- Bedrock API: ~$3.20/month (80% reduction)
- DynamoDB (cache + conversations): ~$5/month
- **Total: ~$8.20/month**
- **Savings: ~$9.80/month (54%)**

### ROI

- Development time: ~3 days
- Expected savings: ~$90-120/year (at 1000 req/day)
- At 10,000 req/day: ~$900-1200/year savings
- **Break-even: Immediate (reduced costs + better UX)**

---

## Next Steps

1. Review and approve plan
2. Implement cache service
3. Deploy to staging
4. Monitor and optimize
5. Deploy to production
