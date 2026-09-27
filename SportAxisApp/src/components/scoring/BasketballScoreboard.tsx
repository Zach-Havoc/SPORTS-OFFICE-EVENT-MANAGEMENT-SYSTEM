import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../../constants/theme';
import { useNetwork } from '../../hooks/use-network';
import { basketballService } from '../../services/basketball.service';
import type { EventSession, PlayType, Scoreboard, ScoreboardTeam } from '../../types';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

// ─────────────────────────────────────────────────────────────────────────────
// BasketballScoreboard — play-by-play scoring for a basketball game.
//
// Tap a jersey to select that player (tap again to deselect), then an action.
// A basket with no player selected counts for the team; a foul needs a player.
// Every tap is recorded on the server, which computes the score, team fouls
// and box score and sends the whole scoreboard back — so what's on screen is
// always the server's truth, and two scorekeepers can't drift apart.
//
// Rosters come from the athletes' profiles (their coach sets jersey numbers);
// they're synced from the server when the game opens.
// ─────────────────────────────────────────────────────────────────────────────

const ACTIONS: { type: PlayType; label: string }[] = [
  { type: 'FT', label: '+1 FT' },
  { type: 'FG2', label: '+2' },
  { type: 'FG3', label: '+3' },
  { type: 'FOUL', label: 'Foul' },
];

const LABEL: Record<PlayType, string> = { FT: '+1 FT', FG2: '+2', FG3: '+3', FOUL: 'foul' };

const lastName = (name: string) => name.trim().split(/\s+/).pop() ?? name;
const short = (t: ScoreboardTeam) => t.abbreviation || t.label || t.name;
const periodName = (p: number, reg: number) => (p <= reg ? `Q${p}` : `OT${p - reg}`);

type Selected = { teamId: string; playerId: string } | null;
type TeamError = { teamId: string | null; message: string } | null;

