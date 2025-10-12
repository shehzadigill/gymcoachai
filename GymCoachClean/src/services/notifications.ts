import AsyncStorage from '@react-native-async-storage/async-storage';
import {PermissionsAndroid, Platform, Alert} from 'react-native';
import messaging from '@react-native-firebase/messaging';
import {v4 as uuidv4} from 'uuid';
import {api} from './api';

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

class NotificationService {
  private settings: NotificationSettings = {
    enabled: true,
    workoutReminders: true,
    nutritionReminders: true,
    progressUpdates: true,
    achievements: true,
    aiSuggestions: true,
    workoutReminderTime: '08:00',
    nutritionReminderTimes: ['08:00', '13:00', '19:00'],
    timezone: 'UTC',
  };

  private deviceInfo: DeviceInfo | null = null;
  private unsubscribeTokenRefresh: (() => void) | null = null;
  private unsubscribeMessage: (() => void) | null = null;

  constructor() {
    this.configure();
  }

  configure() {
    console.log('Notification service configured with FCM');
  }

  async requestPermissions(): Promise<boolean> {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS,
          {
            title: 'Notification Permission',
            message: 'This app needs permission to send notifications',
            buttonNeutral: 'Ask Me Later',
            buttonNegative: 'Cancel',
            buttonPositive: 'OK',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('Failed to request notification permission:', err);
        return false;
      }
    }

    // For iOS, request permission through Firebase
    try {
      const authStatus = await messaging().requestPermission();
      const enabled =
        authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
        authStatus === messaging.AuthorizationStatus.PROVISIONAL;

      if (enabled) {
        console.log('Authorization status:', authStatus);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Failed to request permission:', error);
      return false;
    }
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing notification service...');

      // Request permissions
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        console.log('Notification permissions denied');
        return false;
      }

      // Get FCM token
      const token = await messaging().getToken();
      if (!token) {
        console.error('Failed to get FCM token');
        return false;
      }

      console.log('FCM Token:', token);

      // Get device info
      const deviceInfo = await this.getDeviceInfo(token);
      this.deviceInfo = deviceInfo;

      // Register device with backend
      await this.registerDevice(deviceInfo);

      // Set up message handlers
      this.setupMessageHandlers();

      // Set up token refresh handler
      this.setupTokenRefreshHandler();

