import { locales } from '../../i18n/config';

// Generate static params for all supported locales
export async function generateStaticParams() {
  return locales.map((locale) => ({
    locale: locale,
  }));
}

export { default } from './enhanced-dashboard';
