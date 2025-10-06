import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  Dimensions,
  StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

export default function WelcomeScreen({ navigation }: any) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const logoAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content', true);

    // Sequence of animations
    Animated.sequence([
      // Logo animation
      Animated.timing(logoAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      // Main content animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 600,
          useNativeDriver: true,
        }),
        Animated.timing(scaleAnim, {
          toValue: 1,
          duration: 600,
          useNativeDriver: true,
        }),
      ]),
    ]).start();
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.gradient}>
        {/* Logo Section */}
        <Animated.View
          style={[
            styles.logoSection,
            {
              opacity: logoAnim,
              transform: [
                {
                  translateY: logoAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [-50, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View style={styles.logoContainer}>
            <Text style={styles.logoEmoji}>💪</Text>
            <Text style={styles.appName}>GymCoach AI</Text>
            <Text style={styles.tagline}>Your Personal Fitness Journey</Text>
          </View>
        </Animated.View>

        {/* Main Content */}
        <Animated.View
          style={[
            styles.contentSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
            },
          ]}
        >
          <View style={styles.welcomeCard}>
            <Text style={styles.welcomeTitle}>
              Welcome to Your Transformation
            </Text>
            <Text style={styles.welcomeSubtitle}>
              Personalized workouts, nutrition tracking, and AI-powered coaching
              to help you achieve your fitness goals.
            </Text>

            {/* Features List */}
            <View style={styles.featuresList}>
              <FeatureItem icon="🏋️" text="Smart Workout Plans" />
              <FeatureItem icon="🥗" text="Nutrition Tracking" />
              <FeatureItem icon="📊" text="Progress Analytics" />
              <FeatureItem icon="🔔" text="Smart Reminders" />
            </View>
          </View>
        </Animated.View>

        {/* Action Buttons */}
        <Animated.View
          style={[
            styles.actionSection,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate('SignUp')}
            activeOpacity={0.8}
          >
            <Text style={styles.primaryButtonText}>Start Your Journey</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => navigation.navigate('SignIn')}
            activeOpacity={0.8}
          >
            <Text style={styles.secondaryButtonText}>
              Already have an account? Sign In
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const FeatureItem = ({ icon, text }: { icon: string; text: string }) => (
  <View style={styles.featureItem}>
    <Text style={styles.featureIcon}>{icon}</Text>
    <Text style={styles.featureText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradient: {
    flex: 1,
    paddingHorizontal: 24,
    backgroundColor: '#667eea',
  },
  logoSection: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 60,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 80,
    marginBottom: 16,
  },
  appName: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 8,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
  },
  contentSection: {
    flex: 1.5,
    justifyContent: 'center',
  },
  welcomeCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 20,
    padding: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeSubtitle: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  featuresList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
  },
  featureIcon: {
    fontSize: 24,
    marginRight: 16,
  },
  featureText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
    flex: 1,
  },
  actionSection: {
    paddingBottom: 40,
    gap: 16,
  },
  primaryButton: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#667eea',
  },
  secondaryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  secondaryButtonText: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.9,
  },
});
