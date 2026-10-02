import React, { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../../constants/theme';
import { useDeptAbbreviator, useDeptLogos } from '../../hooks/use-dept-abbr';
import { useLiveSync } from '../../hooks/use-live-sync';
import { useNetwork } from '../../hooks/use-network';
import { liveScoreService } from '../../services/live-score.service';
import type { EventSession, LiveScore, LiveStatus, ScoringMethodLive } from '../../types';
import { getSportConfigFromEvent } from '../../utils/sport-config';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { TeamLogo } from '../ui/TeamLogo';

// ─────────────────────────────────────────────────────────────────────────────
// MatchScoreboard — the one scoring surface for a two-college game.
//
// Kept live: every change publishes (debounced) to the public board, with a
// version guard so two devices can't silently overwrite each other, and the
// screen picks up the other device's changes every few seconds. Finalizing
// records the head-to-head result and completes the event.
//
// Recorded from paper: the committee starts the game "on paper" (the public
// sees "In progress", no score), and the scanned score sheet fills both
// scores and asks to record them as the final, so both of the committee's
// methods end in the same place.
//
// Either way the score sheet is printed first: a notice above the Start
// buttons says so (a reminder, not a lock).
// ─────────────────────────────────────────────────────────────────────────────

export interface MatchScoreboardHandle {
  /** Fill both scores from a scanned sheet and offer to record them as final. */
  recordFromSheet: (home: number, away: number, sheetImageUrl: string | null) => void;
}

type Sync = 'idle' | 'saving' | 'saved' | 'offline' | 'error';

export const MatchScoreboard = forwardRef<
  MatchScoreboardHandle,
  { event: EventSession; onPrintSheet?: () => void }
>(
  function MatchScoreboard({ event, onPrintSheet }, ref) {
    const sportCfg = getSportConfigFromEvent(event.category, event.name);
    // Table tennis / tennis are scored in games won; the committee sets BO2/BO3.
    const isRacquet = sportCfg.type === 'table-tennis' || sportCfg.type === 'tennis';
    const abbr = useDeptAbbreviator();
    const logoOf = useDeptLogos();
    const { isConnected } = useNetwork();

    const depts = event.departments ?? [];
    const homeTeam = depts[0] ?? 'Home';
    const awayTeam = depts[1] ?? 'Away';

    const [home, setHome] = useState(0);
    const [away, setAway] = useState(0);
    const [period, setPeriod] = useState('');
    const [status, setStatus] = useState<LiveStatus>('scheduled');
    const [method, setMethod] = useState<ScoringMethodLive>('live');
    const [version, setVersion] = useState(0);
    const [sync, setSync] = useState<Sync>('idle');
    const [loaded, setLoaded] = useState(false);
    const [bestOf, setBestOf] = useState<2 | 3>(/final/i.test(event.name ?? '') ? 3 : 2);

    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const detailRef = useRef<Record<string, unknown>>({});
    // True while this phone has a change the server doesn't have yet (waiting
    // on the debounce, being saved, or failed to save). The background sync
    // never overwrites it.
    const pendingRef = useRef(false);
    const versionRef = useRef(0);

    const adopt = useCallback((ls: LiveScore) => {
      versionRef.current = ls.version;
      setHome(ls.homeScore);
      setAway(ls.awayScore);
      setPeriod(ls.period ?? '');
      setStatus(ls.status);
      setMethod(ls.method ?? 'live');
      setVersion(ls.version);
      detailRef.current = ls.detail ?? {};
      const b = (ls.detail as any)?.bestOf;
      if (b === 2 || b === 3) setBestOf(b);
    }, []);

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
      async (next: {
        home: number;
        away: number;
        period: string;
        status: LiveStatus;
        method?: ScoringMethodLive;
      }) => {
        pendingRef.current = true;
        if (!isConnected) {
          setSync('offline');
          return;
        }
        setSync('saving');
        try {
          const detail = isRacquet ? { ...detailRef.current, bestOf } : detailRef.current;
          const ls = await liveScoreService.push(event.id, {
            homeTeam,
            awayTeam,
            homeScore: next.home,
            awayScore: next.away,
            period: next.period || null,
            status: next.status,
            ...(next.method ? { method: next.method } : {}),
            version,
            ...(Object.keys(detail).length ? { detail } : {}),
          });
          adopt(ls);
          pendingRef.current = false;
          setSync('saved');
        } catch (err: any) {
          if (err?.code === 'LIVE_CONFLICT' && err.live) {
            adopt(err.live);
            pendingRef.current = false;
            setSync('saved');
            Alert.alert('Reloaded', 'Another device updated this game — showing the latest score.');
          } else if (err?.code === 'NETWORK_ERROR' || err?.code === 'TIMEOUT') {
            setSync('offline');
          } else {
            setSync('error');
            Alert.alert('Not saved', err?.message || 'Could not update the score.');
          }
        }
      },
      [event.id, homeTeam, awayTeam, version, isConnected, adopt, isRacquet, bestOf],
    );

    const scheduleSave = useCallback(
      (h: number, a: number, p: string, s: LiveStatus) => {
        if (s === 'scheduled') return; // nothing is public until the game starts
        pendingRef.current = true;
        if (debounceRef.current) clearTimeout(debounceRef.current);
        setSync('saving');
        debounceRef.current = setTimeout(() => push({ home: h, away: a, period: p, status: s }), 1200);
      },
      [push],
    );

    // Retry a stuck offline save as soon as the connection is back.
    useEffect(() => {
      if (isConnected && sync === 'offline' && status !== 'scheduled') {
        // Deliberate: reconnecting is an external event we sync to.
        // eslint-disable-next-line react-hooks/set-state-in-effect
        push({ home, away, period, status });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isConnected]);

    const confirmFinal = useCallback(
      (h: number, a: number, fromSheet: boolean) => {
        Alert.alert(
          fromSheet ? 'Record final score' : 'Finalize game',
          `${abbr(homeTeam)} ${h} – ${a} ${abbr(awayTeam)}\n\n` +
            'This records the result and marks the game completed.',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: fromSheet ? 'Record final' : 'Finalize',
              style: 'destructive',
              onPress: () => {
                if (debounceRef.current) clearTimeout(debounceRef.current);
                setStatus('final');
                push({ home: h, away: a, period, status: 'final' });
              },
            },
          ],
        );
      },
      [abbr, homeTeam, awayTeam, period, push],
    );

    useImperativeHandle(
      ref,
      () => ({
        recordFromSheet: (h, a, sheetImageUrl) => {
          setHome(h);
          setAway(a);
          if (sheetImageUrl) detailRef.current = { ...detailRef.current, sheetImageUrl };
          confirmFinal(h, a, true);
        },
      }),
      [confirmFinal],
    );

    const bump = (side: 'home' | 'away', delta: number) => {
      if (status === 'final') return;
      Haptics.selectionAsync().catch(() => {});
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

    const changeBestOf = (v: 2 | 3) => {
      setBestOf(v);
      detailRef.current = { ...detailRef.current, bestOf: v };
      if (status !== 'scheduled') push({ home, away, period, status });
    };

    const start = (m: ScoringMethodLive) => {
      setStatus('in_progress');
      setMethod(m);
      push({ home, away, period, status: 'in_progress', method: m });
    };

    const switchToLive = () => {
      setMethod('live');
      push({ home, away, period, status, method: 'live' });
    };

    const reopen = () => {
      setStatus('in_progress');
      push({ home, away, period, status: 'in_progress' });
    };

    // Another committee phone may be scoring this game too: pick up its
    // changes every few seconds, unless this phone has its own unsaved one.
    useLiveSync(
      () => {
        liveScoreService.get(event.id).then(
          (ls) => {
            if (ls && !pendingRef.current && ls.version > versionRef.current) adopt(ls);
          },
          () => {},
        );
      },
      isConnected && loaded && status !== 'final',
    );

    if (!loaded) {
      return (
        <View style={styles.card}>
          <Text style={styles.muted}>Loading the scoreboard…</Text>
        </View>
      );
    }

    const locked = status === 'final';
    // On paper there's no running score to keep: the sheet's final is scanned in.
    const onPaper = method === 'paper' && status === 'in_progress';
    const winner = locked ? (home > away ? 'home' : away > home ? 'away' : null) : null;

    return (
      <View style={[styles.card, status === 'in_progress' && styles.cardLive]}>
        <View style={styles.topRow}>
          <StatusPill status={status} onPaper={onPaper} />
          <SyncChip sync={sync} onRetry={() => push({ home, away, period, status })} />
        </View>

        <View style={styles.board}>
          <Side
            name={homeTeam}
            label={abbr(homeTeam)}
            logoUrl={logoOf(homeTeam)}
            value={home}
            dim={winner === 'away'}
            locked={locked || onPaper}
            caption={isRacquet ? 'Games' : undefined}
            onBump={(d) => bump('home', d)}
          />
          <Text style={styles.vs}>{locked ? 'FINAL' : '–'}</Text>
          <Side
            name={awayTeam}
            label={abbr(awayTeam)}
            logoUrl={logoOf(awayTeam)}
            value={away}
            dim={winner === 'home'}
            locked={locked || onPaper}
            caption={isRacquet ? 'Games' : undefined}
            onBump={(d) => bump('away', d)}
          />
        </View>

        {!locked && !onPaper && (
          <View style={styles.fieldRow}>
            {isRacquet ? (
              <>
                <Text style={styles.fieldLabel}>Best of</Text>
                <View style={styles.segment}>
                  {([2, 3] as const).map((v) => (
                    <Pressable
                      key={v}
                      onPress={() => changeBestOf(v)}
                      style={[styles.segmentBtn, bestOf === v && styles.segmentBtnOn]}
                    >
                      <Text style={[styles.segmentText, bestOf === v && styles.segmentTextOn]}>{v}</Text>
                    </Pressable>
                  ))}
                </View>
              </>
            ) : null}
            <Text style={styles.fieldLabel}>Period</Text>
            <TextInput
              style={styles.periodInput}
              value={period}
              onChangeText={onPeriod}
              placeholder="Q1 · Set 2 · 2nd half"
              placeholderTextColor={COLORS.textMuted}
              maxLength={20}
            />
          </View>
        )}

        {status === 'scheduled' && (
          <>
            <View style={styles.notice} accessibilityRole="text">
              <Icon name="info" size={16} color={COLORS.info} strokeWidth={2.2} />
              <View style={styles.flex}>
                <Text style={styles.noticeTitle}>Print the score sheet first</Text>
                <Text style={styles.noticeText}>
                  Print the physical score sheet before you start the game, whether you score live in
                  the app or on paper.
                </Text>
                {onPrintSheet && (
                  <Pressable onPress={onPrintSheet} hitSlop={8} accessibilityRole="button">
                    <Text style={styles.noticeLink}>Open the score sheet</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <Button
              label="Start · score live"
              onPress={() => start('live')}
              size="lg"
              fullWidth
              icon={<Icon name="play" size={16} color={COLORS.textInverse} />}
            />
            <Button
              label="Start · score on paper"
              onPress={() => start('paper')}
              variant="secondary"
              size="lg"
              fullWidth
              icon={<Icon name="file-text" size={16} color={COLORS.textPrimary} />}
            />
          </>
        )}
        {onPaper && (
          <View style={styles.notice}>
            <Icon name="file-text" size={16} color={COLORS.info} strokeWidth={2.2} />
            <View style={styles.flex}>
              <Text style={styles.noticeTitle}>Scoring on paper</Text>
              <Text style={styles.noticeText}>
                The public sees this game as In progress, without a score. When it ends, tap Scan paper
                sheet below to record the final.
              </Text>
              <Pressable onPress={switchToLive} hitSlop={8} accessibilityRole="button">
                <Text style={styles.noticeLink}>Switch to live scoring</Text>
              </Pressable>
            </View>
          </View>
        )}
        {status === 'in_progress' && !onPaper && (
          <Button
            label="Finalize game"
            onPress={() => confirmFinal(home, away, false)}
            variant="secondary"
            size="lg"
            fullWidth
            icon={<Icon name="flag" size={16} color={COLORS.textPrimary} />}
          />
        )}
        {locked && (
          <View style={styles.finalRow}>
            <Text style={styles.muted}>Result recorded · game completed.</Text>
            <Pressable onPress={reopen} hitSlop={8}>
              <Text style={styles.link}>Reopen</Text>
            </Pressable>
          </View>
        )}

        <Text style={styles.foot}>
          {status === 'scheduled'
            ? 'Live shows the running score on the public schedule; on paper shows it as In progress.'
            : locked
              ? 'The public schedule shows this as the final score.'
              : onPaper
                ? 'The final score appears publicly once the sheet is scanned.'
                : 'Every change publishes to the public schedule.'}
        </Text>
      </View>
    );
  },
);

function Side({
  name,
  label,
  logoUrl,
  value,
  dim,
  locked,
  caption,
  onBump,
}: {
  name: string;
  label: string;
  logoUrl: string | null;
  value: number;
  dim: boolean;
  locked: boolean;
  caption?: string;
  onBump: (d: number) => void;
}) {
  return (
    <View style={styles.side}>
      <TeamLogo name={name} label={label} logoUrl={logoUrl} size={48} />
      <Text style={styles.team} numberOfLines={1}>{label}</Text>
      {caption ? <Text style={styles.caption}>{caption}</Text> : null}
      <Text style={[styles.score, dim && styles.scoreDim]}>{value}</Text>
      {!locked && (
        <View style={styles.stepRow}>
          <Pressable
            style={({ pressed }) => [styles.stepBtn, pressed && styles.stepPressed]}
            onPress={() => onBump(-1)}
            accessibilityLabel={`${label} minus one`}
          >
            <Icon name="minus" size={20} color={COLORS.textPrimary} strokeWidth={2.4} />
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.stepBtn, styles.stepPlus, pressed && styles.stepPlusPressed]}
            onPress={() => onBump(1)}
            accessibilityLabel={`${label} plus one`}
          >
            <Icon name="plus" size={20} color={COLORS.textInverse} strokeWidth={2.4} />
          </Pressable>
        </View>
      )}
    </View>
  );
}

