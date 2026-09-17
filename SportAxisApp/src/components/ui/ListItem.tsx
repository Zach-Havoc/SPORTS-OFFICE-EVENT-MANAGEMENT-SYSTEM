import React from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../../../constants/theme';
import { Icon, type IconName } from './Icon';

// ─────────────────────────────────────────────────────────────────────────────
// ListItem — a tappable row: left icon tile, title + subtitle, right slot /
// chevron. 44pt min height, pressed wash.
// ─────────────────────────────────────────────────────────────────────────────

interface ListItemProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconColor?: string;
  iconBg?: string;
  right?: React.ReactNode;
  chevron?: boolean;
  onPress?: () => void;
  style?: ViewStyle;
}

export function ListItem({
  title,
  subtitle,
  icon,
  iconColor = COLORS.primary,
  iconBg = COLORS.primaryTint,
  right,
  chevron = false,
  onPress,
  style,
}: ListItemProps) {
  const body = (
    <>
      {icon ? (
        <View style={[styles.iconTile, { backgroundColor: iconBg }]}>
          <Icon name={icon} size={18} color={iconColor} />
        </View>
      ) : null}
      <View style={styles.text}>
        <Text style={styles.title} numberOfLines={1}>{title}</Text>
        {subtitle ? <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text> : null}
      </View>
      {right}
      {chevron ? <Icon name="chevron-right" size={18} color={COLORS.textMuted} /> : null}
    </>
  );

  if (!onPress) return <View style={[styles.row, style]}>{body}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && styles.pressed, style]}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: 44,
    paddingVertical: SPACING.sm + 2,
  },
  pressed: { backgroundColor: COLORS.pressed, borderRadius: RADIUS.md },
  iconTile: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1 },
  title: { ...TYPE.subhead, color: COLORS.textPrimary },
  subtitle: { ...TYPE.bodySm, color: COLORS.textSecondary, marginTop: 1 },
});
