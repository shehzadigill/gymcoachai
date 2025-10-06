import AsyncStorage from '@react-native-async-storage/async-storage';
import { PermissionsAndroid, Platform, Alert } from 'react-native';
import PushNotification from 'react-native-push-notification';

// Disable Firebase completely until proper configuration is added
// This prevents NativeEventEmitter errors when config files are not properly set up
let firebaseApp: any = null;
let messaging: any = null;

// Temporarily disable Firebase to prevent NativeEventEmitter errors
const FIREBASE_ENABLED = false; // Set to true once real config files are added

if (FIREBASE_ENABLED) {
  try {
    // NOTE: Firebase packages must be installed for this to work
    // Currently Firebase packages are removed to prevent NativeEventEmitter errors
    console.log('Firebase is enabled but packages not installed');
    firebaseApp = null;
    messaging = null;
  } catch (error) {
    console.warn(
      'Firebase not available, using local notifications only:',
      error
    );
    firebaseApp = null;
    messaging = null;
  }
} else {
  console.log(
    'Firebase disabled - using local notifications only until proper config is added'
  );
  firebaseApp = null;
  messaging = null;
}

class SafeNotificationService {
  private isFirebaseAvailable = false;

  constructor() {
    this.initialize();
  }

  private async initialize() {
    try {
      console.log('SafeNotificationService: Starting initialization...');

      // Always configure local notifications first (guaranteed to work)
      this.configureLocalOnly();

      // Skip Firebase completely until proper configuration is added
      if (FIREBASE_ENABLED && messaging && firebaseApp) {
        console.log('Firebase enabled, attempting initialization...');
        this.isFirebaseAvailable = true;
        this.configure();
      } else {
        console.log('Firebase disabled - using local notifications only');
        this.isFirebaseAvailable = false;
      }
    } catch (error) {
      console.warn(
        'Notification service initialization failed, using local notifications only:',
        error
      );
      this.isFirebaseAvailable = false;
    }
  }

