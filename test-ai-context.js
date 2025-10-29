// Test script to verify AI context is being sent correctly
const https = require('https');

// Your API endpoint - update this with your actual API endpoint
const API_ENDPOINT = 'https://your-api-endpoint.execute-api.region.amazonaws.com/prod';

// Test with a simple chat message
async function testAIChat() {
  const payload = JSON.stringify({
    message: "What workout should I do today based on my goals?",
    conversationId: "test-conversation-" + Date.now(),
    includeRAG: true,
    personalizationLevel: "high",
    context: {
      coachingStyle: "motivational",
      userProfile: {
        firstName: "Test",
        lastName: "User",
        age: 30,
        gender: "male",
        experienceLevel: "intermediate",
        fitnessGoals: ["muscle_building", "strength"],
        height: 175,
        weight: 75
      },
      userPreferences: {
        language: "en",
        units: "metric",
        aiTrainer: {
          coachingStyle: "motivational",
          focusAreas: ["upper_body", "core"],
          equipmentAvailable: ["dumbbells", "barbell", "bench"]
        }
      }
    }
  });

  console.log('Sending request to AI service...');
  console.log('Payload:', JSON.parse(payload));

  const options = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': payload.length,
      // Add your auth token here
      'Authorization': 'Bearer YOUR_AUTH_TOKEN'
    }
  };

  return new Promise((resolve, reject) => {
    const req = https.request(`${API_ENDPOINT}/api/ai/chat`, options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        console.log('\nResponse status:', res.statusCode);
        console.log('Response:', JSON.parse(data));
        resolve(JSON.parse(data));
      });
    });

    req.on('error', (error) => {
      console.error('Error:', error);
      reject(error);
    });

    req.write(payload);
    req.end();
  });
}

// Run the test
testAIChat()
  .then(() => console.log('\nTest completed'))
  .catch(err => console.error('\nTest failed:', err));
