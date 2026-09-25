import api from './api';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { EventSessionResponse, EventSummary } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Event Service — QR session lookup and event listing
// ─────────────────────────────────────────────────────────────────────────────

interface Paginator<T> {
  data: T[];
  current_page: number;
  last_page: number;
}

/** GET /api/events may return a bare array or a Laravel paginator object
 * ({ data, current_page, last_page, ... }) — walk every page either way so
 * a season with more events than the backend's per-page default doesn't get
 * silently truncated. */
async function fetchAllEvents(): Promise<EventSummary[]> {
  const first = await api.get('/events', { params: { page: 1, per_page: 200 } });
  const body = first.data;
  if (Array.isArray(body)) return body;

  const paginator = body as Paginator<EventSummary>;
  let items = paginator.data ?? [];
  if (!paginator.last_page || paginator.last_page <= paginator.current_page) return items;

  const rest = await Promise.all(
    Array.from({ length: paginator.last_page - paginator.current_page }, (_, i) =>
      api.get('/events', { params: { page: paginator.current_page + i + 1, per_page: 200 } }),
    ),
  );
  for (const page of rest) {
    const pageBody = page.data;
    items = items.concat(Array.isArray(pageBody) ? pageBody : (pageBody as Paginator<EventSummary>).data ?? []);
  }
  return items;
}

export const eventService = {
  /**
   * GET /api/events
   *
   * Fetches all events from the backend. Public endpoint.
   *
   * Stale-while-revalidate: if a cached list is available in AsyncStorage,
   * it's returned immediately so the screen can render without waiting on
   * the network, while a background refetch updates the cache and — once it
   * completes — calls `onFresh` with the up-to-date list so the caller can
   * update its own state. On a cold cache (or if the background refetch
   * fails and there was nothing cached), this awaits the network as before.
   */
  async getEvents(onFresh?: (events: EventSummary[]) => void): Promise<EventSummary[]> {
    const cached = await storage.getJSON<EventSummary[]>(STORAGE_KEYS.EVENTS_LIST);

    const fetchFresh = async (): Promise<EventSummary[]> => {
      const fresh = await fetchAllEvents();
      await storage.setJSON(STORAGE_KEYS.EVENTS_LIST, fresh);
      return fresh;
    };

    if (cached) {
      fetchFresh()
        .then((fresh) => onFresh?.(fresh))
        .catch(() => {
          // Background refresh failed — the caller is already showing the
          // cached list, so there's nothing more to do here.
        });
      return cached;
    }

    return fetchFresh();
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
  async getDepartments(): Promise<{ id: string; name: string; abbreviation: string | null; logo_url?: string | null }[]> {
    try {
      const response = await api.get('/departments');
      await storage.setJSON('departments', response.data);
      return response.data;
    } catch (error: any) {
      if (error.code === 'NETWORK_ERROR' || error.code === 'TIMEOUT') {
        const cached = await storage.getJSON<{ id: string; name: string; abbreviation: string | null; logo_url?: string | null }[]>('departments');
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
