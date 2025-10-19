import messaging from '@react-native-firebase/messaging';
import apiClient from './api';
import './firebase'; // Initialize Firebase first

export async function requestNotificationPermission() {
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;
  return enabled;
}

export async function getFCMToken() {
  const token = await messaging().getToken();
  return token;
}

export async function registerDeviceToken() {
  try {
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Notification permission denied');
      return;
    }

    const token = await getFCMToken();
    if (token) {
      try {
        await apiClient.saveDeviceToken(token, 'mobile');
        console.log(
          'Device token registered successfully:',
          token.substring(0, 20) + '...',
        );
      } catch (error) {
        console.error('Failed to register device token:', error);
      }
    } else {
      console.log('No FCM token available');
    }
  } catch (error) {
    console.error('Error in registerDeviceToken:', error);
  }
}

export function setupNotificationHandlers() {
  // Foreground messages
  messaging().onMessage(async remoteMessage => {
    console.log('Foreground notification:', remoteMessage);
    // You can show a local notification or update UI here
  });

  // Background/quit state messages
  messaging().setBackgroundMessageHandler(async remoteMessage => {
    console.log('Background notification:', remoteMessage);
  });
}

export function onTokenRefresh(callback: (token: string) => void) {
  messaging().onTokenRefresh(callback);
}
