import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../../constants/theme';
import { useLiveSync } from '../../hooks/use-live-sync';
import { useNetwork } from '../../hooks/use-network';
import { volleyballService } from '../../services/volleyball.service';
import { storage } from '../../storage/async-storage';
import { TIMEOUT_SECONDS, VolleyballClockPanel } from './VolleyballClockPanel';
import type {
  EventSession,
  VolleyballLogEntry,
  VolleyballPlayer,
  VolleyballPointType,
  VolleyballScoreboard as Board,
  VolleyballTeam,
} from '../../types';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';

// ─────────────────────────────────────────────────────────────────────────────
// VolleyballScoreboard — rally-by-rally scoring for a volleyball game.
//
// Each set is started explicitly: who serves first, and each team's starting
// rotation (positions I–VI, from the coach's lineup; editable here). Then
// every rally is one tap — Kill, Ace, Block or Opp. error for the team that
// won it, with a player optional. The server works out the rest by replaying
// the log: the score, set and match wins, who serves (the rotation advances
// on every side-out), timeouts and substitutions. So Undo is always exact,
// even across the end of a set.
//
// The screen re-syncs every few seconds, so a second scorer's taps show up.
// ─────────────────────────────────────────────────────────────────────────────

const POINTS: { type: VolleyballPointType; label: string }[] = [
  { type: 'KILL', label: 'Kill' },
  { type: 'ACE', label: 'Ace' },
  { type: 'BLOCK', label: 'Block' },
  { type: 'OPP_ERROR', label: 'Opp.\nerror' },
];
const LABEL: Record<string, string> = { KILL: 'Kill', ACE: 'Ace', BLOCK: 'Block', OPP_ERROR: 'Opp. error' };
const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];

const lastName = (name: string) => name.trim().split(/\s+/).pop() ?? name;
const short = (t: VolleyballTeam) => t.abbreviation || t.label || t.name;
const tag = (jersey: string | null, name: string | null) => (jersey ? `#${jersey}${name ? ` ${lastName(name)}` : ''}` : '');

type Selected = { teamId: string; playerId: string } | null;
type Picker = { kind: 'sub'; team: VolleyballTeam } | { kind: 'rotation'; team: VolleyballTeam } | null;