  private configure() {
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
      // default: true
      popInitialNotification: true,

      // (optional) default: true
      // - Specified if permissions (ios) and token (android and ios) will requested or not,
      // - if not, you must call PushNotificationsHandler.requestPermissions() later
      // - if you are not using remote notification or do not have Firebase installed, use this:
      //     requestPermissions: Platform.OS === 'ios'
      requestPermissions: Platform.OS === 'ios',
    });

    if (this.isFirebaseAvailable) {
      this.setupFirebaseMessaging();
    }
  }

  private configureLocalOnly() {
    // Configure for local notifications only
    PushNotification.configure({
      onRegister: (token) => {
        console.log('Local TOKEN:', token);
      },
      onNotification: (notification) => {
        console.log('Local NOTIFICATION:', notification);
        if (notification.userInteraction) {
          this.handleNotificationTap(notification);
        }
        this.processNotification(notification);
      },
      permissions: {
        alert: true,
        badge: true,
        sound: true,
      },
      popInitialNotification: true,
      requestPermissions: Platform.OS === 'ios',
    });
  }

  private async setupFirebaseMessaging() {
    // Only setup Firebase messaging if explicitly enabled and properly configured
    if (!FIREBASE_ENABLED || !messaging) {
      console.log(
        'Firebase messaging setup skipped - not enabled or not available'
      );
      return;
    }

    try {
      console.log('Setting up Firebase messaging...');

      // Create channels for different types of notifications
      this.createNotificationChannels();

      // Firebase messaging handlers will be set up only when enabled
      // This prevents any NativeEventEmitter issues with placeholder configs
      console.log(
        'Firebase messaging setup deferred until proper configuration is added'
      );
    } catch (error) {
      console.warn('Firebase messaging setup failed:', error);
    }
  }

  private createNotificationChannels() {
    PushNotification.createChannel(
      {
        channelId: 'workout-reminders',
        channelName: 'Workout Reminders',
        channelDescription: 'Notifications for workout reminders',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Workout channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'nutrition-reminders',
        channelName: 'Nutrition Reminders',
        channelDescription: 'Notifications for nutrition tracking',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Nutrition channel created: ${created}`)
    );

    PushNotification.createChannel(
      {
        channelId: 'progress-updates',
        channelName: 'Progress Updates',
        channelDescription: 'Notifications for progress milestones',
        playSound: true,
        soundName: 'default',
        importance: 4,
        vibrate: true,
      },
      (created) => console.log(`Progress channel created: ${created}`)
    );
  }

  async requestPermissions(): Promise<boolean> {
    try {
      if (Platform.OS === 'android') {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } else {
        // iOS permissions are handled by PushNotification.configure
        return true;
      }
    } catch (error) {
      console.error('Permission request failed:', error);
      return false;
    }
  }

  private async saveToken(token: string) {
    try {
      await AsyncStorage.setItem('fcm_token', token);
    } catch (error) {
      console.error('Error saving FCM token:', error);
    }
  }

  private handleNotificationTap(notification: any) {
    console.log('Notification tapped:', notification);
    // Handle navigation based on notification type
    // You can implement deep linking here
  }

  private processNotification(notification: any) {
    // Handle different types of notifications
    console.log('Processing notification:', notification);
  }

  private handleRemoteMessage(remoteMessage: any) {
    // Handle FCM messages
    PushNotification.localNotification({
      title: remoteMessage.notification?.title || 'GymCoach AI',
      message: remoteMessage.notification?.body || 'New notification',
      channelId: remoteMessage.data?.channelId || 'default',
    });
  }

  // Public methods
  sendProgressNotification(title: string, message: string) {
    PushNotification.localNotification({
      title,
      message,
      channelId: 'progress-updates',
      playSound: true,
      soundName: 'default',
    });
  }

  scheduleNutritionReminders(times: string[]) {
    // Cancel existing nutrition reminders
    PushNotification.cancelAllLocalNotifications();

    times.forEach((time, index) => {
      const [hours, minutes] = time.split(':').map(Number);
      const now = new Date();
      const scheduledDate = new Date();
      scheduledDate.setHours(hours, minutes, 0, 0);

      // If the time has passed today, schedule for tomorrow
      if (scheduledDate <= now) {
        scheduledDate.setDate(scheduledDate.getDate() + 1);
      }

      PushNotification.localNotificationSchedule({
        id: `nutrition-${index}`,
        title: '🍽️ Meal Time!',
        message:
          "Don't forget to log your meal and stay on track with your nutrition goals.",
        date: scheduledDate,
        channelId: 'nutrition-reminders',
        repeatType: 'day',
      });
    });
  }

  cancelNutritionReminders() {
    // Cancel all nutrition reminder notifications
    PushNotification.cancelAllLocalNotifications();
  }

  scheduleWorkoutReminder(time: string, workoutName?: string) {
    const [hours, minutes] = time.split(':').map(Number);
    const now = new Date();
    const scheduledDate = new Date();
    scheduledDate.setHours(hours, minutes, 0, 0);

    if (scheduledDate <= now) {
      scheduledDate.setDate(scheduledDate.getDate() + 1);
    }

    PushNotification.localNotificationSchedule({
      id: 'workout-reminder',
      title: '💪 Workout Time!',
      message: workoutName
        ? `Time for your ${workoutName} workout!`
        : "Ready to crush your workout? Let's get moving!",
      date: scheduledDate,
      channelId: 'workout-reminders',
      repeatType: 'day',
    });
  }

  // Clear all notifications
  clearAllNotifications() {
    PushNotification.cancelAllLocalNotifications();
  }

  // Settings management
  async getNotificationSettings() {
    try {
      const settings = await AsyncStorage.getItem('notification_settings');
      return settings
        ? JSON.parse(settings)
        : {
            workoutReminders: false,
            nutritionReminders: false,
            progressUpdates: true,
            socialUpdates: false,
          };
    } catch (error) {
      console.error('Error loading notification settings:', error);
      return {
        workoutReminders: false,
        nutritionReminders: false,
        progressUpdates: true,
        socialUpdates: false,
      };
    }
  }

  async saveNotificationSettings(settings: any) {
    try {
      await AsyncStorage.setItem(
        'notification_settings',
        JSON.stringify(settings)
      );
    } catch (error) {
      console.error('Error saving notification settings:', error);
    }
  }
}

export const notificationService = new SafeNotificationService();
export default notificationService;
