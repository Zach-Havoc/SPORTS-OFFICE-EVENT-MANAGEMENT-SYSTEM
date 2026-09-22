import api from './api';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { SignupPayload, User } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Service — Login, Signup, Password Reset/Change, Profile, Token Management
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
   * POST /api/signup
   * Registration-code + (for athletes) SR-code verified account creation.
   * Returns the same shape as login and logs the new account straight in.
   */
  async signup(payload: SignupPayload): Promise<LoginResponse> {
    const response = await api.post<LoginResponse>('/signup', payload);
    const { token, user } = response.data;

    await storage.set(STORAGE_KEYS.AUTH_TOKEN, token);
    await storage.setJSON(STORAGE_KEYS.AUTH_USER, user);

    return { token, user };
  },

  /**
   * POST /api/reset-password
   * Public, email-only. The backend always returns a generic success message
   * (it never reveals whether the email exists) and, if it does, mails a
   * temporary password.
   */
  async resetPassword(email: string): Promise<{ message: string }> {
    const response = await api.post<{ message: string }>('/reset-password', { email });
    return response.data;
  },

  /**
   * PUT /api/account/profile
   * Authenticated self-service profile edit; updates the locally cached user too.
   */
  async updateProfile(patch: {
    name?: string;
    yearLevel?: string | null;
    course?: string | null;
    phone?: string | null;
    emergencyContact?: Record<string, unknown> | null;
  }): Promise<User> {
    const response = await api.put<{ user: User }>('/account/profile', patch);
    const user = response.data.user;
    await storage.setJSON(STORAGE_KEYS.AUTH_USER, user);
    return user;
  },

  /**
   * PUT /api/account/password
   * Authenticated password change — requires the current password.
   */
  async updatePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
    const response = await api.put<{ message: string }>('/account/password', {
      currentPassword,
      newPassword,
    });
    return response.data;
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
