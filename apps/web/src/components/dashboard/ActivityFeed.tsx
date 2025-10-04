'use client';

import { ReactNode } from 'react';

interface ActivityItemProps {
  icon: ReactNode;
  title: string;
  description?: string;
  timestamp: string;
  iconColor?: string;
  onClick?: () => void;
}

interface ActivityFeedProps {
  activities: ActivityItemProps[];
  maxItems?: number;
  showAll?: boolean;
  onViewAll?: () => void;
}

export function ActivityFeed({
  activities,
  maxItems = 5,
  showAll = false,
  onViewAll,
}: ActivityFeedProps) {
  const displayActivities = showAll
    ? activities
    : activities.slice(0, maxItems);

  if (!activities.length) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-500 dark:text-gray-400">No recent activity</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {displayActivities.map((activity, index) => (
          <ActivityItem key={index} {...activity} />
        ))}
      </div>

      {!showAll && activities.length > maxItems && (
        <button
          onClick={onViewAll}
          className="w-full text-center py-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors"
        >
          View all {activities.length} activities
        </button>
      )}
    </div>
  );
}

function ActivityItem({
  icon,
  title,
  description,
  timestamp,
  iconColor = 'text-blue-600',
  onClick,
}: ActivityItemProps) {
  return (
    <div
      className={`
        flex items-start space-x-3 p-3 rounded-lg
        ${onClick ? 'cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors' : ''}
      `}
      onClick={onClick}
    >
      <div className={`flex-shrink-0 ${iconColor}`}>{icon}</div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white">
          {title}
        </p>
        {description && (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            {description}
          </p>
        )}
      </div>
      <div className="flex-shrink-0">
        <p className="text-xs text-gray-400 dark:text-gray-500">{timestamp}</p>
      </div>
    </div>
  );
}
