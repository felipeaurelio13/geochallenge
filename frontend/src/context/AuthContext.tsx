import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import type { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
  devLogin: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Development user for bypass login
const DEV_USER: User = {
  id: 'dev-user-id',
  username: 'DevPlayer',
  email: 'dev@geochallenge.com',
  preferredLanguage: 'es',
  highScore: 0,
  gamesPlayed: 0,
  wins: 0,
  losses: 0,
  createdAt: new Date().toISOString(),
};

// Check if dev mode is enabled via URL param or localStorage
const isDevMode = () => {
  if (typeof window === 'undefined') return false;
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get('dev') === 'true' || localStorage.getItem('devMode') === 'true';
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    token: localStorage.getItem('token'),
    isLoading: true,
    isAuthenticated: false,
  });

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      // Check for dev mode first
      if (isDevMode()) {
        console.log('🔧 Dev mode enabled - bypassing authentication');
        localStorage.setItem('devMode', 'true');
        setState({
          user: DEV_USER,
          token: 'dev-token',
          isLoading: false,
          isAuthenticated: true,
        });
        return;
      }

      const token = localStorage.getItem('token');
      if (!token) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const user = await api.getMe();
        setState({
          user,
          token,
          isLoading: false,
          isAuthenticated: true,
        });

        // Connect socket
        await socketService.connect(token);
      } catch (error) {
        localStorage.removeItem('token');
        setState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    checkAuth();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const response = await api.login({ email, password });

    localStorage.setItem('token', response.token);
    setState({
      user: response.user,
      token: response.token,
      isLoading: false,
      isAuthenticated: true,
    });

    // Connect socket
    await socketService.connect(response.token);
  }, []);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const response = await api.register({ username, email, password });

    localStorage.setItem('token', response.token);
    setState({
      user: response.user,
      token: response.token,
      isLoading: false,
      isAuthenticated: true,
    });

    // Connect socket
    await socketService.connect(response.token);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('devMode');
    socketService.disconnect();
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
    // Remove dev param from URL
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      url.searchParams.delete('dev');
      window.history.replaceState({}, '', url.toString());
    }
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setState((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...data } : null,
    }));
  }, []);

  // Dev login function for manual activation
  const devLogin = useCallback(() => {
    console.log('🔧 Dev login activated');
    localStorage.setItem('devMode', 'true');
    setState({
      user: DEV_USER,
      token: 'dev-token',
      isLoading: false,
      isAuthenticated: true,
    });
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        updateUser,
        devLogin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
