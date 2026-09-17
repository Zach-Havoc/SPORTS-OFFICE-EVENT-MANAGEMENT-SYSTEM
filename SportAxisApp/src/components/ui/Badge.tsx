import React from 'react';
import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Badge — uppercase status pill; optional leading status dot.
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'ocr' | 'offline' | 'info' | 'red';

interface BadgeProps {
  label: string;
  variant?: BadgeVariant;
  dot?: boolean;
  style?: ViewStyle;
}

const DOT: Record<BadgeVariant, string> = {
  default: COLORS.textMuted,
  success: COLORS.success,
  error: COLORS.destructive,
  warning: COLORS.warning,
  ocr: COLORS.ocr,
  offline: COLORS.warning,
  info: COLORS.info,
  red: COLORS.primary,
};

export function Badge({ label, variant = 'default', dot = false, style }: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      {dot ? <View style={[styles.dot, { backgroundColor: DOT[variant] }]} /> : null}
      <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles]]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
    alignSelf: 'flex-start',
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  label: { ...TYPE.caption, textTransform: 'uppercase' },

  default:      { backgroundColor: COLORS.surfaceAlt },
  defaultLabel: { color: COLORS.textSecondary },
  success:      { backgroundColor: COLORS.successLight },
  successLabel: { color: COLORS.success },
  error:        { backgroundColor: COLORS.errorLight },
  errorLabel:   { color: COLORS.destructive },
  warning:      { backgroundColor: COLORS.warningLight },
  warningLabel: { color: COLORS.warning },
  ocr:          { backgroundColor: COLORS.ocrLight },
  ocrLabel:     { color: COLORS.ocr },
  offline:      { backgroundColor: COLORS.warningLight },
  offlineLabel: { color: COLORS.warning },
  info:         { backgroundColor: COLORS.infoLight },
  infoLabel:    { color: COLORS.info },
  red:          { backgroundColor: COLORS.primaryPale },
  redLabel:     { color: COLORS.primary },
});
