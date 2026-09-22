import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../../../constants/theme';
import { Icon, type IconName } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Input — the labeled text field pattern from the login screen, promoted to a
// shared component. Icon + label, a focus ring, inline error text, and an
// optional trailing slot (e.g. a show/hide-password toggle).
//
// This is for a generic labeled form field. The app's specialized numeric
// score inputs (the big stepper on the scoring screen, the compact per-row
// fields in the OCR review list) intentionally stay bespoke — they're a
// different UI pattern (large centered number / dense list row), not a
// labeled field, and forcing them into this shape would hurt them, not help.
// ─────────────────────────────────────────────────────────────────────────────

interface InputProps extends React.ComponentProps<typeof TextInput> {
  label: string;
  icon?: IconName;
  error?: string;
  trailing?: React.ReactNode;
}

export function Input({ label, icon, error, trailing, onFocus, onBlur, ...input }: InputProps) {
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View
        style={[
          styles.wrap,
          focused && styles.wrapFocused,
          error && styles.wrapError,
        ]}
      >
        {icon ? <Icon name={icon} size={18} color={focused ? COLORS.primary : COLORS.textMuted} /> : null}
        <TextInput
          style={styles.input}
          placeholderTextColor={COLORS.textMuted}
          onFocus={(e) => { setFocused(true); onFocus?.(e); }}
          onBlur={(e) => { setFocused(false); onBlur?.(e); }}
          {...input}
        />
        {trailing}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: { gap: 6 },
  label: { ...TYPE.label, color: COLORS.textSecondary },
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: 'transparent',
    paddingHorizontal: SPACING.md,
    minHeight: 54,
  },
  wrapFocused: { borderColor: COLORS.primary },
  wrapError: { borderColor: COLORS.destructive },
  input: { flex: 1, ...TYPE.body, color: COLORS.textPrimary, paddingVertical: SPACING.md },
  error: { ...TYPE.bodySm, color: COLORS.destructive },
});
