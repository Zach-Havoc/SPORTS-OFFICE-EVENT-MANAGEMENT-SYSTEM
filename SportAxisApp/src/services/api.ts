import axios from 'axios';
import { API_CONFIG } from '../config/api.config';
import { storage, STORAGE_KEYS } from '../storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Axios API Client
// ─────────────────────────────────────────────────────────────────────────────

const api = axios.create({
  baseURL: API_CONFIG.BASE_URL,
  timeout: API_CONFIG.TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
});

// ── Session-expiry callback ──────────────────────────────────────────────────
// The auth store registers a handler here (see app/_layout.tsx) so a 401 on an
// authenticated route can clear auth state and bounce back to the login screen.
// Kept as an injected callback to avoid an api ⇄ store import cycle.
let onUnauthorized: (() => void) | null = null;
export const setUnauthorizedHandler = (fn: (() => void) | null) => {
  onUnauthorized = fn;
};

// ── Request Interceptor: attach Bearer token ──────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await storage.get(STORAGE_KEYS.AUTH_TOKEN);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// ── Response Interceptor: normalise errors ────────────────────────────────────
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response) {
      // Server responded with a non-2xx status
      const { status, data } = error.response;
      const url = error.config?.url ?? '';

      if (status === 401) {
        // Only treat as "session expired" for authenticated routes.
        // If the 401 came from the login endpoint itself, fall through
        // so the real server error message is surfaced to the user.
        const isAuthRoute = url.includes('/login') || url.includes('/signup');
        if (!isAuthRoute) {
          // Drop the dead token now, and let the app return to login.
          await storage.remove(STORAGE_KEYS.AUTH_TOKEN);
          await storage.remove(STORAGE_KEYS.AUTH_USER);
          onUnauthorized?.();
          return Promise.reject({
            code: 'UNAUTHORIZED',
            message: 'Session expired. Please log in again.',
          });
        }
      }

      if (status === 422) {
        return Promise.reject({
          code: 'VALIDATION_ERROR',
          message: 'Validation failed.',
          errors: data.errors ?? {},
        });
      }

      if (status === 429) {
        const retryAfter = Number(error.response.headers?.['retry-after']);
        return Promise.reject({
          code: 'RATE_LIMITED',
          message: retryAfter
            ? `Too many attempts. Try again in ${retryAfter}s.`
            : 'Too many attempts. Wait a minute and try again.',
        });
      }

      return Promise.reject({
        code: data.code ?? 'SERVER_ERROR',
        message: data.error ?? data.message ?? 'An unexpected error occurred.',
        status,
        data,
      });
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject({
        code: 'TIMEOUT',
        message: 'Request timed out. Check your connection.',
      });
    }

    return Promise.reject({
      code: 'NETWORK_ERROR',
      message: 'No internet connection. Your scores will be saved offline.',
    });
  },
);

export default api;
