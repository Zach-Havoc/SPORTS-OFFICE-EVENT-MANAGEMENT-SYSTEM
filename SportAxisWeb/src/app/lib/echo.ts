import type Echo from "laravel-echo";
import { useSyncExternalStore } from "react";

type PusherConnection = {
  bind: (event: string, cb: (state: { previous: string; current: string }) => void) => void;
};

/**
 * A lazily-created Laravel Echo client for Reverb (the Pusher wire protocol).
 *
 * Realtime is optional: if `VITE_REVERB_APP_KEY` is not set, or the socket
 * fails to initialise, `getEcho()` resolves to null and callers fall back to
 * their polling refetch. Nothing throws. laravel-echo and pusher-js (~70 KB)
 * are imported only when a key is set, so a site without Reverb never
 * downloads them.
 *
 * `useRealtimeConnected()` says whether the socket is up right now, so live
 * screens can poll fast only while it isn't (no Reverb configured — as on
 * shared hosting — the server not running, or the connection dropped).
 *
 * Env (see .env.example):
 *   VITE_REVERB_APP_KEY   — the public app key (matches backend REVERB_APP_KEY)
 *   VITE_REVERB_HOST      — socket host        (default: current page host)
 *   VITE_REVERB_PORT      — socket port        (default: 8080)
 *   VITE_REVERB_SCHEME    — http | https       (default: http)
 */

export type EchoClient = InstanceType<typeof Echo>;

let client: Promise<EchoClient | null> | undefined;

// ── Connection state ─────────────────────────────────────────────────
let connected = false;
const listeners = new Set<() => void>();

function setConnected(next: boolean) {
  if (next === connected) return;
  connected = next;
  listeners.forEach((l) => l());
}

/** Whether the realtime socket is connected right now. */
export function isRealtimeConnected(): boolean {
  return connected;
}

/** Subscribe to connect / disconnect. Returns the unsubscribe function. */
export function onRealtimeChange(listener: () => void): () => void {
  void getEcho(); // make sure a client exists to report on
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(onRealtimeChange, isRealtimeConnected, () => false);
}

export function getEcho(): Promise<EchoClient | null> {
  if (client !== undefined) return client;

  const key = import.meta.env.VITE_REVERB_APP_KEY as string | undefined;
  if (!key) {
    client = Promise.resolve(null);
    return client;
  }

  const host =
    (import.meta.env.VITE_REVERB_HOST as string | undefined) ||
    window.location.hostname;
  const port = Number(import.meta.env.VITE_REVERB_PORT ?? 8080);
  const scheme =
    (import.meta.env.VITE_REVERB_SCHEME as string | undefined) || "http";
  const tls = scheme === "https";

  client = Promise.all([import("laravel-echo"), import("pusher-js")])
    .then(([{ default: EchoCtor }, { default: Pusher }]) => {
      (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
      const echo = new EchoCtor({
        broadcaster: "reverb",
        key,
        wsHost: host,
        wsPort: port,
        wssPort: port,
        forceTLS: tls,
        enabledTransports: tls ? ["wss"] : ["ws", "wss"],
      }) as EchoClient;
      const connection = (echo.connector as { pusher?: { connection?: PusherConnection } }).pusher?.connection;
      connection?.bind("state_change", ({ current }: { current: string }) => setConnected(current === "connected"));
      return echo;
    })
    .catch((err) => {
      console.warn("[realtime] Echo init failed; falling back to polling", err);
      return null;
    });

  return client;
}
