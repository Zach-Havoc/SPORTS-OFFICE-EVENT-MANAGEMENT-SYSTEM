import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/store/auth.store';

// ─────────────────────────────────────────────────────────────────────────────
// Root Index — Redirect based on auth state
// ─────────────────────────────────────────────────────────────────────────────

export default function Index() {
  const token      = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);

  // While store is being hydrated from AsyncStorage, render nothing
  if (!isHydrated) return null;

  // Route based on auth state
  return token
    ? <Redirect href="/(app)/scanner" />
    : <Redirect href="/(auth)/login" />;
}
