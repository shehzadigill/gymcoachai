// Confidence Indicator Component
import React from 'react';
import {
  calculateConfidenceColor,
  getConfidenceLabel,
  getConfidenceIcon,
} from '../../../lib/ai-utils';

interface ConfidenceIndicatorProps {
  score: number;
  showLabel?: boolean;
  showIcon?: boolean;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConfidenceIndicator({
  score,
  showLabel = true,
  showIcon = true,
  size = 'md',
  className = '',
}: ConfidenceIndicatorProps) {
  const color = calculateConfidenceColor(score);
  const label = getConfidenceLabel(score);
  const icon = getConfidenceIcon(score);

  const sizeClasses = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  const iconSizes = {
    sm: 'text-xs',
    md: 'text-sm',
    lg: 'text-base',
  };

  return (
    <div className={`inline-flex items-center gap-1 ${className}`}>
      {showIcon && <span className={iconSizes[size]}>{icon}</span>}

      <span className={`font-medium ${color} ${sizeClasses[size]}`}>
        {(score * 100).toFixed(0)}%
      </span>

      {showLabel && (
        <span className={`text-gray-500 ${sizeClasses[size]}`}>({label})</span>
      )}
    </div>
  );
}

// Progress Bar variant
interface ConfidenceProgressBarProps {
  score: number;
  showPercentage?: boolean;
  height?: 'sm' | 'md' | 'lg';
  className?: string;
}

export function ConfidenceProgressBar({
  score,
  showPercentage = true,
  height = 'md',
  className = '',
}: ConfidenceProgressBarProps) {
  const color = calculateConfidenceColor(score);
  const percentage = score * 100;

  const heightClasses = {
    sm: 'h-1',
    md: 'h-2',
    lg: 'h-3',
  };

  const bgColor =
    score >= 0.8
      ? 'bg-green-500'
      : score >= 0.6
        ? 'bg-yellow-500'
        : score >= 0.4
          ? 'bg-orange-500'
          : 'bg-red-500';

  return (
    <div className={`w-full ${className}`}>
      <div
        className={`w-full ${heightClasses[height]} bg-gray-200 rounded-full overflow-hidden`}
      >
        <div
          className={`h-full ${bgColor} transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {showPercentage && (
        <div className="flex justify-between items-center mt-1">
          <span className="text-xs text-gray-500">Confidence</span>
          <span className={`text-xs font-medium ${color}`}>
            {percentage.toFixed(0)}%
          </span>
        </div>
      )}
    </div>
  );
}

// Circular Progress variant
interface ConfidenceCircularProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  showPercentage?: boolean;
  className?: string;
}

export function ConfidenceCircular({
  score,
  size = 40,
  strokeWidth = 4,
  showPercentage = true,
  className = '',
}: ConfidenceCircularProps) {
  const percentage = score * 100;
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const color =
    score >= 0.8
      ? '#10b981'
      : score >= 0.6
        ? '#f59e0b'
        : score >= 0.4
          ? '#f97316'
          : '#ef4444';

  return (
    <div className={`inline-flex flex-col items-center ${className}`}>
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {/* Background circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="#e5e7eb"
            strokeWidth={strokeWidth}
            fill="none"
          />
          {/* Progress circle */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            fill="none"
            strokeDasharray={strokeDasharray}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            className="transition-all duration-500 ease-out"
          />
        </svg>

        {showPercentage && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-xs font-medium text-gray-700">
              {percentage.toFixed(0)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

export default ConfidenceIndicator;
