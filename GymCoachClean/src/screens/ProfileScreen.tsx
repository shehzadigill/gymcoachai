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
  Image,
} from 'react-native';
import {useAuth} from '../contexts/AuthContext';
import {Card, Button, LoadingSpinner} from '../components/common/UI';
import apiClient from '../services/api';
import {useTranslation} from 'react-i18next';
import FloatingSettingsButton from '../components/common/FloatingSettingsButton';
import {useLocale} from '../contexts/LocaleContext';
import * as notificationService from '../services/notifications';
import {useTheme} from '../theme';
import {pickImage, uploadImageToS3, getFileInfo} from '../services/imageUpload';
import {LegacyBodyMeasurement} from '../types';

export default function ProfileScreen() {
  const {t} = useTranslation();
  const {language, setLanguage, isRTL} = useLocale();
  const {colors, mode, setMode, isDark} = useTheme();
  const {user, userProfile, signOut, updateProfile, isLoading, refreshUser} =
    useAuth();
  const [activeTab, setActiveTab] = useState<
    'profile' | 'goals' | 'measurements' | 'ai-trainer' | 'settings'
  >('profile');
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
  const [userPreferences, setUserPreferences] = useState<any>(null);
  const [aiPreferences, setLocalPreferences] = useState({
    enabled: true,
    coachingStyle: 'balanced',
    communicationFrequency: 'daily',
    focusAreas: ['strength', 'cardio'],
  });
  const [bodyMeasurements, setBodyMeasurements] = useState<
    LegacyBodyMeasurement[]
  >([]);
  const [currentWeight, setCurrentWeight] = useState('');
  const [currentBodyFat, setCurrentBodyFat] = useState('');
  const [saving, setSaving] = useState(false);
  const [loadingGoals, setLoadingGoals] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          loadNotificationSettings(),
          loadUserPreferences(),
          loadBodyMeasurements(),
        ]);
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
        weight: '', // Weight is now handled separately in body measurements
        fitnessLevel: userProfile.fitnessLevel || 'beginner',
        birthDate: userProfile.birthDate || '',
        gender: userProfile.gender || '',
      });

      // Update fitness goals if they exist
      if (userProfile.goals && userProfile.goals.length > 0) {
        setFitnessGoals(userProfile.goals);
      }
    } else {
      console.log('No userProfile data available');
    }
  };

  const loadUserPreferences = async () => {
    try {
      const preferences = await apiClient.getUserPreferences();
      if (preferences) {
        setUserPreferences(preferences);

        // Update daily goals from preferences
        if (preferences.dailyGoals) {
          setDailyGoals(preferences.dailyGoals);
        }

        // Update AI preferences
        if (preferences.aiTrainer) {
          setLocalPreferences(preferences.aiTrainer);
        }
      }
    } catch (error) {
      console.error('Error loading user preferences:', error);
    }
  };

  const loadBodyMeasurements = async () => {
    try {
      const measurements = await apiClient.getBodyMeasurements();
      setBodyMeasurements(measurements);

      // Set current weight from latest measurement
      if (measurements && measurements.length > 0) {
        const latest = measurements[0];
        setCurrentWeight(latest.weight?.toString() || '');
        setCurrentBodyFat(latest.bodyFat?.toString() || '');
      }
    } catch (error) {
      console.error('Error loading body measurements:', error);
    }
  };

  const loadNotificationSettings = async () => {
    try {
      // TODO: Implement getNotificationSettings in notification service
      // const settings = await notificationService.getNotificationSettings();
      // setNotificationSettings(settings);
      console.log('Loading notification settings (TODO: implement)');
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
        bio: profileData.bio?.trim(),
        height: profileData.height ? parseFloat(profileData.height) : undefined,
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
      // Save daily goals using the separated preferences API
      await apiClient.updateDailyGoalsSeparate(dailyGoals);
      console.log('Daily goals saved successfully:', dailyGoals);
      Alert.alert('Success', 'Daily goals saved successfully!');
    } catch (error) {
      console.error('Error saving daily goals:', error);
      Alert.alert('Error', 'Failed to save daily goals. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const saveBodyMeasurement = async () => {
    if (!currentWeight && !currentBodyFat) {
      Alert.alert(
        'Error',
        'Please enter at least weight or body fat percentage',
      );
      return;
    }

    try {
      setSaving(true);
      const promises = [];

      // Create weight measurement if provided
      if (currentWeight) {
        const weightData = {
          measurementType: 'weight',
          value: parseFloat(currentWeight),
          unit: 'kg', // You might want to make this configurable
          notes: 'Weight measurement from profile',
        };
        promises.push(apiClient.createBodyMeasurement(weightData));
      }

      // Create body fat measurement if provided
      if (currentBodyFat) {
        const bodyFatData = {
          measurementType: 'body_fat',
          value: parseFloat(currentBodyFat),
          unit: '%',
          notes: 'Body fat measurement from profile',
        };
        promises.push(apiClient.createBodyMeasurement(bodyFatData));
      }

      await Promise.all(promises);

      // Reload measurements to show the new ones
      await loadBodyMeasurements();

      // Clear the inputs
      setCurrentWeight('');
      setCurrentBodyFat('');

      Alert.alert('Success', 'Body measurement saved successfully!');
    } catch (error) {
      console.error('Error saving body measurement:', error);
      Alert.alert(
        'Error',
        'Failed to save body measurement. Please try again.',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveAIPreferences = async () => {
    try {
      setSaving(true);

      // Save preferences to user profile service
      await apiClient.updateAIPreferences(aiPreferences);

      // Also submit feedback to AI service about preference changes
      try {
        await apiClient.submitPersonalizationFeedback({
          type: 'preference_update',
          rating: 5, // User actively updated preferences
          comments: `Mobile user updated AI preferences: coaching style=${
            aiPreferences.coachingStyle
          }, communication=${
            aiPreferences.communicationFrequency
          }, focus areas=${aiPreferences.focusAreas.join(', ')}, enabled=${
            aiPreferences.enabled
          }`,
        });
      } catch (feedbackError) {
        console.warn('Failed to submit preference feedback:', feedbackError);
        // Don't fail the whole operation if feedback fails
      }

      Alert.alert('Success', 'AI trainer preferences saved successfully!');
    } catch (error) {
      console.error('Error saving AI preferences:', error);
      Alert.alert('Error', 'Failed to save AI preferences. Please try again.');
    } finally {
      setSaving(false);
    }
  };
  const handleNotificationToggle = async (key: string, value: boolean) => {
    try {
      const newSettings = {...notificationSettings, [key]: value};
      setNotificationSettings(newSettings);

      // TODO: Implement saveNotificationSettings in notification service
      // await notificationService.saveNotificationSettings(newSettings);

      if (key === 'nutritionReminders') {
        if (value) {
          // Enable nutrition reminders with default times
          // TODO: Implement scheduleNutritionReminders in notification service
          // notificationService.scheduleNutritionReminders([
          //   '08:00',
          //   '13:00',
          //   '19:00',
          // ]);
        } else {
          // Disable nutrition reminders
          // TODO: Implement cancelNutritionReminders in notification service
          // notificationService.cancelNutritionReminders();
        }
      }
    } catch (error) {
      console.error('Error updating notification settings:', error);
      Alert.alert('Error', 'Failed to update notification settings');
    }
  };

  const handleProfileImagePress = async () => {
    if (!editing) {
      // If not in edit mode, just show the full image
      if (userProfile?.profileImageUrl) {
        // Could open a modal to show full image
        Alert.alert('Profile Image', 'Edit mode to change profile image');
      }
      return;
    }

    // Show options to take photo or choose from library
    Alert.alert('Profile Image', 'Choose an option', [
      {
        text: 'Take Photo',
        onPress: () => uploadProfileImage(true),
      },
      {
        text: 'Choose from Library',
        onPress: () => uploadProfileImage(false),
      },
      {text: 'Cancel', style: 'cancel'},
    ]);
  };

  const uploadProfileImage = async (fromCamera: boolean = false) => {
    try {
      setSaving(true);

      // Pick image
      const image = await pickImage(fromCamera);
      if (!image) {
        setSaving(false);
        return;
      }

      // Get file info
      const fileInfo = getFileInfo(image.uri);

      // Get upload URL
      const uploadData = await apiClient.generateProfileImageUploadUrl(
        fileInfo.type,
      );

      // Upload to S3
      await uploadImageToS3(uploadData.upload_url, image.uri, fileInfo.type);

      // Update profile with new image key
      await apiClient.updateProfileImage(uploadData.key);

      // Refresh user profile
      await refreshUser();

      Alert.alert('Success', 'Profile image updated successfully!');
    } catch (error) {
      console.error('Error uploading profile image:', error);
      Alert.alert('Error', 'Failed to upload profile image. Please try again.');
    } finally {
      setSaving(false);
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
      <FloatingSettingsButton />
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, {color: colors.text}]}>
          {t('profile.title')}
        </Text>
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
                {saving ? t('common.loading') : t('profile.refresh')}
              </Text>
            </TouchableOpacity>
          )}
          {activeTab === 'profile' && (
            <TouchableOpacity
              onPress={() => setEditing(!editing)}
              style={styles.editButton}>
              <Text style={styles.editButtonText}>
                {editing ? t('profile.cancel') : t('profile.edit')}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* User Info */}
      <Card style={styles.userInfoCard}>
        <View style={styles.avatarContainer}>
          <TouchableOpacity
            style={styles.avatar}
            onPress={handleProfileImagePress}>
            {userProfile?.profileImageUrl ? (
              <Image
                source={{uri: userProfile.profileImageUrl}}
                style={styles.avatarImage}
              />
            ) : (
              <Text style={styles.avatarText}>
                {profileData.firstName?.[0] ||
                  userProfile?.firstName?.[0] ||
                  user?.email?.[0]?.toUpperCase() ||
                  '?'}
              </Text>
            )}
            {editing && (
              <View style={styles.avatarEditBadge}>
                <Text style={styles.avatarEditText}>✏️</Text>
              </View>
            )}
          </TouchableOpacity>
          <View style={styles.userBasicInfo}>
            <Text style={[styles.userName, {color: colors.text}]}>
              {profileData.firstName && profileData.lastName
                ? `${profileData.firstName} ${profileData.lastName}`
                : userProfile?.firstName && userProfile?.lastName
                ? `${userProfile.firstName} ${userProfile.lastName}`
                : t('profile.user')}
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
            {t('profile.title')}
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
            {t('profile.fitness_goals')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'measurements' && styles.activeTab]}
          onPress={() => setActiveTab('measurements')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'measurements' && styles.activeTabText,
            ]}>
            Body Measurements
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'ai-trainer' && styles.activeTab]}
          onPress={() => setActiveTab('ai-trainer')}>
          <Text
            style={[
              styles.tabText,
              activeTab === 'ai-trainer' && styles.activeTabText,
            ]}>
            {t('tabs.ai_trainer')}
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
            {t('settings.language')}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Profile Tab Content */}
        {activeTab === 'profile' && (
          <>
            {editing ? (
              <Card style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>
                  {t('profile.personal_information')}
                </Text>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t('profile.first_name')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.firstName}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, firstName: text}))
                    }
                    placeholder={t('profile.first_name')}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t('profile.last_name')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.lastName}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, lastName: text}))
                    }
                    placeholder={t('profile.last_name')}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t('profile.bio')}</Text>
                  <TextInput
                    style={[styles.input, styles.textArea]}
                    value={profileData.bio || ''}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, bio: text}))
                    }
                    placeholder={t('profile.bio')}
                    multiline
                    numberOfLines={3}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t('profile.dob')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.birthDate}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, birthDate: text}))
                    }
                    placeholder={t('profile.dob')}
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t('profile.gender')}</Text>
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
                          {t(`profile.${gender}` as any)}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                <Text style={styles.sectionSubtitle}>
                  {t('profile.physical_information')}
                </Text>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t('profile.height_cm')}</Text>
                  <TextInput
                    style={styles.input}
                    value={profileData.height}
                    onChangeText={text =>
                      setProfileData(prev => ({...prev, height: text}))
                    }
                    placeholder={t('profile.height_cm')}
                    keyboardType="numeric"
                  />
                </View>

                <View style={styles.formField}>
                  <Text style={styles.label}>{t('profile.fitness_level')}</Text>
                  <View style={styles.fitnessLevelContainer}>
                    {[
                      {key: 'beginner', label: t('profile.beginner')},
                      {key: 'intermediate', label: t('profile.intermediate')},
                      {key: 'advanced', label: t('profile.advanced')},
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
                    {saving ? t('common.loading') : t('profile.save_profile')}
                  </Text>
                </TouchableOpacity>
              </Card>
            ) : (
              <>
                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    {t('profile.personal_information')}
                  </Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {t('profile.first_name')}:
                    </Text>
                    <Text style={styles.infoValue}>
                      {profileData.firstName && profileData.lastName
                        ? `${profileData.firstName} ${profileData.lastName}`
                        : t('profile.not_set')}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>Email:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.email || t('profile.not_set')}
                    </Text>
                  </View>

                  {profileData.bio && (
                    <View style={styles.infoRow}>
                      <Text style={styles.infoLabel}>{t('profile.bio')}:</Text>
                      <Text style={styles.infoValue}>{profileData.bio}</Text>
                    </View>
                  )}

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.dob')}:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.birthDate || t('profile.not_set')}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>{t('profile.gender')}:</Text>
                    <Text style={styles.infoValue}>
                      {profileData.gender
                        ? t(`profile.${profileData.gender}` as any)
                        : t('profile.not_set')}
                    </Text>
                  </View>
                </Card>

                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    {t('profile.physical_information')}
                  </Text>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {t('profile.height_cm')}:
                    </Text>
                    <Text style={styles.infoValue}>
                      {profileData.height
                        ? `${profileData.height} cm`
                        : t('profile.not_set')}
                    </Text>
                  </View>

                  <View style={styles.infoRow}>
                    <Text style={styles.infoLabel}>
                      {t('profile.fitness_level')}:
                    </Text>
                    <Text style={styles.infoValue}>
                      {profileData.fitnessLevel
                        ? t(`profile.${profileData.fitnessLevel}` as any)
                        : t('profile.not_set')}
                    </Text>
                  </View>
                </Card>

                <Card style={styles.sectionCard}>
                  <Text style={styles.sectionTitle}>
                    {t('profile.account')}
                  </Text>
                  <TouchableOpacity
                    style={styles.actionItem}
                    onPress={handleSignOut}>
                    <Text style={styles.signOutText}>
                      {t('profile.sign_out')}
                    </Text>
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
              <Text style={styles.sectionTitle}>
                {t('profile.daily_goals')}
              </Text>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>
                  {t('profile.daily_calories')}
                </Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.calories.toString()}
                  onChangeText={text =>
                    updateDailyGoal('calories', parseInt(text) || 2000)
                  }
                  keyboardType="numeric"
                  placeholder="2000"
                />
                <Text style={styles.goalUnit}>{t('profile.kcal')}</Text>
              </View>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>
                  {t('profile.water_intake')}
                </Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.water.toString()}
                  onChangeText={text =>
                    updateDailyGoal('water', parseInt(text) || 8)
                  }
                  keyboardType="numeric"
                  placeholder="8"
                />
                <Text style={styles.goalUnit}>{t('profile.glasses')}</Text>
              </View>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>{t('profile.protein')}</Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.protein.toString()}
                  onChangeText={text =>
                    updateDailyGoal('protein', parseInt(text) || 150)
                  }
                  keyboardType="numeric"
                  placeholder="150"
                />
                <Text style={styles.goalUnit}>{t('profile.g')}</Text>
              </View>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>{t('profile.carbs')}</Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.carbs.toString()}
                  onChangeText={text =>
                    updateDailyGoal('carbs', parseInt(text) || 200)
                  }
                  keyboardType="numeric"
                  placeholder="200"
                />
                <Text style={styles.goalUnit}>{t('profile.g')}</Text>
              </View>

              <View style={styles.goalItem}>
                <Text style={styles.goalLabel}>{t('profile.fat')}</Text>
                <TextInput
                  style={styles.goalInput}
                  value={dailyGoals.fat.toString()}
                  onChangeText={text =>
                    updateDailyGoal('fat', parseInt(text) || 65)
                  }
                  keyboardType="numeric"
                  placeholder="65"
                />
                <Text style={styles.goalUnit}>{t('profile.g')}</Text>
              </View>

              <TouchableOpacity
                style={styles.saveButton}
                onPress={saveDailyGoals}
                disabled={saving}>
                <Text style={styles.saveButtonText}>
                  {saving ? t('common.loading') : t('profile.save_daily_goals')}
                </Text>
              </TouchableOpacity>
            </Card>

            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>
                {t('profile.fitness_goals')}
              </Text>

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
                <Text style={styles.addGoalButtonText}>
                  {t('profile.add_goal')}
                </Text>
              </TouchableOpacity>
            </Card>
          </>
        )}

        {/* Body Measurements Tab Content */}
        {activeTab === 'measurements' && (
          <>
            {/* Add New Measurement */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Add New Measurement</Text>

              <View style={styles.formField}>
                <Text style={styles.label}>Weight (kg)</Text>
                <TextInput
                  style={styles.input}
                  value={currentWeight}
                  onChangeText={setCurrentWeight}
                  placeholder="Enter your current weight"
                  keyboardType="numeric"
                />
              </View>

              <View style={styles.formField}>
                <Text style={styles.label}>Body Fat (%)</Text>
                <TextInput
                  style={styles.input}
                  value={currentBodyFat}
                  onChangeText={setCurrentBodyFat}
                  placeholder="Enter your body fat percentage"
                  keyboardType="numeric"
                />
              </View>

              <Button
                title={saving ? 'Saving...' : 'Save Measurement'}
                onPress={saveBodyMeasurement}
                disabled={saving}
                style={styles.saveButton}
              />
            </Card>

            {/* Measurement History */}
            <Card style={styles.sectionCard}>
              <Text style={styles.sectionTitle}>Recent Measurements</Text>

              {bodyMeasurements.length > 0 ? (
                bodyMeasurements.slice(0, 5).map((measurement, index) => (
                  <View key={index} style={styles.measurementItem}>
                    <View style={styles.measurementDate}>
                      <Text style={styles.measurementDateText}>
                        {new Date(measurement.date).toLocaleDateString()}
                      </Text>
                    </View>
                    <View style={styles.measurementValues}>
                      {measurement.weight && (
                        <Text style={styles.measurementText}>
                          Weight: {measurement.weight} kg
                        </Text>
                      )}
                      {measurement.bodyFat && (
                        <Text style={styles.measurementText}>
                          Body Fat: {measurement.bodyFat}%
                        </Text>
                      )}
                    </View>
                  </View>
                ))
              ) : (
                <Text style={styles.noDataText}>
                  No measurements recorded yet. Add your first measurement
                  above!
                </Text>
              )}
            </Card>
          </>
        )}

        {/* AI Trainer Tab Content */}
        {activeTab === 'ai-trainer' && (
          <AITrainerTabContent
            preferences={aiPreferences}
            onSave={saveAIPreferences}
            onUpdate={setLocalPreferences}
          />
        )}

        {/* Settings Tab Content */}
        {activeTab === 'settings' && (
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t('profile.notification_settings')}
            </Text>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>
                  {t('profile.workout_reminders')}
                </Text>
                <Text style={styles.settingDescription}>
                  {t('profile.get_notified_workouts')}
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
                <Text style={styles.settingName}>
                  {t('profile.nutrition_reminders')}
                </Text>
                <Text style={styles.settingDescription}>
                  {t('profile.remind_log_meals')}
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
                <Text style={styles.settingName}>
                  {t('profile.progress_updates')}
                </Text>
                <Text style={styles.settingDescription}>
                  {t('profile.get_notified_achievements')}
                </Text>
              </View>
              <Switch
                value={notificationSettings.progressUpdates}
                onValueChange={value =>
                  handleNotificationToggle('progressUpdates', value)
                }
              />
            </View>

            {/* Language & Theme */}
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>{t('settings.language')}</Text>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      language === 'en' && {backgroundColor: colors.success},
                    ]}
                    onPress={() => setLanguage('en')}>
                    <Text style={styles.editButtonText}>English</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      language === 'ar' && {backgroundColor: colors.success},
                    ]}
                    onPress={() => setLanguage('ar')}>
                    <Text style={styles.editButtonText}>العربية</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingName}>{t('settings.theme')}</Text>
                <View style={{flexDirection: 'row', gap: 8}}>
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      mode === 'light' && {backgroundColor: colors.success},
                    ]}
                    onPress={() => setMode('light')}>
                    <Text style={styles.editButtonText}>
                      {t('settings.light')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      mode === 'dark' && {backgroundColor: colors.success},
                    ]}
                    onPress={() => setMode('dark')}>
                    <Text style={styles.editButtonText}>
                      {t('settings.dark')}
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[
                      styles.editButton,
                      mode === 'system' && {backgroundColor: colors.success},
                    ]}
                    onPress={() => setMode('system')}>
                    <Text style={styles.editButtonText}>
                      {t('settings.system')}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
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
            <Text style={styles.modalTitle}>
              {t('profile.add_fitness_goal')}
            </Text>

            <TextInput
              style={styles.modalInput}
              placeholder={t('profile.enter_fitness_goal')}
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
                <Text style={styles.cancelButtonText}>
                  {t('common.cancel')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.addButton]}
                onPress={() => addFitnessGoal()}>
                <Text style={styles.addButtonText}>{t('profile.add')}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

