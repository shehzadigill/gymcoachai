/**
 * JWT utilities for React Native
 * Safe wrapper around jwt-decode with better error handling
 */

import {jwtDecode} from 'jwt-decode';

export interface JWTPayload {
  sub?: string;
  username?: string;
  email?: string;
  exp?: number;
  iat?: number;
  'cognito:username'?: string;
  [key: string]: any;
}

/**
 * Safely decode a JWT token with proper error handling for React Native
 * @param token - JWT token string
 * @returns Decoded payload or null if decoding fails
 */
export function safeDecodeJWT(token: string): JWTPayload | null {
  try {
    if (!token || typeof token !== 'string') {
      console.warn('[jwtUtils] Invalid token: not a string or empty');
      return null;
    }

    // Basic JWT format validation (should have 3 parts separated by dots)
    const parts = token.split('.');
    if (parts.length !== 3) {
      console.warn(
        '[jwtUtils] Invalid token format: expected 3 parts, got',
        parts.length,
      );
      return null;
    }

    // Decode using jwt-decode library (now with base64 polyfill)
    const decoded = jwtDecode<JWTPayload>(token);

    if (!decoded) {
      console.warn('[jwtUtils] Token decoded but result is null/undefined');
      return null;
    }

    return decoded;
  } catch (error) {
    console.error('[jwtUtils] Failed to decode JWT token:', error);
    console.error(
      '[jwtUtils] Token preview:',
      token ? `${token.substring(0, 20)}...` : 'null',
    );
    return null;
  }
}

/**
 * Extract user ID (sub claim) from JWT token
 * @param token - JWT token string
 * @returns User ID or null if not found
 */
export function getUserIdFromToken(token: string): string | null {
  const payload = safeDecodeJWT(token);

  if (!payload) {
    return null;
  }

  // Try sub claim first (standard JWT claim for subject/user ID)
  if (payload.sub) {
    return payload.sub;
  }

  // Try cognito:username as fallback
  if (payload['cognito:username']) {
    return payload['cognito:username'];
  }

  // Try username as last resort
  if (payload.username) {
    return payload.username;
  }

  console.warn(
    '[jwtUtils] No user ID found in token payload:',
    Object.keys(payload),
  );
  return null;
}

/**
 * Check if a JWT token is expired
 * @param token - JWT token string
 * @returns true if expired, false if valid, null if cannot determine
 */
export function isTokenExpired(token: string): boolean | null {
  const payload = safeDecodeJWT(token);

  if (!payload || !payload.exp) {
    console.warn('[jwtUtils] Cannot determine expiration: no exp claim');
    return null;
  }

  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();

  const isExpired = currentTime >= expirationTime;

  if (isExpired) {
    const expiredAgo = Math.floor((currentTime - expirationTime) / 1000);
    console.log(`[jwtUtils] Token expired ${expiredAgo} seconds ago`);
  } else {
    const expiresIn = Math.floor((expirationTime - currentTime) / 1000);
    console.log(`[jwtUtils] Token expires in ${expiresIn} seconds`);
  }

  return isExpired;
}

/**
 * Get time until token expiration in seconds
 * @param token - JWT token string
 * @returns Seconds until expiration, or null if cannot determine
 */
export function getTokenExpirationTime(token: string): number | null {
  const payload = safeDecodeJWT(token);

  if (!payload || !payload.exp) {
    return null;
  }

  const expirationTime = payload.exp * 1000;
  const currentTime = Date.now();

  return Math.floor((expirationTime - currentTime) / 1000);
}

/**
 * Extract username from JWT token
 * @param token - JWT token string
 * @returns Username or null if not found
 */
export function getUsernameFromToken(token: string): string | null {
  const payload = safeDecodeJWT(token);

  if (!payload) {
    return null;
  }

  // Try cognito:username first
  if (payload['cognito:username']) {
    return payload['cognito:username'];
  }

  // Try username
  if (payload.username) {
    return payload.username;
  }

  // Try email as fallback
  if (payload.email) {
    return payload.email;
  }

  return null;
}

/**
 * Extract email from JWT token
 * @param token - JWT token string
 * @returns Email or null if not found
 */
export function getEmailFromToken(token: string): string | null {
  const payload = safeDecodeJWT(token);

  if (!payload) {
    return null;
  }

  return payload.email || null;
}
