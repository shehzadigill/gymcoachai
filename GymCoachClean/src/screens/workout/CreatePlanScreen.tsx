import React, {useState, useEffect} from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TextInput,
  Alert,
} from 'react-native';
import {Button, Card} from '../../components/common/UI';
import apiClient from '../../services/api';

export default function CreatePlanScreen({navigation, route}: any) {
  const {editPlan, isTemplate, fromTemplate} = route.params || {};
  const isEditMode = !!editPlan;
  const isTemplateMode = isTemplate || fromTemplate;

  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >('beginner');

  // Map form difficulty to API difficulty
  const mapDifficultyToApi = (formDifficulty: string) => {
    switch (formDifficulty) {
      case 'beginner':
        return 'easy';
      case 'intermediate':
        return 'medium';
      case 'advanced':
        return 'hard';
      default:
        return 'easy';
    }
  };

  // Map API difficulty to form difficulty
  const mapDifficultyFromApi = (apiDifficulty: string) => {
    switch (apiDifficulty) {
      case 'easy':
        return 'beginner';
      case 'medium':
        return 'intermediate';
      case 'hard':
        return 'advanced';
      default:
        return 'beginner';
    }
  };
  const [durationWeeks, setDurationWeeks] = useState('4');
  const [frequencyPerWeek, setFrequencyPerWeek] = useState('3');
  const [loading, setLoading] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (isEditMode && editPlan) {
      setPlanName(editPlan.name || '');
      setDescription(editPlan.description || '');
      setDifficulty(mapDifficultyFromApi(editPlan.difficulty || 'easy'));
      setDurationWeeks(editPlan.durationWeeks?.toString() || '4');
      setFrequencyPerWeek(editPlan.frequencyPerWeek?.toString() || '3');
    } else if (fromTemplate) {
      // Pre-populate from template
      setPlanName(fromTemplate.name || '');
      setDescription(fromTemplate.description || '');
      setDifficulty(mapDifficultyFromApi(fromTemplate.difficulty || 'easy'));
      setDurationWeeks(fromTemplate.durationWeeks?.toString() || '4');
      setFrequencyPerWeek(fromTemplate.frequencyPerWeek?.toString() || '3');
    }
  }, [isEditMode, editPlan, fromTemplate]);

  const handleSave = async () => {
    if (!planName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }

    setLoading(true);

    try {
      const planData = {
        name: planName.trim(),
        description: description.trim(),
        difficulty: mapDifficultyToApi(difficulty) as
          | 'easy'
          | 'medium'
          | 'hard',
        durationWeeks: parseInt(durationWeeks) || 4,
        frequencyPerWeek: parseInt(frequencyPerWeek) || 3,
        exercises: editPlan?.exercises || [], // Preserve existing exercises
        isTemplate: isTemplateMode,
      };

      if (isEditMode) {
        // Update existing plan
        await apiClient.updateWorkoutPlan(editPlan.id, planData);
        Alert.alert('Success', 'Workout plan updated successfully!', [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]);
      } else {
        // Create new plan
        await apiClient.createWorkout(planData);
        Alert.alert(
          'Success',
          isTemplateMode
            ? 'Workout template created successfully!'
            : 'Workout plan created successfully!',
          [
            {
              text: 'OK',
              onPress: () => navigation.goBack(),
            },
          ],
        );
      }
    } catch (error) {
      console.error('Error saving plan:', error);
      Alert.alert(
        'Error',
        `Failed to ${
          isEditMode ? 'update' : 'create'
        } workout plan. Please try again.`,
      );
    } finally {
      setLoading(false);
    }
  };

  const DifficultyButton = ({level, selected, onPress}: any) => (
    <Button
      title={level.charAt(0).toUpperCase() + level.slice(1)}
      variant={selected ? 'primary' : 'outline'}
      size="small"
      onPress={onPress}
      style={[styles.difficultyButton, selected && styles.selectedDifficulty]}
    />
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        <View style={styles.content}>
          <Text style={styles.title}>
            {isEditMode
              ? 'Edit Workout Plan'
              : isTemplateMode
              ? 'Create Workout Template'
              : 'Create Workout Plan'}
          </Text>

          <Card style={styles.formCard}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Plan Name *</Text>
              <TextInput
                style={styles.textInput}
                value={planName}
                onChangeText={setPlanName}
                placeholder="Enter workout plan name"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Describe your workout plan"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Difficulty Level</Text>
              <View style={styles.difficultyContainer}>
                <DifficultyButton
                  level="beginner"
                  selected={difficulty === 'beginner'}
                  onPress={() => setDifficulty('beginner')}
                />
                <DifficultyButton
                  level="intermediate"
                  selected={difficulty === 'intermediate'}
                  onPress={() => setDifficulty('intermediate')}
                />
                <DifficultyButton
                  level="advanced"
                  selected={difficulty === 'advanced'}
                  onPress={() => setDifficulty('advanced')}
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Duration (weeks)</Text>
              <TextInput
                style={styles.textInput}
                value={durationWeeks}
                onChangeText={setDurationWeeks}
                placeholder="4"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Frequency per Week</Text>
              <TextInput
                style={styles.textInput}
                value={frequencyPerWeek}
                onChangeText={setFrequencyPerWeek}
                placeholder="3"
                placeholderTextColor="#9ca3af"
                keyboardType="numeric"
              />
            </View>
          </Card>

          <View style={styles.buttonContainer}>
            <Button
              title="Cancel"
              variant="outline"
              onPress={() => navigation.goBack()}
              style={styles.cancelButton}
            />
            <Button
              title={
                loading
                  ? 'Saving...'
                  : isEditMode
                  ? 'Update Plan'
                  : isTemplateMode
                  ? 'Create Template'
                  : 'Create Plan'
              }
              onPress={handleSave}
              style={styles.saveButton}
              disabled={loading}
            />
          </View>
        </View>
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
  content: {
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  formCard: {
    marginBottom: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
    color: '#111827',
    backgroundColor: '#ffffff',
  },
  multilineInput: {
    height: 80,
    textAlignVertical: 'top',
  },
  difficultyContainer: {
    flexDirection: 'row',
    gap: 8,
  },
  difficultyButton: {
    flex: 1,
  },
  selectedDifficulty: {
    backgroundColor: '#3b82f6',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
  },
  saveButton: {
    flex: 1,
    backgroundColor: '#10b981',
  },
});
