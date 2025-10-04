'use client';

import { ReactNode } from 'react';

interface QuickActionProps {
  icon: ReactNode;
  title: string;
  description?: string;
  onClick: () => void;
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red';
  disabled?: boolean;
  loading?: boolean;
}

interface QuickActionsProps {
  actions: QuickActionProps[];
  columns?: 1 | 2 | 3 | 4;
}

export function QuickActions({ actions, columns = 2 }: QuickActionsProps) {
  const gridCols = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-4',
  };

  return (
    <div className={`grid gap-4 ${gridCols[columns]}`}>
      {actions.map((action, index) => (
        <QuickActionCard key={index} {...action} />
      ))}
    </div>
  );
}

function QuickActionCard({
  icon,
  title,
  description,
  onClick,
  color = 'blue',
  disabled = false,
  loading = false,
}: QuickActionProps) {
  const colorClasses = {
    blue: 'bg-blue-600 hover:bg-blue-700 focus:ring-blue-500',
    green: 'bg-green-600 hover:bg-green-700 focus:ring-green-500',
    purple: 'bg-purple-600 hover:bg-purple-700 focus:ring-purple-500',
    orange: 'bg-orange-600 hover:bg-orange-700 focus:ring-orange-500',
    red: 'bg-red-600 hover:bg-red-700 focus:ring-red-500',
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled || loading}
      className={`
        relative p-6 text-left rounded-xl border-2 border-transparent
        transition-all duration-300 group
        ${
          disabled || loading
            ? 'opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-800'
            : `${colorClasses[color]} text-white hover:scale-105 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-offset-2`
        }
      `}
    >
      <div className="flex items-start space-x-4">
        <div
          className={`
          flex-shrink-0 p-3 rounded-lg
          ${
            disabled || loading
              ? 'bg-gray-200 dark:bg-gray-700 text-gray-400'
              : 'bg-white/20 text-white'
          }
        `}
        >
          {loading ? (
            <div className="w-6 h-6 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            icon
          )}
        </div>

        <div className="flex-1 min-w-0">
          <h3
            className={`
            text-lg font-semibold
            ${
              disabled || loading
                ? 'text-gray-600 dark:text-gray-400'
                : 'text-white'
            }
          `}
          >
            {title}
          </h3>
          {description && (
            <p
              className={`
              text-sm mt-1
              ${
                disabled || loading
                  ? 'text-gray-500 dark:text-gray-500'
                  : 'text-white/80'
              }
            `}
            >
              {description}
            </p>
          )}
        </div>
      </div>

      {!disabled && !loading && (
        <div className="absolute inset-0 rounded-xl bg-gradient-to-r from-white/0 via-white/5 to-white/0 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      )}
    </button>
  );
}
