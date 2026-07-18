import React from 'react';
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import { COLORS, RADIUS, FONT_SIZE, FONT_WEIGHT, SHADOWS, SPACING } from '../../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Button — BatStateU red-and-white variants
// ─────────────────────────────────────────────────────────────────────────────

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost' | 'ocr';
type Size    = 'sm' | 'md' | 'lg';

interface ButtonProps {
  label:     string;
  onPress:   () => void;
  variant?:  Variant;
  size?:     Size;
  loading?:  boolean;
  disabled?: boolean;
  style?:    ViewStyle;
  icon?:     React.ReactNode;
  fullWidth?: boolean;
}

export function Button({
  label,
  onPress,
  variant   = 'primary',
  size      = 'md',
  loading   = false,
  disabled  = false,
  style,
  icon,
  fullWidth = false,
}: ButtonProps) {
  const isDisabled = disabled || loading;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.80}
      style={[
        styles.base,
        styles[variant],
        styles[size],
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'ghost' || variant === 'secondary' ? COLORS.primary : '#fff'}
        />
      ) : (
        <>
          {icon}
          <Text style={[styles.label, styles[`${variant}Label` as keyof typeof styles]]}>
            {label}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection:  'row',
    alignItems:     'center',
    justifyContent: 'center',
    borderRadius:   RADIUS.md,
    gap:            SPACING.xs,
  },
  fullWidth: { width: '100%' },

  // ── Variants — matches web colour tokens ─────────────────────────────────
  primary: {
    backgroundColor: COLORS.primary,        // #B91C1C
    ...SHADOWS.lg,
  },
  secondary: {
    backgroundColor: COLORS.surface,
    borderWidth:     1.5,
    borderColor:     COLORS.borderStrong,
  },
  danger: {
    backgroundColor: COLORS.destructive,    // #DC2626
    ...SHADOWS.sm,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderWidth:     1.5,
    borderColor:     COLORS.primary,
  },
  ocr: {
    backgroundColor: COLORS.ocr,
    ...SHADOWS.sm,
  },

  // ── Sizes ────────────────────────────────────────────────────────────────
  sm: { paddingVertical: SPACING.xs,     paddingHorizontal: SPACING.md,  minHeight: 36 },
  md: { paddingVertical: SPACING.sm + 4, paddingHorizontal: SPACING.lg,  minHeight: 48 },
  lg: { paddingVertical: SPACING.md,     paddingHorizontal: SPACING.xl,  minHeight: 56 },

  disabled: { opacity: 0.45 },

  // ── Labels ───────────────────────────────────────────────────────────────
  label: {
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.medium,   // web --font-weight-medium: 500
    color:      COLORS.textInverse,
  },
  primaryLabel:   { color: COLORS.textInverse },
  secondaryLabel: { color: COLORS.textPrimary },
  dangerLabel:    { color: COLORS.textInverse },
  ghostLabel:     { color: COLORS.primary },
  ocrLabel:       { color: COLORS.textInverse },
});
