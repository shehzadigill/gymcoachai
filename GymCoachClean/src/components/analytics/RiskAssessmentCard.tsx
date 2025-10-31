import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Card} from '../common/UI';

interface RiskAssessmentCardProps {
  risk: {
    type: 'plateau' | 'overtraining';
    level: 'low' | 'medium' | 'high';
    value: number;
    description: string;
    recommendations?: string[];
  };
}

export const RiskAssessmentCard: React.FC<RiskAssessmentCardProps> = ({
  risk,
}) => {
  const getRiskColor = () => {
    switch (risk.level) {
      case 'high':
        return '#ef4444';
      case 'medium':
        return '#f59e0b';
      case 'low':
        return '#10b981';
      default:
        return '#6b7280';
    }
  };

  const getRiskIcon = () => {
    switch (risk.type) {
      case 'plateau':
        return 'chart-line-stacked';
      case 'overtraining':
        return 'alert-circle';
      default:
        return 'information';
    }
  };

  const getRiskLabel = () => {
    switch (risk.type) {
      case 'plateau':
        return 'Plateau Risk';
      case 'overtraining':
        return 'Overtraining Risk';
      default:
        return 'Risk Assessment';
    }
  };

  return (
    <Card style={[styles.card, {borderLeftColor: getRiskColor()}]}>
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {backgroundColor: getRiskColor() + '20'},
          ]}>
          <Icon name={getRiskIcon()} size={24} color={getRiskColor()} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.riskLabel}>{getRiskLabel()}</Text>
          <View style={styles.levelContainer}>
            <View style={[styles.levelBar, {backgroundColor: '#e5e7eb'}]}>
              <View
                style={[
                  styles.levelProgress,
                  {
                    width: `${risk.value * 100}%`,
                    backgroundColor: getRiskColor(),
                  },
                ]}
              />
            </View>
            <Text style={[styles.levelText, {color: getRiskColor()}]}>
              {(risk.value * 100).toFixed(0)}% {risk.level.toUpperCase()}
            </Text>
          </View>
        </View>
      </View>

      <Text style={styles.description}>{risk.description}</Text>

      {risk.recommendations && risk.recommendations.length > 0 && (
        <View style={styles.recommendationsContainer}>
          <Text style={styles.recommendationsTitle}>Recommendations:</Text>
          {risk.recommendations.map((rec, index) => (
            <View key={index} style={styles.recommendationItem}>
              <Icon name="check-circle" size={16} color="#10b981" />
              <Text style={styles.recommendationText}>{rec}</Text>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    borderLeftWidth: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  riskLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 6,
  },
  levelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  levelBar: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    overflow: 'hidden',
  },
  levelProgress: {
    height: '100%',
    borderRadius: 4,
  },
  levelText: {
    fontSize: 13,
    fontWeight: '600',
    minWidth: 80,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  recommendationsContainer: {
    backgroundColor: '#f9fafb',
    padding: 12,
    borderRadius: 8,
  },
  recommendationsTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  recommendationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 6,
    gap: 8,
  },
  recommendationText: {
    flex: 1,
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
  },
});
