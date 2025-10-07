import React, {useEffect} from 'react';
import {StatusBar, Platform} from 'react-native';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import {AuthProvider, useAuth} from './contexts/AuthContext';
import AppNavigator from './navigation/AppNavigator';
import SplashScreen from './screens/auth/SplashScreen';
import notificationService from './services/notifications';

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
        const hasPermission = await notificationService.initialize();
        if (hasPermission) {
          console.log('Notifications enabled');
        } else {
          console.log('Notifications disabled - permissions denied');
        }
      } catch (error) {
        console.error('Failed to initialize notifications:', error);
      }
    };

    // Initialize notifications after a short delay
    setTimeout(initializeNotifications, 1000);
  }, []);

  if (isLoading) {
    return <SplashScreen />;
  }

  return (
    <>
      <StatusBar
        barStyle={Platform.OS === 'ios' ? 'dark-content' : 'light-content'}
        backgroundColor={Platform.OS === 'android' ? '#000' : undefined}
      />
      <AppNavigator isAuthenticated={isAuthenticated} />
    </>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </QueryClientProvider>
  );
}
