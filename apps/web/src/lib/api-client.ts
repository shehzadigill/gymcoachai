import { tokenManager } from '@packages/auth';

const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || '';

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const isLocal =
    typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const finalBase = isLocal ? '' : baseUrl;
  console.log('apiFetch', { baseUrl: finalBase, path, init });
  const authHeaders = await tokenManager.getAuthHeaders();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(init.headers || {}),
  };

  const res = await fetch(`${finalBase}${path}`, {
    ...init,
    headers,
    cache: 'no-store',
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return (await res.json()) as T;
}
