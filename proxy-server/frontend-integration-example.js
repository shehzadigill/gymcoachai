// Example: How to update your frontend API client to use the proxy server
// File: apps/web/src/lib/api-client.ts

// Determine the API base URL based on environment
const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    // Client-side: Use proxy in development, CloudFront in production
    return process.env.NODE_ENV === 'development'
      ? 'http://localhost:3001/api' // Proxy server
      : 'https://d12pveuxxq3vvn.cloudfront.net/api'; // CloudFront
  } else {
    // Server-side: Always use CloudFront
    return 'https://d12pveuxxq3vvn.cloudfront.net/api';
  }
};

const API_BASE_URL = getApiBaseUrl();

// Example API client function
export const apiFetch = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;

  console.log(`[API] ${options.method || 'GET'} ${url}`);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`[API ERROR] ${options.method || 'GET'} ${url}:`, error);
    throw error;
  }
};

// Example usage:
export const api = {
  // User profile endpoints
  async getUserProfile() {
    return apiFetch('/user-profiles/me');
  },

  async updateUserProfile(data) {
    return apiFetch('/user-profiles/me', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  // Workout endpoints
  async getWorkouts() {
    return apiFetch('/workouts');
  },

  async createWorkout(data) {
    return apiFetch('/workouts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  // Nutrition endpoints
  async getNutritionData() {
    return apiFetch('/nutrition');
  },

  // Analytics endpoints
  async getAnalytics() {
    return apiFetch('/analytics');
  },
};

// Environment configuration example
export const config = {
  apiBaseUrl: API_BASE_URL,
  isDevelopment: process.env.NODE_ENV === 'development',
  isProduction: process.env.NODE_ENV === 'production',
};

