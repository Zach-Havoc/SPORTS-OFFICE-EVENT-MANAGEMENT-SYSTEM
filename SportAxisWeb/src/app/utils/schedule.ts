/**
 * Small helpers for detecting venue/time booking clashes on the client, so the
 * admin sees a conflict *before* a save round-trips. The backend enforces the
 * same rule authoritatively — this is just fast feedback.
 */

/** "20:00", "8:00", "08:00 AM", "8:00 PM" -> minutes since midnight (or null). */
export function toMinutes(time: string | null | undefined): number | null {
  if (!time) return null;
  const t = time.trim();

  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10) % 12;
    if (ampm[3].toLowerCase() === 'pm') h += 12;
    return h * 60 + parseInt(ampm[2], 10);
  }

  const h24 = t.match(/^(\d{1,2}):(\d{2})/);
  if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10);

  return null;
}

/** Do time ranges [aStart,aEnd) and [bStart,bEnd) overlap? Unparseable -> false. */
export function timeRangesOverlap(
  aStart: string | null | undefined,
  aEnd: string | null | undefined,
  bStart: string | null | undefined,
  bEnd: string | null | undefined,
): boolean {
  let as = toMinutes(aStart);
  let ae = toMinutes(aEnd);
  let bs = toMinutes(bStart);
  let be = toMinutes(bEnd);
  if (as === null || ae === null || bs === null || be === null) return false;
  if (ae <= as) ae = as + 1;
  if (be <= bs) be = bs + 1;
  return as < be && bs < ae;
}

/** Compare the date part of two schedule strings ("2026-08-31" or "2026-08-31T..."). */
export function sameDay(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  return String(a).slice(0, 10) === String(b).slice(0, 10);
}

interface VenueSlot {
  venueId?: string | null;
  venueName?: string | null;
}

/** Same physical venue? Matches on id, or on a real (non-"TBD") name. */
export function sameVenue(a: VenueSlot, b: VenueSlot): boolean {
  if (a.venueId && b.venueId) return a.venueId === b.venueId;
  const an = (a.venueName || '').trim();
  const bn = (b.venueName || '').trim();
  if (!an || !bn || an.toUpperCase() === 'TBD' || bn.toUpperCase() === 'TBD') return false;
  return an.toLowerCase() === bn.toLowerCase();
}

export interface Booking extends VenueSlot {
  name?: string;
  schedule?: string | null; // date (or datetime)
  startTime?: string | null;
  endTime?: string | null;
}

/** First booking in `against` that clashes with `slot` (same venue + day + overlapping time). */
export function findVenueClash(slot: Booking, against: Booking[]): Booking | null {
  if (!slot.venueId && (!slot.venueName || slot.venueName.toUpperCase() === 'TBD')) return null;
  for (const other of against) {
    if (
      sameVenue(slot, other) &&
      sameDay(slot.schedule, other.schedule) &&
      timeRangesOverlap(slot.startTime, slot.endTime, other.startTime, other.endTime)
    ) {
      return other;
    }
  }
  return null;
}
