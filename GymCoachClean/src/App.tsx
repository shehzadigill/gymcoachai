import React, {useEffect} from 'react';
import {StatusBar, Platform, I18nManager} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AuthProvider, useAuth} from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import SplashScreen from './screens/auth/SplashScreen';
import {
  registerDeviceToken,
  setupNotificationHandlers,
} from './services/notifications';
import {ThemeProvider} from './theme';
import {LocaleProvider} from './contexts/LocaleContext';
import {SettingsProvider} from './contexts/SettingsContext';
import './i18n';
import './services/firebase'; // Initialize Firebase first

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
  const {isAuthenticated, isLoading} = useAuth();

  useEffect(() => {
    // Initialize notification service
    const initializeNotifications = async () => {
      try {
        console.log('Initializing notification service...');

        // Set up notification handlers
        setupNotificationHandlers();

        // Register device token
        await registerDeviceToken();

        console.log('Notifications initialized successfully');
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
        console.log('App will continue without push notifications');
      }
    };

    // Initialize notifications after a short delay (only if authenticated)
    if (isAuthenticated) {
      setTimeout(initializeNotifications, 1000);
    }
  }, [isAuthenticated]);

  if (isLoading) {
    console.log('[AppContent] Loading auth state -> showing SplashScreen');
    return <SplashScreen />;
  }

  return (
    <>
      {console.log('[AppContent] Render with state:', {isAuthenticated})}
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={Platform.OS === 'android' ? '#000' : undefined}
      />
      <AppNavigator isAuthenticated={isAuthenticated} />
    </>
  );
}

export default function App() {
  console.log('[App] Mounting providers');
  return (
    <QueryClientProvider client={queryClient}>
      <LocaleProvider>
        <ThemeProvider>
          <SettingsProvider>
            <AuthProvider>
              <AppContent />
            </AuthProvider>
          </SettingsProvider>
        </ThemeProvider>
      </LocaleProvider>
    </QueryClientProvider>
  );
}
