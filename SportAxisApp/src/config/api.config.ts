// ─────────────────────────────────────────────────────────────────────────────
// API Configuration
// ─────────────────────────────────────────────────────────────────────────────

// Update BASE_URL to match your Laravel backend URL
// For Android emulator: use 10.0.2.2 instead of localhost
// For physical device: use your machine's local IP (e.g., 192.168.x.x)
// For production: use your deployed domain

export const API_CONFIG = {
  // BASE_URL: 'http://10.0.2.2:8000/api',    // Android emulator
  // BASE_URL: 'http://localhost:8000/api', // iOS simulator
  BASE_URL: 'http://192.168.1.31:8000/api', // Physical device (computer's IP)
  TIMEOUT: 15000,
} as const;
