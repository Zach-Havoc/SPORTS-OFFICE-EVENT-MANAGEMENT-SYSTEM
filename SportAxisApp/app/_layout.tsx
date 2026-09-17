import { Stack } from 'expo-router';
import { useCallback, useEffect, useRef } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, PanResponder, View } from 'react-native';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
// Sub-path imports so Metro only bundles these 5 faces, not the whole family.
import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { Inter_800ExtraBold } from '@expo-google-fonts/inter/800ExtraBold';
import { useAuthStore } from '../src/store/auth.store';
import { useOfflineStore } from '../src/store/offline.store';
import { useOfflineSync } from '../src/hooks/use-offline-sync';
import { setUnauthorizedHandler } from '../src/services/api';
import { applyTextDefaults } from '../src/utils/text-defaults';
import { COLORS } from '../constants/theme';

// Inter everywhere + low-vision size bump (patches <Text>/<TextInput>).
applyTextDefaults();

// Keep the native splash up until Inter is ready.
SplashScreen.preventAutoHideAsync().catch(() => {});

// 5 minutes in milliseconds
const INACTIVITY_TIMEOUT_MS = 5 * 60 * 1000;

// ─────────────────────────────────────────────────────────────────────────────
// Root Layout — Auth guard + offline sync + store hydration
// ─────────────────────────────────────────────────────────────────────────────

export default function RootLayout() {
  const hydrate        = useAuthStore((s) => s.hydrate);
  const hydrateOffline = useOfflineStore((s) => s.hydrate);
  const isHydrated     = useAuthStore((s) => s.isHydrated);
  const token          = useAuthStore((s) => s.token);
  const logout         = useAuthStore((s) => s.logout);

  const [fontsLoaded] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
    Inter_800ExtraBold,
  });

  const onLayout = useCallback(() => {
    if (fontsLoaded) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded]);

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastInteractionRef = useRef<number>(Date.now());
  const appState = useRef(AppState.currentState);

  const resetTimer = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    lastInteractionRef.current = Date.now();
    
    // Only set timer if user is logged in
    if (token) {
      timeoutRef.current = setTimeout(() => {
        console.log('User inactive for 5 minutes. Logging out.');
        logout();
      }, INACTIVITY_TIMEOUT_MS);
    }
  };

  // Setup PanResponder to intercept all touches globally
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponderCapture: () => {
        resetTimer();
        return false;
      },
      onMoveShouldSetPanResponderCapture: () => {
        resetTimer();
        return false;
      },
    })
  ).current;

  useEffect(() => {
    resetTimer();
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [token]);

  // Handle AppState changes to detect background inactivity
  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextAppState => {
      if (
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active'
      ) {
        // App has come to the foreground, check if 5 minutes passed
        const now = Date.now();
        if (token && now - lastInteractionRef.current >= INACTIVITY_TIMEOUT_MS) {
          console.log('User was inactive in background for 5 minutes. Logging out.');
          logout();
        } else {
          resetTimer();
        }
      }
      appState.current = nextAppState;
    });

    return () => {
      subscription.remove();
    };
  }, [token, logout]);

  // Mount offline sync watcher
  useOfflineSync();

  // A 401 on any authenticated request clears auth and drops back to login.
  useEffect(() => {
    setUnauthorizedHandler(() => {
      void useAuthStore.getState().forceLogout();
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  // Hydrate stores from AsyncStorage on first load
  useEffect(() => {
    Promise.all([hydrate(), hydrateOffline()]);
  }, []);

  if (!fontsLoaded) return null;

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.background }} onLayout={onLayout} {...panResponder.panHandlers}>
      <StatusBar style="dark" backgroundColor={COLORS.surface} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: COLORS.background } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </View>
  );
}
