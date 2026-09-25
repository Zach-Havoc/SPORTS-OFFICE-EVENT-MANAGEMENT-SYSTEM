import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getEventRankings } from '../../services/api';
import type { LiveScore } from '../../services/api';
import {
  useDepartments, useEvents, useEventRankings, useLiveScores, useMatches, useSeasons, qk,
} from '../../hooks/api';
import { STALE } from '../../lib/queryClient';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  Trophy, Calendar, Users, Clock, MapPin,
  ChevronLeft, ChevronRight, Award,
  Activity, CheckCircle2, Timer, X,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { TeamLogo } from '../../components/public/TeamLogo';
import {
  formatRecord, recordsBySport, scoreboardFor,
  type MatchRow, type Record3, type Scoreboard,
} from '../../utils/games';
import Loading from '../../components/Loading';
import { RefreshStatus } from '../../components/RefreshStatus';
import { useDeptAbbreviator } from '../../utils/departments';
import PhotoSlideshow from '../../components/public/PhotoSlideshow';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Event {
  id: string;
  name: string;
  category: string;
  schedule: string;
  startTime?: string;
  endTime?: string;
  venueName?: string;
  venue?: string;
  status: 'upcoming' | 'ongoing' | 'completed';
  departments: string[];
  seasonId?: string | null;
}

/** Logo + short label for a college, and its record in a sport. */
interface TeamLookup {
  info: (name: string) => { logoUrl?: string | null; label: string };
  record: (sport: string, team: string) => Record3 | undefined;
}

interface Ranking {
  department: string;
  totalScore: number;
  rank: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

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

// ─── Status Config ────────────────────────────────────────────────────────────

const STATUS_CONFIG = {
  ongoing: {
    label: 'Live',
    sectionLabel: 'Ongoing',
    icon: Activity,
    borderClass: 'border-l-2 border-emerald-500',
    badgeClass: 'bg-emerald-600 text-white',
    barClass: 'bg-emerald-500',
    sectionColor: 'text-emerald-700',
    sectionBg: 'bg-emerald-50 border-emerald-200',
    pulse: true,
  },
  upcoming: {
    label: 'Upcoming',
    sectionLabel: 'Upcoming',
    icon: Timer,
    borderClass: 'border-l-2 border-blue-500',
    badgeClass: 'bg-blue-600 text-white',
    barClass: 'bg-blue-500',
    sectionColor: 'text-blue-700',
    sectionBg: 'bg-blue-50 border-blue-200',
    pulse: false,
  },
  completed: {
    label: 'Completed',
    sectionLabel: 'Completed',
    icon: CheckCircle2,
    borderClass: 'border-l-2 border-gray-300',
    badgeClass: 'bg-gray-500 text-white',
    barClass: 'bg-gray-400',
    sectionColor: 'text-gray-600',
    sectionBg: 'bg-gray-50 border-gray-200',
    pulse: false,
  },
} as const;

// ─── Sub-Components ───────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: Event['status'] }) {
  const cfg = STATUS_CONFIG[status];
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${cfg.badgeClass}`}>
      {cfg.pulse && (
        <span className="relative flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75 motion-reduce:hidden" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
        </span>
      )}
      {cfg.label}
    </span>
  );
}

function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-yellow-400 text-yellow-900">1</span>;
  if (rank === 2) return <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-gray-300 text-gray-700">2</span>;
  if (rank === 3) return <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-orange-300 text-orange-900">3</span>;
  return <span className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold bg-slate-100 text-slate-600">{rank}</span>;
}

// ─── Game Card ────────────────────────────────────────────────────────────────

/** The small filled triangle that points at the winning side. */
function WinnerCaret({ dir }: { dir: 'left' | 'right' }) {
  return (
    <svg viewBox="0 0 6 8" className="h-2 w-1.5 fill-current" aria-hidden>
      {dir === 'right' ? <path d="M0 0L6 4L0 8z" /> : <path d="M6 0L0 4L6 8z" />}
    </svg>
  );
}

/** One side of the scoreboard: logo over the college and its record. */
function TeamColumn({
  team,
  sport,
  teams,
  size,
}: {
  team: string;
  sport: string;
  teams: TeamLookup;
  size: 'md' | 'lg';
}) {
  const { logoUrl, label } = teams.info(team);
  const record = formatRecord(teams.record(sport, team));
  return (
    <div className="flex min-w-0 flex-col items-center text-center">
      <TeamLogo name={team} logoUrl={logoUrl} label={label} size={size === 'lg' ? 56 : 40} />
      <span
        className={`mt-1.5 max-w-full truncate font-medium text-gray-900 ${size === 'lg' ? 'text-base' : 'text-sm'}`}
        title={team}
      >
        {label}
      </span>
      <span className="h-4 text-xs tabular-nums text-gray-500">{record}</span>
    </div>
  );
}

/**
 * Logo, college and record on each side; the scores between them; the state
 * of the game in the middle — LIVE, FINAL pointing at the winner, or the tip-
 * off time before it starts.
 */
function ScoreRow({
  board,
  event,
  teams,
  size = 'md',
}: {
  board: Scoreboard;
  event: Event;
  teams: TeamLookup;
  size?: 'md' | 'lg';
}) {
  const hasScore = board.home.score !== null && board.away.score !== null;
  const scoreCls = (side: 'home' | 'away') =>
    `tabular-nums font-bold tracking-tight ${size === 'lg' ? 'text-5xl' : 'text-3xl'} ${
      board.winner && board.winner !== 'draw' && board.winner !== side ? 'text-gray-400' : 'text-gray-900'
    }`;
  const fmt = (n: number | null) => (n === null ? '' : Number.isInteger(n) ? String(n) : n.toFixed(2));

  let middle: React.ReactNode;
  if (board.live) {
    middle = (
      <div className="flex flex-col items-center">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-red-600">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75 motion-reduce:hidden" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-red-600" />
          </span>
          Live
        </span>
        {board.period && <span className="mt-0.5 text-[11px] font-medium text-gray-500">{board.period}</span>}
      </div>
    );
  } else if (event.status === 'completed' || hasScore) {
    middle = (
      <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wide text-gray-900">
        {board.winner === 'home' && <WinnerCaret dir="left" />}
        Final
        {board.winner === 'away' && <WinnerCaret dir="right" />}
      </span>
    );
  } else {
    middle = (
      <div className="flex flex-col items-center">
        <span className="text-sm font-bold text-gray-900 tabular-nums">
          {event.startTime ? formatTime(event.startTime) : 'TBA'}
        </span>
        <span className="text-[11px] font-medium uppercase text-gray-400">vs</span>
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)_auto_auto_auto_minmax(0,1fr)] items-center ${size === 'lg' ? 'gap-4' : 'gap-2.5'}`}>
      <TeamColumn team={board.home.team} sport={event.category} teams={teams} size={size} />
      <span className={scoreCls('home')}>{fmt(board.home.score)}</span>
      <div className="flex min-w-[4.5rem] justify-center">{middle}</div>
      <span className={scoreCls('away')}>{fmt(board.away.score)}</span>
      <TeamColumn team={board.away.team} sport={event.category} teams={teams} size={size} />
    </div>
  );
}

