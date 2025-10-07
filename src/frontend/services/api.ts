import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { User, Recipe, MealPlan, ShoppingList, ProductCatalogItem, CulturalRule } from '../../types';

// API Configuration
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:3000/api/v1';

// Cache configuration
const CACHE_PREFIX = 'cd_cache_';
const CACHE_EXPIRY_MS = 30 * 60 * 1000; // 30 minutes

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    total_pages: number;
  };
}

interface CacheItem<T> {
  data: T;
  timestamp: number;
}

// Create axios instance
const createApiClient = (): AxiosInstance => {
  const client = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor for auth token
  client.interceptors.request.use(
    (config) => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
      return config;
    },
    (error) => Promise.reject(error)
  );

  // Response interceptor for error handling
  client.interceptors.response.use(
    (response) => response,
    (error) => {
      // Handle auth errors
      if (error.response?.status === 401) {
        localStorage.removeItem('auth_token');
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
  );

  return client;
};

const apiClient = createApiClient();

// Cache utilities
const getCacheKey = (endpoint: string, params?: any): string => {
  const paramsStr = params ? JSON.stringify(params) : '';
  return `${CACHE_PREFIX}${endpoint}_${paramsStr}`;
};

const getCachedData = <T>(key: string): T | null => {
  try {
    const cached = localStorage.getItem(key);
    if (!cached) return null;

    const item: CacheItem<T> = JSON.parse(cached);
    if (Date.now() - item.timestamp > CACHE_EXPIRY_MS) {
      localStorage.removeItem(key);
      return null;
    }

    return item.data;
  } catch {
    return null;
  }
};

const setCachedData = <T>(key: string, data: T): void => {
  try {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
    };
    localStorage.setItem(key, JSON.stringify(item));
  } catch (error) {
    console.warn('Failed to cache data:', error);
  }
};

// Generic API request with caching
const request = async <T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  data?: any,
  useCache = false
): Promise<T> => {
  const cacheKey = getCacheKey(endpoint, data);

  if (method === 'GET' && useCache) {
    const cached = getCachedData<T>(cacheKey);
    if (cached) {
      console.log(`Using cached data for ${endpoint}`);
      return cached;
    }
  }

  try {
    const response: AxiosResponse<ApiResponse<T>> = await apiClient.request({
      method,
      url: endpoint,
      data,
    });

    const result = response.data;

    if (!result.success || !result.data) {
      throw new Error(result.error || 'API request failed');
    }

    if (method === 'GET' && useCache) {
      setCachedData(cacheKey, result.data);
    }

    return result.data;
  } catch (error: any) {
    throw error.response?.data?.error || error.message || 'API request failed';
  }
};

// Authentication
export const login = async (email: string, password: string): Promise<{ user: User; token: string }> => {
  return request('POST', '/auth/login', { email, password });
};

export const register = async (userData: any): Promise<{ user: User; token: string }> => {
  return request('POST', '/auth/register', userData);
};

export const refreshToken = async (): Promise<{ token: string }> => {
  return request('POST', '/auth/refresh');
};

export const setAuthToken = (token: string | null): void => {
  if (token) {
    localStorage.setItem('auth_token', token);
  } else {
    localStorage.removeItem('auth_token');
  }
};

// User Profile
export const getProfile = async (): Promise<User> => {
  return request('GET', '/users/profile');
};

export const updateProfile = async (userData: Partial<User>): Promise<User> => {
  return request('PUT', '/users/profile', userData);
};

export const changePassword = async (oldPassword: string, newPassword: string): Promise<void> => {
  return request('POST', '/users/change-password', { oldPassword, newPassword });
};

export const deleteAccount = async (): Promise<void> => {
  return request('DELETE', '/users/account');
};

// Recipes
export const searchRecipes = async (params?: {
  query?: string;
  cuisine?: string;
  dietary_restrictions?: string[];
  max_prep_time?: number;
  page?: number;
  limit?: number;
}): Promise<{ recipes: Recipe[]; pagination: any }> => {
  return request('GET', '/recipes', params, true);
};

export const getRecipeById = async (id: number): Promise<Recipe> => {
  return request('GET', `/recipes/${id}`, undefined, true);
};

export const getFavoriteRecipes = async (): Promise<Recipe[]> => {
  return request('GET', '/recipes/favorites', undefined, true);
};

export const addToFavorites = async (recipeId: number): Promise<void> => {
  return request('POST', `/recipes/${recipeId}/favorite`);
};

export const removeFromFavorites = async (recipeId: number): Promise<void> => {
  return request('DELETE', `/recipes/${recipeId}/favorite`);
};

export const rateRecipe = async (recipeId: number, rating: number, review?: string): Promise<void> => {
  return request('POST', `/recipes/${recipeId}/rate`, { rating, review });
};

// Meal Plans
export const generateMealPlan = async (params: {
  start_date: string;
  end_date: string;
  meal_preferences: {
    breakfast: boolean;
    lunch: boolean;
    dinner: boolean;
    snack: boolean;
  };
  cuisine_preferences?: string[];
  avoid_ingredients?: string[];
  max_prep_time?: number;
}): Promise<MealPlan[]> => {
  return request('POST', '/meal-plans/generate', params);
};

export const getMealPlans = async (params?: {
  start_date?: string;
  end_date?: string;
  page?: number;
  limit?: number;
}): Promise<{ mealPlans: MealPlan[]; pagination: any }> => {
  return request('GET', '/meal-plans', params, true);
};

