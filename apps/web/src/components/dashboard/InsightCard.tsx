'use client';

import { ReactNode, useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

interface InsightCardProps {
  title: string;
  type: 'success' | 'warning' | 'info' | 'tip';
  children: ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  collapsible?: boolean;
  defaultExpanded?: boolean;
}

export function InsightCard({
  title,
  type,
  children,
  action,
  collapsible = false,
  defaultExpanded = true,
}: InsightCardProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  const typeStyles = {
    success: {
      bg: 'bg-green-50 dark:bg-green-900/10',
      border: 'border-green-200 dark:border-green-800',
      header: 'bg-green-100 dark:bg-green-900/20',
      icon: '✅',
      titleColor: 'text-green-800 dark:text-green-200',
    },
    warning: {
      bg: 'bg-yellow-50 dark:bg-yellow-900/10',
      border: 'border-yellow-200 dark:border-yellow-800',
      header: 'bg-yellow-100 dark:bg-yellow-900/20',
      icon: '⚠️',
      titleColor: 'text-yellow-800 dark:text-yellow-200',
    },
    info: {
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      border: 'border-blue-200 dark:border-blue-800',
      header: 'bg-blue-100 dark:bg-blue-900/20',
      icon: 'ℹ️',
      titleColor: 'text-blue-800 dark:text-blue-200',
    },
    tip: {
      bg: 'bg-purple-50 dark:bg-purple-900/10',
      border: 'border-purple-200 dark:border-purple-800',
      header: 'bg-purple-100 dark:bg-purple-900/20',
      icon: '💡',
      titleColor: 'text-purple-800 dark:text-purple-200',
    },
  };

  const styles = typeStyles[type];

  return (
    <div
      className={`${styles.bg} ${styles.border} rounded-xl border overflow-hidden`}
    >
      <div
        className={`${styles.header} px-4 py-3 flex items-center justify-between ${
          collapsible ? 'cursor-pointer' : ''
        }`}
        onClick={collapsible ? () => setIsExpanded(!isExpanded) : undefined}
      >
        <div className="flex items-center space-x-3">
          <span className="text-lg">{styles.icon}</span>
          <h3 className={`font-semibold ${styles.titleColor}`}>{title}</h3>
        </div>

        <div className="flex items-center space-x-2">
          {action && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                action.onClick();
              }}
              className={`text-sm font-medium ${styles.titleColor} hover:underline`}
            >
              {action.label}
            </button>
          )}

          {collapsible && (
            <div className={styles.titleColor}>
              {isExpanded ? (
                <ChevronDown size={16} />
              ) : (
                <ChevronRight size={16} />
              )}
            </div>
          )}
        </div>
      </div>

      {(!collapsible || isExpanded) && (
        <div className="px-4 py-3">
          <div className="text-gray-700 dark:text-gray-300">{children}</div>
        </div>
      )}
    </div>
  );
}
