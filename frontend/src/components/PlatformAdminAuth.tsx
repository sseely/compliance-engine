/**
 * Platform Admin Authentication Component
 * Handles login/logout for platform admin dashboard access
 */

'use client';

import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { oidcVerificationAPI } from '@/services/oidc-verification-api';

interface PlatformAdmin {
  id: string;
  email: string;
  name: string;
  is_active: boolean;
  permissions: string[];
  last_login_at?: string;
  created_at: string;
  updated_at: string;
}

interface AuthContextType {
  admin: PlatformAdmin | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => Promise<void>;
  error: string | null;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function usePlatformAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('usePlatformAuth must be used within PlatformAuthProvider');
  }
  return context;
}

interface PlatformAuthProviderProps {
  children: ReactNode;
}

export function PlatformAuthProvider({ children }: PlatformAuthProviderProps) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkExistingSession();
  }, []);

  const checkExistingSession = async () => {
    try {
      const token = localStorage.getItem('platform_admin_token');
      if (token) {
        oidcVerificationAPI.setAuthToken(token);
        const response = await oidcVerificationAPI.getCurrentAdmin();
        setAdmin(response.admin);
      }
    } catch (err) {
      console.error('Session check failed:', err);
      localStorage.removeItem('platform_admin_token');
      oidcVerificationAPI.clearAuthToken();
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await oidcVerificationAPI.loginPlatformAdmin(email, password);
      
      if (response.success) {
        localStorage.setItem('platform_admin_token', response.session_token);
        oidcVerificationAPI.setAuthToken(response.session_token);
        setAdmin(response.admin);
        return true;
      } else {
        setError('Login failed');
        return false;
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    
    try {
      await oidcVerificationAPI.logoutPlatformAdmin();
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('platform_admin_token');
      oidcVerificationAPI.clearAuthToken();
      setAdmin(null);
      setIsLoading(false);
    }
  };

  const value: AuthContextType = {
    admin,
    isAuthenticated: !!admin,
    isLoading,
    login,
    logout,
    error,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

interface LoginFormProps {
  onSuccess?: () => void;
}

export function PlatformAdminLoginForm({ onSuccess }: LoginFormProps) {
  const { login, error, isLoading } = usePlatformAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const success = await login(email, password);
    if (success && onSuccess) {
      onSuccess();
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Platform Admin Login
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sign in to access the OIDC verification dashboard
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          <div className="rounded-md shadow-sm -space-y-px">
            <div>
              <label htmlFor="email" className="sr-only">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Email address"
              />
            </div>
            <div>
              <label htmlFor="password" className="sr-only">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                placeholder="Password"
              />
            </div>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <button
              type="submit"
              disabled={isLoading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <span className="flex items-center">
                  <div className="license-verification-spinner mr-2"></div>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </div>

          <div className="text-center">
            <p className="text-sm text-gray-600">
              Development credentials: admin@compliance-engine.dev / admin123
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

interface AuthGuardProps {
  children: ReactNode;
  fallback?: ReactNode;
}

export function PlatformAdminAuthGuard({ children, fallback }: AuthGuardProps) {
  const { isAuthenticated, isLoading } = usePlatformAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center">
          <div className="license-verification-spinner mr-3"></div>
          <span>Loading...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return fallback || <PlatformAdminLoginForm />;
  }

  return <>{children}</>;
}

export function PlatformAdminHeader() {
  const { admin, logout } = usePlatformAuth();

  if (!admin) return null;

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3">
      <div className="max-w-7xl mx-auto flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-lg font-semibold text-gray-900">
            Platform Admin Dashboard
          </h1>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-sm">
            <span className="text-gray-500">Signed in as:</span>
            <span className="ml-1 font-medium text-gray-900">{admin.name}</span>
            <span className="ml-1 text-gray-500">({admin.email})</span>
          </div>
          
          <button
            onClick={logout}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}