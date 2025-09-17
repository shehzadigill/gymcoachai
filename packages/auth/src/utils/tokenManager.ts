import { fetchAuthSession } from 'aws-amplify/auth';

export interface TokenInfo {
  accessToken: string;
  idToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export class TokenManager {
  private static instance: TokenManager;
  private tokenCache: Map<string, TokenInfo> = new Map();

  static getInstance(): TokenManager {
    if (!TokenManager.instance) {
      TokenManager.instance = new TokenManager();
    }
    return TokenManager.instance;
  }

  async getValidToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession();
      const accessToken = session.tokens?.accessToken?.toString();

      if (!accessToken) {
        return null;
      }

      // Check if token is expired
      const payload = this.parseJwtPayload(accessToken);
      if (payload && payload.exp * 1000 < Date.now()) {
        // Token is expired, try to refresh
        return await this.refreshToken();
      }

      return accessToken;
    } catch (error) {
      console.error('Error getting valid token:', error);
      return null;
    }
  }

  async refreshToken(): Promise<string | null> {
    try {
      const session = await fetchAuthSession({ forceRefresh: true });
      const accessToken = session.tokens?.accessToken?.toString();
      return accessToken || null;
    } catch (error) {
      console.error('Error refreshing token:', error);
      return null;
    }
  }

  async getAuthHeaders(): Promise<Record<string, string>> {
    const token = await this.getValidToken();

    if (!token) {
      return {};
    }

    return {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    };
  }

  private parseJwtPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT payload:', error);
      return null;
    }
  }

  clearCache(): void {
    this.tokenCache.clear();
  }
}

export const tokenManager = TokenManager.getInstance();
