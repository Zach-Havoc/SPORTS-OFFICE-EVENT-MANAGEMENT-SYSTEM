// ─────────────────────────────────────────────────────────────────────────────
// Department abbreviations — "College of Informatics and Computing Sciences"
// becomes "CICS" for tight UI (score sheet headers, pickers, badges).
// ─────────────────────────────────────────────────────────────────────────────

type DeptLike = { name?: string | null; abbreviation?: string | null };

/**
 * Build a `(fullName) => abbreviation | fullName` lookup. Case/space
 * insensitive; falls back to the original name when there's no abbreviation.
 */
export function makeAbbreviator(departments: DeptLike[] | undefined) {
  const map = new Map<string, string>();
  for (const d of departments ?? []) {
    if (d?.name && d?.abbreviation) {
      map.set(d.name.trim().toLowerCase(), d.abbreviation.trim());
    }
  }

  return function abbreviate(name: string | null | undefined): string {
    if (!name) return name ?? '';
    return map.get(name.trim().toLowerCase()) ?? name;
  };
}
