import React, { createContext, useContext, useReducer, useEffect } from 'react';
import * as api from '../services/api';

// Types
export interface User {
  id: number;
  name: string;
  email: string;
  cuisine_preferences: string[];
  dietary_restrictions: Array<{
    type: 'religious' | 'medical' | 'ethical' | 'cultural';
    restriction: string;
    severity: 'strict' | 'moderate' | 'mild';
  }>;
  dosha: 'vata' | 'pitta' | 'kapha' | 'tridosha' | null;
  cultural_background: string;
  created_at: string;
  updated_at: string;
}

interface AuthState {
  user: User | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  isAuthenticated: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (userData: RegisterData) => Promise<void>;
  logout: () => void;
  updateProfile: (userData: Partial<User>) => Promise<void>;
  changePassword: (oldPassword: string, newPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  clearError: () => void;
}

interface RegisterData {
  name: string;
  email: string;
  password: string;
  cuisine_preferences: string[];
  dietary_restrictions: any[];
  dosha: string | null;
  cultural_background: string;
}

type AuthAction =
  | { type: 'LOGIN_START' }
  | { type: 'LOGIN_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'LOGIN_FAILURE'; payload: string }
  | { type: 'LOGOUT' }
  | { type: 'REGISTER_START' }
  | { type: 'REGISTER_SUCCESS'; payload: { user: User; token: string } }
  | { type: 'REGISTER_FAILURE'; payload: string }
  | { type: 'UPDATE_PROFILE_SUCCESS'; payload: User }
  | { type: 'SET_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

// Reducer
const authReducer = (state: AuthState, action: AuthAction): AuthState => {
  switch (action.type) {
    case 'LOGIN_START':
    case 'REGISTER_START':
      return { ...state, loading: true, error: null };

    case 'LOGIN_SUCCESS':
    case 'REGISTER_SUCCESS':
      return {
        ...state,
        loading: false,
        user: action.payload.user,
        token: action.payload.token,
        isAuthenticated: true,
        error: null,
      };

    case 'LOGIN_FAILURE':
    case 'REGISTER_FAILURE':
    case 'SET_ERROR':
      return {
        ...state,
        loading: false,
        error: action.payload,
        isAuthenticated: false,
        user: null,
        token: null,
      };

    case 'LOGOUT':
      return {
        ...state,
        user: null,
        token: null,
        isAuthenticated: false,
        error: null,
      };

    case 'UPDATE_PROFILE_SUCCESS':
      return {
        ...state,
        user: action.payload,
        error: null,
      };

    case 'CLEAR_ERROR':
      return {
        ...state,
        error: null,
      };

    default:
      return state;
  }
};

// Initial state
const initialState: AuthState = {
  user: null,
  token: localStorage.getItem('auth_token'),
  loading: true,
  error: null,
  isAuthenticated: false,
};

// Context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Provider
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(authReducer, initialState);

  // Initialize auth on mount
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('auth_token');
      if (token) {
        try {
          // Validate token and get user profile
          api.setAuthToken(token);
          const user = await api.getProfile();
          dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
        } catch (error) {
          console.error('Token validation failed:', error);
          localStorage.removeItem('auth_token');
          api.setAuthToken(null);
        }
      }
      dispatch({ type: 'CLEAR_ERROR' }); // Clear loading state
    };

    initAuth();
  }, []);

  // Actions
  const login = async (email: string, password: string) => {
    dispatch({ type: 'LOGIN_START' });
    try {
      const response = await api.login(email, password);
      const { user, token } = response;

      localStorage.setItem('auth_token', token);
      api.setAuthToken(token);

      dispatch({ type: 'LOGIN_SUCCESS', payload: { user, token } });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Login failed';
      dispatch({ type: 'LOGIN_FAILURE', payload: message });
      throw error;
    }
  };

  const register = async (userData: RegisterData) => {
    dispatch({ type: 'REGISTER_START' });
    try {
      const response = await api.register(userData);
      const { user, token } = response;

      localStorage.setItem('auth_token', token);
      api.setAuthToken(token);

      dispatch({ type: 'REGISTER_SUCCESS', payload: { user, token } });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Registration failed';
      dispatch({ type: 'REGISTER_FAILURE', payload: message });
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    api.setAuthToken(null);
    dispatch({ type: 'LOGOUT' });
  };

  const updateProfile = async (userData: Partial<User>) => {
    try {
      const updatedUser = await api.updateProfile(userData);
      dispatch({ type: 'UPDATE_PROFILE_SUCCESS', payload: updatedUser });
    } catch (error: any) {
      const message = error.response?.data?.error || 'Profile update failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const changePassword = async (oldPassword: string, newPassword: string) => {
    try {
      await api.changePassword(oldPassword, newPassword);
    } catch (error: any) {
      const message = error.response?.data?.error || 'Password change failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const deleteAccount = async () => {
    try {
      await api.deleteAccount();
      logout();
    } catch (error: any) {
      const message = error.response?.data?.error || 'Account deletion failed';
      dispatch({ type: 'SET_ERROR', payload: message });
      throw error;
    }
  };

  const clearError = () => {
    dispatch({ type: 'CLEAR_ERROR' });
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
    updateProfile,
    changePassword,
    deleteAccount,
    clearError,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};