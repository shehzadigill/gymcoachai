'use client';

import { useLocale, useTranslations } from 'next-intl';
import { usePathname } from 'next/navigation';
import { locales, localeNames, isRTL } from '../i18n/config';
import { useEffect, useState } from 'react';

export default function LanguageSwitcher() {
  const t = useTranslations('settings.language');
  const locale = useLocale();
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  // Sync current locale to localStorage and update local state when locale changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLocale', locale);
      document.cookie = `preferredLocale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [locale]);

  const handleLanguageChange = (newLocale: string) => {
    // Save preferred locale to localStorage and cookie
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLocale', newLocale);
      document.cookie = `preferredLocale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    }

    // Extract the path without locale
    let pathWithoutLocale = pathname;

    // All paths must have locale prefix, so remove it
    for (const loc of locales) {
      if (pathname.startsWith(`/${loc}/`)) {
        // Remove the locale prefix: /en/dashboard -> /dashboard
        pathWithoutLocale = pathname.substring(`/${loc}`.length);
        break;
      } else if (pathname === `/${loc}`) {
        // Handle root locale path: /en -> /
        pathWithoutLocale = '/';
        break;
      }
    }

    // Ensure path starts with / for root or already has it
    if (pathWithoutLocale === '') {
      pathWithoutLocale = '/';
    } else if (!pathWithoutLocale.startsWith('/')) {
      pathWithoutLocale = `/${pathWithoutLocale}`;
    }

    // Build new path with new locale
    const newPath = `/${newLocale}${pathWithoutLocale}`;

    // For static exports, use window.location to force a full reload
    // This ensures the locale context updates properly
    window.location.href = newPath;
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 rounded-md transition-colors"
      >
        <span className="text-lg">
          {locale === 'ar' ? '🇸🇦' : locale === 'sv' ? '🇸🇪' : '🇺🇸'}
        </span>
        <span>{localeNames[locale as keyof typeof localeNames]}</span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-md shadow-lg ring-1 ring-black ring-opacity-5 z-50">
          <div className="py-1">
            {locales.map((loc) => (
              <button
                key={loc}
                onClick={() => handleLanguageChange(loc)}
                className={`w-full text-left px-4 py-2 text-sm flex items-center space-x-3 hover:bg-gray-100 dark:hover:bg-gray-700 ${
                  locale === loc
                    ? 'bg-gray-100 dark:bg-gray-700 font-medium'
                    : ''
                }`}
              >
                <span className="text-lg">
                  {loc === 'ar' ? '🇸🇦' : loc === 'sv' ? '🇸🇪' : '🇺🇸'}
                </span>
                <span>{localeNames[loc]}</span>
                {isRTL(loc) && (
                  <span className="text-xs text-gray-500">RTL</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
