import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { notificationService } from '../services/notification.service';
import { useAuthStore } from '../store/auth.store';

// ─────────────────────────────────────────────────────────────────────────────
// useUnreadNotifications — refetches the unread count every time a screen
// holding the bell icon regains focus (cheap: one small GET, no polling).
// Skips the refetch if the last successful fetch is still fresh (< 30s) so
// quick tab switches don't re-hit the API every time.
// ─────────────────────────────────────────────────────────────────────────────

const STALE_MS = 30_000;

export function useUnreadNotifications() {
  const token = useAuthStore((s) => s.token);
  const [unreadCount, setUnreadCount] = useState(0);
  const lastFetchedAt = useRef(0);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      if (lastFetchedAt.current > 0 && Date.now() - lastFetchedAt.current < STALE_MS) return;
      let active = true;
      notificationService
        .list(true)
        .then((res) => {
          if (active) {
            setUnreadCount(res.unreadCount);
            lastFetchedAt.current = Date.now();
          }
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [token]),
  );

  return { unreadCount };
}
