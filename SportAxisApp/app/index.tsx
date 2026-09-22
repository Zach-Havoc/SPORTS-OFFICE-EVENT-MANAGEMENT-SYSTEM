import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { useAuthStore } from '../src/store/auth.store';
import { storage, STORAGE_KEYS } from '../src/storage/async-storage';

// ─────────────────────────────────────────────────────────────────────────────
// Root Index — Redirect based on auth state (and, for a first-ever launch,
// through the one-time onboarding before login).
// ─────────────────────────────────────────────────────────────────────────────

export default function Index() {
  const token      = useAuthStore((s) => s.token);
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const [onboardingSeen, setOnboardingSeen] = useState<boolean | null>(null);

  useEffect(() => {
    storage.get(STORAGE_KEYS.ONBOARDING_SEEN).then((v) => setOnboardingSeen(v === '1'));
  }, []);

  // While the store hydrates from AsyncStorage or the onboarding flag loads, render nothing.
  if (!isHydrated || onboardingSeen === null) return null;

  if (token) return <Redirect href="/(app)/events" />;
  if (!onboardingSeen) return <Redirect href="/onboarding" />;
  return <Redirect href="/(auth)/login" />;
}
