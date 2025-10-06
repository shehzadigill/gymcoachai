import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { User, UserProfile } from '../types';

interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) => Promise<void>;
  confirmSignUp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
  updateProfile: (data: Partial<UserProfile>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  useEffect(() => {
    // Simulate checking for existing session
    const checkAuthState = async () => {
      try {
        const storedUser = await AsyncStorage.getItem('user');
        const storedProfile = await AsyncStorage.getItem('userProfile');

        if (storedUser) {
          setUser(JSON.parse(storedUser));
        }
        if (storedProfile) {
          setUserProfile(JSON.parse(storedProfile));
        }
      } catch (error) {
        console.error('Error checking auth state:', error);
      } finally {
        // Add a delay to show the beautiful splash screen
        setTimeout(() => {
          setIsLoading(false);
        }, 2000);
      }
    };

    checkAuthState();
  }, []);

  const handleSignIn = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const mockUser: User = {
        id: '1',
        email,
      };

      const mockProfile: UserProfile = {
        id: '1',
        userId: '1',
        firstName: 'Demo',
        lastName: 'User',
        birthDate: '1990-01-01',
        gender: 'other',
        height: 175,
        weight: 70,
        goals: ['weight_loss'],
        fitnessLevel: 'intermediate',
        preferences: {
          units: 'metric',
          notifications: {
            workoutReminders: true,
            nutritionReminders: true,
            progressUpdates: true,
          },
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      await AsyncStorage.setItem('user', JSON.stringify(mockUser));
      await AsyncStorage.setItem('userProfile', JSON.stringify(mockProfile));

      setUser(mockUser);
      setUserProfile(mockProfile);
    } catch (error) {
      console.error('Sign in error:', error);
      throw new Error('Failed to sign in');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string
  ) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log('Sign up successful for:', email);
      // In a real app, this would create an unverified user
      // For demo, we'll just log success
    } catch (error) {
      console.error('Sign up error:', error);
      throw new Error('Failed to sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async (email: string, code: string) => {
    setIsLoading(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      console.log('Email confirmed for:', email);
    } catch (error) {
      console.error('Confirm sign up error:', error);
      throw new Error('Failed to confirm sign up');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    setIsLoading(true);
    try {
      await AsyncStorage.removeItem('user');
      await AsyncStorage.removeItem('userProfile');
      setUser(null);
      setUserProfile(null);
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    // Simulate refreshing user data
    console.log('Refreshing user data...');
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    if (!userProfile) return;

    const updatedProfile = {
      ...userProfile,
      ...data,
      updatedAt: new Date().toISOString(),
    };
    await AsyncStorage.setItem('userProfile', JSON.stringify(updatedProfile));
    setUserProfile(updatedProfile);
  };

  const value = {
    user,
    userProfile,
    isAuthenticated,
    isLoading,
    signIn: handleSignIn,
    signUp: handleSignUp,
    confirmSignUp: handleConfirmSignUp,
    signOut: handleSignOut,
    refreshUser,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
