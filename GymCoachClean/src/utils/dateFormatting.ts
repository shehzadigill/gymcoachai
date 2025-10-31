import {getLocales} from 'react-native-localize';
import {t} from 'i18next';

// Get current locale
const getCurrentLocale = () => {
  const locales = getLocales();
  return locales[0]?.languageCode || 'en';
};

// Locale-aware date formatting
export const formatDate = (
  date: Date | string,
  format: 'short' | 'medium' | 'long' = 'medium',
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getCurrentLocale();

  try {
    switch (format) {
      case 'short':
        return dateObj.toLocaleDateString(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
        });
      case 'medium':
        return dateObj.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
      case 'long':
        return dateObj.toLocaleDateString(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        });
      default:
        return dateObj.toLocaleDateString(locale);
    }
  } catch (error) {
    console.warn('Date formatting error:', error);
    return dateObj.toLocaleDateString();
  }
};

// Locale-aware time formatting
export const formatTime = (
  date: Date | string,
  format: 'short' | 'medium' | 'long' = 'short',
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getCurrentLocale();

  try {
    switch (format) {
      case 'short':
        return dateObj.toLocaleTimeString(locale, {
          hour: 'numeric',
          minute: '2-digit',
        });
      case 'medium':
        return dateObj.toLocaleTimeString(locale, {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
        });
      case 'long':
        return dateObj.toLocaleTimeString(locale, {
          hour: 'numeric',
          minute: '2-digit',
          second: '2-digit',
          timeZoneName: 'short',
        });
      default:
        return dateObj.toLocaleTimeString(locale);
    }
  } catch (error) {
    console.warn('Time formatting error:', error);
    return dateObj.toLocaleTimeString();
  }
};

// Locale-aware datetime formatting
export const formatDateTime = (
  date: Date | string,
  format: 'short' | 'medium' | 'long' = 'medium',
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getCurrentLocale();

  try {
    switch (format) {
      case 'short':
        return dateObj.toLocaleString(locale, {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: 'numeric',
          minute: '2-digit',
        });
      case 'medium':
        return dateObj.toLocaleString(locale, {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      case 'long':
        return dateObj.toLocaleString(locale, {
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
        });
      default:
        return dateObj.toLocaleString(locale);
    }
  } catch (error) {
    console.warn('DateTime formatting error:', error);
    return dateObj.toLocaleString();
  }
};

// Relative time formatting (time ago)
export const formatTimeAgo = (date: Date | string): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const now = new Date();
  const diffInSeconds = Math.floor((now.getTime() - dateObj.getTime()) / 1000);

  if (diffInSeconds < 60) {
    return t('formatting.relative_time.just_now');
  }

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) {
    return diffInMinutes === 1
      ? t('formatting.relative_time.minutes_ago', {count: 1})
      : t('formatting.relative_time.minutes_ago_plural', {
          count: diffInMinutes,
        });
  }

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) {
    return diffInHours === 1
      ? t('formatting.relative_time.hours_ago', {count: 1})
      : t('formatting.relative_time.hours_ago_plural', {count: diffInHours});
  }

  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 7) {
    return diffInDays === 1
      ? t('formatting.relative_time.days_ago', {count: 1})
      : t('formatting.relative_time.days_ago_plural', {count: diffInDays});
  }

  const diffInWeeks = Math.floor(diffInDays / 7);
  return diffInWeeks === 1
    ? t('formatting.relative_time.weeks_ago', {count: 1})
    : t('formatting.relative_time.weeks_ago_plural', {count: diffInWeeks});
};

// Weekday formatting
export const formatWeekday = (
  date: Date | string,
  format: 'short' | 'long' = 'short',
): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const locale = getCurrentLocale();

  try {
    return dateObj.toLocaleDateString(locale, {
      weekday: format === 'short' ? 'short' : 'long',
    });
  } catch (error) {
    console.warn('Weekday formatting error:', error);
    return dateObj.toLocaleDateString(locale, {weekday: 'short'});
  }
};
