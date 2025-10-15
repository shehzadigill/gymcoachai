import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {useTranslation} from 'react-i18next';
import {useTheme} from '../theme';

export type ThemeMode = 'light' | 'dark' | 'system';
export type Language = 'en' | 'ar' | 'sv';

interface SettingsContextType {
  themeMode: ThemeMode;
  language: Language;
  setThemeMode: (mode: ThemeMode) => void;
  setLanguage: (lang: Language) => void;
  isLoading: boolean;
}

const SettingsContext = createContext<SettingsContextType | undefined>(
  undefined,
);

const THEME_STORAGE_KEY = '@gymcoach_theme_mode';
const LANGUAGE_STORAGE_KEY = '@gymcoach_language';

interface SettingsProviderProps {
  children: ReactNode;
}

export function SettingsProvider({children}: SettingsProviderProps) {
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [language, setLanguageState] = useState<Language>('en');
  const [isLoading, setIsLoading] = useState(true);
  const {i18n} = useTranslation();
  const {setMode: setTheme} = useTheme();

  // Load settings from storage on mount
  useEffect(() => {
    loadSettings();
  }, []);

  // Apply theme when themeMode changes
  useEffect(() => {
    applyTheme(themeMode);
  }, [themeMode]);

  // Apply language when language changes
  useEffect(() => {
    applyLanguage(language);
  }, [language]);

  const loadSettings = async () => {
    try {
      const [savedTheme, savedLanguage] = await Promise.all([
        AsyncStorage.getItem(THEME_STORAGE_KEY),
        AsyncStorage.getItem(LANGUAGE_STORAGE_KEY),
      ]);

      if (savedTheme && ['light', 'dark', 'system'].includes(savedTheme)) {
        setThemeModeState(savedTheme as ThemeMode);
      }

      if (savedLanguage && ['en', 'ar', 'sv'].includes(savedLanguage)) {
        setLanguageState(savedLanguage as Language);
      }
    } catch (error) {
      console.error('Error loading settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const applyTheme = (mode: ThemeMode) => {
    if (mode === 'system') {
      // Use system theme - you can implement system theme detection here
      setTheme('light'); // Default to light for now
    } else {
      setTheme(mode);
    }
  };

  const applyLanguage = async (lang: Language) => {
    try {
      await i18n.changeLanguage(lang);
    } catch (error) {
      console.error('Error changing language:', error);
    }
  };

  const setThemeMode = async (mode: ThemeMode) => {
    try {
      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme mode:', error);
    }
  };

  const setLanguage = async (lang: Language) => {
    try {
      setLanguageState(lang);
      await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, lang);
    } catch (error) {
      console.error('Error saving language:', error);
    }
  };

  const value: SettingsContextType = {
    themeMode,
    language,
    setThemeMode,
    setLanguage,
    isLoading,
  };

  return (
    <SettingsContext.Provider value={value}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
}
