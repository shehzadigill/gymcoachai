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

export default function CreateExerciseScreen({navigation}: any) {
  const [exerciseName, setExerciseName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [muscleGroups, setMuscleGroups] = useState('');
  const [equipment, setEquipment] = useState('');
  const [difficulty, setDifficulty] = useState<
    'beginner' | 'intermediate' | 'advanced'
  >('beginner');
  const [instructions, setInstructions] = useState('');

  const handleSave = () => {
    if (!exerciseName.trim()) {
      Alert.alert('Error', 'Please enter an exercise name');
      return;
    }

    // TODO: Implement actual save functionality
    Alert.alert('Success', 'Exercise created successfully!', [
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
          <Text style={styles.title}>Create Exercise</Text>

          <Card style={styles.formCard}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Exercise Name *</Text>
              <TextInput
                style={styles.textInput}
                value={exerciseName}
                onChangeText={setExerciseName}
                placeholder="Enter exercise name"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Description</Text>
              <TextInput
                style={[styles.textInput, styles.multilineInput]}
                value={description}
                onChangeText={setDescription}
                placeholder="Brief description of the exercise"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={2}
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Category</Text>
              <TextInput
                style={styles.textInput}
                value={category}
                onChangeText={setCategory}
                placeholder="e.g., Strength, Cardio, Flexibility"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Muscle Groups</Text>
              <TextInput
                style={styles.textInput}
                value={muscleGroups}
                onChangeText={setMuscleGroups}
                placeholder="e.g., Chest, Shoulders, Triceps (comma separated)"
                placeholderTextColor="#9ca3af"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Equipment</Text>
              <TextInput
                style={styles.textInput}
                value={equipment}
                onChangeText={setEquipment}
                placeholder="e.g., Barbell, Dumbbells, None (comma separated)"
                placeholderTextColor="#9ca3af"
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
              <Text style={styles.label}>Instructions</Text>
              <TextInput
                style={[styles.textInput, styles.largeMultilineInput]}
                value={instructions}
                onChangeText={setInstructions}
                placeholder="Step-by-step instructions for performing the exercise"
                placeholderTextColor="#9ca3af"
                multiline
                numberOfLines={4}
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
              title="Create Exercise"
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
    height: 60,
    textAlignVertical: 'top',
  },
  largeMultilineInput: {
    height: 100,
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
