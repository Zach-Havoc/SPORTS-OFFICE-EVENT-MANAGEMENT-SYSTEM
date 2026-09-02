import { useEffect, useMemo, useState } from 'react';
import { eventService } from '../services/event.service';
import { makeAbbreviator } from '../utils/dept-abbr';

// Module-level cache so the department list is fetched once per app run.
let cache: { name: string; abbreviation: string | null }[] | null = null;

/**
 * `const abbr = useDeptAbbreviator();` then `abbr('College of ...')` → 'CICS'.
 * Fetches the department list once (cached, offline-tolerant); until it lands
 * the abbreviator is a no-op that returns the name unchanged.
 */
export function useDeptAbbreviator() {
  const [depts, setDepts] = useState(cache ?? []);

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

  return useMemo(() => makeAbbreviator(depts), [depts]);
}
