import { tokenManager } from '@packages/auth';

const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || '';

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const isLocal =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' ||
      window.location.hostname === '127.0.0.1');

  const isDevelopment = process.env.NODE_ENV === 'development';
  const isStaticExport = process.env.NEXT_EXPORT === 'true';

  // Use local proxy only in development mode and when not doing static export
  const shouldUseProxy = isLocal && isDevelopment && !isStaticExport;
  const finalBase = baseUrl;
  const authHeaders = await tokenManager.getAuthHeaders();
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(init.headers || {}),
  };

  const fetchOptions: RequestInit = {
    ...init,
    headers,
    cache: 'no-store',
  };

  // Add CORS mode when making direct cross-origin requests
  if (!shouldUseProxy && isLocal) {
    fetchOptions.mode = 'cors';
    fetchOptions.credentials = 'omit';
  }

  console.log(`API Request: ${finalBase}${path}`, fetchOptions);
  const res = await fetch(`${finalBase}${path}`, fetchOptions);
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Request failed: ${res.status}`);
  }
  return res as T;
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
  async getStrengthProgress(
    userId?: string,
    startDate?: string,
    endDate?: string
  ) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<any>(`/api/analytics/strength-progress/${id}${query}`);
  },

  async createStrengthProgress(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/strength-progress`, {
      method: 'POST',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  async getBodyMeasurements(
    userId?: string,
    startDate?: string,
    endDate?: string
  ) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<any>(`/api/analytics/body-measurements/${id}${query}`);
  },

  async createBodyMeasurement(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/body-measurements`, {
      method: 'POST',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  async getProgressCharts(userId?: string, timeRange?: string) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams();
    if (timeRange) params.append('timeRange', timeRange);
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<any>(`/api/analytics/charts/${id}${query}`);
  },

  async getMilestones(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/milestones/${id}`);
  },

  // Enhanced Analytics endpoints
  // Enhanced Analytics endpoints\n  async getEnhancedWorkoutAnalytics(userId?: string, period?: string) {\n    const id = userId || (await getCurrentUserId());\n    const params = new URLSearchParams({ userId: id });\n    if (period) params.append('period', period);\n    return apiFetch<any>(`/api/analytics/enhanced/workout-analytics?${params}`);\n  },

  async getEnhancedWorkoutInsights(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/enhanced/workout-insights/${id}`);
  },

  async getWorkoutHistoryDetailed(
    userId?: string,
    startDate?: string,
    endDate?: string,
    limit?: number
  ) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    if (limit) params.append('limit', limit.toString());
    return apiFetch<any>(`/api/analytics/enhanced/workout-history?${params}`);
  },

  async createMilestone(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/milestones`, {
      method: 'POST',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  async updateMilestone(milestoneId: string, data: any) {
    return apiFetch<any>(`/api/analytics/milestones/${milestoneId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteMilestone(milestoneId: string) {
    return apiFetch<any>(`/api/analytics/milestones/${milestoneId}`, {
      method: 'DELETE',
    });
  },

  async getAchievements(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/achievements/${id}`);
  },

  async getPerformanceTrends(
    userId?: string,
    timeRange?: string,
    metrics?: string[]
  ) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams();
    if (timeRange) params.append('timeRange', timeRange);
    if (metrics && metrics.length > 0) {
      metrics.forEach((metric) => params.append('metrics', metric));
    }
    const query = params.toString() ? `?${params.toString()}` : '';
    return apiFetch<any>(`/api/analytics/trends/${id}${query}`);
  },

  // User profile endpoints
  async getUserProfile(userId?: string) {
    // Don't include user ID in path - let backend authenticate from JWT token
    return apiFetch<any>('/api/user-profiles/profile');
  },

  async updateUserProfile(data: any, userId?: string) {
    // Transform the data to match backend expectations
    const transformedData = { ...data };

    // Transform camelCase field names to snake_case
    if (data.firstName) {
      transformedData.first_name = data.firstName;
      delete transformedData.firstName;
    }
    if (data.lastName) {
      transformedData.last_name = data.lastName;
      delete transformedData.lastName;
    }
    if (data.profileImageUrl) {
      transformedData.profile_image_url = data.profileImageUrl;
      delete transformedData.profileImageUrl;
    }
    if (data.dateOfBirth) {
      transformedData.date_of_birth = data.dateOfBirth;
      delete transformedData.dateOfBirth;
    }
    if (data.fitnessGoals) {
      transformedData.fitness_goals = data.fitnessGoals;
      delete transformedData.fitnessGoals;
    }
    if (data.experienceLevel) {
      transformedData.experience_level = data.experienceLevel;
      delete transformedData.experienceLevel;
    }
    if (data.fitnessLevel) {
      transformedData.fitness_level = data.fitnessLevel;
      delete transformedData.fitnessLevel;
    }
    if (data.createdAt) {
      transformedData.created_at = data.createdAt;
      delete transformedData.createdAt;
    }
    if (data.updatedAt) {
      transformedData.updated_at = data.updatedAt;
      delete transformedData.updatedAt;
    }

    // Keep preferences as-is since the backend models match the frontend structure
    if (data.preferences) {
      transformedData.preferences = data.preferences;
    }

    // Don't include user ID in path - let backend authenticate from JWT token
    return apiFetch<any>('/api/user-profiles/profile', {
      method: 'PUT',
      body: JSON.stringify(transformedData),
    });
  },

  // Goals and preferences specific methods
  async updateDailyGoals(dailyGoals: {
    calories: number;
    water: number;
    protein: number;
    carbs: number;
    fat: number;
  }) {
    return this.updateUserProfile({
      preferences: {
        dailyGoals: dailyGoals,
      },
    });
  },

  async updateFitnessGoals(goals: string[]) {
    return this.updateUserProfile({
      goals: goals,
    });
  },

  async updateUserPreferences(preferences: any, userId?: string) {
    // Send directly to preferences endpoint, not wrapped in a preferences object
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/user-profiles/profile/preferences/${id}`, {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  },

  // Workout endpoints
  async getWorkoutSessions(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any[]>(`/api/workouts/sessions?userId=${id}`);
  },

  async getWorkoutSession(sessionId: string, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/sessions/${sessionId}?userId=${id}`);
  },

  async createWorkoutSession(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/sessions`, {
      method: 'POST',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  async updateWorkoutSession(sessionId: string, data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/sessions`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, id: sessionId, userId: id }),
    });
  },

  async logActivity(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/log-activity`, {
      method: 'POST',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  // Workout Plans
  async getWorkoutPlans(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any[]>(`/api/workouts/plans?userId=${id}`);
  },

  async createWorkoutPlan(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/plans`, {
      method: 'POST',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  async getWorkoutPlan(userId: string, planId: string) {
    return apiFetch<any>(
      `/api/workouts/plans/${planId}?userId=${encodeURIComponent(userId)}`
    );
  },

  async updateWorkoutPlan(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/plans`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  async deleteWorkoutPlan(userId: string, planId: string) {
    return apiFetch<any>(
      `/api/workouts/plans/${planId}?userId=${encodeURIComponent(userId)}`,
      {
        method: 'DELETE',
      }
    );
  },

  // Exercise Library
  async getExercises(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any[]>(`/api/workouts/exercises?userId=${id}`);
  },

  async createExercise(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/exercises`, {
      method: 'POST',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  async getExercise(exerciseId: string) {
    return apiFetch<any>(`/api/workouts/exercises/${exerciseId}`);
  },

  async updateExercise(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/exercises`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, userId: id }),
    });
  },

  async deleteExercise(exerciseId: string) {
    return apiFetch<any>(`/api/workouts/exercises/${exerciseId}`, {
      method: 'DELETE',
    });
  },

  async cloneExercise(exerciseId: string, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/exercises/${exerciseId}/clone`, {
      method: 'POST',
      body: JSON.stringify({ userId: id }),
    });
  },

  // Progress Photos
  async getProgressPhotos(
    userId?: string,
    filters?: {
      photo_type?: string;
      start_date?: string;
      end_date?: string;
      limit?: number;
    }
  ) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams();
    if (filters?.photo_type) params.append('photo_type', filters.photo_type);
    if (filters?.start_date) params.append('start_date', filters.start_date);
    if (filters?.end_date) params.append('end_date', filters.end_date);
    if (filters?.limit) params.append('limit', filters.limit.toString());

    const queryString = params.toString() ? `?${params}` : '';
    return apiFetch<any[]>(
      `/api/analytics/progress-photos/${id}${queryString}`
    );
  },

  async uploadProgressPhoto(
    data: {
      photo_type: string;
      file: File;
      notes?: string;
      workout_session_id?: string;
    },
    userId?: string
  ) {
    const id = userId || (await getCurrentUserId());

    // Convert file to base64
    const fileBuffer = await data.file.arrayBuffer();
    const base64Data = btoa(String.fromCharCode(...new Uint8Array(fileBuffer)));

    const requestBody = {
      imageData: base64Data,
      contentType: data.file.type,
      photoType: data.photo_type,
      notes: data.notes,
      workoutSessionId: data.workout_session_id,
    };

    return apiFetch<any>(`/api/analytics/progress-photos/${id}/upload`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
  },

  async updateProgressPhoto(
    photoId: string,
    takenAt: string,
    data: {
      photo_type?: string;
      notes?: string;
    },
    userId?: string
  ) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ taken_at: takenAt });

    return apiFetch<any>(
      `/api/analytics/progress-photos/${id}/${photoId}?${params}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      }
    );
  },

  async deleteProgressPhoto(photoId: string, takenAt: string, userId?: string) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ taken_at: takenAt });

    return apiFetch<any>(
      `/api/analytics/progress-photos/${id}/${photoId}?${params}`,
      {
        method: 'DELETE',
      }
    );
  },

  async getProgressPhotoAnalytics(userId?: string, timeRange?: string) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams();
    if (timeRange) params.append('time_range', timeRange);

    const queryString = params.toString() ? `?${params}` : '';
    return apiFetch<any>(
      `/api/analytics/progress-photos/${id}/analytics${queryString}`
    );
  },

  async getProgressPhotoComparison(photoIds: string[], userId?: string) {
    const id = userId || (await getCurrentUserId());

    return apiFetch<any>(`/api/analytics/progress-photos/${id}/compare`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ photoIds }),
    });
  },

  async getProgressPhotoTimeline(userId?: string, photo_type?: string) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams();
    if (photo_type) params.append('photo_type', photo_type);

    const queryString = params.toString() ? `?${params}` : '';
    return apiFetch<any[]>(
      `/api/analytics/progress-photos/${id}/timeline${queryString}`
    );
  },

  // Workout Analytics
  async getWorkoutAnalytics(
    userId?: string,
    startDate?: string,
    endDate?: string
  ) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return apiFetch<any>(`/api/workouts/analytics?${params}`);
  },

  // Workout History
  async getWorkoutHistory(
    userId?: string,
    page?: number,
    limit?: number,
    filters?: {
      startDate?: string;
      endDate?: string;
      completed?: boolean;
      planId?: string;
      exerciseId?: string;
      sortBy?: string;
      sortOrder?: 'asc' | 'desc';
    }
  ) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    if (filters) {
      Object.entries(filters).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          params.append(key, value.toString());
        }
      });
    }
    return apiFetch<any>(`/api/workouts/history?${params}`);
  },

  async getDetailedWorkoutHistory(userId?: string, sessionIds?: string[]) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (sessionIds && sessionIds.length > 0) {
      sessionIds.forEach((sessionId) => params.append('sessionIds', sessionId));
    }
    return apiFetch<any>(`/api/workouts/history/detailed?${params}`);
  },

  async getWorkoutInsights(userId?: string, timeRange?: string) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (timeRange) params.append('timeRange', timeRange);
    return apiFetch<any>(`/api/workouts/insights?${params}`);
  },

  async compareWorkoutPeriods(
    period1: { start: string; end: string },
    period2: { start: string; end: string },
    userId?: string
  ) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/compare-periods`, {
      method: 'POST',
      body: JSON.stringify({
        userId: id,
        period1,
        period2,
      }),
    });
  },

  // Note: Export functionality moved to client-side in analytics page
  // This endpoint doesn't exist in the current backend implementation
  // async exportWorkoutData(
  //   userId?: string,
  //   format?: 'json' | 'csv',
  //   filters?: any
  // ) {
  //   const id = userId || (await getCurrentUserId());
  //   const params = new URLSearchParams({ userId: id });
  //   if (format) params.append('format', format);
  //   if (filters) {
  //     Object.entries(filters).forEach(([key, value]) => {
  //       if (value !== undefined && value !== null) {
  //         params.append(key, value.toString());
  //       }
  //     });
  //   }
  //   return apiFetch<any>(`/api/workouts/export?${params}`);
  // },

  async deleteWorkoutSession(sessionId: string) {
    return apiFetch<any>(`/api/workouts/sessions/${sessionId}`, {
      method: 'DELETE',
    });
  },

  async completeWorkoutSession(sessionId: string, userId?: string) {
    const id = userId || (await getCurrentUserId());
    // First get the session to preserve existing data
    const session = await this.getWorkoutSession(sessionId, id);
    let sessionData = session;
    if (session && typeof session === 'object' && 'body' in session) {
      sessionData =
        typeof session.body === 'string'
          ? JSON.parse(session.body)
          : session.body;
    }

    console.log('Web completeWorkoutSession - sessionData:', sessionData);
    console.log(
      'Web completeWorkoutSession - exercises:',
      sessionData.exercises
    );

    return apiFetch<any>(`/api/workouts/sessions`, {
      method: 'PUT',
      body: JSON.stringify({
        id: sessionId,
        userId: id,
        name: sessionData.name || 'Workout Session',
        startedAt:
          sessionData.started_at ||
          sessionData.created_at ||
          new Date().toISOString(),
        completedAt: new Date().toISOString(), // This marks the session as completed
        completed: true, // Explicitly mark as completed for clarity
        exercises: sessionData.exercises || [], // Preserve exercises data
        notes: sessionData.notes || null,
        rating: sessionData.rating || null,
        createdAt: sessionData.created_at || new Date().toISOString(),
        workoutPlanId: sessionData.workout_plan_id || null,
        durationMinutes: sessionData.duration_minutes || null,
      }),
    });
  },

  // Nutrition endpoints
  async getMealsByDate(date: string, userId?: string) {
    if (userId) {
      return apiFetch<any[]>(
        `/api/nutrition/users/${userId}/meals/date/${date}`
      );
    }
    return apiFetch<any[]>(`/api/nutrition/me/meals/date/${date}`);
  },

  async createMeal(data: any, userId?: string) {
    if (userId) {
      return apiFetch<any>(`/api/nutrition/users/${userId}/meals`, {
        method: 'POST',
        body: JSON.stringify(data),
      });
    }
    return apiFetch<any>(`/api/nutrition/me/meals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updateMeal(mealId: string, data: any, userId?: string) {
    if (userId) {
      return apiFetch<any>(`/api/nutrition/users/${userId}/meals/${mealId}`, {
        method: 'PUT',
        body: JSON.stringify(data),
      });
    }
    return apiFetch<any>(`/api/nutrition/me/meals/${mealId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteMeal(mealId: string, userId?: string) {
    if (userId) {
      return apiFetch<any>(`/api/nutrition/users/${userId}/meals/${mealId}`, {
        method: 'DELETE',
      });
    }
    return apiFetch<any>(`/api/nutrition/me/meals/${mealId}`, {
      method: 'DELETE',
    });
  },

  async getUserMeals(userId?: string) {
    if (userId) {
      return apiFetch<any[]>(`/api/nutrition/users/${userId}/meals`);
    }
    return apiFetch<any[]>(`/api/nutrition/me/meals`);
  },

  // Food search endpoints
  async searchFoods(query: string, cursor?: string) {
    const url = `/api/nutrition/foods/search?q=${encodeURIComponent(query)}${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`;
    const res = await apiFetch<any>(url);

    // Backend returns: { body: { foods: [...], next_cursor: "..." } }
    const bodyData = res.body || res;
    const rawFoods = Array.isArray(bodyData.foods)
      ? bodyData.foods
      : Array.isArray(bodyData)
        ? bodyData
        : [];

    const mapped = (rawFoods as any[]).map((f) => {
      const nf = f.nutrition_facts || f.nutritionFacts || {};
      const topFacts = {
        calories: nf.calories ?? 0,
        protein: nf.protein ?? 0,
        carbs: nf.total_carbs ?? nf.carbs ?? 0,
        fat: nf.total_fat ?? nf.fat ?? 0,
        fiber: nf.dietary_fiber ?? nf.fiber ?? 0,
        sugar: nf.total_sugars ?? nf.sugar ?? 0,
        sodium: nf.sodium ?? 0,
      };

      const common = (f.common_servings || f.commonServings || []) as any[];
      let commonServings = common
        .map((s) => {
          const sNF = s.nutrition_facts || s.nutritionFacts || {};
          return {
            name: s.name || `${s.quantity ?? 1} ${s.unit ?? 'serving'}`,
            weight: s.weight ?? 100,
            nutritionFacts: {
              calories: sNF.calories ?? topFacts.calories,
              protein: sNF.protein ?? topFacts.protein,
              carbs: sNF.total_carbs ?? sNF.carbs ?? topFacts.carbs,
              fat: sNF.total_fat ?? sNF.fat ?? topFacts.fat,
              fiber: sNF.dietary_fiber ?? sNF.fiber ?? topFacts.fiber,
              sugar: sNF.total_sugars ?? sNF.sugar ?? topFacts.sugar,
              sodium: sNF.sodium ?? topFacts.sodium,
            },
          };
        })
        .filter((s) => typeof s.name === 'string' && s.name.length > 0);
      if (commonServings.length === 0) {
        commonServings = [
          { name: '100 g', weight: 100, nutritionFacts: topFacts },
        ];
      }

      return {
        id: f.id || f.FoodId || f.food_id,
        name: f.name || f.Name,
        brand: f.brand || f.Brand || '',
        category: f.category || f.Category || 'Other',
        subcategory: f.subcategory || f.Subcategory || '',
        nutritionFacts: topFacts,
        commonServings,
        allergens: f.allergens || f.Allergens || [],
        dietaryTags: f.dietary_tags || f.dietaryTags || [],
        verified: Boolean(f.verified ?? f.Verified ?? false),
        isActive: Boolean(f.is_active ?? f.IsActive ?? true),
      };
    });

    const nextCursor = bodyData?.next_cursor || null;
    return { foods: mapped as any[], nextCursor };
  },

  async getFood(foodId: string) {
    return apiFetch<any>(`/api/nutrition/foods/${foodId}`);
  },

  // Nutrition statistics
  async getNutritionStats(userId?: string) {
    userId = userId || (await getCurrentUserId());
    if (userId) {
      return apiFetch<any>(`/api/nutrition/users/${userId}/stats`);
    }
  },

  // Water intake endpoints
  async getWater(date: string, userId?: string) {
    if (userId) {
      return apiFetch<any>(`/api/nutrition/users/${userId}/water/date/${date}`);
    }
    return apiFetch<any>(`/api/nutrition/me/water/date/${date}`);
  },

  async setWater(date: string, glasses: number, userId?: string) {
    if (userId) {
      return apiFetch<any>(
        `/api/nutrition/users/${userId}/water/date/${date}`,
        {
          method: 'POST',
          body: JSON.stringify({ glasses }),
        }
      );
    }
    return apiFetch<any>(`/api/nutrition/me/water/date/${date}`, {
      method: 'POST',
      body: JSON.stringify({ glasses }),
    });
  },

  // Favorites endpoints
  async listFavoriteFoods(userId?: string) {
    if (userId) {
      return apiFetch<any>(`/api/nutrition/users/${userId}/favorites/foods`);
    }
    return apiFetch<any>(`/api/nutrition/me/favorites/foods`);
  },

  async addFavoriteFood(foodId: string, userId?: string) {
    if (userId) {
      return apiFetch<any>(
        `/api/nutrition/users/${userId}/favorites/foods/${foodId}`,
        { method: 'POST' }
      );
    }
    return apiFetch<any>(`/api/nutrition/me/favorites/foods/${foodId}`, {
      method: 'POST',
    });
  },

  async removeFavoriteFood(foodId: string, userId?: string) {
    if (userId) {
      return apiFetch<any>(
        `/api/nutrition/users/${userId}/favorites/foods/${foodId}`,
        { method: 'DELETE' }
      );
    }
    return apiFetch<any>(`/api/nutrition/me/favorites/foods/${foodId}`, {
      method: 'DELETE',
    });
  },

  // Image upload endpoints
  async generateUploadUrl(fileType: string) {
    return apiFetch<{
      upload_url: string;
      key: string;
      bucket_name: string;
      expires_in: number;
    }>(`/api/user-profiles/profile/upload`, {
      method: 'POST',
      body: JSON.stringify({ file_type: fileType }),
    });
  },

  async uploadImage(file: File, uploadUrl: string): Promise<void> {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      body: file,
      headers: {
        'Content-Type': file.type,
        // Don't add any other headers as S3 presigned URLs are very specific
      },
      mode: 'cors', // Explicitly set CORS mode
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Upload failed: ${response.status} - ${errorText}`);
    }
  },

  // Scheduling methods
  async scheduleWorkoutPlan(
    planId: string,
    schedule: {
      startDate: string;
      times: string[];
      userId?: string;
    }
  ) {
    const userId = schedule.userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/plans/${planId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({ ...schedule, userId }),
    });
  },

  async getScheduledWorkouts(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any[]>(`/api/workouts/schedules?userId=${id}`);
  },

  async updateScheduledWorkout(scheduleId: string, data: any) {
    return apiFetch<any>(`/api/workouts/schedules/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async cancelScheduledWorkout(scheduleId: string, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/schedules/${scheduleId}?userId=${id}`, {
      method: 'DELETE',
    });
  },

  // Sleep tracking endpoints - now using user-profile-service backend
  async getSleepData(date?: string, userId?: string) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (date) params.append('date', date);
    const res = await apiFetch<any>(`/api/user-profiles/sleep?${params}`);

    // Handle Lambda proxy integration response format
    return res.body || res;
  },

  async logSleep(
    data: {
      date: string;
      hours: number;
      minutes?: number;
      quality?: number; // 1-5 scale
      bedTime?: string;
      wakeTime?: string;
      notes?: string;
    },
    userId?: string
  ) {
    const id = userId || (await getCurrentUserId());
    const res = await apiFetch<any>(`/api/user-profiles/sleep`, {
      method: 'POST',
      body: JSON.stringify({ ...data, userId: id }),
    });

    // Handle Lambda proxy integration response format
    return res.body || res;
  },

  async updateSleepData(
    data: {
      date: string;
      hours: number;
      minutes?: number;
      quality?: number;
      bedTime?: string;
      wakeTime?: string;
      notes?: string;
    },
    userId?: string
  ) {
    const id = userId || (await getCurrentUserId());
    const res = await apiFetch<any>(`/api/user-profiles/sleep`, {
      method: 'PUT',
      body: JSON.stringify({ ...data, userId: id }),
    });

    // Handle Lambda proxy integration response format
    return res.body || res;
  },

  async getSleepHistory(userId?: string, days?: number) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (days) params.append('days', days.toString());
    const res = await apiFetch<any>(
      `/api/user-profiles/sleep/history?${params}`
    );

    // Handle Lambda proxy integration response format
    return res.body || res;
  },

  async getSleepStats(userId?: string, period?: 'week' | 'month' | 'year') {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (period) params.append('period', period);
    const res = await apiFetch<any>(`/api/user-profiles/sleep/stats?${params}`);

    // Handle Lambda proxy integration response format
    return res.body || res;
  },

  // AI Trainer endpoints with Lambda URL fallback
  async sendChatMessage(message: string, conversationId?: string) {
    return this.aiFetch('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({ message, conversationId }),
    });
  },

  async getConversations() {
    return this.aiFetch<any[]>('/api/ai/conversations');
  },

  async getConversation(conversationId: string) {
    return this.aiFetch<any>(`/api/ai/conversations/${conversationId}`);
  },

  async deleteConversation(conversationId: string) {
    return this.aiFetch<any>(`/api/ai/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  },

  async updateConversationTitle(conversationId: string, title: string) {
    return this.aiFetch<any>(`/api/ai/conversations/${conversationId}/title`, {
      method: 'PUT',
      body: JSON.stringify({ title }),
    });
  },

  async getRateLimit() {
    return this.aiFetch<any>('/api/ai/rate-limit');
  },

  async generateWorkoutPlan(data: {
    goals: string[];
    duration: number;
    daysPerWeek: number;
    equipment: string[];
  }) {
    return this.aiFetch<any>('/api/ai/workout-plan/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async generateMealPlan(data: {
    goals: string[];
    dietaryRestrictions: string[];
    duration: number;
    mealsPerDay?: number;
    calorieTarget?: number;
  }) {
    return this.aiFetch<any>('/api/ai/meal-plan/generate', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async analyzeProgress() {
    return this.aiFetch<any>('/api/ai/progress/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  },

  // Helper method for AI endpoints with Lambda URL fallback
  async aiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    const authHeaders = await tokenManager.getAuthHeaders();
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(init.headers || {}),
    };

    const fetchOptions: RequestInit = {
      ...init,
      headers,
      cache: 'no-store',
    };

    // Try CloudFront first
    try {
      const cloudfrontUrl = `${baseUrl}${path}`;
      console.log(`AI Request (CloudFront): ${cloudfrontUrl}`, fetchOptions);

      const res = await fetch(cloudfrontUrl, fetchOptions);
      if (res.ok) {
        return (await res.json()) as T;
      }

      // If CloudFront returns timeout error, try Lambda URL
      if (res.status === 504) {
        console.log('CloudFront timeout, trying Lambda URL...');
        throw new Error('CloudFront timeout');
      }

      const text = await res.text().catch(() => '');
      throw new Error(text || `Request failed: ${res.status}`);
    } catch (error) {
      // Fallback to Lambda URL
      const lambdaUrl =
        'https://omk3alczw57uum2gv5ouwbseym0ymyut.lambda-url.eu-north-1.on.aws';
      const lambdaFetchOptions: RequestInit = {
        ...fetchOptions,
        mode: 'cors',
        credentials: 'omit',
      };

      console.log(
        `AI Request (Lambda): ${lambdaUrl}${path}`,
        lambdaFetchOptions
      );
      const res = await fetch(`${lambdaUrl}${path}`, lambdaFetchOptions);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed: ${res.status}`);
      }

      return (await res.json()) as T;
    }
  },

  // Device token management (using notification service)
  async saveDeviceToken(token: string, platform: string = 'web') {
    const userId = await getCurrentUserId();
    const response = await apiFetch('/api/notifications/devices', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        device_token: token,
        platform: platform,
        device_name: navigator.userAgent,
      }),
    });
    return response;
  },

  async getDeviceTokens() {
    const response = await apiFetch('/api/notifications/devices');
    return response;
  },

  async deleteDeviceToken(deviceId: string) {
    const response = await apiFetch(`/api/notifications/devices/${deviceId}`, {
      method: 'DELETE',
    });
    return response;
  },

  // Notification management
  async sendNotification(data: {
    notification_type: string;
    title: string;
    body: string;
    data?: any;
    device_token?: string;
  }) {
    const userId = await getCurrentUserId();
    const response = await apiFetch('/api/notifications/send', {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        ...data,
      }),
    });
    return response;
  },

  async getNotifications() {
    const response = await apiFetch('/api/notifications');
    return response;
  },

  async markNotificationRead(notificationId: string) {
    const response = await apiFetch(
      `/api/notifications/${notificationId}/read`,
      {
        method: 'PUT',
      }
    );
    return response;
  },

  // Notification preferences
  async getNotificationPreferences() {
    const response = await apiFetch('/api/notifications/preferences');
    return response;
  },

  async updateNotificationPreferences(preferences: {
    email: boolean;
    push: boolean;
    workout_reminders: boolean;
    nutrition_reminders: boolean;
    achievement_notifications?: boolean;
    ai_suggestions?: boolean;
    weekly_reports?: boolean;
    marketing_emails?: boolean;
  }) {
    const response = await apiFetch('/api/notifications/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
    return response;
  },
};
