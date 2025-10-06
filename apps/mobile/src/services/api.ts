import AsyncStorage from '@react-native-async-storage/async-storage';
import { Amplify } from 'aws-amplify';
import { fetchAuthSession, getCurrentUser } from 'aws-amplify/auth';
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

// Configure Amplify (this should match your web app configuration)
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'eu-north-1_s19fcM8z5', // Replace with your actual user pool ID
      userPoolClientId: '61b7oqg3cp3fh0btl5k83sjjgd', // Replace with your actual client ID
      loginWith: {
        email: true,
        username: true,
      },
    },
  },
});

const baseUrl = 'https://d3ikkoagog42nh.cloudfront.net'; // Replace with your actual CloudFront URL

class ApiClient {
  private async isDemoMode(): Promise<boolean> {
    // For real implementation, we should check if user is properly authenticated
    // Return false to use real AWS APIs
    return false;
  }

  private async getAuthHeaders(): Promise<Record<string, string>> {
    try {
      const session = await fetchAuthSession();
      const token =
        session.tokens?.idToken?.toString() ||
        session.tokens?.accessToken?.toString();

      if (token) {
        return {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        };
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
      const user = await getCurrentUser();
      return user.userId;
    } catch (error) {
      console.error('Failed to get current user ID:', error);
      // Fallback to demo user ID
      return 'demo-user-1';
    }
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

  private async apiFetch<T>(
    path: string,
    options: RequestInit = {}
  ): Promise<T> {
    const isDemo = await this.isDemoMode();
    if (isDemo) {
      // Return mock data for demo mode
      console.log(`Demo mode: Mocking API call to ${path}`);

      // Simulate network delay
      await new Promise((resolve) => setTimeout(resolve, 300));

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
          dailyGoals: { calories: 2000, protein: 150, carbs: 200, fat: 65 },
          consumed: { calories: 1200, protein: 80, carbs: 100, fat: 40 },
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
      const response = await fetch(`${baseUrl}${path}`, {
        ...options,
        headers: {
          ...headers,
          ...options.headers,
        },
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
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
      const user = await getCurrentUser();
      return {
        id: user.userId,
        email: user.signInDetails?.loginId || '',
      };
    } catch (error) {
      return null;
    }
  }

  // User Profile methods
  async getUserProfile(userId?: string): Promise<UserProfile> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<UserProfile>(`/api/user-profiles/${id}`);
  }

  async createUserProfile(data: Partial<UserProfile>): Promise<UserProfile> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<UserProfile>('/api/user-profiles', {
      method: 'POST',
      body: JSON.stringify({ ...data, userId }),
    });
  }

  async updateUserProfile(
    data: Partial<UserProfile>,
    userId?: string
  ): Promise<UserProfile> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<UserProfile>(`/api/user-profiles/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Analytics methods
  async getStrengthProgress(
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<StrengthProgress[]> {
    const id = userId || (await this.getCurrentUserId());
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiFetch<StrengthProgress[]>(
      `/api/analytics/strength-progress/${id}${query}`
    );
  }

  async createStrengthProgress(
    data: Partial<StrengthProgress>
  ): Promise<StrengthProgress> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<StrengthProgress>('/api/analytics/strength-progress', {
      method: 'POST',
      body: JSON.stringify({ ...data, userId }),
    });
  }

  async getBodyMeasurements(
    userId?: string,
    startDate?: string,
    endDate?: string
  ): Promise<BodyMeasurement[]> {
    const id = userId || (await this.getCurrentUserId());
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const query = params.toString() ? `?${params.toString()}` : '';
    return this.apiFetch<BodyMeasurement[]>(
      `/api/analytics/body-measurements/${id}${query}`
    );
  }

  async createBodyMeasurement(
    data: Partial<BodyMeasurement>
  ): Promise<BodyMeasurement> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<BodyMeasurement>('/api/analytics/body-measurements', {
      method: 'POST',
      body: JSON.stringify({ ...data, userId }),
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
      body: JSON.stringify({ ...data, userId }),
    });
  }

  async getAchievements(userId?: string): Promise<Achievement[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<Achievement[]>(`/api/analytics/achievements/${id}`);
  }

  // Workout methods
  async getWorkouts(userId?: string): Promise<Workout[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<Workout[]>(`/api/workouts/plans?userId=${id}`);
  }

  async createWorkout(data: Partial<Workout>): Promise<Workout> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<Workout>('/api/workouts/plans', {
      method: 'POST',
      body: JSON.stringify({ ...data, userId }),
    });
  }

  async getWorkoutSessions(userId?: string): Promise<WorkoutSession[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<WorkoutSession[]>(
      `/api/workouts/sessions?userId=${id}`
    );
  }

  async createWorkoutSession(
    data: Partial<WorkoutSession>
  ): Promise<WorkoutSession> {
    const userId = await this.getCurrentUserId();
    return this.apiFetch<WorkoutSession>('/api/workouts/sessions', {
      method: 'POST',
      body: JSON.stringify({ ...data, userId }),
    });
  }

  async updateWorkoutSession(
    sessionId: string,
    data: Partial<WorkoutSession>
  ): Promise<WorkoutSession> {
    return this.apiFetch<WorkoutSession>(
      `/api/workouts/sessions/${sessionId}`,
      {
        method: 'PUT',
        body: JSON.stringify(data),
      }
    );
  }

  async completeWorkoutSession(sessionId: string): Promise<WorkoutSession> {
    return this.apiFetch<WorkoutSession>(
      `/api/workouts/sessions/${sessionId}/complete`,
      {
        method: 'POST',
      }
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

  async searchFoods(query: string, cursor?: string): Promise<any> {
    const params = new URLSearchParams({ q: query });
    if (cursor) params.append('cursor', cursor);
    return this.apiFetch<any>(
      `/api/nutrition/foods/search?${params.toString()}`
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
      body: JSON.stringify({ glasses }),
    });
  }

  // Scheduling methods
  async scheduleWorkoutPlan(
    planId: string,
    schedule: {
      startDate: string;
      times: string[];
      userId?: string;
    }
  ): Promise<any> {
    const userId = schedule.userId || (await this.getCurrentUserId());
    return this.apiFetch<any>('/api/workouts/schedule', {
      method: 'POST',
      body: JSON.stringify({ planId, ...schedule, userId }),
    });
  }

  async getScheduledWorkouts(userId?: string): Promise<any[]> {
    const id = userId || (await this.getCurrentUserId());
    return this.apiFetch<any[]>(`/api/workouts/schedule?userId=${id}`);
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
