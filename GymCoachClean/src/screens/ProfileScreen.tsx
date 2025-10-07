import React, {useState, useEffect} from 'react';
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
  Modal,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {Card, Button, LoadingSpinner} from '../components/common/UI';
import notificationService from '../services/notifications';
import apiClient from '../services/api';

export default function ProfileScreen() {
  const {user, userProfile, signOut, updateProfile, isLoading, refreshUser} =
    useAuth();
  const [activeTab, setActiveTab] = useState<'profile' | 'goals' | 'settings'>(
    'profile',
  );
  const [editing, setEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    bio: '',
    height: '',
    weight: '',
    fitnessLevel: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    birthDate: '',
    gender: '',
  });
  const [dailyGoals, setDailyGoals] = useState({
    calories: 2000,
    water: 8, // glasses
    protein: 150, // grams
    carbs: 200, // grams
    fat: 65, // grams
  });
  const [fitnessGoals, setFitnessGoals] = useState<string[]>(
    userProfile?.goals || [],
  );
  const [newGoal, setNewGoal] = useState('');
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [notificationSettings, setNotificationSettings] = useState({
    workoutReminders: true,
    nutritionReminders: true,
    progressUpdates: true,
  });
  const [saving, setSaving] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([loadNotificationSettings(), loadDailyGoals()]);
        loadUserProfileData();
      } catch (error) {
        console.error('Error loading profile screen data:', error);
      }
    };

    loadData();
  }, [user, userProfile]);

  useEffect(() => {
    // Only try to refresh if we haven't tried before and user is authenticated
    // Don't auto-refresh to avoid infinite loops with API errors
    if (user && !userProfile && !saving) {
      console.log('User authenticated but no profile data available');
      // We'll rely on manual refresh instead of automatic refresh
      // to avoid redirect loops when API returns errors
    }
  }, [user, userProfile, saving]);

  const loadUserProfileData = () => {
    console.log('Loading user profile data:', userProfile);
    if (userProfile) {
      setProfileData({
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        email: user?.email || '',
        bio: userProfile.bio || '',
        height: userProfile.height?.toString() || '',
        weight: userProfile.weight?.toString() || '',
        fitnessLevel: userProfile.fitnessLevel || 'beginner',
        birthDate: userProfile.birthDate || '',
        gender: userProfile.gender || '',
      });

      // Update fitness goals if they exist
      if (userProfile.goals && userProfile.goals.length > 0) {
        setFitnessGoals(userProfile.goals);
      }

      // Update daily goals if they exist
      if (userProfile.preferences?.dailyGoals) {
        setDailyGoals(userProfile.preferences.dailyGoals);
      }
    } else {
      console.log('No userProfile data available');
    }
  };

  const loadNotificationSettings = async () => {
    try {
      const settings = await notificationService.getNotificationSettings();
      setNotificationSettings(settings);
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const loadDailyGoals = async () => {
    try {
      setLoadingGoals(true);

      // First try to load from user profile preferences (saved goals)
      if (userProfile?.preferences?.dailyGoals) {
        setDailyGoals(userProfile.preferences.dailyGoals);
        return;
      }

      // Fall back to nutrition stats API if no saved goals
      const nutritionStats = await apiClient.getNutritionStats();
      if (nutritionStats) {
        setDailyGoals({
          calories:
            nutritionStats.daily_goal || nutritionStats.calorieGoal || 2000,
          water: nutritionStats.water_goal || 8,
          protein: nutritionStats.protein_goal || 150,
          carbs: nutritionStats.carb_goal || 200,
          fat: nutritionStats.fat_goal || 65,
        });
      }
    } catch (error) {
      console.error('Error loading daily goals:', error);
      // Keep default values if API fails
    } finally {
      setLoadingGoals(false);
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
        birthDate: profileData.birthDate || undefined,
        gender: profileData.gender as 'male' | 'female' | 'other' | undefined,
        goals: fitnessGoals,
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

  const addFitnessGoal = async () => {
    const goal = newGoal.trim();
    if (goal && !fitnessGoals.includes(goal)) {
      setLoadingGoals(true);
      const updatedGoals = [...fitnessGoals, goal];
      setFitnessGoals(updatedGoals);
      setNewGoal('');
      setShowGoalModal(false);

      // Save to backend immediately using dedicated API method
      try {
        await apiClient.updateFitnessGoals(updatedGoals);
        console.log('Fitness goal added and saved:', goal);
      } catch (error) {
        console.error('Error saving fitness goal:', error);
        Alert.alert('Error', 'Failed to save fitness goal. Please try again.');
        // Revert local state if save failed
        setFitnessGoals(fitnessGoals);
      } finally {
        setLoadingGoals(false);
      }
    }
  };

  const removeFitnessGoal = async (goalToRemove: string) => {
    setLoadingGoals(true);
    const updatedGoals = fitnessGoals.filter(goal => goal !== goalToRemove);
    setFitnessGoals(updatedGoals);

    // Save to backend immediately using dedicated API method
    try {
      await apiClient.updateFitnessGoals(updatedGoals);
      console.log('Fitness goal removed and saved:', goalToRemove);
    } catch (error) {
      console.error('Error saving fitness goal removal:', error);
      Alert.alert('Error', 'Failed to remove fitness goal. Please try again.');
      // Revert local state if save failed
      setFitnessGoals(fitnessGoals);
    } finally {
      setLoadingGoals(false);
    }
  };
  const updateDailyGoal = (key: keyof typeof dailyGoals, value: number) => {
    setDailyGoals(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  const saveDailyGoals = async () => {
    setSaving(true);
    try {
      // Save daily goals to backend using dedicated API method
      await apiClient.updateDailyGoals(dailyGoals);
      console.log('Daily goals saved successfully:', dailyGoals);
      Alert.alert('Success', 'Daily goals saved successfully!');
    } catch (error) {
      console.error('Error saving daily goals:', error);
      Alert.alert('Error', 'Failed to save daily goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const handleNotificationToggle = async (key: string, value: boolean) => {
    try {
      const newSettings = {...notificationSettings, [key]: value};
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
      {text: 'Cancel', style: 'cancel'},
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

  // Debug logging
  console.log(
    'ProfileScreen render - user:',
    user?.email,
    'userProfile:',
    userProfile?.firstName,
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Profile</Text>
        <View style={styles.headerButtons}>
          {!userProfile && (
            <TouchableOpacity
              onPress={() => {
                console.log('Manual refresh triggered');
                setSaving(true);
                refreshUser()
                  .then(() => {
                    console.log('Manual refresh completed successfully');
                  })
                  .catch(error => {
                    console.error('Manual refresh failed:', error);
                    Alert.alert(
                      'Refresh Failed',
                      'Unable to load profile data. This might be a temporary server issue.',
                      [{text: 'OK'}],
                    );
                  })
                  .finally(() => {
                    setSaving(false);
                  });
              }}
              style={[styles.editButton, styles.refreshButton]}
              disabled={saving}>
              <Text style={styles.editButtonText}>
                {saving ? 'Loading...' : 'Refresh'}
              </Text>
            </TouchableOpacity>
          )}
          {activeTab === 'profile' && (
            <TouchableOpacity
              onPress={() => setEditing(!editing)}
              style={styles.editButton}>
              <Text style={styles.editButtonText}>
                {editing ? 'Cancel' : 'Edit'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* User Info */}
      <Card style={styles.userInfoCard}>
        <View style={styles.avatarContainer}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {profileData.firstName?.[0] ||
                userProfile?.firstName?.[0] ||
                user?.email?.[0]?.toUpperCase() ||
                '?'}
            </Text>
          </View>
          <View style={styles.userBasicInfo}>
            <Text style={styles.userName}>
              {profileData.firstName && profileData.lastName
                ? `${profileData.firstName} ${profileData.lastName}`
                : userProfile?.firstName && userProfile?.lastName
                ? `${userProfile.firstName} ${userProfile.lastName}`
                : 'User'}
            </Text>
            <Text style={styles.userEmail}>{user?.email}</Text>
          </View>
        </View>
      </Card>

      {/* Tab Navigation */}
      <View style={styles.tabContainer}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'profile' && styles.activeTab]}
          onPress={() => setActiveTab('profile')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'profile' && styles.activeTabText,
            ]}>
            Profile
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'goals' && styles.activeTab]}
          onPress={() => setActiveTab('goals')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'goals' && styles.activeTabText,
            ]}>
            Goals
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'settings' && styles.activeTab]}
          onPress={() => setActiveTab('settings')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'settings' && styles.activeTabText,
            ]}>
            Settings
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile Tab Content */}
        {activeTab === 'profile' && (
          <>
            {editing ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Personal Information</Text>

                <View style={styles.formField}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.firstName}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, firstName: text}))
                    }
                    placeholder="Enter first name"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.lastName}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, lastName: text}))
                    }
                    placeholder="Enter last name"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>Bio</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={profileData.bio || ''}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, bio: text}))
                    }
                    placeholder="Tell us about yourself..."
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>Date of Birth</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.birthDate}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, birthDate: text}))
                    }
                    placeholder="YYYY-MM-DD"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>Gender</Text>
                  <View style={styles.genderContainer}>
                    {['male', 'female', 'other'].map(gender => (
                      <TouchableOpacity
                        key={gender}
                        style={[
                          styles.genderOption,
                          profileData.gender === gender &&
                            styles.selectedGender,
                        ]}
                        onPress={() =>
                          setProfileData(prev => ({
                            ...prev,
                            gender: gender as 'male' | 'female' | 'other',
                          }))
                        }>
                        <Text
                          style={[
                            styles.genderText,
                            profileData.gender === gender &&
                              styles.selectedGenderText,
                          ]}>
                          {gender.charAt(0).toUpperCase() + gender.slice(1)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Text style={styles.sectionSubtitle}>Physical Information</Text>

                <View style={styles.formField}>
                  <Text style={styles.label}>Height (cm)</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.height}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, height: text}))
                    }
                    placeholder="Enter height in cm"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>Weight (kg)</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.weight}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, weight: text}))
                    }
                    placeholder="Enter weight in kg"
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>Fitness Level</Text>
                  <View style={styles.fitnessLevelContainer}>
                    {[
                      {key: 'beginner', label: 'Beginner'},
                      {key: 'intermediate', label: 'Intermediate'},
                      {key: 'advanced', label: 'Advanced'},
                    ].map(level => (
                      <TouchableOpacity
                        key={level.key}
                        style={[
                          styles.fitnessLevelOption,
                          profileData.fitnessLevel === level.key &&
                            styles.fitnessLevelSelected,
                        ]}
                        onPress={() =>
                          setProfileData(prev => ({
                            ...prev,
                            fitnessLevel: level.key as
                              | 'beginner'
                              | 'intermediate'
                              | 'advanced',
                          }))
                        }>
                        <Text
                          style={[
                            styles.fitnessLevelText,
                            profileData.fitnessLevel === level.key &&
                              styles.fitnessLevelTextSelected,
                          ]}>
                          {level.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <TouchableOpacity
                  style={styles.saveButton}
                  onPress={handleSaveProfile}
                  disabled={saving}>
                  <Text style={styles.saveButtonText}>
                    {saving ? 'Saving...' : 'Save Profile'}
                  </Text>
                </TouchableOpacity>
              </Card>
            ) : (
              <>
                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Personal Information</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Name:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.firstName && profileData.lastName
                        ? `${profileData.firstName} ${profileData.lastName}`
                        : 'Not set'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.email || 'Not set'}
                    </Text>
                  </View>

                  {profileData.bio && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>Bio:</Text>
                      <Text style={styles.infoValue}>{profileData.bio}</Text>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Date of Birth:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.birthDate || 'Not set'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Gender:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.gender
                        ? profileData.gender.charAt(0).toUpperCase() +
                          profileData.gender.slice(1)
                        : 'Not set'}
                    </Text>
                  </View>
                </Card>

                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Physical Information</Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Height:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.height
                        ? `${profileData.height} cm`
                        : 'Not set'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Weight:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.weight
                        ? `${profileData.weight} kg`
                        : 'Not set'}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Fitness Level:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.fitnessLevel
                        ? profileData.fitnessLevel.charAt(0).toUpperCase() +
                          profileData.fitnessLevel.slice(1)
                        : 'Not set'}
                    </Text>
                  </View>
                </Card>

                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>Account</Text>
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={handleSignOut}>
                    <Text style={styles.signOutText}>Sign Out</Text>
                  </TouchableOpacity>
                </Card>
              </>
            )}
          </>
        )}

        {/* Goals Tab Content */}
        {activeTab === 'goals' && (
          <>
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Daily Goals</Text>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Daily Calories</Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.calories.toString()}
                  onChangeText={text =>
                    updateDailyGoal('calories', parseInt(text) || 2000)
                  }
                  keyboardType="numeric"
                  placeholder="2000"
                />
                <Text style={styles.goalUnit}>kcal</Text>
              </View>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Water Intake</Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.water.toString()}
                  onChangeText={text =>
                    updateDailyGoal('water', parseInt(text) || 8)
                  }
                  keyboardType="numeric"
                  placeholder="8"
                />
                <Text style={styles.goalUnit}>glasses</Text>
              </View>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Protein</Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.protein.toString()}
                  onChangeText={text =>
                    updateDailyGoal('protein', parseInt(text) || 150)
                  }
                  keyboardType="numeric"
                  placeholder="150"
                />
                <Text style={styles.goalUnit}>g</Text>
              </View>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Carbohydrates</Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.carbs.toString()}
                  onChangeText={text =>
                    updateDailyGoal('carbs', parseInt(text) || 200)
                  }
                  keyboardType="numeric"
                  placeholder="200"
                />
                <Text style={styles.goalUnit}>g</Text>
              </View>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>Fat</Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.fat.toString()}
                  onChangeText={text =>
                    updateDailyGoal('fat', parseInt(text) || 65)
                  }
                  keyboardType="numeric"
                  placeholder="65"
                />
                <Text style={styles.goalUnit}>g</Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveDailyGoals}
                disabled={saving}>
                <Text style={styles.saveButtonText}>
                  {saving ? 'Saving...' : 'Save Daily Goals'}
                </Text>
              </TouchableOpacity>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Fitness Goals</Text>

              {loadingGoals && (
                <Text style={styles.loadingText}>Saving...</Text>
              )}

              {fitnessGoals.map((goal, index) => (
                <View key={index} style={styles.goalItem}>
                  <Text style={styles.goalLabel}>{goal}</Text>
                  <TouchableOpacity
                    style={styles.removeGoalButton}
                    onPress={() => removeFitnessGoal(goal)}
                    disabled={loadingGoals}>
                    <Text style={styles.removeGoalButtonText}>×</Text>
                  </TouchableOpacity>
                </View>
              ))}

              <TouchableOpacity
                style={styles.addGoalButton}
                onPress={() => setShowGoalModal(true)}
                disabled={loadingGoals}>
                <Text style={styles.addGoalButtonText}>+ Add Goal</Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
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
                onValueChange={value =>
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
                onValueChange={value =>
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
                onValueChange={value =>
                  handleNotificationToggle('progressUpdates', value)
                }
              />
            </View>
          </Card>
        )}
      </ScrollView>

      {/* Add Goal Modal */}
      <Modal
        visible={showGoalModal}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setShowGoalModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Add Fitness Goal</Text>

            <TextInput
              style={styles.modalInput}
              placeholder="Enter your fitness goal..."
              value={newGoal}
              onChangeText={setNewGoal}
              multiline={true}
              maxLength={100}
            />

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => {
                  setShowGoalModal(false);
                  setNewGoal('');
                }}>
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={() => addFitnessGoal()}>
                <Text style={styles.addButtonText}>Add Goal</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
  loadingText: {
    fontSize: 14,
    color: '#6b7280',
    fontStyle: 'italic',
    textAlign: 'center' as const,
    marginBottom: 8,
  },
  // Tab styles
  tabContainer: {
    flexDirection: 'row' as const,
    backgroundColor: '#f9fafb',
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    padding: 4,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center' as const,
    borderRadius: 8,
  },
  activeTab: {
    backgroundColor: '#3b82f6',
  },
  tabText: {
    fontSize: 14,
    color: '#374151',
    fontWeight: '500',
  },
  activeTabText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  // Info display styles
  infoRow: {
    flexDirection: 'row' as const,
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  infoLabel: {
    fontSize: 14,
    color: '#6b7280',
    fontWeight: '500',
  },
  infoValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '500',
  },
  // Goal styles
  goalItem: {
    flexDirection: 'row' as const,
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f3f4f6',
  },
  goalLabel: {
    flex: 1,
    fontSize: 16,
    color: '#111827',
    fontWeight: '500',
  },
  goalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    width: 80,
    textAlign: 'center' as const,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  goalUnit: {
    marginLeft: 8,
    fontSize: 14,
    color: '#6b7280',
    width: 50,
  },
  // Missing form styles
  formField: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
  },
  saveButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '600',
  },
  // Button styles
  addGoalButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center' as const,
    marginTop: 12,
  },
  addGoalButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  removeGoalButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    alignItems: 'center' as const,
    justifyContent: 'center' as const,
  },
  removeGoalButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Additional form styles
  textArea: {
    height: 80,
    textAlignVertical: 'top' as const,
  },
  sectionSubtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginTop: 20,
    marginBottom: 12,
  },
  genderContainer: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  genderOption: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 6,
    alignItems: 'center' as const,
    backgroundColor: '#ffffff',
  },
  selectedGender: {
    borderColor: '#3b82f6',
    backgroundColor: '#eff6ff',
  },
  genderText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
  },
  selectedGenderText: {
    color: '#3b82f6',
  },
  // Header button styles
  headerButtons: {
    flexDirection: 'row' as const,
    gap: 8,
  },
  refreshButton: {
    backgroundColor: '#10b981',
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center' as const,
    alignItems: 'center' as const,
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 20,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 16,
    textAlign: 'center' as const,
  },
  modalInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
    minHeight: 80,
    textAlignVertical: 'top' as const,
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row' as const,
    gap: 12,
  },
  modalButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center' as const,
  },
  cancelButton: {
    backgroundColor: '#f3f4f6',
    borderWidth: 1,
    borderColor: '#d1d5db',
  },
  addButton: {
    backgroundColor: '#3b82f6',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});
