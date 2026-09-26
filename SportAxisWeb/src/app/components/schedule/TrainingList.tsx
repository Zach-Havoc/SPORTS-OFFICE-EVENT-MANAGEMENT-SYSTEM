import { CalendarDays, Clock, Dumbbell, MapPin } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import type { TrainingSession } from '../../services/api';

const fmtDate = (d: string) =>
  new Date(`${d}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** The athlete's upcoming training sessions, as the coach scheduled them. */
export function TrainingList({ sessions, loading }: { sessions: TrainingSession[]; loading: boolean }) {
  return (
    <Card className="mb-8">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Dumbbell className="h-4 w-4 text-gray-500" />
          Upcoming training
        </CardTitle>
        <CardDescription>Scheduled by your coach. You're notified when a session moves or is cancelled.</CardDescription>
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="py-4 text-center text-sm text-gray-500">Loading training…</p>
        ) : sessions.length === 0 ? (
          <p className="py-4 text-center text-sm text-gray-500">No training scheduled yet.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {sessions.slice(0, 8).map((s) => (
              <li key={s.id} className="flex flex-col gap-1 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <span className="font-medium text-gray-900">{s.title}</span>
                <span className="flex flex-wrap items-center gap-x-4 gap-y-0.5 text-sm text-gray-600">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="h-3.5 w-3.5" />{fmtDate(s.date)}</span>
                  {s.startTime && (
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {fmtTime(s.startTime)}{s.endTime ? ` – ${fmtTime(s.endTime)}` : ''}
                    </span>
                  )}
                  {s.venueName && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{s.venueName}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
        {sessions.length > 8 && (
          <p className="pt-2 text-xs text-gray-500">+{sessions.length - 8} more sessions scheduled</p>
        )}
      </CardContent>
    </Card>
  );
}
