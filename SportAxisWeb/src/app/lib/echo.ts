import Echo from "laravel-echo";
import Pusher from "pusher-js";

/**
 * A lazily-created Laravel Echo client for Reverb (the Pusher wire protocol).
 *
 * Realtime is optional: if `VITE_REVERB_APP_KEY` is not set, or the socket
 * fails to initialise, `getEcho()` returns null and callers fall back to their
 * polling refetch. Nothing throws.
 *
 * Env (see .env.example):
 *   VITE_REVERB_APP_KEY   — the public app key (matches backend REVERB_APP_KEY)
 *   VITE_REVERB_HOST      — socket host        (default: current page host)
 *   VITE_REVERB_PORT      — socket port        (default: 8080)
 *   VITE_REVERB_SCHEME    — http | https       (default: http)
 */

type EchoClient = InstanceType<typeof Echo>;

let client: EchoClient | null | undefined;

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
  } catch (err) {
    console.warn("[realtime] Echo init failed; falling back to polling", err);
    client = null;
  }

  return client;
}
