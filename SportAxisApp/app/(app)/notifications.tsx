import { useFocusEffect, useRouter } from 'expo-router';
import React, { useCallback, useRef, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../../constants/theme';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { SkeletonList } from '../../src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../src/components/ui/States';
import { notificationService } from '../../src/services/notification.service';
import { useEventStore } from '../../src/store/event.store';
import type { AppNotification, NotificationKind } from '../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// Notifications — pushed from the Home bell icon, not a tab. Real backend
// (GET /notifications, mark-read, mark-all-read) — no client-only placeholder.
// ─────────────────────────────────────────────────────────────────────────────

// Keyed by the real `kind` strings the backend's App\Notifications\* classes
// send (see app/Notifications/*.php) — there is no generic
// info/success/warning/error taxonomy on the wire. Anything not listed here
// (a notification type added later, or an unexpected value) falls back to
// DEFAULT_TONE below rather than crashing the screen.
const KIND_ICON: Partial<Record<NotificationKind, IconName>> = {
  protest_filed: 'flag',
  protest_resolved: 'check-circle',
  requirement_reviewed: 'verified',
  score_disputed: 'alert-triangle',
  committee_assigned: 'qr',
};
const KIND_COLOR: Partial<Record<NotificationKind, { fg: string; bg: string }>> = {
  protest_filed: { fg: COLORS.warning, bg: COLORS.warningLight },
  protest_resolved: { fg: COLORS.success, bg: COLORS.successLight },
  requirement_reviewed: { fg: COLORS.info, bg: COLORS.infoLight },
  score_disputed: { fg: COLORS.destructive, bg: COLORS.errorLight },
  committee_assigned: { fg: COLORS.textPrimary, bg: COLORS.surfaceAlt },
};
const DEFAULT_ICON: IconName = 'bell';
const DEFAULT_TONE = { fg: COLORS.textSecondary, bg: COLORS.surfaceAlt };

// Refetching on every focus is wasteful if the user just flipped tabs and
// back — skip the refetch when the last successful fetch is still fresh.
const STALE_MS = 30_000;

function timeAgo(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return 'Just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsScreen() {
  const router = useRouter();
  const loadEvent = useEventStore((st) => st.loadByQrToken);
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedAt = useRef(0);

  const load = useCallback(async () => {
    try {
      setError(null);
      const res = await notificationService.list();
      setItems(res.items);
      lastFetchedAt.current = Date.now();
    } catch (err: any) {
      setError(err?.message ?? 'Could not load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (lastFetchedAt.current > 0 && Date.now() - lastFetchedAt.current < STALE_MS) return;
      load();
    }, [load]),
  );

  const handlePress = async (n: AppNotification) => {
    if (!n.readAt) {
      setItems((prev) => prev.map((i) => (i.id === n.id ? { ...i, readAt: new Date().toISOString() } : i)));
      try {
        await notificationService.markRead(n.id);
      } catch {
        // Non-critical — the unread badge will simply recount on next visit.
      }
    }

    // "You're on the committee" carries the event's QR link: open its score
    // sheet straight away instead of making them scan the emailed code.
    const token = n.kind === 'committee_assigned' ? n.url?.match(/judge-qr\/[^/]+\/([^/?#]+)/)?.[1] : null;
    if (token) {
      try {
        await loadEvent(token);
        const id = useEventStore.getState().event?.id;
        if (id) router.push(`/(app)/scoring/${id}`);
      } catch (e: any) {
        Alert.alert('Could not open the game', e?.message ?? 'Try scanning its QR code instead.');
      }
    }
  };

  const markAllRead = async () => {
    const hadUnread = items.some((i) => !i.readAt);
    if (!hadUnread) return;
    setItems((prev) => prev.map((i) => ({ ...i, readAt: i.readAt ?? new Date().toISOString() })));
    try {
      await notificationService.markAllRead();
    } catch {
      load();
    }
  };

  const unreadCount = items.filter((i) => !i.readAt).length;

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} hitSlop={10} style={styles.back} accessibilityRole="button" accessibilityLabel="Back">
            <Icon name="arrow-left" size={20} color={COLORS.textPrimary} />
          </Pressable>
          {unreadCount > 0 && (
            <Pressable onPress={markAllRead} hitSlop={8}>
              <Text style={styles.markAll}>Mark all read</Text>
            </Pressable>
          )}
        </View>
        <ScreenHeader title="Notifications" subtitle={unreadCount > 0 ? `${unreadCount} unread` : 'All caught up'} />
      </View>

      {loading ? (
        <View style={styles.headerPad}>
          <SkeletonList count={5} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(n) => n.id}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          renderItem={({ item }) => {
            const unread = !item.readAt;
            const tone = KIND_COLOR[item.kind] ?? DEFAULT_TONE;
            const icon = KIND_ICON[item.kind] ?? DEFAULT_ICON;
            return (
              <Pressable onPress={() => handlePress(item)} style={[styles.row, unread && styles.rowUnread]}>
                <View style={[styles.iconTile, { backgroundColor: tone.bg }]}>
                  <Icon name={icon} size={18} color={tone.fg} strokeWidth={2.2} />
                </View>
                <View style={styles.rowBody}>
                  <Text style={[styles.rowTitle, unread && styles.rowTitleUnread]} numberOfLines={1}>{item.title}</Text>
                  {item.body ? <Text style={styles.rowText} numberOfLines={2}>{item.body}</Text> : null}
                  <Text style={styles.rowTime}>{timeAgo(item.createdAt)}</Text>
                </View>
                {unread && <View style={styles.unreadDot} />}
              </Pressable>
            );
          }}
          ListEmptyComponent={
            <EmptyState icon="bell" title="You're all caught up" hint="New notifications will show up here." />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: SPACING.lg },
  topRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingTop: SPACING.sm },
  back: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginLeft: -SPACING.sm },
  markAll: { ...TYPE.label, color: COLORS.primary },

  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.hairline,
  },
  rowUnread: { backgroundColor: COLORS.primarySubtle, borderColor: COLORS.primaryTint },
  iconTile: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...TYPE.subhead, color: COLORS.textPrimary },
  rowTitleUnread: { fontWeight: '800' },
  rowText: { ...TYPE.bodySm, color: COLORS.textSecondary },
  rowTime: { ...TYPE.caption, textTransform: 'none', color: COLORS.textMuted, marginTop: 2 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary, marginTop: 6 },
});
