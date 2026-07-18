import { Stack } from 'expo-router';
import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../src/store/auth.store';
import { COLORS } from '../../constants/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Auth Layout — redirects to app if already logged in
// ─────────────────────────────────────────────────────────────────────────────

export default function AuthLayout() {
  const router     = useRouter();
  const token      = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  useEffect(() => {
    if (isHydrated && token) {
      router.replace('/(app)/scanner');
    }
  }, [isHydrated, token]);

  return (
    <Stack
      screenOptions={{
        headerShown:      false,
        contentStyle:     { backgroundColor: COLORS.background },
        animation:        'fade',
      }}
    >
      <Stack.Screen name="login" />
    </Stack>
  );
}
