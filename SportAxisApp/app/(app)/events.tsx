import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../constants/theme';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { SkeletonList } from '../../src/components/ui/Skeleton';
import { EmptyState, ErrorState } from '../../src/components/ui/States';
import { eventService } from '../../src/services/event.service';
import { useEventStore } from '../../src/store/event.store';
import { useAuthStore } from '../../src/store/auth.store';
import { useOfflineStore } from '../../src/store/offline.store';
import type { EventSummary } from '../../src/types';
import { useNetwork } from '../../src/hooks/use-network';
import { useUnreadNotifications } from '../../src/hooks/use-notifications';
import { useDeptAbbreviator } from '../../src/hooks/use-dept-abbr';
import { getSportConfigFromEvent } from '../../src/utils/sport-config';

const STATUS_DOT = { ongoing: COLORS.success, completed: COLORS.textMuted, upcoming: COLORS.warning } as const;

type StatusFilter = 'all' | 'ongoing' | 'upcoming' | 'completed';

export default function EventsScreen() {
  const router = useRouter();
  const abbr = useDeptAbbreviator();
  const { isConnected } = useNetwork();
  const loadEvent = useEventStore((s) => s.loadByQrToken);
  const user = useAuthStore((s) => s.user);
  const pendingCount = useOfflineStore((s) => s.queue.filter((i) => i.status === 'pending').length);
  const { unreadCount } = useUnreadNotifications();

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('all');
  const [query, setQuery] = useState('');

  const fetchEvents = async () => {
    try {
      setError(null);
      setEvents(await eventService.getEvents());
    } catch (err: any) {
      setError(err.message || 'Failed to load events.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isConnected) fetchEvents();
    else {
      setLoading(false);
      setError('No connection.');
    }
  }, [isConnected]);

  const onRefresh = () => {
    if (!isConnected) return;
    setRefreshing(true);
    fetchEvents();
  };

  const openEvent = async (item: EventSummary) => {
    if (openingId) return;
    setOpeningId(item.id);
    try {
      await loadEvent(item.qrToken);
      const id = useEventStore.getState().event?.id;
      if (id) router.push(`/(app)/scoring/${id}`);
    } catch (err: any) {
      setError(err?.message ?? 'Could not open that event.');
    } finally {
      setOpeningId(null);
    }
  };

  const counts = useMemo(
    () => ({
      ongoing: events.filter((e) => e.status === 'ongoing').length,
      upcoming: events.filter((e) => e.status === 'upcoming').length,
      completed: events.filter((e) => e.status === 'completed').length,
    }),
    [events],
  );

  const statusFiltered = filter === 'all' ? events : events.filter((e) => e.status === filter);
  const visibleEvents = query.trim()
    ? statusFiltered.filter((e) => `${e.name} ${abbr(e.name)}`.toLowerCase().includes(query.trim().toLowerCase()))
    : statusFiltered;
  const firstName = (user?.name ?? '').trim().split(/\s+/)[0] || 'there';

  const toggleFilter = (value: StatusFilter) => setFilter((prev) => (prev === value ? 'all' : value));

  const renderEvent = ({ item }: { item: EventSummary }) => {
    const sport = getSportConfigFromEvent(item.category, item.name);
    const depts = item.departments ?? [];
    const opening = openingId === item.id;
    return (
      <Card style={[styles.card, opening && styles.cardOpening]} onPress={() => openEvent(item)}>
        <View style={[styles.tile, { backgroundColor: sport.colorLight }]}>
          <Icon name={sport.icon as IconName} size={20} color={sport.color} strokeWidth={2.2} />
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>{abbr(item.name)}</Text>
          <View style={styles.meta}>
            <Icon name="calendar" size={12} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{new Date(item.schedule).toLocaleDateString()}</Text>
            <Icon name="clock" size={12} color={COLORS.textMuted} />
            <Text style={styles.metaText}>{item.startTime}</Text>
            {depts.length > 0 && (
              <>
                <Icon name="users" size={12} color={COLORS.textMuted} />
                <Text style={styles.metaText}>{depts.length}</Text>
              </>
            )}
          </View>
        </View>

        <View style={[styles.dot, { backgroundColor: STATUS_DOT[item.status] }]} />
        <Icon name="chevron-right" size={18} color={COLORS.textMuted} />
      </Card>
    );
  };

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <ScreenHeader
          title={`Hello, ${firstName}`}
          subtitle="Here's what's happening today"
          right={
            <Pressable
              onPress={() => router.push('/(app)/notifications')}
              hitSlop={8}
              style={styles.bellButton}
              accessibilityRole="button"
              accessibilityLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : 'Notifications'}
            >
              <Icon name="bell" size={22} color={COLORS.textPrimary} strokeWidth={2} />
              {unreadCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </Pressable>
          }
        />

        {!loading && !error && (
          <View style={styles.searchWrap}>
            <Icon name="search" size={16} color={COLORS.textMuted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search events"
              placeholderTextColor={COLORS.textMuted}
              style={styles.searchInput}
              returnKeyType="search"
            />
            {query.length > 0 && (
              <Pressable onPress={() => setQuery('')} hitSlop={8}>
                <Icon name="close" size={16} color={COLORS.textMuted} />
              </Pressable>
            )}
          </View>
        )}

        {!loading && !error && (
          <View style={styles.grid}>
            <StatTile
              icon="activity"
              label="Live now"
              value={counts.ongoing}
              color={COLORS.success}
              tint={COLORS.successLight}
              active={filter === 'ongoing'}
              onPress={() => toggleFilter('ongoing')}
            />
            <StatTile
              icon="clock"
              label="Upcoming"
              value={counts.upcoming}
              color={COLORS.warning}
              tint={COLORS.warningLight}
              active={filter === 'upcoming'}
              onPress={() => toggleFilter('upcoming')}
            />
            <StatTile
              icon="check"
              label="Completed"
              value={counts.completed}
              color={COLORS.textSecondary}
              tint={COLORS.surfaceMuted}
              active={filter === 'completed'}
              onPress={() => toggleFilter('completed')}
            />
            <StatTile
              icon="wifi"
              label="Pending sync"
              value={pendingCount}
              color={COLORS.primary}
              tint={COLORS.primaryTint}
              onPress={() => router.push('/(app)/history')}
            />
          </View>
        )}

        <View style={styles.listHeaderRow}>
          <Text style={styles.listHeading}>
            {filter === 'all' ? 'All events' : `${filter[0].toUpperCase()}${filter.slice(1)} events`}
          </Text>
          {filter !== 'all' && (
            <Pressable onPress={() => setFilter('all')} hitSlop={8}>
              <Text style={styles.clearFilter}>Clear</Text>
            </Pressable>
          )}
        </View>
      </View>

      {loading ? (
        <View style={styles.headerPad}>
          <SkeletonList count={5} />
        </View>
      ) : error && !events.length ? (
        <ErrorState message={error} onRetry={isConnected ? fetchEvents : undefined} />
      ) : (
        <FlatList
          data={visibleEvents}
          keyExtractor={(e) => e.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
          ListEmptyComponent={
            <EmptyState
              icon={query ? 'search' : 'calendar'}
              title={query ? `No events match "${query}"` : filter === 'all' ? 'No events' : `No ${filter} events`}
              hint={query ? 'Try a different search term.' : undefined}
            />
          }
        />
      )}
    </Screen>
  );
}

// ── Dashboard stat tile ──────────────────────────────────────────────────────

function StatTile({
  icon,
  label,
  value,
  color,
  tint,
  active,
  onPress,
}: {
  icon: IconName;
  label: string;
  value: number;
  color: string;
  tint: string;
  active?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.stat, active && styles.statActive, pressed && styles.statPressed]}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
    >
      <View style={[styles.statIcon, { backgroundColor: tint }]}>
        <Icon name={icon} size={18} color={color} strokeWidth={2.2} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: SPACING.lg },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.sm },

  bellButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  bellBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 3,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: COLORS.surface,
  },
  bellBadgeText: { fontSize: 9, lineHeight: 11, fontWeight: '800', color: COLORS.textInverse },

  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    height: 44,
    marginBottom: SPACING.lg,
  },
  searchInput: { flex: 1, ...TYPE.body, color: COLORS.textPrimary, padding: 0 },

  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  stat: {
    flexBasis: '47%',
    flexGrow: 1,
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.xl,
    borderWidth: 1,
    borderColor: COLORS.hairline,
    padding: SPACING.md,
    gap: 4,
    ...SHADOWS.card,
  },
  statActive: { borderColor: COLORS.primary, borderWidth: 1.5 },
  statPressed: { opacity: 0.85 },
  statIcon: {
    width: 34,
    height: 34,
    borderRadius: RADIUS.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  statValue: { ...TYPE.title, color: COLORS.textPrimary },
  statLabel: { ...TYPE.caption, textTransform: 'none', color: COLORS.textSecondary, fontWeight: '600' },

  listHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: SPACING.sm },
  listHeading: { ...TYPE.heading, color: COLORS.textPrimary },
  clearFilter: { ...TYPE.label, color: COLORS.primary },

  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  cardOpening: { opacity: 0.55 },
  tile: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  name: { ...TYPE.subhead, color: COLORS.textPrimary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...TYPE.caption, textTransform: 'none', color: COLORS.textMuted, marginRight: SPACING.xs },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
