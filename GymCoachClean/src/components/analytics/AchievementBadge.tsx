import React from 'react';
import {View, Text, StyleSheet} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialCommunityIcons';
import {Card} from '../common/UI';

interface AchievementBadgeProps {
  achievement: {
    id?: string;
    title: string;
    description: string;
    category?: string;
    earned_at?: string;
    icon?: string;
    rarity?: 'common' | 'rare' | 'epic' | 'legendary';
  };
  compact?: boolean;
}

export const AchievementBadge: React.FC<AchievementBadgeProps> = ({
  achievement,
  compact = false,
}) => {
  const getRarityColor = () => {
    switch (achievement.rarity) {
      case 'legendary':
        return '#fbbf24';
      case 'epic':
        return '#a855f7';
      case 'rare':
        return '#3b82f6';
      case 'common':
      default:
        return '#10b981';
    }
  };

  const getIcon = () => {
    return achievement.icon || 'trophy';
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <View
          style={[
            styles.compactIconContainer,
            {backgroundColor: getRarityColor() + '20'},
          ]}>
          <Icon name={getIcon()} size={20} color={getRarityColor()} />
        </View>
        <View style={styles.compactContent}>
          <Text style={styles.compactTitle} numberOfLines={1}>
            {achievement.title}
          </Text>
          {achievement.earned_at && (
            <Text style={styles.compactDate}>
              {formatDate(achievement.earned_at)}
            </Text>
          )}
        </View>
      </View>
    );
  }

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <View
          style={[
            styles.iconContainer,
            {backgroundColor: getRarityColor() + '20'},
          ]}>
          <Icon name={getIcon()} size={32} color={getRarityColor()} />
        </View>
        <View style={styles.headerContent}>
          <Text style={styles.title}>{achievement.title}</Text>
          {achievement.category && (
            <Text style={styles.category}>{achievement.category}</Text>
          )}
        </View>
        {achievement.rarity && (
          <View
            style={[styles.rarityBadge, {backgroundColor: getRarityColor()}]}>
            <Text style={styles.rarityText}>
              {achievement.rarity.toUpperCase()}
            </Text>
          </View>
        )}
      </View>

      <Text style={styles.description}>{achievement.description}</Text>

      {achievement.earned_at && (
        <View style={styles.footer}>
          <Icon name="calendar-check" size={16} color="#6b7280" />
          <Text style={styles.dateText}>
            Earned on {formatDate(achievement.earned_at)}
          </Text>
        </View>
      )}
    </Card>
  );
};

const styles = StyleSheet.create({
  // Compact styles
  compactContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: '#ffffff',
    borderRadius: 8,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  compactIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  compactContent: {
    flex: 1,
  },
  compactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1f2937',
    marginBottom: 2,
  },
  compactDate: {
    fontSize: 12,
    color: '#6b7280',
  },

  // Full card styles
  card: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  headerContent: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1f2937',
    marginBottom: 4,
  },
  category: {
    fontSize: 13,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  rarityBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  rarityText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#ffffff',
    letterSpacing: 0.5,
  },
  description: {
    fontSize: 14,
    color: '#4b5563',
    lineHeight: 20,
    marginBottom: 12,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#e5e7eb',
  },
  dateText: {
    fontSize: 13,
    color: '#6b7280',
  },
});
