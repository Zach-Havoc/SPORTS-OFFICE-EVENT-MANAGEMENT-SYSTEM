import { QueryClient } from '@tanstack/react-query';

/**
 * Freshness tiers (how long data is considered "fresh" before a background
 * refetch is triggered on mount / focus / reconnect).
 *
 *  - live:   fast-changing data (schedules, scores, rankings, dashboards,
 *            rosters, requirements). 10s per product decision.
 *  - static: slow-changing reference data (departments, categories, venues,
 *            profiles, registration codes, the current user). 60s.
 */
export const STALE = {
  live: 10_000,
  static: 60_000,
} as const;

/**
 * Global stale-while-revalidate defaults.
 *
 * On every mount / tab-focus / network-reconnect React Query serves the
 * last cached value immediately and refetches in the background, swapping in
 * fresh data when it lands. Failed background refetches keep the previous
 * data on screen (see `RefreshStatus` for the non-blocking error chip).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: STALE.live,
      // Keep unmounted query data around for 10 min so navigating back to a
      // page shows its previous data instantly instead of a spinner.
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      refetchOnMount: true,
      // Background refetches retry a couple of times with backoff; the last
      // good data stays visible the whole time.
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30_000),
      // Don't blow away the visible list while a refetch for new params runs.
      placeholderData: (prev: unknown) => prev,
    },
    mutations: {
      retry: 0,
    },
  },
});
