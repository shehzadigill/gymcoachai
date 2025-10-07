import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {User, UserProfile} from '../types';
import apiClient from '../services/api';
import CognitoAuthService, {AuthUser} from '../services/cognitoAuth';
import {
  testCognitoConnectivity,
  testAPIConnectivity,
} from '../utils/network-test';

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
    lastName?: string,
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

export function AuthProvider({children}: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user;

  // Initial auth check - runs only once on mount
  useEffect(() => {
    checkAuthState();
  }, []);

  // Set up token refresh interval - runs when user changes
  useEffect(() => {
    if (!user) {
      return; // Don't set up interval if no user
    }

    console.log('Setting up token refresh interval for user:', user.email);

    // Set up automatic token refresh every 45 minutes (tokens expire in 1 hour)
    const refreshInterval = setInterval(async () => {
      console.log('Performing scheduled token refresh...');
      try {
        const refreshedUser = await CognitoAuthService.refreshTokens();
        if (!refreshedUser) {
          console.log('Token refresh failed, signing out...');
          await handleSignOut();
        }
      } catch (error) {
        console.error('Scheduled token refresh failed:', error);
      }
    }, 45 * 60 * 1000); // 45 minutes

    return () => {
      console.log('Clearing token refresh interval');
      clearInterval(refreshInterval);
    };
  }, [user?.id]); // Only depend on user ID to avoid unnecessary re-runs

  const checkAuthState = async () => {
    try {
      setIsLoading(true);
      let currentUser = await CognitoAuthService.getCurrentUser();

      // If getCurrentUser fails, try to refresh tokens
      if (!currentUser) {
        console.log('No current user, attempting token refresh...');
        currentUser = await CognitoAuthService.refreshTokens();
      }

      if (currentUser) {
        const userData: User = {
          id: currentUser.username,
          email: currentUser.email,
        };

        setUser(userData);

        // Load user profile
        try {
          // Don't pass userId parameter, let API client use getCurrentUserId() internally
          const profile = await apiClient.getUserProfile();
          setUserProfile(profile);
        } catch (error) {
          console.log('No user profile found, will create one:', error);
        }
      } else {
        console.log('Authentication failed - clearing state');
        setUser(null);
        setUserProfile(null);
      }
    } catch (error) {
      console.log('User not authenticated:', error);
      setUser(null);
      setUserProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async (email: string, password: string) => {
    try {
      setIsLoading(true);
      console.log('Attempting sign in for:', email);

      // Test network connectivity first
      console.log('Testing network connectivity...');
      const cognitoStatus = await testCognitoConnectivity();
      const apiStatus = await testAPIConnectivity();
      console.log('Network test results:', {cognitoStatus, apiStatus});

      // Use CognitoAuthService instead of Amplify
      console.log('Calling CognitoAuthService.signIn...');
      const result = await CognitoAuthService.signIn(email, password);
      console.log('Sign in result:', {
        username: result.username,
        email: result.email,
        hasTokens: !!(
          result.accessToken &&
          result.refreshToken &&
          result.idToken
        ),
      });

      // Auth service already stores tokens
      await checkAuthState();
    } catch (error: any) {
      console.error('Sign in error details:', {
        error,
        message: error.message,
        name: error.name,
        code: error.code,
        stack: error.stack,
      });

      // Provide specific error messages based on error type
      if (error.name === 'UserNotConfirmedException') {
        throw new Error('Please confirm your email address before signing in.');
      } else if (error.name === 'NotAuthorizedException') {
        throw new Error('Incorrect email or password.');
      } else if (error.name === 'UserNotFoundException') {
        throw new Error('No account found with this email address.');
      } else if (error.name === 'Unknown') {
        // Log more details for unknown errors
        console.error(
          'Unknown AWS error - full details:',
          JSON.stringify(error, null, 2),
        );
        throw new Error(
          'AWS service temporarily unavailable. Please try again in a few moments.',
        );
      } else {
        throw new Error(error.message || 'Sign in failed. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignUp = async (
    email: string,
    password: string,
    firstName?: string,
    lastName?: string,
  ) => {
    try {
      setIsLoading(true);

      const attributes: Record<string, string> = {
        email,
      };

      if (firstName) attributes.given_name = firstName;
      if (lastName) attributes.family_name = lastName;

      await CognitoAuthService.signUp(email, password, attributes);
      console.log('Sign up successful, confirmation required');
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
      await CognitoAuthService.confirmSignUp(email, code);
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
      await CognitoAuthService.signOut();
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
