import { getFCMToken, setupNotificationListener } from './firebase';
import { api } from './api-client';

export class NotificationService {
  private static instance: NotificationService;
  private isInitialized = false;

  private constructor() {}

  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Request notification permission
      if ('Notification' in window) {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          console.warn('Notification permission denied');
          return;
        }
      }

      // Get FCM token
      const token = await getFCMToken();
      if (token) {
        console.log('FCM Token:', token);

        // Save token to backend
        try {
          await api.saveDeviceToken(token, 'web');
          console.log('Device token saved successfully');
        } catch (error) {
          console.error('Failed to save device token:', error);
        }
      }

      // Set up message listener
      setupNotificationListener((payload) => {
        console.log('Message received:', payload);

        // Show notification if app is in foreground
        if (payload.notification) {
          const notification = new Notification(payload.notification.title, {
            body: payload.notification.body,
            icon: '/icon-192x192.png',
          });

          notification.onclick = () => {
            window.focus();
            notification.close();
          };
        }
      });

      this.isInitialized = true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
    }
  }

  public async getToken(): Promise<string | null> {
    return await getFCMToken();
  }

  public async refreshToken(): Promise<string | null> {
    const token = await getFCMToken();
    if (token) {
      try {
        await api.saveDeviceToken(token, 'web');
        console.log('Device token refreshed successfully');
      } catch (error) {
        console.error('Failed to refresh device token:', error);
      }
    }
    return token;
  }
}

export const notificationService = NotificationService.getInstance();
