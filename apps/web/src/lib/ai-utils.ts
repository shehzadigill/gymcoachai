// AI utility functions and helpers
import React from 'react';
import type {
  RAGSource,
  MemoryType,
  CoachingStyle,
  CommunicationStyle,
  MotivationType,
  Adaptation,
  Recommendation,
  ProactiveInsight,
  PerformancePrediction,
  ProgressMonitoringAlert,
} from '../types/ai-service';

// RAG Sources formatting
export interface FormattedSource {
  icon: string;
  label: string;
  color: string;
  description: string;
}

export function formatRAGSources(sources: RAGSource[]): FormattedSource[] {
  return sources.map((source) => {
    const typeConfig = getRAGSourceTypeConfig(source.metadata.type);
    return {
      icon: typeConfig.icon,
      label: typeConfig.label,
      color: typeConfig.color,
      description: `${typeConfig.label} from ${source.metadata.source}`,
    };
  });
}

function getRAGSourceTypeConfig(type: string) {
  const configs = {
    exercise: {
      icon: '💪',
      label: 'Exercise Library',
      color: 'bg-blue-100 text-blue-800',
    },
    nutrition: {
      icon: '🥗',
      label: 'Nutrition Database',
      color: 'bg-green-100 text-green-800',
    },
    research: {
      icon: '📚',
      label: 'Research',
      color: 'bg-purple-100 text-purple-800',
    },
    workout: {
      icon: '🏋️',
      label: 'Workout Plans',
      color: 'bg-orange-100 text-orange-800',
    },
    general: {
      icon: 'ℹ️',
      label: 'General Knowledge',
      color: 'bg-gray-100 text-gray-800',
    },
  };
  return configs[type as keyof typeof configs] || configs.general;
}

// Confidence color calculation
export function calculateConfidenceColor(score: number): string {
  if (score >= 0.8) return 'text-green-600';
  if (score >= 0.6) return 'text-yellow-600';
  if (score >= 0.4) return 'text-orange-600';
  return 'text-red-600';
}

export function getConfidenceLabel(score: number): string {
  if (score >= 0.9) return 'Very High';
  if (score >= 0.8) return 'High';
  if (score >= 0.6) return 'Medium';
  if (score >= 0.4) return 'Low';
  return 'Very Low';
}

export function getConfidenceIcon(score: number): string {
  if (score >= 0.8) return '✅';
  if (score >= 0.6) return '⚠️';
  if (score >= 0.4) return '⚠️';
  return '❌';
}

// Memory type formatting
export function formatMemoryType(type: MemoryType): string {
  const labels = {
    goal: 'Goal',
    preference: 'Preference',
    achievement: 'Achievement',
    injury: 'Injury History',
    feedback: 'Feedback',
    learning: 'Learning',
    pattern: 'Pattern',
    milestone: 'Milestone',
  };
  return labels[type] || 'Unknown';
}

export function getMemoryTypeIcon(type: MemoryType): string {
  const icons = {
    goal: '🎯',
    preference: '⚙️',
    achievement: '🏆',
    injury: '⚠️',
    feedback: '💬',
    learning: '🧠',
    pattern: '📊',
    milestone: '🏅',
  };
  return icons[type] || '📝';
}

export function getMemoryTypeColor(type: MemoryType): string {
  const colors = {
    goal: 'bg-blue-100 text-blue-800',
    preference: 'bg-purple-100 text-purple-800',
    achievement: 'bg-yellow-100 text-yellow-800',
    injury: 'bg-red-100 text-red-800',
    feedback: 'bg-green-100 text-green-800',
    learning: 'bg-indigo-100 text-indigo-800',
    pattern: 'bg-pink-100 text-pink-800',
    milestone: 'bg-orange-100 text-orange-800',
  };
  return colors[type] || 'bg-gray-100 text-gray-800';
}

// Coaching style formatting
export function getCoachingStyleIcon(style: CoachingStyle): string {
  const icons = {
    motivational: '🔥',
    analytical: '📊',
    educational: '📚',
    supportive: '🤗',
    challenging: '💪',
  };
  return icons[style] || '💬';
}

export function getCoachingStyleDescription(style: CoachingStyle): string {
  const descriptions = {
    motivational:
      'Uses encouragement and positive reinforcement to inspire action',
    analytical:
      'Focuses on data, metrics, and logical reasoning for decision making',
    educational: 'Emphasizes learning, explanation, and knowledge transfer',
    supportive: 'Provides emotional support, empathy, and gentle guidance',
    challenging: 'Pushes boundaries and encourages growth through difficulty',
  };
  return descriptions[style] || 'Adaptive coaching style based on user needs';
}

