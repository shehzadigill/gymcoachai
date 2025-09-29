import { tokenManager } from '@packages/auth';

const baseUrl = process.env.NEXT_PUBLIC_CLOUDFRONT_URL || '';

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {}
): Promise<T> {
  const isLocal =
    typeof window !== 'undefined' && window.location.hostname === 'localhost';
  const finalBase = isLocal ? '' : baseUrl;
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
    return apiFetch<any>(`/api/analytics/strength-progress/${id}`);
  },

  async getBodyMeasurements(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/body-measurements/${id}`);
  },

  async getMilestones(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/milestones/${id}`);
  },

  async getAchievements(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/analytics/achievements/${id}`);
  },

  // User profile endpoints
  async getUserProfile(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/user-profiles/profile/${id}`);
  },

  async updateUserProfile(data: any, userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/user-profiles/profile/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
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
  async getProgressPhotos(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any[]>(`/api/workouts/progress-photos?userId=${id}`);
  },

  async deleteProgressPhoto(photoId: string) {
    return apiFetch<any>(`/api/workouts/progress-photos/${photoId}`, {
      method: 'DELETE',
    });
  },

  // Workout Analytics
  async getWorkoutAnalytics(userId?: string) {
    const id = userId || (await getCurrentUserId());
    return apiFetch<any>(`/api/workouts/analytics?userId=${id}`);
  },

  // Workout History
  async getWorkoutHistory(userId?: string, page?: number, limit?: number) {
    const id = userId || (await getCurrentUserId());
    const params = new URLSearchParams({ userId: id });
    if (page) params.append('page', page.toString());
    if (limit) params.append('limit', limit.toString());
    return apiFetch<any>(`/api/workouts/history?${params}`);
  },

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

    return apiFetch<any>(`/api/workouts/sessions`, {
      method: 'PUT',
      body: JSON.stringify({
        id: sessionId,
        userId: id,
        name: sessionData.name,
        startedAt:
          sessionData.started_at ||
          sessionData.created_at ||
          new Date().toISOString(),
        completedAt: new Date().toISOString(), // This marks the session as completed
        completed: true, // Explicitly mark as completed for clarity
        exercises: sessionData.exercises || [],
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
    if (userId) {
      return apiFetch<any>(`/api/nutrition/users/${userId}/stats`);
    }
    return apiFetch<any>(`/api/nutrition/me/stats`);
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
};
