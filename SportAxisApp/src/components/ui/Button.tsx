import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Button — BatStateU red-and-white. Pressable with a pressed wash; light haptic
// on the loud variants.
// ─────────────────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'tonal' | 'danger' | 'ghost' | 'ocr';
type Size = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  icon?: React.ReactNode;
  fullWidth?: boolean;
}

const HAPTIC: Variant[] = ['primary', 'danger'];

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const spinnerColor =
    variant === 'ghost' || variant === 'secondary' || variant === 'tonal'
      ? COLORS.primary
      : '#fff';

  return (
    <Pressable
      onPress={() => {
        if (HAPTIC.includes(variant)) Haptics.selectionAsync().catch(() => {});
        onPress();
      }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        pressed && !isDisabled && styles.pressed,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator size="small" color={spinnerColor} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles]]}>{label}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: RADIUS.lg,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  fullWidth: { width: '100%' },
  pressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.4 },

  // ── Variants ────────────────────────────────────────────────────────────
  primary:   { backgroundColor: COLORS.primary, ...SHADOWS.sm },
  secondary: { backgroundColor: COLORS.surface, borderWidth: 1.5, borderColor: COLORS.borderStrong },
  tonal:     { backgroundColor: COLORS.primaryTint },
  danger:    { backgroundColor: COLORS.destructive, ...SHADOWS.sm },
  ghost:     { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.primary },
  ocr:       { backgroundColor: COLORS.ocr, ...SHADOWS.sm },

  // ── Sizes (a11y min heights) ────────────────────────────────────────────
  sm: { paddingVertical: SPACING.xs + 2, paddingHorizontal: SPACING.md, minHeight: 40 },
  md: { paddingVertical: SPACING.sm + 3, paddingHorizontal: SPACING.lg, minHeight: 48 },
  lg: { paddingVertical: SPACING.md + 1, paddingHorizontal: SPACING.xl, minHeight: 56 },

  // ── Labels ──────────────────────────────────────────────────────────────
  label: { ...TYPE.label, fontSize: 14, letterSpacing: 0.2 },
  primaryLabel:   { color: COLORS.textInverse },
  secondaryLabel: { color: COLORS.textPrimary },
  tonalLabel:     { color: COLORS.primary },
  dangerLabel:    { color: COLORS.textInverse },
  ghostLabel:     { color: COLORS.primary },
  ocrLabel:       { color: COLORS.textInverse },
});
