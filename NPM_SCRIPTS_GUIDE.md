# GymCoach AI - NPM Scripts Guide

Complete reference for all available npm scripts in the root `package.json`.

## 🚀 Quick Start

All commands use the `shehzadi` AWS profile and `eu-west-1` region by default.

### Most Common Commands

```bash
# Build and deploy full stack to dev
npm run deploy:dev

# Build and deploy full stack to production
npm run deploy:prod

# Deploy single service to dev (example: analytics)
npm run deploy:dev:analytics

# Deploy frontend to dev
npm run deploy:frontend:dev
```

## 📦 Build Commands

### Lambda Functions

```bash
# Build all Lambda functions
npm run build:lambdas

# Or use the shorter alias
npm run build:lambda
```

This builds all Rust Lambda services:

- auth-layer
- user-profile-service
- workout-service
- coaching-service
- analytics-service
- nutrition-service
- notification-service
- notification-scheduler

## 🚀 Full Stack Deployment

### Deploy Everything (Lambdas + Infrastructure)

```bash
# Development environment
npm run deploy:dev

# Production environment
npm run deploy:prod
```

**What it does:**

1. Builds all Lambda functions
2. Deploys infrastructure with CDK
3. Updates all AWS resources

**Equivalent to:**

```bash
AWS_PROFILE=shehzadi ./scripts/build-lambdas.sh && \
cd infrastructure && \
AWS_PROFILE=shehzadi npx cdk deploy --context environment=dev --region eu-west-1 && \
cd ../
```

## 🔧 Single Service Deployment

Deploy individual services faster (only builds one Lambda):

### Development Environment

```bash
npm run deploy:dev:analytics     # Analytics Service
npm run deploy:dev:workout       # Workout Service
npm run deploy:dev:nutrition     # Nutrition Service
npm run deploy:dev:ai            # AI Service
npm run deploy:dev:coaching      # Coaching Service
npm run deploy:dev:profile       # User Profile Service
npm run deploy:dev:notification  # Notification Service
```

### Production Environment

```bash
npm run deploy:prod:analytics     # Analytics Service
npm run deploy:prod:workout       # Workout Service
npm run deploy:prod:nutrition     # Nutrition Service
npm run deploy:prod:ai            # AI Service
npm run deploy:prod:coaching      # Coaching Service
npm run deploy:prod:profile       # User Profile Service
npm run deploy:prod:notification  # Notification Service
```

**Example:**

```bash
# Only rebuild and deploy analytics service to dev
npm run deploy:dev:analytics
```

**Equivalent to:**

```bash
AWS_PROFILE=shehzadi ./scripts/build-lambdas.sh analytics-service && \
cd infrastructure && \
AWS_PROFILE=shehzadi npx cdk deploy --context environment=dev --region eu-west-1 && \
cd ../
```

## 🌐 Frontend Deployment

```bash
# Deploy frontend to dev
npm run deploy:frontend:dev

# Deploy frontend to prod
npm run deploy:frontend:prod
```

**What it does:**

1. Builds Next.js static export
2. Syncs to S3 bucket
3. Sets appropriate cache headers
4. Shows CloudFront URL

## 📊 CDK Commands

### Diff (Preview Changes)

```bash
# See what will change in dev
npm run cdk:diff:dev

# See what will change in prod
npm run cdk:diff:prod
```

### Synthesize (Generate CloudFormation)

```bash
# Generate CloudFormation template for dev
npm run cdk:synth:dev

# Generate CloudFormation template for prod
npm run cdk:synth:prod
```

### List Stacks

```bash
# List all available stacks
npm run cdk:list
```

### Destroy Stack

```bash
# ⚠️ Destroy dev stack
npm run cdk:destroy:dev

# ⚠️ Destroy prod stack
npm run cdk:destroy:prod
```

## 🔄 Update CloudFront Domain

Update the Analytics Lambda with CloudFront domain (needed after deployment):

```bash
# Update dev environment
npm run update:cloudfront:dev

# Update prod environment
npm run update:cloudfront:prod
```

## 💾 Data Population

### Populate DynamoDB

```bash
# Populate exercises
npm run populate:exercises

# Populate food database
npm run populate:foods

# Populate workout templates
npm run populate:workouts
```

### Populate Knowledge Base (S3 Vectors)

```bash
# Populate all knowledge (exercises, nutrition, research)
npm run populate:knowledge
```

This populates the AI knowledge base with:

- 5000+ exercises
- 10000+ nutrition items
- Research and methodology
- Injury prevention guides

## 📈 Monitoring & Optimization

```bash
# Monitor AWS costs
npm run monitor:costs

# Optimize performance
npm run optimize:performance

# Setup monitoring dashboards
npm run setup:monitoring
```

## 🔨 Development Commands

```bash
# Run all dev servers (turborepo)
npm run dev

# Build all packages
npm run build

# Run linting
npm run lint

# Type checking
npm run type-check

# Run tests
npm run test

# Clean build artifacts
npm run clean

# Format code
npm run format

# Check formatting
npm run format:check
```

