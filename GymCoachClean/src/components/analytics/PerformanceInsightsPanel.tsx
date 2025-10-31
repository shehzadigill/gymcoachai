import React from 'react';
import {View, Text, StyleSheet, ScrollView} from 'react-native';
import {Card} from '../common/UI';
import {TrendIndicator} from './TrendIndicator';
import {RiskAssessmentCard} from './RiskAssessmentCard';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';

interface PerformanceInsights {
  trends: {
    strength?: {
      direction: 'improving' | 'declining' | 'stable';
      value?: number;
      change?: number;
    };
    consistency?: {
      direction: 'improving' | 'declining' | 'stable';
      value?: number;
      change?: number;
    };
    volume?: {
      direction: 'improving' | 'declining' | 'stable';
      value?: number;
      change?: number;
    };
  };
  risks: {
    plateau_risk?: {
      level: 'low' | 'medium' | 'high';
      value: number;
      description: string;
      recommendations?: string[];
    };
    overtraining_risk?: {
      level: 'low' | 'medium' | 'high';
      value: number;
      description: string;
      recommendations?: string[];
    };
  };
  recommendations?: string[];
  warnings?: string[];
}

interface PerformanceInsightsPanelProps {
  insights: PerformanceInsights;
  loading?: boolean;
}

export const PerformanceInsightsPanel: React.FC<
  PerformanceInsightsPanelProps
> = ({insights, loading = false}) => {
  if (loading) {
    return (
      <Card style={styles.loadingCard}>
        <Text style={styles.loadingText}>Loading insights...</Text>
      </Card>
    );
  }

  const hasTrends = insights.trends && Object.keys(insights.trends).length > 0;
  const hasRisks = insights.risks && Object.keys(insights.risks).length > 0;
  const hasRecommendations =
    insights.recommendations && insights.recommendations.length > 0;
  const hasWarnings = insights.warnings && insights.warnings.length > 0;

  if (!hasTrends && !hasRisks && !hasRecommendations && !hasWarnings) {
    return (
      <Card style={styles.emptyCard}>
        <Icon name="lightbulb-outline" size={48} color="#9ca3af" />
        <Text style={styles.emptyTitle}>No insights available yet</Text>
        <Text style={styles.emptyText}>
          Complete more workouts to get AI-powered performance insights
        </Text>
      </Card>
    );
  }

  return (
    <View style={styles.container}>
      {/* Performance Trends */}
      {hasTrends && (
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="trending-up" size={24} color="#3b82f6" />
            <Text style={styles.sectionTitle}>Performance Trends</Text>
          </View>
          <View style={styles.trendsContainer}>
            {insights.trends.strength && (
              <TrendIndicator
                trend={{
                  metric: 'Strength',
                  ...insights.trends.strength,
                }}
              />
            )}
            {insights.trends.consistency && (
              <TrendIndicator
                trend={{
                  metric: 'Consistency',
                  ...insights.trends.consistency,
                }}
              />
            )}
            {insights.trends.volume && (
              <TrendIndicator
                trend={{
                  metric: 'Volume',
                  ...insights.trends.volume,
                }}
              />
            )}
          </View>
        </Card>
      )}

      {/* Risk Assessment */}
      {hasRisks && (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="alert-circle-outline" size={24} color="#f59e0b" />
            <Text style={styles.sectionTitle}>Risk Assessment</Text>
          </View>
          {insights.risks.plateau_risk && (
            <RiskAssessmentCard
              risk={{
                type: 'plateau',
                ...insights.risks.plateau_risk,
              }}
            />
          )}
          {insights.risks.overtraining_risk && (
            <RiskAssessmentCard
              risk={{
                type: 'overtraining',
                ...insights.risks.overtraining_risk,
              }}
            />
          )}
        </View>
      )}

      {/* Recommendations */}
      {hasRecommendations && (
        <Card style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="star" size={24} color="#10b981" />
            <Text style={styles.sectionTitle}>Recommendations</Text>
          </View>
          <View style={styles.listContainer}>
            {insights.recommendations!.map((rec, index) => (
              <View key={index} style={styles.listItem}>
                <Icon name="check-circle" size={18} color="#10b981" />
                <Text style={styles.listItemText}>{rec}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}

      {/* Warnings */}
      {hasWarnings && (
        <Card style={styles.warningSection}>
          <View style={styles.sectionHeader}>
            <Icon name="alert" size={24} color="#ef4444" />
            <Text style={styles.sectionTitle}>Warnings</Text>
          </View>
          <View style={styles.listContainer}>
            {insights.warnings!.map((warning, index) => (
              <View key={index} style={styles.warningItem}>
                <Icon name="alert-circle" size={18} color="#ef4444" />
                <Text style={styles.warningText}>{warning}</Text>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },
  trendsContainer: {
    marginTop: 8,
  },
  listContainer: {
    gap: 12,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  listItemText: {
    flex: 1,
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
  },
  warningSection: {
    marginBottom: 16,
    backgroundColor: '#fef2f2',
    borderLeftWidth: 4,
    borderLeftColor: '#ef4444',
  },
  warningItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  warningText: {
    flex: 1,
    fontSize: 14,
    color: '#991b1b',
    lineHeight: 20,
    fontWeight: '500',
  },
  loadingCard: {
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: '#6b7280',
  },
  emptyCard: {
    padding: 32,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1f2937',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
    lineHeight: 20,
  },
});
