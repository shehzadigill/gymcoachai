# Scripts Update Summary - AWS Profile Integration

## Changes Overview

All deployment scripts and package.json commands have been updated to use the `shehzadi` AWS profile and `eu-north-1` region.

## ✅ Updated Files

### 1. Root `package.json`

**Location:** `/Users/babar/projects/gymcoach-ai/package.json`

**Added 40+ new npm scripts organized by category:**

#### Full Stack Deployment

- `npm run deploy:dev` - Deploy everything to dev
- `npm run deploy:prod` - Deploy everything to prod

#### Single Service Deployment (Dev)

- `npm run deploy:dev:analytics`
- `npm run deploy:dev:workout`
- `npm run deploy:dev:nutrition`
- `npm run deploy:dev:ai`
- `npm run deploy:dev:coaching`
- `npm run deploy:dev:profile`
- `npm run deploy:dev:notification`

#### Single Service Deployment (Prod)

- `npm run deploy:prod:analytics`
- `npm run deploy:prod:workout`
- `npm run deploy:prod:nutrition`
- `npm run deploy:prod:ai`
- `npm run deploy:prod:coaching`
- `npm run deploy:prod:profile`
- `npm run deploy:prod:notification`

#### Frontend Deployment

- `npm run deploy:frontend:dev`
- `npm run deploy:frontend:prod`

#### CDK Operations

- `npm run cdk:diff:dev` / `npm run cdk:diff:prod`
- `npm run cdk:synth:dev` / `npm run cdk:synth:prod`
- `npm run cdk:destroy:dev` / `npm run cdk:destroy:prod`
- `npm run cdk:list`

#### Updates & Utilities

- `npm run update:cloudfront:dev` / `npm run update:cloudfront:prod`
- `npm run populate:exercises`
- `npm run populate:foods`
- `npm run populate:workouts`
- `npm run populate:knowledge`
- `npm run monitor:costs`
- `npm run optimize:performance`
- `npm run setup:monitoring`

### 2. `scripts/deploy-frontend-static.sh`

**Changes:**

- ✅ Accepts environment argument (dev/prod)
- ✅ Uses `AWS_PROFILE=shehzadi` by default
- ✅ Uses `eu-north-1` region
- ✅ Updates stack name to `GymCoachAIStack-{env}`
- ✅ Gets bucket name based on environment

**Usage:**

```bash
# Via npm
npm run deploy:frontend:dev
npm run deploy:frontend:prod

# Direct
./scripts/deploy-frontend-static.sh dev
./scripts/deploy-frontend-static.sh prod
```

### 3. `scripts/update-cloudfront-domain.sh`

**Changes:**

- ✅ Accepts environment argument (dev/prod)
- ✅ Uses `AWS_PROFILE=shehzadi` by default
- ✅ Uses `eu-north-1` region
- ✅ Updates stack name to `GymCoachAIStack-{env}`
- ✅ Updates Lambda for correct environment

**Usage:**

```bash
# Via npm
npm run update:cloudfront:dev
npm run update:cloudfront:prod

# Direct
./scripts/update-cloudfront-domain.sh dev
./scripts/update-cloudfront-domain.sh prod
```

### 4. `scripts/deploy-knowledge-population.sh`

**Changes:**

- ✅ Uses `AWS_PROFILE=shehzadi` by default
- ✅ Uses `eu-north-1` region
- ✅ Updates bucket name to include environment and account ID
- ✅ Uses `pip3` instead of `pip`
- ✅ Uses dev environment by default

**Usage:**

```bash
# Via npm
npm run populate:knowledge

# Direct
./scripts/deploy-knowledge-population.sh
```

### 5. New Documentation

**Created:** `/Users/babar/projects/gymcoach-ai/NPM_SCRIPTS_GUIDE.md`

Comprehensive guide covering:

- All available npm scripts
- Usage examples
- Common workflows
- Troubleshooting
- Quick reference

## 🔑 AWS Profile Configuration

All scripts now use the `shehzadi` AWS profile automatically.

### Verify Profile Configuration

```bash
# List all profiles
aws configure list-profiles

# Check if shehzadi profile exists
aws configure list --profile shehzadi

# Test the profile
aws sts get-caller-identity --profile shehzadi
```

### Configure Profile (if needed)

```bash
aws configure --profile shehzadi
```

**Required inputs:**

- AWS Access Key ID: `your-access-key`
- AWS Secret Access Key: `your-secret-key`
- Default region name: `eu-north-1`
- Default output format: `json`

### Profile Location

The profile is stored in:

- Credentials: `~/.aws/credentials`
- Config: `~/.aws/config`

**Example `~/.aws/credentials`:**

```ini
[shehzadi]
aws_access_key_id = YOUR_ACCESS_KEY
aws_secret_access_key = YOUR_SECRET_KEY
```

