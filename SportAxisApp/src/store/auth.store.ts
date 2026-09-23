import { create } from 'zustand';
import { authService } from '../services/auth.service';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { SignupPayload, User } from '../types';

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
  signup: (payload: SignupPayload) => Promise<void>;
  logout: () => Promise<void>;
  forceLogout: () => Promise<void>;      // Local-only wipe (e.g. after a 401)
  hydrate: () => Promise<void>;          // Load from AsyncStorage on app start
  setUser: (user: User) => void;         // Sync store after a profile edit
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
    // A token with no matching user means the two fell out of sync (e.g. the
    // user record failed to persist while the token did) — that half-logged-in
    // state would otherwise sail past the app layout's token-only guard and
    // crash the first screen that reads `user.role`/`user.name`. Treat it as
    // signed out rather than as a subtly broken session.
    if (token && !user) {
      await Promise.all([
        storage.remove(STORAGE_KEYS.AUTH_TOKEN),
        storage.remove(STORAGE_KEYS.AUTH_USER),
      ]);
      set({ token: null, user: null, isHydrated: true });
      return;
    }
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
   * Create a new account (registration-code verified) and log straight in.
   */
  signup: async (payload) => {
    set({ isLoading: true });
    try {
      const { token, user } = await authService.signup(payload);
      set({ token, user, isLoading: false });
    } catch (error) {
      set({ isLoading: false });
      throw error;
    }
  },

  /** Sync the store (and its persisted copy) after a profile edit. */
  setUser: (user) => set({ user }),

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

  /**
   * Clear auth state without calling the server — used when the token is
   * already known to be invalid (a 401 on an authenticated request). The
   * app layout redirects to the login screen once `token` is null.
   */
  forceLogout: async () => {
    await Promise.all([
      storage.remove(STORAGE_KEYS.AUTH_TOKEN),
      storage.remove(STORAGE_KEYS.AUTH_USER),
    ]);
    set({ user: null, token: null, isLoading: false });
  },
}));
