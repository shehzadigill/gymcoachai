// Trend Chart Component
import React from 'react';
import { getTrendIcon, getTrendColor } from '../../../lib/ai-utils';

interface TrendDataPoint {
  date: string;
  value: number;
  label?: string;
}

interface TrendChartProps {
  data: TrendDataPoint[];
  title?: string;
  yAxisLabel?: string;
  showTrend?: boolean;
  showDots?: boolean;
  height?: number;
  className?: string;
}

export function TrendChart({
  data,
  title,
  yAxisLabel,
  showTrend = true,
  showDots = true,
  height = 200,
  className = '',
}: TrendChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-${height} bg-gray-50 rounded-lg ${className}`}
      >
        <span className="text-gray-500">No data available</span>
      </div>
    );
  }

  // Calculate chart dimensions and scaling
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const valueRange = maxValue - minValue || 1;
  const padding = 20;
  const chartHeight = height - padding * 2;
  const chartWidth = 300; // Fixed width for simplicity

  // Calculate trend
  const trend = calculateTrend(data);
  const trendIcon = getTrendIcon(trend.direction);
  const trendColor = getTrendColor(trend.direction);

  // Generate SVG path
  const points = data
    .map((point, index) => {
      const x = (index / (data.length - 1)) * chartWidth;
      const y =
        chartHeight - ((point.value - minValue) / valueRange) * chartHeight;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      {title && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-gray-900">{title}</h3>
          {showTrend && (
            <div className={`flex items-center gap-1 text-sm ${trendColor}`}>
              <span>{trendIcon}</span>
              <span>{trend.percentage.toFixed(1)}%</span>
            </div>
          )}
        </div>
      )}

      <div className="relative">
        <svg width={chartWidth} height={height} className="overflow-visible">
          {/* Grid lines */}
          <defs>
            <pattern
              id="grid"
              width="40"
              height="40"
              patternUnits="userSpaceOnUse"
            >
              <path
                d="M 40 0 L 0 0 0 40"
                fill="none"
                stroke="#f3f4f6"
                strokeWidth="1"
              />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />

          {/* Trend line */}
          <polyline
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            points={points}
          />

          {/* Data points */}
          {showDots &&
            data.map((point, index) => {
              const x = (index / (data.length - 1)) * chartWidth;
              const y =
                chartHeight -
                ((point.value - minValue) / valueRange) * chartHeight;
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="3"
                  fill="#3b82f6"
                  className="hover:r-4 transition-all duration-200"
                >
                  <title>
                    {point.label || `${point.date}: ${point.value}`}
                  </title>
                </circle>
              );
            })}
        </svg>

        {/* Y-axis labels */}
        <div className="absolute left-0 top-0 h-full flex flex-col justify-between text-xs text-gray-500">
          <span>{maxValue.toFixed(1)}</span>
          <span>{((maxValue + minValue) / 2).toFixed(1)}</span>
          <span>{minValue.toFixed(1)}</span>
        </div>

        {/* X-axis labels */}
        <div className="absolute bottom-0 left-0 w-full flex justify-between text-xs text-gray-500">
          <span>{data[0]?.date}</span>
          <span>{data[Math.floor(data.length / 2)]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </div>

      {yAxisLabel && (
        <div className="text-xs text-gray-500 mt-2 text-center">
          {yAxisLabel}
        </div>
      )}
    </div>
  );
}

// Simple trend calculation
function calculateTrend(data: TrendDataPoint[]): {
  direction: 'up' | 'down' | 'stable';
  percentage: number;
} {
  if (data.length < 2) {
    return { direction: 'stable', percentage: 0 };
  }

  const firstValue = data[0].value;
  const lastValue = data[data.length - 1].value;
  const percentage = ((lastValue - firstValue) / firstValue) * 100;

  if (Math.abs(percentage) < 5) {
    return { direction: 'stable', percentage };
  }

  return {
    direction: percentage > 0 ? 'up' : 'down',
    percentage: Math.abs(percentage),
  };
}

// Mini trend indicator for inline use
interface MiniTrendProps {
  data: TrendDataPoint[];
  className?: string;
}

export function MiniTrend({ data, className = '' }: MiniTrendProps) {
  if (!data || data.length < 2) {
    return <span className={`text-gray-400 ${className}`}>—</span>;
  }

  const trend = calculateTrend(data);
  const trendIcon = getTrendIcon(trend.direction);
  const trendColor = getTrendColor(trend.direction);

  return (
    <span
      className={`inline-flex items-center gap-1 text-sm ${trendColor} ${className}`}
    >
      <span>{trendIcon}</span>
      <span>{trend.percentage.toFixed(1)}%</span>
    </span>
  );
}

// Bar chart variant
interface BarChartProps {
  data: TrendDataPoint[];
  title?: string;
  maxBars?: number;
  height?: number;
  className?: string;
}

export function BarChart({
  data,
  title,
  maxBars = 7,
  height = 150,
  className = '',
}: BarChartProps) {
  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center h-${height} bg-gray-50 rounded-lg ${className}`}
      >
        <span className="text-gray-500">No data available</span>
      </div>
    );
  }

  const displayData = data.slice(-maxBars);
  const maxValue = Math.max(...displayData.map((d) => d.value));
  const barWidth = 280 / displayData.length;

  return (
    <div
      className={`bg-white rounded-lg border border-gray-200 p-4 ${className}`}
    >
      {title && (
        <h3 className="text-sm font-medium text-gray-900 mb-4">{title}</h3>
      )}

      <div className="flex items-end justify-between h-32 gap-1">
        {displayData.map((point, index) => {
          const barHeight = (point.value / maxValue) * 100;
          return (
            <div key={index} className="flex flex-col items-center">
              <div
                className="bg-blue-500 rounded-t transition-all duration-300 hover:bg-blue-600"
                style={{
                  width: `${barWidth}px`,
                  height: `${barHeight}%`,
                  minHeight: '4px',
                }}
                title={`${point.label || point.date}: ${point.value}`}
              />
              <div className="text-xs text-gray-500 mt-1 transform -rotate-45 origin-left">
                {point.date.split('-')[2] || point.date}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TrendChart;
