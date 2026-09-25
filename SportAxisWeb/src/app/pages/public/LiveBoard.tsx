import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { useEvents, useLiveScores, useSeasons } from '../../hooks/api';
import { useScoreboardData } from '../../hooks/useScoreboardData';
import type { LiveScore } from '../../services/api';
import { Radio, Trophy, ArrowRight } from 'lucide-react';
import Loading from '../../components/Loading';
import { GameCard, MatchDetailModal, type ScheduleEvent } from '../../components/public/GameCard';

/**
 * A live score always belongs to an event; this is its schedule entry, or a
 * stand-in built from the live score if the schedule hasn't loaded it.
 */
function eventFor(game: LiveScore, byId: Map<string, ScheduleEvent>): ScheduleEvent {
  return (
    byId.get(game.eventId) ?? {
      id: game.eventId,
      name: game.eventName ?? game.sport,
      category: game.sport,
      schedule: game.startedAt ?? game.updatedAt ?? new Date().toISOString(),
      venueName: game.venueName ?? undefined,
      status: 'ongoing',
      departments: [game.homeTeam ?? 'Home', game.awayTeam ?? 'Away'],
    }
  );
}

export default function PublicLiveBoard() {
  const { data, isLoading, isFetching, dataUpdatedAt } = useLiveScores(true);
  const eventsQuery = useEvents();
  const seasonsQuery = useSeasons();
  const activeSeasonId = (seasonsQuery.data ?? []).find((x) => x.isActive)?.id ?? null;

  const events = useMemo<ScheduleEvent[]>(
    () => (eventsQuery.data ?? []).map((e: any) => ({ ...e, departments: e.departments || [] })),
    [eventsQuery.data],
  );
  const eventById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const { teams, matchByEvent } = useScoreboardData(events, activeSeasonId ?? 'all', activeSeasonId);
  const [selected, setSelected] = useState<ScheduleEvent | null>(null);

  const games = useMemo(
    () => [...(data ?? [])].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [data],
  );
  const liveByEvent = useMemo(() => new Map(games.map((g) => [g.eventId, g])), [games]);

  if (isLoading) {
    return (
      <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
        <Loading fullScreen={false} message="Loading live scores..." />
      </div>
    );
  }

  return (
    <div className="page-container px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-3 border-b border-gray-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            <Radio className="h-6 w-6 text-red-600" />
            Live Scores
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Games whose scoreboard is running right now. Scores update on their own.
            {isFetching && <span className="ml-2 text-gray-400">· refreshing…</span>}
          </p>
        </div>
        <span className="text-xs text-gray-400">
          Last refreshed {new Date(dataUpdatedAt).toLocaleTimeString()}
        </span>
      </header>

      {games.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-gray-300 bg-white py-20 text-center">
          <Trophy className="mx-auto h-9 w-9 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">No games in progress right now</p>
          <p className="mt-1 text-sm text-gray-500">
            A game shows up here once its committee starts the scoreboard.
          </p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            View the full schedule
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {games.map((g) => {
            const event = eventFor(g, eventById);
            return (
              <GameCard
                key={g.eventId}
                event={event}
                live={g}
                match={matchByEvent[g.eventId]}
                teams={teams}
                onClick={() => setSelected(event)}
              />
            );
          })}
        </div>
      )}

      <MatchDetailModal
        event={selected}
        rankings={[]}
        live={selected ? liveByEvent.get(selected.id) : undefined}
        match={selected ? matchByEvent[selected.id] : undefined}
        teams={teams}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}