/** A judged event with more than two colleges: the top of its ranking. */
function RankedRows({
  event,
  rankings,
  teams,
}: {
  event: Event;
  rankings?: Ranking[];
  teams: TeamLookup;
}) {
  const nameOf = (r: Ranking) => event.departments[Number(r.department)] || r.department;

  if (!rankings || rankings.length === 0) {
    const shown = event.departments.slice(0, 5);
    return (
      <div className="flex flex-col items-center gap-2 py-1">
        <div className="flex -space-x-2">
          {shown.map((d) => {
            const { logoUrl, label } = teams.info(d);
            return (
              <span key={d} className="rounded-full ring-2 ring-white">
                <TeamLogo name={d} logoUrl={logoUrl} label={label} size={32} />
              </span>
            );
          })}
        </div>
        <span className="text-xs text-gray-500">
          {event.departments.length} colleges ·{' '}
          {event.status === 'upcoming' ? `starts ${event.startTime ? formatTime(event.startTime) : 'TBA'}` : 'awaiting scores'}
        </span>
      </div>
    );
  }

  return (
    <ol className="space-y-1.5">
      {rankings.slice(0, 3).map((r) => {
        const name = nameOf(r);
        const { logoUrl, label } = teams.info(name);
        return (
          <li key={r.department} className="flex items-center gap-2.5">
            <RankMedal rank={r.rank} />
            <TeamLogo name={name} logoUrl={logoUrl} label={label} size={24} />
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-gray-900" title={name}>{label}</span>
            <span className="text-sm font-bold tabular-nums text-gray-900">{Number(r.totalScore || 0).toFixed(2)}</span>
          </li>
        );
      })}
      {rankings.length > 3 && (
        <li className="pl-9 text-xs text-gray-500">+{rankings.length - 3} more</li>
      )}
    </ol>
  );
}

