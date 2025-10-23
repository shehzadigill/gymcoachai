// Timeline View Component
import React from 'react';
import { formatRelativeTime } from '../../../lib/ai-utils';

interface TimelineItem {
  id: string;
  date: string;
  title: string;
  description?: string;
  type?: 'memory' | 'achievement' | 'milestone' | 'progress' | 'event';
  importance?: number;
  metadata?: Record<string, any>;
}

interface TimelineViewProps {
  items: TimelineItem[];
  title?: string;
  maxItems?: number;
  showImportance?: boolean;
  showDates?: boolean;
  className?: string;
}

export function TimelineView({
  items,
  title,
  maxItems = 10,
  showImportance = true,
  showDates = true,
  className = '',
}: TimelineViewProps) {
  if (!items || items.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-32 bg-gray-50 rounded-lg ${className}`}
      >
        <span className="text-gray-500">No timeline data available</span>
      </div>
    );
  }

  const sortedItems = [...items]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, maxItems);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}

      <div className="space-y-4">
        {sortedItems.map((item, index) => (
          <TimelineItemComponent
            key={item.id}
            item={item}
            showImportance={showImportance}
            showDates={showDates}
            isLast={index === sortedItems.length - 1}
          />
        ))}
      </div>
    </div>
  );
}

// Individual timeline item component
interface TimelineItemComponentProps {
  item: TimelineItem;
  showImportance: boolean;
  showDates: boolean;
  isLast: boolean;
}

function TimelineItemComponent({
  item,
  showImportance,
  showDates,
  isLast,
}: TimelineItemComponentProps) {
  const typeConfig = getTimelineTypeConfig(item.type || 'event');

  return (
    <div className="relative flex items-start space-x-3">
      {/* Timeline line */}
      {!isLast && (
        <div className="absolute left-4 top-8 w-0.5 h-8 bg-gray-200" />
      )}

      {/* Icon */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${typeConfig.bgColor}`}
      >
        <span className="text-sm">{typeConfig.icon}</span>
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-medium text-gray-900 truncate">
            {item.title}
          </h4>

          <div className="flex items-center space-x-2">
            {showImportance && item.importance !== undefined && (
              <ImportanceIndicator importance={item.importance} />
            )}
            {showDates && (
              <span className="text-xs text-gray-500">
                {formatRelativeTime(item.date)}
              </span>
            )}
          </div>
        </div>

        {item.description && (
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">
            {item.description}
          </p>
        )}

        {item.metadata && Object.keys(item.metadata).length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {Object.entries(item.metadata).map(([key, value]) => (
              <span
                key={key}
                className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800"
              >
                {key}: {String(value)}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Importance indicator
interface ImportanceIndicatorProps {
  importance: number;
}

function ImportanceIndicator({ importance }: ImportanceIndicatorProps) {
  const getImportanceColor = (importance: number) => {
    if (importance >= 0.8) return 'text-red-600';
    if (importance >= 0.6) return 'text-orange-600';
    if (importance >= 0.4) return 'text-yellow-600';
    return 'text-gray-600';
  };

  const getImportanceIcon = (importance: number) => {
    if (importance >= 0.8) return '🔴';
    if (importance >= 0.6) return '🟠';
    if (importance >= 0.4) return '🟡';
    return '⚪';
  };

  return (
    <span className={`text-xs ${getImportanceColor(importance)}`}>
      {getImportanceIcon(importance)}
    </span>
  );
}

// Memory timeline specific component
interface MemoryTimelineProps {
  memories: Array<{
    id: string;
    type: string;
    content: string;
    importance: number;
    createdAt: string;
    tags?: string[];
  }>;
  title?: string;
  maxItems?: number;
  className?: string;
}

export function MemoryTimeline({
  memories,
  title = 'Memory Timeline',
  maxItems = 10,
  className = '',
}: MemoryTimelineProps) {
  const timelineItems: TimelineItem[] = memories.map((memory) => ({
    id: memory.id,
    date: memory.createdAt,
    title: `${memory.type.charAt(0).toUpperCase() + memory.type.slice(1)} Memory`,
    description: memory.content,
    type: 'memory' as const,
    importance: memory.importance,
    metadata: {
      tags: memory.tags?.join(', '),
    },
  }));

  return (
    <TimelineView
      items={timelineItems}
      title={title}
      maxItems={maxItems}
      showImportance={true}
      showDates={true}
      className={className}
    />
  );
}

// Progress timeline specific component
interface ProgressTimelineProps {
  progressPoints: Array<{
    id: string;
    date: string;
    metric: string;
    value: number;
    unit: string;
    change?: number;
    achievement?: string;
  }>;
  title?: string;
  maxItems?: number;
  className?: string;
}

export function ProgressTimeline({
  progressPoints,
  title = 'Progress Timeline',
  maxItems = 10,
  className = '',
}: ProgressTimelineProps) {
  const timelineItems: TimelineItem[] = progressPoints.map((point) => ({
    id: point.id,
    date: point.date,
    title: point.achievement || `${point.metric} Progress`,
    description: `${point.value} ${point.unit}${point.change ? ` (${point.change > 0 ? '+' : ''}${point.change}%)` : ''}`,
    type: 'progress' as const,
    metadata: {
      metric: point.metric,
      value: point.value,
      unit: point.unit,
    },
  }));

  return (
    <TimelineView
      items={timelineItems}
      title={title}
      maxItems={maxItems}
      showImportance={false}
      showDates={true}
      className={className}
    />
  );
}

// Utility functions
function getTimelineTypeConfig(type: string) {
  const configs = {
    memory: {
      icon: '🧠',
      bgColor: 'bg-blue-100',
      textColor: 'text-blue-800',
    },
    achievement: {
      icon: '🏆',
      bgColor: 'bg-yellow-100',
      textColor: 'text-yellow-800',
    },
    milestone: {
      icon: '🎯',
      bgColor: 'bg-green-100',
      textColor: 'text-green-800',
    },
    progress: {
      icon: '📈',
      bgColor: 'bg-purple-100',
      textColor: 'text-purple-800',
    },
    event: {
      icon: '📅',
      bgColor: 'bg-gray-100',
      textColor: 'text-gray-800',
    },
  };

  return configs[type as keyof typeof configs] || configs.event;
}

export default TimelineView;
