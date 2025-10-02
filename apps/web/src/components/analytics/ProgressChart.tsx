'use client';

import { ChartDataPoint } from '../../types/analytics';

interface ProgressChartProps {
  data: ChartDataPoint[];
  title: string;
  type: 'line' | 'bar' | 'simple';
  color?: string;
  height?: number;
}

export function ProgressChart({
  data,
  title,
  type,
  color = '#3B82F6',
  height = 300,
}: ProgressChartProps) {
  const maxValue = Math.max(...data.map((d) => d.value));
  const minValue = Math.min(...data.map((d) => d.value));
  const range = maxValue - minValue || 1;

  const renderSimpleLineChart = () => {
    if (data.length < 2)
      return (
        <div className="flex items-center justify-center h-48 text-gray-400">
          Insufficient data
        </div>
      );

    const points = data
      .map((item, index) => {
        const x = (index / (data.length - 1)) * 100;
        const y = 100 - ((item.value - minValue) / range) * 100;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <div className="relative h-48">
        <svg
          className="w-full h-full"
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="gradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.05" />
            </linearGradient>
          </defs>
          <polyline
            fill="none"
            stroke={color}
            strokeWidth="2"
            points={points}
            vectorEffect="non-scaling-stroke"
          />
          <polyline
            fill="url(#gradient)"
            stroke="none"
            points={`${points} 100,100 0,100`}
          />
        </svg>
        <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-gray-500 mt-2">
          {data.map((item, index) => (
            <span key={index} className="text-center">
              {new Date(item.date).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
              })}
            </span>
          ))}
        </div>
      </div>
    );
  };

  const renderBarChart = () => {
    return (
      <div className="space-y-3">
        {data.map((item, index) => {
          const percentage = ((item.value - minValue) / range) * 100;
          return (
            <div key={index} className="flex items-center space-x-3">
              <div className="w-20 text-sm text-gray-600 truncate">
                {item.label ||
                  new Date(item.date).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                  })}
              </div>
              <div className="flex-1 bg-gray-200 rounded-full h-6 relative">
                <div
                  className="h-6 rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.max(percentage, 5)}%`,
                    backgroundColor: color,
                  }}
                />
                <span className="absolute right-2 top-0 h-6 flex items-center text-xs font-medium text-gray-700">
                  {item.value}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderChart = () => {
    switch (type) {
      case 'line':
        return renderSimpleLineChart();
      case 'bar':
        return renderBarChart();
      case 'simple':
        return (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {data.map((item, index) => (
              <div
                key={index}
                className="text-center p-3 bg-gray-50 rounded-lg"
              >
                <div className="text-2xl font-bold" style={{ color }}>
                  {item.value}
                </div>
                <div className="text-sm text-gray-600">
                  {item.label ||
                    new Date(item.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                    })}
                </div>
              </div>
            ))}
          </div>
        );
      default:
        return renderSimpleLineChart();
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {data.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-400">
          No data available
        </div>
      ) : (
        renderChart()
      )}
    </div>
  );
}
