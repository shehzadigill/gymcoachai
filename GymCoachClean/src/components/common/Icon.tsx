import React from 'react';
import {Text} from 'react-native';

// Simple Icon component using text symbols and Unicode characters
export const Icon: React.FC<{
  name: string;
  size: number;
  color: string;
  style?: any;
}> = ({name, size, color, style}) => {
  const getIconSymbol = (iconName: string) => {
    const icons: {[key: string]: string} = {
      // AI Trainer icons
      'smart-toy': '🤖',
      chat: '💬',
      refresh: '🔄',
      close: '✕',
      edit: '✏️',
      delete: '🗑️',
      check: '✓',
      send: '➤',
      'flash-on': '⚡',

      // Workout screen icons
      'fitness-center': '🏋️',
      'play-arrow': '▶️',
      schedule: '📅',
      list: '📋',
      timer: '⏱️',
      error: '❌',
      analytics: '📊',
      add: '➕',
      search: '🔍',
      'more-vert': '⋮',
      edit: '✏️',
      delete: '🗑️',
      favorite: '❤️',
      'favorite-border': '🤍',
      star: '⭐',
      'star-border': '☆',
      visibility: '👁️',
      'visibility-off': '👁️‍🗨️',
      settings: '⚙️',
      home: '🏠',
      person: '👤',
      notifications: '🔔',
      menu: '☰',
      'arrow-back': '←',
      'arrow-forward': '→',
      'check-circle': '✅',
      cancel: '❌',
      warning: '⚠️',
      info: 'ℹ️',
      help: '❓',

      // Tab icons
      sessions: '🏆',
      plans: '📋',
      templates: '📄',
      exercises: '💪',
      nutrition: '🥗',
      profile: '👤',
      dashboard: '📊',
    };
    return icons[iconName] || '?';
  };

  return (
    <Text style={[{fontSize: size, color, textAlign: 'center'}, style]}>
      {getIconSymbol(name)}
    </Text>
  );
};

export default Icon;
