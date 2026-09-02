import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import {
    COLORS,
    FONT_SIZE, FONT_WEIGHT, RADIUS, SHADOWS,
    SPACING,
} from '../../../constants/theme';
import { useEventStore } from '../../../src/store/event.store';

// ─────────────────────────────────────────────────────────────────────────────
// Confirm Screen — BatStateU red/white post-submission confirmation
// ─────────────────────────────────────────────────────────────────────────────

export default function ConfirmScreen() {
  const router     = useRouter();
  const clearEvent = useEventStore((s) => s.clearEvent);
  const params     = useLocalSearchParams<{
    eventName:  string;
    department: string;
    total:      string;
    mode:       string;
    isOffline:  string;
  }>();

  const { eventName, department, total, mode, isOffline } = params;
  const offline = isOffline === 'true';

  // Spring entrance
  const scaleAnim   = useRef(new Animated.Value(0.85)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim,   { toValue: 1, useNativeDriver: true, tension: 80, friction: 8 }),
      Animated.timing(opacityAnim, { toValue: 1, duration: 350, useNativeDriver: true }),
    ]).start();
  }, []);

  const handleScanAnother = () => router.replace('/(app)/scanner');
  const handleDone        = async () => { await clearEvent(); router.replace('/(app)/scanner'); };

  return (
    <View style={styles.container}>
      {/* Red top banner */}
      <View style={styles.banner}>
        <View style={styles.bannerTitleRow}>
          <Ionicons name={offline ? 'cloud-download-outline' : 'trophy'} size={28} color={COLORS.textInverse} style={{ marginRight: 8 }} />
          <Text style={styles.bannerTitle}>
            {offline ? 'Score Saved' : 'Score Submitted!'}
          </Text>
        </View>
        <Text style={styles.bannerSub}>BatStateU Competition Scoring System</Text>
      </View>

      <Animated.View
        style={[styles.card, { transform: [{ scale: scaleAnim }], opacity: opacityAnim }]}
      >
        {/* Status icon */}
        <View style={[styles.iconBox, offline ? styles.iconBoxOffline : styles.iconBoxSuccess]}>
          <Ionicons name={offline ? 'cloud-download' : 'checkmark-circle'} size={36} color={offline ? COLORS.warning : COLORS.success} />
        </View>

        <Text style={styles.statusTitle}>
          {offline ? 'Saved Offline' : 'Successfully Submitted'}
        </Text>
        <Text style={styles.statusSub}>
          {offline
            ? 'Your score is queued and will sync automatically when back online.'
            : 'Your score has been recorded successfully.'}
        </Text>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <SummaryRow label="Event"       value={eventName   ?? '–'} />
          <SummaryRow label="College"  value={department  ?? '–'} />
          <SummaryRow label="Total Score" value={total       ?? '0'} highlight />
          <SummaryRow
            label="Method"
            value={mode === 'ocr' ? 'OCR Capture' : 'Manual Entry'}
            icon={mode === 'ocr' ? 'camera' : 'pencil'}
          />
          {offline && <SummaryRow label="Status" value="Queued for sync" icon="time" />}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.primaryBtn} onPress={handleScanAnother} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>Score Another College</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryBtn} onPress={handleDone} activeOpacity={0.85}>
            <Text style={styles.secondaryBtnText}>Done</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>

      <Text style={styles.footer}>© 2026 Batangas State University</Text>
    </View>
  );
}

function SummaryRow({ label, value, highlight = false, icon }: {
  label: string; value: string; highlight?: boolean; icon?: string;
}) {
  return (
    <View style={summaryStyles.row}>
      <Text style={summaryStyles.label}>{label}</Text>
      <View style={summaryStyles.valueContainer}>
        {icon && <Ionicons name={icon as any} size={14} color={highlight ? COLORS.primary : COLORS.textPrimary} style={{ marginRight: 4 }} />}
        <Text
          style={[summaryStyles.value, highlight && summaryStyles.valueHighlight]}
          numberOfLines={2}
        >
          {value}
        </Text>
      </View>
    </View>
  );
}

const summaryStyles = StyleSheet.create({
  row: {
    flexDirection:     'row',
    justifyContent:    'space-between',
    alignItems:        'flex-start',
    paddingVertical:   SPACING.xs + 2,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  label: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.textSecondary,
    flex:     1,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems:    'center',
    flex:          2,
    justifyContent: 'flex-end',
  },
  value: {
    fontSize:   FONT_SIZE.sm,
    color:      COLORS.textPrimary,
    fontWeight: FONT_WEIGHT.medium,
    textAlign:  'right',
  },
  valueHighlight: {
    fontSize:   FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.primary,   // BatStateU red
  },
});

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.background,
  },

  // Red banner at top
  banner: {
    backgroundColor:  COLORS.primary,
    paddingVertical:  SPACING.xl,
    paddingHorizontal: SPACING.lg,
    alignItems:       'center',
    gap:              SPACING.xs,
  },
  bannerTitleRow: {
    flexDirection: 'row',
    alignItems:    'center',
  },
  bannerTitle: {
    fontSize:   FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textInverse,
  },
  bannerSub: {
    fontSize: FONT_SIZE.sm,
    color:    'rgba(255,255,255,0.80)',
  },

  // White card
  card: {
    backgroundColor: COLORS.surface,
    margin:          SPACING.lg,
    borderRadius:    RADIUS.xl,
    padding:         SPACING.xl,
    alignItems:      'center',
    gap:             SPACING.lg,
    ...SHADOWS.card,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },
  iconBox: {
    width:          72,
    height:         72,
    borderRadius:   RADIUS.full,
    alignItems:     'center',
    justifyContent: 'center',
  },
  iconBoxSuccess: {
    backgroundColor: COLORS.successLight,
    borderWidth:     2,
    borderColor:     COLORS.success,
  },
  iconBoxOffline: {
    backgroundColor: COLORS.warningLight,
    borderWidth:     2,
    borderColor:     COLORS.warning,
  },
  statusTitle: {
    fontSize:   FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },
  statusSub: {
    fontSize:  FONT_SIZE.md,
    color:     COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: FONT_SIZE.md * 1.55,
  },

  // Summary box — gray background like web muted
  summaryBox: {
    width:           '100%',
    backgroundColor: COLORS.surfaceAlt,
    borderRadius:    RADIUS.md,
    padding:         SPACING.md,
    borderWidth:     1,
    borderColor:     COLORS.border,
  },

  // Actions
  actions: { width: '100%', gap: SPACING.sm },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems:      'center',
    ...SHADOWS.lg,
  },
  primaryBtnText: {
    color:      COLORS.textInverse,
    fontWeight: FONT_WEIGHT.bold,
    fontSize:   FONT_SIZE.md,
  },
  secondaryBtn: {
    borderRadius:    RADIUS.md,
    paddingVertical: SPACING.md,
    alignItems:      'center',
    borderWidth:     1.5,
    borderColor:     COLORS.borderStrong,
  },
  secondaryBtnText: {
    color:      COLORS.textSecondary,
    fontWeight: FONT_WEIGHT.medium,
    fontSize:   FONT_SIZE.md,
  },

  footer: {
    textAlign: 'center',
    fontSize:  FONT_SIZE.xs,
    color:     COLORS.textMuted,
    padding:   SPACING.md,
  },
});
