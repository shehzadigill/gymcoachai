import React from 'react';
import { useAuthStatus } from '../hooks/useAuthStatus';

interface AuthGuardProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  redirectTo?: string;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({
  children,
  fallback,
  redirectTo = '/auth/signin',
}) => {
  const { isAuthenticated, isLoading, error } = useAuthStatus();
  console.log('AuthGuard', { isAuthenticated, isLoading, error });
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // Compute a locale-aware redirect when possible by inspecting the current path.
  const computeRedirectUrl = (to: string) => {
    if (typeof window === 'undefined') return to;
    try {
      const path = window.location.pathname || '/';
      const match = path.match(/^\/([a-z]{2})(?:\/|$)/i);
      const locale = match?.[1];
      if (!locale) return to;
      const trimmed = to.startsWith('/') ? to.slice(1) : to;
      // Ensure we don't duplicate slashes
      return `/${locale}/${trimmed}`.replace(/\/+/g, '/');
    } catch (e) {
      return to;
    }
  };

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-error-600 mb-4">
            Authentication Error
          </h2>
          <p className="text-secondary-600 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Retry
          </button>

          <button
            onClick={() => {
              const redirectUrl = computeRedirectUrl(
                redirectTo || '/auth/signin'
              );
              window.location.href = redirectUrl;
            }}
            className="mt-3 px-4 py-2 bg-secondary-100 text-secondary-900 rounded-lg hover:bg-secondary-200"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    // Compute a locale-aware redirect when possible by inspecting the current path.
    const computeRedirectUrl = (to: string) => {
      if (typeof window === 'undefined') return to;
      try {
        const path = window.location.pathname || '/';
        const match = path.match(/^\/([a-z]{2})(?:\/|$)/i);
        const locale = match?.[1];
        if (!locale) return to;
        const trimmed = to.startsWith('/') ? to.slice(1) : to;
        // Ensure we don't duplicate slashes
        return `/${locale}/${trimmed}`.replace(/\/+/g, '/');
      } catch (e) {
        return to;
      }
    };

    const redirectUrl = computeRedirectUrl(redirectTo || '/auth/signin');

    // If a fallback UI was provided, render it (allow app to control look)
    if (fallback) return <>{fallback}</>;

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-secondary-600 mb-4">
            Please sign in to access this page.
          </p>
          <button
            onClick={() => {
              // Use a full-page navigation so the auth flow can initialize correctly
              window.location.href = redirectUrl;
            }}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