// AI Trainer Tab Content Component
interface AITrainerTabProps {
  preferences: any;
  onSave: () => Promise<void>;
  onUpdate: (preferences: any) => void;
}

function AITrainerTabContent({
  preferences,
  onSave,
  onUpdate,
}: AITrainerTabProps) {
  const {t} = useTranslation();
  const [localPreferences, setLocalPreferences] = useState({
    enabled: preferences?.enabled || false,
    coachingStyle:
      preferences?.coachingStyle ||
      ('balanced' as 'motivational' | 'strict' | 'balanced' | 'technical'),
    communicationFrequency:
      preferences?.communicationFrequency ||
      ('on-demand' as 'daily' | 'weekly' | 'on-demand'),
    focusAreas: preferences?.focusAreas || ([] as string[]),
    injuryHistory: preferences?.injuryHistory || ([] as string[]),
    equipmentAvailable: preferences?.equipmentAvailable || ([] as string[]),
    workoutDurationPreference: preferences?.workoutDurationPreference || 60,
    workoutDaysPerWeek: preferences?.workoutDaysPerWeek || 3,
    mealPreferences: [] as string[],
    allergies: [] as string[],
    supplementPreferences: [] as string[],
  });

  const [newItem, setNewItem] = useState({
    focusArea: '',
    injury: '',
    equipment: '',
    mealPreference: '',
    allergy: '',
    supplement: '',
  });

  const focusAreaOptions = [
    {key: 'strength', label: t('profile.ai_trainer.focus_areas.strength')},
    {key: 'cardio', label: t('profile.ai_trainer.focus_areas.cardio')},
    {
      key: 'flexibility',
      label: t('profile.ai_trainer.focus_areas.flexibility'),
    },
    {key: 'nutrition', label: t('profile.ai_trainer.focus_areas.nutrition')},
    {
      key: 'weight_loss',
      label: t('profile.ai_trainer.focus_areas.weight_loss'),
    },
    {
      key: 'muscle_gain',
      label: t('profile.ai_trainer.focus_areas.muscle_gain'),
    },
    {key: 'endurance', label: t('profile.ai_trainer.focus_areas.endurance')},
    {
      key: 'rehabilitation',
      label: t('profile.ai_trainer.focus_areas.rehabilitation'),
    },
  ];

  const equipmentOptions = [
    {key: 'dumbbells', label: t('profile.ai_trainer.equipment.dumbbells')},
    {key: 'barbell', label: t('profile.ai_trainer.equipment.barbell')},
    {
      key: 'resistance_bands',
      label: t('profile.ai_trainer.equipment.resistance_bands'),
    },
    {key: 'kettlebells', label: t('profile.ai_trainer.equipment.kettlebells')},
    {key: 'pull_up_bar', label: t('profile.ai_trainer.equipment.pull_up_bar')},
    {
      key: 'gym_machines',
      label: t('profile.ai_trainer.equipment.gym_machines'),
    },
    {key: 'bodyweight', label: t('profile.ai_trainer.equipment.bodyweight')},
    {
      key: 'cardio_equipment',
      label: t('profile.ai_trainer.equipment.cardio_equipment'),
    },
    {key: 'yoga_mat', label: t('profile.ai_trainer.equipment.yoga_mat')},
    {
      key: 'medicine_ball',
      label: t('profile.ai_trainer.equipment.medicine_ball'),
    },
  ];

  const mealPreferenceOptions = [
    {
      key: 'vegetarian',
      label: t('profile.ai_trainer.meal_preferences.vegetarian'),
    },
    {key: 'vegan', label: t('profile.ai_trainer.meal_preferences.vegan')},
    {key: 'keto', label: t('profile.ai_trainer.meal_preferences.keto')},
    {key: 'paleo', label: t('profile.ai_trainer.meal_preferences.paleo')},
    {
      key: 'mediterranean',
      label: t('profile.ai_trainer.meal_preferences.mediterranean'),
    },
    {key: 'low_carb', label: t('profile.ai_trainer.meal_preferences.low_carb')},
    {
      key: 'high_protein',
      label: t('profile.ai_trainer.meal_preferences.high_protein'),
    },
    {
      key: 'no_restrictions',
      label: t('profile.ai_trainer.meal_preferences.no_restrictions'),
    },
  ];

  const addItem = (type: keyof typeof newItem, value: string) => {
    if (value.trim()) {
      const updatedPreferences = {...localPreferences};
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
      setLocalPreferences(updatedPreferences);
      setNewItem({...newItem, [type]: ''});
    }
  };

  const removeItem = (type: keyof typeof newItem, index: number) => {
    const updatedPreferences = {...localPreferences};
    switch (type) {
      case 'focusArea':
        updatedPreferences.focusAreas = updatedPreferences.focusAreas.filter(
          (_: any, i: number) => i !== index,
        );
        break;
      case 'injury':
        updatedPreferences.injuryHistory =
          updatedPreferences.injuryHistory.filter(
            (_: any, i: number) => i !== index,
          );
        break;
      case 'equipment':
        updatedPreferences.equipmentAvailable =
          updatedPreferences.equipmentAvailable.filter(
            (_: any, i: number) => i !== index,
          );
        break;
      case 'mealPreference':
        updatedPreferences.mealPreferences =
          updatedPreferences.mealPreferences.filter(
            (_: any, i: number) => i !== index,
          );
        break;
      case 'allergy':
        updatedPreferences.allergies = updatedPreferences.allergies.filter(
          (_: any, i: number) => i !== index,
        );
        break;
      case 'supplement':
        updatedPreferences.supplementPreferences =
          updatedPreferences.supplementPreferences.filter(
            (_: any, i: number) => i !== index,
          );
        break;
    }
    setLocalPreferences(updatedPreferences);
  };

  const updatePreference = (key: keyof typeof localPreferences, value: any) => {
    const updatedPreferences = {...localPreferences, [key]: value};
    setLocalPreferences(updatedPreferences);
    onUpdate(updatedPreferences);
  };

  return (
    <>
      {/* Enable/Disable AI Trainer */}
      <Card style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>
          {t('profile.ai_trainer_settings')}
        </Text>

        <View style={styles.settingItem}>
          <View style={styles.settingInfo}>
            <Text style={styles.settingName}>
              {t('profile.enable_ai_trainer')}
            </Text>
            <Text style={styles.settingDescription}>
              {t('profile.ai_trainer.description')}
            </Text>
          </View>
          <Switch
            value={localPreferences.enabled}
            onValueChange={value => updatePreference('enabled', value)}
          />
        </View>
      </Card>

      {localPreferences.enabled && (
        <>
          {/* Coaching Preferences */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t('profile.coaching_preferences')}
            </Text>

            <View style={styles.formField}>
              <Text style={styles.label}>{t('profile.coaching_style')}</Text>
              <View style={styles.pickerContainer}>
                {['motivational', 'strict', 'balanced', 'technical'].map(
                  style => (
                    <TouchableOpacity
                      key={style}
                      style={[
                        styles.pickerOption,
                        localPreferences.coachingStyle === style &&
                          styles.selectedPickerOption,
                      ]}
                      onPress={() => updatePreference('coachingStyle', style)}>
                      <Text
                        style={[
                          styles.pickerOptionText,
                          localPreferences.coachingStyle === style &&
                            styles.selectedPickerOptionText,
                        ]}>
                        {t(`profile.ai_trainer.coaching_styles.${style}`)}
                      </Text>
                    </TouchableOpacity>
                  ),
                )}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>
                {t('profile.communication_frequency')}
              </Text>
              <View style={styles.pickerContainer}>
                {['daily', 'weekly', 'on-demand'].map(frequency => (
                  <TouchableOpacity
                    key={frequency}
                    style={[
                      styles.pickerOption,
                      localPreferences.communicationFrequency === frequency &&
                        styles.selectedPickerOption,
                    ]}
                    onPress={() =>
                      updatePreference('communicationFrequency', frequency)
                    }>
                    <Text
                      style={[
                        styles.pickerOptionText,
                        localPreferences.communicationFrequency === frequency &&
                          styles.selectedPickerOptionText,
                      ]}>
                      {t(`profile.${frequency}`)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>

          {/* Focus Areas */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t('profile.focus_areas')}</Text>

            <View style={styles.addItemContainer}>
              <View style={styles.pickerContainer}>
                {focusAreaOptions.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.tagOption,
                      localPreferences.focusAreas.includes(option.key) &&
                        styles.selectedTagOption,
                    ]}
                    onPress={() => {
                      if (localPreferences.focusAreas.includes(option.key)) {
                        removeItem(
                          'focusArea',
                          localPreferences.focusAreas.indexOf(option.key),
                        );
                      } else {
                        addItem('focusArea', option.key);
                      }
                    }}>
                    <Text
                      style={[
                        styles.tagOptionText,
                        localPreferences.focusAreas.includes(option.key) &&
                          styles.selectedTagOptionText,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>

          {/* Equipment Available */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t('profile.available_equipment')}
            </Text>

            <View style={styles.addItemContainer}>
              <View style={styles.pickerContainer}>
                {equipmentOptions.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.tagOption,
                      localPreferences.equipmentAvailable.includes(
                        option.key,
                      ) && styles.selectedTagOption,
                    ]}
                    onPress={() => {
                      if (
                        localPreferences.equipmentAvailable.includes(option.key)
                      ) {
                        removeItem(
                          'equipment',
                          localPreferences.equipmentAvailable.indexOf(
                            option.key,
                          ),
                        );
                      } else {
                        addItem('equipment', option.key);
                      }
                    }}>
                    <Text
                      style={[
                        styles.tagOptionText,
                        localPreferences.equipmentAvailable.includes(
                          option.key,
                        ) && styles.selectedTagOptionText,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </Card>

          {/* Workout Preferences */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t('profile.workout_preferences')}
            </Text>

            <View style={styles.formField}>
              <Text style={styles.label}>
                {t('profile.workout_duration_minutes')}
              </Text>
              <TextInput
                style={styles.input}
                value={localPreferences.workoutDurationPreference.toString()}
                onChangeText={text =>
                  updatePreference(
                    'workoutDurationPreference',
                    parseInt(text) || 60,
                  )
                }
                keyboardType="numeric"
                placeholder="60"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>
                {t('profile.workout_days_per_week')}
              </Text>
              <TextInput
                style={styles.input}
                value={localPreferences.workoutDaysPerWeek.toString()}
                onChangeText={text =>
                  updatePreference('workoutDaysPerWeek', parseInt(text) || 3)
                }
                keyboardType="numeric"
                placeholder="3"
              />
            </View>
          </Card>

          {/* Nutrition Preferences */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t('profile.nutrition_preferences')}
            </Text>

            <View style={styles.formField}>
              <Text style={styles.label}>{t('profile.meal_preferences')}</Text>
              <View style={styles.pickerContainer}>
                {mealPreferenceOptions.map(option => (
                  <TouchableOpacity
                    key={option.key}
                    style={[
                      styles.tagOption,
                      localPreferences.mealPreferences.includes(option.key) &&
                        styles.selectedTagOption,
                    ]}
                    onPress={() => {
                      if (
                        localPreferences.mealPreferences.includes(option.key)
                      ) {
                        removeItem(
                          'mealPreference',
                          localPreferences.mealPreferences.indexOf(option.key),
                        );
                      } else {
                        addItem('mealPreference', option.key);
                      }
                    }}>
                    <Text
                      style={[
                        styles.tagOptionText,
                        localPreferences.mealPreferences.includes(option.key) &&
                          styles.selectedTagOptionText,
                      ]}>
                      {option.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>{t('profile.allergies')}</Text>
              <View style={styles.addItemRow}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={newItem.allergy}
                  onChangeText={text => setNewItem({...newItem, allergy: text})}
                  placeholder={t('profile.enter_allergy')}
                  onSubmitEditing={() => addItem('allergy', newItem.allergy)}
                />
                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={() => addItem('allergy', newItem.allergy)}>
                  <Text style={styles.addItemButtonText}>
                    {t('profile.add')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tagsContainer}>
                {localPreferences.allergies.map((allergy, index) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{allergy}</Text>
                    <TouchableOpacity
                      onPress={() => removeItem('allergy', index)}
                      style={styles.removeTagButton}>
                      <Text style={styles.removeTagButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>
                {t('profile.supplement_preferences')}
              </Text>
              <View style={styles.addItemRow}>
                <TextInput
                  style={[styles.input, styles.flexInput]}
                  value={newItem.supplement}
                  onChangeText={text =>
                    setNewItem({...newItem, supplement: text})
                  }
                  placeholder={t('profile.enter_supplement')}
                  onSubmitEditing={() =>
                    addItem('supplement', newItem.supplement)
                  }
                />
                <TouchableOpacity
                  style={styles.addItemButton}
                  onPress={() => addItem('supplement', newItem.supplement)}>
                  <Text style={styles.addItemButtonText}>
                    {t('profile.add')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={styles.tagsContainer}>
                {localPreferences.supplementPreferences.map(
                  (supplement, index) => (
                    <View key={index} style={styles.tag}>
                      <Text style={styles.tagText}>{supplement}</Text>
                      <TouchableOpacity
                        onPress={() => removeItem('supplement', index)}
                        style={styles.removeTagButton}>
                        <Text style={styles.removeTagButtonText}>×</Text>
                      </TouchableOpacity>
                    </View>
                  ),
                )}
              </View>
            </View>
          </Card>

          {/* Injury History */}
          <Card style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>
              {t('profile.ai_trainer.injury_history')}
            </Text>

            <View style={styles.addItemRow}>
              <TextInput
                style={[styles.input, styles.flexInput]}
                value={newItem.injury}
                onChangeText={text => setNewItem({...newItem, injury: text})}
                placeholder={t('profile.ai_trainer.enter_injury')}
                onSubmitEditing={() => addItem('injury', newItem.injury)}
              />
              <TouchableOpacity
                style={styles.addItemButton}
                onPress={() => addItem('injury', newItem.injury)}>
                <Text style={styles.addItemButtonText}>{t('profile.add')}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.tagsContainer}>
              {localPreferences.injuryHistory.map(
                (injury: any, index: number) => (
                  <View key={index} style={styles.tag}>
                    <Text style={styles.tagText}>{injury}</Text>
                    <TouchableOpacity
                      onPress={() => removeItem('injury', index)}
                      style={styles.removeTagButton}>
                      <Text style={styles.removeTagButtonText}>×</Text>
                    </TouchableOpacity>
                  </View>
                ),
              )}
            </View>
          </Card>
        </>
      )}
    </>
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
    position: 'relative',
  },
  avatarImage: {
    width: 60,
    height: 60,
    borderRadius: 30,
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditText: {
    fontSize: 12,
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
  // AI Trainer specific styles
  pickerContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  pickerOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  selectedPickerOption: {
    backgroundColor: '#3b82f6',
    borderColor: '#3b82f6',
  },
  pickerOptionText: {
    fontSize: 14,
    color: '#374151',
  },
  selectedPickerOptionText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  tagOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d1d5db',
    backgroundColor: '#ffffff',
  },
  selectedTagOption: {
    backgroundColor: '#10b981',
    borderColor: '#10b981',
  },
  tagOptionText: {
    fontSize: 12,
    color: '#374151',
  },
  selectedTagOptionText: {
    color: '#ffffff',
    fontWeight: '500',
  },
  addItemContainer: {
    marginTop: 8,
  },
  addItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  flexInput: {
    flex: 1,
  },
  addItemButton: {
    backgroundColor: '#3b82f6',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addItemButtonText: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '500',
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#e5e7eb',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  tagText: {
    fontSize: 12,
    color: '#374151',
  },
  removeTagButton: {
    marginLeft: 4,
  },
  removeTagButtonText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  // Body measurements styles
  measurementItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  measurementDate: {
    flex: 1,
  },
  measurementDateText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
  },
  measurementValues: {
    flex: 2,
    alignItems: 'flex-end',
  },
  measurementText: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 2,
  },
  noDataText: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    padding: 20,
    fontStyle: 'italic',
  },
});
