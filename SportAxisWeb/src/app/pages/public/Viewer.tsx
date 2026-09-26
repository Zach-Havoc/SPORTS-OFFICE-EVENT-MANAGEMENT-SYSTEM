import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getEventRankings } from '../../services/api';
import type { LiveScore } from '../../services/api';
import { useDepartments, useEvents, useEventRankings, useLiveScores, useSeasons, qk } from '../../hooks/api';
import { useScoreboardData } from '../../hooks/useScoreboardData';
import { STALE } from '../../lib/queryClient';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import {
  GameCard, MatchDetailModal, STATUS_CONFIG,
  type Ranking, type ScheduleEvent, type TeamLookup,
} from '../../components/public/GameCard';
import type { MatchRow } from '../../utils/games';
import Loading from '../../components/Loading';
import { RefreshStatus } from '../../components/RefreshStatus';
import PhotoSlideshow from '../../components/public/PhotoSlideshow';

// ─── Types & helpers ─────────────────────────────────────────────────────────────────

const toDateKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const formatDayLabel = (d: Date) =>
  d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

const getDateRange = (center: Date, radius = 3): Date[] => {
  const dates: Date[] = [];
  for (let i = -radius; i <= radius; i++) {
    const d = new Date(center);
    d.setDate(center.getDate() + i);
    dates.push(d);
  }
  return dates;
};

// ─── Section ──────────────────────────────────────────────────────────────────

