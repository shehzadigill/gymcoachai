import { requestNotificationPermission, onMessageListener } from './firebase';
import { apiClient } from './api-client';

interface NotificationSettings {
  enabled: boolean;
  workoutReminders: boolean;
  nutritionReminders: boolean;
  progressUpdates: boolean;
  achievements: boolean;
  aiSuggestions: boolean;
  workoutReminderTime?: string;
  nutritionReminderTimes?: string[];
  timezone?: string;
}

interface DeviceInfo {
  deviceId: string;
  deviceToken: string;
  platform: string;
  deviceName: string;
  isActive: boolean;
}

class WebNotificationService {
  private settings: NotificationSettings = {
    enabled: true,
    workoutReminders: true,
    nutritionReminders: true,
    progressUpdates: true,
    achievements: true,
    aiSuggestions: true,
    workoutReminderTime: '08:00',
    nutritionReminderTimes: ['08:00', '13:00', '19:00'],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };

  private deviceInfo: DeviceInfo | null = null;
  private isInitialized = false;

  constructor() {
    this.configure();
  }

  configure() {
    console.log('Web notification service configured');
  }

  async initialize(): Promise<boolean> {
    if (this.isInitialized) {
      return true;
    }

    try {
      console.log('Initializing web notification service...');

      // Check if notifications are supported
      if (!('Notification' in window)) {
        console.warn('This browser does not support notifications');
        return false;
      }

      // Request permission and get FCM token
      const token = await requestNotificationPermission();
      if (!token) {
        console.log('Failed to get FCM token');
        return false;
      }

      // Get device info
      const deviceInfo = await this.getDeviceInfo(token);
      this.deviceInfo = deviceInfo;

      // Register device with backend
      await this.registerDevice(deviceInfo);

      // Set up message listener
      this.setupMessageListener();

      this.isInitialized = true;
      console.log('Web notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize web notifications:', error);
      return false;
    }
  }

  private async getDeviceInfo(token: string): Promise<DeviceInfo> {
    const deviceId =
      localStorage.getItem('device_id') || this.generateDeviceId();
    localStorage.setItem('device_id', deviceId);

    return {
      deviceId,
      deviceToken: token,
      platform: 'web',
      deviceName: this.getDeviceName(),
      isActive: true,
    };
  }

  private generateDeviceId(): string {
    return 'web_' + Math.random().toString(36).substr(2, 9) + '_' + Date.now();
  }

  private getDeviceName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Chrome')) return 'Chrome Browser';
    if (userAgent.includes('Firefox')) return 'Firefox Browser';
    if (userAgent.includes('Safari')) return 'Safari Browser';
    if (userAgent.includes('Edge')) return 'Edge Browser';
    return 'Web Browser';
  }

  private async registerDevice(deviceInfo: DeviceInfo): Promise<void> {
    try {
      await apiClient.post('/notifications/devices/register', {
        device_token: deviceInfo.deviceToken,
        platform: deviceInfo.platform,
        device_name: deviceInfo.deviceName,
      });
      console.log('Device registered successfully');
    } catch (error) {
      console.error('Failed to register device:', error);
    }
  }

  private setupMessageListener(): void {
    onMessageListener().then((payload: any) => {
      if (payload) {
        console.log('Message received:', payload);
        this.handleNotification(payload);
      }
    });
  }

  private handleNotification(payload: any): void {
    const { notification, data } = payload;

    if (notification) {
      // Show browser notification
      const notificationOptions: NotificationOptions = {
        body: notification.body,
        icon: '/icon-192x192.png',
        badge: '/icon-192x192.png',
        tag: data?.notificationId || 'default',
        data: data,
        actions: [
          {
            action: 'open',
            title: 'Open App',
          },
          {
            action: 'dismiss',
            title: 'Dismiss',
          },
        ],
      };

      const browserNotification = new Notification(
        notification.title,
        notificationOptions
      );

      browserNotification.onclick = () => {
        this.handleNotificationClick(data);
        browserNotification.close();
      };
    }
  }

  private handleNotificationClick(data: any): void {
    if (!data) return;

    // Handle different notification types
    switch (data.action) {
      case 'start_workout':
        window.location.href = '/workouts';
        break;
      case 'log_meal':
        window.location.href = '/nutrition';
        break;
      case 'log_water':
        window.location.href = '/nutrition?tab=water';
        break;
      case 'take_progress_photo':
        window.location.href = '/progress';
        break;
      case 'view_achievement':
        window.location.href = '/achievements';
        break;
      case 'view_suggestion':
        window.location.href = '/ai-trainer';
        break;
      default:
        console.log('Unknown notification action:', data.action);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await requestNotificationPermission();
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const stored = localStorage.getItem('notification_settings');
      return stored ? JSON.parse(stored) : this.settings;
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
      return this.settings;
    }
  }

  async saveNotificationSettings(
    settings: Partial<NotificationSettings>
  ): Promise<void> {
    try {
      this.settings = { ...this.settings, ...settings };
      localStorage.setItem(
        'notification_settings',
        JSON.stringify(this.settings)
      );

      // Update preferences on backend
      await this.updateBackendPreferences();

      console.log('Notification settings saved:', this.settings);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
    }
  }

  private async updateBackendPreferences(): Promise<void> {
    try {
      await apiClient.put('/notifications/preferences', {
        preferences: this.settings,
      });
      console.log('Backend preferences updated');
    } catch (error) {
      console.error('Failed to update backend preferences:', error);
    }
  }

  async sendTestNotification(): Promise<void> {
    try {
      await apiClient.post('/notifications/send', {
        notification_type: 'test',
        title: 'Test Notification',
        body: 'This is a test notification from GymCoach AI',
        data: {
          action: 'test',
          category: 'test',
        },
      });
      console.log('Test notification sent');
    } catch (error) {
      console.error('Failed to send test notification:', error);
    }
  }

  async cleanup(): Promise<void> {
    // Cleanup any listeners or resources
    console.log('Web notification service cleaned up');
  }
}

export const webNotificationService = new WebNotificationService();
export default webNotificationService;
