import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  RefreshControl,
  Dimensions,
} from 'react-native';
import { Card, LoadingSpinner } from '../components/common/UI';
import apiClient from '../services/api';

const { width } = Dimensions.get('window');

export default function AnalyticsScreen() {
  const [strengthProgress, setStrengthProgress] = useState<any[]>([]);
  const [bodyMeasurements, setBodyMeasurements] = useState<any[]>([]);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [achievements, setAchievements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadAnalyticsData();
  }, []);

  const loadAnalyticsData = async () => {
    try {
      setLoading(true);

      const [strengthData, bodyData, milestonesData, achievementsData] =
        await Promise.allSettled([
          apiClient.getStrengthProgress(),
          apiClient.getBodyMeasurements(),
          apiClient.getMilestones(),
          apiClient.getAchievements(),
        ]);

      setStrengthProgress(
        strengthData.status === 'fulfilled' ? strengthData.value : []
      );
      setBodyMeasurements(
        bodyData.status === 'fulfilled' ? bodyData.value : []
      );
      setMilestones(
        milestonesData.status === 'fulfilled' ? milestonesData.value : []
      );
      setAchievements(
        achievementsData.status === 'fulfilled' ? achievementsData.value : []
      );
    } catch (error) {
      console.error('Error loading analytics data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadAnalyticsData();
  };

  if (loading && !strengthProgress.length) {
    return (
      <SafeAreaView style={styles.container}>
        <LoadingSpinner />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
          <Text style={styles.subtitle}>Track your fitness progress</Text>
        </View>

        {/* Overview Stats */}
        <View style={styles.statsContainer}>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{strengthProgress.length}</Text>
            <Text style={styles.statLabel}>Strength Records</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{bodyMeasurements.length}</Text>
            <Text style={styles.statLabel}>Body Measurements</Text>
          </Card>
          <Card style={styles.statCard}>
            <Text style={styles.statNumber}>{achievements.length}</Text>
            <Text style={styles.statLabel}>Achievements</Text>
          </Card>
        </View>

        {/* Recent Strength Progress */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Strength Progress</Text>
          {strengthProgress && strengthProgress.length > 0 ? (
            strengthProgress.slice(0, 5).map((record, index) => (
              <Card key={record.id || index} style={styles.progressCard}>
                <View style={styles.progressHeader}>
                  <Text style={styles.exerciseName}>
                    {record.exercise?.name || 'Exercise'}
                  </Text>
                  <Text style={styles.progressDate}>
                    {new Date(record.date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.progressStats}>
                  <View style={styles.progressStat}>
                    <Text style={styles.progressValue}>{record.weight}kg</Text>
                    <Text style={styles.progressLabel}>Weight</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text style={styles.progressValue}>{record.reps}</Text>
                    <Text style={styles.progressLabel}>Reps</Text>
                  </View>
                  <View style={styles.progressStat}>
                    <Text style={styles.progressValue}>
                      {record.oneRepMax}kg
                    </Text>
                    <Text style={styles.progressLabel}>1RM</Text>
                  </View>
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No strength progress recorded
              </Text>
              <Text style={styles.emptySubtext}>
                Start tracking your workouts!
              </Text>
            </Card>
          )}
        </View>

        {/* Recent Body Measurements */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Body Measurements</Text>
          {bodyMeasurements && bodyMeasurements.length > 0 ? (
            bodyMeasurements.slice(0, 3).map((measurement, index) => (
              <Card
                key={measurement.id || index}
                style={styles.measurementCard}
              >
                <View style={styles.measurementHeader}>
                  <Text style={styles.measurementDate}>
                    {new Date(measurement.date).toLocaleDateString()}
                  </Text>
                </View>
                <View style={styles.measurementStats}>
                  {measurement.weight && (
                    <View style={styles.measurementStat}>
                      <Text style={styles.measurementValue}>
                        {measurement.weight}kg
                      </Text>
                      <Text style={styles.measurementLabel}>Weight</Text>
                    </View>
                  )}
                  {measurement.bodyFat && (
                    <View style={styles.measurementStat}>
                      <Text style={styles.measurementValue}>
                        {measurement.bodyFat}%
                      </Text>
                      <Text style={styles.measurementLabel}>Body Fat</Text>
                    </View>
                  )}
                  {measurement.muscleMass && (
                    <View style={styles.measurementStat}>
                      <Text style={styles.measurementValue}>
                        {measurement.muscleMass}kg
                      </Text>
                      <Text style={styles.measurementLabel}>Muscle Mass</Text>
                    </View>
                  )}
                </View>
              </Card>
            ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>
                No body measurements recorded
              </Text>
              <Text style={styles.emptySubtext}>
                Track your body composition changes!
              </Text>
            </Card>
          )}
        </View>

        {/* Active Milestones */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Milestones</Text>
          {milestones && milestones.length > 0 ? (
            milestones
              .filter((m) => !m.achieved)
              .slice(0, 3)
              .map((milestone) => (
                <Card key={milestone.id} style={styles.milestoneCard}>
                  <Text style={styles.milestoneTitle}>{milestone.title}</Text>
                  {milestone.description && (
                    <Text style={styles.milestoneDescription}>
                      {milestone.description}
                    </Text>
                  )}
                  <View style={styles.milestoneProgress}>
                    <View style={styles.progressBar}>
                      <View
                        style={[
                          styles.progressFill,
                          {
                            width: `${(milestone.currentValue / milestone.targetValue) * 100}%`,
                          },
                        ]}
                      />
                    </View>
                    <Text style={styles.progressText}>
                      {milestone.currentValue} / {milestone.targetValue}{' '}
                      {milestone.unit}
                    </Text>
                  </View>
                </Card>
              ))
          ) : (
            <Card style={styles.emptyCard}>
              <Text style={styles.emptyText}>No active milestones</Text>
              <Text style={styles.emptySubtext}>
                Set your first fitness goal!
              </Text>
            </Card>
          )}
        </View>

        {/* Recent Achievements */}
        {achievements && achievements.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Recent Achievements</Text>
            {achievements.slice(0, 3).map((achievement) => (
              <Card key={achievement.id} style={styles.achievementCard}>
                <View style={styles.achievementContent}>
                  <Text style={styles.achievementTitle}>
                    {achievement.title}
                  </Text>
                  <Text style={styles.achievementDescription}>
                    {achievement.description}
                  </Text>
                  <Text style={styles.achievementDate}>
                    Unlocked{' '}
                    {new Date(achievement.unlockedAt).toLocaleDateString()}
                  </Text>
                </View>
                <Text style={styles.achievementBadge}>🏆</Text>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f9fafb',
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 16,
    color: '#6b7280',
  },
  statsContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    marginBottom: 20,
    justifyContent: 'space-between',
  },
  statCard: {
    flex: 1,
    marginHorizontal: 4,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#3b82f6',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: 12,
  },
  progressCard: {
    marginBottom: 12,
  },
  progressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  exerciseName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  progressDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  progressStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  progressStat: {
    alignItems: 'center',
  },
  progressValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  progressLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  measurementCard: {
    marginBottom: 12,
  },
  measurementHeader: {
    marginBottom: 12,
  },
  measurementDate: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
  },
  measurementStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  measurementStat: {
    alignItems: 'center',
  },
  measurementValue: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 4,
  },
  measurementLabel: {
    fontSize: 12,
    color: '#6b7280',
  },
  milestoneCard: {
    marginBottom: 12,
  },
  milestoneTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  milestoneDescription: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 12,
  },
  milestoneProgress: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#e5e7eb',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#3b82f6',
    borderRadius: 4,
  },
  progressText: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
  achievementCard: {
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  achievementContent: {
    flex: 1,
  },
  achievementTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  achievementDescription: {
    fontSize: 14,
    color: '#374151',
    marginBottom: 4,
  },
  achievementDate: {
    fontSize: 12,
    color: '#6b7280',
  },
  achievementBadge: {
    fontSize: 24,
    marginLeft: 12,
  },
  emptyCard: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  emptyText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6b7280',
    textAlign: 'center',
  },
});
