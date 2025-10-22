import { locales } from '../../i18n/config';

// Generate static params for all supported locales
export async function generateStaticParams() {
  return locales.map((locale) => ({
    locale: locale,
  }));
}

import ClientLayout from './client-layout';

export default function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { locale: string };
}) {
  return <ClientLayout locale={params.locale}>{children}</ClientLayout>;
}
