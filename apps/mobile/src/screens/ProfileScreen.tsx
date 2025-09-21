import React, { useEffect, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, TextInput, RefreshControl, Switch } from 'react-native';
import { getCurrentUser, fetchUserAttributes } from 'aws-amplify/auth';
import { useApi, apiFetch } from '../hooks/useApi';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ErrorMessage } from '../components/ErrorMessage';

interface UserProfile {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth?: string;
  height?: number;
  weight?: number;
  bio?: string;
  fitness_goals: string[];
  experience_level: 'beginner' | 'intermediate' | 'advanced';
  profile_image_url?: string;
  preferences: {
    units: 'metric' | 'imperial';
    notifications: {
      email: boolean;
      push: boolean;
      workout_reminders: boolean;
      nutrition_reminders: boolean;
    };
    privacy: {
      profile_visibility: 'public' | 'private' | 'friends';
      workout_sharing: boolean;
      progress_sharing: boolean;
    };
  };
  created_at: string;
  updated_at: string;
}

export function ProfileScreen({ onSignOut }: { onSignOut: () => void }) {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadUser();
    fetchProfile();
  }, []);

  const loadUser = async () => {
    try {
      const currentUser = await getCurrentUser();
      const attributes = await fetchUserAttributes();
      setUser({ ...currentUser, attributes });
    } catch (error) {
      console.error('Error loading user:', error);
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await apiFetch<{ statusCode: number; body: UserProfile }>('/api/user-profiles/profile');
      
      if (response.statusCode === 200) {
        setProfile(response.body);
      } else {
        // Create default profile from user attributes
        const defaultProfile: UserProfile = {
          id: user?.userId || '',
          first_name: user?.attributes?.given_name || '',
          last_name: user?.attributes?.family_name || '',
          email: user?.attributes?.email || '',
          date_of_birth: '',
          height: 0,
          weight: 0,
          fitness_goals: user?.attributes?.['custom:fitnessGoals']?.split(',') || [],
          experience_level: user?.attributes?.['custom:experienceLevel'] || 'beginner',
          profile_image_url: '',
          preferences: {
            units: 'metric',
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
      console.error('Failed to fetch profile:', e);
      // Create default profile
      const defaultProfile: UserProfile = {
        id: user?.userId || '',
        first_name: user?.attributes?.given_name || '',
        last_name: user?.attributes?.family_name || '',
        email: user?.attributes?.email || '',
        date_of_birth: '',
        height: 0,
        weight: 0,
        fitness_goals: user?.attributes?.['custom:fitnessGoals']?.split(',') || [],
        experience_level: user?.attributes?.['custom:experienceLevel'] || 'beginner',
        profile_image_url: '',
        preferences: {
          units: 'metric',
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
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadUser();
    await fetchProfile();
    setRefreshing(false);
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
      console.error('Failed to save profile:', e);
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

  if (!profile) {
    return <LoadingSpinner message="Loading profile..." />;
  }

  return (
    <ScrollView 
      className="flex-1 bg-gray-50"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
      }
    >
      <View className="p-4">
        {/* Header */}
        <View className="flex-row justify-between items-center mb-6">
          <View>
            <Text className="text-2xl font-bold text-gray-900">Profile</Text>
            <Text className="text-gray-600">Manage your personal information</Text>
          </View>
          <View className="flex-row space-x-2">
            {editing ? (
              <>
                <TouchableOpacity
                  onPress={() => setEditing(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg"
                >
                  <Text className="text-gray-700 font-semibold">Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  onPress={saveProfile}
                  disabled={saving}
                  className="bg-blue-600 rounded-lg px-4 py-2"
                >
                  <Text className="text-white font-semibold">
                    {saving ? 'Saving...' : 'Save'}
                  </Text>
                </TouchableOpacity>
              </>
            ) : (
              <TouchableOpacity
                onPress={() => setEditing(true)}
                className="bg-blue-600 rounded-lg px-4 py-2"
              >
                <Text className="text-white font-semibold">Edit</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Profile Header */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <View className="flex-row items-center space-x-4">
            <View className="w-16 h-16 bg-gray-300 rounded-full items-center justify-center">
              <Text className="text-2xl">👤</Text>
            </View>
            <View className="flex-1">
              <Text className="text-xl font-semibold text-gray-900">
                {profile.first_name} {profile.last_name}
              </Text>
              <Text className="text-gray-600">{profile.email}</Text>
              {profile.bio && (
                <Text className="text-sm text-gray-500 mt-2">{profile.bio}</Text>
              )}
            </View>
          </View>
        </View>

        {/* Personal Information */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Personal Information
          </Text>
          <View className="space-y-4">
            <View className="flex-row space-x-4">
              <View className="flex-1">
                <Text className="block text-sm font-medium text-gray-700 mb-1">
                  First Name
                </Text>
                {editing ? (
                  <TextInput
                    value={profile.first_name}
                    onChangeText={(text) => updateProfile({ first_name: text })}
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  />
                ) : (
                  <Text className="text-gray-900">{profile.first_name}</Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="block text-sm font-medium text-gray-700 mb-1">
                  Last Name
                </Text>
                {editing ? (
                  <TextInput
                    value={profile.last_name}
                    onChangeText={(text) => updateProfile({ last_name: text })}
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  />
                ) : (
                  <Text className="text-gray-900">{profile.last_name}</Text>
                )}
              </View>
            </View>

            <View>
              <Text className="block text-sm font-medium text-gray-700 mb-1">
                Date of Birth
              </Text>
              {editing ? (
                <TextInput
                  value={profile.date_of_birth || ''}
                  onChangeText={(text) => updateProfile({ date_of_birth: text })}
                  placeholder="YYYY-MM-DD"
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                />
              ) : (
                <Text className="text-gray-900">
                  {profile.date_of_birth || 'Not set'}
                </Text>
              )}
            </View>

            <View className="flex-row space-x-4">
              <View className="flex-1">
                <Text className="block text-sm font-medium text-gray-700 mb-1">
                  Height (cm)
                </Text>
                {editing ? (
                  <TextInput
                    value={profile.height?.toString() || ''}
                    onChangeText={(text) => updateProfile({ height: Number(text) })}
                    keyboardType="numeric"
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  />
                ) : (
                  <Text className="text-gray-900">
                    {profile.height ? `${profile.height} cm` : 'Not set'}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <Text className="block text-sm font-medium text-gray-700 mb-1">
                  Weight (kg)
                </Text>
                {editing ? (
                  <TextInput
                    value={profile.weight?.toString() || ''}
                    onChangeText={(text) => updateProfile({ weight: Number(text) })}
                    keyboardType="numeric"
                    className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                  />
                ) : (
                  <Text className="text-gray-900">
                    {profile.weight ? `${profile.weight} kg` : 'Not set'}
                  </Text>
                )}
              </View>
            </View>

            <View>
              <Text className="block text-sm font-medium text-gray-700 mb-1">
                Bio
              </Text>
              {editing ? (
                <TextInput
                  value={profile.bio || ''}
                  onChangeText={(text) => updateProfile({ bio: text })}
                  placeholder="Tell us about yourself..."
                  multiline
                  numberOfLines={3}
                  className="border border-gray-300 rounded-lg px-3 py-2 bg-white"
                />
              ) : (
                <Text className="text-gray-900">
                  {profile.bio || 'No bio provided'}
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* Fitness Goals */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Fitness Goals
          </Text>
          <View className="space-y-4">
            <View>
              <Text className="block text-sm font-medium text-gray-700 mb-2">
                Experience Level
              </Text>
              {editing ? (
                <View className="flex-row space-x-2">
                  {['beginner', 'intermediate', 'advanced'].map((level) => (
                    <TouchableOpacity
                      key={level}
                      onPress={() => updateProfile({ experience_level: level as any })}
                      className={`px-3 py-2 rounded-lg ${
                        profile.experience_level === level ? 'bg-blue-600' : 'bg-gray-100'
                      }`}
                    >
                      <Text className={`text-sm font-medium ${
                        profile.experience_level === level ? 'text-white' : 'text-gray-700'
                      }`}>
                        {level.charAt(0).toUpperCase() + level.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text className="text-gray-900 capitalize">
                  {profile.experience_level}
                </Text>
              )}
            </View>

            <View>
              <Text className="block text-sm font-medium text-gray-700 mb-2">
                Goals
              </Text>
              {editing ? (
                <View className="space-y-2">
                  {[
                    'Build muscle',
                    'Lose weight',
                    'Improve endurance',
                    'Get stronger',
                    'Stay healthy',
                  ].map((goal) => (
                    <View key={goal} className="flex-row items-center">
                      <Switch
                        value={profile.fitness_goals.includes(goal)}
                        onValueChange={(checked) => {
                          if (checked) {
                            updateProfile({
                              fitness_goals: [...profile.fitness_goals, goal],
                            });
                          } else {
                            updateProfile({
                              fitness_goals: profile.fitness_goals.filter((g) => g !== goal),
                            });
                          }
                        }}
                      />
                      <Text className="text-gray-900 ml-2">{goal}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <View className="flex-row flex-wrap">
                  {profile.fitness_goals.map((goal, index) => (
                    <View
                      key={index}
                      className="bg-blue-100 px-2 py-1 rounded-full mr-2 mb-2"
                    >
                      <Text className="text-blue-800 text-sm">{goal}</Text>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Preferences */}
        <View className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
          <Text className="text-lg font-semibold text-gray-900 mb-4">
            Preferences
          </Text>
          <View className="space-y-4">
            <View>
              <Text className="block text-sm font-medium text-gray-700 mb-2">
                Units
              </Text>
              {editing ? (
                <View className="flex-row space-x-2">
                  {['metric', 'imperial'].map((unit) => (
                    <TouchableOpacity
                      key={unit}
                      onPress={() => updateProfile({
                        preferences: { ...profile.preferences, units: unit as any }
                      })}
                      className={`px-3 py-2 rounded-lg ${
                        profile.preferences.units === unit ? 'bg-blue-600' : 'bg-gray-100'
                      }`}
                    >
                      <Text className={`text-sm font-medium ${
                        profile.preferences.units === unit ? 'text-white' : 'text-gray-700'
                      }`}>
                        {unit.charAt(0).toUpperCase() + unit.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <Text className="text-gray-900 capitalize">
                  {profile.preferences.units}
                </Text>
              )}
            </View>

            <View>
              <Text className="block text-sm font-medium text-gray-700 mb-2">
                Notifications
              </Text>
              <View className="space-y-2">
                {Object.entries(profile.preferences.notifications).map(
                  ([key, value]) => (
                    <View key={key} className="flex-row items-center justify-between">
                      <Text className="text-gray-900 capitalize">
                        {key.replace('_', ' ')}
                      </Text>
                      <Switch
                        value={value}
                        onValueChange={(checked) =>
                          updateProfile({
                            preferences: {
                              ...profile.preferences,
                              notifications: {
                                ...profile.preferences.notifications,
                                [key]: checked,
                              },
                            },
                          })
                        }
                        disabled={!editing}
                      />
                    </View>
                  )
                )}
              </View>
            </View>
          </View>
        </View>

        {/* Sign Out */}
        <TouchableOpacity
          onPress={onSignOut}
          className="bg-red-600 rounded-lg py-3 mb-6"
        >
          <Text className="text-white font-semibold text-center">Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}
