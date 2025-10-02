'use client';

import { useEffect, useState } from 'react';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { TrendData } from '../../types/analytics';

interface MetricCardProps {
  title: string;
  value: string | number;
  unit?: string;
  trend?: TrendData;
  icon: React.ReactNode;
  color: string;
  description?: string;
}

export function MetricCard({
  title,
  value,
  unit,
  trend,
  icon,
  color,
  description,
}: MetricCardProps) {
  const getTrendIcon = () => {
    if (!trend) return null;

    switch (trend.trend) {
      case 'up':
        return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-4 w-4 text-red-500" />;
      default:
        return <Minus className="h-4 w-4 text-gray-400" />;
    }
  };

  const getTrendColor = () => {
    if (!trend) return 'text-gray-400';
    switch (trend.trend) {
      case 'up':
        return 'text-green-500';
      case 'down':
        return 'text-red-500';
      default:
        return 'text-gray-400';
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className={`p-2 rounded-lg ${color}`}>{icon}</div>
          <div>
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p className="text-2xl font-bold text-gray-900">
              {value}
              {unit && (
                <span className="text-lg font-normal text-gray-500">
                  {unit}
                </span>
              )}
            </p>
          </div>
        </div>
        {trend && (
          <div className="flex items-center space-x-1">
            {getTrendIcon()}
            <span className={`text-sm font-medium ${getTrendColor()}`}>
              {trend.percentage > 0 ? '+' : ''}
              {trend.percentage.toFixed(1)}%
            </span>
          </div>
        )}
      </div>
      {description && (
        <p className="mt-2 text-sm text-gray-500">{description}</p>
      )}
      {trend && (
        <p className="mt-1 text-xs text-gray-400">
          vs previous period: {trend.change > 0 ? '+' : ''}
          {trend.change}
        </p>
      )}
    </div>
  );
}
