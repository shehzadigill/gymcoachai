const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  ScanCommand,
  PutCommand,
  DeleteCommand,
} = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const tableName = 'gymcoach-ai-main-dev';

async function migrateWorkoutPlans() {
  try {
    console.log('Starting migration of workout plans to PascalCase...');

    // Scan for all workout plans (snake_case format)
    const scanParams = {
      TableName: tableName,
      FilterExpression: 'begins_with(SK, :sk_prefix)',
      ExpressionAttributeValues: {
        ':sk_prefix': 'WORKOUT_PLAN#',
      },
    };

    const scanResult = await docClient.send(new ScanCommand(scanParams));
    const items = scanResult.Items || [];

    console.log(`Found ${items.length} workout plans to migrate`);

    for (const item of items) {
      // Check if it's already in PascalCase format
      if (item.WorkoutPlanId) {
        console.log(`Skipping ${item.WorkoutPlanId} - already in PascalCase`);
        continue;
      }

      console.log(`\nMigrating plan: ${item.name || item.id}`);

      // Create new item with PascalCase
      const newItem = {
        PK: item.PK,
        SK: item.SK,
        WorkoutPlanId: item.id,
        UserId: item.user_id,
        Name: item.name,
        Description: item.description || '',
        Difficulty: item.difficulty,
        DurationWeeks: item.duration_weeks,
        FrequencyPerWeek: item.frequency_per_week,
        IsActive: item.is_active !== undefined ? item.is_active : true,
        Exercises: JSON.stringify([]), // Empty array for now
        CreatedAt: item.created_at,
        UpdatedAt: item.updated_at,
        EntityType: 'WORKOUT_PLAN',
        GSI1PK: 'WORKOUT_PLAN',
        GSI1SK: `${(item.name || '').toLowerCase()}#${item.id}`,
      };

      // Add optional fields
      if (item.tags) {
        newItem.Tags =
          typeof item.tags === 'string' ? item.tags : JSON.stringify(item.tags);
      }

      if (item.is_template !== undefined) {
        newItem.IsTemplate = item.is_template;
      }

      if (item.rating !== undefined) {
        newItem.Rating = item.rating;
      }

      if (item.total_sessions !== undefined) {
        newItem.TotalSessions = item.total_sessions;
      }

      if (item.completed_sessions !== undefined) {
        newItem.CompletedSessions = item.completed_sessions;
      }

      if (item.next_scheduled_date) {
        newItem.NextScheduledDate = item.next_scheduled_date;
      }

      // Put the new item
      await docClient.send(
        new PutCommand({
          TableName: tableName,
          Item: newItem,
        })
      );

      console.log(`✅ Migrated: ${item.name || item.id}`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log(`   • ${items.length} workout plans migrated`);
  } catch (error) {
    console.error('❌ Error migrating workout plans:', error);
    throw error;
  }
}

// Run the migration
migrateWorkoutPlans().catch(console.error);
