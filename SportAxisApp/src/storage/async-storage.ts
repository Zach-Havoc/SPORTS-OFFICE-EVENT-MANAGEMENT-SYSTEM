import AsyncStorage from '@react-native-async-storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// AsyncStorage wrapper with typed helpers
// ─────────────────────────────────────────────────────────────────────────────

const PREFIX = '@sportaxis:';

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(PREFIX + key);
    } catch {
      return null;
    }
  },

  async set(key: string, value: string): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFIX + key, value);
    } catch {
      console.warn('[storage] Failed to set:', key);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch {
      console.warn('[storage] Failed to remove:', key);
    }
  },

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },

  async setJSON<T>(key: string, value: T): Promise<void> {
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch {
      console.warn('[storage] Failed to setJSON:', key);
    }
  },

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((k) => k.startsWith(PREFIX));
      await AsyncStorage.multiRemove(appKeys);
    } catch {
      console.warn('[storage] Failed to clear storage');
    }
  },
};

// Storage key constants
export const STORAGE_KEYS = {
  AUTH_TOKEN:     'auth_token',
  AUTH_USER:      'auth_user',
  EVENT_SESSION:  'event_session',
  OFFLINE_QUEUE:  'offline_queue',
  LAST_SYNC:      'last_sync',
} as const;
