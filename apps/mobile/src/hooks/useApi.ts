import { useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';

const baseUrl = process.env.EXPO_PUBLIC_CLOUDFRONT_URL || '';

export async function getAccessToken() {
  return SecureStore.getItemAsync('access_token');
}

export async function setAccessToken(token: string) {
  await SecureStore.setItemAsync('access_token', token);
}

export async function clearAccessToken() {
  await SecureStore.deleteItemAsync('access_token');
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await getAccessToken();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers || {}),
  } as any;
  
  const res = await fetch(`${baseUrl}${path}`, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}

export function useApi<T>(
  path: string,
  options: { enabled?: boolean; dependencies?: any[] } = {}
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const { enabled = true, dependencies = [] } = options;

  const fetchData = async () => {
    if (!enabled) return;
    
    try {
      setLoading(true);
      setError(null);
      const result = await apiFetch<T>(path);
      setData(result);
    } catch (e: any) {
      setError(e?.message || 'Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, dependencies);

  return { data, loading, error, refetch: fetchData };
}
