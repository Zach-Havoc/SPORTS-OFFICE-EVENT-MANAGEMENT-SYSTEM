import { useCallback, useEffect, useRef, useState } from 'react';
import * as Haptics from 'expo-haptics';
import { storage } from '../storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// useGameClock — the basketball game clock and shot clock, run on the
// scorer's phone.
//
// Time is kept from timestamps, not by counting ticks, so it stays right
// even when the app is slow or in the background. The state is saved per
// game, so closing or crashing the app picks the clock up where it was —
// still running if it was running.
//
// A new period resets the game clock to the period's length (a quarter of
// 10, 8 or 12 minutes; overtime is 5) and the shot clock to 24. At 0:00 the
// game clock stops on its own; so does everything when the shot clock runs
// out (the referee whistles the violation).
// ─────────────────────────────────────────────────────────────────────────────

export const QUARTER_LENGTHS = [10, 8, 12] as const;   // FIBA, high school, NBA
const OVERTIME_MIN = 5;
export const SHOT_FULL = 24;
export const SHOT_RESET = 14;

interface Saved {
  lengthMin: number;
  period: number;
  /** Game / shot clock remaining when last started or stopped. */
  gameMs: number;
  shotMs: number;
  shotOn: boolean;
  /** Epoch ms the clock was started at, or null when stopped. */
  runningSince: number | null;
}

const key = (eventId: string) => `bb-clock:${eventId}`;

function periodMs(period: number, regulationPeriods: number, lengthMin: number) {
  return (period > regulationPeriods ? OVERTIME_MIN : lengthMin) * 60_000;
}

