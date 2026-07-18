import { create } from 'zustand';
import { scoreService } from '../services/score.service';
import { storage, STORAGE_KEYS } from '../storage/async-storage';
import type { OfflineQueueItem, ScorePayload } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Offline Queue Store — Manages scores submitted while offline
// ─────────────────────────────────────────────────────────────────────────────

interface OfflineStore {
  queue: OfflineQueueItem[];
  isSyncing: boolean;

  // Actions
  hydrate: () => Promise<void>;           // Load queue from AsyncStorage
  enqueue: (payload: ScorePayload) => Promise<void>;
  syncAll: () => Promise<void>;           // Attempt to sync all pending items
  clearFailed: () => Promise<void>;       // Remove permanently failed items
}

const generateId = () =>
  Math.random().toString(36).substring(2) + Date.now().toString(36);

const saveQueue = async (queue: OfflineQueueItem[]) => {
  await storage.setJSON(STORAGE_KEYS.OFFLINE_QUEUE, queue);
};

export const useOfflineStore = create<OfflineStore>((set, get) => ({
  queue:     [],
  isSyncing: false,

  /**
   * Load offline queue from AsyncStorage (call on app start).
   */
  hydrate: async () => {
    const saved = await storage.getJSON<OfflineQueueItem[]>(STORAGE_KEYS.OFFLINE_QUEUE);
    if (saved) {
      set({ queue: saved });
    }
  },

  /**
   * Add a failed score submission to the offline queue.
   * The item will be retried when connectivity is restored.
   */
  enqueue: async (payload) => {
    const item: OfflineQueueItem = {
      id:          generateId(),
      payload,
      status:      'pending',
      created_at:  new Date().toISOString(),
      retry_count: 0,
      error:       null,
    };

    const newQueue = [...get().queue, item];
    set({ queue: newQueue });
    await saveQueue(newQueue);
  },

  /**
   * Attempt to sync all pending queue items.
   * Called automatically when network is restored.
   * Safe to call multiple times — skips items already syncing.
   */
  syncAll: async () => {
    const { queue, isSyncing } = get();
    if (isSyncing) return;

    const pendingItems = queue.filter((item) => item.status === 'pending');
    if (pendingItems.length === 0) return;

    set({ isSyncing: true });

    const updatedQueue = [...queue];

    for (const item of pendingItems) {
      const index = updatedQueue.findIndex((q) => q.id === item.id);
      if (index === -1) continue;

      // Mark as syncing
      updatedQueue[index] = { ...updatedQueue[index], status: 'syncing' };
      set({ queue: [...updatedQueue] });

      try {
        await scoreService.submitScore(item.payload);
        // Success — remove from queue
        updatedQueue.splice(index, 1);
      } catch (error: any) {
        const retryCount = updatedQueue[index].retry_count + 1;
        const isFinalFailure = retryCount >= 3;

        updatedQueue[index] = {
          ...updatedQueue[index],
          status:      isFinalFailure ? 'failed' : 'pending',
          retry_count: retryCount,
          error:       error.message ?? 'Sync failed',
        };
      }

      set({ queue: [...updatedQueue] });
      await saveQueue(updatedQueue);
    }

    set({ isSyncing: false });
    await storage.set(STORAGE_KEYS.LAST_SYNC, new Date().toISOString());
  },

  /**
   * Remove all permanently failed items from the queue.
   */
  clearFailed: async () => {
    const filtered = get().queue.filter((item) => item.status !== 'failed');
    set({ queue: filtered });
    await saveQueue(filtered);
  },
}));
