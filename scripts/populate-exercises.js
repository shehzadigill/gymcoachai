const https = require('https');

const API_BASE_URL = 'https://d12pveuxxq3vvn.cloudfront.net';

const sampleExercises = [
  {
    name: 'Push-ups',
    description:
      'A classic bodyweight exercise that targets the chest, shoulders, and triceps.',
    category: 'strength',
    muscleGroups: ['chest', 'shoulders', 'arms'],
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
    muscleGroups: ['legs', 'glutes'],
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
    muscleGroups: ['back', 'legs', 'glutes'],
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
    muscleGroups: ['back', 'arms'],
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
    muscleGroups: ['core'],
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
    muscleGroups: ['full body'],
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
    muscleGroups: ['legs', 'glutes'],
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
    muscleGroups: ['core', 'legs'],
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

async function createExercise(exerciseData) {
  const data = JSON.stringify(exerciseData);

  const options = {
    hostname: 'd12pveuxxq3vvn.cloudfront.net',
    port: 443,
    path: '/api/workouts/exercises',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(data),
      Authorization: 'Bearer dummy-token-for-testing', // Replace with actual token if needed
    },
  };

  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });

      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          console.log(`✅ Created exercise: ${exerciseData.name}`);
          resolve(JSON.parse(responseData));
        } else {
          console.error(
            `❌ Failed to create exercise ${exerciseData.name}: ${res.statusCode} ${responseData}`
          );
          reject(new Error(`HTTP ${res.statusCode}: ${responseData}`));
        }
      });
    });

    req.on('error', (error) => {
      console.error(`❌ Error creating exercise ${exerciseData.name}:`, error);
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function populateExercises() {
  console.log('🏋️ Starting to populate exercises database...\n');

  for (const exercise of sampleExercises) {
    try {
      await createExercise(exercise);
      // Add a small delay between requests
      await new Promise((resolve) => setTimeout(resolve, 500));
    } catch (error) {
      console.error(
        `Failed to create exercise ${exercise.name}:`,
        error.message
      );
    }
  }

  console.log('\n✅ Exercise population completed!');
}

if (require.main === module) {
  populateExercises().catch(console.error);
}

module.exports = { populateExercises, sampleExercises };
