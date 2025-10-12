import { initializeApp } from 'firebase/app';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'YOUR_API_KEY',
  authDomain:
    process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ||
    'YOUR_PROJECT_ID.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'YOUR_PROJECT_ID',
  storageBucket:
    process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
    'YOUR_PROJECT_ID.appspot.com',
  messagingSenderId:
    process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || 'YOUR_SENDER_ID',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || 'YOUR_APP_ID',
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Cloud Messaging and get a reference to the service
let messaging: any = null;

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  messaging = getMessaging(app);
}

export { messaging };

export const requestNotificationPermission = async (): Promise<
  string | null
> => {
  if (!messaging) {
    console.warn('Firebase messaging not available');
    return null;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey:
          process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || 'YOUR_VAPID_KEY',
      });
      console.log('FCM Token:', token);
      return token;
    } else {
      console.log('Notification permission denied');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
};

export const onMessageListener = () => {
  if (!messaging) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    onMessage(messaging, (payload) => {
      console.log('Message received:', payload);
      resolve(payload);
    });
  });
};

export default app;