## 📋 Common Workflows

### Initial Setup & First Deploy

```bash
# 1. Build everything
npm run build

# 2. Deploy to dev
npm run deploy:dev

# 3. Deploy frontend
npm run deploy:frontend:dev

# 4. Update CloudFront domain in Analytics
npm run update:cloudfront:dev

# 5. Populate data
npm run populate:exercises
npm run populate:foods
npm run populate:workouts
```

### Deploy Single Service Update

```bash
# Example: You updated analytics service code

# 1. Preview changes
npm run cdk:diff:dev

# 2. Build and deploy only analytics
npm run deploy:dev:analytics

# 3. Test the changes
```

### Deploy Frontend Updates

```bash
# 1. Build and deploy frontend
npm run deploy:frontend:dev

# 2. Test changes (CloudFront may take a few minutes to update)
```

### Production Deployment

```bash
# 1. Test everything in dev first
npm run deploy:dev
npm run deploy:frontend:dev

# 2. Verify dev environment works

# 3. Deploy to production
npm run deploy:prod
npm run deploy:frontend:prod

# 4. Update CloudFront domain in prod
npm run update:cloudfront:prod
```

### Monitor Costs

```bash
# Check AWS costs regularly
npm run monitor:costs
```

## 🔐 AWS Profile Configuration

All commands use the `shehzadi` AWS profile. Make sure it's configured:

```bash
# Check if profile exists
aws configure list-profiles

# Configure if needed
aws configure --profile shehzadi

# Test the profile
aws sts get-caller-identity --profile shehzadi
```

**Profile details needed:**

- AWS Access Key ID
- AWS Secret Access Key
- Region: eu-west-1
- Output format: json

## 🌍 Region

All commands use `eu-west-1` (Stockholm) region.

To change the region, update the scripts in `package.json`:

```json
"deploy:dev": "... --region YOUR_REGION ..."
```

## 🎯 Environment Variables

Commands set these automatically:

- `AWS_PROFILE=shehzadi`
- `--region eu-west-1`
- `--context environment=dev` or `--context environment=prod`

## 📝 Script Naming Convention

- `deploy:ENV` - Full stack deployment
- `deploy:ENV:SERVICE` - Single service deployment
- `deploy:frontend:ENV` - Frontend deployment
- `cdk:COMMAND:ENV` - CDK operations
- `update:RESOURCE:ENV` - Update specific resources
- `populate:DATA` - Data population
- `monitor:ASPECT` - Monitoring operations

## 🔍 Troubleshooting

### Script not executable

```bash
# Make script executable
chmod +x ./scripts/script-name.sh
```

### AWS Profile not found

```bash
# List profiles
aws configure list-profiles

# Configure shehzadi profile
aws configure --profile shehzadi
```

### CDK command fails

```bash
# Bootstrap CDK (first time only)
cd infrastructure
AWS_PROFILE=shehzadi npx cdk bootstrap --region eu-west-1
```

### Build fails

```bash
# Install cargo-lambda
cargo install cargo-lambda

# Install Rust musl target
rustup target add x86_64-unknown-linux-musl
```

## 📚 Related Documentation

- [Infrastructure README](../infrastructure/README.md)
- [Deployment Guide](../infrastructure/DEPLOYMENT_GUIDE.md)
- [Quick Deploy Reference](../infrastructure/QUICK_DEPLOY.md)

## 💡 Tips

1. **Always deploy to dev first**

   ```bash
   npm run deploy:dev
   # Test thoroughly
   npm run deploy:prod
   ```

2. **Use diff before deploying**

   ```bash
   npm run cdk:diff:dev
   npm run deploy:dev
   ```

3. **Single service deploys are faster**

   ```bash
   # Instead of deploying everything
   npm run deploy:dev

   # Just deploy what changed
   npm run deploy:dev:analytics
   ```

4. **Monitor costs regularly**

   ```bash
   npm run monitor:costs
   ```

5. **Keep environments in sync**
   ```bash
   # Deploy same code to both environments
   npm run deploy:dev
   npm run deploy:prod
   ```

## 🎉 Quick Reference Card

```bash
# Development
npm run deploy:dev                 # Deploy everything to dev
npm run deploy:dev:analytics       # Deploy single service to dev
npm run deploy:frontend:dev        # Deploy frontend to dev

# Production
npm run deploy:prod                # Deploy everything to prod
npm run deploy:prod:analytics      # Deploy single service to prod
npm run deploy:frontend:prod       # Deploy frontend to prod

# Preview changes
npm run cdk:diff:dev              # Preview dev changes
npm run cdk:diff:prod             # Preview prod changes

# Data
npm run populate:exercises        # Populate exercises
npm run populate:foods            # Populate nutrition data

# Monitoring
npm run monitor:costs             # Check AWS costs

# Build
npm run build:lambdas             # Build all Lambda functions
```

---

**Need help?** Check the [Deployment Guide](../infrastructure/DEPLOYMENT_GUIDE.md) for more details.
