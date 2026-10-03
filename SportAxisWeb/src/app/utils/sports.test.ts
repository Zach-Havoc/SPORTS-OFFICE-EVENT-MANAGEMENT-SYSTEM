import { describe, it, expect } from 'vitest';
import { divisionOf, matchesSport, sportCatalog, sportOf } from './sports';

/** Sport first, then its division, instead of one long list of every line. */
describe('sports', () => {
  const cats = ['Badminton — W Doubles', 'Badminton — M Doubles', 'Basketball', 'Basketball — Men', 'Chess — Women', 'Chess — Women'];

  it('splits a stored category into sport and division', () => {
    expect(sportOf('Badminton — W Doubles')).toBe('Badminton');
    expect(divisionOf('Badminton — W Doubles')).toBe('W Doubles');
    expect(divisionOf('Basketball')).toBeNull();
  });

  it('lists each sport once, with its divisions', () => {
    expect(sportCatalog(cats)).toEqual([
      { sport: 'Badminton', divisions: ['Badminton — M Doubles', 'Badminton — W Doubles'] },
      { sport: 'Basketball', divisions: ['Basketball — Men'] },
      { sport: 'Chess', divisions: ['Chess — Women'] },
    ]);
  });

  it('a sport pick covers its divisions and the bare sport; a division pick narrows it', () => {
    expect(matchesSport('Basketball', 'Basketball', 'all')).toBe(true);
    expect(matchesSport('Basketball — Men', 'Basketball', 'all')).toBe(true);
    expect(matchesSport('Badminton — W Doubles', 'Badminton', 'Badminton — M Doubles')).toBe(false);
    expect(matchesSport('Badminton — W Doubles', 'all', 'all')).toBe(true);
    expect(matchesSport('Chess — Men', 'Badminton', 'all')).toBe(false);
  });
});
