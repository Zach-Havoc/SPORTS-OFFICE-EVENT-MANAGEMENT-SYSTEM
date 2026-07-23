import api from './api';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { EventSessionResponse, Criterion } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Service — QR session lookup, criteria fetching
<<<<<<< HEAD
=======
//
// Handles all event-related API calls with automatic caching for offline support.
// The primary entry point is `getEventByQrToken()` which resolves a QR code to
// event data including name, schedule, departments, participants, and criteria.
>>>>>>> parent of 1bc212b2 (bug fixed in Mobile App)
// ─────────────────────────────────────────────────────────────────────────────

export const eventService = {
  /**
   * GET /api/event/session/{qrToken}
   *
   * PRIMARY: Resolves a QR token to an event session + criteria.
   * This is called after scanning a QR code to fetch:
   *   - Event name, schedule, start/end times
   *   - Departments and participants (judges)
   *   - Criteria array for dynamic scoring form
   *
   * Public endpoint (no auth required).
   * Response is cached locally for offline use.
   *
   * @throws Error if QR token is invalid or network error occurs
   */
  async getEventByQrToken(qrToken: string): Promise<EventSessionResponse> {
    try {
      const response = await api.get<EventSessionResponse>(
        `/event/session/${encodeURIComponent(qrToken)}`,
      );
      const data = response.data;

      // Validate response structure
      if (!data.event || !data.criteria) {
        throw new Error('Invalid event data structure from server.');
      }

      // Cache event and criteria locally
      await Promise.all([
        storage.setJSON(STORAGE_KEYS.EVENT_SESSION, data.event),
        storage.setJSON(STORAGE_KEYS.EVENT_CRITERIA, data.criteria),
      ]);

      return data;
    } catch (error: any) {
      // Re-throw with meaningful message
      if (error.message?.includes('404')) {
        throw new Error('Event not found. Invalid QR code.');
      }
      if (error.message?.includes('422')) {
        throw new Error('Event has been completed.');
      }
      throw error;
    }
  },

  /**
   * GET /api/event/{id}/criteria
   *
   * Fetches or refreshes just the criteria array for an event by ID.
   * Used to update criteria when event is already cached, or for
   * periodic sync without re-scanning the QR code.
   *
   * Falls back to local cache if network is unavailable.
   *
   * @throws Error if event not found (unless offline, then uses cache)
   */
  async getEventCriteria(eventId: string): Promise<Criterion[]> {
    try {
      const response = await api.get<{ event_id: string; criteria: Criterion[] }>(
        `/event/${eventId}/criteria`,
      );
      const criteria = response.data.criteria;

      // Update local cache
      await storage.setJSON(STORAGE_KEYS.EVENT_CRITERIA, criteria);
      return criteria;
    } catch (error: any) {
      // If offline, return cached criteria
      if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
        const cached = await storage.getJSON<Criterion[]>(STORAGE_KEYS.EVENT_CRITERIA);
        if (cached) return cached;
      }
      throw error;
    }
  },

  /**
   * Load cached event session from local storage.
   * Used for offline mode — returns null if no cache exists.
   */
  async loadCachedSession(): Promise<EventSessionResponse | null> {
    const [event, criteria] = await Promise.all([
      storage.getJSON<EventSessionResponse['event']>(STORAGE_KEYS.EVENT_SESSION),
      storage.getJSON<Criterion[]>(STORAGE_KEYS.EVENT_CRITERIA),
    ]);

    if (!event || !criteria) return null;
    return { event, criteria };
  },

  /**
   * Clear the cached event session.
   * Called after submission or logout.
   */
  async clearCachedSession(): Promise<void> {
    await Promise.all([
      storage.remove(STORAGE_KEYS.EVENT_SESSION),
      storage.remove(STORAGE_KEYS.EVENT_CRITERIA),
    ]);
  },
};
