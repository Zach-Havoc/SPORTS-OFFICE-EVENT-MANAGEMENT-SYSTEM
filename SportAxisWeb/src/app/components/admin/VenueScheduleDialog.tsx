import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, CalendarDays, Gavel, MapPin } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { useDeptAbbreviator, shortDeptLabel } from '../../utils/departments';

interface VenueRef {
  id: string;
  name: string;
  location?: string;
}

/** Local YYYY-MM-DD, the way event dates are stored. */
export const isoDay = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

function fmtTime(t?: string | null) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  if (Number.isNaN(h)) return t;
  return `${h % 12 || 12}:${String(m || 0).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
}

/** Whether an event is booked at this venue (by id, or by name on older rows). */
export function atVenue(e: any, venue: VenueRef) {
  return e.venueId ? e.venueId === venue.id : (e.venueName ?? '').trim() === venue.name.trim();
}

const STATUS: Record<string, { label: string; cls: string }> = {
  ongoing: { label: 'Ongoing', cls: 'bg-red-50 text-red-700' },
  completed: { label: 'Completed', cls: 'bg-gray-100 text-gray-600' },
  upcoming: { label: 'Upcoming', cls: 'bg-sky-50 text-sky-700' },
};

/** Every game booked at one venue, upcoming or past, by day. */
export function VenueScheduleDialog({
  venue,
  events,
  onClose,
}: {
  venue: VenueRef | null;
  events: any[];
  onClose: () => void;
}) {
  const abbr = useDeptAbbreviator();
  const [view, setView] = useState<'upcoming' | 'past'>('upcoming');
  const today = isoDay(new Date());

  const { upcoming, past } = useMemo(() => {
    const mine = venue ? events.filter((e) => atVenue(e, venue)) : [];
    const day = (e: any) => String(e.schedule ?? '').slice(0, 10);
    const byTime = (a: any, b: any) =>
      day(a).localeCompare(day(b)) || String(a.startTime ?? '').localeCompare(String(b.startTime ?? ''));
    return {
      upcoming: mine.filter((e) => day(e) >= today).sort(byTime),
      // Most recent first.
      past: mine.filter((e) => day(e) < today).sort((a, b) => byTime(b, a)),
    };
  }, [events, venue, today]);

  const list = view === 'upcoming' ? upcoming : past;
  const days = useMemo(() => {
    const out: { day: string; games: any[] }[] = [];
    for (const e of list) {
      const d = String(e.schedule ?? '').slice(0, 10);
      const last = out[out.length - 1];
      if (last && last.day === d) last.games.push(e);
      else out.push({ day: d, games: [e] });
    }
    return out;
  }, [list]);

  const dayLabel = (d: string) => {
    if (d === today) return 'Today';
    const date = new Date(`${d}T00:00:00`);
    if (d === isoDay(new Date(Date.now() + 86_400_000))) return 'Tomorrow';
    return date.toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      ...(date.getFullYear() !== new Date().getFullYear() ? { year: 'numeric' } : {}),
    });
  };

  return (
    <Dialog open={!!venue} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{venue?.name} schedule</DialogTitle>
          <DialogDescription className="flex items-center gap-1.5">
            {venue?.location && (
              <>
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{venue.location}</span>
                <span aria-hidden="true">·</span>
              </>
            )}
            {upcoming.length} upcoming · {past.length} past
          </DialogDescription>
        </DialogHeader>

        <div className="inline-flex w-fit rounded-md border p-0.5" role="tablist" aria-label="Which games">
          {(['upcoming', 'past'] as const).map((v) => (
            <button
              key={v}
              type="button"
              role="tab"
              aria-selected={view === v}
              onClick={() => setView(v)}
              className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                view === v ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {v === 'upcoming' ? `Upcoming (${upcoming.length})` : `Past (${past.length})`}
            </button>
          ))}
        </div>

        {days.length === 0 ? (
          <div className="py-10 text-center text-sm text-gray-500">
            <CalendarDays className="mx-auto mb-2 h-7 w-7 text-gray-300" />
            {view === 'upcoming' ? 'Nothing is booked here yet.' : 'No games have been played here yet.'}
          </div>
        ) : (
          <div className="space-y-4">
            {days.map(({ day, games }) => (
              <section key={day}>
                <h3 className="mb-1.5 flex items-baseline gap-2 text-sm font-semibold text-gray-900">
                  {dayLabel(day)}
                  <span className="text-xs font-normal text-gray-500">
                    {games.length} {games.length === 1 ? 'game' : 'games'}
                  </span>
                </h3>
                <ul className="divide-y rounded-md border">
                  {games.map((e) => {
                    const teams: string[] = (e.departments || []).filter(Boolean);
                    const matchup =
                      teams.length === 2
                        ? `${shortDeptLabel(abbr, teams[0], 12)} vs ${shortDeptLabel(abbr, teams[1], 12)}`
                        : teams.length > 2
                          ? `${teams.length} colleges`
                          : 'Teams to be decided';
                    const round = String(e.name ?? '').match(/\(([^)]+)\)/)?.[1];
                    const committee = (e.judges || [])[0]?.name as string | undefined;
                    const status = STATUS[e.status] ?? STATUS.upcoming;
                    // A past game that never reached a result.
                    const noResult = day < today && e.status !== 'completed';
                    return (
                      <li key={e.id}>
                        <Link
                          to={`/admin/events?q=${encodeURIComponent(e.name)}`}
                          onClick={onClose}
                          title={e.name}
                          className="grid grid-cols-[5.5rem_minmax(0,1fr)_auto] items-center gap-3 px-3 py-2 transition-colors hover:bg-gray-50 sm:grid-cols-[5.5rem_minmax(0,1fr)_minmax(0,9rem)_auto]"
                        >
                          <span className="text-xs tabular-nums text-gray-600">
                            {fmtTime(e.startTime)}
                            {e.endTime && <span className="block text-gray-400">{fmtTime(e.endTime)}</span>}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-medium text-gray-900">{matchup}</span>
                            <span className="block truncate text-xs text-gray-500">
                              {[e.category, round].filter(Boolean).join(' · ')}
                            </span>
                          </span>
                          <span className="hidden min-w-0 sm:block">
                            {committee ? (
                              <span className="flex items-center gap-1.5 truncate text-xs text-gray-600">
                                <Gavel className="h-3.5 w-3.5 shrink-0 text-gray-400" />
                                <span className="truncate">{committee}</span>
                              </span>
                            ) : (
                              <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                                <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                                No committee
                              </span>
                            )}
                          </span>
                          <span
                            className={`whitespace-nowrap rounded px-1.5 py-0.5 text-[11px] font-semibold ${
                              noResult ? 'bg-amber-50 text-amber-800' : status.cls
                            }`}
                          >
                            {noResult ? 'No result' : status.label}
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
