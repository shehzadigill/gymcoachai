import { useState, useEffect } from 'react';
import { getCurrentUser } from 'aws-amplify/auth';

export interface AuthStatus {
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
}

export const useAuthStatus = (): AuthStatus => {
  const [status, setStatus] = useState<AuthStatus>({
    isAuthenticated: false,
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    const checkAuthStatus = async () => {
      try {
        setStatus((prev) => ({ ...prev, isLoading: true, error: null }));

        await getCurrentUser();
        setStatus({
          isAuthenticated: true,
          isLoading: false,
          error: null,
        });
      } catch (error) {
        setStatus({
          isAuthenticated: false,
          isLoading: false,
          error:
            error instanceof Error
              ? error.message
              : 'Authentication check failed',
        });
      }
    };

    checkAuthStatus();
  }, []);

  return status;
};
