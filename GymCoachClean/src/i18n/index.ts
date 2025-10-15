import i18n from 'i18next';
import {initReactI18next} from 'react-i18next';
// Lazy load to avoid crashing if native module isn't linked yet
let RNLocalize: any;
try {
  RNLocalize = require('react-native-localize');
} catch (e) {
  console.log('[i18n] RNLocalize not available, using default locale');
  RNLocalize = null;
}

import en from './locales/en.json';
import ar from './locales/ar.json';
import sv from './locales/sv.json';

const resources = {
  en: {translation: en},
  ar: {translation: ar},
  sv: {translation: sv},
} as const;

export const supportedLanguages = Object.keys(resources);

export function detectLocale(): {
  languageTag: 'en' | 'ar' | 'sv';
  isRTL: boolean;
} {
  if (
    RNLocalize &&
    typeof RNLocalize.getLocales === 'function' &&
    typeof RNLocalize.findBestAvailableLanguage === 'function'
  ) {
    try {
      const locales = RNLocalize.getLocales();
      const best = RNLocalize.findBestAvailableLanguage(Object.keys(resources));
      const languageTag =
        (best?.languageTag?.split('-')[0] as 'en' | 'ar' | 'sv') || 'en';
      const isRTL =
        locales.length > 0 ? locales[0].isRTL : languageTag === 'ar';
      return {languageTag, isRTL};
    } catch (e) {
      console.log('[i18n] Error detecting locale, using default:', e);
    }
  }
  return {languageTag: 'en', isRTL: false};
}

// Initialize i18n immediately (synchronously) to avoid translation key display
const detected = detectLocale();
i18n.use(initReactI18next).init({
  compatibilityJSON: 'v3',
  resources,
  lng: detected.languageTag,
  fallbackLng: 'en',
  react: {useSuspense: false},
  interpolation: {escapeValue: false},
  returnNull: false,
});

console.log(
  '[i18n] Initialized synchronously with language:',
  detected.languageTag,
);

export async function initI18n(defaultLang?: 'en' | 'ar' | 'sv') {
  console.log('[i18n] initI18n start (already initialized)');
  const lng = defaultLang || detected.languageTag;

  // If language needs to change, do it here
  if (i18n.language !== lng) {
    await i18n.changeLanguage(lng);
    console.log('[i18n] Changed language to:', lng);
  }

  return {lng: i18n.language as 'en' | 'ar' | 'sv', isRTL: detected.isRTL};
}

export default i18n;
