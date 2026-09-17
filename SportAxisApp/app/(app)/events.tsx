import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { COLORS, RADIUS, SPACING, TYPE } from '../../constants/theme';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Card } from '../../src/components/ui/Card';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { EmptyState, ErrorState, LoadingState } from '../../src/components/ui/States';
import { eventService } from '../../src/services/event.service';
import { useEventStore } from '../../src/store/event.store';
import type { EventSummary } from '../../src/types';
import { useNetwork } from '../../src/hooks/use-network';
import { useDeptAbbreviator } from '../../src/hooks/use-dept-abbr';
import { getSportConfigFromEvent } from '../../src/utils/sport-config';

const STATUS_DOT = { ongoing: COLORS.success, completed: COLORS.textMuted, upcoming: COLORS.warning } as const;

export default function EventsScreen() {
  const router = useRouter();
  const abbr = useDeptAbbreviator();
  const { isConnected } = useNetwork();
  const loadEvent = useEventStore((s) => s.loadByQrToken);

  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);

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
        <ScreenHeader title="Events" />
      </View>

      {loading ? (
        <LoadingState label="Loading…" />
      ) : error && !events.length ? (
        <ErrorState message={error} onRetry={isConnected ? fetchEvents : undefined} />
      ) : (
        <FlatList
          data={events}
          keyExtractor={(e) => e.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={COLORS.primary} colors={[COLORS.primary]} />}
          ListEmptyComponent={<EmptyState icon="calendar" title="No events" />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: SPACING.lg },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.sm },

  card: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  cardOpening: { opacity: 0.55 },
  tile: { width: 44, height: 44, borderRadius: RADIUS.lg, alignItems: 'center', justifyContent: 'center' },
  body: { flex: 1, gap: 3 },
  name: { ...TYPE.subhead, color: COLORS.textPrimary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { ...TYPE.caption, textTransform: 'none', color: COLORS.textMuted, marginRight: SPACING.xs },
  dot: { width: 7, height: 7, borderRadius: 4 },
});
