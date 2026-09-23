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
    } catch (error) {
      console.warn('[storage] Failed to set:', key, error);
    }
  },

  async remove(key: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(PREFIX + key);
    } catch (error) {
      console.warn('[storage] Failed to remove:', key, error);
    }
  },

  async getJSON<T>(key: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(PREFIX + key);
      if (!raw) return null;
      return JSON.parse(raw) as T;
    } catch (error) {
      console.warn('[storage] Failed to getJSON:', key, error);
      return null;
    }
  },

  async setJSON<T>(key: string, value: T): Promise<void> {
    if (value === undefined) {
      // JSON.stringify(undefined) returns the JS value `undefined`, not a
      // string — AsyncStorage.setItem requires a string argument, so passing
      // this through crashes the native bridge with an opaque error. Treat
      // it as "nothing to store" instead (mirrors JSON.stringify semantics
      // for an omitted object property).
      console.warn('[storage] setJSON called with undefined value, skipping:', key);
      return;
    }
    try {
      await AsyncStorage.setItem(PREFIX + key, JSON.stringify(value));
    } catch (error) {
      console.warn('[storage] Failed to setJSON:', key, error);
    }
  },

  async clear(): Promise<void> {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const appKeys = keys.filter((k) => k.startsWith(PREFIX));
      await AsyncStorage.multiRemove(appKeys);
    } catch (error) {
      console.warn('[storage] Failed to clear storage:', error);
    }
  },
};

// Storage key constants
export const STORAGE_KEYS = {
  AUTH_TOKEN:     'auth_token',
  AUTH_USER:      'auth_user',
  EVENT_SESSION:  'event_session',
  EVENTS_LIST:    'events_list',
  OFFLINE_QUEUE:  'offline_queue',
  LAST_SYNC:      'last_sync',
  ONBOARDING_SEEN: 'onboarding_seen',
} as const;
