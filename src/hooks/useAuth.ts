import { useState, useEffect, createContext, useContext } from 'react';
import axios from 'axios';
import type { User, AuthResponse, LoginRequest, RegisterRequest } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (credentials: LoginRequest) => Promise<AuthResponse>;
  register: (userData: RegisterRequest) => Promise<AuthResponse>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const isAuthenticated = !!user && !!token;

  // Generate device ID if not exists
  const getDeviceId = (): string => {
    let deviceId = localStorage.getItem('device-id');
    if (!deviceId) {
      deviceId = `device-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      localStorage.setItem('device-id', deviceId);
    }
    return deviceId;
  };

  // Configure axios defaults
  const configureAxios = (authToken?: string) => {
    if (authToken) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${authToken}`;
      axios.defaults.headers.common['X-Device-ID'] = getDeviceId();
    } else {
      delete axios.defaults.headers.common['Authorization'];
      delete axios.defaults.headers.common['X-Device-ID'];
    }
  };

  // Load user from localStorage on mount
  useEffect(() => {
    const loadStoredAuth = () => {
      try {
        const storedToken = localStorage.getItem('auth-token');
        const storedUser = localStorage.getItem('auth-user');
        
        if (storedToken && storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setToken(storedToken);
          setUser(parsedUser);
          configureAxios(storedToken);
        }
      } catch (error) {
        console.error('Error loading stored auth:', error);
        clearAuthData();
      } finally {
        setIsLoading(false);
      }
    };

    loadStoredAuth();
  }, []);

  const saveAuthData = (authResponse: AuthResponse) => {
    setUser(authResponse.user);
    setToken(authResponse.token);
    localStorage.setItem('auth-token', authResponse.token);
    localStorage.setItem('auth-user', JSON.stringify(authResponse.user));
    configureAxios(authResponse.token);
  };

  const clearAuthData = () => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('auth-token');
    localStorage.removeItem('auth-user');
    configureAxios();
  };

  const login = async (credentials: LoginRequest): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      
      const response = await axios.post('/api/auth/login', credentials);
      
      if (response.data.success) {
        const authResponse: AuthResponse = response.data.data;
        saveAuthData(authResponse);
        return authResponse;
      } else {
        throw new Error(response.data.error || 'Error en el login');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Error en el login';
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (userData: RegisterRequest): Promise<AuthResponse> => {
    try {
      setIsLoading(true);
      
      const response = await axios.post('/api/auth/register', userData);
      
      if (response.data.success) {
        const authResponse: AuthResponse = response.data.data;
        saveAuthData(authResponse);
        return authResponse;
      } else {
        throw new Error(response.data.error || 'Error en el registro');
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Error en el registro';
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      if (token) {
        await axios.post('/api/auth/logout');
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      clearAuthData();
    }
  };

  const refreshUser = async (): Promise<void> => {
    try {
      if (!token) return;

      const response = await axios.get('/api/auth/me');
      
      if (response.data.success) {
        const updatedUser: User = response.data.data;
        setUser(updatedUser);
        localStorage.setItem('auth-user', JSON.stringify(updatedUser));
      }
    } catch (error) {
      console.error('Refresh user error:', error);
      // If refresh fails, clear auth data
      clearAuthData();
    }
  };

  return {
    user,
    token,
    isLoading,
    isAuthenticated,
    login,
    register,
    logout,
    refreshUser,
  };
} 