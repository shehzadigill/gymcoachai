import React from 'react';
import {View, Text, StyleSheet} from 'react-native';

interface ConfidenceIndicatorProps {
  score: number; // 0-1
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
}

const ConfidenceIndicator: React.FC<ConfidenceIndicatorProps> = ({
  score,
  size = 'md',
  showLabel = true,
}) => {
  const getColor = () => {
    if (score >= 0.8) return '#10b981'; // green
    if (score >= 0.6) return '#f59e0b'; // yellow
    return '#ef4444'; // red
  };

  const getLabel = () => {
    if (score >= 0.8) return 'High';
    if (score >= 0.6) return 'Medium';
    return 'Low';
  };

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return {width: 40, height: 4};
      case 'lg':
        return {width: 120, height: 8};
      default:
        return {width: 80, height: 6};
    }
  };

  const sizeStyles = getSizeStyles();
  const color = getColor();

  return (
    <View style={styles.container}>
      {showLabel && (
        <Text style={[styles.label, {color}]}>{getLabel()} Confidence</Text>
      )}
      <View style={[styles.bar, sizeStyles, {backgroundColor: '#e5e7eb'}]}>
        <View
          style={[
            styles.fill,
            {
              width: `${score * 100}%`,
              backgroundColor: color,
              borderRadius: sizeStyles.height / 2,
            },
          ]}
        />
      </View>
      {showLabel && (
        <Text style={styles.percentage}>{Math.round(score * 100)}%</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
  bar: {
    borderRadius: 4,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
  },
  percentage: {
    fontSize: 11,
    color: '#6b7280',
  },
});

export default ConfidenceIndicator;
