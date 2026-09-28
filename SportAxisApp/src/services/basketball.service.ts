import api from './api';
import type { PlayType, Scoreboard } from '../types';
import type { FilledBasketballGame } from '../utils/basketballScoresheet';

// ─────────────────────────────────────────────────────────────────────────────
// Basketball Service — play-by-play scoring. Each call returns the full
// scoreboard, computed by the server from the recorded plays. The players
// are the coaches' lineups for the game.
//
//   GET    /api/events/{id}/scoreboard
//   POST   /api/events/{id}/plays         {teamId, type, playerId?}
//   DELETE /api/events/{id}/plays/last    undo
//   PUT    /api/events/{id}/period        {period}
//   POST   /api/events/{id}/finish
//   GET    /api/events/{id}/scoresheet    the game laid out for the filled-in PDF
// ─────────────────────────────────────────────────────────────────────────────

export const basketballService = {
  async get(eventId: string): Promise<Scoreboard> {
    return (await api.get<Scoreboard>(`/events/${eventId}/scoreboard`)).data;
  },

  async record(eventId: string, play: { teamId: string; type: PlayType; playerId?: string | null }): Promise<Scoreboard> {
    return (await api.post<Scoreboard>(`/events/${eventId}/plays`, play)).data;
  },

  async undo(eventId: string): Promise<Scoreboard> {
    return (await api.delete<Scoreboard>(`/events/${eventId}/plays/last`)).data;
  },

  async setPeriod(eventId: string, period: number): Promise<Scoreboard> {
    return (await api.put<Scoreboard>(`/events/${eventId}/period`, { period })).data;
  },

  async finish(eventId: string): Promise<Scoreboard> {
    return (await api.post<Scoreboard>(`/events/${eventId}/finish`)).data;
  },

  /** The recorded game for the filled-in FIBA scoresheet (committee / admin only). */
  async scoresheet(eventId: string): Promise<FilledBasketballGame> {
    return (await api.get<FilledBasketballGame>(`/events/${eventId}/scoresheet`)).data;
  },
};
