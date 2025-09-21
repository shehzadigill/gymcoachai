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

// Helper function to get current user ID from auth context
export async function getCurrentUserId(): Promise<string> {
  try {
    const token = await tokenManager.getValidToken();
    if (!token) {
      throw new Error('No valid token available');
    }

    // Parse JWT token to extract user ID
    const payload = parseJwtPayload(token);
    if (!payload || !payload.sub) {
      throw new Error('Invalid token payload');
    }

    return payload.sub;
  } catch (error) {
    console.error('Failed to get current user ID:', error);
    throw new Error('Authentication required');
  }
}

// Helper function to parse JWT payload
function parseJwtPayload(token: string): any {
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

// API endpoints with proper user ID resolution
export const api = {
  // Analytics endpoints
  async getStrengthProgress(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/analytics/strength-progress/${id}`
    );
  },

  async getBodyMeasurements(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/analytics/body-measurements/${id}`
    );
  },

  async getMilestones(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/analytics/milestones/${id}`
    );
  },

  async getAchievements(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/analytics/achievements/${id}`
    );
  },

  // User profile endpoints
  async getUserProfile(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/user-profiles/profile/${id}`
    );
  },

  async updateUserProfile(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/user-profiles/profile/${id}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  // Workout endpoints
  async getWorkoutSessions(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any[] }>(
      `/api/workouts/sessions?userId=${id}`
    );
  },

  async createWorkoutSession(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/workouts/sessions`,
      {
        method: 'POST',
        body: JSON.stringify({ ...data, userId: id }),
      }
    );
  },

  async updateWorkoutSession(sessionId: string, data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/workouts/sessions`,
      {
        method: 'PUT',
        body: JSON.stringify({ ...data, id: sessionId, userId: id }),
      }
    );
  },

  async logActivity(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/workouts/log-activity`,
      {
        method: 'POST',
        body: JSON.stringify({ ...data, userId: id }),
      }
    );
  },

  // Nutrition endpoints
  async getMealsByDate(date: string, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any[] }>(
      `/api/users/${id}/meals/date/${date}`
    );
  },

  async createMeal(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/users/${id}/meals`,
      {
        method: 'POST',
        body: JSON.stringify(data),
      }
    );
  },

  async updateMeal(mealId: string, data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/users/${id}/meals/${mealId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  },

  async deleteMeal(mealId: string, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<{ statusCode: number; body: any }>(
      `/api/users/${id}/meals/${mealId}`,
      {
        method: 'DELETE',
      }
    );
  },

  // Food search endpoints
  async searchFoods(query: string) {
    return apiFetch<{ statusCode: number; body: any[] }>(
      `/api/foods/search?q=${encodeURIComponent(query)}`
    );
  },

  async getFood(foodId: string) {
    return apiFetch<{ statusCode: number; body: any }>(`/api/foods/${foodId}`);
  },
};
