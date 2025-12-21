'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { platformAuthApi, PlatformAdmin, ApiError } from './api';

interface AuthContextType {
  admin: PlatformAdmin | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const adminData = await platformAuthApi.getProfile();
      setAdmin(adminData);
    } catch (error) {
      if (error instanceof ApiError && error.status === 401) {
        router.push('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    const { admin: adminData } = await platformAuthApi.login(email, password);
    setAdmin(adminData);
    router.push('/');
  };

  const logout = async () => {
    try {
      await platformAuthApi.logout();
    } finally {
      setAdmin(null);
      router.push('/login');
    }
  };

  return (
    <AuthContext.Provider value={{ admin, loading, login, logout }}>
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
