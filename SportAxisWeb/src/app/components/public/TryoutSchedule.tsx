import { CalendarDays, Clock, MapPin } from 'lucide-react';

const fmtTime = (t: string) => {
  const [h, m] = t.split(':').map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};

/** When and where a tryout is held — nothing when the coach hasn't set a date. */
export function TryoutSchedule({
  date,
  startTime,
  endTime,
  venue,
}: {
  date?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  venue?: string | null;
}) {
  if (!date) return null;
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-gray-50 px-3 py-2 text-sm text-gray-700">
      <span className="font-medium text-gray-900">Tryout</span>
      <span className="inline-flex items-center gap-1">
        <CalendarDays className="h-3.5 w-3.5 text-gray-400" />
        {new Date(`${date.slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' })}
      </span>
      {startTime && (
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          {fmtTime(startTime)}{endTime ? ` – ${fmtTime(endTime)}` : ''}
        </span>
      )}
      <span className="inline-flex items-center gap-1">
        <MapPin className="h-3.5 w-3.5 text-gray-400" />
        {venue || 'Venue to be announced'}
      </span>
    </div>
  );
}
