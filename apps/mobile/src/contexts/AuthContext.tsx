import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Amplify } from 'aws-amplify';
import {
  signIn,
  signUp,
  confirmSignUp,
  signOut,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';
import { User, UserProfile } from '../types';
import apiClient from '../services/api';

// Configure Amplify for authentication
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'eu-north-1_s19fcM8z5', // Your actual user pool ID
      userPoolClientId: '61b7oqg3cp3fh0btl5k83sjjgd', // Your actual client ID
      loginWith: {
        email: true,
        username: true,
      },
    },
  },
});

// Additional region configuration if needed
// This should match your AWS region where the user pool is located

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
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      const currentUser = await getCurrentUser();
      const session = await fetchAuthSession();

      if (currentUser && session.tokens) {
        const userData: User = {
          id: currentUser.userId,
          email: currentUser.signInDetails?.loginId || '',
        };

        setUser(userData);

        // Load user profile
        try {
          const profile = await apiClient.getUserProfile(currentUser.userId);
          setUserProfile(profile);
        } catch (error) {
          console.log('No user profile found, will create one');
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
    } catch (error) {
      console.log('User not authenticated');
      setUser(null);
      setUserProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      const result = await signIn({ username: email, password });

      if (result.isSignedIn) {
        await checkAuthState();
      }
    } catch (error: any) {
      console.error('Sign in error:', error);
      throw new Error(error.message || 'Sign in failed');
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
    try {
      setIsLoading(true);
      const result = await signUp({
        username: email,
        password,
        options: {
          userAttributes: {
            email,
            given_name: firstName,
            family_name: lastName,
          },
        },
      });

      if (result.userId) {
        // Sign up successful, user needs to confirm
        console.log('Sign up successful, confirmation required');
      }
    } catch (error: any) {
      console.error('Sign up error:', error);
      throw new Error(error.message || 'Sign up failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmSignUp = async (email: string, code: string) => {
    try {
      setIsLoading(true);
      await confirmSignUp({ username: email, confirmationCode: code });
      console.log('Email confirmed successfully');
    } catch (error: any) {
      console.error('Confirmation error:', error);
      throw new Error(error.message || 'Confirmation failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = async () => {
    try {
      setIsLoading(true);
      await signOut();
      setUser(null);
      setUserProfile(null);
      await AsyncStorage.clear(); // Clear any cached data
    } catch (error: any) {
      console.error('Sign out error:', error);
      throw new Error(error.message || 'Sign out failed');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshUser = async () => {
    await checkAuthState();
  };

  const updateProfile = async (data: Partial<UserProfile>) => {
    try {
      if (!user) throw new Error('User not authenticated');

      const updatedProfile = await apiClient.updateUserProfile(data, user.id);
      setUserProfile(updatedProfile);
    } catch (error: any) {
      console.error('Profile update error:', error);
      throw new Error(error.message || 'Profile update failed');
    }
  };

  const value: AuthContextType = {
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
