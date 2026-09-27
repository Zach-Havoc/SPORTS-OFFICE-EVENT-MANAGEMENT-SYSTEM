import api from './api';
import type { VolleyballScoreboard } from '../types';

// ─────────────────────────────────────────────────────────────────────────────
// Volleyball Service — play-by-play scoring. Each call returns the full
// scoreboard, replayed by the server from the rally log.
//
//   GET    /api/events/{id}/volleyball
//   PUT    /api/events/{id}/volleyball/best-of     {bestOf}
//   POST   /api/events/{id}/volleyball/sets        {firstServerTeamId, rotations?}
//   POST   /api/events/{id}/volleyball/plays       {teamId, type, playerId?}
//   POST   /api/events/{id}/volleyball/subs        {teamId, playerOutId, playerInId}
//   DELETE /api/events/{id}/volleyball/plays/last  undo
//   POST   /api/events/{id}/volleyball/finish
// ─────────────────────────────────────────────────────────────────────────────

const base = (eventId: string) => `/events/${eventId}/volleyball`;

export const volleyballService = {
  async get(eventId: string): Promise<VolleyballScoreboard> {
    return (await api.get<VolleyballScoreboard>(base(eventId))).data;
  },

  async setBestOf(eventId: string, bestOf: number): Promise<VolleyballScoreboard> {
    return (await api.put<VolleyballScoreboard>(`${base(eventId)}/best-of`, { bestOf })).data;
  },

  async startSet(
    eventId: string,
    body: { firstServerTeamId: string; rotations?: Record<string, string[] | null> },
  ): Promise<VolleyballScoreboard> {
    return (await api.post<VolleyballScoreboard>(`${base(eventId)}/sets`, body)).data;
  },

  async record(
    eventId: string,
    play: { teamId: string; type: 'KILL' | 'ACE' | 'BLOCK' | 'OPP_ERROR' | 'TIMEOUT'; playerId?: string | null },
  ): Promise<VolleyballScoreboard> {
    return (await api.post<VolleyballScoreboard>(`${base(eventId)}/plays`, play)).data;
  },

  async substitute(eventId: string, sub: { teamId: string; playerOutId: string; playerInId: string }): Promise<VolleyballScoreboard> {
    return (await api.post<VolleyballScoreboard>(`${base(eventId)}/subs`, sub)).data;
  },

  async undo(eventId: string): Promise<VolleyballScoreboard> {
    return (await api.delete<VolleyballScoreboard>(`${base(eventId)}/plays/last`)).data;
  },

  async finish(eventId: string): Promise<VolleyballScoreboard> {
    return (await api.post<VolleyballScoreboard>(`${base(eventId)}/finish`)).data;
  },
};
