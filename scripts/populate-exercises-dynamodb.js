const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');
const { v4: uuidv4 } = require('uuid');

const client = new DynamoDBClient({ region: 'eu-north-1' });
const dynamoDb = DynamoDBDocumentClient.from(client);
const tableName = 'gymcoach-ai-main';

const sampleExercises = [
  {
    name: 'Push-ups',
    description:
      'A classic bodyweight exercise that targets the chest, shoulders, and triceps.',
    category: 'strength',
    muscle_groups: ['chest', 'shoulders', 'arms'],
    equipment: [],
    difficulty: 'beginner',
    instructions: [
      'Start in a plank position with hands slightly wider than shoulder-width',
      'Lower your body until your chest nearly touches the floor',
      'Push back up to the starting position',
      'Keep your core tight throughout the movement',
    ],
    tips: 'Keep your body in a straight line from head to heels. If too difficult, start with knee push-ups.',
  },
  {
    name: 'Squats',
    description:
      'A fundamental lower body exercise that works the quadriceps, glutes, and hamstrings.',
    category: 'strength',
    muscle_groups: ['legs', 'glutes'],
    equipment: [],
    difficulty: 'beginner',
    instructions: [
      'Stand with feet shoulder-width apart',
      'Lower your body as if sitting back into a chair',
      'Keep your chest up and knees behind your toes',
      'Push through your heels to return to standing',
    ],
    tips: 'Go as low as you can while maintaining good form. Your thighs should be parallel to the floor if possible.',
  },
  {
    name: 'Deadlifts',
    description:
      'A compound exercise that targets the posterior chain including hamstrings, glutes, and back.',
    category: 'strength',
    muscle_groups: ['back', 'legs', 'glutes'],
    equipment: ['barbell', 'weights'],
    difficulty: 'intermediate',
    instructions: [
      'Stand with feet hip-width apart, barbell over mid-foot',
      'Bend at hips and knees to grip the bar',
      'Keep chest up and back straight',
      'Drive through heels to lift the bar, extending hips and knees',
    ],
    tips: 'Keep the bar close to your body throughout the movement. Start with light weight to perfect your form.',
  },
  {
    name: 'Pull-ups',
    description:
      'An upper body exercise that primarily targets the back muscles and biceps.',
    category: 'strength',
    muscle_groups: ['back', 'arms'],
    equipment: ['pull-up bar'],
    difficulty: 'intermediate',
    instructions: [
      'Hang from a pull-up bar with hands slightly wider than shoulder-width',
      'Pull your body up until your chin is over the bar',
      'Lower yourself back down with control',
      'Keep your core engaged throughout',
    ],
    tips: "If you can't do a full pull-up, use resistance bands or do negative pull-ups to build strength.",
  },
  {
    name: 'Planks',
    description:
      'An isometric core exercise that strengthens the entire core region.',
    category: 'strength',
    muscle_groups: ['core'],
    equipment: [],
    difficulty: 'beginner',
    instructions: [
      'Start in a push-up position but rest on your forearms',
      'Keep your body in a straight line from head to heels',
      'Hold this position while breathing normally',
      "Keep your core tight and don't let your hips sag",
    ],
    tips: 'Start with 30-second holds and gradually increase the time as you get stronger.',
  },
  {
    name: 'Burpees',
    description:
      'A full-body cardio exercise that combines strength and cardiovascular training.',
    category: 'cardio',
    muscle_groups: ['full body'],
    equipment: [],
    difficulty: 'intermediate',
    instructions: [
      'Start standing, then squat down and place hands on the floor',
      'Jump feet back into a plank position',
      'Do a push-up (optional)',
      'Jump feet back to squat position, then jump up with arms overhead',
    ],
    tips: 'Modify by stepping back instead of jumping, or skip the push-up component.',
  },
  {
    name: 'Lunges',
    description:
      'A unilateral leg exercise that targets the quadriceps, glutes, and improves balance.',
    category: 'strength',
    muscle_groups: ['legs', 'glutes'],
    equipment: [],
    difficulty: 'beginner',
    instructions: [
      'Step forward with one leg, lowering your hips until both knees are bent at 90 degrees',
      'Keep your front knee over your ankle',
      'Push back to the starting position',
      'Repeat with the other leg',
    ],
    tips: 'Keep your torso upright and core engaged. Take a big enough step to avoid your front knee going over your toes.',
  },
  {
    name: 'Mountain Climbers',
    description:
      'A dynamic cardio exercise that targets the core while providing cardiovascular benefits.',
    category: 'cardio',
    muscle_groups: ['core', 'legs'],
    equipment: [],
    difficulty: 'intermediate',
    instructions: [
      'Start in a plank position',
      'Bring one knee toward your chest, then quickly switch legs',
      'Continue alternating legs at a quick pace',
      'Keep your core tight and hips level',
    ],
    tips: 'Start slowly to maintain form, then increase speed as you get more comfortable with the movement.',
  },
];

async function addExerciseToDynamoDB(exercise) {
  const exerciseId = uuidv4();
  const now = new Date().toISOString();

  const item = {
    PK: 'EXERCISES',
    SK: `EXERCISE#${exerciseId}`,
    id: exerciseId,
    name: exercise.name,
    description: exercise.description,
    category: exercise.category,
    muscle_groups: exercise.muscle_groups,
    equipment: exercise.equipment,
    difficulty: exercise.difficulty,
    instructions: exercise.instructions,
    tips: exercise.tips,
    created_at: now,
    updated_at: now,
  };

  try {
    await dynamoDb.send(
      new PutCommand({
        TableName: tableName,
        Item: item,
      })
    );
    console.log(`✅ Added exercise: ${exercise.name}`);
    return item;
  } catch (error) {
    console.error(`❌ Failed to add exercise ${exercise.name}:`, error);
    throw error;
  }
}

async function populateExercises() {
  console.log('🏋️ Starting to populate exercises in DynamoDB...\n');

  for (const exercise of sampleExercises) {
    try {
      await addExerciseToDynamoDB(exercise);
      // Add a small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      console.error(`Failed to add exercise ${exercise.name}:`, error.message);
    }
  }

  console.log('\n✅ Exercise population completed!');
}

if (require.main === module) {
  populateExercises().catch(console.error);
}

module.exports = { populateExercises, sampleExercises };
