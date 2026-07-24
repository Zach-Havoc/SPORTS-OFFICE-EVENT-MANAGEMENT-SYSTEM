import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import {
    Alert,
    FlatList, StyleSheet,
    Text,
    View
} from 'react-native';
import {
    COLORS,
    FONT_SIZE, FONT_WEIGHT, RADIUS,
    SPACING,
} from '../../constants/theme';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { useNetwork } from '../../src/hooks/use-network';
import { useOfflineStore } from '../../src/store/offline.store';
import type { OfflineQueueItem } from '../../src/types';

// ─────────────────────────────────────────────────────────────────────────────
// History Screen — BatStateU red-and-white offline queue management
// ─────────────────────────────────────────────────────────────────────────────

export default function HistoryScreen() {
  const queue       = useOfflineStore((s) => s.queue);
  const syncAll     = useOfflineStore((s) => s.syncAll);
  const clearFailed = useOfflineStore((s) => s.clearFailed);
  const isSyncing   = useOfflineStore((s) => s.isSyncing);
  const { isConnected } = useNetwork();

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const failedCount  = queue.filter((i) => i.status === 'failed').length;

  const handleSync = async () => {
    if (!isConnected) {
      Alert.alert('No Connection', 'You need an internet connection to sync scores.');
      return;
    }
    await syncAll();
    Alert.alert('Sync Complete', 'All pending scores have been synced.');
  };

  const handleClearFailed = () => {
    Alert.alert(
      'Clear Failed Submissions',
      `Remove ${failedCount} failed submission(s)? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Clear', style: 'destructive', onPress: clearFailed },
      ],
    );
  };

  const renderItem = ({ item }: { item: OfflineQueueItem }) => {
    const statusVariant =
      item.status === 'pending'  ? 'warning' :
      item.status === 'syncing'  ? 'info'    :
      item.status === 'failed'   ? 'error'   : 'success';

    const retryLabel = item.retry_count > 0 ? ` (retry ${item.retry_count}/3)` : '';

    return (
      <Card style={styles.queueItem}>
        <View style={styles.queueHeader}>
          <View style={styles.queueLeft}>
            <Text style={styles.queueDept}>{item.payload.department}</Text>
            <Text style={styles.queueEvent} numberOfLines={1}>
              Event #{item.payload.eventId}
            </Text>
          </View>
          <Badge label={item.status.toUpperCase() + retryLabel} variant={statusVariant} />
        </View>
        <View style={styles.queueMeta}>
          <Text style={styles.metaText}>
            Score: {item.payload.totalScore.toFixed(2)} · {item.payload.method}
          </Text>
          <Text style={styles.metaText}>
            {new Date(item.created_at).toLocaleString()}
          </Text>
        </View>
        {item.error && (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={14} color={COLORS.destructive} style={{ marginRight: 4 }} />
            <Text style={styles.errorText}>{item.error}</Text>
          </View>
        )}
      </Card>
    );
  };

  return (
    <View style={styles.container}>

      {/* Red summary header — like web sidebar */}
      <View style={styles.summaryHeader}>
        <View style={styles.summaryItem}>
          <Text style={styles.summaryCount}>{queue.length}</Text>
          <Text style={styles.summaryLabel}>Total</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, styles.pendingCount]}>{pendingCount}</Text>
          <Text style={styles.summaryLabel}>Pending</Text>
        </View>
        <View style={styles.summaryDivider} />
        <View style={styles.summaryItem}>
          <Text style={[styles.summaryCount, styles.failedCount]}>{failedCount}</Text>
          <Text style={styles.summaryLabel}>Failed</Text>
        </View>
      </View>

      {/* Action buttons */}
      {(pendingCount > 0 || failedCount > 0) && (
        <View style={styles.actions}>
          {pendingCount > 0 && (
            <Button
              label={isSyncing ? 'Syncing…' : `Sync ${pendingCount} Pending`}
              onPress={handleSync}
              loading={isSyncing}
              variant="primary"
              size="md"
              fullWidth
            />
          )}
          {failedCount > 0 && (
            <Button
              label={`Clear ${failedCount} Failed`}
              onPress={handleClearFailed}
              variant="danger"
              size="md"
              fullWidth
            />
          )}
        </View>
      )}

      {/* Queue list */}
      {queue.length === 0 ? (
        <View style={styles.emptyState}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="document-text-outline" size={36} color={COLORS.primary} />
          </View>
          <Text style={styles.emptyTitle}>No Queued Submissions</Text>
          <Text style={styles.emptySub}>
            Scores submitted while offline will appear here until they sync.
          </Text>
        </View>
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Connection status footer — matches web footer style */}
      <View style={[
        styles.footer,
        { borderTopColor: isConnected ? COLORS.success : COLORS.warning },
      ]}>
        <View
          style={[styles.connDot, { backgroundColor: isConnected ? COLORS.online : COLORS.offline }]}
        />
        <Text style={styles.footerText}>
          {isConnected
            ? 'Connected — auto-sync active'
            : 'Offline — scores queued locally'}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex:            1,
    backgroundColor: COLORS.background,
  },

  // Red summary header
  summaryHeader: {
    backgroundColor: COLORS.primary,
    flexDirection:   'row',
    paddingVertical: SPACING.lg,
  },
  summaryItem: {
    flex:       1,
    alignItems: 'center',
    gap:        SPACING.xs,
  },
  summaryCount: {
    fontSize:   FONT_SIZE.xxl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textInverse,
  },
  pendingCount: { color: COLORS.primaryPale },
  failedCount:  { color: '#FCA5A5' },   // red-300
  summaryLabel: {
    fontSize: FONT_SIZE.xs,
    color:    'rgba(255,255,255,0.70)',
    fontWeight: FONT_WEIGHT.medium,
  },
  summaryDivider: {
    width:          1,
    backgroundColor: 'rgba(255,255,255,0.20)',
    marginVertical: SPACING.xs,
  },

  // Actions
  actions: {
    padding: SPACING.md,
    gap:     SPACING.sm,
  },

  // List
  listContent: {
    padding: SPACING.md,
    gap:     SPACING.sm,
  },
  queueItem: { gap: SPACING.sm },
  queueHeader: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    alignItems:     'flex-start',
  },
  queueLeft:  { flex: 1, gap: 2, marginRight: SPACING.sm },
  queueDept: {
    fontSize:   FONT_SIZE.md,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
  },
  queueEvent: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.textSecondary,
  },
  queueMeta: {
    flexDirection:  'row',
    justifyContent: 'space-between',
    flexWrap:       'wrap',
    gap:            SPACING.xs,
  },
  metaText: {
    fontSize: FONT_SIZE.xs,
    color:    COLORS.textMuted,
  },
  errorRow: {
    flexDirection: 'row',
    alignItems:    'center',
    marginTop:     SPACING.xs,
  },
  errorText: {
    fontSize:   FONT_SIZE.xs,
    color:      COLORS.destructive,
    fontWeight: FONT_WEIGHT.medium,
    flex:       1,
  },

  // Empty state
  emptyState: {
    flex:           1,
    alignItems:     'center',
    justifyContent: 'center',
    padding:        SPACING.xl,
    gap:            SPACING.lg,
  },
  emptyIconBox: {
    width:           80,
    height:          80,
    borderRadius:    RADIUS.full,
    backgroundColor: COLORS.primaryPale,
    alignItems:      'center',
    justifyContent:  'center',
  },
  emptyTitle: {
    fontSize:   FONT_SIZE.xl,
    fontWeight: FONT_WEIGHT.bold,
    color:      COLORS.textPrimary,
    textAlign:  'center',
  },
  emptySub: {
    fontSize:  FONT_SIZE.md,
    color:     COLORS.textSecondary,
    textAlign: 'center',
  },

  // Footer — matches web footer style
  footer: {
    flexDirection:  'row',
    alignItems:     'center',
    gap:            SPACING.sm,
    padding:        SPACING.md,
    borderTopWidth: 2,
    backgroundColor: COLORS.surface,
  },
  connDot: {
    width:        8,
    height:       8,
    borderRadius: 4,
  },
  footerText: {
    fontSize: FONT_SIZE.sm,
    color:    COLORS.textSecondary,
  },
});
