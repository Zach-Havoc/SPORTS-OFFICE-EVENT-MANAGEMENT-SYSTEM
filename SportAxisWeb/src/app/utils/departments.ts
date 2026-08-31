import { useMemo } from 'react';
import { useDepartments } from '../hooks/api';

type DeptLike = { name?: string | null; abbreviation?: string | null };

const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Build a function that swaps full department names for their abbreviations
 * inside any string (event titles, department chips, etc.).
 *
 * Longer names are replaced first so "College of X and Y" wins over the
 * shorter "College of X". Matching is case-insensitive.
 */
export function makeAbbreviator(departments: DeptLike[] | undefined) {
  const pairs = (departments ?? [])
    .filter((d): d is { name: string; abbreviation: string } =>
      Boolean(d?.name && d?.abbreviation),
    )
    .map((d) => ({ name: d.name, abbr: d.abbreviation }))
    .sort((a, b) => b.name.length - a.name.length);

  const matchers = pairs.map((p) => ({
    re: new RegExp(escapeRegExp(p.name), 'gi'),
    abbr: p.abbr,
  }));

  return function abbreviate(text: string | null | undefined): string {
    if (!text) return text ?? '';
    let out = text;
    for (const m of matchers) out = out.replace(m.re, m.abbr);
    return out;
  };
}

/**
 * React hook: `const abbr = useDeptAbbreviator();` then `abbr(event.name)`.
 * Pulls the department list from the shared React Query cache.
 */
export function useDeptAbbreviator() {
  const { data } = useDepartments();
  return useMemo(() => makeAbbreviator(data as DeptLike[] | undefined), [data]);
}
