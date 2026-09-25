import { useEffect, useMemo, useState } from 'react';
import { eventService } from '../services/event.service';
import { makeAbbreviator } from '../utils/dept-abbr';

// Module-level cache so the department list is fetched once per app run.
type Dept = { name: string; abbreviation: string | null; logo_url?: string | null };
let cache: Dept[] | null = null;

/**
 * `const abbr = useDeptAbbreviator();` then `abbr('College of ...')` → 'CICS'.
 * Fetches the department list once (cached, offline-tolerant); until it lands
 * the abbreviator is a no-op that returns the name unchanged.
 */
function useDepartmentList(): Dept[] {
  const [depts, setDepts] = useState<Dept[]>(cache ?? []);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    eventService
      .getDepartments()
      .then((d) => {
        cache = d;
        if (alive) setDepts(d);
      })
      .catch(() => {
        /* offline / not reachable — names just stay unabbreviated */
      });
    return () => {
      alive = false;
    };
  }, []);

  return depts;
}

export function useDeptAbbreviator() {
  const depts = useDepartmentList();
  return useMemo(() => makeAbbreviator(depts), [depts]);
}

/**
 * `const logoOf = useDeptLogos();` then `logoOf('College of ...')` → the
 * uploaded logo URL (Settings → Colleges on the web), or null. Matches on the
 * full name or the abbreviation, since events store either.
 */
export function useDeptLogos() {
  const depts = useDepartmentList();
  return useMemo(() => {
    const k = (v: string) => v.trim().toLowerCase();
    const byKey = new Map<string, string | null>();
    for (const d of depts) {
      byKey.set(k(d.name), d.logo_url ?? null);
      if (d.abbreviation) byKey.set(k(d.abbreviation), d.logo_url ?? null);
    }
    return (name: string | null | undefined) => (name ? byKey.get(k(name)) ?? null : null);
  }, [depts]);
}
