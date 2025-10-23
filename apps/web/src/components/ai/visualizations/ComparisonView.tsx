// Comparison View Component
import React from 'react';
import { ConfidenceIndicator } from './ConfidenceIndicator';

interface ComparisonItem {
  label: string;
  value: any;
  unit?: string;
  change?: number;
  changeType?: 'increase' | 'decrease' | 'neutral';
}

interface ComparisonViewProps {
  title?: string;
  current: ComparisonItem;
  recommended: ComparisonItem;
  showConfidence?: boolean;
  confidence?: number;
  showChange?: boolean;
  className?: string;
}

export function ComparisonView({
  title,
  current,
  recommended,
  showConfidence = false,
  confidence,
  showChange = true,
  className = '',
}: ComparisonViewProps) {
  const hasChange =
    current.change !== undefined && recommended.change !== undefined;
  const changeDirection =
    current.change! > recommended.change!
      ? 'increase'
      : current.change! < recommended.change!
        ? 'decrease'
        : 'neutral';

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {showConfidence && confidence !== undefined && (
            <ConfidenceIndicator score={confidence} size="sm" />
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Current */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Current
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {formatValue(current.value)} {current.unit}
          </div>
          {showChange && hasChange && (
            <div className={`text-sm ${getChangeColor(current.changeType!)}`}>
              {getChangeIcon(current.changeType!)}{' '}
              {Math.abs(current.change!).toFixed(1)}%
            </div>
          )}
        </div>

        {/* Recommended */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Recommended
          </div>
          <div className="text-lg font-semibold text-blue-600">
            {formatValue(recommended.value)} {recommended.unit}
          </div>
          {showChange && hasChange && (
            <div
              className={`text-sm ${getChangeColor(recommended.changeType!)}`}
            >
              {getChangeIcon(recommended.changeType!)}{' '}
              {Math.abs(recommended.change!).toFixed(1)}%
            </div>
          )}
        </div>
      </div>

      {/* Difference */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Difference:</span>
          <span
            className={`text-sm font-medium ${getDifferenceColor(current.value, recommended.value)}`}
          >
            {calculateDifference(current.value, recommended.value)}{' '}
            {current.unit}
          </span>
        </div>
      </div>
    </div>
  );
}

// Side-by-side comparison for multiple items
interface SideBySideComparisonProps {
  title?: string;
  items: Array<{
    label: string;
    current: any;
    recommended: any;
    unit?: string;
    confidence?: number;
  }>;
  className?: string;
}

export function SideBySideComparison({
  title,
  items,
  className = '',
}: SideBySideComparisonProps) {
  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}

      <div className="space-y-4">
        {items.map((item, index) => (
          <div key={index} className="grid grid-cols-3 gap-4 items-center">
            <div className="text-sm font-medium text-gray-700">
              {item.label}
            </div>

            <div className="text-sm text-gray-600">
              {formatValue(item.current)} {item.unit}
            </div>

            <div className="flex items-center justify-between">
              <div className="text-sm font-medium text-blue-600">
                {formatValue(item.recommended)} {item.unit}
              </div>
              {item.confidence !== undefined && (
                <ConfidenceIndicator
                  score={item.confidence}
                  size="sm"
                  showLabel={false}
                />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// Before/After comparison
interface BeforeAfterComparisonProps {
  title?: string;
  before: ComparisonItem;
  after: ComparisonItem;
  showImprovement?: boolean;
  className?: string;
}

export function BeforeAfterComparison({
  title,
  before,
  after,
  showImprovement = true,
  className = '',
}: BeforeAfterComparisonProps) {
  const improvement = calculateImprovement(before.value, after.value);

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* Before */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Before
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {formatValue(before.value)} {before.unit}
          </div>
        </div>

        {/* After */}
        <div className="space-y-2">
          <div className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            After
          </div>
          <div className="text-lg font-semibold text-green-600">
            {formatValue(after.value)} {after.unit}
          </div>
        </div>
      </div>

      {showImprovement && (
        <div className="mt-4 pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Improvement:</span>
            <span
              className={`text-sm font-medium ${improvement >= 0 ? 'text-green-600' : 'text-red-600'}`}
            >
              {improvement >= 0 ? '↗' : '↘'}{' '}
              {Math.abs(improvement).toFixed(1)}%
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// Utility functions
function formatValue(value: any): string {
  if (typeof value === 'number') {
    return value.toFixed(1);
  }
  return String(value);
}

function getChangeColor(
  changeType: 'increase' | 'decrease' | 'neutral'
): string {
  switch (changeType) {
    case 'increase':
      return 'text-green-600';
    case 'decrease':
      return 'text-red-600';
    default:
      return 'text-gray-600';
  }
}

function getChangeIcon(
  changeType: 'increase' | 'decrease' | 'neutral'
): string {
  switch (changeType) {
    case 'increase':
      return '↗';
    case 'decrease':
      return '↘';
    default:
      return '→';
  }
}

function getDifferenceColor(current: any, recommended: any): string {
  const currentNum =
    typeof current === 'number' ? current : parseFloat(current);
  const recommendedNum =
    typeof recommended === 'number' ? recommended : parseFloat(recommended);

  if (recommendedNum > currentNum) {
    return 'text-green-600';
  } else if (recommendedNum < currentNum) {
    return 'text-red-600';
  }
  return 'text-gray-600';
}

function calculateDifference(current: any, recommended: any): string {
  const currentNum =
    typeof current === 'number' ? current : parseFloat(current);
  const recommendedNum =
    typeof recommended === 'number' ? recommended : parseFloat(recommended);

  const diff = recommendedNum - currentNum;
  return diff >= 0 ? `+${diff.toFixed(1)}` : diff.toFixed(1);
}

function calculateImprovement(before: any, after: any): number {
  const beforeNum = typeof before === 'number' ? before : parseFloat(before);
  const afterNum = typeof after === 'number' ? after : parseFloat(after);

  if (beforeNum === 0) return 0;
  return ((afterNum - beforeNum) / beforeNum) * 100;
}

export default ComparisonView;
