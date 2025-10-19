const https = require('https');

// Test notification with proper authentication
const testNotificationWithAuth = async () => {
  const notificationServiceUrl =
    'https://2bapmwpgyh5ownhk622ycoku7e0odhfw.lambda-url.eu-north-1.on.aws';

  // You'll need to get a real JWT token from your auth service
  // For now, let's test the endpoints without auth to see what we get
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
    hostname: '2bapmwpgyh5ownhk622ycoku7e0odhfw.lambda-url.eu-north-1.on.aws',
    port: 443,
    path: '/api/notifications/send',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      // 'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
    },
  };

  console.log('🚀 Testing Firebase Push Notifications (with auth)...');
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
      } else if (res.statusCode === 401) {
        console.log(
          '🔐 Authentication required - this is expected without a valid JWT token'
        );
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

// Test device token registration with proper endpoint
const testDeviceTokenRegistration = async () => {
  const userProfileServiceUrl =
    'https://tsqeldyalolwbzkub6v6dybbbi0lfavi.lambda-url.eu-north-1.on.aws';

  const testData = {
    token: 'test-device-token-12345',
    platform: 'web',
  };

  const postData = JSON.stringify(testData);

  const options = {
    hostname: 'tsqeldyalolwbzkub6v6dybbbi0lfavi.lambda-url.eu-north-1.on.aws',
    port: 443,
    path: '/api/user-profiles/device-token',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(postData),
      // 'Authorization': 'Bearer YOUR_JWT_TOKEN_HERE'
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
      } else if (res.statusCode === 401) {
        console.log(
          '🔐 Authentication required - this is expected without a valid JWT token'
        );
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

// Test web app Firebase integration
const testWebAppFirebase = () => {
  console.log('\n🌐 Testing Web App Firebase Integration...');
  console.log('📁 Environment file created: apps/web/.env.local');
  console.log(
    '🔑 VAPID Key set:',
    process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'Not set in this context'
  );
  console.log('📱 To test web notifications:');
  console.log('   1. Start the web app: cd apps/web && npm run dev');
  console.log('   2. Open http://localhost:3000');
  console.log('   3. Check browser console for Firebase initialization');
  console.log(
    '   4. Look for "Notifications initialized successfully" message'
  );
};

// Test mobile app Firebase integration
const testMobileAppFirebase = () => {
  console.log('\n📱 Testing Mobile App Firebase Integration...');
  console.log('📁 Firebase config files:');
  console.log(
    '   - Android: GymCoachClean/android/app/google-services.json ✅'
  );
  console.log(
    '   - iOS: GymCoachClean/ios/GoogleService-Info.plist (needs to be added)'
  );
  console.log('📱 To test mobile notifications:');
  console.log('   1. Run: cd GymCoachClean && npx react-native run-ios');
  console.log('   2. Check console logs for device token registration');
  console.log(
    '   3. Look for "Notifications initialized successfully" message'
  );
};

// Run all tests
console.log('🧪 Starting Complete Firebase Push Notification Tests...\n');

// Test endpoints (will show auth required)
testDeviceTokenRegistration();
setTimeout(testNotificationWithAuth, 2000);

// Show integration status
setTimeout(testWebAppFirebase, 4000);
setTimeout(testMobileAppFirebase, 6000);
