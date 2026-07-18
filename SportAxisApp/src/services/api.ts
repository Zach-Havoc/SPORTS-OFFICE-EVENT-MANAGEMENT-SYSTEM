import axios from 'axios';
import { API_CONFIG } from '../config/api.config';
import { storage } from '../storage/async-storage';

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

// ── Request Interceptor: attach Bearer token ──────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    const token = await storage.get('auth_token');
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
  (error) => {
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

      return Promise.reject({
        code: data.code ?? 'SERVER_ERROR',
        message: data.error ?? data.message ?? 'An unexpected error occurred.',
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
