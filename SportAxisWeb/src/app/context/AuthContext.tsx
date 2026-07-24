import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { login as apiLogin, logout as apiLogout, getAuthUser } from '../services/api';

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'coach' | 'athlete' | 'judge';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getSessionToken: () => string | null;
  sessionToken: string | null;
  refreshUser: () => Promise<void>;
  setUserName: (name: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const checkingUser = useRef(false);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    checkUser();
    return () => {
      mounted.current = false;
    };
  }, []);

  const checkUser = async () => {
    // Prevent concurrent checks
    if (checkingUser.current) return;
    
    checkingUser.current = true;
    
    try {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        if (mounted.current) setUser(null);
        return;
      }
      
      const userData = await getAuthUser();
      if (mounted.current) setUser(userData);
    } catch (error) {
      console.warn('Session invalid or network error:', error);
      if (mounted.current) setUser(null);
    } finally {
      if (mounted.current) setLoading(false);
      checkingUser.current = false;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      const response = await apiLogin(email, password);
      if (response.token) {
        localStorage.setItem('auth_token', response.token);
        setUser(response.user);
      } else {
        throw new Error('No token received from server');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Login failed');
    }
  };

  const logout = async () => {
    try {
      await apiLogout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('auth_token');
      setUser(null);
    }
  };

  const getSessionToken = () => {
    return localStorage.getItem('auth_token');
  };

  const refreshUser = async () => {
    await checkUser();
  };

  const setUserName = (name: string) => {
    setUser(prev => prev ? { ...prev, name } : prev);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, getSessionToken, sessionToken: localStorage.getItem('auth_token'), refreshUser, setUserName }}>
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