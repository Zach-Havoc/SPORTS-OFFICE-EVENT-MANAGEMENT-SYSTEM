import { QueryClient } from '@tanstack/react-query';

/**
 * Freshness tiers.
 *
 * Per product decision the app no longer auto-refreshes: data is fetched once
 * when a page first loads (or when the browser is refreshed), and after that
 * it only re-fetches when something the user does invalidates it (a create /
 * update / delete). So both tiers are `Infinity` — nothing goes stale on its
 * own. The two names are kept so call sites don't all have to change.
 */
export const STALE = {
  live: Infinity,
  static: Infinity,
} as const;

/**
 * Global query defaults.
 *
 * No background polling, no refetch on tab-focus or network-reconnect. A
 * query fetches when it first mounts with an empty cache (i.e. on initial
 * page load / a browser refresh); afterwards it stays put until a mutation
 * invalidates it. Failed fetches keep the last good data on screen.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: Infinity,
      // Keep unmounted query data around for 10 min so navigating back to a
      // page shows its previous data instantly instead of a spinner.
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
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
