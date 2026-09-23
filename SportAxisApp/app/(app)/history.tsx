import React, { useCallback } from 'react';
import { Alert, FlatList, StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPE } from '../../constants/theme';
import { Screen, ScreenHeader } from '../../src/components/ui/Screen';
import { Badge } from '../../src/components/ui/Badge';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Icon } from '../../src/components/ui/Icon';
import { EmptyState } from '../../src/components/ui/States';
import { useNetwork } from '../../src/hooks/use-network';
import { useOfflineStore } from '../../src/store/offline.store';
import { useDeptAbbreviator } from '../../src/hooks/use-dept-abbr';
import type { OfflineQueueItem, OfflineQueueStatus } from '../../src/types';

const STATUS_BADGE: Record<OfflineQueueStatus, { label: string; variant: 'warning' | 'info' | 'error' }> = {
  pending: { label: 'Pending', variant: 'warning' },
  syncing: { label: 'Syncing', variant: 'info' },
  failed:  { label: 'Failed',  variant: 'error' },
};

export default function HistoryScreen() {
  const queue = useOfflineStore((s) => s.queue);
  const syncAll = useOfflineStore((s) => s.syncAll);
  const clearFailed = useOfflineStore((s) => s.clearFailed);
  const isSyncing = useOfflineStore((s) => s.isSyncing);
  const { isConnected } = useNetwork();
  const abbr = useDeptAbbreviator();

  const pendingCount = queue.filter((i) => i.status === 'pending').length;
  const failedCount = queue.filter((i) => i.status === 'failed').length;

  const handleSync = async () => {
    if (!isConnected) {
      Alert.alert('No connection', 'You need internet to sync scores.');
      return;
    }
    await syncAll();
    Alert.alert('Synced', 'All pending scores are synced.');
  };

  const handleClearFailed = () => {
    Alert.alert('Clear failed', `Remove ${failedCount} failed submission(s)?`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: clearFailed },
    ]);
  };

  const renderItem = useCallback(
    ({ item }: { item: OfflineQueueItem }) => {
      const badge = STATUS_BADGE[item.status];
      return (
        <Card style={styles.item}>
          <View style={styles.itemBody}>
            <View style={styles.itemTop}>
              <Text style={styles.dept} numberOfLines={1}>{abbr(item.payload.department)}</Text>
              <Badge label={badge.label} variant={badge.variant} dot />
            </View>
            <Text style={styles.time} numberOfLines={1}>
              {new Date(item.created_at).toLocaleString()}
              {item.error ? ` · ${item.error}` : ''}
            </Text>
          </View>
          <Text style={styles.score}>{item.payload.totalScore.toFixed(0)}</Text>
        </Card>
      );
    },
    [abbr],
  );

  return (
    <Screen padded={false}>
      <View style={styles.headerPad}>
        <ScreenHeader
          title="Sync"
          right={<View style={[styles.conn, { backgroundColor: isConnected ? COLORS.online : COLORS.offline }]} />}
        />

        <Card style={styles.hero}>
          <View style={styles.heroMain}>
            <Text style={styles.heroNum}>{pendingCount}</Text>
            <Text style={styles.heroLabel}>pending</Text>
          </View>
          <View style={styles.heroSide}>
            <Text style={styles.sideNum}>{queue.length}</Text>
            <Text style={styles.sideLabel}>total</Text>
          </View>
          <View style={styles.heroSide}>
            <Text style={[styles.sideNum, failedCount > 0 && { color: COLORS.destructive }]}>{failedCount}</Text>
            <Text style={styles.sideLabel}>failed</Text>
          </View>
        </Card>

        {(pendingCount > 0 || failedCount > 0) && (
          <View style={styles.actions}>
            {pendingCount > 0 && (
              <Button
                label={isSyncing ? 'Syncing…' : 'Sync'}
                onPress={handleSync}
                loading={isSyncing}
                fullWidth
                icon={<Icon name="refresh" size={16} color={COLORS.textInverse} />}
              />
            )}
            {failedCount > 0 && (
              <Button label="Clear failed" onPress={handleClearFailed} variant="danger" fullWidth />
            )}
          </View>
        )}
      </View>

      {queue.length === 0 ? (
        <EmptyState icon="check-circle" title="All caught up" />
      ) : (
        <FlatList
          data={queue}
          keyExtractor={(i) => i.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerPad: { paddingHorizontal: SPACING.lg },
  list: { paddingHorizontal: SPACING.lg, paddingBottom: SPACING.xxl, gap: SPACING.sm, marginTop: SPACING.md },

  conn: { width: 9, height: 9, borderRadius: 5 },

  hero: { flexDirection: 'row', alignItems: 'center', padding: SPACING.lg, gap: SPACING.lg },
  heroMain: { flex: 1 },
  heroNum: { ...TYPE.display, fontSize: 44, lineHeight: 48, color: COLORS.textPrimary },
  heroLabel: { ...TYPE.label, color: COLORS.textMuted },
  heroSide: { alignItems: 'center', gap: 2 },
  sideNum: { ...TYPE.title, color: COLORS.textPrimary },
  sideLabel: { ...TYPE.caption, textTransform: 'uppercase', color: COLORS.textMuted },

  actions: { gap: SPACING.sm, marginTop: SPACING.md },

  item: { flexDirection: 'row', alignItems: 'center', gap: SPACING.md, padding: SPACING.md },
  itemBody: { flex: 1, gap: 4 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm },
  dept: { ...TYPE.subhead, color: COLORS.textPrimary, flexShrink: 1 },
  time: { ...TYPE.caption, textTransform: 'none', color: COLORS.textMuted },
  score: { ...TYPE.title, color: COLORS.textPrimary },
});
