import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function SimpleApp() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>GymCoach AI - Simple Test</Text>
      <Text style={styles.subText}>App is running successfully!</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#3b82f6',
  },
  text: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 10,
  },
  subText: {
    fontSize: 16,
    color: 'white',
  },
});
