import React, {useState} from 'react';
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

export default function CreatePlanScreen({navigation}: any) {
  const [planName, setPlanName] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >('beginner');
  const [durationWeeks, setDurationWeeks] = useState('4');
  const [frequencyPerWeek, setFrequencyPerWeek] = useState('3');

  const handleSave = () => {
    if (!planName.trim()) {
      Alert.alert('Error', 'Please enter a plan name');
      return;
    }

    // TODO: Implement actual save functionality
    Alert.alert('Success', 'Workout plan created successfully!', [
      {
        text: 'OK',
        onPress: () => navigation.goBack(),
      },
    ]);
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
          <Text style={styles.title}>Create Workout Plan</Text>

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
              title="Create Plan"
              onPress={handleSave}
              style={styles.saveButton}
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
