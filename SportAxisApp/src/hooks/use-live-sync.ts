import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

/** How often a scorer screen checks the server for changes from other devices. */
export const LIVE_SYNC_MS = 3000;

/**
 * Keep a screen in step with the server: call `sync` every few seconds while
 * `enabled` and the app is in the foreground, and once straight away when the
 * app comes back to the foreground (a backgrounded app misses everything).
 *
 * The committee can have two phones on one game, and the web board reads the
 * same data, so a scorer screen that only loaded once would drift. Polling
 * works on every host — the realtime socket (Reverb) can't run on shared
 * hosting — and is cheap: one small request per tick.
 */
export function useLiveSync(sync: () => void, enabled: boolean, intervalMs: number = LIVE_SYNC_MS): void {
  // The latest callback, without restarting the timer every render.
  const syncRef = useRef(sync);
  useEffect(() => {
    syncRef.current = sync;
  });

  useEffect(() => {
    if (!enabled) return;

    let timer: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (!timer) timer = setInterval(() => syncRef.current(), intervalMs);
    };
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };

    if (AppState.currentState === 'active') start();
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        syncRef.current(); // catch up on what happened while backgrounded
        start();
      } else {
        stop();
      }
    });

    return () => {
      stop();
      sub.remove();
    };
  }, [enabled, intervalMs]);
}
