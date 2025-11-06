'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '../../../../../packages/auth/dist';

interface ProtectedRouteProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  requiredRole?: string;
  redirectTo?: string;
}

export function ProtectedRoute({
  children,
  fallback,
  requiredRole,
  redirectTo = '/auth/signin',
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, isLoading } = useCurrentUser();
  const [isAuthorized, setIsAuthorized] = useState(false);

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      const currentPath = window.location.pathname + window.location.search;
      const redirectUrl = encodeURIComponent(currentPath);
      router.push(`${redirectTo}?redirect=${redirectUrl}`);
      return;
    }

    // Check role-based access if required
    // For now, we'll skip role checking since we don't have user details in useCurrentUser
    // This can be enhanced later when we add role information to the hook
    if (requiredRole) {
      // TODO: Implement role checking once user details are available
    }

    setIsAuthorized(true);
  }, [isAuthenticated, isLoading, requiredRole, router, redirectTo]);

  if (isLoading) {
    return (
      fallback || (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Authenticating...
            </p>
          </div>
        </div>
      )
    );
  }

  if (!isAuthenticated || !isAuthorized) {
    return (
      fallback || (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900 flex items-center justify-center">
          <div className="text-center">
            <div className="animate-pulse">
              <div className="h-8 w-8 bg-blue-600 rounded-full mx-auto mb-4"></div>
            </div>
            <p className="text-gray-600 dark:text-gray-400">Redirecting...</p>
          </div>
        </div>
      )
    );
  }

  return <>{children}</>;
}
