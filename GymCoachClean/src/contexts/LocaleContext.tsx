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

  const setLanguage = useCallback(
    async (lng: Language) => {
      if (!supportedLanguages.includes(lng)) return;

      const shouldRTL = lng === 'ar';
      const currentRTL = I18nManager.isRTL;

      console.log('[LocaleContext] Language change:', {
        from: language,
        to: lng,
        currentRTL,
        shouldRTL,
      });

      // Always force RTL change if needed, even when switching back to LTR
      if (currentRTL !== shouldRTL) {
        console.log('[LocaleContext] RTL change needed:', {
          from: currentRTL,
          to: shouldRTL,
        });

        I18nManager.allowRTL(shouldRTL);
        I18nManager.forceRTL(shouldRTL);

        // Force a re-render by updating state immediately
        setIsRTL(shouldRTL);

        // In development, log the change
        if (__DEV__) {
          console.log('[LocaleContext] RTL change applied:', {
            I18nManager_isRTL: I18nManager.isRTL,
            I18nManager_allowRTL: I18nManager.allowRTL,
          });
        }
      }

      await i18n.changeLanguage(lng);
      setLanguageState(lng);

      console.log('[LocaleContext] Language change completed:', {
        language: lng,
        isRTL: shouldRTL,
      });
    },
    [language],
  );

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
