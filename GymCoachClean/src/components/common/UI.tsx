import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import {useTheme} from '../../theme';

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
  const {colors} = useTheme();
  const buttonStyle = [
    styles.button,
    getVariantStyle(variant, colors),
    styles[size],
    disabled && styles.disabled,
    style,
  ];

  const textStyle = [
    styles.text,
    getVariantTextStyle(variant, colors),
    styles[`${size}Text`],
    disabled && styles.disabledText,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator
          color={variant === 'primary' ? colors.primaryText : colors.primary}
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

export function Card({children, style, padding = true}: CardProps) {
  const {colors} = useTheme();
  return (
    <View
      style={[
        styles.card,
        {backgroundColor: colors.card, borderColor: colors.border},
        padding && styles.cardPadding,
        style,
      ]}>
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
  color = undefined,
}: LoadingSpinnerProps) {
  const {colors} = useTheme();
  return (
    <View style={styles.spinner}>
      <ActivityIndicator size={size} color={color || colors.primary} />
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
  // variant colors are computed via theme helpers
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
  // text colors are computed via theme helpers
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
    borderWidth: 1,
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

function getVariantStyle(
  variant: NonNullable<ButtonProps['variant']>,
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (variant) {
    case 'primary':
      return {backgroundColor: colors.primary};
    case 'secondary':
      return {backgroundColor: colors.surface};
    case 'outline':
      return {
        backgroundColor: 'transparent',
        borderWidth: 1,
        borderColor: colors.primary,
      };
    default:
      return {};
  }
}

function getVariantTextStyle(
  variant: NonNullable<ButtonProps['variant']>,
  colors: ReturnType<typeof useTheme>['colors'],
) {
  switch (variant) {
    case 'primary':
      return {color: colors.primaryText};
    case 'secondary':
      return {color: colors.text};
    case 'outline':
      return {color: colors.primary};
    default:
      return {};
  }
}
