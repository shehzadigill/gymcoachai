import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';

export default function ExerciseDetailScreen({ route }: any) {
  const { exerciseId } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Exercise Detail</Text>
        <Text style={styles.subtitle}>Exercise ID: {exerciseId}</Text>
        <Text style={styles.placeholder}>Coming soon...</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    marginBottom: 20,
  },
  placeholder: {
    fontSize: 14,
    color: '#9ca3af',
    fontStyle: 'italic',
  },
});