export function getCoachingStyleColor(style: CoachingStyle): string {
  const colors = {
    motivational: 'bg-red-100 text-red-800',
    analytical: 'bg-blue-100 text-blue-800',
    educational: 'bg-green-100 text-green-800',
    supportive: 'bg-pink-100 text-pink-800',
    challenging: 'bg-orange-100 text-orange-800',
  };
  return colors[style] || 'bg-gray-100 text-gray-800';
}

// Communication style formatting
export function getCommunicationStyleIcon(style: CommunicationStyle): string {
  const icons = {
    direct: '🎯',
    encouraging: '🌟',
    analytical: '📈',
    casual: '😊',
    professional: '👔',
  };
  return icons[style] || '💬';
}

export function getCommunicationStyleDescription(
  style: CommunicationStyle
): string {
  const descriptions = {
    direct: 'Straightforward, clear, and to-the-point communication',
    encouraging: 'Positive, uplifting, and supportive messaging',
    analytical: 'Data-driven, detailed, and methodical communication',
    casual: 'Friendly, relaxed, and informal tone',
    professional: 'Formal, structured, and business-like communication',
  };
  return descriptions[style] || 'Adaptive communication style';
}

// Motivation type formatting
export function getMotivationTypeIcon(type: MotivationType): string {
  const icons = {
    achievement: '🏆',
    social: '👥',
    autonomy: '🕊️',
    mastery: '🎯',
    purpose: '🌟',
  };
  return icons[type] || '💪';
}

export function getMotivationTypeDescription(type: MotivationType): string {
  const descriptions = {
    achievement: 'Motivated by reaching goals, milestones, and accomplishments',
    social: 'Driven by social connections, recognition, and community',
    autonomy: 'Values independence, self-direction, and personal control',
    mastery: 'Focused on skill development, learning, and self-improvement',
    purpose: 'Inspired by meaningful impact, values, and greater purpose',
  };
  return descriptions[type] || 'Adaptive motivation approach';
}

// Adaptation reasoning formatting
export function formatAdaptationReasoning(reasoning: string): string {
  // Split reasoning into bullet points if it contains multiple points
  const points = reasoning
    .split(/[.!?]\s+/)
    .filter((point) => point.trim().length > 0);

  if (points.length <= 1) {
    return reasoning;
  }

  // Return formatted text with bullet points
  return points.map((point) => `• ${point.trim()}`).join('\n');
}

// Priority formatting
export function getPriorityIcon(priority: 'low' | 'medium' | 'high'): string {
  const icons = {
    low: '🟢',
    medium: '🟡',
    high: '🔴',
  };
  return icons[priority] || '⚪';
}

export function getPriorityColor(priority: 'low' | 'medium' | 'high'): string {
  const colors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  };
  return colors[priority] || 'bg-gray-100 text-gray-800';
}

export function getPriorityLabel(priority: 'low' | 'medium' | 'high'): string {
  const labels = {
    low: 'Low Priority',
    medium: 'Medium Priority',
    high: 'High Priority',
  };
  return labels[priority] || 'Unknown Priority';
}

// Impact formatting
export function getImpactIcon(impact: 'low' | 'medium' | 'high'): string {
  const icons = {
    low: '📈',
    medium: '📊',
    high: '🚀',
  };
  return icons[impact] || '📈';
}

export function getImpactColor(impact: 'low' | 'medium' | 'high'): string {
  const colors = {
    low: 'bg-blue-100 text-blue-800',
    medium: 'bg-purple-100 text-purple-800',
    high: 'bg-orange-100 text-orange-800',
  };
  return colors[impact] || 'bg-gray-100 text-gray-800';
}

// Risk level formatting
export function getRiskIcon(risk: 'low' | 'medium' | 'high'): string {
  const icons = {
    low: '✅',
    medium: '⚠️',
    high: '🚨',
  };
  return icons[risk] || '❓';
}

export function getRiskColor(risk: 'low' | 'medium' | 'high'): string {
  const colors = {
    low: 'bg-green-100 text-green-800',
    medium: 'bg-yellow-100 text-yellow-800',
    high: 'bg-red-100 text-red-800',
  };
  return colors[risk] || 'bg-gray-100 text-gray-800';
}

// Trend formatting
export function getTrendIcon(trend: 'up' | 'down' | 'stable'): string {
  const icons = {
    up: '📈',
    down: '📉',
    stable: '➡️',
  };
  return icons[trend] || '❓';
}

export function getTrendColor(trend: 'up' | 'down' | 'stable'): string {
  const colors = {
    up: 'text-green-600',
    down: 'text-red-600',
    stable: 'text-gray-600',
  };
  return colors[trend] || 'text-gray-600';
}