export const getMealPlanByDate = async (date: string): Promise<MealPlan> => {
  return request('GET', `/meal-plans/${date}`, undefined, true);
};

export const updateMeal = async (date: string, mealType: string, recipeId: number, servings: number): Promise<MealPlan> => {
  return request('PUT', `/meal-plans/${date}`, { meal_type: mealType, recipe_id: recipeId, servings });
};

export const deleteMealPlan = async (date: string): Promise<void> => {
  return request('DELETE', `/meal-plans/${date}`);
};

export const getMealPlanStats = async (): Promise<any> => {
  return request('GET', '/meal-plans/stats', undefined, true);
};

// Shopping Lists
export const createShoppingList = async (name: string, items?: any[]): Promise<ShoppingList> => {
  return request('POST', '/shopping-lists', { name, items });
};

export const getShoppingLists = async (params?: {
  page?: number;
  limit?: number;
}): Promise<{ shoppingLists: ShoppingList[]; pagination: any }> => {
  return request('GET', '/shopping-lists', params, true);
};

export const getShoppingListById = async (id: number): Promise<ShoppingList> => {
  return request('GET', `/shopping-lists/${id}`, undefined, true);
};

export const updateShoppingList = async (id: number, updates: Partial<ShoppingList>): Promise<ShoppingList> => {
  return request('PUT', `/shopping-lists/${id}`, updates);
};

export const addToList = async (listId: number, productSku: string, quantity: number): Promise<void> => {
  return request('POST', `/shopping-lists/${listId}/items`, { product_sku: productSku, quantity });
};

export const removeFromList = async (listId: number, itemId: number): Promise<void> => {
  return request('DELETE', `/shopping-lists/${listId}/items/${itemId}`);
};

export const updateItemStatus = async (listId: number, itemId: number, purchased: boolean): Promise<void> => {
  return request('PATCH', `/shopping-lists/${listId}/items/${itemId}`, { purchased });
};

export const generateFromMealPlan = async (params: {
  start_date: string;
  end_date: string;
  name?: string;
}): Promise<ShoppingList> => {
  return request('POST', '/shopping-lists/from-meal-plan', params);
};

export const deleteShoppingList = async (id: number): Promise<void> => {
  return request('DELETE', `/shopping-lists/${id}`);
};

export const getShoppingStats = async (): Promise<any> => {
  return request('GET', '/shopping-lists/stats', undefined, true);
};

// Product Catalog
export const searchProducts = async (params?: {
  query?: string;
  retailer?: string;
  category?: string;
  dietary_certifications?: string[];
  cultural_tags?: string[];
  page?: number;
  limit?: number;
}): Promise<{ products: ProductCatalogItem[]; pagination: any }> => {
  return request('GET', '/products', params, true);
};

export const getRetailers = async (): Promise<string[]> => {
  return request('GET', '/products/retailers', undefined, true);
};

export const getCategories = async (): Promise<string[]> => {
  return request('GET', '/products/categories', undefined, true);
};

export const getBrands = async (): Promise<string[]> => {
  return request('GET', '/products/brands', undefined, true);
};

export const getProduct = async (retailer: string, sku: string): Promise<ProductCatalogItem> => {
  return request('GET', `/products/${retailer}/${sku}`, undefined, true);
};

export const priceComparison = async (productSkus: string[]): Promise<any> => {
  return request('POST', '/products/price-comparison', { product_skus: productSkus }, true);
};

// Cultural Rules
export const getAllRules = async (): Promise<CulturalRule[]> => {
  return request('GET', '/cultural-rules', undefined, true);
};

export const getForbiddenIngredients = async (): Promise<string[]> => {
  return request('GET', '/cultural-rules/forbidden-ingredients', undefined, true);
};

export const validateRecipe = async (recipeId: number): Promise<any> => {
  return request('POST', `/cultural-rules/validate-recipe/${recipeId}`);
};

export const validateIngredient = async (ingredient: string): Promise<any> => {
  return request('POST', '/cultural-rules/validate-ingredient', { ingredient });
};

export const getSubstitutions = async (): Promise<any[]> => {
  return request('GET', '/cultural-rules/substitutions', undefined, true);
};

export const getAyurvedicRecommendations = async (): Promise<any> => {
  return request('GET', '/cultural-rules/ayurvedic-recommendations', undefined, true);
};

export const getHinduDietaryGuidance = async (): Promise<any> => {
  return request('GET', '/cultural-rules/hindu-dietary-guidance', undefined, true);
};

// Health Check
export const healthCheck = async (): Promise<any> => {
  try {
    const response = await apiClient.get('/../health');
    return response.data;
  } catch (error) {
    throw new Error('Health check failed');
  }
};

// Cache management
export const clearCache = async (): Promise<void> => {
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      localStorage.removeItem(key);
    }
  });
};

export const getCacheSize = (): number => {
  let size = 0;
  const keys = Object.keys(localStorage);
  keys.forEach(key => {
    if (key.startsWith(CACHE_PREFIX)) {
      size += localStorage.getItem(key)?.length || 0;
    }
  });
  return size;
};

// Offline fallback
export const isOnline = (): boolean => navigator.onLine;

export const waitForConnection = (timeout = 5000): Promise<void> => {
  return new Promise((resolve, reject) => {
    if (navigator.onLine) {
      resolve();
      return;
    }

    const handleOnline = () => {
      window.removeEventListener('online', handleOnline);
      clearTimeout(timeoutId);
      resolve();
    };

    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', handleOnline);
      reject(new Error('Connection timeout'));
    }, timeout);

    window.addEventListener('online', handleOnline);
  });
};