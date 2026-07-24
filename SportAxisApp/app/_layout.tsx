import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from '../src/store/auth.store';
import { useOfflineStore } from '../src/store/offline.store';
import { useOfflineSync } from '../src/hooks/use-offline-sync';
import { COLORS } from '../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Root Layout — Auth guard + offline sync + store hydration
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const hydrate        = useAuthStore((s) => s.hydrate);
  const hydrateOffline = useOfflineStore((s) => s.hydrate);
  const isHydrated     = useAuthStore((s) => s.isHydrated);
  const token          = useAuthStore((s) => s.token);

  // Mount offline sync watcher
  useOfflineSync();

  // Hydrate stores from AsyncStorage on first load
  useEffect(() => {
    Promise.all([hydrate(), hydrateOffline()]);
  }, []);

  return (
    <>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </>
  );
}
