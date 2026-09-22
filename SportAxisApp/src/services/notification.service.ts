import api from './api';
import type { AppNotification } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Notification Service — in-app notifications (GET/mark-read/mark-all-read)
// ─────────────────────────────────────────────────────────────────────────────

interface NotificationListResponse {
  items: AppNotification[];
  unreadCount: number;
}

export const notificationService = {
  /** GET /api/notifications */
  async list(unreadOnly = false): Promise<NotificationListResponse> {
    const response = await api.get<NotificationListResponse>('/notifications', {
      params: unreadOnly ? { unread: 1 } : undefined,
    });
    return response.data;
  },

  /** POST /api/notifications/{id}/read */
  async markRead(id: string): Promise<void> {
    await api.post(`/notifications/${id}/read`);
  },

  /** POST /api/notifications/read-all */
  async markAllRead(): Promise<void> {
    await api.post('/notifications/read-all');
  },
};
