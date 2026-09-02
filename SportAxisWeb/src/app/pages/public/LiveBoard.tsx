import { useMemo } from 'react';
import { Link } from 'react-router';
import { useLiveScores } from '../../hooks/api';
import type { LiveScore } from '../../services/api';
import { Radio, MapPin, Trophy, ArrowRight } from 'lucide-react';
import Loading from '../../components/Loading';
import { useDeptAbbreviator } from '../../utils/departments';

function relativeTime(iso: string | null): string {
  if (!iso) return '';
  const secs = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 5) return 'just now';
  if (secs < 60) return `${secs}s ago`;
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  return `${Math.round(mins / 60)}h ago`;
}

function LivePill() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-white">
      <span className="relative flex h-2 w-2">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-white" />
      </span>
      Live
    </span>
  );
}

function ScoreCard({ game }: { game: LiveScore }) {
  const abbr = useDeptAbbreviator();
  const homeLead = game.homeScore > game.awayScore;
  const awayLead = game.awayScore > game.homeScore;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <LivePill />
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">{game.sport}</span>
        </div>
        {game.period && (
          <span className="rounded-md bg-white px-2 py-0.5 text-xs font-bold text-gray-700 ring-1 ring-gray-200">
            {game.period}
          </span>
        )}
      </div>

      <div className="px-5 py-5">
        <p className="mb-4 truncate text-sm font-medium text-gray-500" title={game.eventName ?? ''}>
          {game.eventName}
        </p>

        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
          <div className="min-w-0 text-right">
            <p className={`truncate text-sm font-semibold ${homeLead ? 'text-gray-900' : 'text-gray-500'}`} title={game.homeTeam ?? ''}>
              {abbr(game.homeTeam ?? 'Home')}
            </p>
          </div>
          <div className="flex items-center gap-2 tabular-nums">
            <span className={`text-4xl font-extrabold ${homeLead ? 'text-red-600' : 'text-gray-800'}`}>{game.homeScore}</span>
            <span className="text-lg font-medium text-gray-300">–</span>
            <span className={`text-4xl font-extrabold ${awayLead ? 'text-red-600' : 'text-gray-800'}`}>{game.awayScore}</span>
          </div>
          <div className="min-w-0">
            <p className={`truncate text-sm font-semibold ${awayLead ? 'text-gray-900' : 'text-gray-500'}`} title={game.awayTeam ?? ''}>
              {abbr(game.awayTeam ?? 'Away')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2.5 text-xs text-gray-500">
        <span className="inline-flex items-center gap-1.5 truncate">
          <MapPin className="h-3.5 w-3.5 shrink-0 text-red-400" />
          {game.venueName || 'Venue TBD'}
        </span>
        <span>updated {relativeTime(game.updatedAt)}</span>
      </div>
    </div>
  );
}

export default function PublicLiveBoard() {
  const { data, isLoading, isFetching, dataUpdatedAt } = useLiveScores(true);

  const games = useMemo(
    () => [...(data ?? [])].sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? '')),
    [data],
  );

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Loading fullScreen={false} message="Loading live games..." />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8 flex flex-col gap-3 border-b border-gray-200 pb-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2.5 text-2xl font-semibold tracking-tight text-gray-900 sm:text-3xl">
            <Radio className="h-6 w-6 text-red-600" />
            Live Games
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            Scores update automatically every few seconds
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
          <p className="mt-1 text-sm text-gray-500">This board fills up as games tip off.</p>
          <Link
            to="/"
            className="mt-5 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3.5 py-2 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            View the full schedule
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {games.map((g) => (
            <ScoreCard key={g.eventId} game={g} />
          ))}
        </div>
      )}
    </div>
  );
}
