/**
 * When a venue is free on a day, for the event form's suggestions.
 *
 * Venues have no opening hours on record, so free time is looked for within
 * a standard competition day.
 */
export const VENUE_DAY_START = 7 * 60; // 7:00 AM
export const VENUE_DAY_END = 21 * 60; // 9:00 PM

export const minutesToTime = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export interface Booking { start: number; end: number; name: string }

/** Free stretches of the day between bookings, at least `length` minutes long. */
export function freeWindows(bookings: Booking[], length: number): [number, number][] {
  const out: [number, number][] = [];
  let cursor = VENUE_DAY_START;
  for (const b of [...bookings].sort((x, y) => x.start - y.start)) {
    if (b.start - cursor >= length) out.push([cursor, b.start]);
    cursor = Math.max(cursor, b.end);
  }
  if (VENUE_DAY_END - cursor >= length) out.push([cursor, VENUE_DAY_END]);
  return out;
}

/**
 * Up to `max` free time ranges of the same length as the one asked for,
 * nearest to the asked start first. Each free stretch offers its earliest
 * fit, and the fit closest to the asked time when that differs.
 */
export function suggestTimes(bookings: Booking[], length: number, wantStart: number, max = 4): [number, number][] {
  const fits: [number, number][] = [];
  for (const [from, to] of freeWindows(bookings, length)) {
    fits.push([from, from + length]);
    const near = Math.min(Math.max(wantStart, from), to - length);
    if (near !== from) fits.push([near, near + length]);
  }
  return fits
    .sort((a, b) => Math.abs(a[0] - wantStart) - Math.abs(b[0] - wantStart))
    .slice(0, max)
    .sort((a, b) => a[0] - b[0]);
}
