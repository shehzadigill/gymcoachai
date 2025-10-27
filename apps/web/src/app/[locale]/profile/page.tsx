'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { api } from '../../../lib/api-client';
import { useCurrentUser, updatePassword } from '@packages/auth';
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
  Lock,
  Eye,
  EyeOff,
  CheckCircle,
  AlertCircle,
  Bot,
} from 'lucide-react';
import AICoachingPreferencesPanel from '../../../components/profile/AICoachingPreferencesPanel';

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
  // weight removed - now tracked separately in body measurements
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
    dailyGoals?: {
      calories: number;
      water: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    aiTrainer?: {
      enabled: boolean;
      coachingStyle: 'motivational' | 'strict' | 'balanced' | 'technical';
      communicationFrequency: 'daily' | 'weekly' | 'on-demand';
      focusAreas: string[];
      injuryHistory: string[];
      equipmentAvailable: string[];
      workoutDurationPreference: number; // minutes
      workoutDaysPerWeek: number;
      mealPreferences: string[];
      allergies: string[];
      supplementPreferences: string[];
    };
  };
}

interface BodyMeasurement {
  id?: string;
  date: string;
  weight?: number;
  bodyFat?: number;
  muscleMass?: number;
  measurements?: {
    chest?: number;
    waist?: number;
    hips?: number;
    bicepLeft?: number;
    bicepRight?: number;
    thighLeft?: number;
    thighRight?: number;
    neck?: number;
  };
  notes?: string;
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
    dailyGoals: {
      calories: 2000,
      water: 8,
      protein: 150,
      carbs: 200,
      fat: 65,
    },
    aiTrainer: {
      enabled: false,
      coachingStyle: 'balanced',
      communicationFrequency: 'on-demand',
      focusAreas: [],
      injuryHistory: [],
      equipmentAvailable: [],
      workoutDurationPreference: 60, // 60 minutes
      workoutDaysPerWeek: 3,
      mealPreferences: [],
      allergies: [],
      supplementPreferences: [],
    },
  },
});

