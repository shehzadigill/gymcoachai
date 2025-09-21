import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';

interface ErrorMessageProps {
  message: string;
  onRetry?: () => void;
}

export function ErrorMessage({ message, onRetry }: ErrorMessageProps) {
  return (
    <View className="bg-red-50 border border-red-200 rounded-lg p-4 m-4">
      <View className="flex-row items-center">
        <View className="text-red-600 mr-3">
          <Text className="text-red-600">⚠️</Text>
        </View>
        <View className="flex-1">
          <Text className="text-sm font-medium text-red-800">
            Error
          </Text>
          <Text className="text-sm text-red-700 mt-1">{message}</Text>
        </View>
        {onRetry && (
          <TouchableOpacity
            onPress={onRetry}
            className="bg-red-600 px-3 py-1 rounded"
          >
            <Text className="text-white text-sm font-medium">Retry</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}
