import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  User,
  UserProfile,
  Workout,
  WorkoutSession,
  NutritionEntry,
  Food,
  Analytics,
  StrengthProgress,
  BodyMeasurement,
  Milestone,
  Achievement,
  ApiResponse,
  PaginatedResponse,
} from '../types';

// Use the same CloudFront URL as configured in our auth service
const baseUrl = 'https://d12pveuxxq3vvn.cloudfront.net';

class ApiClient {
  private async isDemoMode(): Promise<boolean> {
    // For real implementation, we should check if the user is properly authenticated
    // Return false to use real AWS APIs
    return false;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      // Try ID token first (many backends expect ID tokens for user authentication)
      const idToken = await AsyncStorage.getItem('idToken');
      const accessToken = await AsyncStorage.getItem('accessToken');

      // Use ID token if available, otherwise fall back to access token
      const token = idToken || accessToken;
      const tokenType = idToken ? 'ID' : 'Access';

      if (token) {
        const headers = {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
        console.log(
          `API Client: Auth headers prepared with ${tokenType} token:`,
          {
            Authorization: `Bearer ${token.substring(0, 20)}...`,
            'Content-Type': 'application/json',
          },
        );
        return headers;
      }
    } catch (error) {
      console.error('Failed to get auth headers:', error);
    }
    return {
      'Content-Type': 'application/json',
    };
  }

  private async getCurrentUserId(): Promise<string> {
    const isDemo = await this.isDemoMode();
    if (isDemo) {
      // Return demo user ID without calling AWS
      return 'demo-user-1';
    }

    try {
      // Get ID token and extract user ID (sub) from it
      const idToken = await AsyncStorage.getItem('idToken');
      if (idToken) {
        console.log(
          'API Client: Retrieved idToken for user ID extraction:',
          idToken ? `${idToken.substring(0, 20)}...` : 'null',
        );
        const payload = this.parseJwtPayload(idToken);
        console.log(
          'API Client: Parsed token payload for user ID:',
          payload ? {sub: payload.sub, username: payload.username} : 'null',
        );
        if (payload?.sub) {
          return payload.sub; // Return the actual user ID (sub) from token
        }
      }

      // Try access token if ID token doesn't have sub
      const accessToken = await AsyncStorage.getItem('accessToken');
      if (accessToken) {
        console.log('API Client: Trying access token for user ID extraction');
        const accessPayload = this.parseJwtPayload(accessToken);
        if (accessPayload?.sub) {
          console.log(
            'API Client: Found userId in access token:',
            accessPayload.sub,
          );
          return accessPayload.sub;
        }
      }

      console.warn(
        'API Client: No userId found in tokens, this may cause API failures',
      );
    } catch (error) {
      console.error('Failed to get current user ID:', error);
    }

    // Fallback to demo user ID
    return 'demo-user-1';
  }

  private parseJwtPayload(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');

      // Add padding if needed
      const paddedBase64 = base64 + '='.repeat((4 - (base64.length % 4)) % 4);

      // Simple base64 decode for React Native using the polyfill approach
      const binaryString = this.base64Decode(paddedBase64);
      const jsonPayload = decodeURIComponent(
        binaryString
          .split('')
          .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join(''),
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Error parsing JWT payload:', error);
      return null;
    }
  }

  private base64Decode(str: string): string {
    try {
      // Base64 character set
      const chars =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
      let result = '';

      // Remove any characters not in the base64 character set
      str = str.replace(/[^A-Za-z0-9+/]/g, '');

      for (let i = 0; i < str.length; i += 4) {
        const encoded1 = chars.indexOf(str.charAt(i));
        const encoded2 = chars.indexOf(str.charAt(i + 1));
        const encoded3 = chars.indexOf(str.charAt(i + 2));
        const encoded4 = chars.indexOf(str.charAt(i + 3));

        const bitmap =
          (encoded1 << 18) | (encoded2 << 12) | (encoded3 << 6) | encoded4;

        result += String.fromCharCode((bitmap >> 16) & 255);
        if (encoded3 !== 64) result += String.fromCharCode((bitmap >> 8) & 255);
        if (encoded4 !== 64) result += String.fromCharCode(bitmap & 255);
      }

      return result;
    } catch (error) {
      console.error('Error in base64Decode:', error);
      return '';
    }
  }

