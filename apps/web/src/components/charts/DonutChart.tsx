'use client';

import { useMemo } from 'react';

interface PieData {
  label: string;
  value: number;
  color?: string;
}

interface DonutChartProps {
  data: PieData[];
  size?: number;
  innerRadius?: number;
  showLabels?: boolean;
  showValues?: boolean;
  animate?: boolean;
}

export function DonutChart({
  data,
  size = 200,
  innerRadius = 0.5,
  showLabels = true,
  showValues = true,
  animate = true,
}: DonutChartProps) {
  const { segments, total } = useMemo(() => {
    const totalValue = data.reduce((sum, item) => sum + item.value, 0);
    let cumulativeAngle = 0;

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

    const calculatedSegments = data.map((item, index) => {
      const percentage = (item.value / totalValue) * 100;
      const angle = (item.value / totalValue) * 360;
      const startAngle = cumulativeAngle;
      const endAngle = cumulativeAngle + angle;

      cumulativeAngle += angle;

      // Calculate path for SVG arc
      const radius = size / 2;
      const innerR = radius * innerRadius;
      const outerR = radius * 0.8; // Leave some padding

      const startAngleRad = (startAngle - 90) * (Math.PI / 180);
      const endAngleRad = (endAngle - 90) * (Math.PI / 180);

      const x1 = radius + outerR * Math.cos(startAngleRad);
      const y1 = radius + outerR * Math.sin(startAngleRad);
      const x2 = radius + outerR * Math.cos(endAngleRad);
      const y2 = radius + outerR * Math.sin(endAngleRad);

      const x3 = radius + innerR * Math.cos(endAngleRad);
      const y3 = radius + innerR * Math.sin(endAngleRad);
      const x4 = radius + innerR * Math.cos(startAngleRad);
      const y4 = radius + innerR * Math.sin(startAngleRad);

      const largeArcFlag = angle > 180 ? 1 : 0;

      const pathData = [
        `M ${x1} ${y1}`,
        `A ${outerR} ${outerR} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        `L ${x3} ${y3}`,
        `A ${innerR} ${innerR} 0 ${largeArcFlag} 0 ${x4} ${y4}`,
        'Z',
      ].join(' ');

      // Calculate label position
      const labelAngle = (startAngle + endAngle) / 2;
      const labelAngleRad = (labelAngle - 90) * (Math.PI / 180);
      const labelRadius = radius * 0.9;
      const labelX = radius + labelRadius * Math.cos(labelAngleRad);
      const labelY = radius + labelRadius * Math.sin(labelAngleRad);

      return {
        ...item,
        pathData,
        percentage,
        color: item.color || defaultColors[index % defaultColors.length],
        labelX,
        labelY,
        angle: labelAngle,
      };
    });

    return {
      segments: calculatedSegments,
      total: totalValue,
    };
  }, [data, size, innerRadius]);

  if (!data.length) {
    return (
      <div
        className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg"
        style={{ width: size, height: size }}
      >
        <p className="text-gray-500 dark:text-gray-400 text-sm">
          No data available
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center space-y-4">
      <div className="relative">
        <svg width={size} height={size} className="transform -rotate-90">
          {segments.map((segment, index) => (
            <g key={index}>
              <path
                d={segment.pathData}
                fill={segment.color}
                stroke="white"
                strokeWidth="2"
                className={`transition-all duration-500 hover:opacity-80 cursor-pointer ${animate ? 'animate-pulse' : ''}`}
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))',
                  transformOrigin: 'center',
                }}
              />
            </g>
          ))}
        </svg>

        {/* Center content */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">
            {total}
          </div>
          <div className="text-sm text-gray-500 dark:text-gray-400">Total</div>
        </div>
      </div>

      {/* Legend */}
      {showLabels && (
        <div className="grid grid-cols-2 gap-3 max-w-xs">
          {segments.map((segment, index) => (
            <div key={index} className="flex items-center space-x-2">
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: segment.color }}
              />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900 dark:text-white truncate">
                  {segment.label}
                </div>
                {showValues && (
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    {segment.value} ({segment.percentage.toFixed(1)}%)
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
