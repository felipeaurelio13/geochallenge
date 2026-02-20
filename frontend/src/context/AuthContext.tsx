import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useLocalStorage } from '../hooks';
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

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useLocalStorage<string | null>('token', null, {
    parse: (value) => value || null,
    stringify: (value) => value ?? '',
  });

  const [state, setState] = useState<AuthState>({
    user: null,
    token,
    isLoading: true,
    isAuthenticated: false,
  });

  // Check if user is already logged in
  useEffect(() => {
    const checkAuth = async () => {
      const shouldUseBypass = testAuthBypass.isEnabled && testAuthBypass.isConfigured;
      const authToken = token;

      if (!authToken && !shouldUseBypass) {
        setState((prev) => ({ ...prev, isLoading: false }));
        return;
      }

      try {
        const user = await api.getMe();
        setState({
          user,
          token: authToken,
          isLoading: false,
          isAuthenticated: true,
        });

        // Connect socket
        if (authToken) {
          await socketService.connect(authToken);
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

        setToken(null);
        setState({
          user: null,
          token: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    checkAuth();
  }, [setToken, token]);

  const login = useCallback(async (email: string, password: string) => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const response = await api.login({ email: normalizeEmail(email), password });

      setToken(response.token);
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
  }, [setToken]);

  const register = useCallback(async (username: string, email: string, password: string) => {
    const response = await api.register({ username: username.trim(), email: normalizeEmail(email), password });

    setToken(response.token);
    setState({
      user: response.user,
      token: response.token,
      isLoading: false,
      isAuthenticated: true,
    });

    // Connect socket
    await socketService.connect(response.token);
  }, [setToken]);

  const logout = useCallback(() => {
    setToken(null);
    socketService.disconnect();
    setState({
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,
    });
  }, [setToken]);

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
