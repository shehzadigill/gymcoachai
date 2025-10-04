'use client';

import { useMemo } from 'react';

interface BarData {
  label: string;
  value: number;
  color?: string;
}

interface BarChartProps {
  data: BarData[];
  height?: number;
  maxValue?: number;
  showValues?: boolean;
  animate?: boolean;
  horizontal?: boolean;
}

export function BarChart({
  data,
  height = 200,
  maxValue,
  showValues = true,
  animate = true,
  horizontal = false,
}: BarChartProps) {
  const { normalizedData, calculatedMaxValue } = useMemo(() => {
    const maxVal = maxValue || Math.max(...data.map((d) => d.value));
    const paddedMax = maxVal * 1.1; // Add 10% padding

    return {
      normalizedData: data.map((item) => ({
        ...item,
        normalizedValue: (item.value / paddedMax) * 100,
      })),
      calculatedMaxValue: paddedMax,
    };
  }, [data, maxValue]);

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg"
        style={{ height }}
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No data available
        </p>
      </div>
    );
  }

  const defaultColors = [
    '#3B82F6',
    '#10B981',
    '#F59E0B',
    '#EF4444',
    '#8B5CF6',
    '#06B6D4',
    '#84CC16',
    '#F97316',
    '#EC4899',
    '#6366F1',
  ];

  return (
    <div className="space-y-3">
      {horizontal ? (
        // Horizontal bars
        <div className="space-y-3">
          {normalizedData.map((item, index) => (
            <div key={index} className="flex items-center gap-3">
              <div className="w-20 text-right text-sm text-gray-600 dark:text-gray-400 truncate">
                {item.label}
              </div>
              <div className="flex-1 relative">
                <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${animate ? 'animate-pulse' : ''}`}
                    style={{
                      width: `${item.normalizedValue}%`,
                      backgroundColor:
                        item.color ||
                        defaultColors[index % defaultColors.length],
                      backgroundImage:
                        'linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 50%, rgba(255,255,255,0.1) 50%, rgba(255,255,255,0.1) 75%, transparent 75%)',
                      backgroundSize: '20px 20px',
                    }}
                  />
                </div>
                {showValues && (
                  <div className="absolute right-2 top-1/2 transform -translate-y-1/2 text-xs font-medium text-white">
                    {item.value}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      ) : (
        // Vertical bars
        <div>
          <div
            className="flex items-end justify-between gap-2 pb-4"
            style={{ height: height - 40 }}
          >
            {normalizedData.map((item, index) => (
              <div
                key={index}
                className="flex flex-col items-center flex-1 group"
              >
                <div className="relative w-full max-w-16">
                  {showValues && (
                    <div className="absolute -top-6 left-1/2 transform -translate-x-1/2 text-xs font-medium text-gray-600 dark:text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity">
                      {item.value}
                    </div>
                  )}
                  <div
                    className={`w-full rounded-t-lg transition-all duration-1000 hover:opacity-80 cursor-pointer ${animate ? 'animate-pulse' : ''}`}
                    style={{
                      height: `${item.normalizedValue}%`,
                      minHeight: '4px',
                      backgroundColor:
                        item.color ||
                        defaultColors[index % defaultColors.length],
                      backgroundImage:
                        'linear-gradient(180deg, rgba(255,255,255,0.2) 0%, transparent 100%)',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>

          {/* Labels */}
          <div className="flex justify-between gap-2">
            {normalizedData.map((item, index) => (
              <div key={index} className="flex-1 text-center">
                <span className="text-xs text-gray-600 dark:text-gray-400 break-words">
                  {item.label}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
