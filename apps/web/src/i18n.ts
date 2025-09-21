import { getRequestConfig } from 'next-intl/server';

export const locales = ['en', 'sv'] as const;
export const defaultLocale = 'en';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`../messages/${locale}.json`)).default,
}));

