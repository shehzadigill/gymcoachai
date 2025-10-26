import AsyncStorage from '@react-native-async-storage/async-storage';
import CognitoAuthService from './cognitoAuth';
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
  LegacyBodyMeasurement,
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

  async getCurrentUserId(): Promise<string> {
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

  async apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const isDemo = await this.isDemoMode();

    if (isDemo) {
      console.log('API Client: Demo mode active, intercepting API call');
      // Use demo mode handling here
      throw new Error('Demo mode not implemented for this endpoint');
    }

    const url = `${baseUrl}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...((options.headers as Record<string, string>) || {}),
    };

    try {
      const token = await AsyncStorage.getItem('idToken');
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Failed to get token for authorization:', error);
    }

    const fetchOptions: RequestInit = {
      ...options,
      headers,
    };

    try {
      console.log('Making API request:', url);
      console.log('Request options:', {
        method: fetchOptions.method,
        headers: fetchOptions.headers,
        body: fetchOptions.body,
      });

      const response = await fetch(url, fetchOptions);

      if (response.status === 401 || response.status === 403) {
        // Token might be expired, try to refresh and retry
        console.log('Received 401/403, attempting token refresh...');
        try {
          await CognitoAuthService.refreshTokens();

          // Get the new token and retry
          const newToken = await AsyncStorage.getItem('idToken');
          if (newToken) {
            headers.Authorization = `Bearer ${newToken}`;
            fetchOptions.headers = headers;

            console.log('Retrying API request with refreshed token...');
            const retryResponse = await fetch(url, fetchOptions);

            if (!retryResponse.ok) {
              const errorText = await retryResponse.text();
              console.error(
                'API retry failed:',
                retryResponse.status,
                errorText,
              );
              throw new Error(`HTTP ${retryResponse.status}: ${errorText}`);
            }

            return retryResponse.json();
          }
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          throw new Error('Authentication failed. Please log in again.');
        }
      }

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API request failed:', response.status, errorText);
        console.error('Request URL:', url);
        console.error('Request body:', options.body);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return response.json();
    } catch (error) {
      console.error('Network error:', error);
      throw error;
    }
  }

  private async makeAuthenticatedRequest<T>(
    path: string,
    options: RequestInit = {},
    isRetry: boolean = false,
  ): Promise<T> {
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
        // Check if it's an authentication error
        if (response.status === 401 && !isRetry) {
          console.log(
            'API Client: Authentication error, attempting token refresh...',
          );

          // Attempt to refresh tokens
          const refreshedUser = await CognitoAuthService.refreshTokens();

          if (refreshedUser) {
            console.log(
              'API Client: Token refresh successful, retrying request...',
            );
            // Retry the request with new tokens
            return this.makeAuthenticatedRequest<T>(path, options, true);
          } else {
            console.log(
              'API Client: Token refresh failed, user needs to re-authenticate',
            );
            throw new Error('Authentication failed. Please sign in again.');
          }
        }

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

  // Separated preferences methods for cleaner architecture
  async getUserPreferences(): Promise<any> {
    try {
      return this.apiFetch<any>('/api/user-profiles/profile/preferences');
    } catch (error) {
      console.warn('API Client: User preferences fetch failed:', error);
      return null;
    }
  }

  async updateUserPreferencesSeparate(preferences: any): Promise<any> {
    return this.apiFetch<any>('/api/user-profiles/profile/preferences', {
      method: 'PUT',
      body: JSON.stringify(preferences),
    });
  }

  async updateDailyGoalsSeparate(dailyGoals: {
    calories: number;
    water: number;
    protein: number;
    carbs: number;
    fat: number;
  }): Promise<any> {
    return this.updateUserPreferencesSeparate({
      dailyGoals: dailyGoals,
    });
  }

  async updateAIPreferences(aiPreferences: any): Promise<any> {
    return this.updateUserPreferencesSeparate({
      aiTrainer: aiPreferences,
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
  ): Promise<LegacyBodyMeasurement[]> {
    const id = userId || (await this.getCurrentUserId());
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    const measurements = await this.apiFetch<BodyMeasurement[]>(
      `/api/analytics/body-measurements/${id}${query}`,
    );

    // Group measurements by date for backward compatibility
    const groupedByDate: {[key: string]: any} = {};

    measurements.forEach((measurement: BodyMeasurement) => {
      const dateKey = new Date(measurement.measuredAt).toDateString();

      if (!groupedByDate[dateKey]) {
        groupedByDate[dateKey] = {
          id: measurement.id,
          userId: measurement.userId,
          date: measurement.measuredAt,
          createdAt: measurement.measuredAt,
        };
      }

      // Map measurement types to legacy fields
      switch (measurement.measurementType) {
        case 'weight':
          groupedByDate[dateKey].weight = measurement.value;
          break;
        case 'body_fat':
          groupedByDate[dateKey].bodyFat = measurement.value;
          break;
        case 'muscle_mass':
          groupedByDate[dateKey].muscleMass = measurement.value;
          break;
        default:
          // Store other measurements in a measurements object
          if (!groupedByDate[dateKey].measurements) {
            groupedByDate[dateKey].measurements = {};
          }
          groupedByDate[dateKey].measurements[measurement.measurementType] =
            measurement.value;
          break;
      }
    });

    // Convert to array and sort by date (newest first)
    return Object.values(groupedByDate).sort(
      (a: any, b: any) =>
        new Date(b.date).getTime() - new Date(a.date).getTime(),
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

  async updateWorkoutPlan(
    planId: string,
    data: Partial<Workout>,
  ): Promise<Workout> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<Workout>(`/api/workouts/plans/${planId}`, {
      method: 'PUT',
      body: JSON.stringify({...data, userId}),
    });
  }

  async getWorkoutSessions(userId?: string): Promise<WorkoutSession[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<WorkoutSession[]>(
      `/api/workouts/sessions?userId=${id}`,
    );
  }

  async getWorkoutSession(
    sessionId: string,
    userId?: string,
  ): Promise<WorkoutSession> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<WorkoutSession>(
      `/api/workouts/sessions/${sessionId}?userId=${id}`,
    );
  }

  async createWorkoutSession(
    data: Partial<WorkoutSession>,
  ): Promise<WorkoutSession> {
    const userId = await this.getCurrentUserId();
    console.log('CreateWorkoutSession - userId:', userId);
    console.log('CreateWorkoutSession - data:', data);

    // Ensure required fields are present
    const requestBody = {
      ...data,
      userId,
      name: (data as any).name || 'Workout Session', // Ensure name is always present
    };
    console.log('CreateWorkoutSession - requestBody:', requestBody);

    return this.apiFetch<WorkoutSession>('/api/workouts/sessions', {
      method: 'POST',
      body: JSON.stringify(requestBody),
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
    console.log('CompleteWorkoutSession called with sessionId:', sessionId);

    const userId = await this.getCurrentUserId();
    console.log('Got userId:', userId);

    try {
      // First get the session to preserve existing data
      console.log('Fetching session data for sessionId:', sessionId);
      console.log('Using userId:', userId);
      const session = await this.getWorkoutSession(sessionId);
      console.log('Session fetch result:', session);

      let sessionData = session;

      // Handle different response formats
      if (session && typeof session === 'object' && 'body' in session) {
        sessionData =
          typeof session.body === 'string'
            ? JSON.parse(session.body)
            : session.body;
      }

      console.log('Processed session data:', sessionData);

      // Preserve exercises data - don't transform if already in correct format
      let exercisesToSend = sessionData.exercises || [];

      // Only transform if exercises are in the old format
      if (
        exercisesToSend.length > 0 &&
        exercisesToSend[0] &&
        !exercisesToSend[0].exerciseId
      ) {
        console.log('Transforming exercises from old format...');
        exercisesToSend = exercisesToSend.map(
          (exercise: any, index: number) => ({
            exerciseId:
              exercise.exerciseId || exercise.exercise_id || exercise.id,
            name:
              exercise.name ||
              exercise.exercise?.name ||
              exercise.exerciseName ||
              'Unknown Exercise',
            order: index,
            notes: exercise.notes || null,
            exercise: exercise.exercise || {
              id: exercise.exerciseId || exercise.exercise_id || exercise.id,
              name:
                exercise.name || exercise.exerciseName || 'Unknown Exercise',
            },
            sets: (exercise.sets || []).map((set: any, setIndex: number) => ({
              setNumber: set.setNumber || set.set_number || setIndex + 1,
              reps: set.reps || null,
              weight: set.weight || null,
              durationSeconds:
                set.duration ||
                set.durationSeconds ||
                set.duration_seconds ||
                null,
              restSeconds:
                set.restTime || set.restSeconds || set.rest_seconds || null,
              completed: set.completed || false,
              notes: set.notes || null,
            })),
          }),
        );
      }

      console.log('Exercises to send:', exercisesToSend);

      const requestBody = {
        id: sessionId,
        userId: userId,
        // Use proper field names matching web app and backend expectations
        name: (sessionData as any).name || 'Workout Session',
        startedAt:
          (sessionData as any).started_at ||
          sessionData.startTime ||
          sessionData.createdAt ||
          new Date().toISOString(),
        completedAt: new Date().toISOString(), // This marks the session as completed
        completed: true, // Explicitly mark as completed for clarity
        exercises: exercisesToSend as any, // Use preserved exercises
        notes: sessionData.notes || null,
        rating: (sessionData as any).rating || null,
        createdAt:
          sessionData.createdAt ||
          (sessionData as any).created_at ||
          new Date().toISOString(),
        workoutPlanId:
          (sessionData as any).workout_plan_id || sessionData.workoutId || null,
        durationMinutes: (sessionData as any).duration_minutes || null,
      };

      console.log(
        'Request body for completion:',
        JSON.stringify(requestBody, null, 2),
      );
      console.log('Session ID being sent:', sessionId);
      console.log('User ID being sent:', userId);
      console.log(
        'Session name being sent:',
        (sessionData as any).name || 'Workout Session',
      );
      console.log(
        'Exercises being sent:',
        JSON.stringify(exercisesToSend, null, 2),
      );

      // Use the correct endpoint for updating/completing sessions
      const result = await this.apiFetch<WorkoutSession>(
        '/api/workouts/sessions',
        {
          method: 'PUT',
          body: JSON.stringify(requestBody),
        },
      );

      console.log('Completion API result:', result);
      return result;
    } catch (error) {
      console.error('Error in completeWorkoutSession:', error);
      throw error;
    }
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

  // AI Trainer methods with Lambda URL fallback
  async sendChatMessage(
    message: string,
    conversationId?: string,
  ): Promise<any> {
    return this.aiFetch<any>('/api/ai/chat', {
      method: 'POST',
      body: JSON.stringify({message, conversationId}),
    });
  }

  async getConversations(): Promise<any[]> {
    return this.aiFetch<any[]>('/api/ai/conversations');
  }

  async getConversation(conversationId: string): Promise<any> {
    return this.aiFetch<any>(`/api/ai/conversations/${conversationId}`);
  }

  async updateConversationTitle(
    conversationId: string,
    title: string,
  ): Promise<any> {
    console.log('API Client: updateConversationTitle called with:', {
      conversationId,
      title,
    });

    const result = await this.aiFetch<any>(
      `/api/ai/conversations/${conversationId}/title`,
      {
        method: 'PUT',
        body: JSON.stringify({title}),
      },
    );

    console.log('API Client: updateConversationTitle result:', result);
    return result;
  }

  async deleteConversation(conversationId: string): Promise<any> {
    return this.aiFetch<any>(`/api/ai/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async getRateLimit(): Promise<any> {
    return this.aiFetch<any>('/api/ai/rate-limit');
  }

  async generateWorkoutPlan(data: {
    goals: string[];
    duration: number;
    daysPerWeek: number;
    equipment: string[];
  }): Promise<any> {
    return this.aiFetch<any>('/api/ai/workout-plan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async generateMealPlan(data: {
    goals: string[];
    dietaryRestrictions: string[];
    duration: number;
  }): Promise<any> {
    return this.aiFetch<any>('/api/ai/meal-plan', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async analyzeProgress(): Promise<any> {
    return this.aiFetch<any>('/api/ai/progress/analyze', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  async submitPersonalizationFeedback(feedback: {
    type: string;
    rating: number;
    comments?: string;
  }): Promise<any> {
    return this.aiFetch<any>('/api/ai/personalization/feedback', {
      method: 'POST',
      body: JSON.stringify({feedback_data: feedback}),
    });
  }

  // AI-specific fetch method with Lambda URL fallback
  private async aiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
    console.log('API Client: aiFetch called with path:', path, 'init:', init);

    const authHeaders = await this.getAuthHeaders();
    const headers = {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(init.headers || {}),
    };

    console.log('API Client: aiFetch headers:', headers);

    const fetchOptions: RequestInit = {
      ...init,
      headers,
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
        lambdaFetchOptions,
      );
      const res = await fetch(`${lambdaUrl}${path}`, lambdaFetchOptions);

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(text || `Request failed: ${res.status}`);
      }

      return (await res.json()) as T;
    }
  }

  // Device token management
  async saveDeviceToken(token: string, platform: string = 'mobile') {
    const response = await this.fetch('/api/user-profiles/device-token', {
      method: 'POST',
      body: JSON.stringify({token, platform}),
    });
    return response.json();
  }

  async getDeviceTokens() {
    const response = await this.fetch('/api/user-profiles/device-tokens');
    return response.json();
  }

  async deleteDeviceToken(deviceId: string) {
    const response = await this.fetch(
      `/api/user-profiles/device-token/${deviceId}`,
      {
        method: 'DELETE',
      },
    );
    return response.json();
  }

  // Profile Image Upload
  async generateProfileImageUploadUrl(
    fileType: string = 'image/jpeg',
  ): Promise<{
    upload_url: string;
    key: string;
    bucket_name: string;
    expires_in: number;
  }> {
    return this.apiFetch('/api/user-profiles/profile/upload', {
      method: 'POST',
      body: JSON.stringify({file_type: fileType}),
    });
  }

  async updateProfileImage(imageKey: string): Promise<UserProfile> {
    return this.updateUserProfile({
      profileImageUrl: imageKey,
    });
  }

  // Progress Photos
  async getProgressPhotos(): Promise<any[]> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch(`/api/analytics/progress-photos/${userId}`);
  }

  async generateProgressPhotoUploadUrl(
    fileType: string = 'image/jpeg',
    notes?: string,
    weight?: number,
  ): Promise<{
    upload_url: string;
    photo_id: string;
    key: string;
  }> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch(`/api/analytics/progress-photos/${userId}/upload`, {
      method: 'POST',
      body: JSON.stringify({
        file_type: fileType,
        notes,
        weight,
      }),
    });
  }

  async updateProgressPhoto(
    photoId: string,
    updates: {notes?: string; weight?: number},
  ): Promise<any> {
    return this.apiFetch(`/api/analytics/progress-photos/${photoId}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    });
  }

  async deleteProgressPhoto(photoId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch(
      `/api/analytics/progress-photos/${userId}/${photoId}`,
      {
        method: 'DELETE',
      },
    );
  }

  async getProgressPhotoAnalytics(): Promise<any> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch(`/api/analytics/progress-photos/${userId}/analytics`);
  }

  async getProgressPhotoTimeline(): Promise<any[]> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch(`/api/analytics/progress-photos/${userId}/timeline`);
  }
}

export const apiClient = new ApiClient();
export default apiClient;
