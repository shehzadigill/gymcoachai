import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Animated,
  StatusBar,
} from 'react-native';

export default function SplashScreen() {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.5)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    StatusBar.setBarStyle('light-content', true);

    // Initial fade in and scale
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation
    const pulse = () => {
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]).start(() => pulse());
    };

    const timer = setTimeout(pulse, 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Animated.View
          style={[
            styles.logoContainer,
            {
              opacity: fadeAnim,
              transform: [{ scale: scaleAnim }, { scale: pulseAnim }],
            },
          ]}
        >
          <Text style={styles.logoEmoji}>💪</Text>
          <Text style={styles.appName}>GymCoach AI</Text>
          <Text style={styles.tagline}>Loading your fitness journey...</Text>
        </Animated.View>

        <Animated.View style={[styles.loadingContainer, { opacity: fadeAnim }]}>
          <View style={styles.loadingBar}>
            <Animated.View
              style={[
                styles.loadingProgress,
                {
                  transform: [
                    {
                      scaleX: pulseAnim.interpolate({
                        inputRange: [1, 1.1],
                        outputRange: [0.3, 1],
                      }),
                    },
                  ],
                },
              ]}
            />
          </View>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#667eea',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 60,
  },
  logoEmoji: {
    fontSize: 100,
    marginBottom: 20,
  },
  appName: {
    fontSize: 36,
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: 12,
    textAlign: 'center',
  },
  tagline: {
    fontSize: 16,
    color: '#ffffff',
    opacity: 0.8,
    textAlign: 'center',
  },
  loadingContainer: {
    width: '100%',
    alignItems: 'center',
  },
  loadingBar: {
    width: 200,
    height: 4,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  loadingProgress: {
    height: '100%',
    backgroundColor: '#ffffff',
    borderRadius: 2,
  },
});
