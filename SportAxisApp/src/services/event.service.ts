import api from './api';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { EventSessionResponse } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Service — QR session lookup and event listing
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
   * GET /api/departments
   *
   * Department list with abbreviations (for showing "CICS" instead of the full
   * college name). Public endpoint; cached locally for offline use.
   */
  async getDepartments(): Promise<{ id: string; name: string; abbreviation: string | null }[]> {
    try {
      const response = await api.get('/departments');
      await storage.setJSON('departments', response.data);
      return response.data;
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
        const cached = await storage.getJSON<{ id: string; name: string; abbreviation: string | null }[]>('departments');
        if (cached) return cached;
      }
      throw error;
    }
  },
  /**
   * GET /api/event/session/{qrToken}
   *
   * Resolves a QR token to an event session.
   * This is the primary QR scan endpoint — public, no auth required.
   * Caches the result locally for offline use.
   */
  async getEventByQrToken(qrToken: string): Promise<EventSessionResponse> {
    const response = await api.get<EventSessionResponse>(
      `/event/session/${encodeURIComponent(qrToken)}`,
    );
    const data = response.data;

    await storage.setJSON(STORAGE_KEYS.EVENT_SESSION, data.event);

    return data;
  },

  /**
   * Load the cached event session from local storage (offline support).
   */
  async loadCachedSession(): Promise<EventSessionResponse | null> {
    const event = await storage.getJSON<EventSessionResponse['event']>(STORAGE_KEYS.EVENT_SESSION);
    if (!event) return null;
    return { event };
  },

  /**
   * Clear the cached event session (e.g., after submission or logout).
   */
  async clearCachedSession(): Promise<void> {
    await storage.remove(STORAGE_KEYS.EVENT_SESSION);
  },
};
