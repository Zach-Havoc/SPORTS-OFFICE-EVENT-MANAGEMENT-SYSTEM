// ─────────────────────────────────────────────────────────────────────────────
// API Configuration
// ─────────────────────────────────────────────────────────────────────────────
//
// The backend URL comes from EXPO_PUBLIC_API_URL (set it in `.env`, or export
// it before `expo start`). See `.env.example` for the values to use per target:
//
//   iOS simulator / web ....... http://localhost:8000/api
//   Android emulator .......... http://10.0.2.2:8000/api
//   Physical device .......... http://<your-computer-LAN-IP>:8000/api
//   Production ............... https://<your-domain>/api
//
// If unset, we fall back to localhost.

const DEFAULT_BASE_URL = 'http://localhost:8000/api';

export const API_CONFIG = {
  BASE_URL: (process.env.EXPO_PUBLIC_API_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, ''),
  TIMEOUT: 15000,
} as const;
