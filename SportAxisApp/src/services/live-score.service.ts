import api from './api';
import type { LiveScore, LiveScorePush } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Live Score Service — the running score of a game in progress
//
//   GET /api/events/{id}/live   → { live: LiveScore | null }
//   PUT /api/events/{id}/live   → { live: LiveScore }   (409 → stale, adopt `live`)
// ─────────────────────────────────────────────────────────────────────────────

export const liveScoreService = {
  async get(eventId: string): Promise<LiveScore | null> {
    const res = await api.get<{ live: LiveScore | null }>(`/events/${eventId}/live`);
    return res.data.live;
  },

  async push(eventId: string, body: LiveScorePush): Promise<LiveScore> {
    try {
      const res = await api.put<{ live: LiveScore }>(`/events/${eventId}/live`, body);
      return res.data.live;
    } catch (err: any) {
      // 409 → another device got there first. Surface the server's copy so the
      // caller can adopt it instead of overwriting.
      if (err?.status === 409 && err?.data?.live) {
        const conflict: any = new Error('This game was updated on another device.');
        conflict.code = 'LIVE_CONFLICT';
        conflict.live = err.data.live as LiveScore;
        throw conflict;
      }
      throw err;
    }
  },
};
