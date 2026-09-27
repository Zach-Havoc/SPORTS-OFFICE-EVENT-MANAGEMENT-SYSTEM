import Echo from "laravel-echo";
import Pusher from "pusher-js";
import { useSyncExternalStore } from "react";

type PusherConnection = {
  bind: (event: string, cb: (state: { previous: string; current: string }) => void) => void;
};

/**
 * A lazily-created Laravel Echo client for Reverb (the Pusher wire protocol).
 *
 * Realtime is optional: if `VITE_REVERB_APP_KEY` is not set, or the socket
 * fails to initialise, `getEcho()` returns null and callers fall back to their
 * polling refetch. Nothing throws.
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

type EchoClient = InstanceType<typeof Echo>;

let client: EchoClient | null | undefined;

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
  getEcho(); // make sure a client exists to report on
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useRealtimeConnected(): boolean {
  return useSyncExternalStore(onRealtimeChange, isRealtimeConnected, () => false);
}

export function getEcho(): EchoClient | null {
  if (client !== undefined) return client;

  const key = import.meta.env.VITE_REVERB_APP_KEY as string | undefined;
  if (!key) {
    client = null;
    return client;
  }

  const host =
    (import.meta.env.VITE_REVERB_HOST as string | undefined) ||
    window.location.hostname;
  const port = Number(import.meta.env.VITE_REVERB_PORT ?? 8080);
  const scheme =
    (import.meta.env.VITE_REVERB_SCHEME as string | undefined) || "http";
  const tls = scheme === "https";

  try {
    (window as unknown as { Pusher: typeof Pusher }).Pusher = Pusher;
    client = new Echo({
      broadcaster: "reverb",
      key,
      wsHost: host,
      wsPort: port,
      wssPort: port,
      forceTLS: tls,
      enabledTransports: tls ? ["wss"] : ["ws", "wss"],
    });
    const connection = (client.connector as { pusher?: { connection?: PusherConnection } }).pusher?.connection;
    connection?.bind("state_change", ({ current }: { current: string }) => setConnected(current === "connected"));
  } catch (err) {
    console.warn("[realtime] Echo init failed; falling back to polling", err);
    client = null;
  }

  return client;
}
