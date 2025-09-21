'use client';

import { useEffect, useState } from 'react';
import { api } from '../../../lib/api-client';
import { useCurrentUser } from '@packages/auth';
import {
  User,
  Settings,
  Camera,
  Save,
  Edit,
  Target,
  Activity,
  Heart,
  Weight,
  Ruler,
  Calendar,
  Bell,
  Shield,
  Globe,
} from 'lucide-react';

interface UserProfile {
  id: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  bio?: string;
  profileImageUrl?: string;
  dateOfBirth?: string;
  gender?: 'male' | 'female' | 'other';
  height?: number; // in cm
  weight?: number; // in kg
  fitnessLevel?: 'beginner' | 'intermediate' | 'advanced';
  fitnessGoals?: string[];
  goals?: string[]; // alias for fitnessGoals
  createdAt?: string;
  updatedAt?: string;
  preferences: {
    units: 'metric' | 'imperial';
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      workoutReminders: boolean;
      nutritionReminders: boolean;
    };
    privacy: {
      profileVisibility: 'public' | 'private' | 'friends';
      workoutSharing: boolean;
      progressSharing: boolean;
    };
  };
}

// Helper function to create default profile
const createDefaultProfile = (user: any): UserProfile => ({
  id: user?.id || '',
  firstName: user?.name?.split(' ')[0] || '',
  lastName: user?.name?.split(' ').slice(1).join(' ') || '',
  name: user?.name || '',
  email: user?.email || '',
  bio: '',
  profileImageUrl: '',
  fitnessGoals: [],
  goals: [], // alias for fitnessGoals
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  preferences: {
    units: 'metric',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
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
});

export default function ProfilePage() {
  const currentUser = useCurrentUser();
  const user = currentUser;
  const userLoading = currentUser.isLoading;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    'profile' | 'preferences' | 'goals'
  >('profile');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!userLoading && user) {
      fetchProfile();
    }
  }, [userLoading, user]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await api.getUserProfile();

      if (response) {
        const profileData = response;
        setProfile({
          ...createDefaultProfile(user),
          ...profileData,
          preferences: {
            ...createDefaultProfile(user).preferences,
            ...profileData.preferences,
            notifications: {
              ...createDefaultProfile(user).preferences.notifications,
              ...profileData.preferences?.notifications,
            },
            privacy: {
              ...createDefaultProfile(user).preferences.privacy,
              ...profileData.preferences?.privacy,
            },
          },
        });
      } else {
        // Create default profile if none exists
        setProfile(createDefaultProfile(user));
      }
    } catch (e: any) {
      console.error('Failed to fetch profile:', e);
      // If profile not found, create a default profile
      if (
        e?.message?.includes('User profile not found') ||
        e?.message?.includes('Not Found') ||
        e?.message?.includes('"Not Found"')
      ) {
        setProfile(createDefaultProfile(user));
        setError(null); // Clear error since we're creating a default profile
      } else {
        setError(e?.message || 'Failed to load profile');
      }
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async (updatedProfile: UserProfile) => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(null);

      // Transform the profile data to match backend expectations
      const profileData = {
        firstName: updatedProfile.firstName,
        lastName: updatedProfile.lastName,
        email: updatedProfile.email,
        bio: updatedProfile.bio,
        profileImageUrl: updatedProfile.profileImageUrl,
        dateOfBirth: updatedProfile.dateOfBirth,
        height: updatedProfile.height,
        weight: updatedProfile.weight,
        fitnessGoals: updatedProfile.fitnessGoals || updatedProfile.goals || [],
        experienceLevel: updatedProfile.fitnessLevel || 'beginner',
        preferences: updatedProfile.preferences,
        updatedAt: new Date().toISOString(),
        fitnessLevel: updatedProfile.fitnessLevel || 'beginner',
        gender: updatedProfile.gender,
      };

      const response = await api.updateUserProfile(profileData);
      if (response) {
        setSuccess('Profile saved successfully');
      } else {
        setError('Failed to save profile');
      }
    } catch (e: any) {
      console.error('Failed to save profile:', e);
      setError(e?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const handleProfileUpdate = (updates: Partial<UserProfile>) => {
    if (profile) {
      const updatedProfile = { ...profile, ...updates };
      setProfile(updatedProfile);
    }
  };

  const handlePreferencesUpdate = (
    updates: Partial<UserProfile['preferences']>
  ) => {
    if (profile) {
      const updatedProfile = {
        ...profile,
        preferences: { ...profile.preferences, ...updates },
      };
      setProfile(updatedProfile);
    }
  };

  const handleImageUpload = async (file: File) => {
    if (!profile) return;

    try {
      setUploading(true);
      setError(null);

      // Generate presigned URL
      const uploadResponse = await api.generateUploadUrl(file.type);

      const { upload_url, key, bucket_name } = uploadResponse;

      // Upload file to S3
      await api.uploadImage(file, upload_url);

      // Update profile with new image URL
      // The presigned URL already contains the correct S3 URL format
      // We just need to remove the query parameters to get the public URL
      const uploadUrlObj = new URL(upload_url);
      const imageUrl = `${uploadUrlObj.protocol}//${uploadUrlObj.hostname}${uploadUrlObj.pathname}`;
      const updatedProfile = {
        ...profile,
        profileImageUrl: imageUrl,
        updatedAt: new Date().toISOString(),
      };

      // Save profile with new image URL
      await saveProfile(updatedProfile);
      setSuccess('Profile image updated successfully');
    } catch (e: any) {
      console.error('Failed to upload image:', e);
      setError(e?.message || 'Failed to upload image');
    } finally {
      setUploading(false);
    }
  };

  if (userLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Profile Settings
        </h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            {loading
              ? 'Loading profile...'
              : 'No profile data available. Please create your profile.'}
          </p>
          {error && (
            <p className="text-red-600 dark:text-red-400">Error: {error}</p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profile Settings
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your personal information and preferences
          </p>
        </div>
        <button
          onClick={() => saveProfile(profile)}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save Changes'}</span>
        </button>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="text-green-600 dark:text-green-400">{success}</div>
        </div>
      )}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="text-red-600 dark:text-red-400">{error}</div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 dark:border-gray-700">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'profile', name: 'Profile', icon: User },
            { id: 'preferences', name: 'Preferences', icon: Settings },
            { id: 'goals', name: 'Goals', icon: Target },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 dark:text-gray-400 dark:hover:text-gray-300'
              }`}
            >
              <tab.icon className="h-4 w-4" />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="space-y-6">
        {activeTab === 'profile' && (
          <ProfileTab
            profile={profile}
            onUpdate={handleProfileUpdate}
            onImageUpload={handleImageUpload}
            uploading={uploading}
          />
        )}
        {activeTab === 'preferences' && (
          <PreferencesTab
            preferences={profile.preferences}
            onUpdate={handlePreferencesUpdate}
          />
        )}
        {activeTab === 'goals' && (
          <GoalsTab profile={profile} onUpdate={handleProfileUpdate} />
        )}
      </div>
    </div>
  );
}

function ProfileTab({
  profile,
  onUpdate,
  onImageUpload,
  uploading,
}: {
  profile: UserProfile;
  onUpdate: (updates: Partial<UserProfile>) => void;
  onImageUpload: (file: File) => void;
  uploading: boolean;
}) {
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        alert('Please select an image file');
        return;
      }

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        alert('File size must be less than 5MB');
        return;
      }

      onImageUpload(file);
    }
  };
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Profile Image */}
      <div className="lg:col-span-2">
        <div className="flex items-center space-x-6">
          <div className="relative">
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center">
              {profile.profileImageUrl ? (
                <img
                  src={profile.profileImageUrl}
                  alt="Profile"
                  className="w-24 h-24 rounded-full object-cover"
                />
              ) : (
                <User className="h-12 w-12 text-gray-400" />
              )}
            </div>
            <label className="absolute bottom-0 right-0 bg-blue-600 text-white p-2 rounded-full hover:bg-blue-700 cursor-pointer">
              <Camera className="h-4 w-4" />
              <input
                type="file"
                accept="image/*"
                onChange={handleFileChange}
                className="hidden"
                disabled={uploading}
              />
            </label>
            {uploading && (
              <div className="absolute inset-0 bg-black bg-opacity-50 rounded-full flex items-center justify-center">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-white"></div>
              </div>
            )}
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {profile.firstName && profile.lastName
                ? `${profile.firstName} ${profile.lastName}`
                : profile.name || 'No name set'}
            </h3>
            <p className="text-gray-600 dark:text-gray-400">{profile.email}</p>
            {profile.createdAt && (
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Member since {new Date(profile.createdAt).toLocaleDateString()}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Basic Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Basic Information
        </h3>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            First Name
          </label>
          <input
            type="text"
            value={profile.firstName || ''}
            onChange={(e) => onUpdate({ firstName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Email
          </label>
          <input
            type="email"
            value={profile.email || ''}
            onChange={(e) => onUpdate({ email: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Bio
          </label>
          <textarea
            value={profile.bio || ''}
            onChange={(e) => onUpdate({ bio: e.target.value })}
            rows={3}
            placeholder="Tell us about yourself..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Date of Birth
          </label>
          <input
            type="date"
            value={profile.dateOfBirth || ''}
            onChange={(e) => onUpdate({ dateOfBirth: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Gender
          </label>
          <select
            value={profile.gender || ''}
            onChange={(e) => onUpdate({ gender: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select gender</option>
            <option value="male">Male</option>
            <option value="female">Female</option>
            <option value="other">Other</option>
          </select>
        </div>
      </div>

      {/* Physical Information */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Physical Information
        </h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Last Name
          </label>
          <input
            type="text"
            value={profile.lastName || ''}
            onChange={(e) => onUpdate({ lastName: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Height (cm)
          </label>
          <input
            type="number"
            value={profile.height || ''}
            onChange={(e) => onUpdate({ height: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Weight (kg)
          </label>
          <input
            type="number"
            step="0.1"
            value={profile.weight || ''}
            onChange={(e) => onUpdate({ weight: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Fitness Level
          </label>
          <select
            value={profile.fitnessLevel || ''}
            onChange={(e) => onUpdate({ fitnessLevel: e.target.value as any })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value="">Select fitness level</option>
            <option value="beginner">Beginner</option>
            <option value="intermediate">Intermediate</option>
            <option value="advanced">Advanced</option>
          </select>
        </div>
      </div>
    </div>
  );
}

function PreferencesTab({
  preferences,
  onUpdate,
}: {
  preferences: UserProfile['preferences'];
  onUpdate: (updates: Partial<UserProfile['preferences']>) => void;
}) {
  return (
    <div className="space-y-6">
      {/* Units */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Units
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Measurement System
            </label>
            <select
              value={preferences.units}
              onChange={(e) => onUpdate({ units: e.target.value as any })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="metric">Metric (kg, cm)</option>
              <option value="imperial">Imperial (lbs, ft)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Timezone
            </label>
            <select
              value={preferences.timezone}
              onChange={(e) => onUpdate({ timezone: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern Time</option>
              <option value="America/Chicago">Central Time</option>
              <option value="America/Denver">Mountain Time</option>
              <option value="America/Los_Angeles">Pacific Time</option>
              <option value="Europe/London">London</option>
              <option value="Europe/Paris">Paris</option>
              <option value="Asia/Tokyo">Tokyo</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Notifications
        </h3>
        <div className="space-y-3">
          {[
            { key: 'email', label: 'Email Notifications', icon: Bell },
            { key: 'push', label: 'Push Notifications', icon: Bell },
            {
              key: 'workoutReminders',
              label: 'Workout Reminders',
              icon: Activity,
            },
            {
              key: 'nutritionReminders',
              label: 'Nutrition Reminders',
              icon: Heart,
            },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {label}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    preferences.notifications[
                      key as keyof typeof preferences.notifications
                    ]
                  }
                  onChange={(e) =>
                    onUpdate({
                      notifications: {
                        ...preferences.notifications,
                        [key]: e.target.checked,
                      },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>

      {/* Privacy */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Privacy
        </h3>
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Profile Visibility
            </label>
            <select
              value={preferences.privacy.profileVisibility}
              onChange={(e) =>
                onUpdate({
                  privacy: {
                    ...preferences.privacy,
                    profileVisibility: e.target.value as any,
                  },
                })
              }
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="public">Public</option>
              <option value="friends">Friends Only</option>
              <option value="private">Private</option>
            </select>
          </div>
          {[
            {
              key: 'workoutSharing',
              label: 'Share Workout Progress',
              icon: Activity,
            },
            {
              key: 'progressSharing',
              label: 'Share Progress Photos',
              icon: Camera,
            },
          ].map(({ key, label, icon: Icon }) => (
            <div key={key} className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <Icon className="h-5 w-5 text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {label}
                </span>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  checked={
                    preferences.privacy[key as keyof typeof preferences.privacy]
                  }
                  onChange={(e) =>
                    onUpdate({
                      privacy: {
                        ...preferences.privacy,
                        [key]: e.target.checked,
                      },
                    })
                  }
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
              </label>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function GoalsTab({
  profile,
  onUpdate,
}: {
  profile: UserProfile;
  onUpdate: (updates: Partial<UserProfile>) => void;
}) {
  const [newGoal, setNewGoal] = useState('');

  const addGoal = () => {
    if (newGoal.trim() && profile.fitnessGoals) {
      onUpdate({
        fitnessGoals: [...profile.fitnessGoals, newGoal.trim()],
      });
      setNewGoal('');
    }
  };

  const removeGoal = (index: number) => {
    if (profile.fitnessGoals) {
      onUpdate({
        fitnessGoals: profile.fitnessGoals.filter((_, i) => i !== index),
      });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Fitness Goals
        </h3>

        {/* Add Goal Form */}
        <div className="flex space-x-2 mb-4">
          <input
            type="text"
            value={newGoal}
            onChange={(e) => setNewGoal(e.target.value)}
            placeholder="Add a new goal..."
            className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            onKeyPress={(e) => e.key === 'Enter' && addGoal()}
          />
          <button
            onClick={addGoal}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
          >
            Add
          </button>
        </div>

        {/* Goals List */}
        <div className="space-y-2">
          {(profile.fitnessGoals || []).map((goal, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg"
            >
              <span className="text-gray-900 dark:text-white">{goal}</span>
              <button
                onClick={() => removeGoal(index)}
                className="text-red-500 hover:text-red-700"
              >
                Remove
              </button>
            </div>
          ))}
          {(!profile.fitnessGoals || profile.fitnessGoals.length === 0) && (
            <p className="text-gray-500 dark:text-gray-400 text-center py-4">
              No goals set yet. Add your first goal above!
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