export function VolleyballScoreboard({
  event,
  onBoard,
}: {
  event: EventSession;
  /** Told about every scoreboard shown — the screen uses it to know if plays exist. */
  onBoard?: (board: { playCount: number }) => void;
}) {
  const { isConnected } = useNetwork();
  const { width } = useWindowDimensions();
  const sideBySide = width >= 700;

  const [board, setBoard] = useState<Board | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Selected>(null);
  const [error, setError] = useState<{ teamId: string | null; message: string } | null>(null);
  const [lastAction, setLastAction] = useState<string | null>(null);
  const [inFlight, setInFlight] = useState(0);
  const [picker, setPicker] = useState<Picker>(null);
  // The next set's setup, edited before "Start set".
  const [firstServer, setFirstServer] = useState<string | null>(null);
  const [rotations, setRotations] = useState<Record<string, string[] | null>>({});
  const versionRef = useRef(0);
  // The 8-second serve timer (restarted after every rally) and a running
  // 30-second time-out — see VolleyballClockPanel.
  const [serveTimerOn, setServeTimerOn] = useState(true);
  const [serveFrom, setServeFrom] = useState<number | null>(null);
  const [timeoutRun, setTimeoutRun] = useState<{ label: string; endsAt: number } | null>(null);
  useEffect(() => {
    storage.get('vb-serve-timer').then((v) => v === 'off' && setServeTimerOn(false));
  }, []);
  const toggleServeTimer = useCallback((on: boolean) => {
    setServeTimerOn(on);
    storage.set('vb-serve-timer', on ? 'on' : 'off');
  }, []);
  const clearTimeout_ = useCallback(() => setTimeoutRun(null), []);

  /** Show a scoreboard unless a newer one is already on screen. */
  const adopt = useCallback(
    (next: Board) => {
      if (next.version < versionRef.current) return;
      versionRef.current = next.version;
      setBoard(next);
      onBoard?.(next);
    },
    [onBoard],
  );

  const load = useCallback(
    (isAlive: () => boolean = () => true) =>
      volleyballService.get(event.id).then(
        (b) => isAlive() && adopt(b),
        (e: any) => isAlive() && setLoadError(e?.message || "Couldn't load this game."),
      ),
    [event.id, adopt],
  );

  useEffect(() => {
    let alive = true;
    load(() => alive);
    return () => {
      alive = false;
    };
  }, [load]);

  useLiveSync(
    () => {
      volleyballService.get(event.id).then(adopt, () => {});
    },
    isConnected && !!board && board.status !== 'finished',
  );

  // A new set to set up: start from the suggested first server and the
  // coaches' rotations — and follow a rotation a coach saves while waiting.
  const nextSetNo = board?.nextSet?.number ?? null;
  const defaultsKey = board?.teams.map((t) => `${t.id}:${(t.defaultRotation ?? []).join(',')}`).join('|') ?? '';
  useEffect(() => {
    if (!board?.nextSet) return;
    // Deliberate: the set-up form resets whenever a new set becomes startable.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFirstServer(board.nextSet.suggestedServerTeamId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSetNo]);
  useEffect(() => {
    if (!board?.nextSet) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRotations(Object.fromEntries(board.teams.map((t) => [t.id, t.defaultRotation])));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nextSetNo, defaultsKey]);

  /** Send one write; show its scoreboard, or the server's reason inline. */
  const run = async (call: () => Promise<Board>, teamId: string | null, done?: (b: Board) => void) => {
    setError(null);
    setInFlight((n) => n + 1);
    try {
      const b = await call();
      adopt(b);
      done?.(b);
    } catch (e: any) {
      setError({ teamId, message: e?.message || "That didn't go through. Try again." });
    } finally {
      setInFlight((n) => n - 1);
    }
  };

  const point = (team: VolleyballTeam, type: VolleyballPointType) => {
    const picked = selected?.teamId === team.id ? selected.playerId : null;
    const playerId = type === 'OPP_ERROR' ? null : picked;
    const player = team.players.find((p) => p.playerId === playerId);
    Haptics.selectionAsync().catch(() => {});
    setSelected(null);
    run(() => volleyballService.record(event.id, { teamId: team.id, type, playerId }), team.id, (b) => {
      setLastAction(`${short(team)} · ${LABEL[type]}${player ? ` · #${player.jersey} ${lastName(player.name)}` : ''}`);
      // The next serve's 8 seconds — unless that point ended the set.
      setServeFrom(b.setInProgress ? Date.now() : null);
    });
  };

  const timeout = (team: VolleyballTeam) =>
    run(() => volleyballService.record(event.id, { teamId: team.id, type: 'TIMEOUT' }), team.id, () => {
      setLastAction(`${short(team)} · Timeout`);
      setServeFrom(null);
      setTimeoutRun({ label: short(team), endsAt: Date.now() + TIMEOUT_SECONDS * 1000 });
    });

  const undo = () => run(() => volleyballService.undo(event.id), null, () => setLastAction('Last play undone'));

  const startSet = () => {
    if (!board?.nextSet || !firstServer) return;
    run(() => volleyballService.startSet(event.id, { firstServerTeamId: firstServer, rotations }), null, (b) => {
      setLastAction(`Set ${b.currentSet} started`);
      setServeFrom(Date.now());
    });
  };

  const finish = () => {
    if (!board) return;
    const winner = board.teams.find((t) => t.id === board.winnerTeamId);
    const [home, away] = board.teams;
    Alert.alert(
      'Finish match',
      `${short(home)} ${home.setsWon} – ${away.setsWon} ${short(away)}\n\n${winner?.label ?? 'The winner'} wins. This records the result, updates the standings and bracket, and the match can't be changed after.`,
      [
        { text: 'Not yet', style: 'cancel' },
        { text: 'Finish match', style: 'destructive', onPress: () => run(() => volleyballService.finish(event.id), null) },
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
  const offline = !isConnected;
  const playing = board.setInProgress && !finished;
  const winner = board.teams.find((t) => t.id === board.winnerTeamId);
  const waitingFor = board.teams.filter((t) => t.players.length === 0);

  const chip = finished
    ? 'Final'
    : board.setInProgress
      ? `Set ${board.currentSet} · to ${board.target}`
      : board.matchDecided
        ? 'Match decided'
        : board.nextSet
          ? `Set ${board.nextSet.number} next`
          : `Set ${board.currentSet}`;

  return (
    <View style={styles.wrap}>
      {/* Set · Best of · Undo */}
      <View style={styles.topBar}>
        <View style={styles.chip}>
          <Text style={styles.chipText}>{chip}</Text>
        </View>
        {board.bestOfLocked || finished ? (
          <Text style={styles.meta}>Best of {board.bestOf}</Text>
        ) : (
          <View style={styles.segment} accessibilityRole="tablist">
            {board.rules.bestOfOptions.map((n) => (
              <Pressable
                key={n}
                accessibilityRole="tab"
                accessibilityState={{ selected: board.bestOf === n }}
                disabled={offline}
                onPress={() => run(() => volleyballService.setBestOf(event.id, n), null)}
                style={[styles.segmentItem, board.bestOf === n && styles.segmentOn]}
              >
                <Text style={[styles.segmentText, board.bestOf === n && styles.segmentTextOn]}>Best of {n}</Text>
              </Pressable>
            ))}
          </View>
        )}
        {inFlight > 0 && <ActivityIndicator size="small" color={COLORS.textMuted} />}
        <View style={styles.flex} />
        {!finished && (
          <ToolButton icon="rotate-ccw" label="Undo" onPress={undo} disabled={offline || board.playCount === 0} />
        )}
      </View>

      {!finished && (
        <VolleyballClockPanel
          board={board}
          serveTimerOn={serveTimerOn}
          onServeTimerOn={toggleServeTimer}
          serveFrom={serveFrom}
          onRestartServe={() => setServeFrom(Date.now())}
          timeout={timeoutRun}
          onTimeoutDone={clearTimeout_}
        />
      )}

      {offline && !finished && (
        <View style={[styles.banner, styles.bannerWarn]}>
          <Icon name="wifi-off" size={15} color={COLORS.warning} />
          <Text style={styles.bannerText}>{"You're offline. Rallies can be recorded again once you're back online."}</Text>
        </View>
      )}
      {waitingFor.length > 0 && !finished && (
        <View style={[styles.banner, styles.bannerInfo]}>
          <Icon name="info" size={15} color={COLORS.info} />
          <View style={styles.flex}>
            <Text style={styles.bannerText}>
              Waiting for {waitingFor.map(short).join(' and ')}
              {waitingFor.length === 1 ? "'s lineup" : ' lineups'} from the coach. Points still count for the team until then.
            </Text>
            <Text style={styles.bannerSub}>It appears here on its own once the coach saves it.</Text>
          </View>
        </View>
      )}

      {/* Start the next set */}
      {board.nextSet && !finished && (
        <View style={[styles.card, styles.setupCard]}>
          <Text style={styles.cardTitle}>
            Start set {board.nextSet.number} · to {board.nextSet.target}
          </Text>
          <Text style={styles.meta}>
            Press Start set when the referee whistles for the first serve — the set clock starts then. Point buttons are locked until then.
          </Text>
          <Text style={styles.label}>Who serves first?</Text>
          <View style={styles.row2}>
            {board.teams.map((t) => (
              <Pressable
                key={t.id}
                onPress={() => setFirstServer(t.id)}
                accessibilityRole="radio"
                accessibilityState={{ selected: firstServer === t.id }}
                style={[styles.choice, firstServer === t.id && styles.choiceOn]}
              >
                <Text style={[styles.choiceText, firstServer === t.id && styles.choiceTextOn]}>{short(t)}</Text>
              </Pressable>
            ))}
          </View>
          {board.teams.map((t) => {
            const rot = rotations[t.id] ?? null;
            return (
              <View key={t.id} style={styles.rotationRow}>
                <View style={styles.flex}>
                  <Text style={styles.label}>{short(t)} starting rotation</Text>
                  <Text style={rot ? styles.meta : styles.muted}>
                    {rot ? rot.map((id, i) => `${ROMAN[i]} ${tag(jerseyOf(t, id), null)}`).join(' · ') : 'None — their serve is tracked, not the server'}
                  </Text>
                </View>
                {t.players.length >= 6 && (
                  <Pressable onPress={() => setPicker({ kind: 'rotation', team: t })} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.link}>Edit</Text>
                  </Pressable>
                )}
              </View>
            );
          })}
          <Button
            label={`Start set ${board.nextSet.number}`}
            onPress={startSet}
            disabled={!firstServer || offline}
            size="lg"
            fullWidth
          />
          {error && error.teamId === null && <Text style={styles.error}>{error.message}</Text>}
        </View>
      )}

      {/* Match decided */}
      {board.matchDecided && !finished && winner && (
        <View style={[styles.card, styles.setupCard]}>
          <Text style={styles.cardTitle}>{winner.label} wins the match</Text>
          <Text style={styles.meta}>
            {board.teams.map((t) => `${short(t)} ${t.setsWon}`).join(' – ')} in sets. Finish to record the result, or Undo the last point.
          </Text>
          <Button label="Finish match" onPress={finish} disabled={offline} size="lg" fullWidth icon={<Icon name="flag" size={17} color={COLORS.textInverse} />} />
        </View>
      )}
      {finished && winner && (
        <View style={styles.banner}>
          <Icon name="flag" size={15} color={COLORS.textSecondary} />
          <Text style={styles.bannerText}>
            Final · {winner.label} won {Math.max(...board.teams.map((t) => t.setsWon))}–{Math.min(...board.teams.map((t) => t.setsWon))}
          </Text>
        </View>
      )}

      {/* Team panels */}
      <View style={sideBySide ? styles.row : styles.column}>
        {board.teams.map((team) => {
          const sel = selected?.teamId === team.id ? team.players.find((p) => p.playerId === selected.playerId) : undefined;
          const server = team.players.find((p) => p.playerId === team.serverPlayerId);
          return (
            <View key={team.id} style={[styles.card, sideBySide && styles.flex, team.serving && playing && styles.cardServing]}>
              <View style={styles.teamHead}>
                <Text style={[styles.teamName, styles.flex]} numberOfLines={1}>{short(team)}</Text>
                <Text style={styles.meta}>
                  Sets won: <Text style={styles.strong}>{team.setsWon}</Text>
                </Text>
              </View>
              <View style={styles.teamHead}>
                <Text style={[styles.score, styles.flex]} accessibilityLabel={`${short(team)} ${team.points} points`}>{team.points}</Text>
                {playing &&
                  (team.serving ? (
                    <View style={styles.servingBadge}>
                      <Icon name="circle-dot" size={12} color={COLORS.info} />
                      <Text style={styles.servingText}>Serving{server ? `: #${server.jersey}` : ''}</Text>
                    </View>
                  ) : (
                    <Text style={styles.meta}>Receiving</Text>
                  ))}
              </View>

              {playing && (
                <View style={styles.teamHead}>
                  <Text style={[styles.meta, styles.flex]}>Timeouts left: {team.timeoutsLeft}</Text>
                  {team.rotation && (
                    <SmallButton label="Sub" onPress={() => setPicker({ kind: 'sub', team })} disabled={offline || team.substitutionsLeft === 0} />
                  )}
                  <SmallButton label="Timeout" onPress={() => timeout(team)} disabled={offline || team.timeoutsLeft === 0} />
                </View>
              )}

              {team.players.length === 0 ? (
                <Text style={[styles.muted, styles.noRoster]}>No lineup from the coach yet.</Text>
              ) : (
                <JerseyGrid
                  players={orderForCourt(team)}
                  hasRotation={!!team.rotation}
                  selectedId={sel?.playerId ?? null}
                  disabled={!playing || offline}
                  onPress={(playerId) => {
                    Haptics.selectionAsync().catch(() => {});
                    setError(null);
                    setSelected((s) => (s?.playerId === playerId ? null : { teamId: team.id, playerId }));
                  }}
                />
              )}

              {playing && (
                <>
                  <Text style={sel ? styles.selected : styles.meta}>
                    {sel ? (
                      <>
                        Selected: <Text style={styles.selectedName}>#{sel.jersey} {lastName(sel.name)}</Text>
                      </>
                    ) : (
                      'Player optional'
                    )}
                  </Text>
                  <View style={styles.actions}>
                    {POINTS.map((a) => {
                      const aceOff = a.type === 'ACE' && !team.serving;
                      return (
                        <Pressable
                          key={a.type}
                          onPress={() => point(team, a.type)}
                          disabled={offline || aceOff}
                          accessibilityRole="button"
                          accessibilityLabel={`${LABEL[a.type]} for ${short(team)}`}
                          style={({ pressed }) => [styles.action, pressed && styles.actionPressed, (offline || aceOff) && styles.disabled]}
                        >
                          <Text style={styles.actionText}>{a.label}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  {error?.teamId === team.id && <Text style={styles.error} accessibilityRole="alert">{error.message}</Text>}
                </>
              )}
            </View>
          );
        })}
      </View>

      {error && error.teamId === null && !board.nextSet && <Text style={styles.error} accessibilityRole="alert">{error.message}</Text>}
      {lastAction && !error && <Text style={styles.lastAction}>{lastAction}</Text>}

      {/* Set results + event log */}
      <View style={styles.card}>
        <View style={styles.teamHead}>
          <Text style={[styles.cardTitle, styles.flex]}>Set results</Text>
          {board.sets.filter((s) => s.winnerTeamId).length === 0 && <Text style={styles.muted}>None yet</Text>}
        </View>
        {board.sets
          .filter((s) => s.winnerTeamId)
          .map((s) => {
            const w = board.teams.find((t) => t.id === s.winnerTeamId);
            return (
              <View key={s.number} style={styles.logRow}>
                <Text style={[styles.logText, styles.flex]}>Set {s.number} · {w ? short(w) : ''}</Text>
                <Text style={styles.logScore}>{s.home}–{s.away}</Text>
              </View>
            );
          })}

        <Text style={[styles.cardTitle, { marginTop: SPACING.sm }]}>Event log</Text>
        {board.log.length === 0 ? (
          <Text style={styles.muted}>No rallies yet.</Text>
        ) : (
          board.log.map((l) => (
            <View key={l.id} style={styles.logRow}>
              <Text style={[styles.logText, styles.flex]} numberOfLines={1}>{logText(l, board)}</Text>
              {l.set > 0 && <Text style={styles.logScore}>S{l.set} · {l.homeScore}-{l.awayScore}</Text>}
            </View>
          ))
        )}
      </View>

      {/* Player stats */}
      <View style={sideBySide ? styles.row : styles.column}>
        {board.teams.map((team) => (
          <View key={team.id} style={[styles.card, sideBySide && styles.flex]}>
            <Text style={styles.cardTitle}>{short(team)} stats</Text>
            <Stats team={team} />
          </View>
        ))}
      </View>

      <PlayerPicker
        picker={picker}
        rotations={rotations}
        onClose={() => setPicker(null)}
        onRotation={(teamId, rot) => setRotations((r) => ({ ...r, [teamId]: rot }))}
        onSub={(team, outId, inId) =>
          run(() => volleyballService.substitute(event.id, { teamId: team.id, playerOutId: outId, playerInId: inId }), team.id, () => {
            const out = team.players.find((p) => p.playerId === outId);
            const inn = team.players.find((p) => p.playerId === inId);
            setLastAction(`${short(team)} · Sub #${inn?.jersey} for #${out?.jersey}`);
          })
        }
      />
    </View>
  );
}

function jerseyOf(team: VolleyballTeam, playerId: string): string | null {
  return team.players.find((p) => p.playerId === playerId)?.jersey ?? null;
}

/** On-court players in rotation order (I first), then the bench. */
function orderForCourt(team: VolleyballTeam): VolleyballPlayer[] {
  if (!team.rotation) return team.players;
  const court = team.rotation.map((id) => team.players.find((p) => p.playerId === id)).filter(Boolean) as VolleyballPlayer[];
  return [...court, ...team.players.filter((p) => !p.onCourt)];
}

function logText(l: VolleyballLogEntry, board: Board): string {
  const team = board.teams.find((t) => t.id === l.teamId);
  const who = team ? short(team) : 'Team';
  switch (l.type) {
    case 'SET_START':
      return `Set ${l.set} starts · ${who} serve`;
    case 'TIMEOUT':
      return `${who} · Timeout`;
    case 'SUB':
      return `${who} · Sub ${tag(l.jersey, l.playerName)} for ${tag(l.playerOutJersey, l.playerOutName)}`;
    default:
      return `${who} · ${LABEL[l.type]}${l.jersey ? ` · ${tag(l.jersey, null)}` : ''}`;
  }
}

function ToolButton({ icon, label, onPress, disabled }: { icon: 'rotate-ccw'; label: string; onPress: () => void; disabled?: boolean }) {
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

function SmallButton({ label, onPress, disabled }: { label: string; onPress: () => void; disabled?: boolean }) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      hitSlop={6}
      style={({ pressed }) => [styles.small, pressed && styles.actionPressed, disabled && styles.disabled]}
    >
      <Text style={styles.smallText}>{label}</Text>
    </Pressable>
  );
}

/** Four jerseys per row, sized from the card's width. Bench players are dimmed while a rotation is known. */
function JerseyGrid({
  players,
  hasRotation,
  selectedId,
  disabled,
  onPress,
}: {
  players: VolleyballPlayer[];
  hasRotation: boolean;
  selectedId: string | null;
  disabled: boolean;
  onPress: (playerId: string) => void;
}) {
  const [w, setW] = useState(0);
  const cell = w ? (w - GAP * 3) / 4 : 0;

  return (
    <View style={styles.grid} onLayout={(e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width)}>
      {cell > 0 &&
        players.map((p) => {
          const on = p.playerId === selectedId;
          const bench = hasRotation && !p.onCourt;
          return (
            <Pressable
              key={p.playerId}
              onPress={() => onPress(p.playerId)}
              disabled={disabled || bench}
              accessibilityRole="button"
              accessibilityState={{ selected: on, disabled: disabled || bench }}
              accessibilityLabel={`#${p.jersey} ${p.name}${bench ? ', on the bench' : p.position ? `, position ${ROMAN[p.position - 1]}` : ''}`}
              style={({ pressed }) => [
                styles.jersey,
                { width: cell },
                bench && styles.jerseyBench,
                on && styles.jerseyOn,
                pressed && !on && styles.actionPressed,
              ]}
            >
              <Text style={[styles.jerseyNum, on && styles.jerseyTextOn, bench && styles.jerseyTextBench]}>#{p.jersey}</Text>
              <Text style={[styles.jerseyName, on && styles.jerseyTextOn]} numberOfLines={1}>
                {p.position ? `${ROMAN[p.position - 1]} · ` : ''}
                {lastName(p.name)}
              </Text>
            </Pressable>
          );
        })}
    </View>
  );
}

function Stats({ team }: { team: VolleyballTeam }) {
  const cols: { key: 'kills' | 'aces' | 'blocks' | 'pts'; label: string }[] = [
    { key: 'kills', label: 'K' },
    { key: 'aces', label: 'A' },
    { key: 'blocks', label: 'B' },
    { key: 'pts', label: 'PTS' },
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
      {team.oppErrorPoints > 0 && (
        <View style={styles.boxRow}>
          <Text style={[styles.boxPlayer, styles.muted]}>Opponent errors</Text>
          <Text style={[styles.boxCell, { flex: 3 }]} />
          <Text style={[styles.boxCell, styles.boxPts]}>{team.oppErrorPoints}</Text>
        </View>
      )}
    </View>
  );
}

/**
 * Two pickers in one sheet:
 *  - rotation: tap six players in order, I to VI
 *  - sub: tap who comes off (on court), then who goes on (bench)
 */
function PlayerPicker({
  picker,
  rotations,
  onClose,
  onRotation,
  onSub,
}: {
  picker: Picker;
  rotations: Record<string, string[] | null>;
  onClose: () => void;
  onRotation: (teamId: string, rotation: string[] | null) => void;
  onSub: (team: VolleyballTeam, outId: string, inId: string) => void;
}) {
  const [chosen, setChosen] = useState<string[]>([]);
  const [outId, setOutId] = useState<string | null>(null);

  useEffect(() => {
    // Deliberate: each time the sheet opens it starts from scratch.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setChosen([]);
    setOutId(null);
  }, [picker]);

  if (!picker) return null;
  const { team } = picker;
  const isRotation = picker.kind === 'rotation';

  const list = isRotation ? team.players : outId ? team.players.filter((p) => !p.onCourt) : team.players.filter((p) => p.onCourt);

  const title = isRotation
    ? chosen.length < 6
      ? `${short(team)} rotation · pick position ${ROMAN[chosen.length]}`
      : `${short(team)} rotation`
    : outId
      ? 'Who goes on?'
      : 'Who comes off?';

  const tap = (id: string) => {
    Haptics.selectionAsync().catch(() => {});
    if (isRotation) {
      setChosen((c) => (c.includes(id) ? c.filter((x) => x !== id) : c.length < 6 ? [...c, id] : c));
    } else if (!outId) {
      setOutId(id);
    } else {
      onSub(team, outId, id);
      onClose();
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.sheetBackdrop}>
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.teamHead}>
            <Text style={[styles.cardTitle, styles.flex]}>{title}</Text>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close">
              <Icon name="close" size={20} color={COLORS.textSecondary} />
            </Pressable>
          </View>
          {isRotation && (
            <Text style={styles.meta}>
              Position I serves first. Current: {(rotations[team.id] ?? []).map((id, i) => `${ROMAN[i]} #${jerseyOf(team, id)}`).join(' · ') || 'none'}
            </Text>
          )}
          <ScrollView contentContainerStyle={styles.sheetList}>
            {list.map((p) => {
              const idx = chosen.indexOf(p.playerId);
              return (
                <Pressable
                  key={p.playerId}
                  onPress={() => tap(p.playerId)}
                  accessibilityRole="button"
                  style={({ pressed }) => [styles.sheetRow, idx >= 0 && styles.sheetRowOn, pressed && styles.actionPressed]}
                >
                  <Text style={styles.sheetJersey}>#{p.jersey}</Text>
                  <Text style={[styles.bannerText, styles.flex]} numberOfLines={1}>{p.name}</Text>
                  {idx >= 0 && <Text style={styles.sheetPos}>{ROMAN[idx]}</Text>}
                </Pressable>
              );
            })}
            {list.length === 0 && <Text style={styles.muted}>No one to pick.</Text>}
          </ScrollView>
          {isRotation && (
            <View style={styles.row2}>
              <Button
                label="No rotation"
                variant="secondary"
                onPress={() => {
                  onRotation(team.id, null);
                  onClose();
                }}
                style={styles.flex}
              />
              <Button
                label="Use this rotation"
                onPress={() => {
                  onRotation(team.id, chosen);
                  onClose();
                }}
                disabled={chosen.length !== 6}
                style={styles.flex}
              />
            </View>
          )}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const GAP = SPACING.sm;

const styles = StyleSheet.create({
  wrap: { gap: SPACING.md },
  flex: { flex: 1 },
  row: { flexDirection: 'row', gap: SPACING.md, alignItems: 'flex-start' },
  row2: { flexDirection: 'row', gap: SPACING.sm },
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
  cardServing: { borderColor: COLORS.info, borderWidth: 1.5 },
  setupCard: { borderColor: COLORS.borderStrong },
  cardTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  label: { ...TYPE.label, color: COLORS.textPrimary },
  muted: { ...TYPE.bodySm, color: COLORS.textMuted },
  meta: { ...TYPE.bodySm, color: COLORS.textSecondary },
  strong: { ...TYPE.label, color: COLORS.textPrimary },
  link: { ...TYPE.label, color: COLORS.info },

  topBar: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, flexWrap: 'wrap' },
  chip: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs + 2, borderRadius: RADIUS.md, backgroundColor: COLORS.infoLight },
  chipText: { ...TYPE.label, color: COLORS.info },
  segment: { flexDirection: 'row', padding: 2, borderRadius: RADIUS.md, backgroundColor: COLORS.surfaceAlt },
  segmentItem: { minHeight: 36, paddingHorizontal: SPACING.md, justifyContent: 'center', borderRadius: RADIUS.sm },
  segmentOn: { backgroundColor: COLORS.surface, ...SHADOWS.sm },
  segmentText: { ...TYPE.label, color: COLORS.textSecondary },
  segmentTextOn: { color: COLORS.textPrimary },
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
  small: {
    minHeight: 34,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
  },
  smallText: { ...TYPE.label, color: COLORS.textPrimary },

  banner: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.sm, padding: SPACING.md, borderRadius: RADIUS.lg, backgroundColor: COLORS.surfaceAlt },
  bannerWarn: { backgroundColor: COLORS.warningLight },
  bannerInfo: { backgroundColor: COLORS.infoLight },
  bannerText: { ...TYPE.bodySm, color: COLORS.textPrimary, flexShrink: 1 },
  bannerSub: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: 2 },

  choice: { flex: 1, minHeight: 48, alignItems: 'center', justifyContent: 'center', borderRadius: RADIUS.lg, borderWidth: 1, borderColor: COLORS.border },
  choiceOn: { backgroundColor: COLORS.action, borderColor: COLORS.action },
  choiceText: { ...TYPE.subhead, color: COLORS.textPrimary },
  choiceTextOn: { color: COLORS.actionOn },
  rotationRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },

  teamHead: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  teamName: { ...TYPE.heading, color: COLORS.textPrimary },
  score: { fontSize: 44, lineHeight: 48, fontWeight: '700', letterSpacing: -1.2, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  servingBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: SPACING.sm, paddingVertical: 3, borderRadius: RADIUS.md, backgroundColor: COLORS.infoLight },
  servingText: { ...TYPE.label, color: COLORS.info },
  noRoster: { paddingVertical: SPACING.sm },

  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  jersey: {
    minHeight: 56,
    paddingVertical: SPACING.sm,
    paddingHorizontal: 2,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.border,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  jerseyBench: { backgroundColor: COLORS.surfaceAlt, borderStyle: 'dashed' },
  jerseyOn: { backgroundColor: COLORS.action, borderColor: COLORS.action },
  jerseyNum: { ...TYPE.subhead, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  jerseyName: { ...TYPE.caption, color: COLORS.textSecondary, textAlign: 'center' },
  jerseyTextOn: { color: COLORS.actionOn },
  jerseyTextBench: { color: COLORS.textMuted },

  selected: { ...TYPE.bodySm, color: COLORS.textSecondary },
  selectedName: { ...TYPE.label, color: COLORS.brandText },

  actions: { flexDirection: 'row', gap: GAP },
  action: {
    flex: 1,
    minHeight: 56,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    backgroundColor: COLORS.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 2,
  },
  actionPressed: { backgroundColor: COLORS.surfaceMuted },
  actionText: { ...TYPE.label, color: COLORS.textPrimary, textAlign: 'center' },
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

  logRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingVertical: SPACING.xs + 3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.hairline },
  logText: { ...TYPE.bodySm, color: COLORS.textPrimary },
  logScore: { ...TYPE.bodySm, color: COLORS.textSecondary, fontVariant: ['tabular-nums'] },

  boxRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: SPACING.xs + 3, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.hairline },
  boxHead: { borderTopWidth: 0 },
  boxHeadText: { ...TYPE.caption, color: COLORS.textMuted },
  boxPlayer: { flex: 3, ...TYPE.bodySm, color: COLORS.textPrimary },
  boxCell: { flex: 1, ...TYPE.bodySm, color: COLORS.textSecondary, textAlign: 'center', fontVariant: ['tabular-nums'] },
  boxPts: { color: COLORS.textPrimary, fontWeight: '600' },

  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: COLORS.overlay },
  sheet: { maxHeight: '80%', backgroundColor: COLORS.surface, borderTopLeftRadius: RADIUS.xxl, borderTopRightRadius: RADIUS.xxl, padding: SPACING.lg, gap: SPACING.md },
  sheetList: { gap: SPACING.xs },
  sheetRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, minHeight: 48, paddingHorizontal: SPACING.md, borderRadius: RADIUS.lg },
  sheetRowOn: { backgroundColor: COLORS.infoLight },
  sheetJersey: { ...TYPE.subhead, color: COLORS.textPrimary, width: 40, fontVariant: ['tabular-nums'] },
  sheetPos: { ...TYPE.label, color: COLORS.info },
});
