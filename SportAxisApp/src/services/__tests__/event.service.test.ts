import { eventService } from '../event.service';
import api from '../api';
import { storage } from '../../storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// eventService.getEvents() — pagination walk + stale-while-revalidate cache
//
// GET /api/events may come back either as a bare array (no pagination) or as
// a Laravel paginator object ({ data, current_page, last_page, ... }). These
// tests pin down that fetchAllEvents() (private, exercised only through
// getEvents()) reads the exact snake_case field names Laravel's paginator
// actually serializes with, and doesn't under-fetch when there's more than
// one page.
// ─────────────────────────────────────────────────────────────────────────────

jest.mock('../api', () => ({
  __esModule: true,
  default: { get: jest.fn() },
}));

jest.mock('../../storage/async-storage', () => ({
  storage: {
    getJSON: jest.fn(),
    setJSON: jest.fn(),
  },
  STORAGE_KEYS: { EVENTS_LIST: 'events_list' },
}));

const mockedApiGet = api.get as jest.Mock;
const mockedGetJSON = storage.getJSON as jest.Mock;
const mockedSetJSON = storage.setJSON as jest.Mock;

function makeEvent(id: string) {
  return { id, name: `Event ${id}`, category: 'Basketball', schedule: '2026-10-01', startTime: '09:00', endTime: '10:00', status: 'upcoming', departments: [], qrToken: `tok-${id}` };
}

describe('eventService.getEvents — cold cache (no cache to fall back on, awaits network)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedGetJSON.mockResolvedValue(null); // no cache
    mockedSetJSON.mockResolvedValue(undefined);
  });

  it('returns a bare array response as-is, without treating it as a paginator', async () => {
    mockedApiGet.mockResolvedValueOnce({ data: [makeEvent('1'), makeEvent('2')] });

    const events = await eventService.getEvents();

    expect(events).toHaveLength(2);
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
  });

  it('walks every page of a Laravel paginator using snake_case current_page/last_page/data', async () => {
    // Page 1 of 3 — exactly the shape Laravel's paginator->toArray() produces.
    mockedApiGet.mockImplementation((_url: string, config: any) => {
      const page = config.params.page;
      const byPage: Record<number, any> = {
        1: { data: [makeEvent('1')], current_page: 1, last_page: 3, per_page: 200, total: 3 },
        2: { data: [makeEvent('2')], current_page: 2, last_page: 3, per_page: 200, total: 3 },
        3: { data: [makeEvent('3')], current_page: 3, last_page: 3, per_page: 200, total: 3 },
      };
      return Promise.resolve({ data: byPage[page] });
    });

    const events = await eventService.getEvents();

    expect(mockedApiGet).toHaveBeenCalledTimes(3);
    expect(events.map((e) => e.id)).toEqual(['1', '2', '3']);
    // The fetched (unpaginated) list is the thing that gets cached.
    expect(mockedSetJSON).toHaveBeenCalledWith('events_list', events);
  });

  it('does not issue extra requests when the first page is already the last page', async () => {
    mockedApiGet.mockResolvedValueOnce({
      data: { data: [makeEvent('1')], current_page: 1, last_page: 1, per_page: 200, total: 1 },
    });

    const events = await eventService.getEvents();

    expect(events).toHaveLength(1);
    expect(mockedApiGet).toHaveBeenCalledTimes(1);
  });

  it('would silently under-fetch if the paginator used camelCase keys instead (regression guard)', async () => {
    // Same 3-page shape as above, but with currentPage/lastPage instead of
    // current_page/last_page — simulates what would happen if a future
    // change added camelCase transformation to the axios client. This should
    // FAIL if that ever happens, catching the exact bug class described in
    // the review brief before it reaches under-fetched production data.
    mockedApiGet.mockResolvedValueOnce({
      data: { data: [makeEvent('1')], currentPage: 1, lastPage: 3, per_page: 200, total: 3 },
    });

    const events = await eventService.getEvents();

    expect(mockedApiGet).toHaveBeenCalledTimes(1);
    expect(events).toHaveLength(1); // only page 1 — proves camelCase keys would be missed
  });
});

describe('eventService.getEvents — warm cache (stale-while-revalidate)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns the cached list immediately without waiting on the network', async () => {
    const cached = [makeEvent('cached-1')];
    mockedGetJSON.mockResolvedValue(cached);
    mockedApiGet.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve({ data: [makeEvent('fresh-1')] }), 50)),
    );

    const events = await eventService.getEvents();

    expect(events).toBe(cached);
  });

  it('invokes onFresh once the background refetch resolves, with the walked/paginated result', async () => {
    mockedGetJSON.mockResolvedValue([makeEvent('cached-1')]);
    mockedApiGet.mockResolvedValueOnce({
      data: { data: [makeEvent('fresh-1')], current_page: 1, last_page: 1, per_page: 200, total: 1 },
    });

    const onFresh = jest.fn();
    await eventService.getEvents(onFresh);

    // Background refresh isn't awaited by getEvents() — flush microtasks.
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(onFresh).toHaveBeenCalledWith([makeEvent('fresh-1')]);
  });

  it('does not call onFresh (and swallows the error) when the background refetch fails', async () => {
    mockedGetJSON.mockResolvedValue([makeEvent('cached-1')]);
    mockedApiGet.mockRejectedValueOnce(new Error('network down'));

    const onFresh = jest.fn();
    const events = await eventService.getEvents(onFresh);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(events).toEqual([makeEvent('cached-1')]);
    expect(onFresh).not.toHaveBeenCalled();
  });
});