/** "9:27" — or "0:42.3" in the last minute, the way a scoreboard shows it. */
export function formatGameClock(ms: number): string {
  if (ms < 60_000) {
    const tenths = Math.floor(ms / 100);
    return `0:${String(Math.floor(tenths / 10)).padStart(2, '0')}.${tenths % 10}`;
  }
  const s = Math.ceil(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "09:27" — the clock as recorded with a play (whole seconds left). */
export function stampGameClock(ms: number): string {
  const s = Math.ceil(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function useGameClock(eventId: string, period: number, regulationPeriods: number) {
  const [saved, setSaved] = useState<Saved | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const savedRef = useRef<Saved | null>(null);
  savedRef.current = saved;

  const persist = useCallback(
    (next: Saved) => {
      setSaved(next);
      storage.setJSON(key(eventId), next);
    },
    [eventId],
  );

  // Load this game's clock (or start a fresh one).
  useEffect(() => {
    let alive = true;
    storage.getJSON<Saved>(key(eventId)).then((s) => {
      if (!alive) return;
      const lengthMin = s?.lengthMin ?? QUARTER_LENGTHS[0];
      setSaved(
        s ?? {
          lengthMin, period, shotOn: true, runningSince: null,
          gameMs: periodMs(period, regulationPeriods, lengthMin), shotMs: SHOT_FULL * 1000,
        },
      );
    });
    return () => {
      alive = false;
    };
    // Loaded once per game; period changes are handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [eventId]);

  // What's left right now.
  const elapsed = saved?.runningSince ? Math.max(0, now - saved.runningSince) : 0;
  const gameMs = saved ? Math.max(0, saved.gameMs - elapsed) : 0;
  const shotMs = saved ? Math.max(0, saved.shotMs - elapsed) : 0;
  const running = !!saved?.runningSince;

  /** Freeze the clocks at what's left now. */
  const frozen = useCallback((s: Saved, at = Date.now()): Saved => {
    if (!s.runningSince) return s;
    const e = Math.max(0, at - s.runningSince);
    return { ...s, gameMs: Math.max(0, s.gameMs - e), shotMs: Math.max(0, s.shotMs - e), runningSince: null };
  }, []);

  const stop = useCallback(() => {
    const s = savedRef.current;
    if (s?.runningSince) persist(frozen(s));
  }, [persist, frozen]);

  const start = useCallback(() => {
    const s = savedRef.current;
    if (!s || s.runningSince || s.gameMs <= 0) return;
    // A shot clock already at 0 starts over with the next possession.
    persist({ ...s, shotMs: s.shotMs <= 0 ? SHOT_FULL * 1000 : s.shotMs, runningSince: Date.now() });
  }, [persist]);

  // A new period: a full clock for it, and a full shot clock, stopped.
  useEffect(() => {
    const s = savedRef.current;
    if (!s || s.period === period) return;
    persist({
      ...s, period, runningSince: null,
      gameMs: periodMs(period, regulationPeriods, s.lengthMin), shotMs: SHOT_FULL * 1000,
    });
    // `saved?.period` too: a clock loaded from an earlier period catches up.
  }, [period, regulationPeriods, persist, saved?.period]);

  // Tick while running; stop at 0:00 (end of the period) or on a shot clock violation.
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      const s = savedRef.current;
      if (!s?.runningSince) return;
      const f = frozen(s, t);
      const gameOver = f.gameMs <= 0;
      const shotOver = s.shotOn && f.shotMs <= 0 && f.gameMs > f.shotMs;
      if (gameOver || shotOver) {
        persist(f);
        Haptics.notificationAsync(
          gameOver ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Warning,
        ).catch(() => {});
      }
    }, 100);
    return () => clearInterval(id);
  }, [running, frozen, persist]);

  /** Nudge the game clock (−1 / +1 second), within the period's length. */
  const adjust = useCallback(
    (seconds: number) => {
      const s = savedRef.current;
      if (!s) return;
      const f = frozen(s);
      const full = periodMs(s.period, regulationPeriods, s.lengthMin);
      persist({
        ...f,
        gameMs: Math.min(full, Math.max(0, f.gameMs + seconds * 1000)),
        runningSince: s.runningSince ? Date.now() : null,
      });
    },
    [frozen, persist, regulationPeriods],
  );

  /** Quarter length. A quarter that hasn't started yet starts over at the new length. */
  const setLength = useCallback(
    (lengthMin: number) => {
      const s = savedRef.current;
      if (!s || s.runningSince) return;
      const untouched = s.gameMs === periodMs(s.period, regulationPeriods, s.lengthMin);
      persist({ ...s, lengthMin, gameMs: untouched ? periodMs(s.period, regulationPeriods, lengthMin) : s.gameMs });
    },
    [persist, regulationPeriods],
  );

  const resetShot = useCallback(
    (seconds: number) => {
      const s = savedRef.current;
      if (!s) return;
      const f = frozen(s);
      persist({ ...f, shotMs: seconds * 1000, runningSince: s.runningSince ? Date.now() : null });
    },
    [frozen, persist],
  );

  const setShotOn = useCallback(
    (shotOn: boolean) => {
      const s = savedRef.current;
      if (s) persist({ ...s, shotOn });
    },
    [persist],
  );

  const fullMs = saved ? periodMs(saved.period, regulationPeriods, saved.lengthMin) : 0;

  return {
    ready: !!saved,
    running,
    gameMs,
    shotMs,
    fullMs,
    lengthMin: saved?.lengthMin ?? QUARTER_LENGTHS[0],
    overtime: period > regulationPeriods,
    shotOn: saved?.shotOn ?? true,
    /** The shot clock is dark when switched off, or when less game time than shot time is left. */
    shotShown: (saved?.shotOn ?? true) && gameMs > shotMs,
    periodOver: !!saved && gameMs <= 0,
    started: !!saved && gameMs < fullMs,
    start,
    stop,
    adjust,
    setLength,
    resetShot,
    setShotOn,
    /** The clock to record with a play: "09:27" left. */
    stamp: () => stampGameClock(gameMs),
  };
}

export type GameClock = ReturnType<typeof useGameClock>;
