import { describe, it, expect } from 'vitest';
import { toMinutes, timeRangesOverlap, sameDay, sameVenue, findVenueClash } from './schedule';

describe('toMinutes', () => {
  it('parses 24h and 12h clock strings', () => {
    expect(toMinutes('20:00')).toBe(1200);
    expect(toMinutes('8:00')).toBe(480);
    expect(toMinutes('08:00 AM')).toBe(480);
    expect(toMinutes('8:00 PM')).toBe(1200);
    expect(toMinutes('12:00 AM')).toBe(0);
    expect(toMinutes('12:30 PM')).toBe(750);
  });

  it('returns null for junk', () => {
    expect(toMinutes('')).toBeNull();
    expect(toMinutes(null)).toBeNull();
    expect(toMinutes('later')).toBeNull();
  });
});

describe('timeRangesOverlap', () => {
  it('detects an overlap', () => {
    expect(timeRangesOverlap('20:00', '21:00', '20:30', '21:30')).toBe(true);
    expect(timeRangesOverlap('08:00 PM', '09:00 PM', '20:00', '21:00')).toBe(true); // mixed formats, identical
  });

  it('treats back-to-back slots as NOT overlapping', () => {
    expect(timeRangesOverlap('20:00', '21:00', '21:00', '22:00')).toBe(false);
  });

  it('is false when a time cannot be parsed', () => {
    expect(timeRangesOverlap('20:00', 'TBD', '20:30', '21:00')).toBe(false);
  });
});

describe('sameDay / sameVenue', () => {
  it('compares only the date part', () => {
    expect(sameDay('2026-08-31', '2026-08-31T20:00:00')).toBe(true);
    expect(sameDay('2026-08-31', '2026-09-01')).toBe(false);
  });

  it('matches venues by id, or by a real name', () => {
    expect(sameVenue({ venueId: 'a' }, { venueId: 'a' })).toBe(true);
    expect(sameVenue({ venueId: 'a' }, { venueId: 'b' })).toBe(false);
    expect(sameVenue({ venueName: 'Joson Gym' }, { venueName: 'joson gym' })).toBe(true);
    expect(sameVenue({ venueName: 'TBD' }, { venueName: 'TBD' })).toBe(false);
  });
});

describe('findVenueClash', () => {
  const existing = [
    { name: 'Basketball R1', venueId: 'gym', schedule: '2026-08-31', startTime: '20:00', endTime: '21:00' },
  ];

  it('flags a same-venue, same-day, overlapping booking', () => {
    const hit = findVenueClash(
      { name: 'New', venueId: 'gym', schedule: '2026-08-31', startTime: '20:30', endTime: '21:30' },
      existing,
    );
    expect(hit?.name).toBe('Basketball R1');
  });

  it('allows a different day, a different venue, or a non-overlapping time', () => {
    expect(findVenueClash({ venueId: 'gym', schedule: '2026-09-01', startTime: '20:00', endTime: '21:00' }, existing)).toBeNull();
    expect(findVenueClash({ venueId: 'pool', schedule: '2026-08-31', startTime: '20:00', endTime: '21:00' }, existing)).toBeNull();
    expect(findVenueClash({ venueId: 'gym', schedule: '2026-08-31', startTime: '21:00', endTime: '22:00' }, existing)).toBeNull();
  });

  it('skips the check when the slot has no real venue', () => {
    expect(findVenueClash({ venueName: 'TBD', schedule: '2026-08-31', startTime: '20:00', endTime: '21:00' }, existing)).toBeNull();
  });
});
