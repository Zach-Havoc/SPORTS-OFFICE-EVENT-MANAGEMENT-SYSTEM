import { Tabs, useRouter } from 'expo-router';
import type React from 'react';
import { useEffect } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SPACING, TYPE } from '../../constants/theme';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { useNetwork } from '../../src/hooks/use-network';
import { useAuthStore } from '../../src/store/auth.store';
import { useOfflineStore } from '../../src/store/offline.store';

// ─────────────────────────────────────────────────────────────────────────────
// App layout.
//
// The previous tab bar rendered nothing in the focused slot and floated a
// 56px red circle above the bar instead. That meant no tab ever showed a
// label, the active slot was a visible gap, and the circle sat on top of
// whatever content was underneath it. The labels existed in code but were
// passed only to accessibilityLabel, so screen readers were told the name of
// each tab and sighted users were not.
//
// This is a conventional labelled tab bar: icon over label, both present in
// every state, the brand colour reserved for the one that is selected. A tab
// bar is pressed dozens of times a day, so it does not animate; the colour
// and weight change is the state indication and it is instant.
// ─────────────────────────────────────────────────────────────────────────────

type TabsTabBarProp = React.ComponentProps<typeof Tabs>['tabBar'];
type CustomTabBarProps = TabsTabBarProp extends ((props: infer P) => React.ReactNode) | undefined ? P : never;

const TAB_ROUTES: { name: string; icon: IconName; label: string }[] = [
  { name: 'events', icon: 'calendar', label: 'Events' },
  { name: 'history', icon: 'history', label: 'Sync' },
  { name: 'scanner', icon: 'scan', label: 'Scan' },
  { name: 'profile', icon: 'users', label: 'Profile' },
];

const SCREEN_TITLES: Record<string, string> = {
  events: 'Events',
  history: 'Sync queue',
  scanner: 'Scan',
  profile: 'Profile',
};

function TabBar({ state, navigation, insets }: CustomTabBarProps) {
  const visibleRoutes = state.routes.filter((r) => TAB_ROUTES.some((t) => t.name === r.name));
  const activeKey = state.routes[state.index]?.key;

  return (
    <View style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
      {visibleRoutes.map((route) => {
        const config = TAB_ROUTES.find((t) => t.name === route.name)!;
        const isFocused = route.key === activeKey;

        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        return (
          <Pressable
            key={route.key}
            onPress={onPress}
            style={({ pressed }) => [styles.tabItem, pressed && styles.tabItemPressed]}
            accessibilityRole="tab"
            accessibilityLabel={config.label}
            accessibilityState={{ selected: isFocused }}
            hitSlop={4}
          >
            <Icon
              name={config.icon}
              size={22}
              color={isFocused ? COLORS.brand : COLORS.textMuted}
              strokeWidth={isFocused ? 2.1 : 1.8}
            />
            <Text
              numberOfLines={1}
              style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
            >
              {config.label}
            </Text>
          </Pressable>
        );
      })}
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
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={({ route }) => ({
        headerShown: true,
        headerStyle: styles.header,
        headerShadowVisible: false,
        headerTitleAlign: 'left' as const,
        // The header names the screen. It used to show a decorative brand dot
        // and the wordmark, which left the app with no visible indication of
        // where the user was on any screen.
        headerTitle: () => (
          <Text style={styles.headerTitle} numberOfLines={1}>
            {SCREEN_TITLES[route.name] ?? ''}
          </Text>
        ),
        sceneStyle: { backgroundColor: COLORS.background },
        headerRight: () => (
          <View style={styles.headerRight}>
            {pendingCount > 0 && (
              <View style={styles.queuePill}>
                <Icon name="cloud-off" size={12} color={COLORS.warning} strokeWidth={2.2} />
                <Text style={styles.queueText}>
                  {pendingCount} queued
                </Text>
              </View>
            )}
            {!isConnected && (
              <View style={styles.offlinePill}>
                <Icon name="wifi-off" size={12} color={COLORS.textSecondary} strokeWidth={2.2} />
                <Text style={styles.offlineText}>Offline</Text>
              </View>
            )}
          </View>
        ),
      })}
    >
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
      <Tabs.Screen name="history" options={{ title: 'Sync' }} />
      <Tabs.Screen name="scanner" options={{ title: 'Scan' }} />
      <Tabs.Screen name="scoring/[eventId]" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="scoring/confirm" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="profile" options={{ title: 'Profile' }} />
      <Tabs.Screen name="profile/edit" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="profile/change-password" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="notifications" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="settings" options={{ href: null, headerShown: false }} />
      <Tabs.Screen name="privacy-notice" options={{ href: null, headerShown: false }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  header: { backgroundColor: COLORS.surface },
  headerTitle: {
    ...TYPE.heading,
    color: COLORS.textPrimary,
    paddingLeft: Platform.OS === 'android' ? 0 : SPACING.xs,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingRight: SPACING.lg,
  },
  // A green "connected" dot on every screen states the normal case forever.
  // Only the exception is worth the space.
  queuePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.warningLight,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  queueText: { ...TYPE.caption, color: COLORS.warning },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.surfaceAlt,
    borderRadius: RADIUS.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  offlineText: { ...TYPE.caption, color: COLORS.textSecondary },

  tabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.border,
    paddingTop: SPACING.sm,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    // Comfortably past the 44/48dp minimum once the label and padding are in.
    minHeight: 48,
    borderRadius: RADIUS.sm,
  },
  tabItemPressed: { backgroundColor: COLORS.pressed },
  tabLabel: { ...TYPE.caption, color: COLORS.textMuted },
  tabLabelActive: { color: COLORS.brand, fontWeight: '500' },
});
