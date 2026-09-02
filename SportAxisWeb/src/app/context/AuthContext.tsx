import { createContext, useContext, useState, useEffect, ReactNode, useRef, useCallback } from 'react';
import { login as apiLogin, logout as apiLogout, getAuthUser } from '../services/api';

// 5 minutes in milliseconds
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

function useInactivityTimeout(onTimeout: () => void, isActive: boolean) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const resetTimer = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (isActive) {
      timeoutRef.current = setTimeout(() => {
        onTimeout();
      }, INACTIVITY_TIMEOUT_MS);
    }
  }, [isActive, onTimeout]);

  useEffect(() => {
    if (!isActive) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      return;
    }

    const events = ['mousemove', 'keydown', 'scroll', 'touchstart', 'click'];
    
    // Initial setup
    resetTimer();

    const handleActivity = () => {
      resetTimer();
    };

    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [isActive, resetTimer]);
}

interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'coach' | 'athlete' | 'judge';
  department?: string | null;
  sport?: string | null;          // primary sport (back-compat)
  sports?: string[] | null;       // full list of sports a coach handles
  genderCategory?: string | null;
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

  useInactivityTimeout(() => {
    console.log('User inactive for 5 minutes. Logging out.');
    logout();
  }, !!user);

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