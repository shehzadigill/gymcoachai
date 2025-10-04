'use client';

import { ReactNode } from 'react';

interface GoalCardProps {
  title: string;
  current: number;
  target: number;
  unit?: string;
  icon?: ReactNode;
  color?: string;
  showProgress?: boolean;
  description?: string;
}

export function GoalCard({
  title,
  current,
  target,
  unit = '',
  icon,
  color = '#3B82F6',
  showProgress = true,
  description,
}: GoalCardProps) {
  const progress = target > 0 ? Math.min((current / target) * 100, 100) : 0;
  const isCompleted = current >= target;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-3">
          {icon && (
            <div
              className="p-2 rounded-lg"
              style={{ backgroundColor: `${color}20`, color }}
            >
              {icon}
            </div>
          )}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
            {description && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {description}
              </p>
            )}
          </div>
        </div>

        <div className="text-right">
          <div className="text-lg font-bold text-gray-900 dark:text-white">
            {current}
            <span className="text-sm text-gray-500 dark:text-gray-400">
              /{target} {unit}
            </span>
          </div>
          {isCompleted && (
            <div className="text-sm text-green-600 dark:text-green-400 font-medium">
              ✓ Completed
            </div>
          )}
        </div>
      </div>

      {showProgress && (
        <div className="space-y-2">
          <div className="flex justify-between text-sm text-gray-600 dark:text-gray-400">
            <span>Progress</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all duration-500"
              style={{
                width: `${progress}%`,
                backgroundColor: color,
                boxShadow: isCompleted ? `0 0 10px ${color}50` : 'none',
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
