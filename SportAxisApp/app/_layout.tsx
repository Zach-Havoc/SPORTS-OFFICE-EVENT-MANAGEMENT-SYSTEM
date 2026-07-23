import { Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { AppState, PanResponder, View } from 'react-native';
import { useAuthStore } from '../src/store/auth.store';
import { useOfflineStore } from '../src/store/offline.store';
import { useOfflineSync } from '../src/hooks/use-offline-sync';
import { COLORS } from '../constants/theme';

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

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
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

  // Hydrate stores from AsyncStorage on first load
  useEffect(() => {
    Promise.all([hydrate(), hydrateOffline()]);
  }, []);

  return (
    <View style={{ flex: 1 }} {...panResponder.panHandlers}>
      <StatusBar style="light" backgroundColor={COLORS.background} />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(app)" />
      </Stack>
    </View>
  );
}
