import React from 'react';
import { View, ActivityIndicator, Text } from 'react-native';

interface LoadingSpinnerProps {
  message?: string;
}

export function LoadingSpinner({ message = 'Loading...' }: LoadingSpinnerProps) {
  return (
    <View className="flex-1 items-center justify-center p-4">
      <ActivityIndicator size="large" color="#3B82F6" />
      <Text className="text-gray-600 mt-2">{message}</Text>
    </View>
  );
}
