import api from './api';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { EventSessionResponse, Criterion } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Service — QR session lookup, criteria fetching, and event listing
// ─────────────────────────────────────────────────────────────────────────────

export const eventService = {
  /**
   * GET /api/events
   *
   * Fetches all events from the backend. Public endpoint.
   */
  async getEvents(): Promise<import('../types').EventSummary[]> {
    const response = await api.get('/events');
    return response.data;
  },

  /**
   * GET /api/events/{id}
   *
   * Fetches a single event by ID. Public endpoint.
   */
  async getEventById(id: string): Promise<import('../types').EventSummary> {
    const response = await api.get(`/events/${id}`);
    return response.data;
  },
  /**
   * GET /api/event/session/{qrToken}
   *
   * Resolves a QR token to an event session + criteria.
   * This is the primary QR scan endpoint — public, no auth required.
   * Caches the result locally for offline use.
   */
  async getEventByQrToken(qrToken: string): Promise<EventSessionResponse> {
    const response = await api.get<EventSessionResponse>(
      `/event/session/${encodeURIComponent(qrToken)}`,
    );
    const data = response.data;

    // Cache event and criteria locally
    await Promise.all([
      storage.setJSON(STORAGE_KEYS.EVENT_SESSION, data.event),
      storage.setJSON(STORAGE_KEYS.EVENT_CRITERIA, data.criteria),
    ]);

    return data;
  },

  /**
   * GET /api/event/{id}/criteria
   *
   * Fetches just the criteria array for an event by ID.
   * Used to refresh criteria when the event is already cached.
   * Falls back to local cache if network is unavailable.
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
   * Load cached event session from local storage (offline support).
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
   * Clear the cached event session (e.g., after submission or logout).
   */
  async clearCachedSession(): Promise<void> {
    await Promise.all([
      storage.remove(STORAGE_KEYS.EVENT_SESSION),
      storage.remove(STORAGE_KEYS.EVENT_CRITERIA),
    ]);
  },
};
