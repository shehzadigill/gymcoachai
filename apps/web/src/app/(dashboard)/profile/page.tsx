'use client';

import { useEffect, useState } from 'react';
import { apiFetch } from '../../../lib/api-client';
import { useCurrentUser } from '../../../../../../packages/auth/dist/hooks/useCurrentUser';
import {
  User,
  Mail,
  Calendar,
  Target,
  Settings,
  Camera,
  Save,
  Edit,
  Check,
  X,
} from 'lucide-react';

interface UserProfile {
  first_name: string;
  last_name: string;
  email: string;
  bio?: string;
  date_of_birth?: string;
  height?: number; // in cm
  weight?: number; // in kg
  fitness_goals: string[];
  experience_level: string;
  profile_image_url?: string;
  preferences: {
    units: string;
    timezone: string;
    notifications: {
      email: boolean;
      push: boolean;
      workout_reminders: boolean;
      nutrition_reminders: boolean;
    };
    privacy: {
      profile_visibility: string;
      workout_sharing: boolean;
      progress_sharing: boolean;
    };
  };
  created_at: string;
  updated_at: string;
}

export default function ProfilePage() {
  const { user } = useCurrentUser();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError(null);

      const response = await apiFetch<{
        statusCode: number;
        body: UserProfile;
      }>('/api/user-profiles/profile');

      if (response.statusCode === 200) {
        setProfile(response.body);
      } else if (response.statusCode === 404) {
        // Create a default profile if none exists
        const defaultProfile: UserProfile = {
          first_name: user?.attributes?.given_name || '',
          last_name: user?.attributes?.family_name || '',
          email: user?.attributes?.email || '',
          bio: '',
          date_of_birth: '',
          height: 0,
          weight: 0,
          fitness_goals:
            user?.attributes?.['custom:fitnessGoals']?.split(',') || [],
          experience_level:
            user?.attributes?.['custom:experienceLevel'] || 'beginner',
          profile_image_url: '',
          preferences: {
            units: 'metric',
            timezone: 'UTC',
            notifications: {
              email: true,
              push: true,
              workout_reminders: true,
              nutrition_reminders: true,
            },
            privacy: {
              profile_visibility: 'private',
              workout_sharing: false,
              progress_sharing: false,
            },
          },
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };
        setProfile(defaultProfile);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const saveProfile = async () => {
    if (!profile) return;

    try {
      setSaving(true);

      const response = await apiFetch('/api/user-profiles/profile', {
        method: 'PUT',
        body: JSON.stringify(profile),
      });

      if (response.statusCode === 200) {
        setEditing(false);
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  const updateProfile = (updates: Partial<UserProfile>) => {
    if (!profile) return;
    setProfile({
      ...profile,
      ...updates,
      updated_at: new Date().toISOString(),
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <div className="text-red-600 dark:text-red-400">{error}</div>
      </div>
    );
  }

  if (!profile) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Profile
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Manage your personal information
          </p>
        </div>
        <div className="flex space-x-2">
          {editing ? (
            <>
              <button
                onClick={saveProfile}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <Save className="h-4 w-4" />
                <span>{saving ? 'Saving...' : 'Save'}</span>
              </button>
              <button
                onClick={() => setEditing(false)}
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
              >
                <X className="h-4 w-4" />
                <span>Cancel</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center space-x-2"
            >
              <Edit className="h-4 w-4" />
              <span>Edit</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Picture & Basic Info */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="text-center">
              <div className="relative inline-block">
                <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  {profile.profile_image_url ? (
                    <img
                      src={profile.profile_image_url}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-12 w-12 text-gray-400" />
                  )}
                </div>
                {editing && (
                  <button className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full">
                    <Camera className="h-4 w-4" />
                  </button>
                )}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {profile.first_name} {profile.last_name}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {profile.email}
              </p>
              {profile.bio && (
                <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
                  {profile.bio}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Personal Information */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Personal Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  First Name
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={profile.first_name}
                    onChange={(e) =>
                      updateProfile({ first_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {profile.first_name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Last Name
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={profile.last_name}
                    onChange={(e) =>
                      updateProfile({ last_name: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {profile.last_name}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Email
                </label>
                <p className="text-gray-900 dark:text-white">{profile.email}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date of Birth
                </label>
                {editing ? (
                  <input
                    type="date"
                    value={profile.date_of_birth || ''}
                    onChange={(e) =>
                      updateProfile({ date_of_birth: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  />
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {profile.date_of_birth || 'Not set'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Height
                </label>
                {editing ? (
                  <div className="flex">
                    <input
                      type="number"
                      value={profile.height || ''}
                      onChange={(e) =>
                        updateProfile({ height: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <span className="ml-2 text-gray-500 dark:text-gray-400 self-center">
                      cm
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {profile.height ? `${profile.height} cm` : 'Not set'}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Weight
                </label>
                {editing ? (
                  <div className="flex">
                    <input
                      type="number"
                      step="0.1"
                      value={profile.weight || ''}
                      onChange={(e) =>
                        updateProfile({ weight: Number(e.target.value) })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                    <span className="ml-2 text-gray-500 dark:text-gray-400 self-center">
                      kg
                    </span>
                  </div>
                ) : (
                  <p className="text-gray-900 dark:text-white">
                    {profile.weight ? `${profile.weight} kg` : 'Not set'}
                  </p>
                )}
              </div>
            </div>
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Bio
              </label>
              {editing ? (
                <textarea
                  value={profile.bio || ''}
                  onChange={(e) => updateProfile({ bio: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  placeholder="Tell us about yourself..."
                />
              ) : (
                <p className="text-gray-900 dark:text-white">
                  {profile.bio || 'No bio provided'}
                </p>
              )}
            </div>
          </div>

          {/* Fitness Goals */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Fitness Goals
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Experience Level
                </label>
                {editing ? (
                  <select
                    value={profile.experience_level}
                    onChange={(e) =>
                      updateProfile({ experience_level: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Intermediate</option>
                    <option value="advanced">Advanced</option>
                  </select>
                ) : (
                  <p className="text-gray-900 dark:text-white capitalize">
                    {profile.experience_level}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Goals
                </label>
                {editing ? (
                  <div className="space-y-2">
                    {[
                      'Build muscle',
                      'Lose weight',
                      'Improve endurance',
                      'Get stronger',
                      'Stay healthy',
                    ].map((goal) => (
                      <label key={goal} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={profile.fitness_goals.includes(goal)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              updateProfile({
                                fitness_goals: [...profile.fitness_goals, goal],
                              });
                            } else {
                              updateProfile({
                                fitness_goals: profile.fitness_goals.filter(
                                  (g) => g !== goal
                                ),
                              });
                            }
                          }}
                          className="mr-2"
                        />
                        <span className="text-gray-900 dark:text-white">
                          {goal}
                        </span>
                      </label>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {profile.fitness_goals.map((goal, index) => (
                      <span
                        key={index}
                        className="bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-sm"
                      >
                        {goal}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Preferences */}
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Preferences
            </h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Units
                </label>
                {editing ? (
                  <select
                    value={profile.preferences.units}
                    onChange={(e) =>
                      updateProfile({
                        preferences: {
                          ...profile.preferences,
                          units: e.target.value,
                        },
                      })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  >
                    <option value="metric">Metric</option>
                    <option value="imperial">Imperial</option>
                  </select>
                ) : (
                  <p className="text-gray-900 dark:text-white capitalize">
                    {profile.preferences.units}
                  </p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Notifications
                </label>
                <div className="space-y-2">
                  {Object.entries(profile.preferences.notifications).map(
                    ([key, value]) => (
                      <label key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) =>
                            updateProfile({
                              preferences: {
                                ...profile.preferences,
                                notifications: {
                                  ...profile.preferences.notifications,
                                  [key]: e.target.checked,
                                },
                              },
                            })
                          }
                          disabled={!editing}
                          className="mr-2"
                        />
                        <span className="text-gray-900 dark:text-white capitalize">
                          {key.replace('_', ' ')}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
