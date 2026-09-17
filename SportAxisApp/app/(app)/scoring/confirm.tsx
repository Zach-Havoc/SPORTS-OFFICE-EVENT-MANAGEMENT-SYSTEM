import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, RADIUS, SPACING, TYPE } from '../../../constants/theme';
import { Button } from '../../../src/components/ui/Button';
import { Icon, type IconName } from '../../../src/components/ui/Icon';
import { useEventStore } from '../../../src/store/event.store';

// ─────────────────────────────────────────────────────────────────────────────
// Confirm — post-submission success screen.
// ─────────────────────────────────────────────────────────────────────────────

export default function ConfirmScreen() {
  const router = useRouter();
  const clearEvent = useEventStore((s) => s.clearEvent);
  const params = useLocalSearchParams<{
    eventName: string;
    department: string;
    total: string;
    mode: string;
    isOffline: string;
    summary?: string;
  }>();

  const { eventName, department, total, mode, isOffline } = params;
  const offline = isOffline === 'true';

  const scored: { d: string; v: number }[] = (() => {
    try { return params.summary ? JSON.parse(params.summary) : []; } catch { return []; }
  })();
  const many = scored.length > 1;

  const scale = useRef(new Animated.Value(0.85)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleScanAnother = () => router.replace('/(app)/scanner');
  const handleDone = async () => { await clearEvent(); router.replace('/(app)/scanner'); };

  return (
    <SafeAreaView style={styles.safe}>
      <Animated.View style={[styles.body, { opacity, transform: [{ scale }] }]}>
        <View style={[styles.badge, offline ? styles.badgeOffline : styles.badgeOk]}>
          <Icon name={offline ? 'cloud-off' : 'check-all'} size={34} color={offline ? COLORS.warning : COLORS.success} strokeWidth={2.4} />
        </View>

        <Text style={styles.title}>
          {offline ? (many ? 'Scores saved offline' : 'Score saved offline') : (many ? 'Scores submitted' : 'Score submitted')}
        </Text>
        <Text style={styles.sub}>
          {offline ? 'Will sync when you’re back online.' : 'Recorded.'}
        </Text>

        <View style={styles.card}>
          <Row label="Event" value={eventName ?? '–'} />
          {many ? (
            scored.map((s) => <Row key={s.d} label={s.d} value={String(s.v)} highlight />)
          ) : (
            <>
              <Row label="College" value={department ?? '–'} />
              <Row label="Total score" value={total ?? '0'} highlight />
            </>
          )}
          <Row label="Method" value={mode === 'ocr' ? 'Scanned sheet' : 'Manual entry'} icon={mode === 'ocr' ? 'camera' : 'pencil'} last />
        </View>

        <View style={styles.actions}>
          {many ? (
            <>
              <Button label="Done" onPress={handleDone} size="lg" fullWidth />
              <Button label="Scan another event" onPress={handleScanAnother} variant="tonal" fullWidth />
            </>
          ) : (
            <>
              <Button label="Score another college" onPress={() => router.back()} size="lg" fullWidth icon={<Icon name="plus" size={16} color={COLORS.textInverse} />} />
              <Button label="Done" onPress={handleDone} variant="tonal" fullWidth />
            </>
          )}
        </View>
      </Animated.View>

      <Text style={styles.footer}>© 2026 Batangas State University</Text>
    </SafeAreaView>
  );
}

function Row({ label, value, highlight, icon, last }: { label: string; value: string; highlight?: boolean; icon?: IconName; last?: boolean }) {
  return (
    <View style={[rs.row, last && rs.rowLast]}>
      <Text style={rs.label}>{label}</Text>
      <View style={rs.valueWrap}>
        {icon ? <Icon name={icon} size={13} color={highlight ? COLORS.primary : COLORS.textSecondary} /> : null}
        <Text style={[rs.value, highlight && rs.valueHi]} numberOfLines={2}>{value}</Text>
      </View>
    </View>
  );
}

const rs = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: SPACING.sm, borderBottomWidth: 1, borderBottomColor: COLORS.hairline },
  rowLast: { borderBottomWidth: 0 },
  label: { ...TYPE.bodySm, color: COLORS.textSecondary, flex: 1 },
  valueWrap: { flexDirection: 'row', alignItems: 'center', gap: 4, flex: 2, justifyContent: 'flex-end' },
  value: { ...TYPE.subhead, color: COLORS.textPrimary, textAlign: 'right' },
  valueHi: { ...TYPE.title, color: COLORS.primary },
});

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.background },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: SPACING.xl, gap: SPACING.sm },
  badge: { width: 76, height: 76, borderRadius: RADIUS.full, alignItems: 'center', justifyContent: 'center', marginBottom: SPACING.md },
  badgeOk: { backgroundColor: COLORS.successLight },
  badgeOffline: { backgroundColor: COLORS.warningLight },
  title: { ...TYPE.title, color: COLORS.textPrimary, textAlign: 'center' },
  sub: { ...TYPE.body, color: COLORS.textSecondary, textAlign: 'center' },
  card: {
    width: '100%',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    marginTop: SPACING.lg,
  },
  actions: { width: '100%', gap: SPACING.sm, marginTop: SPACING.lg },
  footer: { ...TYPE.caption, textTransform: 'none', color: COLORS.textMuted, textAlign: 'center', paddingVertical: SPACING.md },
});
