import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import {I18nManager} from 'react-native';
import i18n, {initI18n, supportedLanguages} from '../i18n';
import SplashScreen from '../screens/auth/SplashScreen';

type Language = 'en' | 'ar' | 'sv';

interface LocaleContextValue {
  language: Language;
  setLanguage: (lng: Language) => Promise<void>;
  isRTL: boolean;
}

const LocaleContext = createContext<LocaleContextValue | undefined>(undefined);

export function useLocale(): LocaleContextValue {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error('useLocale must be used within LocaleProvider');
  return ctx;
}

export function LocaleProvider({children}: {children: React.ReactNode}) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isRTL, setIsRTL] = useState<boolean>(false);
  const [ready, setReady] = useState<boolean>(false);

  useEffect(() => {
    initI18n()
      .then(({lng, isRTL}) => {
        console.log('[LocaleProvider] i18n ready with', lng, 'rtl:', isRTL);
        setLanguageState(lng);
        setIsRTL(isRTL);
        if (I18nManager.isRTL !== isRTL) {
          I18nManager.allowRTL(isRTL);
          I18nManager.forceRTL(isRTL);
        }
        setReady(true);
      })
      .catch(e => {
        console.error('[LocaleProvider] i18n init failed:', e);
        setLanguageState('en');
        setIsRTL(false);
        setReady(true);
      });
  }, []);

  const setLanguage = useCallback(async (lng: Language) => {
    if (!supportedLanguages.includes(lng)) return;

    const shouldRTL = lng === 'ar';

    // Force RTL change immediately
    if (I18nManager.isRTL !== shouldRTL) {
      I18nManager.allowRTL(shouldRTL);
      I18nManager.forceRTL(shouldRTL);

      // Restart the app to apply RTL changes
      if (__DEV__) {
        console.log('[LocaleProvider] RTL change detected, restarting app...');
        // In development, we'll just update the state
        // In production, you might want to restart the app
      }
    }

    await i18n.changeLanguage(lng);
    setLanguageState(lng);
    setIsRTL(shouldRTL);
  }, []);

  if (!ready) {
    console.log('[LocaleProvider] Initializing i18n...');
    return <SplashScreen />;
  }

  return (
    <LocaleContext.Provider value={{language, setLanguage, isRTL}}>
      {children}
    </LocaleContext.Provider>
  );
}