**Example `~/.aws/config`:**

```ini
[profile shehzadi]
region = eu-north-1
output = json
```

## 🚀 Quick Start Examples

### Example 1: Deploy Full Stack to Dev

```bash
# Old way (manual)
./scripts/build-lambdas.sh && \
cd infrastructure && \
npx cdk deploy --region eu-north-1 && \
cd ../

# New way (with profile)
npm run deploy:dev
```

### Example 2: Deploy Single Service to Dev

```bash
# Old way (manual)
./scripts/build-lambdas.sh analytics-service && \
cd infrastructure && \
npx cdk deploy --region eu-north-1 && \
cd ../

# New way (with profile)
npm run deploy:dev:analytics
```

### Example 3: Deploy Frontend

```bash
# New way
npm run deploy:frontend:dev
npm run deploy:frontend:prod
```

### Example 4: Preview Changes Before Deploy

```bash
# Check what will change in dev
npm run cdk:diff:dev

# Deploy if changes look good
npm run deploy:dev
```

## 📋 Migration from Old Commands

| Old Command                                                                                               | New Command                     |
| --------------------------------------------------------------------------------------------------------- | ------------------------------- |
| `./scripts/build-lambdas.sh && cd infrastructure && npx cdk deploy --region eu-north-1`                   | `npm run deploy:dev`            |
| `./scripts/build-lambdas.sh analytics-service && cd infrastructure && npx cdk deploy --region eu-north-1` | `npm run deploy:dev:analytics`  |
| `./scripts/deploy-frontend-static.sh`                                                                     | `npm run deploy:frontend:dev`   |
| `./scripts/update-cloudfront-domain.sh`                                                                   | `npm run update:cloudfront:dev` |
| `cd infrastructure && cdk diff --region eu-north-1`                                                       | `npm run cdk:diff:dev`          |
| `cd infrastructure && cdk destroy --region eu-north-1`                                                    | `npm run cdk:destroy:dev`       |

## 🎯 Environment-Based Deployment

All commands now support both dev and prod environments:

```bash
# Development
npm run deploy:dev
npm run deploy:dev:analytics
npm run deploy:frontend:dev
npm run cdk:diff:dev

# Production
npm run deploy:prod
npm run deploy:prod:analytics
npm run deploy:frontend:prod
npm run cdk:diff:prod
```

## 📦 What Each Command Does

### `npm run deploy:dev`

1. Sets `AWS_PROFILE=shehzadi`
2. Runs `./scripts/build-lambdas.sh` (builds all Lambda functions)
3. Changes to `infrastructure` directory
4. Runs `npx cdk deploy --context environment=dev --region eu-north-1`
5. Returns to root directory

### `npm run deploy:dev:analytics`

1. Sets `AWS_PROFILE=shehzadi`
2. Runs `./scripts/build-lambdas.sh analytics-service` (builds only analytics)
3. Changes to `infrastructure` directory
4. Runs `npx cdk deploy --context environment=dev --region eu-north-1`
5. Returns to root directory

### `npm run deploy:frontend:dev`

1. Sets `AWS_PROFILE=shehzadi`
2. Runs `./scripts/deploy-frontend-static.sh dev`
3. Script builds Next.js static export
4. Syncs to S3 bucket for dev environment
5. Shows CloudFront URL

## 🔧 Troubleshooting

### Error: "Profile not found"

```bash
# Configure the profile
aws configure --profile shehzadi
```

### Error: "Permission denied"

```bash
# Make scripts executable
chmod +x ./scripts/*.sh
```

### Error: "CDK not found"

```bash
# Install CDK dependencies
cd infrastructure
npm install
```

### Error: "Region not found"

The region `eu-north-1` is hardcoded in all scripts. If you need a different region, update the scripts in `package.json`.

## 📊 Benefits of New Setup

✅ **Consistency**: All scripts use the same AWS profile and region  
✅ **Simplicity**: One command instead of multiple steps  
✅ **Environment Safety**: Clear separation between dev and prod  
✅ **Faster Development**: Single service deploys save time  
✅ **Documentation**: Comprehensive guide for all commands  
✅ **Version Control**: All commands defined in package.json

## 🎉 Ready to Use!

You can now use simple npm commands for all deployments:

```bash
# Most common commands
npm run deploy:dev              # Deploy full stack to dev
npm run deploy:dev:analytics    # Deploy single service to dev
npm run deploy:frontend:dev     # Deploy frontend to dev
npm run cdk:diff:dev           # Preview changes
```

See [NPM_SCRIPTS_GUIDE.md](./NPM_SCRIPTS_GUIDE.md) for complete documentation!

---

**All scripts are ready to use with your `shehzadi` AWS profile! 🚀**
