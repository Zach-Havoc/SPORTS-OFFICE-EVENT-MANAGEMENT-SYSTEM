import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, SPACING, TYPE } from '../../constants/theme';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { useNetwork } from '../../src/hooks/use-network';
import { useAuthStore } from '../../src/store/auth.store';
import { useOfflineStore } from '../../src/store/offline.store';

// ─────────────────────────────────────────────────────────────────────────────
// App Layout — white tab bar + header, BatStateU-red active state.
// ─────────────────────────────────────────────────────────────────────────────

function TabIcon({ name, focused }: { name: IconName; focused: boolean }) {
  return (
    <View style={styles.tabIcon}>
      <Icon
        name={name}
        size={24}
        color={focused ? COLORS.primary : COLORS.textMuted}
        strokeWidth={focused ? 2.4 : 1.9}
      />
      <View style={[styles.tabDot, focused && styles.tabDotOn]} />
    </View>
  );
}

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandDot} />
      <Text style={styles.brandText}>SportAxis</Text>
    </View>
  );
}

export default function AppLayout() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { isConnected } = useNetwork();
  const pendingCount = useOfflineStore((s) => s.queue.filter((i) => i.status === 'pending').length);

  useEffect(() => {
    if (isHydrated && !token) router.replace('/(auth)/login');
  }, [isHydrated, token]);

  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        headerStyle: styles.header,
        headerShadowVisible: false,
        // The big in-screen title carries the screen name; the top bar is just
        // the brand mark + a connection dot.
        headerTitle: () => null,
        sceneStyle: { backgroundColor: COLORS.background },
        tabBarStyle: styles.tabBar,
        tabBarShowLabel: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textMuted,
        tabBarItemStyle: { paddingVertical: 8 },
        headerLeft: () => <Brand />,
        headerRight: () => (
          <View style={styles.headerRight}>
            {pendingCount > 0 && (
              <View style={styles.queuePill}>
                <Icon name="cloud-off" size={12} color={COLORS.warning} strokeWidth={2.2} />
                <Text style={styles.queueText}>{pendingCount}</Text>
              </View>
            )}
            <View style={[styles.connDot, { backgroundColor: isConnected ? COLORS.online : COLORS.offline }]} />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="events"
        options={{ title: 'Events', tabBarIcon: ({ focused }) => <TabIcon name="calendar" focused={focused} /> }}
      />
      <Tabs.Screen
        name="scanner"
        options={{ title: 'Scan QR', tabBarIcon: ({ focused }) => <TabIcon name="scan" focused={focused} /> }}
      />
      <Tabs.Screen name="scoring/[eventId]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="scoring/confirm" options={{ href: null, headerShown: false }} />
      <Tabs.Screen
        name="history"
        options={{ title: 'History', tabBarIcon: ({ focused }) => <TabIcon name="history" focused={focused} /> }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: COLORS.surface },
  headerTitle: { ...TYPE.heading, color: COLORS.textPrimary },

  brand: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs, paddingLeft: SPACING.lg },
  brandDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.primary },
  brandText: { ...TYPE.subhead, color: COLORS.textPrimary, fontWeight: '800' },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, paddingRight: SPACING.lg },
  connDot: { width: 9, height: 9, borderRadius: 5 },
  queuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.warningLight,
    borderRadius: 999,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  queueText: { ...TYPE.caption, color: COLORS.warning },

  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.hairline,
    height: 66,
    elevation: 0,
    shadowOpacity: 0,
  },
  tabIcon: { alignItems: 'center', gap: 5 },
  tabDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: 'transparent' },
  tabDotOn: { backgroundColor: COLORS.primary },
});
