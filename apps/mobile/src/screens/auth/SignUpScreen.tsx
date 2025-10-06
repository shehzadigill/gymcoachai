import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  SafeAreaView,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Animated,
  StatusBar,
} from 'react-native';
import { useAuth } from '../../contexts/AuthContext';
import { Button, LoadingSpinner } from '../../components/common/UI';

export default function SignUpScreen({ navigation }: any) {
  const { signUp, isLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    if (password.length < 8) {
      Alert.alert('Error', 'Password must be at least 8 characters long');
      return;
    }

    try {
      setLocalLoading(true);
      await signUp(
        email.trim().toLowerCase(),
        password,
        firstName.trim(),
        lastName.trim()
      );

      Alert.alert(
        'Account Created',
        'Please check your email for a verification code',
        [
          {
            text: 'OK',
            onPress: () => navigation.navigate('SignIn'),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert('Sign Up Failed', error.message || 'Please try again');
    } finally {
      setLocalLoading(false);
    }
  };

  const navigateToSignIn = () => {
    navigation.navigate('SignIn');
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
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}
      >
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Create Account</Text>
              <Text style={styles.subtitle}>
                Join us to start your fitness journey
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>First Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="First name"
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>Last Name</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Last name"
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Text style={styles.helperText}>
                  Must be at least 8 characters
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>Confirm Password *</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Confirm your password"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <Button
                title="Create Account"
                onPress={handleSignUp}
                loading={localLoading}
                disabled={
                  localLoading ||
                  !email.trim() ||
                  !password.trim() ||
                  !confirmPassword.trim()
                }
                style={styles.signUpButton}
              />
            </View>

            {/* Footer */}
            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account? </Text>
              <TouchableOpacity onPress={navigateToSignIn}>
                <Text style={styles.signInLink}>Sign In</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  keyboardAvoidView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    paddingVertical: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
    textAlign: 'center',
  },
  form: {
    marginBottom: 24,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputGroup: {
    marginBottom: 16,
  },
  halfWidth: {
    flex: 0.48,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#ffffff',
  },
  helperText: {
    fontSize: 12,
    color: '#6b7280',
    marginTop: 4,
  },
  signUpButton: {
    marginTop: 8,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    color: '#6b7280',
  },
  signInLink: {
    fontSize: 14,
    color: '#3b82f6',
    fontWeight: '600',
  },
});