function StatusPill({ status, onPaper }: { status: LiveStatus; onPaper?: boolean }) {
  if (onPaper) {
    return (
      <View style={[styles.pill, styles.pillPaper]}>
        <Text style={[styles.pillText, { color: COLORS.info }]}>IN PROGRESS · PAPER</Text>
      </View>
    );
  }
  if (status === 'in_progress') {
    return (
      <View style={[styles.pill, styles.pillLive]}>
        <View style={styles.liveDot} />
        <Text style={[styles.pillText, { color: COLORS.primary }]}>LIVE</Text>
      </View>
    );
  }
  return (
    <View style={styles.pill}>
      <Text style={styles.pillText}>{status === 'final' ? 'FINAL' : 'NOT STARTED'}</Text>
    </View>
  );
}

function SyncChip({ sync, onRetry }: { sync: Sync; onRetry: () => void }) {
  if (sync === 'idle') return null;
  if (sync === 'saving') return <Text style={styles.sync}>Saving…</Text>;
  if (sync === 'saved') return <Text style={[styles.sync, { color: COLORS.success }]}>Published</Text>;
  if (sync === 'error') return <Text style={[styles.sync, { color: COLORS.error }]}>Not saved</Text>;
  return (
    <Pressable onPress={onRetry} style={styles.retry} hitSlop={8}>
      <Icon name="cloud-off" size={12} color={COLORS.warning} strokeWidth={2.2} />
      <Text style={[styles.sync, { color: COLORS.warning }]}>Offline · Retry</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: SPACING.lg,
    gap: SPACING.md,
    ...SHADOWS.card,
  },
  cardLive: { borderColor: COLORS.brandBorder },
  muted: { ...TYPE.bodySm, color: COLORS.textMuted },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },

  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.surfaceAlt,
  },
  pillLive: { backgroundColor: COLORS.brandSubtle },
  pillText: { ...TYPE.overline, color: COLORS.textSecondary },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: COLORS.primary },

  sync: { ...TYPE.caption, color: COLORS.textMuted },
  retry: { flexDirection: 'row', alignItems: 'center', gap: 4 },

  flex: { flex: 1, minWidth: 0 },
  notice: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.infoLight,
  },
  noticeTitle: { ...TYPE.label, color: COLORS.textPrimary },
  noticeText: { ...TYPE.caption, color: COLORS.textSecondary, marginTop: 2 },
  noticeLink: { ...TYPE.label, color: COLORS.info, marginTop: SPACING.xs },
  pillPaper: { backgroundColor: COLORS.infoLight },
  board: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: SPACING.sm },
  side: { flex: 1, alignItems: 'center', gap: 4 },
  team: { ...TYPE.subhead, color: COLORS.textPrimary, marginTop: 2, maxWidth: '100%' },
  caption: { ...TYPE.overline, color: COLORS.textMuted },
  score: { fontSize: 52, lineHeight: 58, fontWeight: '700', letterSpacing: -1.5, color: COLORS.textPrimary, fontVariant: ['tabular-nums'] },
  scoreDim: { color: COLORS.textDisabled },
  vs: { ...TYPE.overline, color: COLORS.textMuted, marginTop: 92 },

  stepRow: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.xs },
  stepBtn: {
    width: 48,
    height: 44,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.borderStrong,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.surface,
  },
  stepPressed: { backgroundColor: COLORS.pressed },
  stepPlus: { backgroundColor: COLORS.action, borderColor: COLORS.action },
  stepPlusPressed: { backgroundColor: COLORS.actionPressed },

  fieldRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.hairline,
  },
  fieldLabel: { ...TYPE.label, color: COLORS.textSecondary },
  periodInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    ...TYPE.bodySm,
    color: COLORS.textPrimary,
    backgroundColor: COLORS.surface,
  },
  segment: { flexDirection: 'row', borderWidth: 1, borderColor: COLORS.border, borderRadius: RADIUS.md, overflow: 'hidden' },
  segmentBtn: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: COLORS.surface },
  segmentBtnOn: { backgroundColor: COLORS.action },
  segmentText: { ...TYPE.label, color: COLORS.textSecondary },
  segmentTextOn: { color: COLORS.textInverse },

  finalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  link: { ...TYPE.label, color: COLORS.textPrimary, textDecorationLine: 'underline' },
  foot: { ...TYPE.caption, color: COLORS.textMuted, textAlign: 'center' },
});
