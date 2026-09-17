import { Icon } from '../ui/Icon';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';
import { useDeptAbbreviator } from '../../hooks/use-dept-abbr';
import { useNetwork } from '../../hooks/use-network';
import { liveScoreService } from '../../services/live-score.service';
import type { EventSession, LiveScore, LiveStatus } from '../../types';
import { getSportConfigFromEvent } from '../../utils/sport-config';

// ─────────────────────────────────────────────────────────────────────────────
// LivePublishPanel — the scorekeeper's control that publishes the running
// score to the public board. Debounced auto-save; last-write-wins with a
// version guard; offline-tolerant.
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  event: EventSession;
}

type Sync = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export function LivePublishPanel({ event }: Props) {
  const sportCfg = getSportConfigFromEvent(event.category, event.name);
  const accent = sportCfg.color;
  // Table Tennis / Tennis are scored as GAMES WON; the Committee sets Best-of-2
  // / -3. Badminton keeps the plain running-score panel.
  const isRacquet = sportCfg.type === 'table-tennis' || sportCfg.type === 'tennis';
  const abbr = useDeptAbbreviator();
  const { isConnected } = useNetwork();

  const depts = event.departments ?? [];
  const homeTeam = depts[0] ?? 'Home';
  const awayTeam = depts[1] ?? 'Away';

  const [home, setHome]       = useState(0);
  const [away, setAway]       = useState(0);
  const [period, setPeriod]   = useState('');
  const [status, setStatus]   = useState<LiveStatus>('scheduled');
  const [version, setVersion] = useState(0);
  const [sync, setSync]       = useState<Sync>('idle');
  const [loaded, setLoaded]   = useState(false);
  // Best-of default: a Final is BO3, anything else BO2 — Committee can change it.
  const [bestOf, setBestOf]   = useState<2 | 3>(/final/i.test(event.name ?? '') ? 3 : 2);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const detailRef = useRef<Record<string, unknown>>({});

  const adopt = useCallback((ls: LiveScore) => {
    setHome(ls.homeScore);
    setAway(ls.awayScore);
    setPeriod(ls.period ?? '');
    setStatus(ls.status);
    setVersion(ls.version);
    detailRef.current = ls.detail ?? {};
    const b = (ls.detail as any)?.bestOf;
    if (b === 2 || b === 3) setBestOf(b);
  }, []);

  // Load any existing live score once.
  useEffect(() => {
    let alive = true;
    liveScoreService
      .get(event.id)
      .then((ls) => {
        if (!alive) return;
        if (ls) adopt(ls);
        setLoaded(true);
      })
      .catch(() => alive && setLoaded(true));
    return () => {
      alive = false;
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [event.id, adopt]);

  const push = useCallback(
    async (next: { home: number; away: number; period: string; status: LiveStatus }) => {
      if (!isConnected) {
        setSync('offline');
        return;
      }
      setSync('saving');
      try {
        const ls = await liveScoreService.push(event.id, {
          homeTeam,
          awayTeam,
          homeScore: next.home,
          awayScore: next.away,
          period: next.period || null,
          status: next.status,
          version,
          ...(isRacquet ? { detail: { ...detailRef.current, bestOf } } : {}),
        });
        adopt(ls);
        setSync('saved');
      } catch (err: any) {
        if (err?.code === 'LIVE_CONFLICT' && err.live) {
          adopt(err.live);
          setSync('saved');
          Alert.alert('Reloaded', 'Another device updated this game — showing the latest score.');
        } else if (err?.code === 'NETWORK_ERROR' || err?.code === 'TIMEOUT') {
          setSync('offline');
        } else {
          setSync('error');
          Alert.alert('Not saved', err?.message || 'Could not update the live score.');
        }
      }
    },
    [event.id, homeTeam, awayTeam, version, isConnected, adopt, isRacquet, bestOf],
  );

  const changeBestOf = (v: 2 | 3) => {
    setBestOf(v);
    detailRef.current = { ...detailRef.current, bestOf: v };
    if (status !== 'scheduled') push({ home, away, period, status });
  };

  const scheduleSave = useCallback(
    (h: number, a: number, p: string, s: LiveStatus) => {
      if (s === 'scheduled') return; // nothing to publish until "Start"
      if (debounceRef.current) clearTimeout(debounceRef.current);
      setSync('saving');
      debounceRef.current = setTimeout(() => push({ home: h, away: a, period: p, status: s }), 1200);
    },
    [push],
  );

  // Retry a stuck offline save as soon as the connection returns.
  useEffect(() => {
    if (isConnected && sync === 'offline' && status !== 'scheduled') {
      push({ home, away, period, status });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  const bump = (side: 'home' | 'away', delta: number) => {
    if (status === 'final') return;
    const h = side === 'home' ? Math.max(0, home + delta) : home;
    const a = side === 'away' ? Math.max(0, away + delta) : away;
    setHome(h);
    setAway(a);
    scheduleSave(h, a, period, status);
  };

  const onPeriod = (t: string) => {
    setPeriod(t);
    scheduleSave(home, away, t, status);
  };

  const start = () => {
    setStatus('in_progress');
    push({ home, away, period, status: 'in_progress' });
  };

  const finalize = () => {
    Alert.alert(
      'Finalize game',
      `Final score  ${abbr(homeTeam)} ${home} – ${away} ${abbr(awayTeam)}?\n\nThis marks the event completed.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Finalize',
          style: 'destructive',
          onPress: () => {
            setStatus('final');
            push({ home, away, period, status: 'final' });
          },
        },
      ],
    );
  };

  const reopen = () => {
    setStatus('in_progress');
    push({ home, away, period, status: 'in_progress' });
  };

  if (!loaded) {
    return (
      <View style={styles.panel}>
        <Text style={styles.loadingText}>Loading live score…</Text>
      </View>
    );
  }

  const locked = status === 'final';

  return (
    <View style={[styles.panel, { borderColor: `${accent}33` }]}>
      {/* Header */}
      <View style={styles.headRow}>
        <View style={styles.headLeft}>
          <View style={[styles.dot, { backgroundColor: status === 'in_progress' ? COLORS.success : status === 'final' ? COLORS.textMuted : accent }]} />
          <Text style={styles.headTitle}>LIVE SCORE</Text>
          <View style={[styles.statusPill, {
            backgroundColor:
              status === 'in_progress' ? COLORS.successLight :
              status === 'final' ? COLORS.surfaceAlt : `${accent}15`,
          }]}>
            <Text style={[styles.statusPillText, {
              color: status === 'in_progress' ? COLORS.success : status === 'final' ? COLORS.textSecondary : accent,
            }]}>
              {status === 'in_progress' ? 'LIVE' : status === 'final' ? 'FINAL' : 'NOT STARTED'}
            </Text>
          </View>
        </View>
        <SyncChip sync={sync} onRetry={() => push({ home, away, period, status })} />
      </View>

      {/* Score */}
      <View style={styles.scoreRow}>
        <ScoreBlock team={abbr(homeTeam)} value={home} accent={accent} locked={locked} onBump={(d) => bump('home', d)} caption={isRacquet ? 'GAMES' : undefined} />
        <Text style={styles.dash}>–</Text>
        <ScoreBlock team={abbr(awayTeam)} value={away} accent={accent} locked={locked} onBump={(d) => bump('away', d)} caption={isRacquet ? 'GAMES' : undefined} />
      </View>

      {/* Best-of (Table Tennis / Tennis) — Committee sets the match length */}
      {isRacquet && (
        <View style={styles.bestOfRow}>
          <Text style={styles.periodLabel}>Best of</Text>
          <View style={styles.segment}>
            {([2, 3] as const).map((v) => (
              <TouchableOpacity
                key={v}
                disabled={locked}
                onPress={() => changeBestOf(v)}
                style={[styles.segmentBtn, bestOf === v && { backgroundColor: accent }]}
                activeOpacity={0.85}
              >
                <Text style={[styles.segmentText, bestOf === v && { color: '#fff' }]}>BO{v}</Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.bestOfHint}>First to 2 games wins</Text>
        </View>
      )}

      {/* Period + actions */}
      {!locked && (
        <View style={styles.periodRow}>
          <Text style={styles.periodLabel}>Period</Text>
          <TextInput
            style={styles.periodInput}
            value={period}
            onChangeText={onPeriod}
            placeholder="Q1 / Set 2 / 2nd Half"
            placeholderTextColor={COLORS.textMuted}
            maxLength={20}
          />
        </View>
      )}

      {status === 'scheduled' && (
        <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={start} activeOpacity={0.85}>
          <Icon name="play" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Start Live</Text>
        </TouchableOpacity>
      )}

      {status === 'in_progress' && (
        <TouchableOpacity style={[styles.outlineBtn, { borderColor: accent }]} onPress={finalize} activeOpacity={0.85}>
          <Icon name="flag" size={16} color={accent} />
          <Text style={[styles.outlineBtnText, { color: accent }]}>Finalize Game</Text>
        </TouchableOpacity>
      )}

      {status === 'final' && (
        <View style={styles.finalRow}>
          <Text style={styles.finalText}>Game finalised — event completed.</Text>
          <TouchableOpacity onPress={reopen}>
            <Text style={[styles.reopenText, { color: accent }]}>Reopen</Text>
          </TouchableOpacity>
        </View>
      )}

      <Text style={styles.footNote}>
        {status === 'scheduled'
          ? 'Starting publishes the score to the public Live board.'
          : 'Score updates publish automatically to the public Live board.'}
      </Text>
    </View>
  );
}

function ScoreBlock({
  team, value, accent, locked, onBump, caption,
}: {
  team: string; value: number; accent: string; locked: boolean; onBump: (d: number) => void; caption?: string;
}) {
  return (
    <View style={styles.block}>
      <Text style={styles.blockTeam} numberOfLines={1}>{team}</Text>
      {caption && <Text style={styles.blockCaption}>{caption}</Text>}
      <Text style={[styles.blockScore, { color: accent }]}>{value}</Text>
      {!locked && (
        <View style={styles.stepRow}>
          <TouchableOpacity style={[styles.stepBtn, { borderColor: `${accent}40` }]} onPress={() => onBump(-1)} accessibilityLabel={`${team} minus one`}>
            <Icon name="minus" size={18} color={accent} strokeWidth={2.6} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.stepBtn, { borderColor: `${accent}40` }]} onPress={() => onBump(1)} accessibilityLabel={`${team} plus one`}>
            <Icon name="plus" size={18} color={accent} strokeWidth={2.6} />
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

function SyncChip({ sync, onRetry }: { sync: Sync; onRetry: () => void }) {
  if (sync === 'idle') return null;
  if (sync === 'saving') return <Text style={styles.syncMuted}>Saving…</Text>;
  if (sync === 'saved') return <Text style={[styles.syncMuted, { color: COLORS.success }]}>✓ Published</Text>;
  if (sync === 'error') return <Text style={[styles.syncMuted, { color: COLORS.error }]}>Save failed</Text>;
  return (
    <TouchableOpacity onPress={onRetry} style={styles.retryChip}>
      <Icon name="cloud-off" size={12} color={COLORS.warning} strokeWidth={2.2} />
      <Text style={styles.retryText}>Offline · Retry</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: COLORS.border,
    padding: SPACING.md,
    gap: SPACING.sm,
    ...SHADOWS.sm,
  },
  loadingText: { fontSize: FONT_SIZE.sm, color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.sm },

  headRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headLeft: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  dot: { width: 8, height: 8, borderRadius: RADIUS.full },
  headTitle: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.extrabold, color: COLORS.textPrimary, letterSpacing: 0.8 },
  statusPill: { paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: RADIUS.full },
  statusPillText: { fontSize: 9, fontWeight: FONT_WEIGHT.bold, letterSpacing: 0.5 },

  syncMuted: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, fontWeight: FONT_WEIGHT.medium },
  retryChip: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  retryText: { fontSize: FONT_SIZE.xs, color: COLORS.warning, fontWeight: FONT_WEIGHT.semibold },

  scoreRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: SPACING.md, paddingVertical: SPACING.xs },
  dash: { fontSize: 32, color: COLORS.textMuted, marginTop: 18, fontWeight: FONT_WEIGHT.regular },
  block: { alignItems: 'center', gap: 4, flex: 1 },
  blockTeam: {
    fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.3, textAlign: 'center',
  },
  blockScore: { fontSize: 46, fontWeight: FONT_WEIGHT.extrabold, lineHeight: 52 },
  stepRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: 2 },
  stepBtn: {
    width: 38, height: 38, borderRadius: RADIUS.md, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.surface,
  },

  periodRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  periodLabel: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.semibold, color: COLORS.textSecondary, textTransform: 'uppercase' },
  blockCaption: { fontSize: 9, fontWeight: FONT_WEIGHT.bold, color: COLORS.textMuted, letterSpacing: 0.6 },

  bestOfRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, backgroundColor: COLORS.surface },
  segmentText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold, color: COLORS.textSecondary },
  bestOfHint: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted, flex: 1 },
  periodInput: {
    flex: 1, borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm, paddingVertical: SPACING.xs, fontSize: FONT_SIZE.sm,
    fontWeight: FONT_WEIGHT.semibold, color: COLORS.textPrimary, backgroundColor: COLORS.surface,
  },

  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    borderRadius: RADIUS.md, paddingVertical: SPACING.md, ...SHADOWS.sm,
  },
  primaryBtnText: { fontSize: FONT_SIZE.md, fontWeight: FONT_WEIGHT.bold, color: '#fff' },
  outlineBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: SPACING.xs,
    borderRadius: RADIUS.md, borderWidth: 1.5, paddingVertical: SPACING.sm + 2, backgroundColor: COLORS.surface,
  },
  outlineBtnText: { fontSize: FONT_SIZE.sm, fontWeight: FONT_WEIGHT.bold },

  finalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  finalText: { fontSize: FONT_SIZE.xs, color: COLORS.textSecondary },
  reopenText: { fontSize: FONT_SIZE.xs, fontWeight: FONT_WEIGHT.bold },

  footNote: { fontSize: FONT_SIZE.xs, color: COLORS.textMuted },
});
