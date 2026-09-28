import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../../constants/theme';
import { formatGameClock, QUARTER_LENGTHS, SHOT_FULL, SHOT_RESET, type GameClock } from '../../hooks/use-game-clock';
import { Icon } from '../ui/Icon';

// ─────────────────────────────────────────────────────────────────────────────
// GameClockPanel — the game clock and shot clock on the basketball scorer.
// Start / stop, ±1 second, the quarter length, and the shot clock's 24 / 14
// resets and on/off switch. The clock itself lives in useGameClock.
// ─────────────────────────────────────────────────────────────────────────────

export function GameClockPanel({
  clock,
  periodLabel,
  nextLabel,
  disabled,
}: {
  clock: GameClock;
  periodLabel: string;
  /** The period after this one ("Q2", "OT1"), for the end-of-period hint. */
  nextLabel: string;
  disabled?: boolean;
}) {
  const tap = (fn: () => void) => () => {
    Haptics.selectionAsync().catch(() => {});
    fn();
  };
  const status = clock.periodOver ? `End of ${periodLabel}` : clock.running ? 'Running' : clock.started ? 'Stopped' : 'Not started';
  const shotSeconds = Math.ceil(clock.shotMs / 1000);

  return (
    <View style={styles.card}>
      <View style={styles.head}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{periodLabel}</Text>
        </View>
        <Text style={[styles.status, clock.running && styles.statusOn]}>{status}</Text>
        <View style={styles.flex} />
        {!clock.overtime && (
          <View style={styles.lengths} accessibilityRole="radiogroup" accessibilityLabel="Quarter length">
            {QUARTER_LENGTHS.map((m) => {
              const on = clock.lengthMin === m;
              return (
                <Pressable
                  key={m}
                  onPress={tap(() => clock.setLength(m))}
                  disabled={disabled || clock.running}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on, disabled: disabled || clock.running }}
                  style={[styles.length, on && styles.lengthOn, (disabled || clock.running) && !on && styles.dim]}
                >
                  <Text style={[styles.lengthText, on && styles.lengthTextOn]}>{m} min</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </View>

      <View style={styles.clocks}>
        <Text
          style={[styles.game, clock.periodOver && styles.gameOver]}
          accessibilityLabel={`Game clock ${formatGameClock(clock.gameMs)}`}
          accessibilityLiveRegion="polite"
        >
          {formatGameClock(clock.gameMs)}
        </Text>

        <View style={styles.shot}>
          <View style={styles.shotHead}>
            <Text style={styles.shotLabel}>Shot clock</Text>
            <Switch
              value={clock.shotOn}
              onValueChange={(v) => clock.setShotOn(v)}
              disabled={disabled}
              accessibilityLabel="Shot clock on"
            />
          </View>
          <Text style={[styles.shotTime, !clock.shotShown && styles.shotOff, clock.shotShown && shotSeconds <= 5 && styles.shotLow]}>
            {clock.shotShown ? shotSeconds : '—'}
          </Text>
          <View style={styles.shotButtons}>
            {[SHOT_FULL, SHOT_RESET].map((s) => (
              <Pressable
                key={s}
                onPress={tap(() => clock.resetShot(s))}
                disabled={disabled || !clock.shotOn}
                accessibilityRole="button"
                accessibilityLabel={`Reset shot clock to ${s}`}
                style={({ pressed }) => [styles.small, pressed && styles.pressed, (disabled || !clock.shotOn) && styles.dim]}
              >
                <Text style={styles.smallText}>{s}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>

      <View style={styles.controls}>
        {[-1, 1].map((s) => (
          <Pressable
            key={s}
            onPress={tap(() => clock.adjust(s))}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel={`${s > 0 ? 'Add' : 'Take off'} one second`}
            style={({ pressed }) => [styles.small, styles.nudge, pressed && styles.pressed, disabled && styles.dim]}
          >
            <Text style={styles.smallText}>{s > 0 ? '+1s' : '−1s'}</Text>
          </Pressable>
        ))}
        <Pressable
          onPress={tap(() => (clock.running ? clock.stop() : clock.start()))}
          disabled={disabled || (!clock.running && clock.periodOver)}
          accessibilityRole="button"
          accessibilityLabel={clock.running ? 'Stop the clock' : 'Start the clock'}
          style={({ pressed }) => [
            styles.startStop,
            clock.running ? styles.stopBtn : styles.startBtn,
            pressed && styles.startStopPressed,
            (disabled || (!clock.running && clock.periodOver)) && styles.dim,
          ]}
        >
          <Icon name={clock.running ? 'pause' : 'play'} size={18} color={clock.running ? COLORS.textPrimary : COLORS.actionOn} />
          <Text style={[styles.startStopText, !clock.running && styles.startText]}>{clock.running ? 'Stop' : 'Start'}</Text>
        </Pressable>
      </View>

      {clock.periodOver && (
        <Text style={styles.hint}>
          {periodLabel} is over. Tap <Text style={styles.hintStrong}>Next period</Text> to start {nextLabel}, or finish the game.
        </Text>
      )}
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
  head: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.md, backgroundColor: COLORS.infoLight },
  chipText: { ...TYPE.label, color: COLORS.info, fontVariant: ['tabular-nums'] },
  status: { ...TYPE.label, color: COLORS.textSecondary },
  statusOn: { color: COLORS.success },

  lengths: { flexDirection: 'row', gap: SPACING.xs },
  length: {
    minHeight: 36,
    paddingHorizontal: SPACING.sm + 2,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    justifyContent: 'center',
  },
  lengthOn: { borderColor: COLORS.action, backgroundColor: COLORS.action },
  lengthText: { ...TYPE.label, color: COLORS.textSecondary },
  lengthTextOn: { color: COLORS.actionOn },

  clocks: { flexDirection: 'row', alignItems: 'center', gap: SPACING.lg },
  game: {
    flex: 1,
    fontSize: 64,
    lineHeight: 70,
    fontWeight: '700',
    letterSpacing: -1.5,
    color: COLORS.textPrimary,
    fontVariant: ['tabular-nums'],
  },
  gameOver: { color: COLORS.error },

  shot: { alignItems: 'center', gap: SPACING.xs },
  shotHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  shotLabel: { ...TYPE.caption, color: COLORS.textSecondary },
  shotTime: { fontSize: 40, lineHeight: 44, fontWeight: '700', color: COLORS.warning, fontVariant: ['tabular-nums'] },
  shotLow: { color: COLORS.error },
  shotOff: { color: COLORS.textMuted },
  shotButtons: { flexDirection: 'row', gap: SPACING.xs },

  controls: { flexDirection: 'row', gap: SPACING.sm },
  small: {
    minWidth: 48,
    minHeight: 44,
    paddingHorizontal: SPACING.sm,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nudge: { minWidth: 64 },
  smallText: { ...TYPE.subhead, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  pressed: { backgroundColor: COLORS.surfaceMuted },
  startStop: {
    flex: 1,
    minHeight: 52,
    borderRadius: RADIUS.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    borderWidth: 1,
  },
  startBtn: { backgroundColor: COLORS.action, borderColor: COLORS.action },
  stopBtn: { backgroundColor: COLORS.surface, borderColor: COLORS.borderStrong },
  startStopPressed: { opacity: 0.85 },
  startStopText: { ...TYPE.subhead, color: COLORS.textPrimary },
  startText: { color: COLORS.actionOn },
  dim: { opacity: 0.4 },

  hint: { ...TYPE.bodySm, color: COLORS.textSecondary },
  hintStrong: { ...TYPE.label, color: COLORS.textPrimary },
});
