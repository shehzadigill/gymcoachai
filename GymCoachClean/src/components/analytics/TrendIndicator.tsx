import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface TrendIndicatorProps {
  trend: {
    metric: string;
    direction: 'improving' | 'declining' | 'stable';
    value?: number;
    change?: number;
  };
  showPercentage?: boolean;
}

export const TrendIndicator: React.FC<TrendIndicatorProps> = ({
  trend,
  showPercentage = true,
}) => {
  const getTrendColor = () => {
    switch (trend.direction) {
      case 'improving':
        return '#10b981';
      case 'declining':
        return '#ef4444';
      case 'stable':
        return '#3b82f6';
      default:
        return '#6b7280';
    }
  };

  const getTrendIcon = () => {
    switch (trend.direction) {
      case 'improving':
        return 'trending-up';
      case 'declining':
        return 'trending-down';
      case 'stable':
        return 'trending-neutral';
      default:
        return 'minus';
    }
  };

  const getTrendLabel = () => {
    switch (trend.direction) {
      case 'improving':
        return 'Improving';
      case 'declining':
        return 'Declining';
      case 'stable':
        return 'Stable';
      default:
        return 'Unknown';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.metricRow}>
        <Text style={styles.metricName}>{trend.metric}</Text>
        <View style={styles.trendContainer}>
          <Icon
            name={getTrendIcon()}
            size={20}
            color={getTrendColor()}
            style={styles.icon}
          />
          <Text style={[styles.trendLabel, {color: getTrendColor()}]}>
            {getTrendLabel()}
          </Text>
          {showPercentage && trend.change !== undefined && (
            <Text style={[styles.changeText, {color: getTrendColor()}]}>
              {trend.change > 0 ? '+' : ''}
              {trend.change.toFixed(1)}%
            </Text>
          )}
        </View>
      </View>
      {trend.value !== undefined && (
        <Text style={styles.valueText}>
          Current:{' '}
          {typeof trend.value === 'number'
            ? trend.value.toFixed(1)
            : trend.value}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e5e7eb',
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  metricName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    flex: 1,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  icon: {
    marginRight: 2,
  },
  trendLabel: {
    fontSize: 14,
    fontWeight: '500',
  },
  changeText: {
    fontSize: 14,
    fontWeight: '600',
  },
  valueText: {
    fontSize: 13,
    color: '#6b7280',
    marginTop: 2,
  },
});
