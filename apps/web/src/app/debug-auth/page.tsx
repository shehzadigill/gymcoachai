'use client';

import { useCurrentUser } from '../../../../../packages/auth/dist';
import { useEffect, useState } from 'react';
import { initializeAuth } from '../../lib/auth-config';

export default function AuthDebugPage() {
  const { isAuthenticated, isLoading, error, name, email } = useCurrentUser();
  const [authInitialized, setAuthInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Try to initialize auth manually
  useEffect(() => {
    if (typeof window !== 'undefined' && !authInitialized) {
      try {
        initializeAuth();
        setAuthInitialized(true);
      } catch (e) {
        setInitError(e instanceof Error ? e.message : 'Unknown error');
        console.error('Failed to initialize auth in debug page:', e);
      }
    }
  }, [authInitialized]);

  return (
    <div className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold mb-6">Authentication Debug</h1>

      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-semibold mb-2">Auth State:</h2>
        <p>Loading: {isLoading ? 'Yes' : 'No'}</p>
        <p>Authenticated: {isAuthenticated ? 'Yes' : 'No'}</p>
        <p>Name: {name || 'None'}</p>
        <p>Email: {email || 'None'}</p>
        <p>Auth Initialized: {authInitialized ? 'Yes' : 'No'}</p>
        {error && <p className="text-red-600">Error: {error}</p>}
        {initError && <p className="text-red-600">Init Error: {initError}</p>}
      </div>

      <div className="bg-gray-100 p-4 rounded mb-4">
        <h2 className="font-semibold mb-2">Environment Variables:</h2>
        <p>User Pool ID: {process.env.NEXT_PUBLIC_USER_POOL_ID || 'Missing'}</p>
        <p>
          Client ID: {process.env.NEXT_PUBLIC_USER_POOL_CLIENT_ID || 'Missing'}
        </p>
        <p>Domain: {process.env.NEXT_PUBLIC_USER_POOL_DOMAIN || 'Missing'}</p>
        <p>Region: {process.env.NEXT_PUBLIC_AWS_REGION || 'Missing'}</p>
        <p>
          CloudFront URL: {process.env.NEXT_PUBLIC_CLOUDFRONT_URL || 'Missing'}
        </p>
      </div>

      <div className="bg-gray-100 p-4 rounded">
        <h2 className="font-semibold mb-2">Browser Info:</h2>
        <p>
          User Agent:{' '}
          {typeof window !== 'undefined' ? navigator.userAgent : 'Server'}
        </p>
        <p>
          URL: {typeof window !== 'undefined' ? window.location.href : 'Server'}
        </p>
        <p>Window Available: {typeof window !== 'undefined' ? 'Yes' : 'No'}</p>
      </div>
    </div>
  );
}
