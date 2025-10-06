import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: any;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
}: ButtonProps) {
  const buttonStyle = [
    styles.button,
    styles[variant],
    styles[size],
    disabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    styles[`${variant}Text`],
    styles[`${size}Text`],
    disabled && styles.disabledText,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? '#ffffff' : '#3b82f6'}
          size="small"
        />
      ) : (
        <Text style={textStyle}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

interface CardProps {
  children: React.ReactNode;
  style?: any;
  padding?: boolean;
}

export function Card({ children, style, padding = true }: CardProps) {
  return (
    <View style={[styles.card, padding && styles.cardPadding, style]}>
      {children}
    </View>
  );
}

interface LoadingSpinnerProps {
  size?: 'small' | 'large';
  color?: string;
}

export function LoadingSpinner({
  size = 'large',
  color = '#3b82f6',
}: LoadingSpinnerProps) {
  return (
    <View style={styles.spinner}>
      <ActivityIndicator size={size} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  // Button styles
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
  },
  primary: {
    backgroundColor: '#3b82f6',
  },
  secondary: {
    backgroundColor: '#f3f4f6',
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  disabled: {
    opacity: 0.5,
  },
  small: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    minHeight: 32,
  },
  medium: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    minHeight: 40,
  },
  large: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    minHeight: 48,
  },
  text: {
    fontWeight: '600',
    textAlign: 'center',
  },
  primaryText: {
    color: '#ffffff',
  },
  secondaryText: {
    color: '#374151',
  },
  outlineText: {
    color: '#3b82f6',
  },
  disabledText: {
    opacity: 0.5,
  },
  smallText: {
    fontSize: 14,
  },
  mediumText: {
    fontSize: 16,
  },
  largeText: {
    fontSize: 18,
  },

  // Card styles
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  cardPadding: {
    padding: 16,
  },

  // Spinner styles
  spinner: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
});
