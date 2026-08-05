import { useEffect, useState, useCallback } from 'react';
import { getEvents, getEventsByDate, getEventRankings, startWarmup } from '../../services/api';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import {
  Trophy, Calendar, Users, Loader2, Clock, MapPin,
  ChevronLeft, ChevronRight, RefreshCw, Target, Award,
  Zap, CheckCircle2, Timer
} from 'lucide-react';
import Loading from '../../components/Loading';

// ─── Types ───────────────────────────────────────────────────────────────────

interface Criterion {
  name: string;
  weight: number;
}

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
  criteria?: Criterion[];
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

const formatDayLabel = (d: Date) => {
  const today = new Date();
  const yesterday = new Date(today); yesterday.setDate(today.getDate() - 1);
  const tomorrow = new Date(today); tomorrow.setDate(today.getDate() + 1);
  if (toDateKey(d) === toDateKey(today)) return 'Today';
  if (toDateKey(d) === toDateKey(yesterday)) return 'Yesterday';
  if (toDateKey(d) === toDateKey(tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

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
    icon: Zap,
    borderClass: 'border-l-4 border-green-500',
    badgeClass: 'bg-green-500 text-white',
    sectionColor: 'text-green-700',
    sectionBg: 'bg-green-50 border-green-200',
    dot: 'bg-green-500',
    pulse: true,
    emoji: '🔴',
  },
  upcoming: {
    label: 'Upcoming',
    sectionLabel: 'Upcoming',
    icon: Timer,
    borderClass: 'border-l-4 border-blue-500',
    badgeClass: 'bg-blue-500 text-white',
    sectionColor: 'text-blue-700',
    sectionBg: 'bg-blue-50 border-blue-200',
    dot: 'bg-blue-500',
    pulse: false,
    emoji: '🗓',
  },
  completed: {
    label: 'Completed',
    sectionLabel: 'Completed',
    icon: CheckCircle2,
    borderClass: 'border-l-4 border-gray-400',
    badgeClass: 'bg-gray-500 text-white',
    sectionColor: 'text-gray-600',
    sectionBg: 'bg-gray-50 border-gray-200',
    dot: 'bg-gray-400',
    pulse: false,
    emoji: '✅',
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

function EventCard({
  event,
  rankings,
  onClick,
}: {
  event: Event;
  rankings?: Ranking[];
  onClick: () => void;
}) {
  const cfg = STATUS_CONFIG[event.status];
  const topRanking = rankings?.[0];

  return (
    <div
      onClick={onClick}
      className={`
        group relative bg-white/90 backdrop-blur-sm rounded-xl shadow-sm
        ${cfg.borderClass}
        hover:shadow-xl hover:-translate-y-1
        transition-all duration-200 cursor-pointer overflow-hidden
      `}
    >
      {/* Subtle top gradient stripe */}
      <div className={`h-1 w-full ${
        event.status === 'ongoing' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
        event.status === 'upcoming' ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
        'bg-gradient-to-r from-gray-300 to-gray-400'
      }`} />

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
        <h3 className="font-bold text-gray-900 text-base leading-tight mb-1 group-hover:text-red-700 transition-colors">
          {event.name}
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
            <span>{(event.departments || []).length} departments</span>
          </div>
        </div>

        {/* Mini ranking for ongoing / winner chip for completed */}
        {event.status === 'ongoing' && rankings && rankings.length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Live Rankings</p>
            <div className="space-y-1.5">
              {rankings.slice(0, 3).map((r) => (
                <div key={r.department} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <RankMedal rank={r.rank} />
                    <span className="font-medium text-gray-800 truncate max-w-[120px]">
                      {event.departments[Number(r.department)] || r.department}
                    </span>
                  </div>
                  <span className="font-bold text-blue-600 tabular-nums">{Number(r.totalScore || 0).toFixed(2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {event.status === 'completed' && topRanking && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Winner</p>
            <div className="flex items-center gap-2">
              <span className="text-lg">🏆</span>
              <span className="font-semibold text-gray-800 text-sm">
                {event.departments[Number(topRanking.department)] || topRanking.department}
              </span>
            </div>
          </div>
        )}

        {/* "View Details" hover hint */}
        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-end">
          <span className="text-xs text-gray-400 group-hover:text-red-600 transition-colors font-medium">
            View Full Details →
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
  onSelect,
}: {
  status: Event['status'];
  events: Event[];
  rankings: Record<string, Ranking[]>;
  onSelect: (e: Event) => void;
}) {
  const cfg = STATUS_CONFIG[status];
  const SectionIcon = cfg.icon;

  return (
    <section className="mb-10">
      {/* Section header */}
      <div className={`flex items-center gap-3 mb-5 p-3 rounded-xl border ${cfg.sectionBg}`}>
        <div className={`flex items-center gap-2 ${cfg.sectionColor}`}>
          <SectionIcon className="h-5 w-5" />
          <h2 className="text-lg font-bold">{cfg.emoji} {cfg.sectionLabel}</h2>
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold bg-white border ${cfg.sectionColor}`}>
          {events.length}
        </span>
      </div>

      {events.length === 0 ? (
        <div className="bg-white/60 backdrop-blur-sm rounded-xl border border-gray-100 py-12 text-center text-gray-400">
          <SectionIcon className="h-8 w-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No {cfg.sectionLabel.toLowerCase()} matches</p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {events.map(event => (
            <EventCard
              key={event.id}
              event={event}
              rankings={rankings[event.id]}
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
  onClose,
}: {
  event: Event | null;
  rankings: Ranking[];
  onClose: () => void;
}) {
  if (!event) return null;
  const cfg = STATUS_CONFIG[event.status];

  return (
    <Dialog open={!!event} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
        {/* Colored header band */}
        <div className={`h-2 w-full rounded-t-lg ${
          event.status === 'ongoing' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
          event.status === 'upcoming' ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
          'bg-gradient-to-r from-gray-300 to-gray-400'
        }`} />

        <div className="px-6 pt-4 pb-6">
          <DialogHeader className="mb-5">
            <div className="flex items-start gap-3">
              <div>
                <DialogTitle className="text-2xl font-bold text-gray-900 mb-2">{event.name}</DialogTitle>
                <div className="flex items-center gap-2 flex-wrap">
                  <StatusBadge status={event.status} />
                  <Badge variant="outline" className="text-sm">{event.category}</Badge>
                </div>
              </div>
            </div>
          </DialogHeader>

          <div className="space-y-6">
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
                Participating Departments ({(event.departments || []).length})
              </h3>
              <div className="flex flex-wrap gap-2">
                {(event.departments || []).map((dept, i) => (
                  <span key={i} className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-full text-sm font-medium">
                    {dept}
                  </span>
                ))}
              </div>
            </div>

            {/* Judging Criteria */}
            {event.criteria && event.criteria.length > 0 && (
              <div>
                <h3 className="flex items-center gap-2 font-bold text-gray-900 mb-3 text-sm uppercase tracking-wide">
                  <Target className="h-4 w-4 text-gray-500" />
                  Judging Criteria
                </h3>
                <div className="space-y-3">
                  {event.criteria.map((c, i) => (
                    <div key={i}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className="font-medium text-gray-700">{c.name}</span>
                        <span className="font-bold text-gray-900">{c.weight}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            event.status === 'ongoing' ? 'bg-gradient-to-r from-green-400 to-emerald-500' :
                            event.status === 'upcoming' ? 'bg-gradient-to-r from-blue-400 to-indigo-500' :
                            'bg-gradient-to-r from-gray-400 to-gray-500'
                          }`}
                          style={{ width: `${c.weight}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Rankings */}
            {rankings && rankings.length > 0 ? (
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
                          {event.departments[Number(r.department)] || r.department}
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
}: {
  selectedDate: string | null;
  onChange: (d: string | null) => void;
  centerDate: Date;
  onCenterChange: (d: Date) => void;
}) {
  const dates = getDateRange(centerDate, 3);

  const shiftCenter = (by: number) => {
    const next = new Date(centerDate);
    next.setDate(centerDate.getDate() + by);
    onCenterChange(next);
  };

  return (
    <div className="bg-white/90 backdrop-blur-sm rounded-2xl shadow-sm border border-gray-100 p-4 mb-8">
      <div className="flex items-center gap-2">
        <button
          onClick={() => shiftCenter(-3)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
          aria-label="Previous days"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex-1 flex items-center gap-1.5 overflow-x-auto scrollbar-hide">
          {dates.map(d => {
            const key = toDateKey(d);
            const isSelected = selectedDate === key;
            const isToday = key === toDateKey(new Date());
            return (
              <button
                key={key}
                onClick={() => onChange(isSelected ? null : key)}
                className={`
                  shrink-0 flex flex-col items-center px-3 py-2 rounded-xl text-xs font-semibold transition-all duration-150
                  ${isSelected
                    ? 'bg-red-600 text-white shadow-md scale-105'
                    : isToday
                    ? 'bg-red-50 text-red-700 border border-red-200'
                    : 'text-gray-600 hover:bg-gray-100'
                  }
                `}
              >
                <span className="text-[10px] opacity-70 uppercase tracking-wide">
                  {d.toLocaleDateString('en-US', { weekday: 'short' })}
                </span>
                <span className="text-sm mt-0.5">{formatDayLabel(d)}</span>
              </button>
            );
          })}
        </div>

        <button
          onClick={() => shiftCenter(3)}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors shrink-0"
          aria-label="Next days"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        {/* Custom date picker */}
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
            className="absolute inset-0 opacity-0 cursor-pointer w-full"
            title="Pick a date"
          />
          <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors cursor-pointer">
            <Calendar className="h-4 w-4" />
            <span className="text-xs font-medium hidden sm:inline">Pick Date</span>
          </div>
        </div>

        {/* View All */}
        {selectedDate && (
          <button
            onClick={() => onChange(null)}
            className="shrink-0 px-3 py-2 rounded-xl bg-gray-100 text-gray-600 text-xs font-semibold hover:bg-gray-200 transition-colors"
          >
            View All
          </button>
        )}
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function PublicViewer() {
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [rankings, setRankings] = useState<Record<string, Ranking[]>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [autoRetryCount, setAutoRetryCount] = useState(0);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(toDateKey(new Date()));
  const [centerDate, setCenterDate] = useState<Date>(new Date());
  const [refreshing, setRefreshing] = useState(false);

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

  // ── Load all events + rankings for ongoing ones ───────────────────────────
  const loadData = useCallback(async (isManual = false) => {
    try {
      if (isManual) setRefreshing(true);
      setError(null);
      await startWarmup();
      const eventsData = await getEvents();

      const normalized = (eventsData || []).map((event: any) => ({
        ...event,
        departments: event.departments || [],
        criteria: event.criteria || [],
      }));

      setAllEvents(normalized);

      // Load rankings for ongoing & completed
      const relevantEvents = normalized.filter(
        (e: Event) => e.status === 'ongoing' || e.status === 'completed'
      );
      const rankingsData: Record<string, Ranking[]> = { ...rankings };

      for (const event of relevantEvents) {
        try {
          const eventRankings = await getEventRankings(event.id);
          rankingsData[event.id] = Array.isArray(eventRankings) ? eventRankings : [];
        } catch {
          rankingsData[event.id] = [];
        }
      }

      setRankings(rankingsData);
      setLastUpdate(new Date());
      setAutoRetryCount(0);
    } catch (err: any) {
      setError(err.message || 'Failed to load data. Please check your connection.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(() => loadData(), 10000);
    return () => clearInterval(interval);
  }, [loadData]);

  // Auto-retry on cold start
  useEffect(() => {
    if (error && autoRetryCount < 3) {
      const isServerStarting = error.includes('starting up') || error.includes('connect to the server');
      if (isServerStarting) {
        const timer = setTimeout(() => {
          setAutoRetryCount(prev => prev + 1);
          setError(null);
          setLoading(true);
          loadData();
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [error, autoRetryCount, loadData]);

  // Refresh rankings when modal opens
  useEffect(() => {
    if (selectedEvent) {
      getEventRankings(selectedEvent.id)
        .then(res => {
          if (Array.isArray(res)) {
            setRankings(prev => ({ ...prev, [selectedEvent.id]: res }));
          }
        })
        .catch(() => {});
    }
  }, [selectedEvent]);

  // ── Error State ───────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Loading fullScreen={false} message="Loading match schedule..." />
      </div>
    );
  }

  if (error) {
    const isServerStarting = error.includes('starting up') || error.includes('connect to the server');
    const willAutoRetry = isServerStarting && autoRetryCount < 3;
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className={`rounded-2xl border p-8 text-center ${isServerStarting ? 'border-yellow-200 bg-yellow-50' : 'border-red-200 bg-red-50'}`}>
          {isServerStarting ? (
            <>
              <Loader2 className="h-10 w-10 text-yellow-500 animate-spin mx-auto mb-3" />
              <p className="text-yellow-800 font-bold mb-1">Server is Waking Up</p>
              <p className="text-yellow-700 text-sm mb-4">
                {willAutoRetry ? `Retrying automatically... (${autoRetryCount + 1}/3)` : 'Please click refresh to try again.'}
              </p>
            </>
          ) : (
            <>
              <p className="text-red-600 font-bold mb-1">Error Loading Data</p>
              <p className="text-red-500 text-sm mb-4">{error}</p>
            </>
          )}
          <button
            onClick={() => { setError(null); setLoading(true); setAutoRetryCount(0); loadData(); }}
            className="px-5 py-2.5 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            Refresh Now
          </button>
        </div>
      </div>
    );
  }

  // ── Main Render ───────────────────────────────────────────────────────────
  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Match Schedule</h1>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-red-500 text-white">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-white" />
              </span>
              LIVE
            </span>
          </div>
          <p className="text-gray-400 text-sm mt-1">
            Auto-refreshes every 10s · Last updated: {lastUpdate.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Date Filter Bar */}
      <DateFilterBar
        selectedDate={selectedDate}
        onChange={setSelectedDate}
        centerDate={centerDate}
        onCenterChange={setCenterDate}
      />

      {/* Summary chips when date is selected */}
      {selectedDate && (
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <span className="text-sm text-gray-500">
            Showing matches for <span className="font-semibold text-gray-800">{new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          </span>
          <span className="text-gray-300">·</span>
          <span className="text-sm font-medium text-gray-500">{filteredEvents.length} match{filteredEvents.length !== 1 ? 'es' : ''}</span>
        </div>
      )}

      {/* No results for selected date */}
      {selectedDate && filteredEvents.length === 0 && (
        <div className="text-center py-20 bg-white/60 backdrop-blur-sm rounded-2xl border border-gray-100">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-semibold">No matches on this date</p>
          <p className="text-gray-400 text-sm mt-1">Try selecting a different date or click "View All"</p>
          <button
            onClick={() => setSelectedDate(null)}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded-xl text-sm font-semibold hover:bg-red-700 transition-colors"
          >
            View All Matches
          </button>
        </div>
      )}

      {/* Three Swimlane Sections */}
      {(filteredEvents.length > 0 || !selectedDate) && (
        <>
          <MatchSection status="ongoing" events={ongoingEvents} rankings={rankings} onSelect={setSelectedEvent} />
          <MatchSection status="upcoming" events={upcomingEvents} rankings={rankings} onSelect={setSelectedEvent} />
          <MatchSection status="completed" events={completedEvents} rankings={rankings} onSelect={setSelectedEvent} />
        </>
      )}

      {/* Match Detail Modal */}
      <MatchDetailModal
        event={selectedEvent}
        rankings={selectedEvent ? (rankings[selectedEvent.id] ?? []) : []}
        onClose={() => setSelectedEvent(null)}
      />
    </div>
  );
}