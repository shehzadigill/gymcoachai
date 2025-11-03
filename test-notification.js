const https = require('https');

// Test notification to the deployed notification service
const testNotification = async () => {
  const notificationServiceUrl =
    'https://2bapmwpgyh5ownhk622ycoku7e0odhfw.lambda-url.eu-west-1.on.aws';

  const testData = {
    user_id: 'test-user-123',
    notification_type: 'workout_reminder',
    title: 'Test Notification from Firebase!',
    body: 'This is a test notification to verify Firebase push notifications are working correctly.',
    data: {
      test: true,
      timestamp: new Date().toISOString(),
    },
  };

  const postData = JSON.stringify(testData);

  const options = {
    hostname: '2bapmwpgyh5ownhk622ycoku7e0odhfw.lambda-url.eu-west-1.on.aws',
    port: 443,
    path: '/api/notifications/send',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  console.log('🚀 Testing Firebase Push Notifications...');
  console.log('📡 Sending test notification to:', notificationServiceUrl);
  console.log('📝 Test data:', JSON.stringify(testData, null, 2));

  const req = https.request(options, (res) => {
    console.log(`📊 Status: ${res.statusCode}`);
    console.log(`📋 Headers:`, res.headers);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('📨 Response:', data);

      if (res.statusCode === 200) {
        console.log('✅ Notification test completed successfully!');
      } else {
        console.log('❌ Notification test failed with status:', res.statusCode);
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Error sending notification:', e.message);
  });

  req.write(postData);
  req.end();
};

// Test device token registration
const testDeviceTokenRegistration = async () => {
  const userProfileServiceUrl =
    'https://tsqeldyalolwbzkub6v6dybbbi0lfavi.lambda-url.eu-west-1.on.aws';

  const testData = {
    token: 'test-device-token-12345',
    platform: 'web',
  };

  const postData = JSON.stringify(testData);

  const options = {
    hostname: 'tsqeldyalolwbzkub6v6dybbbi0lfavi.lambda-url.eu-west-1.on.aws',
    port: 443,
    path: '/api/user-profiles/device-token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
    },
  };

  console.log('\n🔑 Testing Device Token Registration...');
  console.log('📡 Sending device token to:', userProfileServiceUrl);
  console.log('📝 Test data:', JSON.stringify(testData, null, 2));

  const req = https.request(options, (res) => {
    console.log(`📊 Status: ${res.statusCode}`);

    let data = '';
    res.on('data', (chunk) => {
      data += chunk;
    });

    res.on('end', () => {
      console.log('📨 Response:', data);

      if (res.statusCode === 200) {
        console.log('✅ Device token registration test completed!');
      } else {
        console.log(
          '❌ Device token registration failed with status:',
          res.statusCode
        );
      }
    });
  });

  req.on('error', (e) => {
    console.error('❌ Error registering device token:', e.message);
  });

  req.write(postData);
  req.end();
};

// Run tests
console.log('🧪 Starting Firebase Push Notification Tests...\n');
testDeviceTokenRegistration();
setTimeout(testNotification, 2000); // Wait 2 seconds between tests
