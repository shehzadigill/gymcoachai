import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Card} from '../common/UI';

interface AdherenceData {
  overall_score: number;
  calories_adherence?: number;
  protein_adherence?: number;
  meal_consistency?: number;
  hydration_adherence?: number;
}

interface AdherenceScoreProps {
  data: AdherenceData;
  compact?: boolean;
}

export const AdherenceScore: React.FC<AdherenceScoreProps> = ({
  data,
  compact = false,
}) => {
  const getScoreColor = (score: number) => {
    if (score >= 0.8) return '#10b981'; // Green
    if (score >= 0.6) return '#f59e0b'; // Yellow
    return '#ef4444'; // Red
  };

  const getScoreLabel = (score: number) => {
    if (score >= 0.8) return 'Excellent';
    if (score >= 0.6) return 'Good';
    if (score >= 0.4) return 'Fair';
    return 'Needs Improvement';
  };

  const scoreColor = getScoreColor(data.overall_score);
  const scorePercent = Math.round(data.overall_score * 100);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View
          style={[
            styles.compactScoreCircle,
            {borderColor: scoreColor, backgroundColor: scoreColor + '20'},
          ]}>
          <Text style={[styles.compactScoreText, {color: scoreColor}]}>
            {scorePercent}
          </Text>
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactLabel}>Adherence Score</Text>
          <Text style={[styles.compactStatus, {color: scoreColor}]}>
            {getScoreLabel(data.overall_score)}
          </Text>
        </View>
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Icon name="target-account" size={24} color={scoreColor} />
        <Text style={styles.title}>Nutrition Adherence</Text>
      </View>

      {/* Overall Score */}
      <View style={styles.overallScoreContainer}>
        <View style={styles.circularProgress}>
          {/* This would be animated in a real implementation */}
          <View
            style={[
              styles.circularProgressInner,
              {borderColor: scoreColor, borderTopColor: 'transparent'},
            ]}
          />
          <View style={styles.circularProgressCenter}>
            <Text style={[styles.overallScoreValue, {color: scoreColor}]}>
              {scorePercent}
            </Text>
            <Text style={styles.overallScoreLabel}>Overall</Text>
          </View>
        </View>
        <View style={styles.overallScoreDetails}>
          <Text style={[styles.scoreStatus, {color: scoreColor}]}>
            {getScoreLabel(data.overall_score)}
          </Text>
          <Text style={styles.scoreDescription}>
            Your nutrition adherence is{' '}
            {getScoreLabel(data.overall_score).toLowerCase()}.
            {data.overall_score >= 0.8
              ? ' Keep up the great work!'
              : ' Room for improvement!'}
          </Text>
        </View>
      </View>

      {/* Category Breakdown */}
      <View style={styles.breakdownContainer}>
        <Text style={styles.breakdownTitle}>Category Breakdown</Text>

        {data.calories_adherence !== undefined && (
          <ScoreBar
            label="Calorie Goals"
            score={data.calories_adherence}
            icon="fire"
          />
        )}

        {data.protein_adherence !== undefined && (
          <ScoreBar
            label="Protein Goals"
            score={data.protein_adherence}
            icon="food-drumstick"
          />
        )}

        {data.meal_consistency !== undefined && (
          <ScoreBar
            label="Meal Consistency"
            score={data.meal_consistency}
            icon="clock-check"
          />
        )}

        {data.hydration_adherence !== undefined && (
          <ScoreBar
            label="Hydration"
            score={data.hydration_adherence}
            icon="water"
          />
        )}
      </View>
    </Card>
  );
};

interface ScoreBarProps {
  label: string;
  score: number;
  icon: string;
}

const ScoreBar: React.FC<ScoreBarProps> = ({label, score, icon}) => {
  const getScoreColor = (s: number) => {
    if (s >= 0.8) return '#10b981';
    if (s >= 0.6) return '#f59e0b';
    return '#ef4444';
  };

  const scoreColor = getScoreColor(score);
  const scorePercent = Math.round(score * 100);

  return (
    <View style={styles.scoreBarContainer}>
      <View style={styles.scoreBarHeader}>
        <View style={styles.scoreBarLabelContainer}>
          <Icon name={icon} size={16} color="#6b7280" />
          <Text style={styles.scoreBarLabel}>{label}</Text>
        </View>
        <Text style={[styles.scoreBarValue, {color: scoreColor}]}>
          {scorePercent}%
        </Text>
      </View>
      <View style={styles.progressBarContainer}>
        <View style={styles.progressBarBackground}>
          <View
            style={[
              styles.progressBarFill,
              {width: `${scorePercent}%`, backgroundColor: scoreColor},
            ]}
          />
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  compactScoreCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactScoreText: {
    fontSize: 18,
    fontWeight: '700',
  },
  compactContent: {
    flex: 1,
  },
  compactLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  compactStatus: {
    fontSize: 13,
    fontWeight: '500',
  },

  // Full card styles
  card: {
    marginBottom: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 20,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
  },

  // Overall score
  overallScoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 16,
  },
  circularProgress: {
    width: 100,
    height: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circularProgressInner: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 8,
    transform: [{rotate: '45deg'}],
  },
  circularProgressCenter: {
    alignItems: 'center',
  },
  overallScoreValue: {
    fontSize: 32,
    fontWeight: '700',
  },
  overallScoreLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  overallScoreDetails: {
    flex: 1,
  },
  scoreStatus: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 4,
  },
  scoreDescription: {
    fontSize: 14,
    color: '#6b7280',
    lineHeight: 20,
  },

  // Breakdown
  breakdownContainer: {
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 16,
  },
  breakdownTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 16,
  },
  scoreBarContainer: {
    marginBottom: 16,
  },
  scoreBarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  scoreBarLabelContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  scoreBarLabel: {
    fontSize: 14,
    color: '#4b5563',
  },
  scoreBarValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  progressBarContainer: {
    height: 8,
  },
  progressBarBackground: {
    height: '100%',
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    borderRadius: 4,
  },
});
