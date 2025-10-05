'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useCurrentUser } from '../../../../../packages/auth/dist';

interface ClientAuthWrapperProps {
  children: React.ReactNode;
}

const publicRoutes = [
  '/',
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/codeVerification',
  '/terms',
  '/privacy',
  '/pricing',
  '/debug-auth',
];

const authRoutes = [
  '/auth/signin',
  '/auth/signup',
  '/auth/forgot-password',
  '/auth/reset-password',
  '/auth/codeVerification',
];

export function ClientAuthWrapper({ children }: ClientAuthWrapperProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [hasRedirected, setHasRedirected] = useState(false);

  // If it's a public route, don't do any authentication logic
  const isPublicRoute = publicRoutes.includes(pathname);
  if (isPublicRoute) {
    return <>{children}</>;
  }

  // Only use auth hook for protected routes
  const { isAuthenticated, isLoading } = useCurrentUser();

  useEffect(() => {
    // Don't do anything while loading or if we've already redirected
    if (isLoading || hasRedirected) return;

    const isAuthRoute = authRoutes.includes(pathname);

    // If user is authenticated and trying to access auth pages, redirect to dashboard
    if (isAuthenticated && isAuthRoute) {
      setHasRedirected(true);
      router.replace('/dashboard');
      return;
    }

    // If user is not authenticated and trying to access protected routes, redirect to signin
    if (!isAuthenticated && !isPublicRoute) {
      setHasRedirected(true);
      const redirectUrl = encodeURIComponent(pathname);
      router.replace(`/auth/signin?redirect=${redirectUrl}`);
      return;
    }
  }, [isAuthenticated, isLoading, pathname, router, hasRedirected]);

  // Reset redirect flag when pathname changes
  useEffect(() => {
    setHasRedirected(false);
  }, [pathname]);

  // Show loading spinner during auth check for protected routes
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
