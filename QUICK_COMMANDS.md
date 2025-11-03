# 🚀 GymCoach AI - Quick Deploy Commands

All commands now use the `shehzadi` AWS profile and `eu-north-1` region automatically!

## 📦 Most Common Commands

```bash
# Deploy everything to dev
npm run deploy:dev

# Deploy everything to prod
npm run deploy:prod

# Deploy frontend to dev
npm run deploy:frontend:dev

# Deploy frontend to prod
npm run deploy:frontend:prod
```

## 🔧 Single Service Deploy (Faster!)

### Development

```bash
npm run deploy:dev:analytics     # Analytics Service
npm run deploy:dev:workout       # Workout Service
npm run deploy:dev:nutrition     # Nutrition Service
npm run deploy:dev:ai            # AI Service
npm run deploy:dev:coaching      # Coaching Service
npm run deploy:dev:profile       # User Profile Service
npm run deploy:dev:notification  # Notification Service
```

### Production

```bash
npm run deploy:prod:analytics     # Analytics Service
npm run deploy:prod:workout       # Workout Service
npm run deploy:prod:nutrition     # Nutrition Service
npm run deploy:prod:ai            # AI Service
npm run deploy:prod:coaching      # Coaching Service
npm run deploy:prod:profile       # User Profile Service
npm run deploy:prod:notification  # Notification Service
```

## 👀 Preview Changes First

```bash
# See what will change before deploying
npm run cdk:diff:dev
npm run cdk:diff:prod

# List all stacks
npm run cdk:list
```

## 💾 Data Population

```bash
# Populate exercises database
npm run populate:exercises

# Populate nutrition/food database
npm run populate:foods

# Populate workout templates
npm run populate:workouts

# Populate AI knowledge base (S3 Vectors)
npm run populate:knowledge
```

## 🔄 Post-Deployment Updates

```bash
# Update CloudFront domain in Analytics Lambda
npm run update:cloudfront:dev
npm run update:cloudfront:prod
```

## 🛠️ Build Commands

```bash
# Build all Lambda functions
npm run build:lambdas

# Or use the shorter alias
npm run build:lambda
```

## 📊 Monitoring

```bash
# Monitor AWS costs
npm run monitor:costs

# Optimize performance
npm run optimize:performance

# Setup monitoring dashboards
npm run setup:monitoring
```

## 🗑️ Cleanup

```bash
# ⚠️ Destroy dev stack (careful!)
npm run cdk:destroy:dev

# ⚠️ Destroy prod stack (careful!)
npm run cdk:destroy:prod
```

## 📋 Complete Deployment Workflow

```bash
# 1. Preview changes
npm run cdk:diff:dev

# 2. Deploy infrastructure
npm run deploy:dev

# 3. Deploy frontend
npm run deploy:frontend:dev

# 4. Update CloudFront domain
npm run update:cloudfront:dev

# 5. Populate data (first time only)
npm run populate:exercises
npm run populate:foods
npm run populate:workouts
```

## 🎯 Your Original Commands (Now Simplified!)

### Before (Your old way):

```bash
./scripts/build-lambdas.sh && cd infrastructure && npx cdk deploy --region eu-north-1 && cd ../
```

### After (New way):

```bash
npm run deploy:dev
```

---

### Before (Single service):

```bash
./scripts/build-lambdas.sh analytics-service && cd infrastructure && npx cdk deploy --region eu-north-1 && cd ../
```

### After (New way):

```bash
npm run deploy:dev:analytics
```

## 📚 More Info

- Full documentation: [NPM_SCRIPTS_GUIDE.md](./NPM_SCRIPTS_GUIDE.md)
- Update summary: [SCRIPTS_UPDATE_SUMMARY.md](./SCRIPTS_UPDATE_SUMMARY.md)
- Infrastructure guide: [infrastructure/DEPLOYMENT_GUIDE.md](./infrastructure/DEPLOYMENT_GUIDE.md)

## 🔐 AWS Profile

All commands use the `shehzadi` AWS profile automatically. If you need to configure it:

```bash
aws configure --profile shehzadi
```

**Profile details:**

- AWS Access Key ID: `your-key`
- AWS Secret Access Key: `your-secret`
- Default region: `eu-north-1`
- Default output format: `json`

---

**Everything is ready! Just run the commands from your project root! 🎉**