function MatchSection({
  status,
  events,
  rankings,
  liveByEvent,
  matchByEvent,
  teams,
  onSelect,
}: {
  status: ScheduleEvent['status'];
  events: ScheduleEvent[];
  rankings: Record<string, Ranking[]>;
  liveByEvent: Record<string, LiveScore>;
  matchByEvent: Record<string, MatchRow>;
  teams: TeamLookup;
  onSelect: (e: ScheduleEvent) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const SectionIcon = cfg.icon;

  return (
    <section className="mb-10">
      <div className="mb-4 flex items-center gap-3 border-b border-gray-200 pb-2">
        <div className={`flex items-center gap-2 ${cfg.sectionColor}`}>
          <SectionIcon className="h-4 w-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">{cfg.sectionLabel}</h2>
        </div>
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-semibold text-gray-600">
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-10 text-center text-gray-400">
          <SectionIcon className="mx-auto mb-2 h-7 w-7 opacity-40" />
          <p className="text-sm">No {cfg.sectionLabel.toLowerCase()} matches</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {events.map((event) => (
            <GameCard
              key={event.id}
              event={event}
              rankings={rankings[event.id]}
              live={liveByEvent[event.id]}
              match={matchByEvent[event.id]}
              teams={teams}
              onClick={() => onSelect(event)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Filters ──────────────────────────────────────────────────────────────────

const ALL = 'all';

function FilterSelect({
  label,
  value,
  onChange,
  options,
  allLabel,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  allLabel: string;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      <span className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</span>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-white" aria-label={label}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>{allLabel}</SelectItem>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  );
}

// ─── Date Filter Bar ──────────────────────────────────────────────────────────

function DateFilterBar({
  selectedDate,
  onChange,
  centerDate,
  onCenterChange,
  resultCount,
}: {
  selectedDate: string | null;
  onChange: (d: string | null) => void;
  centerDate: Date;
  onCenterChange: (d: Date) => void;
  resultCount: number;
}) {
  const dates = getDateRange(centerDate, 3);
  const todayKey = toDateKey(new Date());

  const shiftCenter = (by: number) => {
    const next = new Date(centerDate);
    next.setDate(centerDate.getDate() + by);
    onCenterChange(next);
  };

  const arrowBtn =
    'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors';

  return (
    <div className="mb-6 rounded-xl border border-gray-200 bg-white p-2 sm:p-3">
      <div className="flex items-center gap-2">
        <button onClick={() => shiftCenter(-3)} className={arrowBtn} aria-label="Previous days">
          <ChevronLeft className="h-4 w-4" />
        </button>

        {/* Day strip — pills share the available width evenly */}
        <div className="flex flex-1 gap-1 overflow-x-auto scrollbar-hide">
          {dates.map(d => {
            const key = toDateKey(d);
            const isSelected = selectedDate === key;
            const isToday = key === todayKey;
            return (
              <button
                key={key}
                onClick={() => onChange(isSelected ? null : key)}
                aria-pressed={isSelected}
                className={`flex min-w-[60px] flex-1 flex-col items-center rounded-lg px-2 py-1.5 transition-colors duration-150 ${
                  isSelected
                    ? 'bg-red-600 text-white'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <span className={`text-[10px] uppercase tracking-wide ${isSelected ? 'text-red-100' : 'text-gray-400'}`}>
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="mt-0.5 text-sm font-semibold">{formatDayLabel(d)}</span>
                <span
                  className={`mt-1 h-1 w-1 rounded-full ${
                    isToday && !isSelected ? 'bg-red-500' : 'bg-transparent'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <button onClick={() => shiftCenter(3)} className={arrowBtn} aria-label="Next days">
          <ChevronRight className="h-4 w-4" />
        </button>

        <div className="mx-1 hidden h-8 w-px bg-gray-200 sm:block" />

        {/* Pick an exact date */}
        <div className="relative shrink-0">
          <input
            type="date"
            value={selectedDate || ''}
            onChange={e => {
              const val = e.target.value;
              if (val) {
                onChange(val);
                onCenterChange(new Date(val + 'T00:00:00'));
              }
            }}
            className="absolute inset-0 w-full cursor-pointer opacity-0"
            aria-label="Pick a specific date"
          />
          <div className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 px-3 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50">
            <Calendar className="h-4 w-4 text-gray-400" />
            <span className="hidden lg:inline">Pick date</span>
          </div>
        </div>

        {/* All dates toggle — always visible, active when no date is chosen */}
        <button
          onClick={() => onChange(null)}
          aria-pressed={selectedDate === null}
          className={`h-9 shrink-0 rounded-lg px-3 text-sm font-medium transition-colors ${
            selectedDate === null
              ? 'bg-red-600 text-white'
              : 'border border-gray-300 text-gray-700 hover:bg-gray-50'
          }`}
        >
          All dates
        </button>
      </div>

      {/* Context line — only when a specific date is active */}
      {selectedDate && (
        <div className="mt-2 border-t border-gray-100 px-1 pt-2 text-xs text-gray-500">
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
          })}
          {' · '}
          <span className="font-medium text-gray-700">
            {resultCount} {resultCount === 1 ? 'match' : 'matches'}
          </span>
        </div>
      )}
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicViewer() {
  // The schedule loads once (refresh the browser for changes); the running
  // scores of in-progress games poll on their own every 10s.
  // null = not touched yet, which means "the running season".
  const [seasonPick, setSeasonPick] = useState<string | null>(null);
  // The API scopes to the running season unless told otherwise, so another
  // season (or all of them) has to be fetched, not filtered out of this one.
  const eventsQuery = useEvents(seasonPick ?? undefined);
  const liveQuery = useLiveScores();

  const liveByEvent = useMemo<Record<string, LiveScore>>(
    () => Object.fromEntries((liveQuery.data ?? []).map((l) => [l.eventId, l])),
    [liveQuery.data],
  );

  const allEvents = useMemo<ScheduleEvent[]>(
    () =>
      (eventsQuery.data ?? []).map((event: any) => ({
        ...event,
        departments: event.departments || [],
      })),
    [eventsQuery.data],
  );

  const [selectedEvent, setSelectedEvent] = useState<ScheduleEvent | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(new Date()));
  const [centerDate, setCenterDate] = useState<Date>(new Date());

  // ── Season / college / game filters ───────────────────────────────────────
  const seasonsQuery = useSeasons();
  const deptsQuery = useDepartments();

  const seasons = seasonsQuery.data ?? [];
  const activeSeasonId = seasons.find((x) => x.isActive)?.id ?? null;
  const seasonId = seasonPick ?? activeSeasonId ?? ALL;
  const [team, setTeam] = useState<string>(ALL);
  const [game, setGame] = useState<string>(ALL);

  // Events saved before seasons existed have none; they count as the running one.
  const inSeason = (e: ScheduleEvent) =>
    seasonId === ALL || (e.seasonId ?? activeSeasonId) === seasonId;

  const depts = (deptsQuery.data as any[] | undefined) ?? [];
  const sameTeam = (a: string, b: string) => {
    const k = (v: string) => v.trim().toLowerCase();
    if (k(a) === k(b)) return true;
    const d = depts.find((x) => k(x.name) === k(b) || (x.abbreviation && k(x.abbreviation) === k(b)));
    return !!d && (k(d.name) === k(a) || (!!d.abbreviation && k(d.abbreviation) === k(a)));
  };

  const seasonEvents = allEvents.filter(inSeason);
  const gameOptions = [...new Set(seasonEvents.map((e) => e.category).filter(Boolean))]
    .sort()
    .map((c) => ({ value: c, label: c }));
  const teamOptions = depts.map((d) => ({ value: d.name as string, label: (d.abbreviation as string) || d.name }));

  const filtersActive = team !== ALL || game !== ALL;
  const matchesFilters = (e: ScheduleEvent) =>
    inSeason(e) &&
    (game === ALL || e.category === game) &&
    (team === ALL || e.departments.some((d) => sameTeam(team, d)));

  // Picking a college or a game means "show me their games", not just today's.
  const pickTeam = (v: string) => { setTeam(v); if (v !== ALL) setSelectedDate(null); };
  const pickGame = (v: string) => { setGame(v); if (v !== ALL) setSelectedDate(null); };
  const clearFilters = () => { setTeam(ALL); setGame(ALL); setSeasonPick(null); };

  // ── Results, logos and records ────────────────────────────────────────────
  const { teams, matchByEvent } = useScoreboardData(allEvents, seasonId, activeSeasonId);

  // ── Filter events client-side ─────────────────────────────────────────────
  const filteredEvents = allEvents.filter(e => {
    if (!matchesFilters(e)) return false;
    if (!selectedDate) return true;
    const evDate = e.schedule?.split('T')[0] ?? e.schedule;
    return evDate === selectedDate;
  });

  const ongoingEvents = filteredEvents.filter(e => e.status === 'ongoing');
  const upcomingEvents = filteredEvents.filter(e => e.status === 'upcoming');
  const completedEvents = filteredEvents.filter(e => e.status === 'completed');

  // ── Rankings for every ongoing/completed event (fetched once with the schedule) ──
  const rankingEventIds = useMemo(
    () =>
      allEvents
        .filter(e => e.status === 'ongoing' || e.status === 'completed')
        .map(e => e.id),
    [allEvents],
  );

  const rankingQueries = useQueries({
    queries: rankingEventIds.map(id => ({
      queryKey: qk.rankings(id),
      queryFn: () => getEventRankings(id),
      staleTime: STALE.live,
    })),
  });

  // Keep the open event's rankings fresh even if it is "upcoming".
  const modalRankingsQuery = useEventRankings(selectedEvent?.id, {
    enabled: !!selectedEvent,
  });

  const rankings = useMemo<Record<string, Ranking[]>>(() => {
    const map: Record<string, Ranking[]> = {};
    rankingEventIds.forEach((id, i) => {
      const d = rankingQueries[i]?.data;
      map[id] = Array.isArray(d) ? (d as Ranking[]) : [];
    });
    if (selectedEvent && Array.isArray(modalRankingsQuery.data)) {
      map[selectedEvent.id] = modalRankingsQuery.data as Ranking[];
    }
    return map;
  }, [rankingEventIds, rankingQueries, selectedEvent, modalRankingsQuery.data]);

  const backgroundError =
    eventsQuery.isRefetchError || rankingQueries.some(q => q.isRefetchError);

  // ── First-load states (cached data, if any, skips straight past these) ────
  if (eventsQuery.isLoading) {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading match schedule..." />
      </div>
    );
  }

  if (eventsQuery.isLoadingError) {
    return (
      <div className="page-container px-4 sm:px-6 lg:px-8 py-8">
        <div className="rounded-xl border border-red-200 bg-red-50 p-8 text-center">
          <p className="text-red-600 font-semibold mb-1">Couldn&rsquo;t load the match schedule</p>
          <p className="text-red-500 text-sm mb-4">
            {(eventsQuery.error as Error)?.message || 'Please check your connection and try again.'}
          </p>
          <button
            onClick={() => eventsQuery.refetch()}
            className="px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="page-container px-4 sm:px-6 lg:px-8 py-8">

      {/* Admin-managed photo slideshow (renders nothing if no slides added) */}
      <PhotoSlideshow />

      {/* Page Header */}
      <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-8 pb-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 tracking-tight">Match Schedule</h1>
          <p className="text-gray-500 text-sm mt-1.5">
            Schedule loaded {new Date(eventsQuery.dataUpdatedAt).toLocaleTimeString()} · live scores update automatically
          </p>
        </div>
        <RefreshStatus
          fetching={eventsQuery.isFetching && !eventsQuery.isLoading}
          error={backgroundError}
          onRetry={() => eventsQuery.refetch()}
        />
      </header>

      {/* Season / College / Game */}
      <div className="mb-3 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-3 sm:grid-cols-[repeat(3,minmax(0,1fr))_auto] sm:items-end">
        <FilterSelect
          label="Season"
          value={seasonId}
          onChange={setSeasonPick}
          allLabel="All seasons"
          options={seasons.map((x) => ({ value: x.id, label: x.isActive ? `${x.name} (current)` : x.name }))}
        />
        <FilterSelect label="College" value={team} onChange={pickTeam} allLabel="All colleges" options={teamOptions} />
        <FilterSelect label="Game" value={game} onChange={pickGame} allLabel="All games" options={gameOptions} />
        <button
          onClick={clearFilters}
          disabled={!filtersActive && seasonPick === null}
          className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 disabled:pointer-events-none disabled:opacity-40"
        >
          <X className="h-4 w-4" />
          Clear
        </button>
      </div>

      {/* Date Filter Bar */}
      <DateFilterBar
        selectedDate={selectedDate}
        onChange={setSelectedDate}
        centerDate={centerDate}
        onCenterChange={setCenterDate}
        resultCount={filteredEvents.length}
      />

      {/* Nothing matches */}
      {filteredEvents.length === 0 && (selectedDate || filtersActive) && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-14 text-center">
          <Calendar className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">
            {selectedDate ? 'No matches on this date' : 'No matches for these filters'}
          </p>
          <p className="mt-1 text-sm text-gray-500">
            {selectedDate ? 'Pick another date, or view every scheduled match.' : 'Try another college, game or season.'}
          </p>
          <button
            onClick={() => (selectedDate ? setSelectedDate(null) : clearFilters())}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            {selectedDate ? 'Show all dates' : 'Clear filters'}
          </button>
        </div>
      )}

      {/* Three Swimlane Sections */}
      {(filteredEvents.length > 0 || (!selectedDate && !filtersActive)) && (
        <>
          <MatchSection status="ongoing" events={ongoingEvents} rankings={rankings} liveByEvent={liveByEvent} matchByEvent={matchByEvent} teams={teams} onSelect={setSelectedEvent} />
          <MatchSection status="upcoming" events={upcomingEvents} rankings={rankings} liveByEvent={liveByEvent} matchByEvent={matchByEvent} teams={teams} onSelect={setSelectedEvent} />
          <MatchSection status="completed" events={completedEvents} rankings={rankings} liveByEvent={liveByEvent} matchByEvent={matchByEvent} teams={teams} onSelect={setSelectedEvent} />
        </>
      )}

      {/* Match Detail Modal */}
      <MatchDetailModal
        event={selectedEvent}
        rankings={selectedEvent ? (rankings[selectedEvent.id] ?? []) : []}
        live={selectedEvent ? liveByEvent[selectedEvent.id] : undefined}
        match={selectedEvent ? matchByEvent[selectedEvent.id] : undefined}
        teams={teams}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}