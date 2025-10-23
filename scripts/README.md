# S3 Vectors Knowledge Population

This directory contains scripts for populating S3 Vectors with comprehensive fitness knowledge including exercises, nutrition, and research.

## Overview

The knowledge population system creates a comprehensive fitness knowledge base using AWS S3 Vectors for cost-optimized vector storage. This enables RAG (Retrieval Augmented Generation) capabilities for the AI fitness coach.

## Knowledge Categories

### 1. Exercise Knowledge (5000+ exercises)

- **Strength Training**: Compound and isolation exercises with variations
- **Cardio**: Running, cycling, swimming, and other cardiovascular exercises
- **Flexibility**: Static and dynamic stretching exercises
- **Functional**: Movement pattern-based exercises
- **Sport-Specific**: Exercises tailored to specific sports
- **Rehabilitation**: Injury prevention and recovery exercises

### 2. Nutrition Knowledge (10000+ items)

- **Proteins**: Animal, plant, and dairy protein sources
- **Carbohydrates**: Grains, fruits, and other carb sources
- **Fats**: Oils, nuts, seeds, and other fat sources
- **Vegetables**: All types of vegetables with cooking methods
- **Fruits**: Fresh, frozen, and dried fruit options
- **Complete Meals**: Balanced meal combinations
- **Snacks**: Healthy snack options
- **Beverages**: Nutritious drink options
- **Supplements**: Protein powders and other supplements

### 3. Research Knowledge

- **Training Methodology**: Periodization, exercise selection, progression
- **Nutrition Science**: Meal timing, macro optimization, hydration
- **Recovery**: Sleep optimization, stress management
- **Performance**: Athletic performance enhancement

### 4. Injury Prevention Knowledge

- **Lower Back**: Prevention strategies and exercises
- **Shoulder**: Mobility and stability exercises
- **Knee**: Joint protection and strengthening
- **Common Injuries**: Prevention and treatment protocols

### 5. Training Methodology Knowledge

- **Periodization**: Linear, undulating, and block periodization
- **Exercise Selection**: Compound vs isolation, functional movements
- **Progression**: Progressive overload principles
- **Recovery**: Training load management and rest protocols

## Scripts

### `exercise-knowledge-builder.py`

Generates comprehensive exercise library with:

- 5000+ exercises across all categories
- Detailed instructions and variations
- Equipment and difficulty progressions
- Muscle group targeting
- Form tips and common mistakes

### `nutrition-knowledge-builder.py`

Creates nutrition database with:

- 10000+ food items and meals
- Detailed nutritional information
- Cooking methods and preparation tips
- Substitution suggestions
- Dietary restriction compatibility

### `populate-s3-vectors-knowledge.py`

Main script that:

- Orchestrates all knowledge population
- Processes items in batches for efficiency
- Generates embeddings using Bedrock Titan
- Stores vectors in S3 with metadata
- Provides comprehensive error handling

### `deploy-knowledge-population.sh`

Deployment script that:

- Sets up environment variables
- Installs required dependencies
- Verifies AWS credentials and S3 bucket
- Runs all knowledge population scripts
- Provides deployment verification

## Prerequisites

1. **AWS CLI configured** with appropriate permissions
2. **S3 Vectors bucket** deployed via CDK
3. **Bedrock access** for embedding generation
4. **Python 3.8+** with required packages

## Required Environment Variables

```bash
export VECTORS_BUCKET="gymcoach-ai-vectors"
export DYNAMODB_TABLE="gymcoach-ai-main"
export AWS_REGION="us-east-1"
```

## Installation

1. **Install dependencies**:

   ```bash
   pip install boto3 botocore asyncio
   ```

2. **Make scripts executable**:

   ```bash
   chmod +x scripts/*.py
   chmod +x scripts/deploy-knowledge-population.sh
   ```

3. **Verify AWS setup**:
   ```bash
   aws sts get-caller-identity
   aws s3 ls s3://gymcoach-ai-vectors
   ```

## Usage

### Quick Deployment

```bash
./scripts/deploy-knowledge-population.sh
```

### Individual Scripts

```bash
# Exercise knowledge only
python3 scripts/exercise-knowledge-builder.py

# Nutrition knowledge only
python3 scripts/nutrition-knowledge-builder.py

# All knowledge
python3 scripts/populate-s3-vectors-knowledge.py
```

## Expected Results

After successful population:

- **Exercise Knowledge**: 5000+ exercise vectors in `exercises` namespace
- **Nutrition Knowledge**: 10000+ nutrition vectors in `nutrition` namespace
- **Research Knowledge**: Research articles in `research` namespace
- **Injury Prevention**: Injury prevention guides in `injuries` namespace
- **Training Methodology**: Training guides in `training` namespace

## Cost Estimation

- **Embedding Generation**: ~$50-100 one-time cost
- **S3 Vectors Storage**: ~$10-20/month for 10GB+ vectors
- **Total**: Under $200 one-time + $20/month storage

## Monitoring

Monitor the population process:

- **Success Rate**: Should be >95% successful embeddings
- **Error Logs**: Check for failed items and retry if needed
- **S3 Usage**: Monitor storage costs and usage
- **Bedrock Usage**: Track embedding generation costs

## Troubleshooting

### Common Issues

1. **AWS Credentials**: Ensure AWS CLI is configured
2. **S3 Bucket**: Verify bucket exists and has proper permissions
3. **Bedrock Access**: Check Bedrock service access
4. **Rate Limits**: Scripts include batching to avoid rate limits
5. **Memory Issues**: Process in smaller batches if needed

### Error Handling

- Scripts include comprehensive error handling
- Failed items are logged for retry
- Batch processing prevents memory issues
- Progress logging for monitoring

## Integration

The populated knowledge integrates with:

- **RAG Service**: Retrieves relevant context for AI responses
- **AI Chat**: Enhances responses with fitness knowledge
- **Workout Planning**: Provides exercise and nutrition guidance
- **Injury Prevention**: Offers safety recommendations

## Maintenance

### Regular Updates

- **Exercise Library**: Add new exercises and variations
- **Nutrition Database**: Update with new foods and research
- **Research Knowledge**: Add latest fitness research
- **Injury Prevention**: Update with new prevention strategies

### Performance Optimization

- **Vector Optimization**: Regular cleanup of unused vectors
- **Cost Monitoring**: Track embedding and storage costs
- **Quality Assurance**: Validate knowledge accuracy
- **User Feedback**: Incorporate user suggestions

## Support

For issues or questions:

1. Check the error logs in the script output
2. Verify AWS permissions and configuration
3. Review the troubleshooting section
4. Contact the development team for assistance

---

**Note**: This knowledge population is a one-time setup process. The generated knowledge base will enhance AI responses and provide comprehensive fitness guidance to users.
