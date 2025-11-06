'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import {
  useCurrentUser,
  AuthGuard,
  signOut as amplifySignOut,
} from '@packages/auth';
import { useRouter, usePathname } from 'next/navigation';
import LocaleSync from '../../components/LocaleSync';
import { AINotificationHandler } from '../../components/ai/AINotificationHandler';
import TopNav from '../../components/TopNav';

export default function ClientLayout({
  children,
  locale,
}: {
  children: React.ReactNode;
  locale: string;
}) {
  const t = useTranslations('nav');
  const user = useCurrentUser();
  const router = useRouter();
  const pathname = usePathname();
  const [localeChangeKey, setLocaleChangeKey] = useState(0);

  // Sync locale to localStorage and cookie on mount and when locale changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('preferredLocale', locale);
      document.cookie = `preferredLocale=${locale}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [locale]);

  // Listen for locale changes and force re-render
  useEffect(() => {
    const handleLocaleChange = () => {
      setLocaleChangeKey((prev) => prev + 1);
    };

    window.addEventListener('localeChanged', handleLocaleChange);
    return () =>
      window.removeEventListener('localeChanged', handleLocaleChange);
  }, []);

  const handleSignOut = async () => {
    try {
      await amplifySignOut();
      // Clear the access_token cookie
      document.cookie =
        'access_token=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;';
      router.push(`/${locale}/auth/signin`);
    } catch (error) {
      console.error('Sign out error:', error);
    }
  };

  // Check if current path is an auth page or public page (should not have auth guard)
  const isAuthPage = pathname.includes('/auth/');
  const isPublicPage =
    pathname === '/' ||
    pathname.includes('/pricing') ||
    pathname.includes('/terms') ||
    pathname.includes('/privacy');

  // If it's an auth or public page, don't wrap in AuthGuard
  if (isAuthPage || isPublicPage) {
    return (
      <>
        <LocaleSync />
        {children}
      </>
    );
  }

  return (
    <AuthGuard>
      <LocaleSync />
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
        {/* Top Navigation */}
        <TopNav user={user} onSignOut={handleSignOut} locale={locale} />

        {/* Main content */}
        <main
          className="w-full px-3 sm:px-4 md:px-6 lg:px-12 xl:px-16 py-4 sm:py-6 md:py-8"
          key={localeChangeKey}
        >
          <div className="max-w-full overflow-x-hidden">{children}</div>
        </main>

        {/* AI Notification Handler */}
        <AINotificationHandler />
      </div>
    </AuthGuard>
  );
}
