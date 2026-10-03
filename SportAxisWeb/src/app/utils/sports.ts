/**
 * A scheduled sport is stored as "<sport> — <division>" ("Badminton — W
 * Doubles", "Basketball — Men"), or just "<sport>". Filters pick the sport
 * first and only then its division, so racquet sports' six lines don't flood
 * one long list.
 */

const SEP = ' — ';

/** "Badminton — W Doubles" → "Badminton". */
export const sportOf = (category: string) => String(category ?? '').split(SEP)[0].trim();

/** "Badminton — W Doubles" → "W Doubles"; null when there's no division. */
export const divisionOf = (category: string) => {
  const i = String(category ?? '').indexOf(SEP);
  return i >= 0 ? category.slice(i + SEP.length).trim() : null;
};

export interface SportEntry {
  sport: string;
  /** The full stored categories that have a division, e.g. "Badminton — M Doubles". */
  divisions: string[];
}

/** Each sport once, alphabetically, with its divisions. */
export function sportCatalog(categories: (string | null | undefined)[]): SportEntry[] {
  const by = new Map<string, Set<string>>();
  for (const c of categories) {
    if (!c) continue;
    const sport = sportOf(c);
    if (!by.has(sport)) by.set(sport, new Set());
    if (divisionOf(c)) by.get(sport)!.add(c);
  }
  return [...by.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([sport, divs]) => ({ sport, divisions: [...divs].sort((a, b) => a.localeCompare(b)) }));
}

/**
 * Whether an event's category passes a sport + division pick ('all' for
 * either means any). A sport pick covers every division and the bare sport.
 */
export function matchesSport(category: string, sport: string, division: string) {
  if (sport === 'all') return true;
  if (sportOf(category) !== sport) return false;
  return division === 'all' || category === division;
}
