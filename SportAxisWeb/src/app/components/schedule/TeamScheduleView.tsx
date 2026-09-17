import { useMemo, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Calendar as DatePicker } from '../ui/calendar';
import { Calendar, MapPin, Clock, Trophy, Swords, X } from 'lucide-react';
import { isSameDay, format } from 'date-fns';
import { RefreshStatus } from '../RefreshStatus';
import { useDeptAbbreviator } from '../../utils/departments';
import type { TeamScheduleEvent } from '../../services/api';

/**
 * "2026-09-02" -> a Date at local midnight. Using `new Date(iso)` would parse
 * it as UTC, which lands the game on the previous day for anyone west of
 * Greenwich and makes the calendar highlight the wrong square.
 */
const toLocalDate = (iso: string) => {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(y, m - 1, d);
};

/** A red dot under any day that has a game, inverted while that day is picked. */
const DAY_WITH_GAME =
  'relative font-semibold after:absolute after:bottom-1 after:left-1/2 after:h-1.5 after:w-1.5 ' +
  'after:-translate-x-1/2 after:rounded-full after:bg-[#C8102E] aria-selected:after:bg-white';

/** Why the list is empty, phrased for the reader rather than the database. */
const EMPTY_REASON: Record<string, { title: string; hint: string }> = {
  no_college: {
    title: 'Your college is not set yet',
    hint: 'Ask the sports office to set your college, then your games will show up here.',
  },
  no_sport: {
    title: 'No sport assigned yet',
    hint: 'Once a sport is assigned to you, that sport\u2019s games appear here automatically.',
  },
  no_games: {
    title: 'No games scheduled yet',
    hint: 'Nothing has been scheduled for your team. Check back once the bracket is published.',
  },
};

const STATUS_COLOR: Record<string, string> = {
  upcoming: 'bg-blue-100 text-blue-800 border-blue-300',
  ongoing: 'bg-green-100 text-green-800 border-green-300',
  completed: 'bg-gray-100 text-gray-800 border-gray-300',
};

export interface TeamScheduleViewProps {
  /** e.g. "CICS Basketball" or "CICS Basketball, Badminton" — null while unknown. */
  teamLabel: string | null;
  events: TeamScheduleEvent[];
  reason: string | null;
  loading: boolean;
  fetching: boolean;
  error: boolean;
  onRetry: () => void;
}

/**
 * "My Schedule" — a month view marking the days with a game, and the games for
 * whichever day is picked. Shared by the athlete and coach pages, which differ
 * only in whose fixtures they fetch.
 */
export function TeamScheduleView({
  teamLabel,
  events,
  reason,
  loading,
  fetching,
  error,
  onRetry,
}: TeamScheduleViewProps) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
  const abbr = useDeptAbbreviator();

  const sorted = useMemo(
    () => [...events].sort((a, b) => new Date(a.schedule).getTime() - new Date(b.schedule).getTime()),
    [events],
  );

  /** One Date per day that has at least one game — what the calendar marks. */
  const gameDays = useMemo(() => {
    const seen = new Set<string>();
    return sorted.reduce<Date[]>((days, e) => {
      const key = e.schedule.slice(0, 10);
      if (!seen.has(key)) {
        seen.add(key);
        days.push(toLocalDate(e.schedule));
      }
      return days;
    }, []);
  }, [sorted]);

  const shown = selectedDate
    ? sorted.filter(e => isSameDay(toLocalDate(e.schedule), selectedDate))
    : sorted;

  const upcomingCount = sorted.filter(e => e.status === 'upcoming').length;
  const ongoingCount = sorted.filter(e => e.status === 'ongoing').length;

  const formatDate = (d: string) =>
    toLocalDate(d).toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold text-gray-900">My Schedule</h1>
          <RefreshStatus fetching={fetching && !loading} error={error} onRetry={onRetry} />
        </div>
        <p className="text-gray-600 mt-2">
          {teamLabel
            ? <>Games for <span className="font-semibold text-gray-900">{teamLabel}</span></>
            : 'Your team\u2019s games'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { label: 'Upcoming Games', value: upcomingCount, tone: 'text-blue-600' },
          { label: 'Ongoing Games', value: ongoingCount, tone: 'text-green-600' },
          { label: 'Total Games', value: sorted.length, tone: '' },
        ].map(stat => (
          <Card key={stat.label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-gray-600">{stat.label}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stat.tone}`}>{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[19rem_1fr] items-start">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Pick a date</CardTitle>
            <CardDescription>Days with a game are marked</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-2">
            <DatePicker
              mode="single"
              selected={selectedDate}
              onSelect={setSelectedDate}
              defaultMonth={gameDays[0]}
              modifiers={{ hasGame: gameDays }}
              modifiersClassNames={{ hasGame: DAY_WITH_GAME }}
            />
            {selectedDate ? (
              <Button variant="ghost" size="sm" onClick={() => setSelectedDate(undefined)}>
                <X className="h-4 w-4 mr-1.5" />
                Show all games
              </Button>
            ) : (
              <p className="text-sm text-gray-500 pb-2">
                {gameDays.length === 0
                  ? 'No game days yet'
                  : `${gameDays.length} ${gameDays.length === 1 ? 'day' : 'days'} with a game`}
              </p>
            )}
          </CardContent>
        </Card>

        <div className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="py-12 text-center text-gray-500">Loading schedule...</CardContent>
            </Card>
          ) : shown.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-700 font-medium mb-2">
                  {selectedDate
                    ? `No games on ${format(selectedDate, 'd MMMM yyyy')}`
                    : (reason && EMPTY_REASON[reason]?.title) || 'No games scheduled'}
                </p>
                <p className="text-sm text-gray-500 max-w-md mx-auto">
                  {selectedDate
                    ? 'Pick a marked date, or show all games.'
                    : (reason && EMPTY_REASON[reason]?.hint) || 'Check back later for updates.'}
                </p>
              </CardContent>
            </Card>
          ) : (
            shown.map(event => (
              <Card key={event.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <CardTitle className="text-xl">{abbr(event.name)}</CardTitle>
                        <Badge variant="secondary">{event.category}</Badge>
                        <Badge className={STATUS_COLOR[event.status] ?? STATUS_COLOR.completed}>
                          {event.status}
                        </Badge>
                      </div>
                    </div>
                    <Trophy className="h-6 w-6 text-[#C8102E]" />
                  </div>
                </CardHeader>
                <CardContent>
                  {event.opponents.length > 0 && (
                    <div className="flex items-center gap-2 mb-4 text-sm">
                      <Swords className="h-4 w-4 text-[#C8102E]" />
                      <span className="text-gray-500">vs</span>
                      <span className="font-semibold text-gray-900">
                        {event.opponents.map(o => o.abbreviation || o.name).join(', ')}
                      </span>
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Date</p>
                        <p className="text-sm text-gray-600">{formatDate(event.schedule)}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <Clock className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Time</p>
                        <p className="text-sm text-gray-600">{event.startTime} - {event.endTime}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <MapPin className="h-5 w-5 text-gray-400 mt-0.5" />
                      <div>
                        <p className="text-sm font-medium text-gray-700">Venue</p>
                        <p className="text-sm text-gray-600">{event.venueName || 'TBA'}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/** "CICS Basketball, Badminton" — null until the team is known. */
export function teamLabelOf(team: { collegeAbbreviation: string | null; college: string | null; sports: string[] } | null) {
  if (!team?.college) return null;
  return `${team.collegeAbbreviation || team.college} ${team.sports.join(', ')}`.trim();
}
