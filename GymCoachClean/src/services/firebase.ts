/**
 * React Native Firebase Configuration
 *
 * Note: React Native Firebase is initialized via native configuration files:
 * - Android: google-services.json
 * - iOS: GoogleService-Info.plist
 *
 * No JavaScript initialization is needed.
 * This file exists only for imports and re-exports.
 */

import messaging from '@react-native-firebase/messaging';

// Re-export messaging for convenience
export {messaging};

// Verify Firebase is initialized
export const checkFirebaseInitialization = () => {
  try {
    // This will throw an error if Firebase is not properly configured
    messaging();
    console.log('✅ Firebase initialized successfully');
    return true;
  } catch (error) {
    console.error('❌ Firebase initialization error:', error);
    return false;
  }
};

// Auto-check on import
checkFirebaseInitialization();