function GameCard({
  event,
  rankings,
  live,
  match,
  teams,
  onClick,
}: {
  event: Event;
  rankings?: Ranking[];
  live?: LiveScore;
  match?: MatchRow;
  teams: TeamLookup;
  onClick: () => void;
}) {
  const isVersus = (event.departments || []).length <= 2;
  const board = isVersus ? scoreboardFor(event.departments, live, match) : null;
  const isLive = board?.live || (event.status === 'ongoing' && !isVersus);

  return (
    <article
      className={`flex flex-col rounded-xl border bg-white shadow-sm transition-shadow hover:shadow-md ${
        isLive ? 'border-red-200 ring-1 ring-red-100' : 'border-gray-200'
      }`}
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3 text-[11px] text-gray-500">
        <span className="truncate">
          {new Date(event.schedule).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
        </span>
        <span className="shrink-0 font-medium text-gray-600">{event.category}</span>
      </div>

      <div className="flex-1 px-4 pt-4 pb-4">
        {board ? <ScoreRow board={board} event={event} teams={teams} /> : <RankedRows event={event} rankings={rankings} teams={teams} />}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 border-t border-gray-100 px-4 py-2.5">
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-gray-500">
          {(event.venueName || event.venue) && (
            <>
              <MapPin className="h-3.5 w-3.5 shrink-0 text-gray-400" />
              <span className="truncate">{event.venueName || event.venue}</span>
            </>
          )}
        </span>
        <button
          onClick={onClick}
          className="rounded-md border border-gray-300 px-3 py-1.5 text-xs font-semibold text-gray-800 transition-colors hover:bg-gray-50"
        >
          Game Details
        </button>
      </div>
    </article>
  );
}

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
  status: Event['status'];
  events: Event[];
  rankings: Record<string, Ranking[]>;
  liveByEvent: Record<string, LiveScore>;
  matchByEvent: Record<string, MatchRow>;
  teams: TeamLookup;
  onSelect: (e: Event) => void;
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

// ─── Match Detail Modal ───────────────────────────────────────────────────────

function MatchDetailModal({
  event,
  rankings,
  live,
  match,
  teams,
  onClose,
}: {
  event: Event | null;
  rankings: Ranking[];
  live?: LiveScore;
  match?: MatchRow;
  teams: TeamLookup;
  onClose: () => void;
}) {
  const abbr = useDeptAbbreviator();
  if (!event) return null;
  const cfg = STATUS_CONFIG[event.status];
  // Two colleges = a match, not a ranking. The score covers it.
  const isVersus = (event.departments || []).length <= 2;

  return (
    <Dialog open={!!event} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Status accent band */}
        <div className={`h-1 w-full rounded-t-lg ${cfg.barClass}`} />

        <div className="px-6 pt-4 pb-6">
          <DialogHeader className="mb-5">
            <div className="flex items-start gap-3">
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">{abbr(event.name)}</DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={event.status} />
                  <Badge variant="outline" className="text-sm">{event.category}</Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
            {/* Game score */}
            {isVersus && (
              <div className="rounded-xl border border-gray-200 px-4 py-5">
                <ScoreRow board={scoreboardFor(event.departments, live, match)} event={event} teams={teams} size="lg" />
              </div>
            )}

            {/* Info grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                <div className="bg-white p-2 rounded-lg shadow-sm">
                  <Calendar className="h-4 w-4 text-gray-500" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 font-medium">Date</p>
                  <p className="text-sm font-semibold text-gray-900">
                    {new Date(event.schedule).toLocaleDateString('en-US', {
                      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              {event.startTime && event.endTime && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3">
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    <Clock className="h-4 w-4 text-gray-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Time</p>
                    <p className="text-sm font-semibold text-gray-900">
                      {formatTime(event.startTime)} – {formatTime(event.endTime)}
                    </p>
                  </div>
                </div>
              )}

              {(event.venueName || event.venue) && (
                <div className="flex items-center gap-3 bg-gray-50 rounded-xl p-3 sm:col-span-2">
                  <div className="bg-white p-2 rounded-lg shadow-sm">
                    <MapPin className="h-4 w-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 font-medium">Venue</p>
                    <p className="text-sm font-semibold text-gray-900">{event.venueName || event.venue}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Departments */}
            <div>
              <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                <Users className="h-4 w-4 text-gray-500" />
                Participating Colleges ({(event.departments || []).length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {(event.departments || []).map((dept, i) => (
                  <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium" title={dept}>
                    {abbr(dept)}
                  </span>
                ))}
              </div>
            </div>

            {/* Rankings — only for multi-college (ranked) events; a 2-college match
                shows its result in the score strip above, and college standings
                live on the Leaderboard. */}
            {isVersus ? null : rankings && rankings.length > 0 ? (
              <div>
                <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                  <Award className="h-4 w-4 text-gray-500" />
                  {event.status === 'completed' ? 'Final Rankings' : 'Live Rankings'}
                </h3>
                <div className="space-y-2">
                  {rankings.map((r, idx) => (
                    <div
                      key={r.department}
                      className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                        idx === 0 ? 'bg-yellow-50 border border-yellow-200' :
                        idx === 1 ? 'bg-slate-50 border border-slate-200' :
                        idx === 2 ? 'bg-orange-50 border border-orange-200' :
                        'bg-gray-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <RankMedal rank={r.rank} />
                        <span className="font-semibold text-gray-800 text-sm">
                          {abbr(event.departments[Number(r.department)] || r.department)}
                        </span>
                      </div>
                      <span className="font-bold text-blue-600 text-base tabular-nums">
                        {Number(r.totalScore || 0).toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-10 bg-gray-50 rounded-xl">
                <Trophy className="h-10 w-10 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-400 font-medium">
                  {event.status === 'upcoming' ? 'Rankings will appear when the match starts' : 'No rankings available yet'}
                </p>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
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
  const eventsQuery = useEvents();
  const liveQuery = useLiveScores();

  const liveByEvent = useMemo<Record<string, LiveScore>>(
    () => Object.fromEntries((liveQuery.data ?? []).map((l) => [l.eventId, l])),
    [liveQuery.data],
  );

  const allEvents = useMemo<Event[]>(
    () =>
      (eventsQuery.data ?? []).map((event: any) => ({
        ...event,
        departments: event.departments || [],
      })),
    [eventsQuery.data],
  );

  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(new Date()));
  const [centerDate, setCenterDate] = useState<Date>(new Date());

  // ── Season / college / game filters ───────────────────────────────────────
  const seasonsQuery = useSeasons();
  const deptsQuery = useDepartments();
  const matchesQuery = useMatches();
  const abbr = useDeptAbbreviator();

  const seasons = seasonsQuery.data ?? [];
  const activeSeasonId = seasons.find((x) => x.isActive)?.id ?? null;
  // null = not touched yet, which means "the running season".
  const [seasonPick, setSeasonPick] = useState<string | null>(null);
  const seasonId = seasonPick ?? activeSeasonId ?? ALL;
  const [team, setTeam] = useState<string>(ALL);
  const [game, setGame] = useState<string>(ALL);

  // Events saved before seasons existed have none; they count as the running one.
  const inSeason = (e: Event) =>
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
  const matchesFilters = (e: Event) =>
    inSeason(e) &&
    (game === ALL || e.category === game) &&
    (team === ALL || e.departments.some((d) => sameTeam(team, d)));

  // Picking a college or a game means "show me their games", not just today's.
  const pickTeam = (v: string) => { setTeam(v); if (v !== ALL) setSelectedDate(null); };
  const pickGame = (v: string) => { setGame(v); if (v !== ALL) setSelectedDate(null); };
  const clearFilters = () => { setTeam(ALL); setGame(ALL); setSeasonPick(null); };

  // ── Results, logos and records ────────────────────────────────────────────
  const eventById = useMemo(() => new Map(allEvents.map((e) => [e.id, e])), [allEvents]);
  const matches = useMemo<MatchRow[]>(() => (matchesQuery.data as MatchRow[] | undefined) ?? [], [matchesQuery.data]);
  const matchByEvent = useMemo<Record<string, MatchRow>>(
    () => Object.fromEntries(matches.filter((m) => m.eventId).map((m) => [m.eventId as string, m])),
    [matches],
  );
  const records = useMemo(
    () =>
      recordsBySport(matches, (m) => {
        if (seasonId === ALL) return true;
        const ev = m.eventId ? eventById.get(m.eventId) : undefined;
        return !!ev && (ev.seasonId ?? activeSeasonId) === seasonId;
      }),
    [matches, eventById, seasonId, activeSeasonId],
  );
  const teams = useMemo<TeamLookup>(() => {
    const k = (v: string) => v.trim().toLowerCase();
    const byKey = new Map<string, { logoUrl?: string | null; abbreviation?: string | null; name: string }>();
    for (const d of depts) {
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