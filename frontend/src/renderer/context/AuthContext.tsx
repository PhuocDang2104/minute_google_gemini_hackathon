/**
 * Authentication Context
 */
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CurrentUser,
  getStoredUser,
  getAccessToken,
  clearAuth,
  storeUser,
  login as apiLogin,
  logout as apiLogout,
  getCurrentUser,
  UserLogin
} from '../lib/api/auth';

interface AuthContextType {
  user: CurrentUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (data: UserLogin) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Check for existing auth on mount
    initAuth();
  }, []);

  const initAuth = async () => {
    try {
      const token = getAccessToken();
      if (token) {
        // Try to get user from storage first
        const storedUser = getStoredUser();
        if (storedUser) {
          setUser(storedUser);
        }
        
        // Then try to refresh from API
        try {
          const freshUser = await getCurrentUser();
          setUser(freshUser);
          storeUser(freshUser);
        } catch {
          // Token might be expired, clear auth
          clearAuth();
          setUser(null);
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (data: UserLogin) => {
    await apiLogin(data);
    const user = await getCurrentUser();
    setUser(user);
    storeUser(user);
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
  };

  const refreshUser = async () => {
    try {
      const user = await getCurrentUser();
      setUser(user);
      storeUser(user);
    } catch {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

/**
 * Protected Route wrapper
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login');
    }
  }, [isAuthenticated, isLoading, navigate]);

  if (isLoading) {
    return (
      <div className="loading-screen">
        <div className="loading-spinner"></div>
        <p>Đang tải...</p>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return <>{children}</>;
}

