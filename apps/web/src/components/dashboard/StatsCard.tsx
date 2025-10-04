'use client';

import { ReactNode } from 'react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  color?: 'blue' | 'green' | 'purple' | 'orange' | 'red' | 'cyan';
  onClick?: () => void;
}

export function StatsCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  color = 'blue',
  onClick,
}: StatsCardProps) {
  const colorClasses = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/10',
      border: 'border-blue-200 dark:border-blue-800',
      icon: 'text-blue-600 dark:text-blue-400',
      accent: 'text-blue-600 dark:text-blue-400',
    },
    green: {
      bg: 'bg-green-50 dark:bg-green-900/10',
      border: 'border-green-200 dark:border-green-800',
      icon: 'text-green-600 dark:text-green-400',
      accent: 'text-green-600 dark:text-green-400',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/10',
      border: 'border-purple-200 dark:border-purple-800',
      icon: 'text-purple-600 dark:text-purple-400',
      accent: 'text-purple-600 dark:text-purple-400',
    },
    orange: {
      bg: 'bg-orange-50 dark:bg-orange-900/10',
      border: 'border-orange-200 dark:border-orange-800',
      icon: 'text-orange-600 dark:text-orange-400',
      accent: 'text-orange-600 dark:text-orange-400',
    },
    red: {
      bg: 'bg-red-50 dark:bg-red-900/10',
      border: 'border-red-200 dark:border-red-800',
      icon: 'text-red-600 dark:text-red-400',
      accent: 'text-red-600 dark:text-red-400',
    },
    cyan: {
      bg: 'bg-cyan-50 dark:bg-cyan-900/10',
      border: 'border-cyan-200 dark:border-cyan-800',
      icon: 'text-cyan-600 dark:text-cyan-400',
      accent: 'text-cyan-600 dark:text-cyan-400',
    },
  };

  const classes = colorClasses[color];

  return (
    <div
      className={`
        ${classes.bg} ${classes.border} rounded-xl p-6 border transition-all duration-300
        ${onClick ? 'cursor-pointer hover:shadow-md hover:scale-105' : ''}
      `}
      onClick={onClick}
    >
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
          {title}
        </h3>
        {icon && <div className={classes.icon}>{icon}</div>}
      </div>

      <div className="space-y-1">
        <p className="text-3xl font-bold text-gray-900 dark:text-white">
          {value}
        </p>

        {subtitle && (
          <p className="text-sm text-gray-500 dark:text-gray-400">{subtitle}</p>
        )}

        {trend && (
          <div className="flex items-center text-sm">
            <span
              className={
                trend.isPositive !== false
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-red-600 dark:text-red-400'
              }
            >
              {trend.isPositive !== false ? '↗' : '↘'} {trend.value}%
            </span>
            <span className="ml-1 text-gray-500 dark:text-gray-400">
              {trend.label}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
