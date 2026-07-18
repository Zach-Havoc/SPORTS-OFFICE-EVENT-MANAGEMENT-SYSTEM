import api from './api';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { User } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Service — Login, Logout, Token Management
// ─────────────────────────────────────────────────────────────────────────────

interface LoginResponse {
  token: string;
  user: User;
}

export const authService = {
  /**
   * POST /api/login
   * Authenticates a judge and stores the token + user locally.
   */
  async login(email: string, password: string): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/login', { email, password });
    const { token, user } = response.data;

    // Persist token and user profile for subsequent requests
    await storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
    await storage.setJSON(STORAGE_KEYS.AUTH_USER, user);

    return { token, user };
  },

  /**
   * POST /api/logout
   * Revokes the token on the server and clears local storage.
   */
  async logout(): Promise<void> {
    try {
      await api.post('/logout');
    } catch {
      // Even if the server call fails, clear locally
    }
    await storage.remove(STORAGE_KEYS.AUTH_TOKEN);
    await storage.remove(STORAGE_KEYS.AUTH_USER);
  },

  /**
   * GET /api/user
   * Refresh the current user profile from the server.
   */
  async getProfile(): Promise<User> {
    const response = await api.get<User>('/user');
    return response.data;
  },

  /**
   * Load cached user from AsyncStorage (no network call).
   */
  async loadStoredAuth(): Promise<{ token: string | null; user: User | null }> {
    const [token, user] = await Promise.all([
      storage.get(STORAGE_KEYS.AUTH_TOKEN),
      storage.getJSON<User>(STORAGE_KEYS.AUTH_USER),
    ]);
    return { token, user };
  },
};
