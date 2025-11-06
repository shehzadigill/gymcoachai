import { initializeApp, getApps } from 'firebase/app';
import {
  getMessaging,
  getToken,
  onMessage,
  isSupported,
} from 'firebase/messaging';

const firebaseConfig = {
  // apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  // authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  // projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  // messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  // appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  apiKey: 'AIzaSyD3MDNNkmFKlWmkJmw8OBZl8sftkTq6aSQ',
  authDomain: 'gymcoach-73528.firebaseapp.com',
  projectId: 'gymcoach-73528',
  storageBucket: 'gymcoach-73528.firebasestorage.app',
  messagingSenderId: '460820256285',
  appId: '1:460820256285:web:7f787f160e7894353b98f4',
  measurementId: 'G-44P0Y1YDHR',
};

const app =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export async function getFCMToken(): Promise<string | null> {
  try {
    const supported = await isSupported();
    if (!supported) {
      return null;
    }

    // Check if we're in a browser environment
    if (typeof window === 'undefined') {
      return null;
    }

    // Wait for service worker to be ready (handled by PWA)
    if ('serviceWorker' in navigator) {
      try {
        await navigator.serviceWorker.ready;
      } catch (error) {
        console.error('Service worker not ready:', error);
        // Continue anyway, Firebase might still work
      }
    }

    const messaging = getMessaging(app);
    const token = await getToken(messaging, {
      vapidKey:
        process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ||
        'BEl62iUYgUivxIkv69yViEuiBIa40HIcFfF7iaW2XgQ',
    });
    return token;
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

export async function setupNotificationListener(
  callback: (payload: any) => void
) {
  const supported = await isSupported();
  if (!supported) return;

  const messaging = getMessaging(app);
  onMessage(messaging, callback);
}

export default app;
