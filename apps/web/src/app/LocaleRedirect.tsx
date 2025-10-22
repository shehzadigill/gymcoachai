'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { defaultLocale, locales } from '../i18n/config';

/**
 * Client-side locale redirect for static exports
 * This component handles redirecting users from root path to their preferred locale
 */
export default function LocaleRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Only run on client-side
    if (typeof window === 'undefined') return;

    // Check if we're on a path that already has a locale
    const pathname = window.location.pathname;
    const hasLocale = locales.some(
      (locale) =>
        pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`
    );

    // If already on a localized path, do nothing
    if (hasLocale) return;

    // Get preferred locale from localStorage or cookie
    let preferredLocale = localStorage.getItem('preferredLocale');

    // Fallback to cookie if localStorage is empty
    if (!preferredLocale) {
      const cookies = document.cookie.split(';');
      const localeCookie = cookies.find((c) =>
        c.trim().startsWith('preferredLocale=')
      );
      if (localeCookie) {
        preferredLocale = localeCookie.split('=')[1];
      }
    }

    // Validate locale, fallback to default if invalid
    const targetLocale =
      preferredLocale && locales.includes(preferredLocale as any)
        ? preferredLocale
        : defaultLocale;

    // Save to both localStorage and cookie for future visits
    localStorage.setItem('preferredLocale', targetLocale);
    document.cookie = `preferredLocale=${targetLocale}; path=/; max-age=31536000; SameSite=Lax`;

    // Redirect to localized path
    const newPath = `/${targetLocale}${pathname === '/' ? '' : pathname}`;
    router.replace(newPath);
  }, [router]);

  return null; // This component doesn't render anything
}
