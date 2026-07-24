import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { COLORS, FONT_SIZE, FONT_WEIGHT, RADIUS, SPACING } from '../../constants/theme';
import { useNetwork } from '../../src/hooks/use-network';
import { useAuthStore } from '../../src/store/auth.store';
import { useOfflineStore } from '../../src/store/offline.store';

// ─────────────────────────────────────────────────────────────────────────────
// App Layout — BatStateU red tab bar, connection indicator, offline pill
// ─────────────────────────────────────────────────────────────────────────────

export default function AppLayout() {
  const router     = useRouter();
  const token      = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const { isConnected } = useNetwork();
  const pendingCount    = useOfflineStore((s) =>
    s.queue.filter((i) => i.status === 'pending').length,
  );

  useEffect(() => {
    if (isHydrated && !token) {
      router.replace('/(auth)/login');
    }
  }, [isHydrated, token]);

  return (
    <Tabs
      screenOptions={{
        headerShown:          true,
        // White header with red tint — matches web top nav
        headerStyle:          { backgroundColor: COLORS.surface },
        headerTintColor:      COLORS.primary,
        headerTitleStyle:     {
          fontWeight: FONT_WEIGHT.bold,
          fontSize:   FONT_SIZE.lg,
          color:      COLORS.textPrimary,
        },
        // White tab bar — matches web card backgrounds
        tabBarStyle:          styles.tabBar,
        tabBarActiveTintColor:   COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarLabelStyle:     styles.tabLabel,
        // Header left — BatStateU branding
        headerLeft: () => (
          <View style={styles.headerBrand}>
            <Ionicons name="trophy" size={20} color={COLORS.primary} />
          </View>
        ),
        // Header right — connection indicator + offline queue pill
        headerRight: () => (
          <View style={styles.headerRight}>
            {pendingCount > 0 && (
              <View style={styles.offlinePill}>
                <Text style={styles.offlinePillText}>{pendingCount} queued</Text>
              </View>
            )}
            <View
              style={[
                styles.connDot,
                { backgroundColor: isConnected ? COLORS.online : COLORS.offline },
              ]}
            />
          </View>
        ),
      }}
    >
      <Tabs.Screen
        name="scanner"
        options={{
          title: 'Scan QR',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="camera" size={22} color={focused ? COLORS.primary : COLORS.textSecondary} />
          ),
        }}
      />
      <Tabs.Screen
        name="scoring/[eventId]"
        options={{
          title: 'Score',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="bar-chart" size={22} color={focused ? COLORS.primary : COLORS.textSecondary} />
          ),
          href: null,
        }}
      />
      <Tabs.Screen
        name="scoring/confirm"
        options={{
          href: null,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'History',
          tabBarIcon: ({ focused }) => (
            <Ionicons name="list" size={22} color={focused ? COLORS.primary : COLORS.textSecondary} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  // Tab bar — clean white, top red border like web
  tabBar: {
    backgroundColor: COLORS.surface,
    borderTopWidth:  2,
    borderTopColor:  COLORS.primary,
    height:          64,
    paddingBottom:   8,
    paddingTop:      4,
    shadowColor:     '#000',
    shadowOffset:    { width: 0, height: -2 },
    shadowOpacity:   0.06,
    shadowRadius:    4,
    elevation:       8,
  },
  tabLabel: {
    fontSize:   FONT_SIZE.xs,
    fontWeight: FONT_WEIGHT.semibold,
  },

  // Header brand
  headerBrand: {
    flexDirection:  'row',
    alignItems:     'center',
    paddingLeft:    SPACING.md,
    gap:            SPACING.xs,
  },

  // Header right
  headerRight: {
    flexDirection: 'row',
    alignItems:    'center',
    gap:           SPACING.sm,
    paddingRight:  SPACING.md,
  },
  connDot: {
    width:        10,
    height:       10,
    borderRadius: 5,
  },
  offlinePill: {
    backgroundColor:   COLORS.warningLight,
    borderRadius:      RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical:   2,
    borderWidth:       1,
    borderColor:       COLORS.warning,
  },
  offlinePillText: {
    fontSize:   FONT_SIZE.xs,
    color:      COLORS.warning,
    fontWeight: FONT_WEIGHT.semibold,
  },
});
