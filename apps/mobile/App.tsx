import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useCallback, useEffect, useState } from 'react';
import { Text, View, TextInput, TouchableOpacity } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Amplify } from 'aws-amplify';
import {
  signIn as cognitoSignIn,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';

// Import screens
import { DashboardScreen } from './src/screens/DashboardScreen';
import { WorkoutsScreen } from './src/screens/WorkoutsScreen';
import { AnalyticsScreen } from './src/screens/AnalyticsScreen';
import { NutritionScreen } from './src/screens/NutritionScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();
const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

// Basic Amplify Auth config using Expo public envs
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_USER_POOL_ID,
      userPoolClientId: process.env.EXPO_PUBLIC_USER_POOL_CLIENT_ID,
      loginWith: {
        email: true,
        username: true,
      },
      region: process.env.EXPO_PUBLIC_AWS_REGION || 'eu-north-1',
    },
  },
});

// Web-compatible storage functions
async function getAccessToken() {
  if (Platform.OS === 'web') {
    return localStorage.getItem('access_token');
  }
  return SecureStore.getItemAsync('access_token');
}

async function setAccessToken(token: string) {
  if (Platform.OS === 'web') {
    localStorage.setItem('access_token', token);
    return;
  }
  await SecureStore.setItemAsync('access_token', token);
}

async function clearAccessToken() {
  if (Platform.OS === 'web') {
    localStorage.removeItem('access_token');
    return;
  }
  await SecureStore.deleteItemAsync('access_token');
}

// Screens are now imported from separate files

function TabsNav({ onSignOut }: { onSignOut: () => void }) {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarStyle: {
          backgroundColor: '#ffffff',
          borderTopColor: '#e5e7eb',
        },
        tabBarActiveTintColor: '#3b82f6',
        tabBarInactiveTintColor: '#6b7280',
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarIcon: () => <Text className="text-lg">🏠</Text>,
        }}
      />
      <Tab.Screen
        name="Workouts"
        component={WorkoutsScreen}
        options={{
          tabBarIcon: () => <Text className="text-lg">💪</Text>,
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsScreen}
        options={{
          tabBarIcon: () => <Text className="text-lg">📊</Text>,
        }}
      />
      <Tab.Screen
        name="Nutrition"
        component={NutritionScreen}
        options={{
          tabBarIcon: () => <Text className="text-lg">🍎</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        options={{
          tabBarIcon: () => <Text className="text-lg">👤</Text>,
        }}
      >
        {() => <ProfileScreen onSignOut={onSignOut} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

function SignInScreen({ onSignedIn }: { onSignedIn: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignIn = async () => {
    setLoading(true);
    setError(null);
    try {
      if (!email || !password) throw new Error('Enter email and password');
      await cognitoSignIn({ username: email, password });
      // extract JWT from current session
      const session = await fetchAuthSession();
      const jwt =
        session.tokens?.idToken?.toString() ||
        session.tokens?.accessToken?.toString();
      if (!jwt) throw new Error('No token in session');
      await setAccessToken(jwt);
      onSignedIn();
    } catch (e: any) {
      setError(e?.message || 'Sign-in failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View className="flex-1 items-center justify-center px-6">
      <Text className="text-2xl font-semibold mb-6">Sign In</Text>
      <View className="w-full">
        <TextInput
          placeholder="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          className="border border-gray-300 rounded px-3 py-2 mb-3"
        />
        <TextInput
          placeholder="Password"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          className="border border-gray-300 rounded px-3 py-2 mb-3"
        />
        {error ? <Text className="text-red-500 mb-3">{error}</Text> : null}
        <TouchableOpacity
          onPress={handleSignIn}
          disabled={loading}
          className="bg-blue-600 rounded px-4 py-3"
        >
          <Text className="text-white font-semibold text-center">
            {loading ? 'Signing in...' : 'Sign In'}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function App() {
  const [appIsReady, setAppIsReady] = useState(false);
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    (async () => {
      const token = await getAccessToken();
      setIsAuthed(!!token);
      setAppIsReady(true);
    })();
  }, []);

  const onLayoutRootView = useCallback(async () => {
    if (appIsReady) {
      await SplashScreen.hideAsync();
    }
  }, [appIsReady]);

  const handleSignedIn = async () => {
    setIsAuthed(true);
  };

  const handleSignOut = async () => {
    await clearAccessToken();
    setIsAuthed(false);
  };

  if (!appIsReady || isAuthed === null) {
    return null;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <View className="flex-1" onLayout={onLayoutRootView}>
        <NavigationContainer theme={DefaultTheme}>
          <StatusBar style="auto" />
          <Stack.Navigator screenOptions={{ headerShown: false }}>
            {isAuthed ? (
              <Stack.Screen name="Main">
                {() => <TabsNav onSignOut={handleSignOut} />}
              </Stack.Screen>
            ) : (
              <Stack.Screen name="Auth">
                {() => <SignInScreen onSignedIn={handleSignedIn} />}
              </Stack.Screen>
            )}
          </Stack.Navigator>
        </NavigationContainer>
      </View>
    </QueryClientProvider>
  );
}
