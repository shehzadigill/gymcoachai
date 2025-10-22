// Minimal config for next-intl with static export
// Do NOT use getRequestConfig - it requires middleware which doesn't work with static exports
export const locales = ['en', 'ar', 'sv'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'en';
