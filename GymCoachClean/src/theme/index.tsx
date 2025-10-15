import React, {createContext, useContext, useMemo, useState} from 'react';
import {ColorSchemeName, useColorScheme} from 'react-native';

export type ThemeMode = 'light' | 'dark' | 'system';

export interface ColorPalette {
  primary: string;
  primaryText: string;
  background: string;
  card: string;
  surface: string;
  text: string;
  subtext: string;
  border: string;
  success: string;
  danger: string;
  warning: string;
  tabBar: {
    background: string;
    border: string;
    active: string;
    inactive: string;
  };
}

export interface ThemeContextValue {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  colors: ColorPalette;
  isDark: boolean;
}

const lightPalette: ColorPalette = {
  primary: '#2563eb',
  primaryText: '#ffffff',
  background: '#f8fafc',
  card: '#ffffff',
  surface: '#f1f5f9',
  text: '#0f172a',
  subtext: '#64748b',
  border: '#e2e8f0',
  success: '#10b981',
  danger: '#ef4444',
  warning: '#f59e0b',
  tabBar: {
    background: '#ffffff',
    border: '#e5e7eb',
    active: '#2563eb',
    inactive: '#94a3b8',
  },
};

const darkPalette: ColorPalette = {
  primary: '#60a5fa',
  primaryText: '#0b1220',
  background: '#0b1220',
  card: '#0f172a',
  surface: '#111827',
  text: '#e5e7eb',
  subtext: '#9ca3af',
  border: '#1f2937',
  success: '#34d399',
  danger: '#f87171',
  warning: '#fbbf24',
  tabBar: {
    background: '#0f172a',
    border: '#1f2937',
    active: '#60a5fa',
    inactive: '#6b7280',
  },
};

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

export function ThemeProvider({children}: {children: React.ReactNode}) {
  const systemScheme = useColorScheme();
  const [mode, setMode] = useState<ThemeMode>('system');

  const effectiveScheme: ColorSchemeName =
    mode === 'system' ? systemScheme : mode;
  const isDark = effectiveScheme === 'dark';

  const colors = useMemo(() => (isDark ? darkPalette : lightPalette), [isDark]);

  const value = useMemo(
    () => ({mode, setMode, colors, isDark}),
    [mode, colors, isDark],
  );

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}
