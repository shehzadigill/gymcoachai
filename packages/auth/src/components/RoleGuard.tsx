import React from 'react';
import { useCurrentUser } from '../hooks/useCurrentUser';

export type UserRole = 'free' | 'premium' | 'admin';

interface RoleGuardProps {
  children: React.ReactNode;
  allowedRoles: UserRole[];
  fallback?: React.ReactNode;
  requireAll?: boolean;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({
  children,
  allowedRoles,
  fallback,
  requireAll = false,
}) => {
  const { isAuthenticated, isLoading, ...rest } = useCurrentUser();
  console.log('RoleGuard', { isAuthenticated, isLoading, ...rest });
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">
            Authentication Required
          </h2>
          <p className="text-secondary-600 mb-4">
            Please sign in to access this feature.
          </p>
        </div>
      </div>
    );
  }

  // Get user role from user attributes (this would come from Cognito custom attributes)
  // For now, default to 'free' - this would be fetched from user attributes
  const userRole = 'free';

  const hasPermission = requireAll
    ? allowedRoles.every((role) => userRole === role)
    : allowedRoles.includes(userRole as UserRole);

  if (!hasPermission) {
    if (fallback) {
      return <>{fallback}</>;
    }

    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-secondary-900 mb-4">
            Access Denied
          </h2>
          <p className="text-secondary-600 mb-4">
            You don't have permission to access this feature.
          </p>
          <p className="text-sm text-secondary-500">
            Required roles: {allowedRoles.join(', ')}
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
};
