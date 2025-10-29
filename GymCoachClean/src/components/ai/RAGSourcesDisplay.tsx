import React from 'react';
import {View, Text, StyleSheet, TouchableOpacity} from 'react-native';
import {Icon} from '../common/Icon';

interface RAGSource {
  document: string;
  score: number;
  metadata?: {
    type?: string;
    timestamp?: string;
  };
}

interface RAGContext {
  sources: RAGSource[];
  queryType?: string;
  relevanceScores?: number[];
}

interface RAGSourcesDisplayProps {
  ragContext?: RAGContext;
  maxSources?: number;
}

const RAGSourcesDisplay: React.FC<RAGSourcesDisplayProps> = ({
  ragContext,
  maxSources = 3,
}) => {
  const [expanded, setExpanded] = React.useState(false);

  if (!ragContext || !ragContext.sources || ragContext.sources.length === 0) {
    return null;
  }

  const sources = ragContext.sources.slice(
    0,
    expanded ? ragContext.sources.length : maxSources,
  );

  const getSourceIcon = (type?: string) => {
    switch (type) {
      case 'workout':
        return 'dumbbell';
      case 'nutrition':
        return 'apple';
      case 'profile':
        return 'user';
      default:
        return 'file-text';
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Icon name="database" size={14} color="#6b7280" />
        <Text style={styles.headerText}>Knowledge Sources</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{ragContext.sources.length}</Text>
        </View>
      </View>

      <View style={styles.sourcesList}>
        {sources.map((source, index) => (
          <View key={index} style={styles.sourceItem}>
            <Icon
              name={getSourceIcon(source.metadata?.type)}
              size={12}
              color="#3b82f6"
            />
            <Text style={styles.sourceName} numberOfLines={1}>
              {source.metadata?.type || 'Document'}
            </Text>
            <View style={styles.scoreContainer}>
              <View
                style={[
                  styles.scoreBar,
                  {width: `${source.score * 100}%`},
                ]}
              />
            </View>
            <Text style={styles.scoreText}>{Math.round(source.score * 100)}%</Text>
          </View>
        ))}
      </View>

      {ragContext.sources.length > maxSources && (
        <TouchableOpacity
          style={styles.expandButton}
          onPress={() => setExpanded(!expanded)}>
          <Text style={styles.expandText}>
            {expanded
              ? 'Show Less'
              : `Show ${ragContext.sources.length - maxSources} More`}
          </Text>
          <Icon
            name={expanded ? 'chevron-up' : 'chevron-down'}
            size={12}
            color="#3b82f6"
          />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f3f4f6',
    borderRadius: 8,
    padding: 12,
    marginTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 8,
  },
  headerText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
  },
  badge: {
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '600',
    color: '#ffffff',
  },
  sourcesList: {
    gap: 6,
  },
  sourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    backgroundColor: '#ffffff',
    borderRadius: 6,
  },
  sourceName: {
    flex: 1,
    fontSize: 11,
    color: '#374151',
    textTransform: 'capitalize',
  },
  scoreContainer: {
    width: 40,
    height: 4,
    backgroundColor: '#e5e7eb',
    borderRadius: 2,
    overflow: 'hidden',
  },
  scoreBar: {
    height: '100%',
    backgroundColor: '#3b82f6',
  },
  scoreText: {
    fontSize: 10,
    color: '#6b7280',
    width: 32,
    textAlign: 'right',
  },
  expandButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    marginTop: 8,
    paddingVertical: 4,
  },
  expandText: {
    fontSize: 11,
    color: '#3b82f6',
    fontWeight: '500',
  },
});

export default RAGSourcesDisplay;
