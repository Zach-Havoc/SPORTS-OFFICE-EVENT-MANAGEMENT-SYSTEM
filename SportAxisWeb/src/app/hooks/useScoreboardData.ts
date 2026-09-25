import { useMemo } from 'react';
import { useDepartments, useMatches } from './api';
import { useDeptAbbreviator } from '../utils/departments';
import { recordsBySport, type MatchRow } from '../utils/games';
import type { ScheduleEvent, TeamLookup } from '../components/public/GameCard';

/**
 * What a scoreboard card needs beyond the event itself: each game's recorded
 * result, and each college's logo, short label and win–loss record. Records
 * count only the chosen season ('all' counts every season); events saved
 * before seasons existed count as the running one.
 */
export function useScoreboardData(
  events: ScheduleEvent[],
  seasonId: string,
  activeSeasonId: string | null,
): { teams: TeamLookup; matchByEvent: Record<string, MatchRow> } {
  const deptsQuery = useDepartments();
  const matchesQuery = useMatches();
  const abbr = useDeptAbbreviator();

  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const matches = useMemo<MatchRow[]>(() => (matchesQuery.data as MatchRow[] | undefined) ?? [], [matchesQuery.data]);
  const matchByEvent = useMemo<Record<string, MatchRow>>(
    () => Object.fromEntries(matches.filter((m) => m.eventId).map((m) => [m.eventId as string, m])),
    [matches],
  );
  const records = useMemo(
    () =>
      recordsBySport(matches, (m) => {
        if (seasonId === 'all') return true;
        const ev = m.eventId ? eventById.get(m.eventId) : undefined;
        return !!ev && (ev.seasonId ?? activeSeasonId) === seasonId;
      }),
    [matches, eventById, seasonId, activeSeasonId],
  );

  const depts = deptsQuery.data as any[] | undefined;
  const teams = useMemo<TeamLookup>(() => {
    const k = (v: string) => v.trim().toLowerCase();
    const byKey = new Map<string, { logoUrl?: string | null; abbreviation?: string | null }>();
    for (const d of depts ?? []) {
      byKey.set(k(d.name), d);
      if (d.abbreviation) byKey.set(k(d.abbreviation), d);
    }
    return {
      info: (name) => {
        const d = byKey.get(k(name));
        return { logoUrl: d?.logoUrl, label: d?.abbreviation || abbr(name) };
      },
      record: (sport, t) => records.get(`${sport}|${t}`),
    };
  }, [depts, records, abbr]);

  return { teams, matchByEvent };
}
