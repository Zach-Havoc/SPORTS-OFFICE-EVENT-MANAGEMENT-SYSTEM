import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../../../constants/theme';
import { Icon, type IconName } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// Chip — the tappable/selectable sibling of Badge (which is static-only).
// Used for filter pills (Home status filter) and category tags (Notifications).
// ─────────────────────────────────────────────────────────────────────────────

interface ChipProps {
  label: string;
  icon?: IconName;
  selected?: boolean;
  color?: string;
  onPress?: () => void;
  style?: ViewStyle;
}

export function Chip({ label, icon, selected = false, color = COLORS.primary, onPress, style }: ChipProps) {
  const content = (
    <View
      style={[
        styles.chip,
        selected ? { backgroundColor: color, borderColor: color } : styles.unselected,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={13} color={selected ? COLORS.textInverse : COLORS.textSecondary} strokeWidth={2.2} /> : null}
      <Text style={[styles.label, { color: selected ? COLORS.textInverse : COLORS.textSecondary }]}>{label}</Text>
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      hitSlop={4}
      style={({ pressed }) => pressed && styles.pressed}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: SPACING.md,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  unselected: { backgroundColor: COLORS.surface, borderColor: COLORS.hairline },
  pressed: { opacity: 0.7 },
  label: { ...TYPE.label, textTransform: 'none' },
});
