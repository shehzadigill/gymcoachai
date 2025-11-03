const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, PutCommand } = require('@aws-sdk/lib-dynamodb');

const client = new DynamoDBClient({ region: 'eu-west-1' });
const docClient = DynamoDBDocumentClient.from(client);

const tableName = 'gymcoach-ai-main';

// Default exercises to populate the exercise library
const defaultExercises = [
  {
    id: 'exercise-001',
    name: 'Bench Press',
    description: 'Classic chest building exercise using a barbell',
    category: 'strength',
    muscle_groups: ['chest', 'triceps', 'shoulders'],
    equipment: ['barbell', 'bench'],
    difficulty: 'intermediate',
    instructions: [
      'Lie flat on the bench with feet firmly on the ground',
      'Grip the barbell with hands slightly wider than shoulder-width',
      'Lower the bar to your chest with control',
      'Press the bar up until arms are fully extended',
      'Repeat for desired repetitions',
    ],
    tips: 'Keep your core tight and maintain a slight arch in your back. Focus on squeezing your chest muscles at the top.',
    video_url: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exercise-002',
    name: 'Back Squat',
    description: 'Fundamental lower body movement for building leg strength',
    category: 'strength',
    muscle_groups: ['quadriceps', 'glutes', 'hamstrings', 'calves'],
    equipment: ['barbell', 'squat_rack'],
    difficulty: 'intermediate',
    instructions: [
      'Stand with feet shoulder-width apart',
      'Position barbell on your upper traps',
      'Lower your body by bending at hips and knees',
      'Keep chest up and knees tracking over toes',
      'Return to starting position by driving through heels',
    ],
    tips: 'Focus on sitting back into the squat rather than just bending knees. Keep your weight on your heels.',
    video_url: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exercise-003',
    name: 'Deadlift',
    description:
      'Full-body compound movement for building posterior chain strength',
    category: 'strength',
    muscle_groups: ['hamstrings', 'glutes', 'lower_back', 'traps', 'lats'],
    equipment: ['barbell', 'plates'],
    difficulty: 'advanced',
    instructions: [
      'Stand with feet hip-width apart, bar over mid-foot',
      'Bend at hips and knees to grip the bar',
      'Keep chest up and shoulders back',
      'Drive through heels to lift the bar',
      'Stand tall with shoulders back at the top',
    ],
    tips: 'Keep the bar close to your body throughout the movement. Focus on pushing the floor away with your feet.',
    video_url: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exercise-004',
    name: 'Pull-ups',
    description: 'Upper body pulling exercise for back and bicep development',
    category: 'strength',
    muscle_groups: ['lats', 'rhomboids', 'biceps', 'rear_delts'],
    equipment: ['pull_up_bar'],
    difficulty: 'intermediate',
    instructions: [
      'Hang from pull-up bar with overhand grip',
      'Pull your body up until chin clears the bar',
      'Lower yourself with control to full arm extension',
      'Repeat for desired repetitions',
    ],
    tips: 'Focus on pulling with your back muscles, not just your arms. Engage your core for stability.',
    video_url: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exercise-005',
    name: 'Shoulder Press',
    description: 'Overhead pressing movement for shoulder development',
    category: 'strength',
    muscle_groups: ['shoulders', 'triceps', 'upper_chest'],
    equipment: ['dumbbells'],
    difficulty: 'beginner',
    instructions: [
      'Stand with dumbbells at shoulder height',
      'Press weights overhead until arms are fully extended',
      'Lower with control back to starting position',
      'Keep core engaged throughout the movement',
    ],
    tips: 'Avoid arching your back excessively. Press straight up, not forward.',
    video_url: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exercise-006',
    name: 'Running',
    description: 'Cardiovascular exercise for endurance and fat burning',
    category: 'cardio',
    muscle_groups: ['legs', 'core', 'cardiovascular_system'],
    equipment: ['none'],
    difficulty: 'beginner',
    instructions: [
      'Start with a light warm-up walk',
      'Begin running at a comfortable pace',
      'Maintain steady breathing rhythm',
      'Land on midfoot, not heel',
      'Keep posture upright with slight forward lean',
    ],
    tips: 'Start slowly and gradually increase pace and distance. Listen to your body and rest when needed.',
    video_url: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exercise-007',
    name: 'Push-ups',
    description:
      'Classic bodyweight exercise for chest, shoulders, and triceps',
    category: 'strength',
    muscle_groups: ['chest', 'triceps', 'shoulders', 'core'],
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    instructions: [
      'Start in plank position with hands shoulder-width apart',
      'Lower your body until chest nearly touches the floor',
      'Push back up to starting position',
      'Keep your body in a straight line throughout',
    ],
    tips: 'If regular push-ups are too difficult, start with knee push-ups or incline push-ups.',
    video_url: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'exercise-008',
    name: 'Plank',
    description: 'Isometric core strengthening exercise',
    category: 'strength',
    muscle_groups: ['core', 'shoulders', 'glutes'],
    equipment: ['bodyweight'],
    difficulty: 'beginner',
    instructions: [
      'Start in push-up position',
      'Lower onto your forearms',
      'Keep your body in a straight line',
      'Hold this position for desired time',
      'Breathe normally throughout the hold',
    ],
    tips: 'Avoid sagging hips or raising your butt too high. Focus on keeping a neutral spine.',
    video_url: null,
    image_url: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

// Default workout plans
const defaultWorkoutPlans = [
  {
    id: 'plan-001',
    user_id: 'system', // System-generated plans available to all users
    name: 'Beginner Full Body',
    description:
      'A complete full-body workout perfect for beginners starting their fitness journey',
    difficulty: 'beginner',
    duration_weeks: 8,
    frequency_per_week: 3,
    exercises: [
      {
        exercise_id: 'exercise-007',
        name: 'Push-ups',
        sets: 3,
        reps: 10,
        weight: null,
        rest_seconds: 60,
        notes: 'Start with knee push-ups if needed',
        order: 0,
      },
      {
        exercise_id: 'exercise-002',
        name: 'Bodyweight Squats',
        sets: 3,
        reps: 15,
        weight: null,
        rest_seconds: 60,
        notes: 'Focus on proper form',
        order: 1,
      },
      {
        exercise_id: 'exercise-008',
        name: 'Plank',
        sets: 3,
        reps: null,
        duration_seconds: 30,
        rest_seconds: 60,
        notes: 'Hold for 30 seconds, increase gradually',
        order: 2,
      },
      {
        exercise_id: 'exercise-006',
        name: 'Walking/Light Jogging',
        sets: 1,
        reps: null,
        duration_seconds: 900, // 15 minutes
        rest_seconds: null,
        notes: 'Start with walking, progress to light jogging',
        order: 3,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
  },
  {
    id: 'plan-002',
    user_id: 'system',
    name: 'Intermediate Strength Training',
    description:
      'Intermediate strength training program focusing on compound movements',
    difficulty: 'intermediate',
    duration_weeks: 12,
    frequency_per_week: 4,
    exercises: [
      {
        exercise_id: 'exercise-001',
        name: 'Bench Press',
        sets: 4,
        reps: 8,
        weight: 135,
        rest_seconds: 120,
        notes: 'Increase weight gradually each week',
        order: 0,
      },
      {
        exercise_id: 'exercise-002',
        name: 'Back Squat',
        sets: 4,
        reps: 8,
        weight: 155,
        rest_seconds: 120,
        notes: 'Focus on depth and control',
        order: 1,
      },
      {
        exercise_id: 'exercise-004',
        name: 'Pull-ups',
        sets: 3,
        reps: 6,
        weight: null,
        rest_seconds: 90,
        notes: 'Use assistance if needed',
        order: 2,
      },
      {
        exercise_id: 'exercise-005',
        name: 'Shoulder Press',
        sets: 3,
        reps: 10,
        weight: 50,
        rest_seconds: 90,
        notes: 'Control the negative portion',
        order: 3,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
  },
  {
    id: 'plan-003',
    user_id: 'system',
    name: 'Advanced Powerlifting',
    description: 'Advanced powerlifting program for experienced lifters',
    difficulty: 'advanced',
    duration_weeks: 16,
    frequency_per_week: 5,
    exercises: [
      {
        exercise_id: 'exercise-001',
        name: 'Bench Press',
        sets: 5,
        reps: 5,
        weight: 185,
        rest_seconds: 180,
        notes: 'Heavy compound movement - focus on power',
        order: 0,
      },
      {
        exercise_id: 'exercise-002',
        name: 'Back Squat',
        sets: 5,
        reps: 5,
        weight: 225,
        rest_seconds: 180,
        notes: 'Go for maximum depth',
        order: 1,
      },
      {
        exercise_id: 'exercise-003',
        name: 'Deadlift',
        sets: 5,
        reps: 3,
        weight: 275,
        rest_seconds: 240,
        notes: 'Most demanding lift - perfect form required',
        order: 2,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
  },
  {
    id: 'plan-004',
    user_id: 'system',
    name: 'Cardio Blast',
    description: 'High-intensity cardio workout for fat burning and endurance',
    difficulty: 'intermediate',
    duration_weeks: 6,
    frequency_per_week: 4,
    exercises: [
      {
        exercise_id: 'exercise-006',
        name: 'High-Intensity Running',
        sets: 5,
        reps: null,
        duration_seconds: 300, // 5 minutes
        rest_seconds: 120,
        notes: 'Sprint intervals - 30s sprint, 30s recovery',
        order: 0,
      },
      {
        exercise_id: 'exercise-007',
        name: 'Burpees',
        sets: 4,
        reps: 15,
        weight: null,
        rest_seconds: 90,
        notes: 'Explosive movement - maintain form',
        order: 1,
      },
      {
        exercise_id: 'exercise-008',
        name: 'Mountain Climbers',
        sets: 4,
        reps: null,
        duration_seconds: 45,
        rest_seconds: 60,
        notes: 'Keep core tight throughout',
        order: 2,
      },
    ],
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    is_active: true,
  },
];

// Sample workout sessions (completed workouts)
const defaultWorkoutSessions = [
  {
    id: 'session-001',
    user_id: 'demo-user',
    workout_plan_id: 'plan-001',
    name: 'Beginner Full Body - Session 1',
    started_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week ago
    completed_at: new Date(
      Date.now() - 7 * 24 * 60 * 60 * 1000 + 45 * 60 * 1000
    ).toISOString(),
    duration_minutes: 45,
    exercises: [
      {
        exercise_id: 'exercise-007',
        name: 'Push-ups',
        sets: [
          { set_number: 1, reps: 8, weight: null, completed: true },
          { set_number: 2, reps: 10, weight: null, completed: true },
          { set_number: 3, reps: 8, weight: null, completed: true },
        ],
        order: 0,
      },
      {
        exercise_id: 'exercise-002',
        name: 'Bodyweight Squats',
        sets: [
          { set_number: 1, reps: 15, weight: null, completed: true },
          { set_number: 2, reps: 15, weight: null, completed: true },
          { set_number: 3, reps: 12, weight: null, completed: true },
        ],
        order: 1,
      },
    ],
    notes: 'First workout session - felt great!',
    rating: 4,
    created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'session-002',
    user_id: 'demo-user',
    workout_plan_id: 'plan-002',
    name: 'Intermediate Strength - Upper Body',
    started_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
    completed_at: new Date(
      Date.now() - 3 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000
    ).toISOString(),
    duration_minutes: 60,
    exercises: [
      {
        exercise_id: 'exercise-001',
        name: 'Bench Press',
        sets: [
          { set_number: 1, reps: 8, weight: 135, completed: true },
          { set_number: 2, reps: 8, weight: 145, completed: true },
          { set_number: 3, reps: 6, weight: 155, completed: true },
          { set_number: 4, reps: 5, weight: 155, completed: true },
        ],
        order: 0,
      },
      {
        exercise_id: 'exercise-005',
        name: 'Shoulder Press',
        sets: [
          { set_number: 1, reps: 10, weight: 50, completed: true },
          { set_number: 2, reps: 10, weight: 55, completed: true },
          { set_number: 3, reps: 8, weight: 60, completed: true },
        ],
        order: 1,
      },
    ],
    notes:
      'Progressive overload working well. Increased weight on bench press.',
    rating: 5,
    created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updated_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

async function populateWorkouts() {
  try {
    console.log('Starting to populate workout data...');

    // Populate Exercises
    console.log('\n📚 Populating exercises...');
    for (const exercise of defaultExercises) {
      const item = {
        PK: `EXERCISE#${exercise.id}`,
        SK: `EXERCISE#${exercise.id}`,
        GSI1PK: 'EXERCISE',
        GSI1SK: `${exercise.name.toLowerCase()}#${exercise.id}`,
        EntityType: 'EXERCISE',
        ExerciseId: exercise.id,
        Name: exercise.name,
        NameLower: exercise.name.toLowerCase(),
        Description: exercise.description,
        Category: exercise.category,
        MuscleGroups: JSON.stringify(exercise.muscle_groups),
        Equipment: JSON.stringify(exercise.equipment),
        Difficulty: exercise.difficulty,
        Instructions: JSON.stringify(exercise.instructions),
        Tips: exercise.tips,
        VideoUrl: exercise.video_url,
        ImageUrl: exercise.image_url,
        CreatedAt: exercise.created_at,
        UpdatedAt: exercise.updated_at,
      };

      const command = new PutCommand({
        TableName: tableName,
        Item: item,
      });

      await docClient.send(command);
      console.log(`✅ Exercise: ${exercise.name}`);
    }

    // Populate Workout Plans
    console.log('\n🏋️ Populating workout plans...');
    for (const plan of defaultWorkoutPlans) {
      const item = {
        PK: `WORKOUT_PLAN#${plan.id}`,
        SK: `WORKOUT_PLAN#${plan.id}`,
        GSI1PK: 'WORKOUT_PLAN',
        GSI1SK: `${plan.name.toLowerCase()}#${plan.id}`,
        EntityType: 'WORKOUT_PLAN',
        WorkoutPlanId: plan.id,
        UserId: plan.user_id,
        Name: plan.name,
        NameLower: plan.name.toLowerCase(),
        Description: plan.description,
        Difficulty: plan.difficulty,
        DurationWeeks: plan.duration_weeks,
        FrequencyPerWeek: plan.frequency_per_week,
        Exercises: JSON.stringify(plan.exercises),
        CreatedAt: plan.created_at,
        UpdatedAt: plan.updated_at,
        IsActive: plan.is_active,
      };

      const command = new PutCommand({
        TableName: tableName,
        Item: item,
      });

      await docClient.send(command);
      console.log(`✅ Workout Plan: ${plan.name}`);
    }

    // Populate Workout Sessions
    console.log('\n📊 Populating workout sessions...');
    for (const session of defaultWorkoutSessions) {
      const item = {
        PK: `WORKOUT_SESSION#${session.id}`,
        SK: `WORKOUT_SESSION#${session.id}`,
        GSI1PK: 'WORKOUT_SESSION',
        GSI1SK: `${session.user_id}#${session.started_at}`,
        EntityType: 'WORKOUT_SESSION',
        WorkoutSessionId: session.id,
        UserId: session.user_id,
        WorkoutPlanId: session.workout_plan_id,
        Name: session.name,
        NameLower: session.name.toLowerCase(),
        StartedAt: session.started_at,
        CompletedAt: session.completed_at,
        DurationMinutes: session.duration_minutes,
        Exercises: JSON.stringify(session.exercises),
        Notes: session.notes,
        Rating: session.rating,
        CreatedAt: session.created_at,
        UpdatedAt: session.updated_at,
      };

      const command = new PutCommand({
        TableName: tableName,
        Item: item,
      });

      await docClient.send(command);
      console.log(`✅ Workout Session: ${session.name}`);
    }

    console.log('\n✅ Workout data population completed successfully!');
    console.log('\n📈 Summary:');
    console.log(`   • ${defaultExercises.length} exercises added`);
    console.log(`   • ${defaultWorkoutPlans.length} workout plans added`);
    console.log(`   • ${defaultWorkoutSessions.length} workout sessions added`);
  } catch (error) {
    console.error('❌ Error populating workout data:', error);
    throw error;
  }
}

// Run the population script
populateWorkouts().catch(console.error);
