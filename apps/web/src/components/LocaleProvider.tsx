'use client';

import { NextIntlClientProvider } from 'next-intl';
import { ReactNode } from 'react';

interface LocaleProviderProps {
  children: ReactNode;
  messages: any;
  locale: string;
}

export default function LocaleProvider({
  children,
  messages,
  locale,
}: LocaleProviderProps) {
  const isRTL = locale === 'ar';

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
}
