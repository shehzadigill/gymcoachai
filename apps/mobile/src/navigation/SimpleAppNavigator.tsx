import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

interface SimpleAppNavigatorProps {
  isAuthenticated: boolean;
}

export default function SimpleAppNavigator({
  isAuthenticated,
}: SimpleAppNavigatorProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>GymCoach AI</Text>
      <Text style={styles.status}>
        Status: {isAuthenticated ? 'Authenticated' : 'Not Authenticated'}
      </Text>

      {!isAuthenticated ? (
        <View style={styles.authContainer}>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Sign In</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[styles.button, styles.secondaryButton]}>
            <Text style={[styles.buttonText, styles.secondaryButtonText]}>
              Sign Up
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.mainContainer}>
          <Text style={styles.welcome}>Welcome to GymCoach AI!</Text>
          <TouchableOpacity style={styles.button}>
            <Text style={styles.buttonText}>Dashboard</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f5f5f5',
    padding: 20,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 20,
  },
  status: {
    fontSize: 16,
    color: '#666',
    marginBottom: 40,
  },
  authContainer: {
    width: '100%',
    maxWidth: 300,
  },
  mainContainer: {
    alignItems: 'center',
  },
  welcome: {
    fontSize: 18,
    color: '#333',
    marginBottom: 30,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#3b82f6',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    marginBottom: 15,
    width: '100%',
    alignItems: 'center',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#3b82f6',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButtonText: {
    color: '#3b82f6',
  },
});
