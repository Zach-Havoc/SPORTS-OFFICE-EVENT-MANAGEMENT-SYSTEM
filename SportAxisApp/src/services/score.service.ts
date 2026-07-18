import api from './api';
import type { ScorePayload, ScoreSubmissionResponse } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Score Service — Submit scores to backend
// ─────────────────────────────────────────────────────────────────────────────

export const scoreService = {
  /**
   * POST /api/scores
   *
   * Submit a judge's scoring for a department in an event.
   * Backend uses updateOrCreate — safe to retry (idempotent).
   *
   * Throws on network error so the offline queue can catch it.
   */
  async submitScore(payload: ScorePayload): Promise<ScoreSubmissionResponse> {
    const response = await api.post<ScoreSubmissionResponse>('/scores', {
      eventId:        payload.eventId,
      department:     payload.department,
      judgeId:        payload.judgeId,
      judgeName:      payload.judgeName,
      scores:         payload.scores,
      totalScore:     payload.totalScore,
      method:         payload.method,
      image_url:      payload.image_url ?? null,
      submittedViaQr: payload.submittedViaQr,
    });
    return response.data;
  },

  /**
   * GET /api/scores/{eventId}
   *
   * Fetch all submitted scores for an event (for audit/history).
   */
  async getEventScores(eventId: string) {
    const response = await api.get(`/scores/${eventId}`);
    return response.data;
  },
};
