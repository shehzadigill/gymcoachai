'use client';

import { useEffect } from 'react';
import { initializeAuth } from '../../lib/auth-config';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient();
let isAmplifyConfigured = false;

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Configure Amplify as early as possible on the client
  if (typeof window !== 'undefined' && !isAmplifyConfigured) {
    try {
      initializeAuth();
      isAmplifyConfigured = true;
    } catch (e) {
      // Logged inside initializeAuth
    }
  }
  useEffect(() => {
    if (!isAmplifyConfigured) {
      try {
        initializeAuth();
        isAmplifyConfigured = true;
      } catch {}
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
