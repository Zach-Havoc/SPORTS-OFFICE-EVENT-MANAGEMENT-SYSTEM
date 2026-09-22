import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { notificationService } from '../services/notification.service';
import { useAuthStore } from '../store/auth.store';

// ─────────────────────────────────────────────────────────────────────────────
// useUnreadNotifications — refetches the unread count every time a screen
// holding the bell icon regains focus (cheap: one small GET, no polling).
// ─────────────────────────────────────────────────────────────────────────────

export function useUnreadNotifications() {
  const token = useAuthStore((s) => s.token);
  const [unreadCount, setUnreadCount] = useState(0);

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      let active = true;
      notificationService
        .list(true)
        .then((res) => {
          if (active) setUnreadCount(res.unreadCount);
        })
        .catch(() => {});
      return () => {
        active = false;
      };
    }, [token]),
  );

  return { unreadCount };
}
