import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS, FONT_SIZE, FONT_WEIGHT, SPACING } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Badge — status pill inheriting web chart/accent colors
// ─────────────────────────────────────────────────────────────────────────────

type BadgeVariant = 'default' | 'success' | 'error' | 'warning' | 'ocr' | 'offline' | 'info' | 'red';

interface BadgeProps {
  label:    string;
  variant?: BadgeVariant;
  style?:   ViewStyle;
}

export function Badge({ label, variant = 'default', style }: BadgeProps) {
  return (
    <View style={[styles.badge, styles[variant], style]}>
      <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles]]}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical:   3,
    borderRadius:      RADIUS.full,
    alignSelf:         'flex-start',
  },
  label: {
    fontSize:      FONT_SIZE.xs,
    fontWeight:    FONT_WEIGHT.semibold,
    letterSpacing: 0.3,
  },

  // default — muted gray
  default:      { backgroundColor: COLORS.surfaceAlt },
  defaultLabel: { color: COLORS.textSecondary },

  // success — green
  success:      { backgroundColor: COLORS.successLight },
  successLabel: { color: COLORS.success },

  // error — red (matches web --destructive)
  error:        { backgroundColor: COLORS.errorLight },
  errorLabel:   { color: COLORS.destructive },

  // warning — amber
  warning:      { backgroundColor: COLORS.warningLight },
  warningLabel: { color: COLORS.warning },

  // ocr — purple accent
  ocr:          { backgroundColor: COLORS.ocrLight },
  ocrLabel:     { color: COLORS.ocr },

  // offline — amber
  offline:      { backgroundColor: COLORS.warningLight },
  offlineLabel: { color: COLORS.warning },

  // info — blue
  info:         { backgroundColor: COLORS.infoLight },
  infoLabel:    { color: COLORS.info },

  // red — BatStateU primary (for brand highlights)
  red:          { backgroundColor: COLORS.primaryPale },
  redLabel:     { color: COLORS.primary },
});
