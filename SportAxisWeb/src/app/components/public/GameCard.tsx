import type { ReactNode } from 'react';
import type { LiveScore } from '../../services/api';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import {
  Trophy, Calendar, Users, Clock, MapPin, Award,
  Activity, CheckCircle2, Timer,
} from 'lucide-react';
import { TeamLogo } from './TeamLogo';
import {
  formatRecord, scoreboardFor,
  type MatchRow, type Record3, type Scoreboard,
} from '../../utils/games';
import { useDeptAbbreviator } from '../../utils/departments';

/**
 * The public scoreboard card and its detail dialog — shared by the Match
 * Schedule and the Live Scores board so a game looks the same on both.
 */

// ─── Types ───────────────────────────────────────────────────────────────────

export interface ScheduleEvent {
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
export interface TeamLookup {
  info: (name: string) => { logoUrl?: string | null; label: string };
  record: (sport: string, team: string) => Record3 | undefined;
}

export interface Ranking {
  department: string;
  totalScore: number;
  rank: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

export const formatTime = (time: string) => {
  if (!time) return '';
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
};

// ─── Status Config ────────────────────────────────────────────────────────────

export const STATUS_CONFIG = {
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

function StatusBadge({ status }: { status: ScheduleEvent['status'] }) {
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
  event: ScheduleEvent;
  teams: TeamLookup;
  size?: 'md' | 'lg';
}) {
  const hasScore = board.home.score !== null && board.away.score !== null;
  const scoreCls = (side: 'home' | 'away') =>
    `tabular-nums font-bold tracking-tight ${size === 'lg' ? 'text-5xl' : 'text-3xl'} ${
      board.winner && board.winner !== 'draw' && board.winner !== side ? 'text-gray-400' : 'text-gray-900'
    }`;
  const fmt = (n: number | null) => (n === null ? '' : Number.isInteger(n) ? String(n) : n.toFixed(2));

  let middle: ReactNode;
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
  event: ScheduleEvent;
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

export function GameCard({
  event,
  rankings,
  live,
  match,
  teams,
  onClick,
}: {
  event: ScheduleEvent;
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

// ─── Match Detail Modal ───────────────────────────────────────────────────────

export function MatchDetailModal({
  event,
  rankings,
  live,
  match,
  teams,
  onClose,
}: {
  event: ScheduleEvent | null;
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

