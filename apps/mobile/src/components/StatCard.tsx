import React from 'react';
import { View, Text } from 'react-native';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  trend?: string;
  color?: 'blue' | 'green' | 'orange' | 'purple' | 'red';
}

export function StatCard({ title, value, icon, trend, color = 'blue' }: StatCardProps) {
  const colorClasses = {
    blue: 'bg-blue-100',
    green: 'bg-green-100',
    orange: 'bg-orange-100',
    purple: 'bg-purple-100',
    red: 'bg-red-100',
  };

  const textColorClasses = {
    blue: 'text-blue-600',
    green: 'text-green-600',
    orange: 'text-orange-600',
    purple: 'text-purple-600',
    red: 'text-red-600',
  };

  return (
    <View className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <View className="flex-row items-center justify-between mb-2">
        <View className={`p-2 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </View>
        {trend && (
          <Text className={`text-sm ${textColorClasses[color]}`}>
            {trend}
          </Text>
        )}
      </View>
      <View>
        <Text className="text-sm font-medium text-gray-600 mb-1">{title}</Text>
        <Text className="text-2xl font-semibold text-gray-900">{value}</Text>
      </View>
    </View>
  );
}
