import React from 'react';
import {Text, View} from 'react-native';

interface TabBarIconProps {
  name: string;
  focused: boolean;
  color: string;
  size: number;
}

const iconMap: Record<string, string> = {
  home: '🏠',
  fitness: '💪',
  'smart-toy': '🤖',
  nutrition: '🍎',
  analytics: '📊',
  profile: '👤',
  unknown: '❓',
};

export default function TabBarIcon({
  name,
  focused,
  color,
  size,
}: TabBarIconProps) {
  const icon = iconMap[name] || iconMap.unknown;

  return (
    <View style={{alignItems: 'center', justifyContent: 'center'}}>
      <Text
        style={{
          fontSize: size,
          opacity: focused ? 1 : 0.7,
        }}>
        {icon}
      </Text>
    </View>
  );
}
