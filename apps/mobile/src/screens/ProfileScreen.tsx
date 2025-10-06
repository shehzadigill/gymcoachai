import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
} from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { Card, Button, LoadingSpinner } from '../components/common/UI';
import notificationService from '../services/safeNotifications';

export default function ProfileScreen() {
  const { user, userProfile, signOut, updateProfile, isLoading } = useAuth();
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: userProfile?.firstName || '',
    lastName: userProfile?.lastName || '',
    height: userProfile?.height?.toString() || '',
    weight: userProfile?.weight?.toString() || '',
    fitnessLevel: userProfile?.fitnessLevel || 'beginner',
  });
  const [notificationSettings, setNotificationSettings] = useState({
    workoutReminders: true,
    nutritionReminders: true,
    progressUpdates: true,
  });
  const [saving, setSaving] = useState(false);

  React.useEffect(() => {
    loadNotificationSettings();
  }, []);

  const loadNotificationSettings = async () => {
    try {
      const settings = await notificationService.getNotificationSettings();
      setNotificationSettings(settings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const handleSaveProfile = async () => {
    try {
      setSaving(true);

      const updatedData = {
        firstName: profileData.firstName.trim(),
        lastName: profileData.lastName.trim(),
        height: profileData.height ? parseFloat(profileData.height) : undefined,
        weight: profileData.weight ? parseFloat(profileData.weight) : undefined,
        fitnessLevel: profileData.fitnessLevel as
          | 'beginner'
          | 'intermediate'
          | 'advanced',
      };

      await updateProfile(updatedData);
      setEditing(false);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleNotificationToggle = async (key: string, value: boolean) => {
    try {
      const newSettings = { ...notificationSettings, [key]: value };
      setNotificationSettings(newSettings);

      await notificationService.saveNotificationSettings(newSettings);

      if (key === 'nutritionReminders') {
        if (value) {
          // Enable nutrition reminders with default times
          notificationService.scheduleNutritionReminders([
            '08:00',
            '13:00',
            '19:00',
          ]);
        } else {
          // Disable nutrition reminders
          notificationService.cancelNutritionReminders();
        }
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handleSignOut = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch (error: any) {
            Alert.alert('Error', error.message || 'Failed to sign out');
          }
        },
      },
    ]);
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Profile</Text>
          <TouchableOpacity
            onPress={() => setEditing(!editing)}
            style={styles.editButton}
          >
            <Text style={styles.editButtonText}>
              {editing ? 'Cancel' : 'Edit'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* User Info */}
        <Card style={styles.userInfoCard}>
          <View style={styles.avatarContainer}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {userProfile?.firstName?.[0] ||
                  user?.email?.[0]?.toUpperCase() ||
                  '?'}
              </Text>
            </View>
            <View style={styles.userBasicInfo}>
              <Text style={styles.userName}>
                {userProfile?.firstName && userProfile?.lastName
                  ? `${userProfile.firstName} ${userProfile.lastName}`
                  : 'User'}
              </Text>
              <Text style={styles.userEmail}>{user?.email}</Text>
            </View>
          </View>
        </Card>

        {/* Personal Information */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Personal Information</Text>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>First Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profileData.firstName}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, firstName: text })
                }
                editable={editing}
                placeholder="First name"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Last Name</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profileData.lastName}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, lastName: text })
                }
                editable={editing}
                placeholder="Last name"
              />
            </View>
          </View>

          <View style={styles.inputRow}>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Height (cm)</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profileData.height}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, height: text })
                }
                editable={editing}
                placeholder="170"
                keyboardType="numeric"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.inputLabel}>Weight (kg)</Text>
              <TextInput
                style={[styles.input, !editing && styles.inputDisabled]}
                value={profileData.weight}
                onChangeText={(text) =>
                  setProfileData({ ...profileData, weight: text })
                }
                editable={editing}
                placeholder="70"
                keyboardType="numeric"
              />
            </View>
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.inputLabel}>Fitness Level</Text>
            <View style={styles.fitnessLevelContainer}>
              {['beginner', 'intermediate', 'advanced'].map((level) => (
                <TouchableOpacity
                  key={level}
                  style={[
                    styles.fitnessLevelOption,
                    profileData.fitnessLevel === level &&
                      styles.fitnessLevelSelected,
                    !editing && styles.fitnessLevelDisabled,
                  ]}
                  onPress={() =>
                    editing &&
                    setProfileData({
                      ...profileData,
                      fitnessLevel: level as
                        | 'beginner'
                        | 'intermediate'
                        | 'advanced',
                    })
                  }
                  disabled={!editing}
                >
                  <Text
                    style={[
                      styles.fitnessLevelText,
                      profileData.fitnessLevel === level &&
                        styles.fitnessLevelTextSelected,
                    ]}
                  >
                    {level.charAt(0).toUpperCase() + level.slice(1)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {editing && (
            <Button
              title="Save Changes"
              onPress={handleSaveProfile}
              loading={saving}
              style={styles.saveButton}
            />
          )}
        </Card>

        {/* Notification Settings */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Notification Settings</Text>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Workout Reminders</Text>
              <Text style={styles.settingDescription}>
                Get notified about scheduled workouts
              </Text>
            </View>
            <Switch
              value={notificationSettings.workoutReminders}
              onValueChange={(value) =>
                handleNotificationToggle('workoutReminders', value)
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Nutrition Reminders</Text>
              <Text style={styles.settingDescription}>
                Get reminded to log your meals
              </Text>
            </View>
            <Switch
              value={notificationSettings.nutritionReminders}
              onValueChange={(value) =>
                handleNotificationToggle('nutritionReminders', value)
              }
            />
          </View>

          <View style={styles.settingItem}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingName}>Progress Updates</Text>
              <Text style={styles.settingDescription}>
                Get notified about your achievements
              </Text>
            </View>
            <Switch
              value={notificationSettings.progressUpdates}
              onValueChange={(value) =>
                handleNotificationToggle('progressUpdates', value)
              }
            />
          </View>
        </Card>

        {/* Account Actions */}
        <Card style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.actionItem} onPress={handleSignOut}>
            <Text style={styles.signOutText}>Sign Out</Text>
          </TouchableOpacity>
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
  },
  editButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#3b82f6',
    borderRadius: 6,
  },
  editButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  userInfoCard: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  avatarContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  avatarText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  userBasicInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 20,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: '#6b7280',
  },
  sectionCard: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 16,
  },
  inputRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  inputHalf: {
    flex: 1,
  },
  inputGroup: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  inputDisabled: {
    backgroundColor: '#f9fafb',
    color: '#6b7280',
  },
  fitnessLevelContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  fitnessLevelOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center',
    backgroundColor: '#ffffff',
  },
  fitnessLevelSelected: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  fitnessLevelDisabled: {
    backgroundColor: '#f9fafb',
  },
  fitnessLevelText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  fitnessLevelTextSelected: {
    color: '#3b82f6',
  },
  saveButton: {
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingName: {
    fontSize: 16,
    fontWeight: '500',
    color: '#111827',
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 14,
    color: '#6b7280',
  },
  actionItem: {
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  signOutText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#ef4444',
  },
});
