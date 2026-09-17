import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Card — soft rounded surface. `tint` is the default minimalist panel (filled,
// no border, no shadow); `default` keeps a hairline + faint lift; `red` is the
// accent panel. `onPress` makes it a tappable row with a pressed wash.
// ─────────────────────────────────────────────────────────────────────────────

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  variant?: 'tint' | 'default' | 'elevated' | 'red';
  noPadding?: boolean;
  onPress?: () => void;
}

export function Card({ children, style, variant = 'tint', noPadding = false, onPress }: CardProps) {
  const base = [styles.card, styles[variant], !noPadding && styles.padding, style];

  if (onPress) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [...base, pressed && styles.pressed]}>
        {children}
      </Pressable>
    );
  }
  return <View style={base}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { borderRadius: RADIUS.xl },
  padding: { padding: SPACING.lg },
  pressed: { opacity: 0.9 },

  tint: { backgroundColor: COLORS.surfaceAlt },
  default: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    ...SHADOWS.card,
  },
  elevated: { backgroundColor: COLORS.surface, ...SHADOWS.md },
  red: { backgroundColor: COLORS.primarySubtle },
});
