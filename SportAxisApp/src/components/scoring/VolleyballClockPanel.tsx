import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../../constants/theme';
import type { VolleyballScoreboard as Board } from '../../types';

// ─────────────────────────────────────────────────────────────────────────────
// VolleyballClockPanel — the clocks on the volleyball scorer.
//
//   Set clock / match time — from the server's own timestamps: a set starts
//     when "Start set" was pressed (the whistle for the first serve) and ends
//     with its last point. So every phone shows the same time, and a restart
//     loses nothing. These are the FIVB set and match durations.
//   Serve timer — FIVB's 8 seconds to serve, restarted after every rally
//     (and at the start of a set); tap it to restart. On this phone only.
//   Time-out — a team's 30-second time-out, counted down.
// ─────────────────────────────────────────────────────────────────────────────

export const SERVE_SECONDS = 8;
export const TIMEOUT_SECONDS = 30;

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${String(m).padStart(2, '0')}:${sec}`;
};

export function VolleyballClockPanel({
  board,
  serveTimerOn,
  onServeTimerOn,
  serveFrom,
  onRestartServe,
  timeout,
  onTimeoutDone,
}: {
  board: Board;
  serveTimerOn: boolean;
  onServeTimerOn: (on: boolean) => void;
  /** Device time the serve timer last (re)started, or null when it's not running. */
  serveFrom: number | null;
  onRestartServe: () => void;
  /** A running time-out: whose, and when it ends (device time). */
  timeout: { label: string; endsAt: number } | null;
  onTimeoutDone: () => void;
}) {
  // Server time ≈ device time + offset, measured whenever a scoreboard arrives.
  const offset = useMemo(
    () => (board.serverTime ? Date.parse(board.serverTime) - Date.now() : 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [board.serverTime],
  );
  const [now, setNow] = useState(() => Date.now());

  const cur = board.currentSet > 0 ? board.sets[board.currentSet - 1] : undefined;
  const first = board.sets[0];
  const last = board.sets[board.sets.length - 1];
  const finished = board.status === 'finished';
  const serveLeft = serveTimerOn && serveFrom ? SERVE_SECONDS * 1000 - (now - serveFrom) : null;
  const timeoutLeft = timeout ? timeout.endsAt - now : null;
  const ticking = board.setInProgress || (serveLeft !== null && serveLeft > -1000) || (timeoutLeft !== null && timeoutLeft > 0);

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, [ticking]);

  // A buzz when the 8 seconds or the time-out run out.
  const buzzed = useRef({ serve: 0, timeout: 0 });
  useEffect(() => {
    if (serveLeft !== null && serveLeft <= 0 && serveFrom && buzzed.current.serve !== serveFrom) {
      buzzed.current.serve = serveFrom;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
    if (timeout && timeoutLeft !== null && timeoutLeft <= 0 && buzzed.current.timeout !== timeout.endsAt) {
      buzzed.current.timeout = timeout.endsAt;
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      onTimeoutDone();
    }
  }, [serveLeft, serveFrom, timeout, timeoutLeft, onTimeoutDone]);

  const serverNow = now + offset;
  const since = (iso?: string | null, until?: string | null) =>
    iso ? (until ? Date.parse(until) : serverNow) - Date.parse(iso) : 0;

  const setClock = board.setInProgress && cur ? since(cur.startedAt) : last?.endedAt ? since(last.startedAt, last.endedAt) : 0;
  const matchClock = first?.startedAt ? since(first.startedAt, finished || board.matchDecided ? last?.endedAt : null) : 0;

  const status = finished
    ? 'Final'
    : board.setInProgress
      ? 'In play'
      : board.matchDecided
        ? 'Match decided'
        : board.nextSet
          ? board.nextSet.number === 1 ? 'Not started' : `Set ${board.nextSet.number - 1} over`
          : '';
  const clockLabel = board.setInProgress
    ? `Set ${board.currentSet} time`
    : last?.endedAt
      ? `Set ${last.number} took`
      : 'Waiting for the first serve';

  return (
    <View style={styles.card}>
      {timeoutLeft !== null && timeoutLeft > 0 && timeout && (
        <View style={styles.timeout} accessibilityLiveRegion="polite">
          <Text style={styles.timeoutText}>Time-out · {timeout.label}</Text>
          <Text style={styles.timeoutClock}>0:{String(Math.ceil(timeoutLeft / 1000)).padStart(2, '0')}</Text>
        </View>
      )}

      <View style={styles.row}>
        <View style={styles.flex}>
          <Text style={[styles.status, board.setInProgress && styles.statusOn]}>{status}</Text>
          <Text style={styles.caption}>{clockLabel}</Text>
          <Text style={styles.setClock} accessibilityLabel={`${clockLabel} ${mmss(setClock)}`}>{mmss(setClock)}</Text>
        </View>

        <View style={styles.side}>
          <Text style={styles.caption}>
            Match time <Text style={styles.match}>{mmss(matchClock)}</Text>
          </Text>
          <View style={styles.serveHead}>
            <Text style={styles.caption}>Serve timer</Text>
            <Switch value={serveTimerOn} onValueChange={onServeTimerOn} accessibilityLabel="Serve timer on" />
          </View>
          <Pressable
            onPress={() => {
              Haptics.selectionAsync().catch(() => {});
              onRestartServe();
            }}
            disabled={!serveTimerOn || !board.setInProgress}
            accessibilityRole="button"
            accessibilityLabel="Restart the 8-second serve timer"
            style={({ pressed }) => [styles.serve, pressed && styles.pressed, (!serveTimerOn || !board.setInProgress) && styles.dim]}
          >
            <Text style={[styles.serveTime, serveLeft !== null && serveLeft <= 3000 && styles.serveLow]}>
              {serveLeft === null || !board.setInProgress ? '—' : serveLeft <= 0 ? 'Serve!' : Math.ceil(serveLeft / 1000)}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  status: { ...TYPE.label, color: COLORS.textSecondary },
  statusOn: { color: COLORS.success },
  caption: { ...TYPE.caption, color: COLORS.textSecondary },
  setClock: { fontSize: 56, lineHeight: 62, fontWeight: '700', letterSpacing: -1.2, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  side: { alignItems: 'flex-end', gap: SPACING.xs },
  match: { ...TYPE.label, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  serveHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  serve: {
    minWidth: 88,
    minHeight: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.sm,
  },
  serveTime: { fontSize: 26, lineHeight: 30, fontWeight: '700', color: COLORS.warning, fontVariant: ['tabular-nums'] },
  serveLow: { color: COLORS.error },
  pressed: { backgroundColor: COLORS.surfaceMuted },
  dim: { opacity: 0.4 },
  timeout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.infoLight,
  },
  timeoutText: { ...TYPE.label, color: COLORS.info },
  timeoutClock: { fontSize: 22, lineHeight: 26, fontWeight: '700', color: COLORS.info, fontVariant: ['tabular-nums'] },
});
