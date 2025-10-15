import React, {useState, useRef, useEffect} from 'react';
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
import {useAuth} from '../../contexts/AuthContext';
import {Button, LoadingSpinner} from '../../components/common/UI';
import {useTranslation} from 'react-i18next';
import FloatingSettingsButton from '../../components/common/FloatingSettingsButton';

export default function SignUpScreen({navigation}: any) {
  const {signUp, isLoading} = useAuth();
  const {t} = useTranslation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [localLoading, setLocalLoading] = useState(false);

  const handleSignUp = async () => {
    if (!email.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert(t('auth.errors.error'), t('auth.errors.fill_all_fields'));
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert(
        t('auth.errors.error'),
        t('auth.errors.passwords_dont_match'),
      );
      return;
    }

    if (password.length < 8) {
      Alert.alert(t('auth.errors.error'), t('auth.errors.password_too_short'));
      return;
    }

    try {
      setLocalLoading(true);
      await signUp(
        email.trim().toLowerCase(),
        password,
        firstName.trim(),
        lastName.trim(),
      );

      Alert.alert(
        t('auth.account_created'),
        t('auth.check_email_verification'),
        [
          {
            text: t('common.ok'),
            onPress: () => navigation.navigate('SignIn'),
          },
        ],
      );
    } catch (error: any) {
      Alert.alert(
        t('auth.errors.signup_failed'),
        error.message || t('auth.errors.try_again'),
      );
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
      <FloatingSettingsButton />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardAvoidView}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <View style={styles.content}>
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>{t('auth.create_account')}</Text>
              <Text style={styles.subtitle}>
                {t('auth.join_fitness_journey')}
              </Text>
            </View>

            {/* Form */}
            <View style={styles.form}>
              <View style={styles.row}>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t('auth.first_name')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth.first_name')}
                    value={firstName}
                    onChangeText={setFirstName}
                    autoCapitalize="words"
                  />
                </View>
                <View style={[styles.inputGroup, styles.halfWidth]}>
                  <Text style={styles.label}>{t('auth.last_name')}</Text>
                  <TextInput
                    style={styles.input}
                    placeholder={t('auth.last_name')}
                    value={lastName}
                    onChangeText={setLastName}
                    autoCapitalize="words"
                  />
                </View>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.email')} *</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.enter_email')}
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.password')} *</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.enter_password')}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <Text style={styles.helperText}>
                  {t('auth.password_requirements')}
                </Text>
              </View>

              <View style={styles.inputGroup}>
                <Text style={styles.label}>{t('auth.confirm_password')} *</Text>
                <TextInput
                  style={styles.input}
                  placeholder={t('auth.confirm_password')}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry
                  autoCapitalize="none"
                />
              </View>

              <Button
                title={t('auth.create_account')}
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
              <Text style={styles.footerText}>
                {t('auth.already_have_account')}{' '}
              </Text>
              <TouchableOpacity onPress={navigateToSignIn}>
                <Text style={styles.signInLink}>{t('auth.sign_in')}</Text>
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
