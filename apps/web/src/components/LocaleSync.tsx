'use client';

import { useEffect, useState } from 'react';
import { useLocale } from 'next-intl';

/**
 * This component syncs the preferred locale from localStorage to a cookie
 * so the middleware can read it on the server-side and forces re-render on locale change
 */
export default function LocaleSync() {
  const locale = useLocale();
  const [lastLocale, setLastLocale] = useState(locale);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const preferredLocale = localStorage.getItem('preferredLocale');

      if (preferredLocale) {
        // Set cookie so middleware can access it
        document.cookie = `preferredLocale=${preferredLocale}; path=/; max-age=31536000; SameSite=Lax`;
      }
    }
  }, []);

  // Force re-render when locale changes
  useEffect(() => {
    if (lastLocale !== locale) {
      setLastLocale(locale);
      // Force a re-render by updating a state that triggers component re-render
      window.dispatchEvent(
        new CustomEvent('localeChanged', { detail: { locale } })
      );
    }
  }, [locale, lastLocale]);

  return null; // This component doesn't render anything
}
