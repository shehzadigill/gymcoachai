import React, { useEffect } from 'react';
import { StatusBar, Platform } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppNavigator from './navigation/WorkingAppNavigator';
import SplashScreen from './screens/auth/SplashScreen';
import notificationService from './services/safeNotifications';

// Create a query client for React Query
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000, // 5 minutes
    },
  },
});

function AppContent() {
  const { isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Initialize notification service with delay to avoid registration issues
    const initializeNotifications = async () => {
      try {
        // Add longer delay to ensure app is fully registered first
        setTimeout(async () => {
          try {
            console.log('Initializing notification service...');
            const hasPermission =
              await notificationService.requestPermissions();
            if (hasPermission) {
              console.log('Notification permissions granted');

              // Load and apply notification settings
              const settings =
                await notificationService.getNotificationSettings();
              if (settings.nutritionReminders && settings.nutritionTimes) {
                notificationService.scheduleNutritionReminders(
                  settings.nutritionTimes
                );
              }
            } else {
              console.log('Notification permissions denied');
            }
          } catch (error) {
            console.error('Error initializing notifications:', error);
            // Continue without notifications
          }
        }, 5000); // 5 second delay to ensure full app initialization
      } catch (error) {
        console.error('Error setting up notifications:', error);
      }
    };

    if (isAuthenticated && !isLoading) {
      initializeNotifications();
    }
  }, [isAuthenticated, isLoading]);

  if (isLoading) {
    return <SplashScreen />; // Show splash screen while loading
  }

  return <AppNavigator isAuthenticated={isAuthenticated} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <StatusBar
          barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
          backgroundColor="#3b82f6"
        />
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
