import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Card — white surface matching web card tokens
// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  children:  React.ReactNode;
  style?:    ViewStyle;
  variant?:  'default' | 'elevated' | 'red';
  noPadding?: boolean;
}

export function Card({ children, style, variant = 'default', noPadding = false }: CardProps) {
  return (
    <View style={[styles.card, styles[variant], !noPadding && styles.padding, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.lg,
    borderWidth:  1,
    borderColor:  COLORS.border,
  },
  padding: {
    padding: SPACING.md,
  },
  // White card — matches web --card: #ffffff
  default: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.card,
  },
  // Slightly lifted
  elevated: {
    backgroundColor: COLORS.surface,
    ...SHADOWS.md,
  },
  // Red-tinted card (for highlights / event banners)
  red: {
    backgroundColor: COLORS.primarySubtle,
    borderColor:     COLORS.primaryPale,
    borderWidth:     1.5,
  },
});
