import { useEffect, useRef } from 'react';
import { useNetwork } from './use-network';
import { useOfflineStore } from '../store/offline.store';

// ─────────────────────────────────────────────────────────────────────────────
// useOfflineSync — Auto-syncs queued scores when connectivity is restored
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mount this hook high in the component tree (e.g., in the root layout)
 * to automatically trigger offline queue sync whenever the device
 * transitions from offline → online.
 */
export function useOfflineSync() {
  const { isConnected } = useNetwork();
  const syncAll = useOfflineStore((s) => s.syncAll);
  const queue   = useOfflineStore((s) => s.queue);
  const prevConnectedRef = useRef<boolean>(isConnected);

  useEffect(() => {
    const wasOffline  = !prevConnectedRef.current;
    const isNowOnline = isConnected;

    // Only sync on transition: offline → online
    if (wasOffline && isNowOnline) {
      const hasPending = queue.some((item) => item.status === 'pending');
      if (hasPending) {
        syncAll();
      }
    }

    prevConnectedRef.current = isConnected;
  }, [isConnected, queue, syncAll]);

  return {
    isConnected,
    pendingCount: queue.filter((item) => item.status === 'pending').length,
  };
}
