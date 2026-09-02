import { create } from 'zustand';
import { eventService } from '../services/event.service';
import type { EventSession } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Store — Current event session state
// ─────────────────────────────────────────────────────────────────────────────

interface EventStore {
  event: EventSession | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  loadByQrToken: (qrToken: string) => Promise<void>;
  loadFromCache: () => Promise<boolean>;
  clearEvent: () => Promise<void>;
}

export const useEventStore = create<EventStore>((set) => ({
  event:     null,
  isLoading: false,
  error:     null,

  /**
   * Scan QR and load the event session from the backend.
   * Caches the result locally automatically via eventService.
   */
  loadByQrToken: async (qrToken) => {
    set({ isLoading: true, error: null });
    try {
      const { event } = await eventService.getEventByQrToken(qrToken);
      set({ event, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message ?? 'Failed to load event. Check your connection.',
      });
      throw error;
    }
  },

  /**
   * Load the cached event session (for offline use after first scan).
   * Returns true if a cache was found.
   */
  loadFromCache: async () => {
    const cached = await eventService.loadCachedSession();
    if (cached) {
      set({ event: cached.event });
      return true;
    }
    return false;
  },

  /**
   * Clear the current event session (after submission or logout).
   */
  clearEvent: async () => {
    await eventService.clearCachedSession();
    set({ event: null, error: null });
  },
}));
