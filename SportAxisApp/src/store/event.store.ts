import { create } from 'zustand';
import { eventService } from '../services/event.service';
import type { EventSession, Criterion } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Store — Current event session and criteria state
//
// Manages event data after QR scan:
//   - Event details (name, schedule, departments, participants, etc.)
//   - Scoring criteria
//   - Loading and error states
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

  // Selectors
  getEventName: () => string | null;
  getDepartments: () => string[];
  getParticipants: () => string[];
  getCriteria: () => Criterion[];
}

export const useEventStore = create<EventStore>((set, get) => ({
  event:     null,
  criteria:  [],
  isLoading: false,
  error:     null,

  /**
   * PRIMARY: Scan QR and load event session + criteria from backend.
   * Returns full event data including:
   *   - name, schedule, start/end times
   *   - departments and participants (judges)
   *   - criteria for scoring
   *
   * Caches results locally automatically via eventService for offline support.
   */
  loadByQrToken: async (qrToken) => {
    set({ isLoading: true, error: null });
    try {
      const { event, criteria } = await eventService.getEventByQrToken(qrToken);
      set({ event, criteria, isLoading: false });
    } catch (error: any) {
      const errorMsg = error.message ?? 'Failed to load event. Check your connection.';
      set({
        isLoading: false,
        error: errorMsg,
      });
      throw error;
    }
  },

  /**
   * Refresh criteria from backend when event is already loaded.
   * Useful for periodic sync without re-scanning.
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
   * Returns true if cache was found, false otherwise.
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

  /**
   * Get event name (or null if not loaded).
   */
  getEventName: () => {
    return get().event?.name ?? null;
  },

  /**
   * Get departments for current event.
   */
  getDepartments: () => {
    return get().event?.departments ?? [];
  },

  /**
   * Get participants/judges for current event.
   */
  getParticipants: () => {
    const event = get().event;
    return event?.participants ?? event?.judges ?? [];
  },

  /**
   * Get criteria for current event.
   */
  getCriteria: () => {
    return get().criteria;
  },
}));
