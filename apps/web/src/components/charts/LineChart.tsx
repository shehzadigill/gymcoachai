'use client';

import { useMemo } from 'react';

interface DataPoint {
  label: string;
  value: number;
  timestamp?: string;
}

interface LineChartProps {
  data: DataPoint[];
  height?: number;
  color?: string;
  showDots?: boolean;
  showGrid?: boolean;
  animate?: boolean;
}

export function LineChart({
  data,
  height = 200,
  color = '#3B82F6',
  showDots = true,
  showGrid = true,
  animate = true,
}: LineChartProps) {
  const { pathData, viewBox, maxValue, minValue } = useMemo(() => {
    if (!data.length)
      return { pathData: '', viewBox: '0 0 400 200', maxValue: 0, minValue: 0 };

    const maxVal = Math.max(...data.map((d) => d.value));
    const minVal = Math.min(...data.map((d) => d.value));
    const padding = (maxVal - minVal) * 0.1 || 10;

    const adjustedMax = maxVal + padding;
    const adjustedMin = Math.max(0, minVal - padding);

    const width = 400;
    const stepX = width / (data.length - 1);

    const points = data.map((point, index) => {
      const x = index * stepX;
      const y =
        height -
        ((point.value - adjustedMin) / (adjustedMax - adjustedMin)) * height;
      return { x, y, value: point.value };
    });

    const path = points
      .reduce((acc, point, index) => {
        const command = index === 0 ? 'M' : 'L';
        return `${acc} ${command} ${point.x} ${point.y}`;
      }, '')
      .trim();

    return {
      pathData: path,
      viewBox: `0 0 ${width} ${height}`,
      maxValue: adjustedMax,
      minValue: adjustedMin,
      points,
    };
  }, [data, height]);

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

  return (
    <div className="relative">
      <svg
        width="100%"
        height={height}
        viewBox={viewBox}
        className="overflow-visible"
      >
        {/* Grid lines */}
        {showGrid && (
          <g className="opacity-20">
            {[...Array(5)].map((_, i) => (
              <line
                key={`grid-${i}`}
                x1="0"
                y1={(height / 4) * i}
                x2="400"
                y2={(height / 4) * i}
                stroke="currentColor"
                strokeWidth="1"
              />
            ))}
          </g>
        )}

        {/* Gradient definition */}
        <defs>
          <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0.05" />
          </linearGradient>
        </defs>

        {/* Area under the line */}
        <path
          d={`${pathData} L 400 ${height} L 0 ${height} Z`}
          fill="url(#chartGradient)"
          className={animate ? 'animate-pulse' : ''}
        />

        {/* Main line */}
        <path
          d={pathData}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`transition-all duration-1000 ${animate ? 'animate-pulse' : ''}`}
          style={{
            filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
          }}
        />

        {/* Data points */}
        {showDots && (
          <g>
            {data.map((point, index) => {
              const x = (index * 400) / (data.length - 1);
              const y =
                height -
                ((point.value - minValue) / (maxValue - minValue)) * height;
              return (
                <g key={index}>
                  <circle
                    cx={x}
                    cy={y}
                    r="5"
                    fill="white"
                    stroke={color}
                    strokeWidth="3"
                    className="transition-all duration-300 hover:r-6 cursor-pointer"
                  />
                  <circle
                    cx={x}
                    cy={y}
                    r="3"
                    fill={color}
                    className="pointer-events-none"
                  />
                </g>
              );
            })}
          </g>
        )}
      </svg>

      {/* Labels */}
      <div className="flex justify-between mt-2 text-xs text-gray-600 dark:text-gray-400">
        {data.map((point, index) => (
          <span
            key={index}
            className="text-center"
            style={{ minWidth: '60px' }}
          >
            {point.label}
          </span>
        ))}
      </div>
    </div>
  );
}
