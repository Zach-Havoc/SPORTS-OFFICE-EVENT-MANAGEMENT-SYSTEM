import { describe, it, expect } from 'vitest';
import { freeWindows, suggestTimes, VENUE_DAY_END, VENUE_DAY_START, type Booking } from './venueAvailability';

/** The event form: a clash suggests free times of the same length; no fit means fully booked. */
const at = (h: number, m = 0) => h * 60 + m;
const b = (s: number, e: number): Booking => ({ start: s, end: e, name: 'Game' });

describe('venue availability', () => {
  it('finds the gaps between bookings within the day', () => {
    const day = [b(at(9), at(10)), b(at(10), at(11, 30)), b(at(14), at(15))];
    expect(freeWindows(day, 60)).toEqual([
      [VENUE_DAY_START, at(9)],
      [at(11, 30), at(14)],
      [at(15), VENUE_DAY_END],
    ]);
  });

  it('suggests same-length times nearest the one asked for', () => {
    const day = [b(at(9), at(10)), b(at(10), at(11, 30))];
    // Asked 9:30–10:30 (1h): it clashes; the nearest free hours come first, in time order.
    const s = suggestTimes(day, 60, at(9, 30));
    expect(s).toContainEqual([at(8), at(9)]);
    expect(s).toContainEqual([at(11, 30), at(12, 30)]);
    s.forEach(([a, z]) => expect(z - a).toBe(60));
  });

  it('has nothing to suggest when the day is fully booked', () => {
    const full = [b(VENUE_DAY_START, at(12)), b(at(12, 30), VENUE_DAY_END)];
    expect(suggestTimes(full, 60, at(9))).toEqual([]);
    // A shorter game still fits the 30-minute gap.
    expect(suggestTimes(full, 30, at(9))).toEqual([[at(12), at(12, 30)]]);
  });
});