      console.log('Notifications initialized successfully');
      return true;
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
    }
  }

  private async getDeviceInfo(token: string): Promise<DeviceInfo> {
    const deviceId = (await AsyncStorage.getItem('device_id')) || uuidv4();
    await AsyncStorage.setItem('device_id', deviceId);

    return {
      deviceId,
      deviceToken: token,
      platform: Platform.OS,
      deviceName: `${Platform.OS} Device`,
      isActive: true,
    };
  }

  private async registerDevice(deviceInfo: DeviceInfo): Promise<void> {
    try {
      await api.post('/notifications/devices/register', {
        device_token: deviceInfo.deviceToken,
        platform: deviceInfo.platform,
        device_name: deviceInfo.deviceName,
      });
      console.log('Device registered successfully');
    } catch (error) {
      console.error('Failed to register device:', error);
    }
  }

  private setupMessageHandlers(): void {
    // Handle background messages
    messaging().setBackgroundMessageHandler(async remoteMessage => {
      console.log('Message handled in the background!', remoteMessage);
    });

    // Handle foreground messages
    this.unsubscribeMessage = messaging().onMessage(async remoteMessage => {
      console.log('A new FCM message arrived!', remoteMessage);

      // Show local notification
      Alert.alert(
        remoteMessage.notification?.title || 'Notification',
        remoteMessage.notification?.body || 'You have a new notification',
        [
          {
            text: 'OK',
            onPress: () => {
              // Handle notification tap
              this.handleNotificationTap(remoteMessage);
            },
          },
        ],
      );
    });

    // Handle notification tap when app is in background/quit
    messaging().onNotificationOpenedApp(remoteMessage => {
      console.log(
        'Notification caused app to open from background state:',
        remoteMessage,
      );
      this.handleNotificationTap(remoteMessage);
    });

    // Handle notification tap when app is quit
    messaging()
      .getInitialNotification()
      .then(remoteMessage => {
        if (remoteMessage) {
          console.log(
            'Notification caused app to open from quit state:',
            remoteMessage,
          );
          this.handleNotificationTap(remoteMessage);
        }
      });
  }

  private setupTokenRefreshHandler(): void {
    this.unsubscribeTokenRefresh = messaging().onTokenRefresh(async token => {
      console.log('FCM token refreshed:', token);

      if (this.deviceInfo) {
        this.deviceInfo.deviceToken = token;
        await this.updateDeviceToken(token);
      }
    });
  }

  private async updateDeviceToken(newToken: string): Promise<void> {
    if (!this.deviceInfo) return;

    try {
      await api.put(`/notifications/devices/${this.deviceInfo.deviceId}`, {
        device_token: newToken,
      });
      console.log('Device token updated successfully');
    } catch (error) {
      console.error('Failed to update device token:', error);
    }
  }

  private handleNotificationTap(remoteMessage: any): void {
    const data = remoteMessage.data;
    if (!data) return;

    // Handle different notification types
    switch (data.action) {
      case 'start_workout':
        // Navigate to workout screen
        console.log('Navigate to workout screen');
        break;
      case 'log_meal':
        // Navigate to nutrition screen
        console.log('Navigate to nutrition screen');
        break;
      case 'log_water':
        // Navigate to nutrition screen with water focus
        console.log('Navigate to nutrition screen for water logging');
        break;
      case 'take_progress_photo':
        // Navigate to progress photos
        console.log('Navigate to progress photos');
        break;
      case 'view_achievement':
        // Navigate to achievements
        console.log('Navigate to achievements');
        break;
      case 'view_suggestion':
        // Navigate to AI trainer
        console.log('Navigate to AI trainer');
        break;
      default:
        console.log('Unknown notification action:', data.action);
    }
  }

  async scheduleLocalNotification(
    title: string,
    message: string,
    delay: number = 0,
  ) {
    // For now, just log the notification
    console.log(
      `Scheduled notification: ${title} - ${message} (delay: ${delay}ms)`,
    );

    if (delay > 0) {
      setTimeout(() => {
        Alert.alert(title, message);
      }, delay);
    } else {
      Alert.alert(title, message);
    }
  }

  async getToken(): Promise<string | null> {
    try {
      return await messaging().getToken();
    } catch (error) {
      console.error('Failed to get FCM token:', error);
      return null;
    }
  }

  async sendProgressNotification(title: string, message: string) {
    console.log(`Progress notification: ${title} - ${message}`);
    Alert.alert(title, message);
  }

  async getNotificationSettings(): Promise<NotificationSettings> {
    try {
      const stored = await AsyncStorage.getItem('notification_settings');
      return stored ? JSON.parse(stored) : this.settings;
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
      return this.settings;
    }
  }

  async saveNotificationSettings(settings: Partial<NotificationSettings>) {
    try {
      this.settings = {...this.settings, ...settings};
      await AsyncStorage.setItem(
        'notification_settings',
        JSON.stringify(this.settings),
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
      await api.put('/notifications/preferences', {
        preferences: this.settings,
      });
      console.log('Backend preferences updated');
    } catch (error) {
      console.error('Failed to update backend preferences:', error);
    }
  }

  async scheduleNutritionReminders(reminders: any[]) {
    console.log('Scheduling nutrition reminders:', reminders);
    // For now, just log the reminders
    reminders.forEach((reminder, index) => {
      console.log(`Nutrition reminder ${index + 1}:`, reminder);
    });
  }

  async cancelNutritionReminders() {
    console.log('Cancelling nutrition reminders');
    // For now, just log the cancellation
  }

  async cleanup(): Promise<void> {
    if (this.unsubscribeTokenRefresh) {
      this.unsubscribeTokenRefresh();
    }
    if (this.unsubscribeMessage) {
      this.unsubscribeMessage();
    }
  }
}

const notificationService = new NotificationService();
export default notificationService;
