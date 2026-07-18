import { create } from 'zustand';
import { authService } from '../services/auth.service';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { User } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Store — Manages judge authentication state
// ─────────────────────────────────────────────────────────────────────────────

interface AuthStore {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;          // Load from AsyncStorage on app start
}

export const useAuthStore = create<AuthStore>((set, get) => ({
  user:        null,
  token:       null,
  isLoading:   false,
  isHydrated:  false,

  /**
   * Hydrate auth state from persistent storage.
   * Called once on app start before rendering any screens.
   */
  hydrate: async () => {
    const { token, user } = await authService.loadStoredAuth();
    set({ token, user, isHydrated: true });
  },

  /**
   * Login with email and password.
   * Stores token and user in state + AsyncStorage.
   */
  login: async (email, password) => {
    set({ isLoading: true });
    try {
      const { token, user } = await authService.login(email, password);
      set({ token, user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /**
   * Logout the current judge.
   * Clears token from server, state, and storage.
   */
  logout: async () => {
    set({ isLoading: true });
    try {
      await authService.logout();
    } finally {
      set({ user: null, token: null, isLoading: false });
    }
  },
}));
