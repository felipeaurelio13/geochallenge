import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { socketService } from '../services/socket';
import { testAuthBypass, buildTestBypassUser } from '../utils/testAuthBypass';
import type { User, AuthState } from '../types';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (data: Partial<User>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

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
      const token = localStorage.getItem('token');
      const shouldUseBypass = testAuthBypass.isEnabled && testAuthBypass.isConfigured;

      if (!token && !shouldUseBypass) {
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
        if (token) {
          await socketService.connect(token);
        }
      } catch (error) {
        if (shouldUseBypass) {
          setState({
            user: buildTestBypassUser(),
            token: null,
            isLoading: false,
            isAuthenticated: true,
          });
          return;
        }

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
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await api.login({ email, password });

      localStorage.setItem('token', response.token);
      setState({
        user: response.user,
        token: response.token,
        isLoading: false,
        isAuthenticated: true,
      });

      // Connect socket in background to avoid blocking login UX.
      socketService.connect(response.token);
    } catch (error) {
      setState((prev) => ({ ...prev, isLoading: false }));
      throw error;
    }
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
    socketService.disconnect();
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, []);

  const updateUser = useCallback((data: Partial<User>) => {
    setState((prev) => ({
      ...prev,
      user: prev.user ? { ...prev.user, ...data } : null,
    }));
  }, []);

  return (
    <AuthContext.Provider
      value={{
        ...state,
        login,
        register,
        logout,
        updateUser,
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