// Time formatting utilities
export function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
  if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
  if (diffInSeconds < 604800)
    return `${Math.floor(diffInSeconds / 86400)}d ago`;

  return date.toLocaleDateString();
}

export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

// Number formatting
export function formatNumber(value: number, decimals: number = 1): string {
  if (value >= 1000000) return `${(value / 1000000).toFixed(decimals)}M`;
  if (value >= 1000) return `${(value / 1000).toFixed(decimals)}K`;
  return value.toFixed(decimals);
}

export function formatPercentage(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

// Validation utilities
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

// Error handling utilities
export function getErrorMessage(error: any): string {
  if (typeof error === 'string') return error;
  if (error?.message) return error.message;
  if (error?.error) return error.error;
  return 'An unexpected error occurred';
}

export function isNetworkError(error: any): boolean {
  return (
    error?.code === 'NETWORK_ERROR' ||
    error?.message?.includes('network') ||
    error?.message?.includes('fetch')
  );
}

// Loading state utilities
export function getLoadingMessage(type: string): string {
  const messages = {
    analyzing: 'Analyzing your data...',
    processing: 'Processing your request...',
    generating: 'Generating recommendations...',
    searching: 'Searching knowledge base...',
    adapting: 'Adapting your plan...',
    predicting: 'Making predictions...',
    summarizing: 'Summarizing conversation...',
    personalizing: 'Personalizing experience...',
  };
  return messages[type as keyof typeof messages] || 'Loading...';
}

// Cache utilities
export function generateCacheKey(
  prefix: string,
  params: Record<string, any>
): string {
  const sortedParams = Object.keys(params)
    .sort()
    .map((key) => `${key}:${JSON.stringify(params[key])}`)
    .join('|');
  return `${prefix}:${sortedParams}`;
}

export function isCacheExpired(
  timestamp: number,
  ttl: number = 300000
): boolean {
  return Date.now() - timestamp > ttl;
}

// Debounce utility
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// Throttle utility
export function throttle<T extends (...args: any[]) => any>(
  func: T,
  limit: number
): (...args: Parameters<T>) => void {
  let inThrottle: boolean;
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => (inThrottle = false), limit);
    }
  };
}

// Local storage utilities
export function getFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function setToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.warn('Failed to save to localStorage:', error);
  }
}

export function removeFromStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch (error) {
    console.warn('Failed to remove from localStorage:', error);
  }
}

// URL utilities
export function buildQueryString(params: Record<string, any>): string {
  const searchParams = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      searchParams.append(key, String(value));
    }
  });
  return searchParams.toString();
}

export function parseQueryString(queryString: string): Record<string, string> {
  const params: Record<string, string> = {};
  const searchParams = new URLSearchParams(queryString);
  searchParams.forEach((value, key) => {
    params[key] = value;
  });
  return params;
}

// Array utilities
export function groupBy<T>(array: T[], key: keyof T): Record<string, T[]> {
  return array.reduce(
    (groups, item) => {
      const group = String(item[key]);
      groups[group] = groups[group] || [];
      groups[group].push(item);
      return groups;
    },
    {} as Record<string, T[]>
  );
}

export function sortBy<T>(
  array: T[],
  key: keyof T,
  direction: 'asc' | 'desc' = 'asc'
): T[] {
  return [...array].sort((a, b) => {
    const aVal = a[key];
    const bVal = b[key];

    if (aVal < bVal) return direction === 'asc' ? -1 : 1;
    if (aVal > bVal) return direction === 'asc' ? 1 : -1;
    return 0;
  });
}

export function uniqueBy<T>(array: T[], key: keyof T): T[] {
  const seen = new Set();
  return array.filter((item) => {
    const value = item[key];
    if (seen.has(value)) return false;
    seen.add(value);
    return true;
  });
}

// Object utilities
export function deepMerge<T>(target: T, source: Partial<T>): T {
  const result = { ...target };

  Object.keys(source).forEach((key) => {
    const sourceValue = source[key as keyof T];
    const targetValue = result[key as keyof T];

    if (
      sourceValue &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key as keyof T] = deepMerge(targetValue, sourceValue);
    } else {
      result[key as keyof T] = sourceValue as T[keyof T];
    }
  });

  return result;
}

export function pick<T extends Record<string, any>, K extends keyof T>(
  obj: T,
  keys: K[]
): Pick<T, K> {
  const result = {} as Pick<T, K>;
  keys.forEach((key) => {
    if (key in obj) {
      (result as any)[key] = obj[key];
    }
  });
  return result;
}

export function omit<T, K extends keyof T>(obj: T, keys: K[]): Omit<T, K> {
  const result = { ...obj };
  keys.forEach((key) => {
    delete result[key];
  });
  return result;
}