export function BasketballScoreboard({
  event,
  onBoard,
}: {
  event: EventSession;
  /** Told about every scoreboard shown — the screen uses it to know if plays exist. */
  onBoard?: (board: Scoreboard) => void;
}) {
  const { isConnected } = useNetwork();
  const { width } = useWindowDimensions();
  const sideBySide = width >= 700;

  const [board, setBoard] = useState<Scoreboard | null>(null);
  const [notes, setNotes] = useState<string[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [error, setError] = useState<TeamError>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const versionRef = useRef(0);

  /** Show a scoreboard unless a newer one is already on screen. */
  const adopt = useCallback((next: Scoreboard) => {
    if (next.version < versionRef.current) return;
    versionRef.current = next.version;
    setBoard(next);
    onBoard?.(next);
  }, [onBoard]);

  /** Pull the rosters from the athletes' profiles, then show the game. */
  const fetchBoard = useCallback(async (): Promise<Scoreboard> => {
    try {
      return await basketballService.syncRoster(event.id);
    } catch (e) {
      // e.g. the game is already finished, or this device can't sync: just show it.
      return basketballService.get(event.id).catch(() => Promise.reject(e));
    }
  }, [event.id]);

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      fetchBoard().then(
        (b) => {
          if (!isAlive()) return;
          setNotes(b.rosterNotes ?? []);
          adopt(b);
        },
        (e: any) => isAlive() && setLoadError(e?.message || "Couldn't load this game."),
      ),
    [fetchBoard, adopt],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive);
    return () => {
      alive = false;
    };
  }, [load]);

  /** Send one write; show its scoreboard, or the server's reason inline. */
  const run = async (call: () => Promise<Scoreboard>, teamId: string | null, done?: (b: Scoreboard) => void) => {
    setError(null);
    setInFlight((n) => n + 1);
    try {
      const b = await call();
      adopt(b);
      done?.(b);
      return true;
    } catch (e: any) {
      setError({ teamId, message: e?.message || "That didn't go through. Try again." });
      return false;
    } finally {
      setInFlight((n) => n - 1);
    }
  };

  const record = (team: ScoreboardTeam, type: PlayType) => {
    const playerId = selected?.teamId === team.id ? selected.playerId : null;
    if (type === 'FOUL' && !playerId) {
      setError({ teamId: team.id, message: 'Pick a player first' });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
      return;
    }
    const player = team.players.find((p) => p.playerId === playerId);
    Haptics.selectionAsync().catch(() => {});
    setSelected(null);
    run(() => basketballService.record(event.id, { teamId: team.id, type, playerId }), team.id, () =>
      setLastAction(`Recorded: ${player ? `#${player.jersey} ${lastName(player.name)}` : short(team)} ${LABEL[type]}`),
    );
  };

  const undo = () =>
    run(() => basketballService.undo(event.id), null, () => setLastAction('Last play undone'));

  const nextPeriod = () => {
    if (!board) return;
    const to = periodName(board.period + 1, board.regulationPeriods);
    Alert.alert(`Start ${to}?`, `End ${board.periodLabel} and start ${to}. Team fouls reset for the new period.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: `Start ${to}`,
        onPress: () =>
          run(() => basketballService.setPeriod(event.id, board.period + 1), null, (b) =>
            setLastAction(`${b.periodLabel} started`),
          ),
      },
    ]);
  };

  const finish = () => {
    if (!board) return;
    const [home, away] = board.teams;
    if (home.score === away.score) {
      Alert.alert(
        "It's a tie",
        `${short(home)} ${home.score} – ${away.score} ${short(away)}. A tied game can't be finished — start ${periodName(board.period + 1, board.regulationPeriods)} instead.`,
      );
      return;
    }
    const winner = home.score > away.score ? home : away;
    Alert.alert(
      'Finish game',
      `${short(home)} ${home.score} – ${away.score} ${short(away)}\n\n${winner.label} wins. This records the result, updates the standings and bracket, and no more plays can be recorded.`,
      [
        { text: 'Keep playing', style: 'cancel' },
        {
          text: 'Finish game',
          style: 'destructive',
          onPress: () => run(() => basketballService.finish(event.id), null, () => setLastAction('Game finished')),
        },
      ],
    );
  };

  // ── Loading / unavailable ─────────────────────────────────────────────────
  if (!board) {
    return (
      <View style={[styles.card, styles.center]}>
        {loadError ? (
          <>
            <Text style={styles.muted}>{loadError}</Text>
            <Button
              label="Try again"
              variant="secondary"
              onPress={() => {
                setLoadError(null);
                load();
              }}
              style={{ marginTop: SPACING.sm }}
            />
          </>
        ) : (
          <ActivityIndicator color={COLORS.textSecondary} />
        )}
      </View>
    );
  }

  if (!board.ready) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Not set up for play-by-play</Text>
        <Text style={styles.muted}>This game needs exactly two colleges. Ask the Sports Office to check the event.</Text>
      </View>
    );
  }

  const finished = board.status === 'finished';
  const locked = finished || !isConnected;
  const winner = board.teams.find((t) => t.id === board.winnerTeamId);

  return (
    <View style={styles.wrap}>
      {/* Period · Next period · Undo */}
      <View style={styles.topBar}>
        <View style={styles.periodChip}>
          <Text style={styles.periodText}>{finished ? 'Final' : board.periodLabel}</Text>
        </View>
        {inFlight > 0 && <ActivityIndicator size="small" color={COLORS.textMuted} />}
        <View style={styles.flex} />
        {!finished && (
          <>
            <ToolButton icon="chevron-right" label="Next period" onPress={nextPeriod} disabled={locked} />
            <ToolButton icon="rotate-ccw" label="Undo" onPress={undo} disabled={locked || board.playCount === 0} />
          </>
        )}
      </View>

      {finished && winner && (
        <View style={styles.banner}>
          <Icon name="flag" size={15} color={COLORS.textSecondary} />
          <Text style={styles.bannerText}>
            Final · {winner.label} won {Math.max(...board.teams.map((t) => t.score))}–{Math.min(...board.teams.map((t) => t.score))}
          </Text>
        </View>
      )}
      {!isConnected && !finished && (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Icon name="wifi-off" size={15} color={COLORS.warning} />
          <Text style={styles.bannerText}>{"You're offline. Plays can be recorded again once you're back online."}</Text>
        </View>
      )}
      {notes.length > 0 && !finished && (
        <View style={[styles.banner, styles.bannerInfo]}>
          <Icon name="info" size={15} color={COLORS.info} />
          <View style={styles.flex}>
            {notes.map((n) => (
              <Text key={n} style={styles.bannerText}>{n}</Text>
            ))}
            <Text style={styles.bannerSub}>Their coach can set it on the web, then reopen this game.</Text>
          </View>
        </View>
      )}

      {/* Team panels */}
      <View style={sideBySide ? styles.row : styles.column}>
        {board.teams.map((team) => {
          const sel = selected?.teamId === team.id ? team.players.find((p) => p.playerId === selected.playerId) : undefined;
          return (
            <View key={team.id} style={[styles.card, sideBySide && styles.flex]}>
              <View style={styles.teamHead}>
                <View style={styles.flex}>
                  <Text style={styles.teamName} numberOfLines={1}>{short(team)}</Text>
                  <Text style={styles.meta}>Team fouls: {team.teamFouls}</Text>
                </View>
                <Text style={styles.score} accessibilityLabel={`${short(team)} score ${team.score}`}>{team.score}</Text>
              </View>

              {team.players.length === 0 ? (
                <Text style={[styles.muted, styles.noRoster]}>
                  No players with jersey numbers yet. Points still count for the team.
                </Text>
              ) : (
                <JerseyGrid
                  team={team}
                  selectedId={sel?.playerId ?? null}
                  disabled={locked}
                  onPress={(playerId) => {
                    Haptics.selectionAsync().catch(() => {});
                    setError(null);
                    setSelected((s) => (s?.playerId === playerId ? null : { teamId: team.id, playerId }));
                  }}
                />
              )}

              {!finished && (
                <>
                  <Text style={sel ? styles.selected : styles.meta}>
                    {sel ? (
                      <>
                        Selected: <Text style={styles.selectedName}>#{sel.jersey} {lastName(sel.name)}</Text>
                      </>
                    ) : (
                      'No player selected'
                    )}
                  </Text>
                  <View style={styles.actions}>
                    {ACTIONS.map((a) => (
                      <Pressable
                        key={a.type}
                        onPress={() => record(team, a.type)}
                        disabled={locked}
                        accessibilityRole="button"
                        accessibilityLabel={`${a.label} for ${short(team)}`}
                        style={({ pressed }) => [styles.action, pressed && styles.actionPressed, locked && styles.disabled]}
                      >
                        <Text style={styles.actionText}>{a.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {error?.teamId === team.id && <Text style={styles.error} accessibilityRole="alert">{error.message}</Text>}
                </>
              )}
            </View>
          );
        })}
      </View>

      {error && error.teamId === null && <Text style={styles.error} accessibilityRole="alert">{error.message}</Text>}
      {lastAction && !error && <Text style={styles.lastAction}>{lastAction}</Text>}

      {/* Box scores */}
      <View style={sideBySide ? styles.row : styles.column}>
        {board.teams.map((team) => (
          <View key={team.id} style={[styles.card, sideBySide && styles.flex]}>
            <Text style={styles.cardTitle}>{short(team)} box score</Text>
            <BoxScore team={team} />
          </View>
        ))}
      </View>

      {!finished && (
        <Button
          label="Finish game"
          variant="secondary"
          onPress={finish}
          disabled={locked}
          size="lg"
          fullWidth
          icon={<Icon name="flag" size={17} color={COLORS.textPrimary} />}
        />
      )}
    </View>
  );
}

function ToolButton({ icon, label, onPress, disabled }: { icon: 'chevron-right' | 'rotate-ccw'; label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      style={({ pressed }) => [styles.tool, pressed && styles.actionPressed, disabled && styles.disabled]}
    >
      <Icon name={icon} size={15} color={COLORS.textPrimary} />
      <Text style={styles.toolText}>{label}</Text>
    </Pressable>
  );
}

/** Four jerseys per row, sized from the card's width so the grid never wraps oddly. */
function JerseyGrid({
  team,
  selectedId,
  disabled,
  onPress,
}: {
  team: ScoreboardTeam;
  selectedId: string | null;
  disabled: boolean;
  onPress: (playerId: string) => void;
}) {
  const [w, setW] = useState(0);
  const cell = w ? (w - GAP * 3) / 4 : 0;

  return (
    <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {cell > 0 &&
        team.players.map((p) => {
          const on = p.playerId === selectedId;
          return (
            <Pressable
              key={p.playerId}
              onPress={() => onPress(p.playerId)}
              disabled={disabled}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`#${p.jersey} ${p.name}`}
              style={({ pressed }) => [
                styles.jersey,
                { width: cell },
                on && styles.jerseyOn,
                pressed && !on && styles.actionPressed,
              ]}
            >
              <Text style={[styles.jerseyNum, on && styles.jerseyTextOn]}>#{p.jersey}</Text>
              <Text style={[styles.jerseyName, on && styles.jerseyTextOn]} numberOfLines={2}>
                {lastName(p.name)}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}

function BoxScore({ team }: { team: ScoreboardTeam }) {
  const cols: { key: 'pts' | 'fg2' | 'fg3' | 'ft' | 'pf'; label: string }[] = [
    { key: 'pts', label: 'PTS' },
    { key: 'fg2', label: '2PT' },
    { key: 'fg3', label: '3PT' },
    { key: 'ft', label: 'FT' },
    { key: 'pf', label: 'PF' },
  ];
  return (
    <View>
      <View style={[styles.boxRow, styles.boxHead]}>
        <Text style={[styles.boxPlayer, styles.boxHeadText]}>Player</Text>
        {cols.map((c) => (
          <Text key={c.key} style={[styles.boxCell, styles.boxHeadText]}>{c.label}</Text>
        ))}
      </View>
      {team.players.map((p) => (
        <View key={p.playerId} style={styles.boxRow}>
          <Text style={styles.boxPlayer} numberOfLines={1}>#{p.jersey} {lastName(p.name)}</Text>
          {cols.map((c) => (
            <Text key={c.key} style={[styles.boxCell, c.key === 'pts' && styles.boxPts]}>{p[c.key]}</Text>
          ))}
        </View>
      ))}
      {team.unassignedPoints > 0 && (
        <View style={styles.boxRow}>
          <Text style={[styles.boxPlayer, styles.muted]}>Team (no player)</Text>
          <Text style={[styles.boxCell, styles.boxPts]}>{team.unassignedPoints}</Text>
          <Text style={[styles.boxCell, { flex: 4 }]} />
        </View>
      )}
      {team.players.length === 0 && team.unassignedPoints === 0 && <Text style={styles.muted}>No players yet.</Text>}
    </View>
  );
}

const GAP = SPACING.sm;

const styles = StyleSheet.create({
  wrap: { gap: SPACING.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  column: { gap: SPACING.md },
  center: { alignItems: 'center', justifyContent: 'center', minHeight: 140 },

  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  cardTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  muted: { ...TYPE.bodySm, color: COLORS.textMuted },
  meta: { ...TYPE.bodySm, color: COLORS.textSecondary },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  periodChip: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.infoLight,
  },
  periodText: { ...TYPE.label, color: COLORS.info, fontVariant: ['tabular-nums'] },
  tool: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs + 2,
    minHeight: 44,
    paddingHorizontal: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  toolText: { ...TYPE.label, color: COLORS.textPrimary },

  banner: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.surfaceAlt,
  },
  bannerWarn: { backgroundColor: COLORS.warningLight },
  bannerInfo: { backgroundColor: COLORS.infoLight },
  bannerText: { ...TYPE.bodySm, color: COLORS.textPrimary, flexShrink: 1 },
  bannerSub: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: 2 },

  teamHead: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm },
  teamName: { ...TYPE.heading, color: COLORS.textPrimary },
  score: { fontSize: 44, lineHeight: 48, fontWeight: '700', letterSpacing: -1.2, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  noRoster: { paddingVertical: SPACING.sm },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  jersey: {
    minHeight: 60,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyOn: { backgroundColor: COLORS.action, borderColor: COLORS.action },
  jerseyNum: { ...TYPE.subhead, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  jerseyName: { ...TYPE.caption, color: COLORS.textSecondary, textAlign: 'center' },
  jerseyTextOn: { color: COLORS.actionOn },

  selected: { ...TYPE.bodySm, color: COLORS.textSecondary },
  selectedName: { ...TYPE.label, color: COLORS.brandText },

  actions: { flexDirection: 'row', gap: GAP },
  action: {
    flex: 1,
    minHeight: 52,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionPressed: { backgroundColor: COLORS.surfaceMuted },
  actionText: { ...TYPE.subhead, color: COLORS.textPrimary },
  disabled: { opacity: 0.4 },

  error: {
    ...TYPE.bodySm,
    color: COLORS.error,
    backgroundColor: COLORS.errorLight,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.xs + 2,
    borderRadius: RADIUS.md,
    overflow: 'hidden',
  },
  lastAction: { ...TYPE.bodySm, color: COLORS.textSecondary, textAlign: 'center' },

  boxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: SPACING.xs + 3,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.hairline,
  },
  boxHead: { borderTopWidth: 0 },
  boxHeadText: { ...TYPE.caption, color: COLORS.textMuted },
  boxPlayer: { flex: 3, ...TYPE.bodySm, color: COLORS.textPrimary },
  boxCell: { flex: 1, ...TYPE.bodySm, color: COLORS.textSecondary, textAlign: 'center', fontVariant: ['tabular-nums'] },
  boxPts: { color: COLORS.textPrimary, fontWeight: '600' },
});
