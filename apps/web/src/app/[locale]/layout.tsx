import { locales } from '../../i18n/config';
import { notFound } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';

// Force static generation for all locale routes
export const dynamic = 'force-static';
export const dynamicParams = false;

// Generate static params for all supported locales
export async function generateStaticParams() {
  return locales.map((locale) => ({
    locale: locale,
  }));
}

import ClientLayout from './client-layout';

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  // Validate locale
  if (!locales.includes(locale as any)) {
    notFound();
  }

  // Load messages directly for static export (no plugin needed)
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  return (
    <NextIntlClientProvider
      locale={locale}
      messages={messages}
      timeZone="UTC"
      now={new Date()}
    >
      <ClientLayout locale={locale}>{children}</ClientLayout>
    </NextIntlClientProvider>
  );
}
