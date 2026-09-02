import { useMemo, useState } from 'react';
import { useQueries } from '@tanstack/react-query';
import { getEventRankings } from '../../services/api';
import type { LiveScore } from '../../services/api';
import { useEvents, useEventRankings, useLiveScores, qk } from '../../hooks/api';
import { STALE } from '../../lib/queryClient';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  Trophy, Calendar, Users, Clock, MapPin,
  ChevronLeft, ChevronRight, Award,
  Activity, CheckCircle2, Timer, ArrowRight
} from 'lucide-react';
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
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
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

// ─── Event Card ───────────────────────────────────────────────────────────────

function LiveScoreStrip({ live }: { live: LiveScore }) {
  const abbr = useDeptAbbreviator();
  const homeLead = live.homeScore > live.awayScore;
  const awayLead = live.awayScore > live.homeScore;
  return (
    <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5">
      <div className="mb-1 flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-700">Live Score</span>
        {live.period && <span className="text-[10px] font-semibold text-emerald-600">{live.period}</span>}
      </div>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <span className={`truncate text-right text-xs font-medium ${homeLead ? 'text-gray-900' : 'text-gray-500'}`} title={live.homeTeam ?? ''}>
          {abbr(live.homeTeam ?? 'Home')}
        </span>
        <span className="tabular-nums text-lg font-extrabold text-gray-900">
          {live.homeScore} <span className="text-gray-300">–</span> {live.awayScore}
        </span>
        <span className={`truncate text-xs font-medium ${awayLead ? 'text-gray-900' : 'text-gray-500'}`} title={live.awayTeam ?? ''}>
          {abbr(live.awayTeam ?? 'Away')}
        </span>
      </div>
    </div>
  );
}

