import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../../../constants/theme';
import { Icon, type IconName } from './Icon';
import { Button } from './Button';

// ─────────────────────────────────────────────────────────────────────────────
// Loading / Error / Empty — the three "screen has no content yet" states.
// One look everywhere.
// ─────────────────────────────────────────────────────────────────────────────

export function LoadingState({ label = 'Loading…' }: { label?: string }) {
  return (
    <View style={styles.center}>
      <ActivityIndicator color={COLORS.primary} />
      <Text style={styles.dim}>{label}</Text>
    </View>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={[styles.badge, { backgroundColor: COLORS.errorLight }]}>
        <Icon name="alert-circle" size={26} color={COLORS.destructive} />
      </View>
      <Text style={styles.title}>Something went wrong</Text>
      <Text style={styles.dim}>{message}</Text>
      {onRetry ? (
        <Button label="Try again" onPress={onRetry} variant="tonal" size="sm" icon={<Icon name="refresh" size={16} color={COLORS.primary} />} style={styles.action} />
      ) : null}
    </View>
  );
}

export function EmptyState({
  icon = 'calendar',
  title,
  hint,
  actionLabel,
  onAction,
}: {
  icon?: IconName;
  title: string;
  hint?: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.center}>
      <View style={[styles.badge, { backgroundColor: COLORS.primaryTint }]}>
        <Icon name={icon} size={26} color={COLORS.primary} />
      </View>
      <Text style={styles.title}>{title}</Text>
      {hint ? <Text style={styles.dim}>{hint}</Text> : null}
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} variant="tonal" size="sm" style={styles.action} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.xxl,
    gap: SPACING.xs,
  },
  badge: {
    width: 56,
    height: 56,
    borderRadius: RADIUS.full,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: SPACING.sm,
  },
  title: { ...TYPE.subhead, color: COLORS.textPrimary, textAlign: 'center' },
  dim: { ...TYPE.body, color: COLORS.textSecondary, textAlign: 'center' },
  action: { marginTop: SPACING.md },
});
