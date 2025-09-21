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
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    if (redirectTo) {
      window.location.href = redirectTo;
      return null;
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-secondary-600 mb-4">
            Please sign in to access this page.
          </p>
          <a
            href="/auth/signin"
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Sign In
          </a>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
