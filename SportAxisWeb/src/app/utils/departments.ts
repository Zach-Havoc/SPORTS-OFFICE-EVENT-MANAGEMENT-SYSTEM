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

const STOPWORDS = /^(of|and|the|for|in|at|de|del|la|y)$/i;

/** Initials of the significant words — "College of Arts and Sciences" → "CAS". */
export function deptAcronym(name: string): string {
  return name
    .split(/[\s,&/().-]+/)
    .filter((w) => w && !STOPWORDS.test(w))
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}

/**
 * A guaranteed-short label for tight UI (bracket boxes, chips): the registered
 * abbreviation if there is one, else a derived acronym, else a hard-truncated
 * name. Never returns a multi-line paragraph.
 */
export function shortDeptLabel(
  abbreviate: (t: string | null | undefined) => string,
  name: string | null | undefined,
  max = 14,
): string {
  if (!name) return '';
  const a = abbreviate(name);
  if (a !== name) return a;              // registered abbreviation
  if (name.length <= max) return name;   // already short enough
  const ac = deptAcronym(name);
  if (ac.length >= 2 && ac.length <= 12) return ac;
  return name.slice(0, max - 1).trimEnd() + '…';
}
