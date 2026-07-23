import { create } from 'zustand';
import { eventService } from '../services/event.service';
import type { EventSession, Criterion } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Store — Current event session and criteria state
// ─────────────────────────────────────────────────────────────────────────────

interface EventStore {
  event: EventSession | null;
  criteria: Criterion[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadByQrToken: (qrToken: string) => Promise<void>;
  refreshCriteria: (eventId: string) => Promise<void>;
  loadFromCache: () => Promise<boolean>;
  clearEvent: () => Promise<void>;
}

export const useEventStore = create<EventStore>((set, get) => ({
  event:     null,
  criteria:  [],
  isLoading: false,
  error:     null,

  /**
   * Scan QR and load event session + criteria from backend.
   * Caches results locally automatically via eventService.
   */
  loadByQrToken: async (qrToken) => {
    set({ isLoading: true, error: null });
    try {
      const { event, criteria } = await eventService.getEventByQrToken(qrToken);
      set({ event, criteria, isLoading: false });
    } catch (error: any) {
      set({
        isLoading: false,
        error: error.message ?? 'Failed to load event. Check your connection.',
      });
      throw error;
    }
  },

  /**
   * Refresh criteria from backend when event is already loaded.
   */
  refreshCriteria: async (eventId) => {
    try {
      const criteria = await eventService.getEventCriteria(eventId);
      set({ criteria });
    } catch {
      // Silently fail — keep cached criteria
    }
  },

  /**
   * Load cached event session (for offline use after first scan).
   * Returns true if cache was found.
   */
  loadFromCache: async () => {
    const cached = await eventService.loadCachedSession();
    if (cached) {
      set({ event: cached.event, criteria: cached.criteria });
      return true;
    }
    return false;
  },

  /**
   * Clear the current event session (after submission or logout).
   */
  clearEvent: async () => {
    await eventService.clearCachedSession();
    set({ event: null, criteria: [], error: null });
  },
}));