function FinalScoreStrip({ live }: { live: LiveScore }) {
  const abbr = useDeptAbbreviator();
  const homeWon = live.homeScore > live.awayScore;
  const awayWon = live.awayScore > live.homeScore;
  const draw = live.homeScore === live.awayScore;

  return (
    <div className="mt-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2.5">
      <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-gray-500">Final Score</p>
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
        <div className={`flex items-center justify-end gap-1.5 min-w-0 ${homeWon || draw ? '' : 'opacity-60'}`}>
          {homeWon && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
          <span className={`truncate text-xs ${homeWon ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`} title={live.homeTeam ?? ''}>
            {abbr(live.homeTeam ?? 'Home')}
          </span>
        </div>
        <span className="tabular-nums text-lg font-extrabold">
          <span className={homeWon ? 'text-emerald-600' : 'text-gray-400'}>{live.homeScore}</span>
          <span className="mx-1 text-gray-300">–</span>
          <span className={awayWon ? 'text-emerald-600' : 'text-gray-400'}>{live.awayScore}</span>
        </span>
        <div className={`flex items-center gap-1.5 min-w-0 ${awayWon || draw ? '' : 'opacity-60'}`}>
          <span className={`truncate text-xs ${awayWon ? 'font-bold text-gray-900' : 'font-medium text-gray-500'}`} title={live.awayTeam ?? ''}>
            {abbr(live.awayTeam ?? 'Away')}
          </span>
          {awayWon && <Trophy className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        </div>
      </div>
      {draw && <p className="mt-1 text-center text-[10px] font-semibold text-gray-500">Drawn game</p>}
    </div>
  );
}

function EventCard({
  event,
  rankings,
  live,
  onClick,
}: {
  event: Event;
  rankings?: Ranking[];
  live?: LiveScore;
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[event.status];
  const topRanking = rankings?.[0];
  const abbr = useDeptAbbreviator();

  // A two-college event is a match (win/loss), not a ranking — the score says it all.
  const isVersus = (event.departments || []).length <= 2;

  return (
    <div
      onClick={onClick}
      className={`
        group relative bg-white rounded-xl border border-gray-200 shadow-sm
        ${cfg.borderClass}
        hover:shadow-md hover:border-gray-300
        transition-all duration-200 cursor-pointer overflow-hidden
      `}
    >
      <div className="p-5">
        {/* Top row: badge + sport icon */}
        <div className="flex items-start justify-between mb-3">
          <StatusBadge status={event.status} />
          <div className={`p-1.5 rounded-lg ${
            event.status === 'ongoing' ? 'bg-green-50 text-green-600' :
            event.status === 'upcoming' ? 'bg-blue-50 text-blue-600' :
            'bg-gray-100 text-gray-500'
          }`}>
            <Trophy className="h-4 w-4" />
          </div>
        </div>

        {/* Event name & category */}
        <h3 className="font-semibold text-gray-900 text-base leading-tight mb-1 group-hover:text-gray-600 transition-colors">
          {abbr(event.name)}
        </h3>
        <p className="text-sm text-gray-500 mb-4">{event.category}</p>

        {/* Meta info */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Calendar className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>{new Date(event.schedule).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
            {event.startTime && event.endTime && (
              <span className="text-blue-600 font-medium">
                · {formatTime(event.startTime)}
              </span>
            )}
          </div>

          {(event.venueName || event.venue) && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-red-400" />
              <span className="font-medium truncate">{event.venueName || event.venue}</span>
            </div>
          )}

          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Users className="h-3.5 w-3.5 shrink-0 text-gray-400" />
            <span>{(event.departments || []).length} colleges</span>
          </div>
        </div>

        {/* Live running score (objective sports) */}
        {event.status === 'ongoing' && live && live.status === 'in_progress' && (
          <LiveScoreStrip live={live} />
        )}

        {/* Mini ranking for ongoing / winner chip for completed */}
        {event.status === 'ongoing' && !isVersus && rankings && rankings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Live Rankings</p>
            <div className="space-y-1.5">
              {rankings.slice(0, 3).map((r) => (
                <div key={r.department} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <RankMedal rank={r.rank} />
                    <span className="font-medium text-gray-800 truncate max-w-[120px]">
                      {abbr(event.departments[Number(r.department)] || r.department)}
                    </span>
                  </div>
                  <span className="font-bold text-blue-600 tabular-nums">{Number(r.totalScore || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {event.status === 'completed' && live && live.status === 'final' ? (
          <FinalScoreStrip live={live} />
        ) : event.status === 'completed' && topRanking ? (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Winner</p>
            <div className="flex items-center gap-2">
              <Trophy className="h-4 w-4 text-amber-500 shrink-0" />
              <span className="font-semibold text-gray-800 text-sm">
                {abbr(event.departments[Number(topRanking.department)] || topRanking.department)}
              </span>
            </div>
          </div>
        ) : null}

        {/* "View Details" hover hint */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end">
          <span className="inline-flex items-center gap-1 text-xs text-gray-400 group-hover:text-gray-700 transition-colors font-medium">
            View full details
            <ArrowRight className="h-3.5 w-3.5" />
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Section ──────────────────────────────────────────────────────────────────

function MatchSection({
  status,
  events,
  rankings,
  liveByEvent,
  onSelect,
}: {
  status: Event['status'];
  events: Event[];
  rankings: Record<string, Ranking[]>;
  liveByEvent: Record<string, LiveScore>;
  onSelect: (e: Event) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const SectionIcon = cfg.icon;

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5 pb-2 border-b border-gray-200">
        <div className={`flex items-center gap-2 ${cfg.sectionColor}`}>
          <SectionIcon className="h-4 w-4" />
          <h2 className="text-sm font-semibold uppercase tracking-wide">{cfg.sectionLabel}</h2>
        </div>
        <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-600">
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 py-12 text-center text-gray-400">
          <SectionIcon className="h-7 w-7 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No {cfg.sectionLabel.toLowerCase()} matches</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              rankings={rankings[event.id]}
              live={liveByEvent[event.id]}
              onClick={() => onSelect(event)}
            />
          ))}
        </div>
      )}
    </section>
  );
}

// ─── Match Detail Modal ───────────────────────────────────────────────────────

function MatchDetailModal({
  event,
  rankings,
  live,
  onClose,
}: {
  event: Event | null;
  rankings: Ranking[];
  live?: LiveScore;
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
            {live && live.status === 'in_progress' && <LiveScoreStrip live={live} />}
            {live && live.status === 'final' && <FinalScoreStrip live={live} />}

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

  // ── Filter events client-side by selectedDate ─────────────────────────────
  const filteredEvents = selectedDate
    ? allEvents.filter(e => {
        const evDate = e.schedule?.split('T')[0] ?? e.schedule;
        return evDate === selectedDate;
      })
    : allEvents;

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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading match schedule..." />
      </div>
    );
  }

  if (eventsQuery.isLoadingError) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

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

      {/* Date Filter Bar */}
      <DateFilterBar
        selectedDate={selectedDate}
        onChange={setSelectedDate}
        centerDate={centerDate}
        onCenterChange={setCenterDate}
        resultCount={filteredEvents.length}
      />

      {/* No results for selected date */}
      {selectedDate && filteredEvents.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white py-14 text-center">
          <Calendar className="mx-auto h-8 w-8 text-gray-300" />
          <p className="mt-3 text-sm font-medium text-gray-700">No matches on this date</p>
          <p className="mt-1 text-sm text-gray-500">Pick another date, or view every scheduled match.</p>
          <button
            onClick={() => setSelectedDate(null)}
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
          >
            Show all matches
          </button>
        </div>
      )}

      {/* Three Swimlane Sections */}
      {(filteredEvents.length > 0 || !selectedDate) && (
        <>
          <MatchSection status="ongoing" events={ongoingEvents} rankings={rankings} liveByEvent={liveByEvent} onSelect={setSelectedEvent} />
          <MatchSection status="upcoming" events={upcomingEvents} rankings={rankings} liveByEvent={liveByEvent} onSelect={setSelectedEvent} />
          <MatchSection status="completed" events={completedEvents} rankings={rankings} liveByEvent={liveByEvent} onSelect={setSelectedEvent} />
        </>
      )}

      {/* Match Detail Modal */}
      <MatchDetailModal
        event={selectedEvent}
        rankings={selectedEvent ? (rankings[selectedEvent.id] ?? []) : []}
        live={selectedEvent ? liveByEvent[selectedEvent.id] : undefined}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}