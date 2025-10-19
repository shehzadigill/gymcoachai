export const locales = ['en', 'ar', 'sv'] as const;
export type Locale = (typeof locales)[number];

export const defaultLocale: Locale = 'en';

export const localeNames: Record<Locale, string> = {
  en: 'English',
  ar: 'العربية',
  sv: 'Svenska',
};

export const rtlLocales: Locale[] = ['ar'];

export function isRTL(locale: string): boolean {
  return rtlLocales.includes(locale as Locale);
}
