# Bedrock Model ID and IAM Permission Fix

## Issue
Lambda function was failing with three progressive errors:
1. ❌ `ValidationException: The provided model identifier is invalid`
2. ❌ `AccessDeniedException: User is not authorized to perform: bedrock:InvokeModel`
3. ❌ `ValidationException: Invocation of model ID amazon.nova-micro-v1:0 with on-demand throughput isn't supported`

## Root Causes

### 1. Invalid Model ID
The model IDs used were invalid or incorrectly formatted.

### 2. Missing IAM Permissions
The Lambda IAM role only had permission for `deepseek.v3-v1:0`.

### 3. Nova Models Require Inference Profiles
Amazon Nova models don't support direct invocation with on-demand throughput. They require:
- Application inference profiles (ARN-based)
- Or provisioned throughput (expensive)

## Solution: Use Claude 3 Haiku

We've switched to **Claude 3 Haiku** because:
- ✅ Natively supported in eu-west-1
- ✅ Works with on-demand throughput (no inference profile needed)
- ✅ Reliable and well-documented
- ✅ Good balance of cost and performance
- ✅ Supports streaming responses

### Model Details

**Claude 3 Haiku** (`anthropic.claude-3-haiku-20240307-v1:0`):
- Input: $0.25 per 1M tokens ($0.00025 per 1K)
- Output: $1.25 per 1M tokens ($0.00125 per 1K)
- Context: 200K tokens
- Speed: Fast responses
- Status: ACTIVE in eu-west-1

### Why Not Nova?

Amazon Nova models (Micro, Lite, Pro) are cheaper but:
- ❌ Require inference profile ARNs (not simple model IDs)
- ❌ More complex setup and configuration
- ❌ Less documentation and examples
- ⚠️ Newer, less battle-tested

**We can switch to Nova later** once we set up inference profiles, but Claude 3 Haiku is the safer choice for now.

## Files Updated

1. **bedrock_service.py** - Default model: `anthropic.claude-3-haiku-20240307-v1:0`
2. **gymcoach-ai-stack.ts** - Updated:
   - Environment variable `BEDROCK_MODEL_ID` 
   - IAM policy includes Claude and Nova models
3. **Documentation files** - Updated references

## IAM Policy (Already Configured)

```typescript
resources: [
  'arn:aws:bedrock:*::foundation-model/amazon.nova-micro-v1:0',
  'arn:aws:bedrock:*::foundation-model/amazon.nova-lite-v1:0',
  'arn:aws:bedrock:*::foundation-model/amazon.nova-pro-v1:0',
  'arn:aws:bedrock:*::foundation-model/anthropic.claude-3-haiku-20240307-v1:0',
  'arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v1',
  'arn:aws:bedrock:*::foundation-model/amazon.titan-embed-text-v2:0',
]
```

## Deployment Required

```bash
cd infrastructure
npm run build
cdk deploy GymCoachAIStack-dev --profile shehzadi
```

## Cost Comparison

### Example: 1000 requests, 500 input + 500 output tokens each

| Model | Input Cost | Output Cost | Total | Savings |
|-------|-----------|-------------|-------|---------|
| **Claude 3 Haiku** | $0.125 | $0.625 | **$0.75** | Baseline |
| Claude 3 Sonnet | $3.00 | $15.00 | $18.00 | -2,300% |
| Nova Micro* | $0.0375 | $0.15 | $0.1875 | +75% |

*Nova Micro is cheaper but requires inference profile setup

## Testing

After deployment:

```bash
# Check Lambda environment
aws lambda get-function-configuration \
  --function-name GymCoachAIStack-dev-AIServiceLambda \
  --query 'Environment.Variables.BEDROCK_MODEL_ID' \
  --profile shehzadi

# Should output: "anthropic.claude-3-haiku-20240307-v1:0"
```

## Future Optimization: Switch to Nova

To use the cheaper Nova models later:

1. Create application inference profile in Bedrock console
2. Get the profile ARN
3. Update model_id to use the ARN instead of model ID
4. Redeploy

## Verification Steps

1. ✅ Verified models available in eu-west-1
2. ✅ Identified Nova requires inference profiles
3. ✅ Switched to Claude 3 Haiku (proven, reliable)
4. ✅ Updated IAM permissions
5. ⏳ Deploy and test

## References

- [AWS Bedrock Model IDs](https://docs.aws.amazon.com/bedrock/latest/userguide/model-ids.html)
- [Claude 3 Models](https://docs.anthropic.com/claude/docs/models-overview)
- [Bedrock Inference Profiles](https://docs.aws.amazon.com/bedrock/latest/userguide/inference-profiles.html)
- [Amazon Nova Inference](https://docs.aws.amazon.com/bedrock/latest/userguide/nova-models.html)
