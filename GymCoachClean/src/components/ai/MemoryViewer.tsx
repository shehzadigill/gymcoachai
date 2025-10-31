import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import {Icon} from '../common/Icon';

interface MemoryItem {
  id: string;
  content: string;
  type: string;
  importance: number;
  timestamp: string;
  metadata?: {
    category?: string;
    confidence?: number;
  };
}

interface MemoryViewerProps {
  memories: MemoryItem[];
  maxItems?: number;
}

const MemoryViewer: React.FC<MemoryViewerProps> = ({
  memories,
  maxItems = 5,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  if (!memories || memories.length === 0) {
    return (
      <View style={styles.emptyContainer}>
        <Icon name="brain" size={24} color="#9ca3af" />
        <Text style={styles.emptyText}>No memories stored yet</Text>
        <Text style={styles.emptySubtext}>
          Chat with AI to build personalized insights
        </Text>
      </View>
    );
  }

  const displayMemories = expanded ? memories : memories.slice(0, maxItems);

  const getImportanceColor = (importance: number) => {
    if (importance >= 0.8) return '#ef4444';
    if (importance >= 0.5) return '#f59e0b';
    return '#3b82f6';
  };

  const getMemoryIcon = (type: string) => {
    switch (type) {
      case 'goal':
        return 'target';
      case 'preference':
        return 'heart';
      case 'achievement':
        return 'award';
      case 'habit':
        return 'repeat';
      default:
        return 'bookmark';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="brain" size={16} color="#6b7280" />
        <Text style={styles.headerText}>Your AI Memory</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{memories.length}</Text>
        </View>
      </View>

      <ScrollView
        style={styles.memoriesList}
        showsVerticalScrollIndicator={false}>
        {displayMemories.map((memory, index) => (
          <View key={memory.id || index} style={styles.memoryCard}>
            <View style={styles.memoryHeader}>
              <View style={styles.memoryIconContainer}>
                <Icon
                  name={getMemoryIcon(memory.type)}
                  size={14}
                  color={getImportanceColor(memory.importance)}
                />
              </View>
              <View style={styles.memoryMeta}>
                <Text style={styles.memoryType}>{memory.type}</Text>
                {memory.metadata?.category && (
                  <Text style={styles.memoryCategory}>
                    {memory.metadata.category}
                  </Text>
                )}
              </View>
              <View
                style={[
                  styles.importanceBadge,
                  {
                    backgroundColor: `${getImportanceColor(
                      memory.importance,
                    )}20`,
                  },
                ]}>
                <Text
                  style={[
                    styles.importanceText,
                    {color: getImportanceColor(memory.importance)},
                  ]}>
                  {Math.round(memory.importance * 100)}%
                </Text>
              </View>
            </View>
            <Text style={styles.memoryContent} numberOfLines={2}>
              {memory.content}
            </Text>
            <Text style={styles.memoryTimestamp}>
              {new Date(memory.timestamp).toLocaleDateString()}
            </Text>
          </View>
        ))}
      </ScrollView>

      {memories.length > maxItems && (
        <Pressable
          style={styles.expandButton}
          onPress={() => setExpanded(!expanded)}>
          <Text style={styles.expandText}>
            {expanded ? 'Show Less' : `Show ${memories.length - maxItems} More`}
          </Text>
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={14}
            color="#3b82f6"
          />
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e5e7eb',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  headerText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badge: {
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#ffffff',
  },
  memoriesList: {
    maxHeight: 300,
  },
  memoryCard: {
    backgroundColor: '#f9fafb',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
    borderLeftWidth: 3,
    borderLeftColor: '#3b82f6',
  },
  memoryHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
    gap: 8,
  },
  memoryIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  memoryMeta: {
    flex: 1,
  },
  memoryType: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    textTransform: 'capitalize',
  },
  memoryCategory: {
    fontSize: 10,
    color: '#6b7280',
    textTransform: 'capitalize',
  },
  importanceBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  importanceText: {
    fontSize: 10,
    fontWeight: '600',
  },
  memoryContent: {
    fontSize: 13,
    color: '#4b5563',
    lineHeight: 18,
    marginBottom: 4,
  },
  memoryTimestamp: {
    fontSize: 10,
    color: '#9ca3af',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 8,
    paddingVertical: 6,
  },
  expandText: {
    fontSize: 12,
    color: '#3b82f6',
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#6b7280',
    marginTop: 8,
  },
  emptySubtext: {
    fontSize: 12,
    color: '#9ca3af',
    marginTop: 4,
  },
});

export default MemoryViewer;
