'use client';

import { LucideIcon } from 'lucide-react';
import { ReactNode } from 'react';

interface MetricCardProps {
  title: string;
  value: string | number;
  change?: {
    value: number;
    period: string;
    positive?: boolean;
  };
  icon?: LucideIcon;
  iconColor?: string;
  description?: string;
  onClick?: () => void;
  children?: ReactNode;
  loading?: boolean;
}

export function MetricCard({
  title,
  value,
  change,
  icon: Icon,
  iconColor = 'text-blue-600',
  description,
  onClick,
  children,
  loading = false,
}: MetricCardProps) {
  const isClickable = !!onClick;

  return (
    <div
      className={`
        bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6
        ${isClickable ? 'cursor-pointer hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-300' : ''}
        ${loading ? 'animate-pulse' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center space-x-2">
            {Icon && (
              <div
                className={`p-2 rounded-lg bg-gray-50 dark:bg-gray-700 ${iconColor}`}
              >
                <Icon size={20} />
              </div>
            )}
            <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
              {title}
            </h3>
          </div>

          <div className="mt-3">
            {loading ? (
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            ) : (
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {value}
              </p>
            )}
          </div>

          {change && !loading && (
            <div
              className={`
                mt-2 flex items-center text-sm
                ${change.positive !== false ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}
              `}
            >
              <span className="font-medium">
                {change.positive !== false ? '+' : ''}
                {change.value}%
              </span>
              <span className="ml-1 text-gray-500 dark:text-gray-400">
                {change.period}
              </span>
            </div>
          )}

          {description && !loading && (
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">
              {description}
            </p>
          )}

          {children && !loading && <div className="mt-4">{children}</div>}
        </div>
      </div>
    </div>
  );
}
