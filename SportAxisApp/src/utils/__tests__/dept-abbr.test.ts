import { makeAbbreviator } from '../dept-abbr';

const depts = [
  { name: 'College of Informatics and Computing Sciences', abbreviation: 'CICS' },
  { name: 'College of Engineering', abbreviation: 'CoE' },
  { name: 'College of Teacher Education', abbreviation: null }, // no abbreviation
];

describe('makeAbbreviator', () => {
  const abbr = makeAbbreviator(depts);

  it('swaps a full department name for its abbreviation', () => {
    expect(abbr('College of Informatics and Computing Sciences')).toBe('CICS');
    expect(abbr('College of Engineering')).toBe('CoE');
  });

  it('is case- and whitespace-insensitive', () => {
    expect(abbr('  college of engineering  ')).toBe('CoE');
  });

  it('returns the original name when there is no abbreviation', () => {
    expect(abbr('College of Teacher Education')).toBe('College of Teacher Education');
    expect(abbr('Some Unknown College')).toBe('Some Unknown College');
  });

  it('handles null / undefined / empty gracefully', () => {
    expect(abbr(null)).toBe('');
    expect(abbr(undefined)).toBe('');
    expect(abbr('')).toBe('');
  });

  it('is a no-op when the department list is missing', () => {
    const none = makeAbbreviator(undefined);
    expect(none('College of Engineering')).toBe('College of Engineering');
  });
});
