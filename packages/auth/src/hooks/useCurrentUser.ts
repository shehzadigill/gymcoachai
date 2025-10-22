'use client';

import { useState, useEffect } from 'react';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { configureAuth } from '../config';
// Define User interface locally since types package doesn't have proper declarations
interface User {
  id: string;
  email: string;
  name: string;
  profileImage?: string;
  createdAt: string;
  updatedAt: string;
  preferences: UserPreferences;
}

interface UserPreferences {
  units: 'metric' | 'imperial';
  timezone: string;
  notifications: NotificationSettings;
  privacy: PrivacySettings;
}

interface NotificationSettings {
  email: boolean;
  push: boolean;
  workoutReminders: boolean;
  nutritionReminders: boolean;
}

interface PrivacySettings {
  profileVisibility: 'public' | 'private' | 'friends';
  workoutSharing: boolean;
  progressSharing: boolean;
}

export interface CurrentUser extends User {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useCurrentUser = (): CurrentUser => {
  const [user, setUser] = useState<CurrentUser>({
    id: '',
    email: '',
    name: '',
    createdAt: '',
    updatedAt: '',
    preferences: {
      units: 'metric',
      timezone: 'UTC',
      notifications: {
        email: true,
        push: true,
        workoutReminders: true,
        nutritionReminders: true,
      },
      privacy: {
        profileVisibility: 'private',
        workoutSharing: false,
        progressSharing: false,
      },
    },
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const loadUser = async () => {
      try {
        setUser((prev) => ({ ...prev, isLoading: true, error: null }));

        const currentUser = await getCurrentUser();
        const attributes = await fetchUserAttributes();

        setUser({
          id: currentUser.userId,
          email: attributes.email || '',
          name: `${attributes.given_name || ''} ${attributes.family_name || ''}`.trim(),
          createdAt: attributes.created_at || new Date().toISOString(),
          updatedAt: attributes.updated_at || new Date().toISOString(),
          preferences: {
            units:
              (attributes['custom:units'] as 'metric' | 'imperial') || 'metric',
            timezone: attributes.zoneinfo || 'UTC',
            notifications: {
              email: Boolean(attributes.email_verified),
              push: true,
              workoutReminders: true,
              nutritionReminders: true,
            },
            privacy: {
              profileVisibility:
                (attributes['custom:profile_visibility'] as
                  | 'public'
                  | 'private'
                  | 'friends') || 'private',
              workoutSharing: false,
              progressSharing: false,
            },
          },
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error: any) {
        // Treat unauthenticated as a normal state without logging noisy errors
        if (
          error?.name === 'UserUnAuthenticatedException' ||
          error?.name === 'AuthUserPoolException'
        ) {
          setUser((prev) => ({
            ...prev,
            isAuthenticated: false,
            isLoading: false,
            error: null,
          }));
          return;
        }
        console.error('Error loading user:', error);
        setUser((prev) => ({
          ...prev,
          isAuthenticated: false,
          isLoading: false,
          error: error instanceof Error ? error.message : 'Failed to load user',
        }));
      }
    };

    loadUser();
  }, []);

  return user;
};