  private async apiFetch<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const isDemo = await this.isDemoMode();
    if (isDemo) {
      // Return mock data for demo mode
      console.log(`Demo mode: Mocking API call to ${path}`);

      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 300));

      // Return appropriate mock data based on the path
      if (path.includes('workouts/plans')) {
        return [
          {
            id: 'demo-workout-1',
            name: 'Upper Body Strength',
            description: 'Focus on building upper body strength',
            difficulty: 'intermediate',
            duration: 45,
            exercises: [],
          },
          {
            id: 'demo-workout-2',
            name: 'Cardio HIIT',
            description: 'High intensity interval training',
            difficulty: 'hard',
            duration: 30,
            exercises: [],
          },
        ] as T;
      } else if (path.includes('workouts/sessions')) {
        return [] as T;
      } else if (path.includes('workouts/exercises')) {
        return [] as T;
      } else if (path.includes('nutrition/meals')) {
        return {
          meals: [],
          totalCalories: 0,
          totalProtein: 0,
          totalCarbs: 0,
          totalFat: 0,
        } as T;
      } else if (path.includes('nutrition/stats')) {
        return {
          dailyGoals: {calories: 2000, protein: 150, carbs: 200, fat: 65},
          consumed: {calories: 1200, protein: 80, carbs: 100, fat: 40},
        } as T;
      } else if (path.includes('nutrition/water')) {
        return {
          glasses: 4,
          goal: 8,
          date: new Date().toISOString().split('T')[0],
        } as T;
      } else if (path.includes('analytics/strength-progress')) {
        return [] as T;
      } else if (path.includes('analytics/body-measurements')) {
        return [] as T;
      } else if (path.includes('analytics/milestones')) {
        return [] as T;
      } else if (path.includes('analytics/achievements')) {
        return [] as T;
      } else if (path.includes('user-profiles')) {
        return {
          id: 'demo-profile-1',
          userId: 'demo-user-1',
          firstName: 'Demo',
          lastName: 'User',
          height: 175,
          weight: 70,
          fitnessLevel: 'intermediate',
          goals: ['weight_loss', 'strength_gain'],
        } as T;
      }

      return [] as T;
    }

    try {
      const headers = await this.getAuthHeaders();
      const finalHeaders = {
        ...headers,
        ...options.headers,
      };

      console.log(`API Client: Making request to ${baseUrl}${path}`);
      console.log(
        'API Client: Final headers:',
        Object.keys(finalHeaders).reduce((acc, key) => {
          const value = (finalHeaders as any)[key];
          acc[key] =
            key === 'Authorization' ? `${value?.substring(0, 20)}...` : value;
          return acc;
        }, {} as Record<string, string>),
      );

      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: finalHeaders,
      });

      console.log(
        `API Client: Response status for ${path}: ${response.status}`,
      );

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.log(`API Client: Error response for ${path}:`, errorText);
        throw new Error(errorText || `Request failed: ${response.status}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      console.error(`API request failed for ${path}:`, error);
      throw error;
    }
  }

  // Authentication methods
  async getCurrentUser(): Promise<User | null> {
    const isDemo = await this.isDemoMode();
    if (isDemo) {
      // Return demo user data
      return {
        id: 'demo-user-1',
        email: 'demo@gymcoach.ai',
      };
    }

    try {
      // Get user info from AsyncStorage (stored by CognitoAuthService)
      const username = await AsyncStorage.getItem('username');
      const userEmail = await AsyncStorage.getItem('userEmail');

      if (username && userEmail) {
        return {
          id: username,
          email: userEmail,
        };
      }
    } catch (error) {
      console.error('Failed to get current user from storage:', error);
    }

    return null;
  }

  // User Profile methods
  async getUserProfile(userId?: string): Promise<UserProfile> {
    // Don't include user ID in path - let backend authenticate from JWT token
    console.log('API Client: Fetching user profile from JWT token');

    try {
      const result = await this.apiFetch<UserProfile>(
        '/api/user-profiles/profile',
      );
      console.log('API Client: User profile fetch successful:', result);
      return result;
    } catch (error) {
      console.warn(
        'API Client: User profile fetch failed (this API might not be implemented yet):',
        error,
      );
      // Return a basic user profile object to prevent crashes
      throw error; // Re-throw to let Promise.allSettled handle it
    }
  }

  async createUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<UserProfile>('/api/user-profiles', {
      method: 'POST',
      body: JSON.stringify({...data, userId}),
    });
  }

  async updateUserProfile(
    data: Partial<UserProfile>,
    userId?: string,
  ): Promise<UserProfile> {
    // Don't include user ID in path - let backend authenticate from JWT token
    return this.apiFetch<UserProfile>('/api/user-profiles/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Goals and preferences specific methods
  async updateDailyGoals(dailyGoals: {
    calories: number;
    water: number;
    protein: number;
    carbs: number;
    fat: number;
  }): Promise<UserProfile> {
    return this.updateUserProfile({
      preferences: {
        dailyGoals: dailyGoals,
      },
    });
  }

  async updateFitnessGoals(goals: string[]): Promise<UserProfile> {
    return this.updateUserProfile({
      goals: goals,
    });
  }

  async updateUserPreferences(preferences: any): Promise<UserProfile> {
    return this.updateUserProfile({
      preferences: preferences,
    });
  }

  // Analytics methods
  async getStrengthProgress(
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<StrengthProgress[]> {
    const id = userId || (await this.getCurrentUserId());
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiFetch<StrengthProgress[]>(
      `/api/analytics/strength-progress/${id}${query}`,
    );
  }

  async createStrengthProgress(
    data: Partial<StrengthProgress>,
  ): Promise<StrengthProgress> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<StrengthProgress>('/api/analytics/strength-progress', {
      method: 'POST',
      body: JSON.stringify({...data, userId}),
    });
  }

  async getBodyMeasurements(
    userId?: string,
    startDate?: string,
    endDate?: string,
  ): Promise<BodyMeasurement[]> {
    const id = userId || (await this.getCurrentUserId());
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiFetch<BodyMeasurement[]>(
      `/api/analytics/body-measurements/${id}${query}`,
    );
  }

  async createBodyMeasurement(
    data: Partial<BodyMeasurement>,
  ): Promise<BodyMeasurement> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<BodyMeasurement>('/api/analytics/body-measurements', {
      method: 'POST',
      body: JSON.stringify({...data, userId}),
    });
  }

  async getMilestones(userId?: string): Promise<Milestone[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<Milestone[]>(`/api/analytics/milestones/${id}`);
  }

  async createMilestone(data: Partial<Milestone>): Promise<Milestone> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<Milestone>('/api/analytics/milestones', {
      method: 'POST',
      body: JSON.stringify({...data, userId}),
    });
  }

  async getAchievements(userId?: string): Promise<Achievement[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<Achievement[]>(`/api/analytics/achievements/${id}`);
  }

  async getWorkoutAnalytics(userId?: string, period?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    const params = new URLSearchParams({userId: id});
    if (period) params.append('period', period);
    return this.apiFetch<any>(`/api/analytics/workout-analytics?${params}`);
  }

  async getPerformanceTrends(
    userId?: string,
    timeRange?: string,
    metrics?: string[],
  ): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    const params = new URLSearchParams({userId: id});
    if (timeRange) params.append('timeRange', timeRange);
    if (metrics && metrics.length > 0) {
      metrics.forEach(metric => params.append('metrics', metric));
    }
    return this.apiFetch<any>(`/api/analytics/trends?${params}`);
  }

  // Workout methods
  async getWorkouts(userId?: string): Promise<Workout[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<Workout[]>(`/api/workouts/plans?userId=${id}`);
  }

  async getWorkoutPlans(userId?: string): Promise<any[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any[]>(`/api/workouts/plans?userId=${id}`);
  }

  async createWorkout(data: Partial<Workout>): Promise<Workout> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<Workout>('/api/workouts/plans', {
      method: 'POST',
      body: JSON.stringify({...data, userId}),
    });
  }

  async getWorkoutSessions(userId?: string): Promise<WorkoutSession[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<WorkoutSession[]>(
      `/api/workouts/sessions?userId=${id}`,
    );
  }

  async createWorkoutSession(
    data: Partial<WorkoutSession>,
  ): Promise<WorkoutSession> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<WorkoutSession>('/api/workouts/sessions', {
      method: 'POST',
      body: JSON.stringify({...data, userId}),
    });
  }

  async updateWorkoutSession(
    sessionId: string,
    data: Partial<WorkoutSession>,
  ): Promise<WorkoutSession> {
    return this.apiFetch<WorkoutSession>(
      `/api/workouts/sessions/${sessionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      },
    );
  }

  async completeWorkoutSession(sessionId: string): Promise<WorkoutSession> {
    return this.apiFetch<WorkoutSession>(
      `/api/workouts/sessions/${sessionId}/complete`,
      {
        method: 'POST',
      },
    );
  }

  async getExercises(): Promise<any[]> {
    return this.apiFetch<any[]>('/api/workouts/exercises');
  }

  // Nutrition methods
  async getMealsByDate(date: string, userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/nutrition/users/${id}/meals/date/${date}`);
  }

  async createMeal(data: any, userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/nutrition/users/${id}/meals`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateMeal(mealId: string, data: any, userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/nutrition/users/${id}/meals/${mealId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteMeal(mealId: string, userId?: string): Promise<void> {
    const id = userId || (await this.getCurrentUserId());
    await this.apiFetch(`/api/nutrition/users/${id}/meals/${mealId}`, {
      method: 'DELETE',
    });
  }

  async getMeal(mealId: string, userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/nutrition/users/${id}/meals/${mealId}`);
  }

  async searchFoods(query: string, cursor?: string): Promise<any> {
    const params = new URLSearchParams({q: query});
    if (cursor) params.append('cursor', cursor);
    return this.apiFetch<any>(
      `/api/nutrition/foods/search?${params.toString()}`,
    );
  }

  async getFood(foodId: string): Promise<Food> {
    return this.apiFetch<Food>(`/api/nutrition/foods/${foodId}`);
  }

  async getNutritionStats(userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/nutrition/users/${id}/stats`);
  }

  async getWater(date: string, userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/nutrition/users/${id}/water/date/${date}`);
  }

  async setWater(date: string, glasses: number, userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/nutrition/users/${id}/water/date/${date}`, {
      method: 'POST',
      body: JSON.stringify({glasses}),
    });
  }

  // Scheduling methods
  async scheduleWorkoutPlan(
    planId: string,
    schedule: {
      startDate: string;
      times: string[];
      userId?: string;
    },
  ): Promise<any> {
    const userId = schedule.userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/workouts/plans/${planId}/schedule`, {
      method: 'POST',
      body: JSON.stringify({...schedule, userId}),
    });
  }

  async getScheduledWorkouts(userId?: string): Promise<any[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any[]>(`/api/workouts/schedules?userId=${id}`);
  }

  // Sleep tracking methods
  async getSleepData(date?: string, userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    const endpoint = date
      ? `/api/user-profiles/${id}/sleep/date/${date}`
      : `/api/user-profiles/${id}/sleep`;
    return this.apiFetch<any>(endpoint);
  }

  async setSleepData(date: string, data: any, userId?: string): Promise<any> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any>(`/api/user-profiles/${id}/sleep/date/${date}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }
}

export const apiClient = new ApiClient();
export default apiClient;
