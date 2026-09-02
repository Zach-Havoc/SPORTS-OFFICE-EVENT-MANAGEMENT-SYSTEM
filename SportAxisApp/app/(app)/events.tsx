import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, FONT_SIZE, FONT_WEIGHT, SPACING, RADIUS } from '../../constants/theme';
import { Card } from '../../src/components/ui/Card';
import { Badge } from '../../src/components/ui/Badge';
import { eventService } from '../../src/services/event.service';
import type { EventSummary } from '../../src/types';
import { useNetwork } from '../../src/hooks/use-network';
import { useDeptAbbreviator } from '../../src/hooks/use-dept-abbr';

export default function EventsScreen() {
  const [events, setEvents] = useState<EventSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { isConnected } = useNetwork();
  const abbr = useDeptAbbreviator();

  const fetchEvents = async () => {
    try {
      setError(null);
      const data = await eventService.getEvents();
      setEvents(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load events');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    if (isConnected) {
      fetchEvents();
    } else {
      setLoading(false);
      setError('No internet connection. Please connect to view events.');
    }
  }, [isConnected]);

  const onRefresh = () => {
    if (!isConnected) return;
    setRefreshing(true);
    fetchEvents();
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ongoing': return 'info';
      case 'completed': return 'success';
      case 'upcoming':
      default: return 'warning';
    }
  };

  const renderEvent = ({ item }: { item: EventSummary }) => {
    return (
      <Card style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={styles.titleContainer}>
            <Text style={styles.eventName}>{item.name}</Text>
            <Text style={styles.categoryName}>{item.category}</Text>
          </View>
          <Badge label={item.status.toUpperCase()} variant={getStatusColor(item.status)} />
        </View>

        <View style={styles.detailsContainer}>
          <View style={styles.detailRow}>
            <Ionicons name="calendar-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>
              {new Date(item.schedule).toLocaleDateString()}
            </Text>
          </View>
          <View style={styles.detailRow}>
            <Ionicons name="time-outline" size={14} color={COLORS.textSecondary} />
            <Text style={styles.detailText}>
              {item.startTime} - {item.endTime}
            </Text>
          </View>
          {item.venueName && (
            <View style={styles.detailRow}>
              <Ionicons name="location-outline" size={14} color={COLORS.textSecondary} />
              <Text style={styles.detailText}>{item.venueName}</Text>
            </View>
          )}
        </View>

        {item.departments.length > 0 && (
          <View style={styles.departmentsContainer}>
            <Text style={styles.departmentsText}>
              {item.departments.slice(0, 3).map((d) => abbr(d)).join(' · ')}
              {item.departments.length > 3 && ` +${item.departments.length - 3} more`}
            </Text>
          </View>
        )}
      </Card>
    );
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading Events...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {error && !events.length ? (
        <View style={styles.centerContainer}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.destructive} />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => item.id}
          renderItem={renderEvent}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[COLORS.primary]}
            />
          }
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="calendar-outline" size={48} color={COLORS.textMuted} />
              <Text style={styles.emptyText}>No events available</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  loadingText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textSecondary,
  },
  errorText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.destructive,
    textAlign: 'center',
  },
  listContent: {
    padding: SPACING.md,
    gap: SPACING.md,
  },
  card: {
    gap: SPACING.md,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  titleContainer: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  eventName: {
    fontSize: FONT_SIZE.lg,
    fontWeight: FONT_WEIGHT.bold,
    color: COLORS.textPrimary,
    marginBottom: 2,
  },
  categoryName: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.primary,
    fontWeight: FONT_WEIGHT.medium,
  },
  detailsContainer: {
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  departmentsContainer: {
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  departmentsText: {
    fontSize: FONT_SIZE.sm,
    color: COLORS.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: SPACING.xxl,
  },
  emptyText: {
    marginTop: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.textMuted,
  },
});