export default function ProfilePage() {
  const t = useTranslations('profile_page');
  const currentUser = useCurrentUser();
  const user = currentUser;
  const userLoading = currentUser.isLoading;
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<
    | 'profile'
    | 'preferences'
    | 'goals'
    | 'measurements'
    | 'ai-trainer'
    | 'security'
  >('profile');
  const [uploading, setUploading] = useState(false);

  // Body measurements state
  const [bodyMeasurements, setBodyMeasurements] = useState<BodyMeasurement[]>(
    []
  );
  const [currentWeight, setCurrentWeight] = useState('');
  const [currentBodyFat, setCurrentBodyFat] = useState('');
  const [loadingMeasurements, setLoadingMeasurements] = useState(false);

  useEffect(() => {
    if (!userLoading && user) {
      fetchProfile();
      loadBodyMeasurements();
    }
  }, [userLoading, user]);

  const loadBodyMeasurements = async () => {
    try {
      setLoadingMeasurements(true);
      const measurements = await api.getBodyMeasurements();
      console.log('Loaded body measurements:', measurements);
      setBodyMeasurements(measurements || []);

      // Set current values from latest measurement
      if (measurements && measurements.length > 0) {
        const latest = measurements[0];
        setCurrentWeight(latest.weight?.toString() || '');
        setCurrentBodyFat(latest.bodyFat?.toString() || '');
      }
    } catch (error) {
      console.error('Error loading body measurements:', error);
    } finally {
      setLoadingMeasurements(false);
    }
  };

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
        // weight removed - now tracked separately in body measurements
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

  const handleProfileUpdate = async (updates: Partial<UserProfile>) => {
    if (profile) {
      const updatedProfile = { ...profile, ...updates };
      setProfile(updatedProfile);

      // Save to backend if fitness goals are being updated
      if (updates.fitnessGoals) {
        try {
          await api.updateFitnessGoals(updates.fitnessGoals);
          console.log(
            'Fitness goals saved successfully:',
            updates.fitnessGoals
          );
        } catch (error) {
          console.error('Error saving fitness goals:', error);
          alert('Failed to save fitness goals. Please try again.');
        }
      }
    }
  };

  const handlePreferencesUpdate = async (
    updates: Partial<UserProfile['preferences']>
  ) => {
    if (profile) {
      const updatedProfile = {
        ...profile,
        preferences: { ...profile.preferences, ...updates },
      };
      setProfile(updatedProfile);

      try {
        console.log(
          'Sending preferences update:',
          JSON.stringify(updates, null, 2)
        );
        await api.updateUserPreferences(updates);
        console.log('Preferences saved successfully:', updates);
        setSuccess('Preferences updated successfully');
      } catch (error) {
        console.error('Error saving preferences:', error);
        setError('Failed to save preferences. Please try again.');
      }
    }
  };

  const saveBodyMeasurement = async () => {
    if (!currentWeight && !currentBodyFat) {
      setError('Please enter at least weight or body fat percentage');
      return;
    }

    try {
      setSaving(true);
      setError(null);

      const promises = [];

      // Create weight measurement if provided
      if (currentWeight) {
        const weightData = {
          measurementType: 'weight',
          value: parseFloat(currentWeight),
          unit: 'kg', // You might want to make this configurable
          notes: 'Weight measurement from profile',
        };
        promises.push(api.createBodyMeasurement(weightData));
      }

      // Create body fat measurement if provided
      if (currentBodyFat) {
        const bodyFatData = {
          measurementType: 'body_fat',
          value: parseFloat(currentBodyFat),
          unit: '%',
          notes: 'Body fat measurement from profile',
        };
        promises.push(api.createBodyMeasurement(bodyFatData));
      }

      await Promise.all(promises);

      // Reload measurements to show the new ones
      await loadBodyMeasurements();

      // Clear the inputs
      setCurrentWeight('');
      setCurrentBodyFat('');

      setSuccess('Body measurement saved successfully!');
    } catch (error) {
      console.error('Error saving body measurement:', error);
      setError('Failed to save body measurement. Please try again.');
    } finally {
      setSaving(false);
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
          {t('title')}
        </h1>
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-200">
            {loading ? t('loading') : t('no_profile_data')}
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
            {t('title')}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">{t('subtitle')}</p>
        </div>
        <button
          onClick={() => saveProfile(profile)}
          disabled={saving}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? t('loading') : t('save_changes')}</span>
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
            { id: 'measurements', name: 'Body Measurements', icon: Weight },
            { id: 'ai-trainer', name: 'AI Trainer', icon: Bot },
            { id: 'security', name: 'Security', icon: Shield },
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
        {activeTab === 'measurements' && (
          <MeasurementsTab
            measurements={bodyMeasurements}
            currentWeight={currentWeight}
            currentBodyFat={currentBodyFat}
            onWeightChange={setCurrentWeight}
            onBodyFatChange={setCurrentBodyFat}
            onSave={saveBodyMeasurement}
            saving={saving}
            loading={loadingMeasurements}
          />
        )}
        {activeTab === 'ai-trainer' && (
          <AITrainerTab
            preferences={profile.preferences}
            onUpdate={handlePreferencesUpdate}
            shouldRefresh={activeTab === 'ai-trainer'}
            userId={user?.id}
          />
        )}
        {activeTab === 'security' && <SecurityTab />}
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

        {/* Weight field removed - now tracked in Body Measurements tab */}

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
                    preferences.privacy[
                      key as 'workoutSharing' | 'progressSharing'
                    ] as boolean
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
  const [dailyGoals, setDailyGoals] = useState({
    calories: 2000,
    water: 8, // glasses
    protein: 150, // grams
    carbs: 200, // grams
    fat: 65, // grams
  });

  // Sync daily goals with profile data
  useEffect(() => {
    if (profile.preferences.dailyGoals) {
      setDailyGoals(profile.preferences.dailyGoals);
    }
  }, [profile.preferences.dailyGoals]);

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

  const updateDailyGoal = (key: keyof typeof dailyGoals, value: number) => {
    setDailyGoals((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveDailyGoals = async () => {
    try {
      await api.updateDailyGoals(dailyGoals);
      console.log('Daily goals saved successfully:', dailyGoals);
      alert('Daily goals saved successfully!');
    } catch (error) {
      console.error('Error saving daily goals:', error);
      alert('Failed to save daily goals. Please try again.');
    }
  };

  return (
    <div className="space-y-6">
      {/* Daily Goals Section */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Daily Goals
        </h3>

        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Daily Calories
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={dailyGoals.calories}
                  onChange={(e) =>
                    updateDailyGoal(
                      'calories',
                      parseInt(e.target.value) || 2000
                    )
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="2000"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  kcal
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Water Intake
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={dailyGoals.water}
                  onChange={(e) =>
                    updateDailyGoal('water', parseInt(e.target.value) || 8)
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="8"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  glasses
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Protein
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={dailyGoals.protein}
                  onChange={(e) =>
                    updateDailyGoal('protein', parseInt(e.target.value) || 150)
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="150"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  g
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Carbohydrates
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={dailyGoals.carbs}
                  onChange={(e) =>
                    updateDailyGoal('carbs', parseInt(e.target.value) || 200)
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="200"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  g
                </span>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Fat
              </label>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  value={dailyGoals.fat}
                  onChange={(e) =>
                    updateDailyGoal('fat', parseInt(e.target.value) || 65)
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="65"
                />
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  g
                </span>
              </div>
            </div>
          </div>

          <div className="mt-6">
            <button
              onClick={saveDailyGoals}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg"
            >
              Save Daily Goals
            </button>
          </div>
        </div>
      </div>

      {/* Fitness Goals Section */}
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

function AITrainerTab({
  preferences,
  onUpdate,
  shouldRefresh,
  userId,
}: {
  preferences: UserProfile['preferences'];
  onUpdate: (updates: Partial<UserProfile['preferences']>) => void;
  shouldRefresh?: boolean;
  userId?: string;
}) {
  const [aiPreferences, setAiPreferences] = useState(
    preferences.aiTrainer || {
      enabled: true, // Default to enabled for new users
      coachingStyle: 'balanced' as const,
      communicationFrequency: 'on-demand' as const,
      focusAreas: [],
      injuryHistory: [],
      equipmentAvailable: [],
      workoutDurationPreference: 60,
      workoutDaysPerWeek: 3,
      mealPreferences: [],
      allergies: [],
      supplementPreferences: [],
    }
  );

  // Fetch fresh preferences when the AI Trainer tab becomes active
  useEffect(() => {
    const fetchFreshPreferences = async () => {
      if (shouldRefresh && userId) {
        try {
          console.log(
            '🔄 AI Trainer tab active - fetching fresh preferences...'
          );
          const response = await api.getUserPreferences(userId);
          const result = await response?.json();

          if (result?.aiTrainer) {
            console.log(
              '✅ Got fresh AI trainer preferences:',
              result.aiTrainer
            );
            setAiPreferences({
              enabled: result.aiTrainer.enabled ?? true,
              coachingStyle:
                result.aiTrainer.coaching_style ||
                result.aiTrainer.coachingStyle ||
                'balanced',
              communicationFrequency:
                result.aiTrainer.communication_frequency ||
                result.aiTrainer.communicationFrequency ||
                'on-demand',
              focusAreas:
                result.aiTrainer.focus_areas ||
                result.aiTrainer.focusAreas ||
                [],
              injuryHistory:
                result.aiTrainer.injury_history ||
                result.aiTrainer.injuryHistory ||
                [],
              equipmentAvailable:
                result.aiTrainer.equipment_available ||
                result.aiTrainer.equipmentAvailable ||
                [],
              workoutDurationPreference:
                result.aiTrainer.workout_duration_preference ||
                result.aiTrainer.workoutDurationPreference ||
                60,
              workoutDaysPerWeek:
                result.aiTrainer.workout_days_per_week ||
                result.aiTrainer.workoutDaysPerWeek ||
                3,
              mealPreferences:
                result.aiTrainer.meal_preferences ||
                result.aiTrainer.mealPreferences ||
                [],
              allergies: result.aiTrainer.allergies || [],
              supplementPreferences:
                result.aiTrainer.supplement_preferences ||
                result.aiTrainer.supplementPreferences ||
                [],
            });
          } else {
            console.log('ℹ️ No fresh AI trainer data, using defaults');
            setAiPreferences({
              enabled: true,
              coachingStyle: 'balanced',
              communicationFrequency: 'on-demand',
              focusAreas: [],
              injuryHistory: [],
              equipmentAvailable: [],
              workoutDurationPreference: 60,
              workoutDaysPerWeek: 3,
              mealPreferences: [],
              allergies: [],
              supplementPreferences: [],
            });
          }
        } catch (error) {
          console.error(
            '❌ Error fetching fresh AI trainer preferences:',
            error
          );
        }
      }
    };

    fetchFreshPreferences();
  }, [shouldRefresh, userId]);

  // Also update when the parent preferences change (fallback)
  useEffect(() => {
    if (!shouldRefresh) {
      setAiPreferences(
        preferences?.aiTrainer || {
          enabled: true, // Default to enabled for new users
          coachingStyle: 'balanced',
          communicationFrequency: 'on-demand',
          focusAreas: [],
          injuryHistory: [],
          equipmentAvailable: [],
          workoutDurationPreference: 60,
          workoutDaysPerWeek: 3,
          mealPreferences: [],
          allergies: [],
          supplementPreferences: [],
        }
      );
    }
  }, [preferences?.aiTrainer, shouldRefresh]);

  const [newItem, setNewItem] = useState({
    focusArea: '',
    injury: '',
    equipment: '',
    mealPreference: '',
    allergy: '',
    supplement: '',
  });

  const focusAreaOptions = [
    'Strength Training',
    'Cardio',
    'Flexibility',
    'Nutrition',
    'Weight Loss',
    'Muscle Gain',
    'Endurance',
    'Rehabilitation',
  ];

  const equipmentOptions = [
    'Dumbbells',
    'Barbell',
    'Resistance Bands',
    'Kettlebells',
    'Pull-up Bar',
    'Gym Machines',
    'Bodyweight',
    'Cardio Equipment',
    'Yoga Mat',
    'Medicine Ball',
  ];

  const mealPreferenceOptions = [
    'Vegetarian',
    'Vegan',
    'Keto',
    'Paleo',
    'Mediterranean',
    'Low-Carb',
    'High-Protein',
    'No Restrictions',
  ];

  const addItem = (type: keyof typeof newItem, value: string) => {
    if (value.trim()) {
      const updatedPreferences = { ...aiPreferences };
      switch (type) {
        case 'focusArea':
          updatedPreferences.focusAreas = [
            ...updatedPreferences.focusAreas,
            value.trim(),
          ];
          break;
        case 'injury':
          updatedPreferences.injuryHistory = [
            ...updatedPreferences.injuryHistory,
            value.trim(),
          ];
          break;
        case 'equipment':
          updatedPreferences.equipmentAvailable = [
            ...updatedPreferences.equipmentAvailable,
            value.trim(),
          ];
          break;
        case 'mealPreference':
          updatedPreferences.mealPreferences = [
            ...updatedPreferences.mealPreferences,
            value.trim(),
          ];
          break;
        case 'allergy':
          updatedPreferences.allergies = [
            ...updatedPreferences.allergies,
            value.trim(),
          ];
          break;
        case 'supplement':
          updatedPreferences.supplementPreferences = [
            ...updatedPreferences.supplementPreferences,
            value.trim(),
          ];
          break;
      }
      setAiPreferences(updatedPreferences);
      onUpdate({ aiTrainer: updatedPreferences });
      setNewItem({ ...newItem, [type]: '' });
    }
  };

  const removeItem = (type: keyof typeof newItem, index: number) => {
    const updatedPreferences = { ...aiPreferences };
    switch (type) {
      case 'focusArea':
        updatedPreferences.focusAreas = updatedPreferences.focusAreas.filter(
          (_, i) => i !== index
        );
        break;
      case 'injury':
        updatedPreferences.injuryHistory =
          updatedPreferences.injuryHistory.filter((_, i) => i !== index);
        break;
      case 'equipment':
        updatedPreferences.equipmentAvailable =
          updatedPreferences.equipmentAvailable.filter((_, i) => i !== index);
        break;
      case 'mealPreference':
        updatedPreferences.mealPreferences =
          updatedPreferences.mealPreferences.filter((_, i) => i !== index);
        break;
      case 'allergy':
        updatedPreferences.allergies = updatedPreferences.allergies.filter(
          (_, i) => i !== index
        );
        break;
      case 'supplement':
        updatedPreferences.supplementPreferences =
          updatedPreferences.supplementPreferences.filter(
            (_, i) => i !== index
          );
        break;
    }
    setAiPreferences(updatedPreferences);
    onUpdate({ aiTrainer: updatedPreferences });
  };

  const updatePreference = (key: keyof typeof aiPreferences, value: any) => {
    const updatedPreferences = { ...aiPreferences, [key]: value };
    setAiPreferences(updatedPreferences);
    onUpdate({ aiTrainer: updatedPreferences });
  };

  const user = useCurrentUser();
  console.log('AI preferences for user', user?.id, aiPreferences);
  return (
    <div className="space-y-6">
      {/* Enable/Disable AI Trainer */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          AI Trainer Settings
        </h3>
        <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <div className="flex items-center space-x-3">
            <Bot className="h-6 w-6 text-blue-600" />
            <div>
              <h4 className="font-medium text-gray-900 dark:text-white">
                Enable AI Trainer
              </h4>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Get personalized workout and nutrition advice from our AI
                trainer
              </p>
            </div>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={aiPreferences.enabled}
              onChange={(e) => updatePreference('enabled', e.target.checked)}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      {aiPreferences.enabled && (
        <>
          {/* Coaching Style */}
          {/* <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Coaching Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Coaching Style
                </label>
                <select
                  value={aiPreferences.coachingStyle}
                  onChange={(e) =>
                    updatePreference('coachingStyle', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="motivational">Motivational</option>
                  <option value="strict">Strict</option>
                  <option value="balanced">Balanced</option>
                  <option value="technical">Technical</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Communication Frequency
                </label>
                <select
                  value={aiPreferences.communicationFrequency}
                  onChange={(e) =>
                    updatePreference('communicationFrequency', e.target.value)
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="on-demand">On-Demand</option>
                </select>
              </div>
            </div>
          </div> */}

          {/* Focus Areas */}
          {/* <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Focus Areas
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <select
                  value={newItem.focusArea}
                  onChange={(e) =>
                    setNewItem({ ...newItem, focusArea: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select focus area</option>
                  {focusAreaOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => addItem('focusArea', newItem.focusArea)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiPreferences.focusAreas.map((area, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200"
                  >
                    {area}
                    <button
                      onClick={() => removeItem('focusArea', index)}
                      className="ml-2 text-blue-600 hover:text-blue-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div> */}

          {/* Equipment Available */}
          {/* <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Available Equipment
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <select
                  value={newItem.equipment}
                  onChange={(e) =>
                    setNewItem({ ...newItem, equipment: e.target.value })
                  }
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                >
                  <option value="">Select equipment</option>
                  {equipmentOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => addItem('equipment', newItem.equipment)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiPreferences.equipmentAvailable.map((equipment, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200"
                  >
                    {equipment}
                    <button
                      onClick={() => removeItem('equipment', index)}
                      className="ml-2 text-green-600 hover:text-green-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div> */}

          {/* Workout Preferences */}
          {/* <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Workout Preferences
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workout Duration (minutes)
                </label>
                <input
                  type="number"
                  value={aiPreferences.workoutDurationPreference}
                  onChange={(e) =>
                    updatePreference(
                      'workoutDurationPreference',
                      parseInt(e.target.value) || 60
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Workout Days per Week
                </label>
                <input
                  type="number"
                  min="1"
                  max="7"
                  value={aiPreferences.workoutDaysPerWeek}
                  onChange={(e) =>
                    updatePreference(
                      'workoutDaysPerWeek',
                      parseInt(e.target.value) || 3
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                />
              </div>
            </div>
          </div> */}

          {/* Nutrition Preferences */}
          {/* <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Nutrition Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Meal Preferences
                </label>
                <div className="flex space-x-2">
                  <select
                    value={newItem.mealPreference}
                    onChange={(e) =>
                      setNewItem({ ...newItem, mealPreference: e.target.value })
                    }
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="">Select meal preference</option>
                    {mealPreferenceOptions.map((option) => (
                      <option key={option} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() =>
                      addItem('mealPreference', newItem.mealPreference)
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {aiPreferences.mealPreferences.map((preference, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 dark:bg-orange-900 text-orange-800 dark:text-orange-200"
                    >
                      {preference}
                      <button
                        onClick={() => removeItem('mealPreference', index)}
                        className="ml-2 text-orange-600 hover:text-orange-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Allergies
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newItem.allergy}
                    onChange={(e) =>
                      setNewItem({ ...newItem, allergy: e.target.value })
                    }
                    placeholder="Enter allergy"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    onKeyPress={(e) =>
                      e.key === 'Enter' && addItem('allergy', newItem.allergy)
                    }
                  />
                  <button
                    onClick={() => addItem('allergy', newItem.allergy)}
                    className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {aiPreferences.allergies.map((allergy, index) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200"
                    >
                      {allergy}
                      <button
                        onClick={() => removeItem('allergy', index)}
                        className="ml-2 text-red-600 hover:text-red-800"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Supplement Preferences
                </label>
                <div className="flex space-x-2">
                  <input
                    type="text"
                    value={newItem.supplement}
                    onChange={(e) =>
                      setNewItem({ ...newItem, supplement: e.target.value })
                    }
                    placeholder="Enter supplement"
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    onKeyPress={(e) =>
                      e.key === 'Enter' &&
                      addItem('supplement', newItem.supplement)
                    }
                  />
                  <button
                    onClick={() => addItem('supplement', newItem.supplement)}
                    className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                  >
                    Add
                  </button>
                </div>
                <div className="flex flex-wrap gap-2 mt-2">
                  {aiPreferences.supplementPreferences.map(
                    (supplement, index) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200"
                      >
                        {supplement}
                        <button
                          onClick={() => removeItem('supplement', index)}
                          className="ml-2 text-purple-600 hover:text-purple-800"
                        >
                          ×
                        </button>
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </div> */}

          {/* Injury History */}
          {/* <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Injury History
            </h3>
            <div className="space-y-3">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newItem.injury}
                  onChange={(e) =>
                    setNewItem({ ...newItem, injury: e.target.value })
                  }
                  placeholder="Enter injury or limitation"
                  className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  onKeyPress={(e) =>
                    e.key === 'Enter' && addItem('injury', newItem.injury)
                  }
                />
                <button
                  onClick={() => addItem('injury', newItem.injury)}
                  className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700"
                >
                  Add
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {aiPreferences.injuryHistory.map((injury, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-yellow-100 dark:bg-yellow-900 text-yellow-800 dark:text-yellow-200"
                  >
                    {injury}
                    <button
                      onClick={() => removeItem('injury', index)}
                      className="ml-2 text-yellow-600 hover:text-yellow-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div> */}

          {/* AI Coaching Preferences Panel */}
          {user?.id && (
            <AICoachingPreferencesPanel
              userId={user.id}
              currentPreferences={aiPreferences}
              onPreferencesUpdate={(newPreferences) => {
                // Update the local state with new preferences
                setAiPreferences((prev) => ({
                  ...prev,
                  ...newPreferences,
                }));
              }}
            />
          )}
        </>
      )}
    </div>
  );
}

function SecurityTab() {
  const [formData, setFormData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
    // Clear error when user starts typing
    if (error) setError('');
    if (success) setSuccess('');
  };

  const togglePasswordVisibility = (field: 'current' | 'new' | 'confirm') => {
    setShowPasswords((prev) => ({
      ...prev,
      [field]: !prev[field],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');
    setSuccess('');

    // Validation
    if (formData.newPassword !== formData.confirmPassword) {
      setError('New passwords do not match');
      setIsLoading(false);
      return;
    }

    if (formData.newPassword.length < 8) {
      setError('New password must be at least 8 characters long');
      setIsLoading(false);
      return;
    }

    if (formData.currentPassword === formData.newPassword) {
      setError('New password must be different from current password');
      setIsLoading(false);
      return;
    }

    try {
      await updatePassword({
        oldPassword: formData.currentPassword,
        newPassword: formData.newPassword,
      });

      setSuccess('Password updated successfully!');
      setFormData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } catch (err) {
      console.error('Password update error:', err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Failed to update password. Please try again.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const getPasswordStrength = (password: string) => {
    let strength = 0;
    if (password.length >= 8) strength += 25;
    if (/[A-Z]/.test(password)) strength += 25;
    if (/[a-z]/.test(password)) strength += 25;
    if (/\d/.test(password)) strength += 12.5;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) strength += 12.5;
    return Math.min(strength, 100);
  };

  const passwordStrength = getPasswordStrength(formData.newPassword);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-medium text-gray-900 dark:text-white flex items-center">
          <Lock className="h-5 w-5 mr-2" />
          Change Password
        </h3>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          Update your password to keep your account secure
        </p>
      </div>

      {/* Success/Error Messages */}
      {success && (
        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
          <div className="flex items-center">
            <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400 mr-3" />
            <div className="text-green-600 dark:text-green-400">{success}</div>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <div className="flex items-center">
            <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400 mr-3" />
            <div className="text-red-600 dark:text-red-400">{error}</div>
          </div>
        </div>
      )}

      {/* Password Change Form */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Current Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.current ? 'text' : 'password'}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
                placeholder="Enter your current password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                         dark:bg-gray-700 dark:text-white pr-12"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('current')}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                {showPasswords.current ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
          </div>

          {/* New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.new ? 'text' : 'password'}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
                placeholder="Enter your new password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                         dark:bg-gray-700 dark:text-white pr-12"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('new')}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                {showPasswords.new ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>

            {/* Password Strength Indicator */}
            {formData.newPassword && (
              <div className="mt-3">
                <div className="flex justify-between text-sm mb-1">
                  <span className="text-gray-600 dark:text-gray-400">
                    Password Strength
                  </span>
                  <span
                    className={`font-medium ${
                      passwordStrength < 50
                        ? 'text-red-500'
                        : passwordStrength < 75
                          ? 'text-yellow-500'
                          : 'text-green-500'
                    }`}
                  >
                    {passwordStrength < 50
                      ? 'Weak'
                      : passwordStrength < 75
                        ? 'Medium'
                        : 'Strong'}
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full transition-all duration-300 ${
                      passwordStrength < 50
                        ? 'bg-red-500'
                        : passwordStrength < 75
                          ? 'bg-yellow-500'
                          : 'bg-green-500'
                    }`}
                    style={{ width: `${passwordStrength}%` }}
                  ></div>
                </div>

                {/* Password Requirements */}
                <div className="mt-3 space-y-1">
                  <div
                    className={`text-xs flex items-center ${
                      formData.newPassword.length >= 8
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        formData.newPassword.length >= 8
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    ></div>
                    At least 8 characters
                  </div>
                  <div
                    className={`text-xs flex items-center ${
                      /[A-Z]/.test(formData.newPassword) &&
                      /[a-z]/.test(formData.newPassword)
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        /[A-Z]/.test(formData.newPassword) &&
                        /[a-z]/.test(formData.newPassword)
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    ></div>
                    Uppercase & lowercase letters
                  </div>
                  <div
                    className={`text-xs flex items-center ${
                      /\d/.test(formData.newPassword)
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        /\d/.test(formData.newPassword)
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    ></div>
                    Numbers
                  </div>
                  <div
                    className={`text-xs flex items-center ${
                      /[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword)
                        ? 'text-green-600'
                        : 'text-gray-400'
                    }`}
                  >
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${
                        /[!@#$%^&*(),.?":{}|<>]/.test(formData.newPassword)
                          ? 'bg-green-500'
                          : 'bg-gray-300'
                      }`}
                    ></div>
                    Special characters
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showPasswords.confirm ? 'text' : 'password'}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
                placeholder="Confirm your new password"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg 
                         focus:ring-2 focus:ring-blue-500 focus:border-blue-500 
                         dark:bg-gray-700 dark:text-white pr-12"
              />
              <button
                type="button"
                onClick={() => togglePasswordVisibility('confirm')}
                className="absolute inset-y-0 right-0 flex items-center pr-3"
              >
                {showPasswords.confirm ? (
                  <EyeOff className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                ) : (
                  <Eye className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                )}
              </button>
            </div>
            {formData.confirmPassword &&
              formData.newPassword !== formData.confirmPassword && (
                <p className="mt-1 text-sm text-red-600">
                  Passwords do not match
                </p>
              )}
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={
                isLoading ||
                !formData.currentPassword ||
                !formData.newPassword ||
                !formData.confirmPassword ||
                formData.newPassword !== formData.confirmPassword
              }
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                       focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                       disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Updating...</span>
                </>
              ) : (
                <>
                  <Lock className="h-4 w-4" />
                  <span>Update Password</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Security Tips */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">
          🔒 Security Tips
        </h4>
        <ul className="text-sm text-blue-800 dark:text-blue-200 space-y-1">
          <li>• Use a unique password that you don't use elsewhere</li>
          <li>• Consider using a password manager</li>
          <li>• Change your password regularly</li>
          <li>• Never share your password with anyone</li>
        </ul>
      </div>
    </div>
  );
}

interface MeasurementsTabProps {
  measurements: BodyMeasurement[];
  currentWeight: string;
  currentBodyFat: string;
  onWeightChange: (value: string) => void;
  onBodyFatChange: (value: string) => void;
  onSave: () => void;
  saving: boolean;
  loading: boolean;
}

function MeasurementsTab({
  measurements,
  currentWeight,
  currentBodyFat,
  onWeightChange,
  onBodyFatChange,
  onSave,
  saving,
  loading,
}: MeasurementsTabProps) {
  const t = useTranslations('profile');

  return (
    <div className="space-y-6">
      {/* Add New Measurement */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Add New Measurement
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Weight (kg)
            </label>
            <input
              type="number"
              step="0.1"
              value={currentWeight}
              onChange={(e) => onWeightChange(e.target.value)}
              placeholder="Enter your current weight"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Body Fat (%)
            </label>
            <input
              type="number"
              step="0.1"
              value={currentBodyFat}
              onChange={(e) => onBodyFatChange(e.target.value)}
              placeholder="Enter your body fat percentage"
              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
        </div>

        <button
          onClick={onSave}
          disabled={saving || (!currentWeight && !currentBodyFat)}
          className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
        >
          <Save className="h-4 w-4" />
          <span>{saving ? 'Saving...' : 'Save Measurement'}</span>
        </button>
      </div>

      {/* Measurement History */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
        <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
          Recent Measurements
        </h3>

        {loading ? (
          <div className="text-center py-4">
            <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-gray-500 dark:text-gray-400 mt-2">
              Loading measurements...
            </p>
          </div>
        ) : measurements.length > 0 ? (
          <div className="space-y-3">
            {measurements.slice(0, 5).map((measurement, index) => (
              <div
                key={measurement.id || index}
                className="flex justify-between items-center py-3 px-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
              >
                <div className="flex flex-col">
                  <span className="font-medium text-gray-900 dark:text-white">
                    {new Date(measurement.date).toLocaleDateString()}
                  </span>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(measurement.date).toLocaleTimeString()}
                  </span>
                </div>
                <div className="flex flex-col items-end space-y-1">
                  {measurement.weight && (
                    <span className="text-gray-900 dark:text-white">
                      Weight: {measurement.weight} kg
                    </span>
                  )}
                  {measurement.bodyFat && (
                    <span className="text-gray-900 dark:text-white">
                      Body Fat: {measurement.bodyFat}%
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Weight className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400">
              No measurements recorded yet. Add your first measurement above!
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
