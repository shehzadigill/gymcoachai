// TEMPORARILY DISABLED - Firebase imports cause NativeEventEmitter errors
// import messaging from '@react-native-firebase/messaging';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import PushNotification from 'react-native-push-notification';

// Disable Firebase messaging temporarily
const messaging: any = null;

class NotificationService {
  constructor() {
    this.configure();
  }

  configure() {
    // Configure react-native-push-notification
    PushNotification.configure({
      // (optional) Called when Token is generated (iOS and Android)
      onRegister: (token) => {
        console.log('TOKEN:', token);
        this.saveToken(token.token);
      },

      // (required) Called when a remote is received or opened, or local notification is opened
      onNotification: (notification) => {
        console.log('NOTIFICATION:', notification);

        if (notification.userInteraction) {
          // User tapped on the notification
          this.handleNotificationTap(notification);
        }

        // Process the notification
        this.processNotification(notification);
      },

      // (optional) Called when Registered Action is pressed and invokeApp is false, if true onNotification will be called (Android)
      onAction: (notification) => {
        console.log('ACTION:', notification.action);
        console.log('NOTIFICATION:', notification);
      },

      // (optional) Called when the user fails to register for remote notifications
      onRegistrationError: (err) => {
        console.error(err.message, err);
      },

      // IOS ONLY (optional): default: all - Permissions to register.
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },

      // Should the initial notification be popped automatically
      popInitialNotification: true,

      // (optional) default: true
      requestPermissions: Platform.OS === 'ios',
    });

    // Create notification channels for Android
    if (Platform.OS === 'android') {
      this.createNotificationChannels();
    }
  }

  createNotificationChannels() {
    // Create channels for different types of notifications
    PushNotification.createChannel(
      {
        channelId: 'nutrition-reminders',
        channelName: 'Nutrition Reminders',
        channelDescription: 'Reminders to log your meals and nutrition',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Nutrition channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'workout-reminders',
        channelName: 'Workout Reminders',
        channelDescription: 'Reminders for scheduled workouts',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Workout channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'progress-updates',
        channelName: 'Progress Updates',
        channelDescription: 'Updates about your fitness progress',
        playSound: true,
        soundName: 'default',
        importance: 3,
        vibrate: false,
      },
      (created) => console.log(`Progress channel created: ${created}`)
    );
  }

  async requestPermissions() {
    try {
      if (Platform.OS === 'android') {
        // Request notification permission for Android 13+
        if (Platform.Version >= 33) {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
          );
          return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
        return true;
      } else {
        // iOS permissions are handled by the configure method
        const authStatus = await messaging().requestPermission();
        const enabled =
          authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
          authStatus === messaging.AuthorizationStatus.PROVISIONAL;
        return enabled;
      }
    } catch (error) {
      console.error('Error requesting notification permissions:', error);
      return false;
    }
  }

  async saveToken(token: string) {
    try {
      await AsyncStorage.setItem('fcm_token', token);
      console.log('FCM token saved:', token);

      // Send token to your backend server here
      // await apiClient.updateDeviceToken(token);
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  async getToken() {
    try {
      const token = await AsyncStorage.getItem('fcm_token');
      return token;
    } catch (error) {
      console.error('Error getting FCM token:', error);
      return null;
    }
  }

  handleNotificationTap(notification: any) {
    // Handle different types of notifications
    switch (notification.data?.type) {
      case 'nutrition_reminder':
        // Navigate to nutrition screen
        // NavigationService.navigate('Nutrition');
        break;
      case 'workout_reminder':
        // Navigate to workouts screen
        // NavigationService.navigate('Workouts');
        break;
      case 'progress_update':
        // Navigate to analytics screen
        // NavigationService.navigate('Analytics');
        break;
      default:
        // Navigate to dashboard
        // NavigationService.navigate('Dashboard');
        break;
    }
  }

  processNotification(notification: any) {
    // Process the notification data
    console.log('Processing notification:', notification);

    // You can update app state, trigger data refresh, etc.
  }

  // Schedule local nutrition reminders
  scheduleNutritionReminders(times: string[]) {
    // Cancel existing nutrition reminders
    this.cancelNutritionReminders();

    times.forEach((time, index) => {
      const [hours, minutes] = time.split(':').map(Number);
      const now = new Date();
      const scheduledTime = new Date();
      scheduledTime.setHours(hours, minutes, 0, 0);

      // If the time has passed today, schedule for tomorrow
      if (scheduledTime <= now) {
        scheduledTime.setDate(scheduledTime.getDate() + 1);
      }

      PushNotification.localNotificationSchedule({
        id: `nutrition_reminder_${index}`,
        channelId: 'nutrition-reminders',
        title: '🍎 Time to log your meal!',
        message: "Don't forget to track your nutrition for optimal health.",
        date: scheduledTime,
        repeatType: 'day',
        data: {
          type: 'nutrition_reminder',
          time: time,
        },
        userInfo: {
          type: 'nutrition_reminder',
          time: time,
        },
      });
    });

    console.log(`Scheduled ${times.length} nutrition reminders`);
  }

  cancelNutritionReminders() {
    // Cancel all nutrition reminder notifications
    PushNotification.cancelAllLocalNotifications();
  }

  // Schedule workout reminders
  scheduleWorkoutReminder(workoutName: string, scheduledTime: Date) {
    const id = `workout_${Date.now()}`;

    PushNotification.localNotificationSchedule({
      id: id,
      channelId: 'workout-reminders',
      title: '💪 Workout Time!',
      message: `Time for your ${workoutName} workout`,
      date: scheduledTime,
      data: {
        type: 'workout_reminder',
        workoutName: workoutName,
      },
      userInfo: {
        type: 'workout_reminder',
        workoutName: workoutName,
      },
    });

    console.log(
      `Scheduled workout reminder for ${workoutName} at ${scheduledTime}`
    );
  }

  // Send progress update notification
  sendProgressNotification(title: string, message: string) {
    const id = `progress_${Date.now()}`;

    PushNotification.localNotification({
      id: id,
      channelId: 'progress-updates',
      title: title,
      message: message,
      data: {
        type: 'progress_update',
      },
      userInfo: {
        type: 'progress_update',
      },
    });

    console.log(`Sent progress notification: ${title}`);
  }

  // Clear all notifications
  clearAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  // Get notification settings from storage
  async getNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem('notification_settings');
      return settings
        ? JSON.parse(settings)
        : {
            workoutReminders: true,
            nutritionReminders: true,
            progressUpdates: true,
            nutritionTimes: ['08:00', '13:00', '19:00'], // Default meal times
          };
    } catch (error) {
      console.error('Error getting notification settings:', error);
      return {
        workoutReminders: true,
        nutritionReminders: true,
        progressUpdates: true,
        nutritionTimes: ['08:00', '13:00', '19:00'],
      };
    }
  }

  // Save notification settings
  async saveNotificationSettings(settings: any) {
    try {
      await AsyncStorage.setItem(
        'notification_settings',
        JSON.stringify(settings)
      );

      // Apply the new settings
      if (settings.nutritionReminders && settings.nutritionTimes) {
        this.scheduleNutritionReminders(settings.nutritionTimes);
      } else {
        this.cancelNutritionReminders();
      }

      console.log('Notification settings saved:', settings);
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }
}

export const notificationService = new NotificationService();
export default notificationService;
