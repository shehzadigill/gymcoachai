import AsyncStorage from '@react-native-async-storage/async-storage';
import {PermissionsAndroid, Platform, Alert} from 'react-native';

class NotificationService {
  private settings: any = {
    enabled: true,
    workoutReminders: true,
    nutritionReminders: true,
    progressUpdates: true,
  };

  constructor() {
    this.configure();
  }

  configure() {
    console.log('Notification service configured (local only)');
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
    return true; // iOS permissions handled automatically
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('Initializing notification service...');
      const hasPermission = await this.requestPermissions();

      if (hasPermission) {
        console.log('Notifications initialized successfully');
        return true;
      } else {
        console.log('Notification permissions denied');
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize notifications:', error);
      return false;
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
    // Return a mock token for now
    return 'local-device-token';
  }

  // Additional methods required by the screens
  async sendProgressNotification(title: string, message: string) {
    console.log(`Progress notification: ${title} - ${message}`);
    Alert.alert(title, message);
  }

  async getNotificationSettings() {
    // Load from AsyncStorage or return defaults
    try {
      const stored = await AsyncStorage.getItem('notification_settings');
      return stored ? JSON.parse(stored) : this.settings;
    } catch (error) {
      console.warn('Failed to load notification settings:', error);
      return this.settings;
    }
  }

  async saveNotificationSettings(settings: any) {
    try {
      this.settings = {...this.settings, ...settings};
      await AsyncStorage.setItem(
        'notification_settings',
        JSON.stringify(this.settings),
      );
      console.log('Notification settings saved:', this.settings);
    } catch (error) {
      console.error('Failed to save notification settings:', error);
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
}

const notificationService = new NotificationService();
export default notificationService;
