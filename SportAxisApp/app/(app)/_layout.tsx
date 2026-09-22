import { Tabs, useRouter } from 'expo-router';
import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { COLORS, RADIUS, SHADOWS, SPACING, TYPE } from '../../constants/theme';
import { Icon, type IconName } from '../../src/components/ui/Icon';
import { useNetwork } from '../../src/hooks/use-network';
import { useAuthStore } from '../../src/store/auth.store';
import { useOfflineStore } from '../../src/store/offline.store';

// ─────────────────────────────────────────────────────────────────────────────
// App Layout — white tab bar + header, BatStateU-red active state. The active
// tab itself becomes the raised circular button, so whichever screen you're
// on gets the one visual signal instead of a fixed spot always looking "on".
// ─────────────────────────────────────────────────────────────────────────────

const CIRCLE_SIZE = 56;

// Derived from Tabs itself rather than imported from @react-navigation/bottom-tabs directly —
// expo-router re-declares this type against its own internal module, and the two don't
// structurally match closely enough for TS to accept one in place of the other.
type TabsTabBarProp = React.ComponentProps<typeof Tabs>['tabBar'];
type CustomTabBarProps = TabsTabBarProp extends ((props: infer P) => React.ReactNode) | undefined ? P : never;

const TAB_ROUTES: { name: string; icon: IconName; label: string }[] = [
  { name: 'events', icon: 'calendar', label: 'Home' },
  { name: 'history', icon: 'history', label: 'Sync' },
  { name: 'scanner', icon: 'scan', label: 'Scan' },
  { name: 'profile', icon: 'users', label: 'Profile' },
];

/** Custom tab bar so the one floating red circle can slide to whichever tab is active. */
function CustomTabBar({ state, navigation, insets }: CustomTabBarProps) {
  const [barWidth, setBarWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;

  const visibleRoutes = state.routes.filter((r) => TAB_ROUTES.some((t) => t.name === r.name));
  const activeRoute = state.routes[state.index];
  const activeIndex = visibleRoutes.findIndex((r) => r.key === activeRoute.key);
  const tabWidth = barWidth / (visibleRoutes.length || 1);

  useEffect(() => {
    if (!barWidth || activeIndex < 0) return;
    Animated.spring(translateX, {
      toValue: activeIndex * tabWidth + (tabWidth - CIRCLE_SIZE) / 2,
      useNativeDriver: true,
      friction: 8,
      tension: 60,
    }).start();
  }, [activeIndex, barWidth]);

  const activeConfig = TAB_ROUTES.find((t) => t.name === activeRoute.name);

  return (
    <View
      style={[styles.tabBar, { height: 66 + insets.bottom, paddingBottom: insets.bottom }]}
      onLayout={(e) => setBarWidth(e.nativeEvent.layout.width)}
    >
      {barWidth > 0 && activeConfig && (
        <Animated.View pointerEvents="none" style={[styles.fab, { transform: [{ translateX }] }]}>
          <Icon name={activeConfig.icon} size={24} color={COLORS.textInverse} strokeWidth={2.2} />
        </Animated.View>
      )}

      <View style={styles.tabRow}>
        {visibleRoutes.map((route) => {
          const config = TAB_ROUTES.find((t) => t.name === route.name)!;
          const isFocused = route.key === activeRoute.key;
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!isFocused && !event.defaultPrevented) navigation.navigate(route.name);
          };
          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              style={styles.tabItem}
              accessibilityRole="button"
              accessibilityLabel={config.label}
              accessibilityState={isFocused ? { selected: true } : {}}
            >
              {!isFocused && <Icon name={config.icon} size={24} color={COLORS.textMuted} strokeWidth={1.9} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function Brand() {
  return (
    <View style={styles.brand}>
      <View style={styles.brandDot} />
      <Text style={styles.brandText}>SportsAxis</Text>
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
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: true,
        headerStyle: styles.header,
        headerShadowVisible: false,
        // The big in-screen title carries the screen name; the top bar is just
        // the brand mark + a connection dot.
        headerTitle: () => null,
        sceneStyle: { backgroundColor: COLORS.background },
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
      <Tabs.Screen name="events" options={{ title: 'Home' }} />
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
    elevation: 0,
    shadowOpacity: 0,
    overflow: 'visible',
  },
  tabRow: { flex: 1, flexDirection: 'row' },
  tabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  fab: {
    position: 'absolute',
    top: -26,
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: COLORS.surface,
    ...SHADOWS.lg,
  },
});
